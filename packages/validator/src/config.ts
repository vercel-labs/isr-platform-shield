import type { Environment } from "./types";

export interface RuntimeConfig {
	shieldUrl?: string;
	coreUrl?: string;
	controlToken?: string;
	vercelToken?: string;
	coreProjectId?: string;
	shieldProjectId?: string;
	teamId?: string;
	teamSlug?: string;
	externalShieldUrl?: string;
	externalShieldProjectId?: string;
	previewShieldUrl?: string;
	previewCoreUrl?: string;
	productionShieldUrl?: string;
	productionCoreUrl?: string;
	shieldBypassToken?: string;
	coreBypassToken?: string;
	externalShieldBypassToken?: string;
	vercelApiUrl: string;
	requestTimeoutMs: number;
	pollTimeoutMs: number;
	pollIntervalMs: number;
	b2RequestIntervalMs: number;
	invalidationGapMs: number;
	faultDelayMs: number;
	purgePropagationTimeoutMs: number;
	tagPropagationSettleMs: number;
	b6PreEvidencePath?: string;
	b6PostEvidencePath?: string;
	b6PreManifestPath?: string;
	b6PostManifestPath?: string;
	b6MiddlewareO11yPath?: string;
	b6MissO11yPath?: string;
}

export type ConfigRequirement =
	| "shieldUrl"
	| "coreUrl"
	| "controlToken"
	| "vercelToken"
	| "coreProjectId"
	| "shieldProjectId"
	| "externalShieldUrl"
	| "externalShieldProjectId"
	| "previewShieldUrl"
	| "previewCoreUrl"
	| "productionShieldUrl"
	| "productionCoreUrl";

const URL_REQUIREMENTS = new Set<ConfigRequirement>([
	"shieldUrl",
	"coreUrl",
	"externalShieldUrl",
	"previewShieldUrl",
	"previewCoreUrl",
	"productionShieldUrl",
	"productionCoreUrl",
]);

function value(env: NodeJS.ProcessEnv, name: string): string | undefined {
	const current = env[name]?.trim();
	return current ? current : undefined;
}

function scopedUrl(
	env: NodeJS.ProcessEnv,
	environment: Environment | undefined,
	kind: "SHIELD" | "CORE",
): string | undefined {
	if (!environment) {
		return value(env, `${kind}_URL`);
	}

	return (
		value(env, `${environment.toUpperCase()}_${kind}_URL`) ??
		value(env, `${kind}_URL`)
	);
}

function positiveInteger(
	env: NodeJS.ProcessEnv,
	name: string,
	fallback: number,
): number {
	const raw = value(env, name);
	if (!raw) {
		return fallback;
	}

	const parsed = Number(raw);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		throw new Error(`${name} must be a positive integer`);
	}
	return parsed;
}

