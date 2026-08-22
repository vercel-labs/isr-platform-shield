import { join } from "node:path";
import { loadConfig, type RuntimeConfig, validateRequirements } from "./config";
import { EvidenceWriter, sanitizeResponseBody } from "./evidence";
import { EvidenceHttpClient } from "./http";
import { type ScenarioDefinition, scenarios } from "./scenarios";
import type {
	Confidence,
	Environment,
	ProposalDisposition,
	ResultStatus,
	ScenarioOutcome,
	ScenarioSummary,
	ValidationSummary,
} from "./types";

const SMOKE_SCENARIOS = ["B1.1"];

export interface ValidationOptions {
	suites: string[];
	environment?: Environment;
	runs: number;
	outputDirectory?: string;
	invocationId: string;
	confirmCrossEnvironment?: boolean;
	env?: NodeJS.ProcessEnv;
}

export interface ValidationResult {
	summary: ValidationSummary;
	outputDirectory: string;
	eventsPath: string;
	summaryPath: string;
}

function normalizedSelectors(selectors: string[]): string[] {
	return selectors
		.flatMap((selector) => selector.split(","))
		.map((selector) => selector.trim())
		.filter(Boolean)
		.map((selector) => selector.toUpperCase());
}

export function selectScenarios(selectors: string[]): ScenarioDefinition[] {
	const normalized = normalizedSelectors(
		selectors.length > 0 ? selectors : ["smoke"],
	);
	const requestedIds = new Set<string>();

	for (const selector of normalized) {
		if (selector === "SMOKE") {
			for (const id of SMOKE_SCENARIOS) {
				requestedIds.add(id);
			}
			continue;
		}
		if (selector === "ALL") {
			for (const scenario of scenarios) {
				requestedIds.add(scenario.id);
			}
			continue;
		}
		const exact = scenarios.find((scenario) => scenario.id === selector);
		if (exact) {
			requestedIds.add(exact.id);
			continue;
		}
		const section = scenarios.filter((scenario) =>
			scenario.id.startsWith(`${selector}.`),
		);
		if (section.length > 0) {
			for (const scenario of section) {
				requestedIds.add(scenario.id);
			}
			continue;
		}
		throw new Error(
			`unknown suite or scenario ${selector}; use --list to see valid IDs`,
		);
	}

	const needsGate = scenarios.some(
		(scenario) =>
			requestedIds.has(scenario.id) &&
			scenario.destructive &&
			scenario.id !== "B1.1",
	);
	if (needsGate) {
		requestedIds.add("B1.1");
	}

	return scenarios.filter((scenario) => requestedIds.has(scenario.id));
}

function dispositionFor(outcomes: ScenarioOutcome[]): ResultStatus {
	if (outcomes.some((outcome) => outcome.disposition === "FAIL")) {
		return "FAIL";
	}
	if (outcomes.some((outcome) => outcome.disposition === "BLOCKED")) {
		return "BLOCKED";
	}
	return "PASS";
}

function confidenceFor(disposition: ResultStatus, runs: number): Confidence {
	if (disposition === "FAIL") {
		return "failed";
	}
	if (disposition === "BLOCKED") {
		return "blocked";
	}
	return runs >= 3 ? "observed 3x" : "observed once";
}

function secretValues(config: RuntimeConfig): string[] {
	return [
		config.controlToken,
		config.vercelToken,
		config.shieldBypassToken,
		config.coreBypassToken,
		config.externalShieldBypassToken,
	].filter((value): value is string => Boolean(value));
}

function sanitizedError(error: unknown, config: RuntimeConfig): string {
	const message = error instanceof Error ? error.message : String(error);
	const sanitized = sanitizeResponseBody(
		{ error: message },
		secretValues(config),
	);
	if (
		sanitized &&
		typeof sanitized === "object" &&
		"error" in sanitized &&
		typeof (sanitized as { error: unknown }).error === "string"
	) {
		return (sanitized as { error: string }).error;
	}
	return "scenario failed with a redacted error";
}

function observedResults(outcomes: ScenarioOutcome[]): string {
	const values = outcomes.map((outcome) => outcome.observedResult);
	if (new Set(values).size === 1) {
		return values[0];
	}
	return values.map((value, index) => `run ${index + 1}: ${value}`).join(" | ");
}

