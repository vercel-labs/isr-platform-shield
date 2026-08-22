#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { runValidation, selectScenarios } from "./runner";
import { scenarios } from "./scenarios";
import type { Environment } from "./types";

interface CliOptions {
	suites: string[];
	environment?: Environment;
	runs: number;
	outputDirectory?: string;
	confirmCrossEnvironment: boolean;
	list: boolean;
	help: boolean;
}

const HELP = `Shield behavioral acceptance validator

Usage:
  pnpm validate [--suite <selector>] [--environment preview|production]
                [--runs <1-20>] [--output <directory>]
                [--confirm-cross-environment]

Selectors:
  smoke             B1.1 propagation stop gate (default)
  B1                all scenarios in section B1
  B1.2,B3.5         comma-separated scenario IDs
  all               every scenario

Options:
  --suite            Scenario ID, section, smoke, or all; may be repeated
  --environment      Required before any control or cache mutation
  --runs             Independent namespaced runs per scenario (default: 1)
  --output           Directory for events.jsonl and summary.json
  --confirm-cross-environment
                     Required before B5.6 mutates Preview and Production
  --list             List scenarios
  --help              Show this help
`;

function optionValue(
	args: string[],
	index: number,
	inlineValue: string | undefined,
	name: string,
): { value: string; nextIndex: number } {
	if (inlineValue !== undefined) {
		if (!inlineValue) {
			throw new Error(`${name} requires a value`);
		}
		return { value: inlineValue, nextIndex: index };
	}
	const value = args[index + 1];
	if (!value || value.startsWith("--")) {
		throw new Error(`${name} requires a value`);
	}
	return { value, nextIndex: index + 1 };
}

export function parseCliArgs(args: string[]): CliOptions {
	const options: CliOptions = {
		suites: [],
		runs: 1,
		list: false,
		help: false,
		confirmCrossEnvironment: false,
	};

	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index];
		const [name, inlineValue] = argument.split(/=(.*)/s, 2);
		if (name === "--help" || name === "-h") {
			options.help = true;
			continue;
		}
		if (name === "--list") {
			options.list = true;
			continue;
		}
		if (name === "--confirm-cross-environment") {
			options.confirmCrossEnvironment = true;
			continue;
		}
		if (name === "--suite") {
			const parsed = optionValue(args, index, inlineValue, name);
			options.suites.push(parsed.value);
			index = parsed.nextIndex;
			continue;
		}
		if (name === "--environment") {
			const parsed = optionValue(args, index, inlineValue, name);
			if (parsed.value !== "preview" && parsed.value !== "production") {
				throw new Error("--environment must be preview or production");
			}
			options.environment = parsed.value;
			index = parsed.nextIndex;
			continue;
		}
		if (name === "--runs") {
			const parsed = optionValue(args, index, inlineValue, name);
			options.runs = Number(parsed.value);
			index = parsed.nextIndex;
			continue;
		}
		if (name === "--output") {
			const parsed = optionValue(args, index, inlineValue, name);
			options.outputDirectory = parsed.value;
			index = parsed.nextIndex;
			continue;
		}
		throw new Error(`unknown argument ${argument}`);
	}

	if (options.suites.length === 0) {
		options.suites.push("smoke");
	}
	return options;
}

function invocationId(): string {
	const timestamp = new Date()
		.toISOString()
		.replace(/[-:.TZ]/g, "")
		.slice(0, 14);
	return `poc-${timestamp}-${randomUUID().slice(0, 8)}`;
}

async function main(): Promise<void> {
	const options = parseCliArgs(process.argv.slice(2));
	if (options.help) {
		process.stdout.write(HELP);
		return;
	}
	if (options.list) {
		for (const scenario of scenarios) {
			process.stdout.write(`${scenario.id}\t${scenario.title}\n`);
		}
		return;
	}

	selectScenarios(options.suites);
	const result = await runValidation({
		suites: options.suites,
		environment: options.environment,
		runs: options.runs,
		outputDirectory: options.outputDirectory,
		invocationId: invocationId(),
		confirmCrossEnvironment: options.confirmCrossEnvironment,
	});

	for (const scenario of result.summary.scenarios) {
		process.stdout.write(
			`[${scenario.disposition}] ${scenario.id} ${scenario.title}: ${scenario.observedResult}\n`,
		);
	}
	process.stdout.write(`Evidence: ${result.outputDirectory}\n`);

	if (result.summary.disposition === "FAIL") {
		process.exitCode = 1;
	} else if (result.summary.disposition === "BLOCKED") {
		process.exitCode = 2;
	}
}

if (require.main === module) {
	void main().catch((error: unknown) => {
		const message = error instanceof Error ? error.message : String(error);
		process.stderr.write(`validator: ${message}\n`);
		process.exitCode = 2;
	});
}