export function loadConfig(
	env: NodeJS.ProcessEnv,
	environment?: Environment,
): RuntimeConfig {
	return {
		shieldUrl: scopedUrl(env, environment, "SHIELD"),
		coreUrl: scopedUrl(env, environment, "CORE"),
		controlToken: value(env, "POC_CONTROL_TOKEN"),
		vercelToken: value(env, "VERCEL_TOKEN"),
		coreProjectId: value(env, "CORE_PROJECT_ID"),
		shieldProjectId: value(env, "SHIELD_PROJECT_ID"),
		teamId: value(env, "VERCEL_TEAM_ID"),
		teamSlug: value(env, "VERCEL_TEAM_SLUG"),
		externalShieldUrl: value(env, "EXTERNAL_ORIGIN_SHIELD_URL"),
		externalShieldProjectId: value(env, "EXTERNAL_ORIGIN_SHIELD_PROJECT_ID"),
		previewShieldUrl: value(env, "PREVIEW_SHIELD_URL"),
		previewCoreUrl: value(env, "PREVIEW_CORE_URL"),
		productionShieldUrl: value(env, "PRODUCTION_SHIELD_URL"),
		productionCoreUrl: value(env, "PRODUCTION_CORE_URL"),
		shieldBypassToken: value(env, "SHIELD_BYPASS_TOKEN"),
		coreBypassToken: value(env, "CORE_BYPASS_TOKEN"),
		externalShieldBypassToken: value(
			env,
			"EXTERNAL_ORIGIN_SHIELD_BYPASS_TOKEN",
		),
		vercelApiUrl: value(env, "VERCEL_API_URL") ?? "https://api.vercel.com",
		requestTimeoutMs: positiveInteger(env, "POC_REQUEST_TIMEOUT_MS", 20_000),
		pollTimeoutMs: positiveInteger(env, "POC_POLL_TIMEOUT_MS", 90_000),
		pollIntervalMs: positiveInteger(env, "POC_POLL_INTERVAL_MS", 400),
		b2RequestIntervalMs: positiveInteger(
			env,
			"POC_B2_REQUEST_INTERVAL_MS",
			1_000,
		),
		invalidationGapMs: positiveInteger(env, "POC_INVALIDATION_GAP_MS", 2_000),
		faultDelayMs: positiveInteger(env, "POC_FAULT_DELAY_MS", 1_500),
		purgePropagationTimeoutMs: positiveInteger(
			env,
			"POC_PURGE_PROPAGATION_TIMEOUT_MS",
			5_000,
		),
		tagPropagationSettleMs: positiveInteger(
			env,
			"POC_TAG_PROPAGATION_SETTLE_MS",
			1_500,
		),
		b6PreEvidencePath: value(env, "B6_PRE_EVIDENCE_PATH"),
		b6PostEvidencePath: value(env, "B6_POST_EVIDENCE_PATH"),
		b6PreManifestPath: value(env, "B6_PRE_MANIFEST_PATH"),
		b6PostManifestPath: value(env, "B6_POST_MANIFEST_PATH"),
		b6MiddlewareO11yPath: value(env, "B6_MIDDLEWARE_O11Y_PATH"),
		b6MissO11yPath: value(env, "B6_MISS_O11Y_PATH"),
	};
}

export function requirementLabel(
	requirement: ConfigRequirement,
	environment?: Environment,
): string {
	switch (requirement) {
		case "shieldUrl":
			return environment
				? `${environment.toUpperCase()}_SHIELD_URL or SHIELD_URL`
				: "SHIELD_URL";
		case "coreUrl":
			return environment
				? `${environment.toUpperCase()}_CORE_URL or CORE_URL`
				: "CORE_URL";
		case "controlToken":
			return "POC_CONTROL_TOKEN";
		case "vercelToken":
			return "VERCEL_TOKEN";
		case "coreProjectId":
			return "CORE_PROJECT_ID";
		case "shieldProjectId":
			return "SHIELD_PROJECT_ID";
		case "externalShieldUrl":
			return "EXTERNAL_ORIGIN_SHIELD_URL";
		case "externalShieldProjectId":
			return "EXTERNAL_ORIGIN_SHIELD_PROJECT_ID";
		case "previewShieldUrl":
			return "PREVIEW_SHIELD_URL";
		case "previewCoreUrl":
			return "PREVIEW_CORE_URL";
		case "productionShieldUrl":
			return "PRODUCTION_SHIELD_URL";
		case "productionCoreUrl":
			return "PRODUCTION_CORE_URL";
	}
}

export function validateRequirements(
	config: RuntimeConfig,
	requirements: ConfigRequirement[],
	environment?: Environment,
): string[] {
	const errors: string[] = [];

	for (const requirement of requirements) {
		const current = config[requirement];
		const label = requirementLabel(requirement, environment);
		if (!current) {
			errors.push(`${label} is required`);
			continue;
		}

		if (URL_REQUIREMENTS.has(requirement)) {
			try {
				const parsed = new URL(current);
				if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
					throw new Error("unsupported protocol");
				}
			} catch {
				errors.push(`${label} must be an absolute HTTP(S) URL`);
			}
		}
	}

	return errors;
}

export function normalizeBaseUrl(url: string): string {
	return url.replace(/\/+$/, "");
}