function blockedOutcomes(runs: number, reason: string): ScenarioOutcome[] {
	return Array.from({ length: runs }, () => ({
		disposition: "BLOCKED" as const,
		observedResult: reason,
	}));
}

async function recordOutcomes(
	writer: EvidenceWriter,
	definition: ScenarioDefinition,
	outcomes: ScenarioOutcome[],
): Promise<void> {
	for (const [index, outcome] of outcomes.entries()) {
		const proposalDisposition =
			outcome.disposition === "BLOCKED"
				? "undetermined"
				: (outcome.proposalDisposition ?? definition.proposalDisposition);
		await writer.operation(
			definition.id,
			index + 1,
			{ name: "scenario.result" },
			{ ...outcome, proposalDisposition },
		);
	}
}

function makeScenarioSummary(
	definition: ScenarioDefinition,
	outcomes: ScenarioOutcome[],
	options: ValidationOptions,
): ScenarioSummary {
	const disposition = dispositionFor(outcomes);
	const proposalDisposition: ProposalDisposition =
		disposition === "BLOCKED"
			? "undetermined"
			: (outcomes.find((outcome) => outcome.proposalDisposition)
					?.proposalDisposition ?? definition.proposalDisposition);
	const failures = outcomes
		.map((outcome, index) => ({ outcome, run: index + 1 }))
		.filter(({ outcome }) => outcome.disposition === "FAIL")
		.map(({ outcome, run }) => `run ${run}: ${outcome.observedResult}`);
	let observedResult = observedResults(outcomes);
	if (definition.timingSensitive && outcomes.length < 3) {
		observedResult +=
			"; timing evidence is below the 3-run minimum, rerun with --runs 3";
	}

	return {
		id: definition.id,
		title: definition.title,
		observedResult,
		runCount: outcomes.length,
		environments:
			definition.id === "B5.6"
				? ["preview", "production"]
				: options.environment
					? [options.environment]
					: [],
		confidence: confidenceFor(disposition, outcomes.length),
		disposition,
		proposalDisposition,
		failures,
	};
}

async function executeScenario(
	definition: ScenarioDefinition,
	config: RuntimeConfig,
	writer: EvidenceWriter,
	http: EvidenceHttpClient,
	options: ValidationOptions,
	shared: Map<string, unknown>,
	gateDisposition?: ResultStatus,
): Promise<ScenarioSummary> {
	const runCount = definition.id.startsWith("B6.") ? 1 : options.runs;
	let outcomes: ScenarioOutcome[];
	if (
		(definition.gateDependent ||
			(definition.destructive && definition.id !== "B1.1")) &&
		gateDisposition !== "PASS"
	) {
		outcomes = blockedOutcomes(
			runCount,
			`B1.1 stop gate was ${gateDisposition ?? "not run"}`,
		);
	} else {
		const requirementErrors = validateRequirements(
			config,
			definition.requires,
			options.environment,
		);
		if (requirementErrors.length > 0) {
			outcomes = blockedOutcomes(runCount, requirementErrors.join("; "));
		} else {
			outcomes = [];
			for (let run = 1; run <= runCount; run += 1) {
				try {
					outcomes.push(
						await definition.execute({
							config,
							environment: options.environment,
							http,
							writer,
							invocationId: options.invocationId,
							scenarioId: definition.id,
							run,
							shared,
						}),
					);
				} catch (error) {
					outcomes.push({
						disposition: "FAIL",
						observedResult: sanitizedError(error, config),
					});
				}
			}
		}
	}

	await recordOutcomes(writer, definition, outcomes);
	return makeScenarioSummary(definition, outcomes, options);
}

function overallDisposition(summaries: ScenarioSummary[]): ResultStatus {
	if (summaries.some((summary) => summary.disposition === "FAIL")) {
		return "FAIL";
	}
	if (summaries.some((summary) => summary.disposition === "BLOCKED")) {
		return "BLOCKED";
	}
	return "PASS";
}

function overallProposalDisposition(
	summaries: ScenarioSummary[],
	disposition: ResultStatus,
): ProposalDisposition {
	if (disposition === "BLOCKED") return "undetermined";
	const values = summaries.map((summary) => summary.proposalDisposition);
	if (values.includes("architecture-change")) return "architecture-change";
	if (values.includes("escalate-to-sign-off")) return "escalate-to-sign-off";
	if (values.includes("documentable-with-caveat")) {
		return "documentable-with-caveat";
	}
	return "documentable";
}

export async function runValidation(
	options: ValidationOptions,
): Promise<ValidationResult> {
	ensureRunCount(options.runs);
	const selected = selectScenarios(options.suites);
	const destructive = selected.filter((scenario) => scenario.destructive);
	if (destructive.length > 0 && !options.environment) {
		throw new Error(
			`--environment preview|production is required by destructive scenarios: ${destructive
				.map((scenario) => scenario.id)
				.join(", ")}`,
		);
	}
	const sourceEnv = options.env ?? process.env;
	if (destructive.length > 0 && options.environment) {
		const prefix = options.environment.toUpperCase();
		if (!sourceEnv[`${prefix}_SHIELD_URL`]?.trim()) {
			throw new Error(
				`${prefix}_SHIELD_URL is required for destructive scenarios; unscoped SHIELD_URL fallback is not allowed`,
			);
		}
		if (
			selected.some((scenario) => scenario.requires.includes("coreUrl")) &&
			!sourceEnv[`${prefix}_CORE_URL`]?.trim()
		) {
			throw new Error(
				`${prefix}_CORE_URL is required for selected destructive scenarios; unscoped CORE_URL fallback is not allowed`,
			);
		}
	}
	if (
		selected.some((scenario) => scenario.id === "B5.6") &&
		!options.confirmCrossEnvironment
	) {
		throw new Error(
			"B5.6 mutates Preview and Production; rerun with --confirm-cross-environment",
		);
	}

	const outputDirectory = join(
		options.outputDirectory ?? join(process.cwd(), "evidence"),
		options.invocationId,
	);
	const config = loadConfig(sourceEnv, options.environment);
	const writer = new EvidenceWriter(outputDirectory, secretValues(config));
	await writer.initialize();
	const http = new EvidenceHttpClient(writer, config);
	const startedAt = new Date().toISOString();
	const scenarioSummaries: ScenarioSummary[] = [];
	const shared = new Map<string, unknown>();
	let gateDisposition: ResultStatus | undefined;

	for (const definition of selected) {
		const summary = await executeScenario(
			definition,
			config,
			writer,
			http,
			options,
			shared,
			gateDisposition,
		);
		scenarioSummaries.push(summary);
		if (definition.id === "B1.1") {
			gateDisposition = summary.disposition;
		}
	}

	const disposition = overallDisposition(scenarioSummaries);
	const passCount = scenarioSummaries.filter(
		(summary) => summary.disposition === "PASS",
	).length;
	const blockedCount = scenarioSummaries.filter(
		(summary) => summary.disposition === "BLOCKED",
	).length;
	const failedCount = scenarioSummaries.filter(
		(summary) => summary.disposition === "FAIL",
	).length;
	const minimumObservedRuns = Math.min(
		...scenarioSummaries.map((summary) => summary.runCount),
	);
	const summary: ValidationSummary = {
		schemaVersion: 1,
		invocationId: options.invocationId,
		startedAt,
		finishedAt: new Date().toISOString(),
		suites: options.suites.length > 0 ? options.suites : ["smoke"],
		selectedScenarioIds: selected.map((scenario) => scenario.id),
		observedResult: `${passCount} passed, ${blockedCount} blocked, ${failedCount} failed`,
		runCount: options.runs,
		environments: selected.some((scenario) => scenario.id === "B5.6")
			? ["preview", "production"]
			: options.environment
				? [options.environment]
				: [],
		confidence: confidenceFor(disposition, minimumObservedRuns),
		disposition,
		proposalDisposition: overallProposalDisposition(
			scenarioSummaries,
			disposition,
		),
		failures: scenarioSummaries.flatMap((scenario) =>
			scenario.failures.map((failure) => `${scenario.id}: ${failure}`),
		),
		scenarios: scenarioSummaries,
	};
	await writer.summary(summary);

	return {
		summary,
		outputDirectory: writer.outputDirectory,
		eventsPath: writer.eventsPath,
		summaryPath: writer.summaryPath,
	};
}

function ensureRunCount(runs: number): void {
	if (!Number.isInteger(runs) || runs < 1 || runs > 20) {
		throw new Error("--runs must be an integer from 1 to 20");
	}
}
