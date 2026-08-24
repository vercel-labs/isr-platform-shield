import { readFile } from "node:fs/promises";
import type { ConfigRequirement, RuntimeConfig } from "./config";
import { normalizeBaseUrl } from "./config";
import type { EvidenceWriter } from "./evidence";
import type { EvidenceHttpClient } from "./http";
import { parseMarker } from "./http";
import type {
	Environment,
	Marker,
	OperationEvidence,
	Profile,
	ProposalDisposition,
	RecordedResponse,
	ScenarioOutcome,
} from "./types";

const PROFILES: Profile[] = ["free", "member", "enterprise"];
const PROFILE_COOKIE = "poc-profile";

export interface ScenarioContext {
	config: RuntimeConfig;
	environment?: Environment;
	http: EvidenceHttpClient;
	writer: EvidenceWriter;
	invocationId: string;
	scenarioId: string;
	run: number;
	shared: Map<string, unknown>;
}

export interface ScenarioDefinition {
	id: string;
	title: string;
	requires: ConfigRequirement[];
	destructive: boolean;
	timingSensitive?: boolean;
	gateDependent?: boolean;
	proposalDisposition: ProposalDisposition;
	execute: (context: ScenarioContext) => Promise<ScenarioOutcome>;
}

interface RequestObservation {
	elapsedMs: number;
	status: number;
	version: number | null;
	renderId: string | null;
	cache: string | null;
	age: string | null;
	durationMs: number;
}

interface CanonicalResult {
	core: RecordedResponse;
	shield: RecordedResponse | null;
	shieldCalled: boolean;
}

function pass(
	observedResult: string,
	proposalDisposition?: ProposalDisposition,
): ScenarioOutcome {
	return { disposition: "PASS", observedResult, proposalDisposition };
}

function blocked(observedResult: string): ScenarioOutcome {
	return {
		disposition: "BLOCKED",
		observedResult,
		proposalDisposition: "undetermined",
	};
}

function ensure(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

function pathFor(context: ScenarioContext, suffix = ""): string {
	const id = context.scenarioId.toLowerCase().replace(/\./g, "-");
	return `${context.invocationId}-${id}-r${context.run}${suffix}`;
}

function versionFor(context: ScenarioContext, step: number): number {
	const match = /^B(\d+)\.(\d+)$/.exec(context.scenarioId);
	ensure(match, `invalid scenario ID ${context.scenarioId}`);
	return (
		Number(match[1]) * 1_000_000 +
		Number(match[2]) * 10_000 +
		context.run * 100 +
		step
	);
}

function endpoint(baseUrl: string, route: string, path?: string): string {
	const encodedPath = path
		? path
				.split("/")
				.map((segment) => encodeURIComponent(segment))
				.join("/")
		: "";
	return `${normalizeBaseUrl(baseUrl)}${route}${encodedPath}`;
}

function normalizeMarkerPath(path: string): string {
	return path.replace(/^\/+|\/+$/g, "");
}

function assertMarker(
	response: RecordedResponse,
	expectedPath: string,
	expectedProfile?: "default" | Profile,
): Marker {
	ensure(
		response.status === 200,
		`expected status 200, received ${response.status}`,
	);
	ensure(response.marker, "response did not satisfy the marker contract");
	ensure(response.marker.renderId.length > 0, "marker renderId was empty");
	ensure(
		Number.isInteger(response.marker.contentVersion),
		"marker contentVersion was not an integer",
	);
	ensure(
		normalizeMarkerPath(response.marker.path) ===
			normalizeMarkerPath(expectedPath),
		`marker path ${response.marker.path} did not match ${expectedPath}`,
	);
	if (expectedProfile) {
		ensure(
			response.marker.profile === expectedProfile,
			`expected profile ${expectedProfile}, received ${response.marker.profile}`,
		);
	}
	ensure(response.marker.tags.length > 0, "marker returned no cache tags");
	ensure(
		Number.isFinite(Date.parse(response.marker.renderedAt)),
		`marker renderedAt is not a date: ${response.marker.renderedAt}`,
	);
	return response.marker;
}

function safePathTags(marker: Marker, path: string): string[] {
	return marker.tags.filter(
		(tag) => tag.startsWith("poc:") && tag.includes(`path:${path}`),
	);
}

function exactPathTag(marker: Marker, path: string): string | undefined {
	return marker.tags.find((tag) => tag === `poc:path:${path}`);
}

function exactProfileTag(
	marker: Marker,
	path: string,
	profile: Profile,
): string | undefined {
	return marker.tags.find(
		(tag) => tag === `poc:path:${path}:profile:${profile}`,
	);
}

function bypassHeaders(token?: string): Record<string, string> {
	return token ? { "x-vercel-protection-bypass": token } : {};
}

async function fixtureRequest(
	context: ScenarioContext,
	input: {
		baseUrl: string;
		role: string;
		kind: "page" | "profile";
		path: string;
		profile?: Profile;
		bypassToken?: string;
		useBypass?: boolean;
		redirect?: RequestRedirect;
	},
): Promise<RecordedResponse> {
	return context.http.request({
		scenarioId: context.scenarioId,
		run: context.run,
		url: endpoint(input.baseUrl, `/__poc/${input.kind}/`, input.path),
		headers: input.useBypass === false ? {} : bypassHeaders(input.bypassToken),
		cookies: input.profile ? { [PROFILE_COOKIE]: input.profile } : undefined,
		redirect: input.redirect,
		operation: {
			name: `fixture.${input.kind}.${input.role}`,
			path: input.path,
		},
	});
}

function shieldFixture(
	context: ScenarioContext,
	kind: "page" | "profile",
	path: string,
	profile?: Profile,
): Promise<RecordedResponse> {
	return fixtureRequest(context, {
		baseUrl: context.config.shieldUrl as string,
		role: "shield",
		kind,
		path,
		profile,
		bypassToken: context.config.shieldBypassToken,
	});
}

function coreFixture(
	context: ScenarioContext,
	kind: "page" | "profile",
	path: string,
	profile?: Profile,
): Promise<RecordedResponse> {
	return fixtureRequest(context, {
		baseUrl: context.config.coreUrl as string,
		role: "core",
		kind,
		path,
		profile,
		bypassToken: context.config.coreBypassToken,
	});
}

async function controlAt(
	context: ScenarioContext,
	baseUrl: string,
	bypassToken: string | undefined,
	route: "status" | "bump" | "fault" | "revalidate" | "oidc-rest",
	body: unknown,
	operation: OperationEvidence,
	requireOk = true,
): Promise<RecordedResponse> {
	const response = await context.http.request({
		scenarioId: context.scenarioId,
		run: context.run,
		url: endpoint(baseUrl, `/__poc/control/${route}`),
		method: "POST",
		headers: {
			...bypassHeaders(bypassToken),
			authorization: `Bearer ${context.config.controlToken as string}`,
		},
		body,
		operation: {
			...operation,
			target: operation.target ?? context.environment,
		},
	});
	ensure(
		response.cacheControl?.toLowerCase().includes("no-store"),
		`control ${route} response must set Cache-Control: no-store`,
	);
	if (requireOk) {
		ensure(response.ok, `control ${route} returned status ${response.status}`);
	}
	return response;
}

function control(
	context: ScenarioContext,
	route: "status" | "bump" | "fault" | "revalidate" | "oidc-rest",
	body: unknown,
	operation: OperationEvidence,
	requireOk = true,
): Promise<RecordedResponse> {
	return controlAt(
		context,
		context.config.shieldUrl as string,
		context.config.shieldBypassToken,
		route,
		body,
		operation,
		requireOk,
	);
}

async function bumpAt(
	context: ScenarioContext,
	baseUrl: string,
	bypassToken: string | undefined,
	path: string,
	contentVersion: number,
	profiles?: Partial<Record<Profile, number>>,
	operationTarget?: Environment,
): Promise<void> {
	await controlAt(
		context,
		baseUrl,
		bypassToken,
		"bump",
		{ path, contentVersion, profiles },
		{ name: "fixture.control.bump", path, target: operationTarget },
	);
}

function bump(
	context: ScenarioContext,
	path: string,
	contentVersion: number,
	profiles?: Partial<Record<Profile, number>>,
): Promise<void> {
	return bumpAt(
		context,
		context.config.shieldUrl as string,
		context.config.shieldBypassToken,
		path,
		contentVersion,
		profiles,
	);
}

async function setFault(
	context: ScenarioContext,
	path: string,
	fault: { delayMs?: number; force500?: boolean },
): Promise<void> {
	await control(
		context,
		"fault",
		{ path, ...fault },
		{ name: "fixture.control.fault", path },
	);
}

function clearFault(context: ScenarioContext, path: string): Promise<void> {
	return setFault(context, path, { delayMs: 0, force500: false });
}

async function revalidateTag(
	context: ScenarioContext,
	tag: string,
): Promise<void> {
	await control(
		context,
		"revalidate",
		{ tag, mode: "revalidate" },
		{ name: "fixture.control.revalidate", tags: [tag] },
	);
}

export function edgeCacheRequestBody(
	kind: "invalidate" | "delete",
	tags: string[],
	target: Environment,
): Record<string, unknown> {
	ensure(
		target === "preview" || target === "production",
		"cache target is required",
	);
	ensure(tags.length > 0, "at least one cache tag is required");
	return kind === "delete"
		? { tags, target, revalidationDeadlineSeconds: 0 }
		: { tags, target };
}

function vercelUrl(
	context: ScenarioContext,
	route: string,
	projectId: string,
): string {
	const url = new URL(
		route,
		`${normalizeBaseUrl(context.config.vercelApiUrl)}/`,
	);
	url.searchParams.set("projectIdOrName", projectId);
	if (context.config.teamId)
		url.searchParams.set("teamId", context.config.teamId);
	else if (context.config.teamSlug)
		url.searchParams.set("slug", context.config.teamSlug);
	return url.toString();
}

function edgeCacheOperation(
	context: ScenarioContext,
	kind: "invalidate" | "delete",
	projectId: string,
	tags: string[],
	target: Environment,
): Promise<RecordedResponse> {
	const route =
		kind === "invalidate"
			? "/v1/edge-cache/invalidate-by-tags"
			: "/v1/edge-cache/dangerously-delete-by-tags";
	return context.http.request({
		scenarioId: context.scenarioId,
		run: context.run,
		url: vercelUrl(context, route, projectId),
		method: "POST",
		headers: {
			authorization: `Bearer ${context.config.vercelToken as string}`,
		},
		body: edgeCacheRequestBody(kind, tags, target),
		operation: {
			name:
				kind === "invalidate" ? "edge-cache.invalidate" : "edge-cache.delete",
			target,
			project: projectId,
			tags,
		},
	});
}

function target(context: ScenarioContext): Environment {
	ensure(
		context.environment,
		"an explicit preview or production target is required",
	);
	return context.environment;
}

function assertOperationOk(response: RecordedResponse, name: string): void {
	ensure(response.ok, `${name} returned status ${response.status}`);
}

async function canonicalRest(
	context: ScenarioContext,
	tags: string[],
	operationTarget: Environment,
	coreProjectId = context.config.coreProjectId as string,
	shieldProjectId = context.config.shieldProjectId as string,
): Promise<CanonicalResult> {
	const core = await edgeCacheOperation(
		context,
		"delete",
		coreProjectId,
		tags,
		operationTarget,
	);
	if (!core.ok) {
		await context.writer.operation(
			context.scenarioId,
			context.run,
			{
				name: "canonical.abort",
				target: operationTarget,
				project: coreProjectId,
				tags,
			},
			{ coreStatus: core.status, shieldCalled: false },
		);
		return { core, shield: null, shieldCalled: false };
	}
	const shield = await edgeCacheOperation(
		context,
		"invalidate",
		shieldProjectId,
		tags,
		operationTarget,
	);
	await context.writer.operation(
		context.scenarioId,
		context.run,
		{
			name: "canonical.complete",
			target: operationTarget,
			project: shieldProjectId,
			tags,
		},
		{
			coreStatus: core.status,
			shieldStatus: shield.status,
			shieldCalled: true,
		},
	);
	return { core, shield, shieldCalled: true };
}

function assertCanonicalOk(result: CanonicalResult): void {
	assertOperationOk(result.core, "Core hard delete");
	ensure(
		result.shieldCalled && result.shield,
		"Shield invalidation was not called",
	);
	assertOperationOk(result.shield, "Shield soft invalidation");
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollResponse(
	context: ScenarioContext,
	attempt: () => Promise<RecordedResponse>,
	accept: (response: RecordedResponse) => boolean,
	description: string,
): Promise<RecordedResponse> {
	const deadline = Date.now() + context.config.pollTimeoutMs;
	while (Date.now() <= deadline) {
		const response = await attempt();
		if (accept(response)) return response;
		await sleep(context.config.pollIntervalMs);
	}
	throw new Error(`timed out waiting for ${description}`);
}

function observation(
	response: RecordedResponse,
	startedAt: number,
): RequestObservation {
	return {
		elapsedMs: Date.now() - startedAt,
		status: response.status,
		version: response.marker?.contentVersion ?? null,
		renderId: response.marker?.renderId ?? null,
		cache: response.xVercelCache,
		age: response.age,
		durationMs: response.durationMs,
	};
}

async function recordReport(
	context: ScenarioContext,
	name: string,
	body: unknown,
): Promise<void> {
	await context.writer.operation(
		context.scenarioId,
		context.run,
		{ name },
		body,
	);
}

async function withFault<T>(
	context: ScenarioContext,
	path: string,
	fault: { delayMs?: number; force500?: boolean },
	execute: () => Promise<T>,
): Promise<T> {
	let attempted = false;
	try {
		attempted = true;
		await setFault(context, path, fault);
		return await execute();
	} finally {
		if (attempted) await clearFault(context, path);
	}
}

function profileVersions(
	context: ScenarioContext,
	step: number,
): Record<Profile, number> {
	return {
		free: versionFor(context, step + 1),
		member: versionFor(context, step + 2),
		enterprise: versionFor(context, step + 3),
	};
}

async function setProfileVersions(
	context: ScenarioContext,
	path: string,
	step: number,
): Promise<Record<Profile, number>> {
	const profiles = profileVersions(context, step);
	await bump(context, path, versionFor(context, step), profiles);
	return profiles;
}

function shuffled<T>(values: T[], seed: number): T[] {
	const result = [...values];
	let state = seed >>> 0;
	for (let index = result.length - 1; index > 0; index -= 1) {
		state = (state * 1_664_525 + 1_013_904_223) >>> 0;
		const swap = state % (index + 1);
		[result[index], result[swap]] = [result[swap], result[index]];
	}
	return result;
}

function upstreamStatus(body: unknown): number | null | undefined {
	if (!body || typeof body !== "object") return undefined;
	const record = body as Record<string, unknown>;
	return typeof record.upstreamStatus === "number" ||
		record.upstreamStatus === null
		? record.upstreamStatus
		: undefined;
}

async function readStructuredFile(path: string): Promise<unknown> {
	const text = await readFile(path, "utf8");
	if (path.endsWith(".jsonl")) {
		return text
			.split("\n")
			.filter(Boolean)
			.map((line) => JSON.parse(line) as unknown);
	}
	return JSON.parse(text) as unknown;
}

interface EvidenceObservation {
	timestamp: string;
	url: string;
	cache: string | null;
	scenarioId: string;
	run: number;
	marker: Marker;
}

function evidenceObservations(value: unknown): EvidenceObservation[] {
	const values = Array.isArray(value) ? value : [value];
	const observations: EvidenceObservation[] = [];
	for (const item of values) {
		if (!item || typeof item !== "object") continue;
		const record = item as Record<string, unknown>;
		const marker = parseMarker(record.parsedMarker);
		if (
			marker &&
			typeof record.timestamp === "string" &&
			Number.isFinite(Date.parse(record.timestamp)) &&
			typeof record.url === "string" &&
			typeof record.scenarioId === "string" &&
			Number.isInteger(record.run)
		) {
			observations.push({
				timestamp: record.timestamp,
				url: record.url,
				cache:
					typeof record["x-vercel-cache"] === "string"
						? record["x-vercel-cache"]
						: null,
				scenarioId: record.scenarioId,
				run: record.run as number,
				marker,
			});
		}
	}
	return observations;
}

interface DeploymentManifest {
	outcome: "success";
	branch: string;
	target: Environment;
	startedAt: string;
	finishedAt: string;
	deployments: {
		core: { deploymentId: string; deployed: boolean; stableHost: string };
		shield: { deploymentId: string; deployed: boolean; stableHost: string };
	};
}

function deploymentManifest(value: unknown): DeploymentManifest {
	ensure(
		value && typeof value === "object",
		"deployment manifest was not an object",
	);
	const candidate = value as Partial<DeploymentManifest>;
	ensure(
		candidate.outcome === "success" &&
			typeof candidate.branch === "string" &&
			typeof candidate.startedAt === "string" &&
			typeof candidate.finishedAt === "string" &&
			Number.isFinite(Date.parse(candidate.startedAt)) &&
			Number.isFinite(Date.parse(candidate.finishedAt)) &&
			(candidate.target === "preview" || candidate.target === "production") &&
			candidate.deployments &&
			typeof candidate.deployments.core?.deploymentId === "string" &&
			typeof candidate.deployments.shield?.deploymentId === "string" &&
			typeof candidate.deployments.core?.stableHost === "string" &&
			typeof candidate.deployments.shield?.stableHost === "string" &&
			typeof candidate.deployments.core?.deployed === "boolean" &&
			typeof candidate.deployments.shield?.deployed === "boolean",
		"deployment manifest did not match the poc-deploy schema",
	);
	return candidate as DeploymentManifest;
}

async function loadB6Evidence(context: ScenarioContext): Promise<{
	preObservations: EvidenceObservation[];
	postObservations: EvidenceObservation[];
	preManifest: DeploymentManifest;
	postManifest: DeploymentManifest;
}> {
	const required = [
		["B6_PRE_EVIDENCE_PATH", context.config.b6PreEvidencePath],
		["B6_POST_EVIDENCE_PATH", context.config.b6PostEvidencePath],
		["B6_PRE_MANIFEST_PATH", context.config.b6PreManifestPath],
		["B6_POST_MANIFEST_PATH", context.config.b6PostManifestPath],
	] as const;
	const missing = required.filter(([, value]) => !value).map(([name]) => name);
	ensure(
		missing.length === 0,
		`missing checkpoint inputs: ${missing.join(", ")}`,
	);
	const preEvidence = await readStructuredFile(
		context.config.b6PreEvidencePath as string,
	);
	const postEvidence = await readStructuredFile(
		context.config.b6PostEvidencePath as string,
	);
	const preManifestValue = await readStructuredFile(
		context.config.b6PreManifestPath as string,
	);
	const postManifestValue = await readStructuredFile(
		context.config.b6PostManifestPath as string,
	);
	await recordReport(context, "checkpoint.inputs", {
		preEvidence,
		postEvidence,
		preManifest: preManifestValue,
		postManifest: postManifestValue,
	});
	const preObservations = evidenceObservations(preEvidence);
	const postObservations = evidenceObservations(postEvidence);
	ensure(
		preObservations.length > 0,
		"pre-deployment evidence contained no typed request observations",
	);
	ensure(
		postObservations.length > 0,
		"post-deployment evidence contained no typed request observations",
	);
	return {
		preObservations,
		postObservations,
		preManifest: deploymentManifest(preManifestValue),
		postManifest: deploymentManifest(postManifestValue),
	};
}

function invalidProjectId(context: ScenarioContext): string {
	return `prj_${context.invocationId
		.replace(/[^a-zA-Z0-9]/g, "")
		.padEnd(32, "0")
		.slice(0, 32)}`;
}

const definitions: ScenarioDefinition[] = [
	{
		id: "B1.1",
		title: "Shield-project REST invalidate propagated tag after warm+bump",
		requires: [
			"shieldUrl",
			"controlToken",
			"vercelToken",
			"coreProjectId",
			"shieldProjectId",
		],
		destructive: true,
		timingSensitive: true,
		proposalDisposition: "documentable",
		execute: async (context) => {
			const preflight = await control(
				context,
				"status",
				{},
				{ name: "fixture.control.status", target: target(context) },
			);
			const preflightBody =
				preflight.body && typeof preflight.body === "object"
					? (preflight.body as Record<string, unknown>)
					: {};
			ensure(
				preflightBody.environment === context.environment,
				`Core reported environment ${String(preflightBody.environment)} instead of ${String(context.environment)}`,
			);
			ensure(
				preflightBody.shieldEnvironment === context.environment,
				`Shield reported environment ${String(preflightBody.shieldEnvironment)} instead of ${String(context.environment)}`,
			);
			ensure(
				preflightBody.storage === "blob",
				`deployed fixture storage must be blob, received ${String(preflightBody.storage)}`,
			);
			const path = pathFor(context);
			const v1 = versionFor(context, 1);
			const v2 = versionFor(context, 2);
			await bump(context, path, v1);
			const warm = assertMarker(
				await shieldFixture(context, "page", path),
				path,
				"default",
			);
			ensure(warm.contentVersion === v1, "Shield did not warm version v1");
			const stable = assertMarker(
				await shieldFixture(context, "page", path),
				path,
				"default",
			);
			ensure(
				stable.renderId === warm.renderId,
				"Shield did not reuse the warm render",
			);
			const tags = safePathTags(warm, path);
			if (tags.length === 0)
				return blocked("marker had no safe path-scoped tag");
			await bump(context, path, v2);
			const corePreparation = await edgeCacheOperation(
				context,
				"delete",
				context.config.coreProjectId as string,
				tags,
				target(context),
			);
			assertOperationOk(corePreparation, "Core freshness preparation");
			const invalidation = await edgeCacheOperation(
				context,
				"invalidate",
				context.config.shieldProjectId as string,
				tags,
				target(context),
			);
			assertOperationOk(invalidation, "Shield REST invalidation");
			const first = await shieldFixture(context, "page", path);
			const firstMarker = assertMarker(first, path, "default");
			const firstCacheStatus = first.xVercelCache?.toUpperCase();
			ensure(
				firstCacheStatus === "STALE" || firstCacheStatus === "REVALIDATED",
				`Shield tag invalidation did not produce STALE or REVALIDATED; received ${first.xVercelCache ?? "no cache status"}`,
			);
			ensure(
				firstMarker.contentVersion === v1 || firstMarker.contentVersion === v2,
				"first response returned an unexpected content version",
			);
			const converged =
				firstMarker.contentVersion === v2
					? first
					: await pollResponse(
							context,
							() => shieldFixture(context, "page", path),
							(response) => response.marker?.contentVersion === v2,
							"Shield propagation to version v2",
						);
			const marker = assertMarker(converged, path, "default");
			context.shared.set(`shield-soft:${context.run}`, true);
			return pass(
				`first=${firstMarker.contentVersion}/${first.xVercelCache ?? "unreported"}; eventual=${marker.contentVersion}/${converged.xVercelCache ?? "unreported"}`,
				firstCacheStatus === "REVALIDATED"
					? "documentable-with-caveat"
					: undefined,
			);
		},
	},
	{
		id: "B1.2",
		title: "Core-project REST invalidate only while Shield is fresh",
		requires: [
			"shieldUrl",
			"coreUrl",
			"controlToken",
			"vercelToken",
			"coreProjectId",
		],
		destructive: true,
		timingSensitive: true,
		gateDependent: true,
		proposalDisposition: "documentable-with-caveat",
		execute: async (context) => {
			const path = pathFor(context);
			const v1 = versionFor(context, 1);
			const v2 = versionFor(context, 2);
			await bump(context, path, v1);
			const warm = assertMarker(
				await shieldFixture(context, "page", path),
				path,
				"default",
			);
			ensure(warm.contentVersion === v1, "Shield did not warm version v1");
			const coreWarmResponse = await coreFixture(context, "page", path);
			const coreWarm = assertMarker(coreWarmResponse, path, "default");
			const coreStableResponse = await coreFixture(context, "page", path);
			const coreStable = assertMarker(coreStableResponse, path, "default");
			ensure(
				coreWarm.contentVersion === v1 &&
					coreStable.renderId === coreWarm.renderId,
				"direct Core v1 entry was not stable before invalidation",
			);
			ensure(
				coreStableResponse.xVercelCache?.toUpperCase() === "HIT",
				`direct Core did not report HIT before invalidation; received ${coreStableResponse.xVercelCache ?? "no cache status"}`,
			);
			const tags = safePathTags(warm, path);
			if (tags.length === 0)
				return blocked("marker had no safe path-scoped tag");
			await bump(context, path, v2);
			const invalidation = await edgeCacheOperation(
				context,
				"invalidate",
				context.config.coreProjectId as string,
				tags,
				target(context),
			);
			assertOperationOk(invalidation, "Core REST invalidation");
			const directFirst = await coreFixture(context, "page", path);
			const directMarker = assertMarker(directFirst, path, "default");
			ensure(
				directFirst.xVercelCache?.toUpperCase() === "STALE",
				`Core-only invalidation did not produce immediate STALE; received ${directFirst.xVercelCache ?? "no cache status"}`,
			);
			const shieldFresh = await shieldFixture(context, "page", path);
			const shieldMarker = assertMarker(shieldFresh, path, "default");
			ensure(
				shieldMarker.contentVersion === v1 &&
					shieldMarker.renderId === warm.renderId,
				"Core-only invalidation changed the fresh Shield entry",
			);
			const directFinal =
				directMarker.contentVersion === v2
					? directFirst
					: await pollResponse(
							context,
							() => coreFixture(context, "page", path),
							(response) => response.marker?.contentVersion === v2,
							"direct Core to expose version v2",
						);
			context.shared.set(`core-soft:${context.run}`, true);
			return pass(
				`Shield stayed at v${v1}; direct Core first=${directMarker.contentVersion}/${directFirst.xVercelCache ?? "unreported"}, final=${directFinal.marker?.contentVersion}/${directFinal.xVercelCache ?? "unreported"}`,
			);
		},
	},
	{
		id: "B1.3",
		title: "Core-side Next revalidateTag and updateTag",
		requires: ["shieldUrl", "coreUrl", "controlToken"],
		destructive: true,
		timingSensitive: true,
		gateDependent: true,
		proposalDisposition: "documentable-with-caveat",
		execute: async (context) => {
			const path = pathFor(context);
			const v1 = versionFor(context, 1);
			const v2 = versionFor(context, 2);
			await bump(context, path, v1);
			const warm = assertMarker(await coreFixture(context, "page", path), path);
			const tag = exactPathTag(warm, path);
			if (!tag)
				return blocked(
					"marker omitted the exact path tag needed for revalidateTag",
				);
			await bump(context, path, v2);
			await revalidateTag(context, tag);
			const refreshed = await pollResponse(
				context,
				() => coreFixture(context, "page", path),
				(response) => response.marker?.contentVersion === v2,
				"Core revalidateTag to expose version v2",
			);
			assertMarker(refreshed, path, "default");
			context.shared.set(`next-revalidate:${context.run}`, true);
			return blocked(
				`revalidateTag advanced Core from v${v1} to v${v2}; updateTag is BLOCKED because no safe Server Action transport is exposed`,
			);
		},
	},
	{
		id: "B1.4",
		title:
			"Trace refresh mechanism via outer headers + renderId/contentVersion",
		requires: [
			"shieldUrl",
			"controlToken",
			"vercelToken",
			"coreProjectId",
			"shieldProjectId",
		],
		destructive: true,
		timingSensitive: true,
		gateDependent: true,
		proposalDisposition: "documentable-with-caveat",
		execute: async (context) => {
			const path = pathFor(context);
			const startedAt = Date.now();
			const v1 = versionFor(context, 1);
			const v2 = versionFor(context, 2);
			await bump(context, path, v1);
			const warmResponse = await shieldFixture(context, "page", path);
			const warm = assertMarker(warmResponse, path, "default");
			const tags = safePathTags(warm, path);
			if (tags.length === 0)
				return blocked("marker had no safe path-scoped tag");
			await bump(context, path, v2);
			const canonical = await canonicalRest(context, tags, target(context));
			assertCanonicalOk(canonical);
			const first = await shieldFixture(context, "page", path);
			const final = await pollResponse(
				context,
				() => shieldFixture(context, "page", path),
				(response) => response.marker?.contentVersion === v2,
				"outer Shield refresh to version v2",
			);
			const finalMarker = assertMarker(final, path, "default");
			await recordReport(context, "refresh.trace", {
				warm: observation(warmResponse, startedAt),
				first: observation(first, startedAt),
				final: observation(final, startedAt),
			});
			return pass(
				`outer trace ${warm.renderId}/v${v1} -> ${finalMarker.renderId}/v${v2}; first cache=${first.xVercelCache ?? "unreported"}; definitive inner HIT/MISS requires out-of-band Core logs`,
			);
		},
	},
	{
		id: "B1.5",
		title: "Same experiment across another team/external origin",
		requires: [],
		destructive: false,
		timingSensitive: true,
		gateDependent: true,
		proposalDisposition: "escalate-to-sign-off",
		execute: async () =>
			blocked(
				"requires a separately deployed Shield plus controllable Core on another team, separate REST team scope, and Core freshness preparation; a direct external request would not test propagation",
			),
	},
	{
		id: "B2.1",
		title: "Warm v1, bump v2, soft-invalidate Core then Shield",
		requires: [
			"shieldUrl",
			"controlToken",
			"vercelToken",
			"coreProjectId",
			"shieldProjectId",
		],
		destructive: true,
		timingSensitive: true,
		gateDependent: true,
		proposalDisposition: "documentable-with-caveat",
		execute: async (context) => {
			const path = pathFor(context);
			const v1 = versionFor(context, 1);
			const v2 = versionFor(context, 2);
			await bump(context, path, v1);
			const warm = assertMarker(
				await shieldFixture(context, "page", path),
				path,
			);
			const tags = safePathTags(warm, path);
			if (tags.length === 0) return blocked("marker had no safe path tag");
			await bump(context, path, v2);
			const core = await edgeCacheOperation(
				context,
				"invalidate",
				context.config.coreProjectId as string,
				tags,
				target(context),
			);
			assertOperationOk(core, "Core soft invalidation");
			const shield = await edgeCacheOperation(
				context,
				"invalidate",
				context.config.shieldProjectId as string,
				tags,
				target(context),
			);
			assertOperationOk(shield, "Shield soft invalidation");
			const startedAt = Date.now();
			const observations: RequestObservation[] = [];
			for (let index = 0; index < 10; index += 1) {
				const response = await shieldFixture(context, "page", path);
				const marker = assertMarker(response, path, "default");
				ensure(
					marker.contentVersion === v1 || marker.contentVersion === v2,
					"request sequence returned an unexpected version",
				);
				observations.push(observation(response, startedAt));
				if (index < 9) await sleep(context.config.b2RequestIntervalMs);
			}
			const firstNew = observations.findIndex((item) => item.version === v2);
			const oldAfterNew =
				firstNew >= 0 &&
				observations.slice(firstNew + 1).some((item) => item.version === v1);
			const firstOldStale = observations.findIndex(
				(item) => item.version === v1 && item.cache?.toUpperCase() === "STALE",
			);
			const oldHitAfterStale =
				firstOldStale >= 0 &&
				observations
					.slice(firstOldStale + 1)
					.some(
						(item) =>
							item.version === v1 && item.cache?.toUpperCase() === "HIT",
					);
			const oldContentRepinned = oldAfterNew || oldHitAfterStale;
			await recordReport(context, "repin.sequence", {
				v1,
				v2,
				observations,
				oldContentRepinned,
				oldAfterNew,
				oldHitAfterStale,
				convergenceMs: firstNew >= 0 ? observations[firstNew].elapsedMs : null,
			});
			context.shared.set(`b2-sequence:${context.run}`, true);
			if (firstNew < 0) {
				return blocked(
					"the ten-request sequence never observed v2, so re-pin behavior is inconclusive",
				);
			}
			if (!observations.some((item) => item.cache?.toUpperCase() === "STALE")) {
				return blocked(
					"the sequence did not observe an outer STALE transition, so invalidation was not established",
				);
			}
			return pass(
				`old-content re-pin ${oldContentRepinned ? "reproduced" : "not reproduced"}; convergence=${firstNew >= 0 ? `${observations[firstNew].elapsedMs}ms` : "not observed in 10 requests"}`,
			);
		},
	},
	{
		id: "B2.2",
		title: "Warm v1, bump v2, Core hard delete then Shield soft invalidate",
		requires: [
			"shieldUrl",
			"controlToken",
			"vercelToken",
			"coreProjectId",
			"shieldProjectId",
		],
		destructive: true,
		timingSensitive: true,
		gateDependent: true,
		proposalDisposition: "documentable",
		execute: async (context) => {
			const path = pathFor(context);
			const v1 = versionFor(context, 1);
			const v2 = versionFor(context, 2);
			await bump(context, path, v1);
			const warm = assertMarker(
				await shieldFixture(context, "page", path),
				path,
			);
			const tags = safePathTags(warm, path);
			if (tags.length === 0) return blocked("marker had no safe path tag");
			await bump(context, path, v2);
			const canonical = await canonicalRest(context, tags, target(context));
			assertCanonicalOk(canonical);
			const startedAt = Date.now();
			const observations: RequestObservation[] = [];
			let seenNew = false;
			let postNew = 0;
			while (Date.now() - startedAt <= context.config.pollTimeoutMs) {
				const response = await shieldFixture(context, "page", path);
				const marker = assertMarker(response, path, "default");
				ensure(
					marker.contentVersion === v1 || marker.contentVersion === v2,
					"request sequence returned an unexpected version",
				);
				observations.push(observation(response, startedAt));
				if (marker.contentVersion === v2) {
					seenNew = true;
					postNew += 1;
				} else if (seenNew) {
					throw new Error(
						"version v1 reappeared after version v2 was observed",
					);
				}
				if (seenNew && postNew >= 5) break;
				await sleep(context.config.pollIntervalMs);
			}
			ensure(seenNew, "version v2 did not appear before the poll deadline");
			await recordReport(context, "hard-soft.sequence", {
				v1,
				v2,
				observations,
			});
			context.shared.set(`core-hard:${context.run}`, true);
			context.shared.set(`shield-soft:${context.run}`, true);
			return pass(
				`v2 converged in ${observations.find((item) => item.version === v2)?.elapsedMs}ms and remained stable for ${postNew} observations`,
			);
		},
	},
	{
		id: "B2.3",
		title:
			"Shield soft invalidate first, request in a configurable gap, then Core hard delete",
		requires: [
			"shieldUrl",
			"controlToken",
			"vercelToken",
			"coreProjectId",
			"shieldProjectId",
		],
		destructive: true,
		timingSensitive: true,
		gateDependent: true,
		proposalDisposition: "documentable-with-caveat",
		execute: async (context) => {
			const path = pathFor(context);
			const v1 = versionFor(context, 1);
			const v2 = versionFor(context, 2);
			await bump(context, path, v1);
			const warm = assertMarker(
				await shieldFixture(context, "page", path),
				path,
			);
			const tags = safePathTags(warm, path);
			if (tags.length === 0) return blocked("marker had no safe path tag");
			await bump(context, path, v2);
			const startedAt = Date.now();
			const shield = await edgeCacheOperation(
				context,
				"invalidate",
				context.config.shieldProjectId as string,
				tags,
				target(context),
			);
			assertOperationOk(shield, "Shield soft invalidation");
			await sleep(context.config.invalidationGapMs);
			const gapResponse = await shieldFixture(context, "page", path);
			const gapMarker = assertMarker(gapResponse, path, "default");
			const core = await edgeCacheOperation(
				context,
				"delete",
				context.config.coreProjectId as string,
				tags,
				target(context),
			);
			assertOperationOk(core, "Core hard delete");
			const final = await pollResponse(
				context,
				() => shieldFixture(context, "page", path),
				(response) => response.marker?.contentVersion === v2,
				"version v2 after the stale-read window",
			);
			const windowMs = Date.now() - startedAt;
			await recordReport(context, "stale-window", {
				configuredGapMs: context.config.invalidationGapMs,
				gapResponse: observation(gapResponse, startedAt),
				finalResponse: observation(final, startedAt),
				windowMs,
			});
			context.shared.set(`core-hard:${context.run}`, true);
			context.shared.set(`shield-soft:${context.run}`, true);
			return pass(
				`gap read v${gapMarker.contentVersion}/${gapResponse.xVercelCache ?? "unreported"}; v2 convergence window=${windowMs}ms`,
			);
		},
	},
	{
		id: "B2.4",
		title:
			"API semantics table from known operation types and fixture-observed cells",
		requires: [],
		destructive: false,
		gateDependent: true,
		proposalDisposition: "documentable",
		execute: async (context) => {
			const table = [
				{
					operation: "Core REST invalidate",
					knownSemantics: "mark matching Core entries stale",
					fixtureObserved: context.shared.has(`core-soft:${context.run}`),
				},
				{
					operation: "Core REST hard delete",
					knownSemantics: "delete matching Core entries with deadline 0",
					fixtureObserved: context.shared.has(`core-hard:${context.run}`),
				},
				{
					operation: "Shield REST invalidate",
					knownSemantics: "mark matching outer Shield entries stale",
					fixtureObserved: context.shared.has(`shield-soft:${context.run}`),
				},
				{
					operation: "Next revalidateTag(tag, max)",
					knownSemantics: "mark matching Core data stale",
					fixtureObserved: context.shared.has(`next-revalidate:${context.run}`),
				},
				{
					operation: "Next updateTag",
					knownSemantics: "expire matching data immediately",
					fixtureObserved: false,
				},
			];
			await recordReport(context, "api-semantics.table", table);
			const observed = table.filter((row) => row.fixtureObserved).length;
			if (observed === 0) {
				return blocked(
					"known API semantics table was emitted, but no B1/B2 fixture-observed cells exist in this invocation",
				);
			}
			return pass(
				`${observed}/${table.length} table cells were fixture-observed`,
			);
		},
	},
	{
		id: "B3.1",
		title:
			"3 profiles x 5 pages x 20 randomized/interleaved requests, zero cross-serves",
		requires: ["shieldUrl", "controlToken"],
		destructive: true,
		proposalDisposition: "documentable",
		execute: async (context) => {
			const pages = Array.from({ length: 5 }, (_, index) =>
				pathFor(context, `-page${index + 1}`),
			);
			const expected = new Map<string, Record<Profile, number>>();
			for (const [index, path] of pages.entries()) {
				expected.set(
					path,
					await setProfileVersions(context, path, 10 + index * 10),
				);
			}
			const requests = pages.flatMap((path) =>
				PROFILES.flatMap((profile) =>
					Array.from({ length: 20 }, () => ({ path, profile })),
				),
			);
			const interleaved = shuffled(requests, versionFor(context, 90));
			let crossServes = 0;
			for (const request of interleaved) {
				const marker = assertMarker(
					await shieldFixture(
						context,
						"profile",
						request.path,
						request.profile,
					),
					request.path,
					request.profile,
				);
				if (
					marker.contentVersion !==
					expected.get(request.path)?.[request.profile]
				) {
					crossServes += 1;
				}
			}
			ensure(
				crossServes === 0,
				`${crossServes} profile responses cross-served`,
			);
			return pass(
				"300 randomized/interleaved requests completed with zero cross-serves",
			);
		},
	},
	{
		id: "B3.2",
		title: "Repeat HIT behavior per profile",
		requires: ["shieldUrl", "controlToken"],
		destructive: true,
		proposalDisposition: "documentable",
		execute: async (context) => {
			const path = pathFor(context);
			const versions = await setProfileVersions(context, path, 10);
			for (const profile of PROFILES) {
				const warm = assertMarker(
					await shieldFixture(context, "profile", path, profile),
					path,
					profile,
				);
				const repeatResponse = await pollResponse(
					context,
					() => shieldFixture(context, "profile", path, profile),
					(response) => response.xVercelCache?.toUpperCase() === "HIT",
					`${profile} outer HIT`,
				);
				const repeat = assertMarker(repeatResponse, path, profile);
				ensure(
					repeat.contentVersion === versions[profile],
					`${profile} version changed`,
				);
				ensure(
					repeat.renderId === warm.renderId,
					`${profile} HIT used a new render`,
				);
			}
			return pass("free, member, and enterprise each repeated as outer HITs");
		},
	},
	{
		id: "B3.3",
		title:
			"Cookie profile switch A -> B -> A gives separate variants and reuses old A",
		requires: ["shieldUrl", "controlToken"],
		destructive: true,
		proposalDisposition: "documentable",
		execute: async (context) => {
			const path = pathFor(context);
			const versions = await setProfileVersions(context, path, 10);
			const firstAResponse = await shieldFixture(
				context,
				"profile",
				path,
				"free",
			);
			const firstA = assertMarker(firstAResponse, path, "free");
			const memberResponse = await shieldFixture(
				context,
				"profile",
				path,
				"member",
			);
			const markerB = assertMarker(memberResponse, path, "member");
			const secondAResponse = await shieldFixture(
				context,
				"profile",
				path,
				"free",
			);
			const secondA = assertMarker(secondAResponse, path, "free");
			ensure(firstA.contentVersion === versions.free, "free version was wrong");
			ensure(
				markerB.contentVersion === versions.member,
				"member version was wrong",
			);
			ensure(
				firstA.renderId === secondA.renderId,
				"old free render was not reused",
			);
			ensure(
				secondAResponse.xVercelCache?.toUpperCase() === "HIT",
				`switching back to free did not produce an outer HIT; received ${secondAResponse.xVercelCache ?? "no cache status"}`,
			);
			ensure(
				firstA.renderId !== markerB.renderId,
				"free and member shared a render",
			);
			return pass(`free render ${firstA.renderId} was reused after member`);
		},
	},
	{
		id: "B3.4",
		title:
			"Enterprise profile-specific tag invalidation changes enterprise only",
		requires: [
			"shieldUrl",
			"controlToken",
			"vercelToken",
			"coreProjectId",
			"shieldProjectId",
		],
		destructive: true,
		proposalDisposition: "documentable",
		execute: async (context) => {
			const path = pathFor(context);
			const versions = await setProfileVersions(context, path, 10);
			const freeBefore = assertMarker(
				await shieldFixture(context, "profile", path, "free"),
				path,
				"free",
			);
			const enterpriseBefore = assertMarker(
				await shieldFixture(context, "profile", path, "enterprise"),
				path,
				"enterprise",
			);
			const enterpriseTag = exactProfileTag(
				enterpriseBefore,
				path,
				"enterprise",
			);
			if (!enterpriseTag)
				return blocked("enterprise marker omitted its profile tag");
			const enterpriseNext = versionFor(context, 33);
			await bump(context, path, versionFor(context, 30), {
				enterprise: enterpriseNext,
			});
			const canonical = await canonicalRest(
				context,
				[enterpriseTag],
				target(context),
			);
			assertCanonicalOk(canonical);
			const freeImmediateResponse = await shieldFixture(
				context,
				"profile",
				path,
				"free",
			);
			const freeImmediate = assertMarker(freeImmediateResponse, path, "free");
			ensure(
				freeImmediateResponse.xVercelCache?.toUpperCase() === "HIT" &&
					freeImmediate.renderId === freeBefore.renderId,
				"enterprise tag invalidation touched the free outer variant",
			);
			const enterpriseFirst = await shieldFixture(
				context,
				"profile",
				path,
				"enterprise",
			);
			assertMarker(enterpriseFirst, path, "enterprise");
			ensure(
				enterpriseFirst.xVercelCache?.toUpperCase() === "STALE",
				`enterprise invalidation did not produce an immediate outer STALE response; received ${enterpriseFirst.xVercelCache ?? "no cache status"}`,
			);
			const enterpriseAfter = assertMarker(
				await pollResponse(
					context,
					() => shieldFixture(context, "profile", path, "enterprise"),
					(response) => response.marker?.contentVersion === enterpriseNext,
					"enterprise profile update",
				),
				path,
				"enterprise",
			);
			const freeAfter = assertMarker(
				await shieldFixture(context, "profile", path, "free"),
				path,
				"free",
			);
			ensure(
				freeAfter.contentVersion === versions.free,
				"free version changed",
			);
			ensure(freeAfter.renderId === freeBefore.renderId, "free render changed");
			ensure(
				enterpriseAfter.renderId !== enterpriseBefore.renderId,
				"enterprise render did not change",
			);
			return pass(
				"enterprise changed while free retained its version and render ID",
			);
		},
	},
	{
		id: "B3.5",
		title:
			"Exactly profiles x pages distinct cached render IDs after every combination",
		requires: ["shieldUrl", "controlToken"],
		destructive: true,
		proposalDisposition: "architecture-change",
		execute: async (context) => {
			const pages = Array.from({ length: 5 }, (_, index) =>
				pathFor(context, `-page${index + 1}`),
			);
			for (const [index, path] of pages.entries()) {
				await setProfileVersions(context, path, 10 + index * 10);
			}
			const first = new Map<string, string>();
			for (const path of pages) {
				for (const profile of PROFILES) {
					const response = await shieldFixture(
						context,
						"profile",
						path,
						profile,
					);
					const marker = assertMarker(response, path, profile);
					ensure(
						response.vary?.toLowerCase().includes("x-content-profile"),
						`${profile}/${path} omitted Vary: x-content-profile`,
					);
					first.set(`${path}:${profile}`, marker.renderId);
				}
			}
			ensure(
				new Set(first.values()).size === 15,
				"first pass did not create 15 renders",
			);
			for (const path of pages) {
				for (const profile of PROFILES) {
					const response = await shieldFixture(
						context,
						"profile",
						path,
						profile,
					);
					const marker = assertMarker(response, path, profile);
					ensure(
						response.xVercelCache?.toUpperCase() === "HIT",
						`${profile}/${path} did not produce an outer HIT on the second pass`,
					);
					ensure(
						marker.renderId === first.get(`${path}:${profile}`),
						`${profile}/${path} did not reuse its cached render`,
					);
				}
			}
			return pass(
				"exactly 15 cached render IDs remained; fixture uses CDN route-derived profile normalization because middleware-derived normalization is incompatible with CDN-only Shield",
			);
		},
	},
	{
		id: "B4.1",
		title:
			"Canonical orchestrator aborts Shield invalidation when Core REST deletion fails",
		requires: ["vercelToken"],
		destructive: true,
		timingSensitive: true,
		proposalDisposition: "escalate-to-sign-off",
		execute: async (context) => {
			const tags = [`poc:path:${pathFor(context)}`];
			const core = await edgeCacheOperation(
				context,
				"delete",
				invalidProjectId(context),
				tags,
				target(context),
			);
			if (core.ok) {
				return blocked(
					"safely invalid Core project unexpectedly succeeded; Shield was not called",
				);
			}
			if (core.status !== 403 && core.status !== 404) {
				return blocked(
					`Core failure status ${core.status} did not establish project access failure; Shield was not called`,
				);
			}
			await recordReport(context, "canonical.abort", {
				coreStatus: core.status,
				shieldCalled: false,
				shieldProjectIdSupplied: false,
			});
			return pass(
				`Core returned ${core.status}; no Shield project ID was supplied or called`,
			);
		},
	},
	{
		id: "B4.2",
		title:
			"Warm origin force500 during Shield SWR refresh, stale last-good, and recovery",
		requires: [
			"shieldUrl",
			"controlToken",
			"vercelToken",
			"coreProjectId",
			"shieldProjectId",
		],
		destructive: true,
		timingSensitive: true,
		proposalDisposition: "escalate-to-sign-off",
		execute: async (context) => {
			const path = pathFor(context);
			const v1 = versionFor(context, 1);
			const v2 = versionFor(context, 2);
			await bump(context, path, v1);
			const warm = assertMarker(
				await shieldFixture(context, "page", path),
				path,
			);
			const tags = safePathTags(warm, path);
			if (tags.length === 0) return blocked("marker had no safe path tag");
			await bump(context, path, v2);
			const coreDelete = await edgeCacheOperation(
				context,
				"delete",
				context.config.coreProjectId as string,
				tags,
				target(context),
			);
			assertOperationOk(coreDelete, "Core hard delete");
			let stale: RecordedResponse;
			await setFault(context, path, { force500: true });
			try {
				const shieldInvalidate = await edgeCacheOperation(
					context,
					"invalidate",
					context.config.shieldProjectId as string,
					tags,
					target(context),
				);
				assertOperationOk(shieldInvalidate, "Shield soft invalidation");
				stale = await pollResponse(
					context,
					() => shieldFixture(context, "page", path),
					(response) =>
						response.status === 200 &&
						response.marker?.renderId === warm.renderId &&
						response.xVercelCache?.toUpperCase() === "STALE",
					"last-good stale response during Core 500",
				);
			} finally {
				await clearFault(context, path);
			}
			const recovery = await canonicalRest(context, tags, target(context));
			assertCanonicalOk(recovery);
			const recovered = await pollResponse(
				context,
				() => shieldFixture(context, "page", path),
				(response) => response.marker?.contentVersion === v2,
				"recovery to version v2",
			);
			return pass(
				`last-good ${stale.marker?.renderId}/v${v1} survived; recovered as ${recovered.marker?.renderId}/v${v2}`,
			);
		},
	},
	{
		id: "B4.3",
		title: "Hard-delete Shield while origin force500",
		requires: [
			"shieldUrl",
			"controlToken",
			"vercelToken",
			"coreProjectId",
			"shieldProjectId",
		],
		destructive: true,
		timingSensitive: true,
		proposalDisposition: "escalate-to-sign-off",
		execute: async (context) => {
			const path = pathFor(context);
			await bump(context, path, versionFor(context, 1));
			const warm = assertMarker(
				await shieldFixture(context, "page", path),
				path,
			);
			const tags = safePathTags(warm, path);
			if (tags.length === 0) return blocked("marker had no safe path tag");
			const coreDelete = await edgeCacheOperation(
				context,
				"delete",
				context.config.coreProjectId as string,
				tags,
				target(context),
			);
			assertOperationOk(coreDelete, "Core hard delete");
			return withFault(context, path, { force500: true }, async () => {
				const shieldDelete = await edgeCacheOperation(
					context,
					"delete",
					context.config.shieldProjectId as string,
					tags,
					target(context),
				);
				assertOperationOk(shieldDelete, "Shield hard delete");
				const startedAt = Date.now();
				const result = await shieldFixture(context, "page", path);
				await recordReport(context, "hard-delete.failure-result", {
					...observation(result, startedAt),
					bodyRecordedInRequestEvent: true,
				});
				return pass(
					`user result status=${result.status}, latency=${result.durationMs}ms, cache=${result.xVercelCache ?? "unreported"}, marker=${result.marker?.renderId ?? "none"}`,
				);
			});
		},
	},
	{
		id: "B4.4",
		title: "Four paths, bump all, force page3 failure, canonical operations",
		requires: [
			"shieldUrl",
			"controlToken",
			"vercelToken",
			"coreProjectId",
			"shieldProjectId",
		],
		destructive: true,
		timingSensitive: true,
		proposalDisposition: "escalate-to-sign-off",
		execute: async (context) => {
			const paths = Array.from({ length: 4 }, (_, index) =>
				pathFor(context, `-page${index + 1}`),
			);
			const warm = new Map<string, Marker>();
			for (const [index, path] of paths.entries()) {
				await bump(context, path, versionFor(context, 1 + index * 10));
				warm.set(
					path,
					assertMarker(await shieldFixture(context, "page", path), path),
				);
				await bump(context, path, versionFor(context, 2 + index * 10));
			}
			const failedPath = paths[2];
			await setFault(context, failedPath, { force500: true });
			const refreshed: Marker[] = [];
			let failedMarker: Marker | undefined;
			try {
				for (const [index, path] of paths.entries()) {
					const marker = warm.get(path) as Marker;
					const tags = safePathTags(marker, path);
					ensure(tags.length > 0, `${path} had no safe path tag`);
					const canonical = await canonicalRest(context, tags, target(context));
					assertCanonicalOk(canonical);
					if (index === 2) {
						const stale = await pollResponse(
							context,
							() => shieldFixture(context, "page", path),
							(response) =>
								response.status === 200 &&
								response.marker?.renderId === marker.renderId &&
								response.xVercelCache?.toUpperCase() === "STALE",
							"page3 last-good response",
						);
						failedMarker = assertMarker(stale, path);
					} else {
						const nextVersion = versionFor(context, 2 + index * 10);
						const response = await pollResponse(
							context,
							() => shieldFixture(context, "page", path),
							(item) => item.marker?.contentVersion === nextVersion,
							`${path} version flip`,
						);
						refreshed.push(assertMarker(response, path));
					}
				}
			} finally {
				await clearFault(context, failedPath);
			}
			ensure(failedMarker, "page3 did not return its last-good marker");
			ensure(
				failedMarker.renderId === warm.get(failedPath)?.renderId,
				"page3 did not retain its last-good render",
			);
			const timestamps = refreshed.map((marker) =>
				Date.parse(marker.renderedAt),
			);
			const spreadMs = Math.max(...timestamps) - Math.min(...timestamps);
			return pass(
				`pages 1,2,4 flipped; page3 retained ${failedMarker.renderId}; successful render timestamp spread=${spreadMs}ms`,
			);
		},
	},
	{
		id: "B4.5",
		title: "25 concurrent requests after hard delete versus soft invalidate",
		requires: [
			"shieldUrl",
			"controlToken",
			"vercelToken",
			"coreProjectId",
			"shieldProjectId",
		],
		destructive: true,
		timingSensitive: true,
		proposalDisposition: "escalate-to-sign-off",
		execute: async (context) => {
			const hardPath = pathFor(context, "-hard");
			const softPath = pathFor(context, "-soft");
			const setup = async (path: string, first: number, second: number) => {
				await bump(context, path, first);
				const warm = assertMarker(
					await shieldFixture(context, "page", path),
					path,
				);
				await bump(context, path, second);
				const tags = safePathTags(warm, path);
				ensure(tags.length > 0, `${path} had no safe path tag`);
				return tags;
			};
			const hardTags = await setup(
				hardPath,
				versionFor(context, 1),
				versionFor(context, 2),
			);
			const softTags = await setup(
				softPath,
				versionFor(context, 11),
				versionFor(context, 12),
			);
			await setFault(context, hardPath, {
				delayMs: context.config.faultDelayMs,
			});
			try {
				await setFault(context, softPath, {
					delayMs: context.config.faultDelayMs,
				});
			} catch (error) {
				await clearFault(context, hardPath);
				throw error;
			}
			try {
				for (const project of [
					context.config.coreProjectId as string,
					context.config.shieldProjectId as string,
				]) {
					const response = await edgeCacheOperation(
						context,
						"delete",
						project,
						hardTags,
						target(context),
					);
					assertOperationOk(response, `${project} hard delete`);
				}
				for (const project of [
					context.config.coreProjectId as string,
					context.config.shieldProjectId as string,
				]) {
					const response = await edgeCacheOperation(
						context,
						"invalidate",
						project,
						softTags,
						target(context),
					);
					assertOperationOk(response, `${project} soft invalidation`);
				}
				const concurrent = (path: string) =>
					Promise.all(
						Array.from({ length: 25 }, () =>
							shieldFixture(context, "page", path),
						),
					);
				const hardResponses = await concurrent(hardPath);
				const softResponses = await concurrent(softPath);
				const summarize = (responses: RecordedResponse[], path: string) => {
					const markers = responses.map((response) =>
						assertMarker(response, path),
					);
					return {
						requestCount: responses.length,
						renderIdCardinality: new Set(
							markers.map((marker) => marker.renderId),
						).size,
						versions: [
							...new Set(markers.map((marker) => marker.contentVersion)),
						],
						statuses: [
							...new Set(responses.map((response) => response.status)),
						],
						latenciesMs: responses.map((response) => response.durationMs),
					};
				};
				const hard = summarize(hardResponses, hardPath);
				const soft = summarize(softResponses, softPath);
				await recordReport(context, "concurrency.cardinality", { hard, soft });
				return pass(
					`hard-delete render cardinality=${hard.renderIdCardinality}; soft-invalidate cardinality=${soft.renderIdCardinality}; no near-1 guarantee enforced`,
				);
			} finally {
				await Promise.all([
					clearFault(context, hardPath),
					clearFault(context, softPath),
				]);
			}
		},
	},
	{
		id: "B5.1",
		title:
			"Direct Core URL without credentials is blocked by Deployment Protection",
		requires: ["coreUrl"],
		destructive: false,
		proposalDisposition: "escalate-to-sign-off",
		execute: async (context) => {
			const path = pathFor(context);
			const response = await fixtureRequest(context, {
				baseUrl: context.config.coreUrl as string,
				role: "core-no-credentials",
				kind: "page",
				path,
				useBypass: false,
				redirect: "manual",
			});
			ensure(
				response.status === 401 || response.status === 403,
				`direct Core was not blocked with 401/403; received ${response.status}`,
			);
			return pass(
				`direct Core returned Deployment Protection status ${response.status}`,
			);
		},
	},
	{
		id: "B5.2",
		title: "Unauthenticated control and mutation routes return 401/403",
		requires: ["shieldUrl", "coreUrl"],
		destructive: true,
		proposalDisposition: "escalate-to-sign-off",
		execute: async (context) => {
			const path = pathFor(context);
			const tag = `poc:path:${path}`;
			const probes = [
				["bump", { path, contentVersion: versionFor(context, 1) }],
				["fault", { path, force500: true }],
				["revalidate", { tag, mode: "revalidate" }],
				[
					"oidc-rest",
					{
						projectId: context.config.shieldProjectId ?? "prj_not_configured",
						tags: [tag],
						target: target(context),
					},
				],
			] as const;
			for (const [route, body] of probes) {
				const response = await context.http.request({
					scenarioId: context.scenarioId,
					run: context.run,
					url: endpoint(
						context.config.shieldUrl as string,
						`/__poc/control/${route}`,
					),
					method: "POST",
					headers: bypassHeaders(context.config.shieldBypassToken),
					body,
					operation: { name: `unauth.control.${route}`, path },
				});
				ensure(
					response.status === 401 || response.status === 403,
					`${route} returned ${response.status}, expected 401/403`,
				);
				ensure(
					response.cacheControl?.includes("no-store"),
					`${route} unauthorized response was cacheable`,
				);
			}
			const shieldMutation = await context.http.request({
				scenarioId: context.scenarioId,
				run: context.run,
				url: endpoint(
					context.config.shieldUrl as string,
					"/api/shield/invalidate",
				),
				method: "POST",
				headers: bypassHeaders(context.config.shieldBypassToken),
				body: { tag },
				operation: { name: "unauth.shield.invalidate", tags: [tag] },
			});
			ensure(
				shieldMutation.status === 401 || shieldMutation.status === 403,
				`Shield mutation returned ${shieldMutation.status}`,
			);
			ensure(
				shieldMutation.cacheControl?.includes("no-store"),
				"Shield mutation unauthorized response was cacheable or intercepted",
			);
			const directCore = await context.http.request({
				scenarioId: context.scenarioId,
				run: context.run,
				url: endpoint(context.config.coreUrl as string, "/api/delete"),
				method: "POST",
				body: { tag },
				redirect: "manual",
				operation: { name: "unauth.core.delete.direct", tags: [tag] },
			});
			let coreAppStatus: number | null = null;
			const directBody =
				directCore.body && typeof directCore.body === "object"
					? (directCore.body as Record<string, unknown>)
					: undefined;
			const appUnauthorized =
				directBody?.error === "Unauthorized" &&
				directCore.cacheControl?.includes("no-store");
			const protectionIntercepted =
				!appUnauthorized &&
				[301, 302, 303, 307, 308, 401, 403].includes(directCore.status);
			if (context.config.coreBypassToken) {
				const appProbe = await context.http.request({
					scenarioId: context.scenarioId,
					run: context.run,
					url: endpoint(context.config.coreUrl as string, "/api/delete"),
					method: "POST",
					headers: bypassHeaders(context.config.coreBypassToken),
					body: { tag },
					operation: {
						name: "unauth.core.delete.with-protection-bypass",
						tags: [tag],
					},
				});
				coreAppStatus = appProbe.status;
				ensure(
					appProbe.status === 401 || appProbe.status === 403,
					`Core app route returned ${appProbe.status} after protection bypass`,
				);
			} else if (appUnauthorized) {
				coreAppStatus = directCore.status;
				ensure(
					directCore.status === 401 || directCore.status === 403,
					`Core mutation returned ${directCore.status}`,
				);
			}
			await recordReport(context, "unauth.matrix", {
				shieldControls: probes.map(([route]) => route),
				shieldMutationStatus: shieldMutation.status,
				directCoreStatus: directCore.status,
				protectionIntercepted,
				coreAppStatus,
			});
			return pass(
				`Shield controls and mutation rejected; direct Core=${directCore.status}${protectionIntercepted ? " (Deployment Protection intercept)" : ""}; Core app auth=${coreAppStatus ?? "not observed without bypass"}`,
				coreAppStatus === null
					? "documentable-with-caveat"
					: "escalate-to-sign-off",
			);
		},
	},
	{
		id: "B5.3",
		title:
			"Auth matrix for shared secret, protection bypass, and OIDC trusted sources",
		requires: ["shieldUrl", "coreUrl", "controlToken"],
		destructive: false,
		proposalDisposition: "escalate-to-sign-off",
		execute: async (context) => {
			const status = await control(
				context,
				"status",
				{},
				{ name: "auth.shared-control-secret" },
			);
			let bypassResult = "not configured";
			if (context.config.coreBypassToken) {
				const path = pathFor(context);
				const response = await coreFixture(context, "page", path);
				assertMarker(response, path, "default");
				bypassResult = `status ${response.status}`;
			}
			return blocked(
				`shared control secret status=${status.status}; Core protection bypass=${bypassResult}; OIDC trusted-source dashboard policy requires manual/dashboard proof`,
			);
		},
	},
	{
		id: "B5.4",
		title: "OIDC token as Vercel REST auth",
		requires: ["shieldUrl", "controlToken", "shieldProjectId"],
		destructive: true,
		proposalDisposition: "escalate-to-sign-off",
		execute: async (context) => {
			const path = pathFor(context);
			const tags = [`poc:path:${path}`];
			const response = await control(
				context,
				"oidc-rest",
				{
					projectId: context.config.shieldProjectId,
					tags,
					target: target(context),
				},
				{
					name: "fixture.control.oidc-rest",
					project: context.config.shieldProjectId,
					tags,
					target: target(context),
				},
				false,
			);
			const status = upstreamStatus(response.body);
			ensure(
				status !== undefined && status !== null,
				"OIDC probe did not reach Vercel REST",
			);
			return pass(
				`OIDC REST upstream status=${status}; exact upstream body is recorded in the request event`,
			);
		},
	},
	{
		id: "B5.5",
		title: "REST-only canonical B2.2 sequence",
		requires: [
			"shieldUrl",
			"controlToken",
			"vercelToken",
			"coreProjectId",
			"shieldProjectId",
		],
		destructive: true,
		timingSensitive: true,
		proposalDisposition: "documentable",
		execute: async (context) => {
			const path = pathFor(context);
			const v1 = versionFor(context, 1);
			const v2 = versionFor(context, 2);
			await bump(context, path, v1);
			const warm = assertMarker(
				await shieldFixture(context, "page", path),
				path,
			);
			const tags = safePathTags(warm, path);
			if (tags.length === 0) return blocked("marker had no safe path tag");
			await bump(context, path, v2);
			const canonical = await canonicalRest(context, tags, target(context));
			assertCanonicalOk(canonical);
			const first = await shieldFixture(context, "page", path);
			assertMarker(first, path);
			ensure(
				first.xVercelCache?.toUpperCase() === "STALE",
				`REST-only Shield invalidation did not produce an immediate STALE response; received ${first.xVercelCache ?? "no cache status"}`,
			);
			const final = await pollResponse(
				context,
				() => shieldFixture(context, "page", path),
				(response) => response.marker?.contentVersion === v2,
				"REST-only version v2 flip",
			);
			assertMarker(final, path);
			await recordReport(context, "rest-only.proof", {
				operations: [
					"POST /v1/edge-cache/dangerously-delete-by-tags",
					"POST /v1/edge-cache/invalidate-by-tags",
				],
				bespokeRoutesCalled: [],
			});
			return pass(
				`REST-only sequence flipped v${v1} to v${v2}; JSONL contains no /api/delete or /api/shield/invalidate request`,
			);
		},
	},
	{
		id: "B5.6",
		title: "Preview versus production isolation",
		requires: [
			"previewShieldUrl",
			"previewCoreUrl",
			"productionShieldUrl",
			"productionCoreUrl",
			"controlToken",
			"vercelToken",
			"coreProjectId",
			"shieldProjectId",
		],
		destructive: true,
		timingSensitive: true,
		proposalDisposition: "escalate-to-sign-off",
		execute: async (context) => {
			const path = pathFor(context);
			const previewStatus = await controlAt(
				context,
				context.config.previewShieldUrl as string,
				context.config.shieldBypassToken,
				"status",
				{},
				{ name: "fixture.control.status", target: "preview" },
			);
			const productionStatus = await controlAt(
				context,
				context.config.productionShieldUrl as string,
				context.config.shieldBypassToken,
				"status",
				{},
				{ name: "fixture.control.status", target: "production" },
			);
			const previewEnvironment =
				previewStatus.body && typeof previewStatus.body === "object"
					? (previewStatus.body as Record<string, unknown>).environment
					: undefined;
			const productionEnvironment =
				productionStatus.body && typeof productionStatus.body === "object"
					? (productionStatus.body as Record<string, unknown>).environment
					: undefined;
			ensure(
				previewEnvironment === "preview",
				`PREVIEW_SHIELD_URL reported environment ${String(previewEnvironment)}`,
			);
			ensure(
				productionEnvironment === "production",
				`PRODUCTION_SHIELD_URL reported environment ${String(productionEnvironment)}`,
			);
			ensure(
				(previewStatus.body as Record<string, unknown>).shieldEnvironment ===
					"preview" &&
					(previewStatus.body as Record<string, unknown>).storage === "blob",
				"Preview Shield/Core status did not prove preview Blob-backed pairing",
			);
			ensure(
				(productionStatus.body as Record<string, unknown>).shieldEnvironment ===
					"production" &&
					(productionStatus.body as Record<string, unknown>).storage === "blob",
				"Production Shield/Core status did not prove production Blob-backed pairing",
			);
			const previewV1 = versionFor(context, 1);
			const previewV2 = versionFor(context, 2);
			const productionV1 = versionFor(context, 11);
			const productionV2 = versionFor(context, 12);
			await bumpAt(
				context,
				context.config.previewShieldUrl as string,
				context.config.shieldBypassToken,
				path,
				previewV1,
				undefined,
				"preview",
			);
			await bumpAt(
				context,
				context.config.productionShieldUrl as string,
				context.config.shieldBypassToken,
				path,
				productionV1,
				undefined,
				"production",
			);
			const requestEnvironment = (
				baseUrl: string,
				role: string,
				bypassToken?: string,
			) =>
				fixtureRequest(context, {
					baseUrl,
					role,
					kind: "page",
					path,
					bypassToken,
				});
			const previewWarm = assertMarker(
				await requestEnvironment(
					context.config.previewShieldUrl as string,
					"preview-shield",
					context.config.shieldBypassToken,
				),
				path,
			);
			const productionWarm = assertMarker(
				await requestEnvironment(
					context.config.productionShieldUrl as string,
					"production-shield",
					context.config.shieldBypassToken,
				),
				path,
			);
			const tags = safePathTags(previewWarm, path);
			if (tags.length === 0)
				return blocked("preview marker had no safe path tag");
			await bumpAt(
				context,
				context.config.previewShieldUrl as string,
				context.config.shieldBypassToken,
				path,
				previewV2,
				undefined,
				"preview",
			);
			assertCanonicalOk(await canonicalRest(context, tags, "preview"));
			const previewFirst = await requestEnvironment(
				context.config.previewShieldUrl as string,
				"preview-shield",
				context.config.shieldBypassToken,
			);
			assertMarker(previewFirst, path);
			ensure(
				previewFirst.xVercelCache?.toUpperCase() === "STALE",
				`Preview invalidation did not produce immediate STALE; received ${previewFirst.xVercelCache ?? "no cache status"}`,
			);
			const previewConvergedResponse = await pollResponse(
				context,
				() =>
					requestEnvironment(
						context.config.previewShieldUrl as string,
						"preview-shield",
						context.config.shieldBypassToken,
					),
				(response) => response.marker?.contentVersion === previewV2,
				"preview version v2",
			);
			const previewConverged = assertMarker(previewConvergedResponse, path);
			const productionUntouched = assertMarker(
				await requestEnvironment(
					context.config.productionShieldUrl as string,
					"production-shield",
					context.config.shieldBypassToken,
				),
				path,
			);
			ensure(
				productionUntouched.contentVersion === productionV1 &&
					productionUntouched.renderId === productionWarm.renderId,
				"preview operation changed production",
			);
			await bumpAt(
				context,
				context.config.productionShieldUrl as string,
				context.config.shieldBypassToken,
				path,
				productionV2,
				undefined,
				"production",
			);
			assertCanonicalOk(await canonicalRest(context, tags, "production"));
			const productionFirst = await requestEnvironment(
				context.config.productionShieldUrl as string,
				"production-shield",
				context.config.shieldBypassToken,
			);
			assertMarker(productionFirst, path);
			ensure(
				productionFirst.xVercelCache?.toUpperCase() === "STALE",
				`Production invalidation did not produce immediate STALE; received ${productionFirst.xVercelCache ?? "no cache status"}`,
			);
			await pollResponse(
				context,
				() =>
					requestEnvironment(
						context.config.productionShieldUrl as string,
						"production-shield",
						context.config.shieldBypassToken,
					),
				(response) => response.marker?.contentVersion === productionV2,
				"production version v2",
			);
			const previewUntouched = assertMarker(
				await requestEnvironment(
					context.config.previewShieldUrl as string,
					"preview-shield",
					context.config.shieldBypassToken,
				),
				path,
			);
			ensure(
				previewUntouched.contentVersion === previewV2 &&
					previewUntouched.renderId === previewConverged.renderId,
				"production changed preview",
			);
			await recordReport(context, "target-isolation", {
				preview: { before: previewV1, after: previewV2 },
				production: { before: productionV1, after: productionV2 },
				restTargets: ["preview", "production"],
				coreUrlsConfigured: [
					context.config.previewCoreUrl,
					context.config.productionCoreUrl,
				],
			});
			return pass(
				"preview and production mutations remained target-isolated in both directions",
			);
		},
	},
	{
		id: "B6.1",
		title:
			"Deploy survival from pre/post Core deployment checkpoints/manifests",
		requires: [],
		destructive: false,
		proposalDisposition: "documentable-with-caveat",
		execute: async (context) => {
			if (!context.environment) {
				return blocked("B6 checkpoint evidence requires --environment");
			}
			if (
				!context.config.b6PreEvidencePath ||
				!context.config.b6PostEvidencePath ||
				!context.config.b6PreManifestPath ||
				!context.config.b6PostManifestPath
			) {
				return blocked(
					"supply B6_PRE_EVIDENCE_PATH, B6_POST_EVIDENCE_PATH, B6_PRE_MANIFEST_PATH, and B6_POST_MANIFEST_PATH; post evidence must include stale/warm requests that expose both the retained old marker and rebuilt Core marker",
				);
			}
			const evidence = await loadB6Evidence(context);
			ensure(
				evidence.preManifest.target === context.environment &&
					evidence.postManifest.target === context.environment,
				"checkpoint manifest target did not match the selected environment",
			);
			ensure(
				evidence.preManifest.branch === evidence.postManifest.branch,
				"checkpoint manifests came from different branches",
			);
			ensure(
				evidence.preManifest.deployments.core.deploymentId !==
					evidence.postManifest.deployments.core.deploymentId,
				"Core deployment did not change",
			);
			ensure(
				evidence.preManifest.deployments.shield.deploymentId ===
					evidence.postManifest.deployments.shield.deploymentId,
				"Shield deployment changed during the Core-only checkpoint",
			);
			ensure(
				evidence.postManifest.deployments.shield.deployed === false,
				"post manifest was not a Core-only deployment",
			);
			const preRequests = evidence.preObservations
				.filter(
					(item) =>
						new URL(item.url).hostname ===
							evidence.preManifest.deployments.shield.stableHost &&
						Date.parse(item.timestamp) >=
							Date.parse(evidence.preManifest.finishedAt),
				)
				.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
			ensure(
				preRequests.length > 0,
				"pre evidence had no request through the paired stable Shield host after deployment",
			);
			const pre = preRequests[preRequests.length - 1];
			const samePath = evidence.postObservations
				.filter(
					(item) =>
						item.marker.path === pre.marker.path &&
						new URL(item.url).hostname ===
							evidence.postManifest.deployments.shield.stableHost &&
						Date.parse(item.timestamp) >=
							Date.parse(evidence.postManifest.finishedAt),
				)
				.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
			ensure(
				samePath.length >= 2,
				"post evidence needs at least two requests for the warm path",
			);
			const oldIndex = samePath.findIndex(
				(item) =>
					item.marker.renderId === pre.marker.renderId &&
					["HIT", "STALE"].includes(item.cache?.toUpperCase() ?? ""),
			);
			const newIndex = samePath.findIndex(
				(item) =>
					item.marker.deploymentId ===
					evidence.postManifest.deployments.core.deploymentId,
			);
			ensure(
				oldIndex >= 0,
				"post evidence did not show the old render surviving",
			);
			ensure(
				newIndex > oldIndex,
				"post evidence did not show the new Core marker after the retained old render",
			);
			return pass(
				"pre-deploy render survived the Core-only deploy and post requests then observed the rebuilt Core deployment",
			);
		},
	},
	{
		id: "B6.2",
		title: "Shield deploy cache blast-radius observation",
		requires: [],
		destructive: false,
		proposalDisposition: "documentable-with-caveat",
		execute: async (context) => {
			if (!context.environment) {
				return blocked("B6 checkpoint evidence requires --environment");
			}
			if (
				!context.config.b6PreEvidencePath ||
				!context.config.b6PostEvidencePath ||
				!context.config.b6PreManifestPath ||
				!context.config.b6PostManifestPath
			) {
				return blocked(
					"supply B6 pre/post evidence and deployment manifest paths around a Shield deployment; use the same warm path in both checkpoints",
				);
			}
			const evidence = await loadB6Evidence(context);
			ensure(
				evidence.preManifest.target === context.environment &&
					evidence.postManifest.target === context.environment,
				"checkpoint manifest target did not match the selected environment",
			);
			ensure(
				evidence.preManifest.deployments.shield.deploymentId !==
					evidence.postManifest.deployments.shield.deploymentId,
				"Shield deployment did not change",
			);
			const preCandidates = evidence.preObservations
				.filter(
					(item) =>
						new URL(item.url).hostname ===
							evidence.preManifest.deployments.shield.stableHost &&
						Date.parse(item.timestamp) >=
							Date.parse(evidence.preManifest.finishedAt),
				)
				.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
			const pre = preCandidates[preCandidates.length - 1];
			ensure(pre, "pre evidence had no stable Shield request after deployment");
			const post = evidence.postObservations
				.filter(
					(item) =>
						item.marker.path === pre.marker.path &&
						new URL(item.url).hostname ===
							evidence.postManifest.deployments.shield.stableHost &&
						Date.parse(item.timestamp) >=
							Date.parse(evidence.postManifest.finishedAt),
				)
				.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))[0];
			ensure(post, "post evidence did not contain the same warm path");
			return pass(
				`Shield deployment changed; warm render ${post.marker.renderId === pre.marker.renderId ? "survived" : "changed"} (${pre.marker.renderId} -> ${post.marker.renderId})`,
			);
		},
	},
	{
		id: "B6.3",
		title: "Anonymous middleware skip with CDN-only route caveat",
		requires: [],
		destructive: false,
		proposalDisposition: "documentable-with-caveat",
		execute: async (context) => {
			if (!context.environment) {
				return blocked("B6 o11y evidence requires --environment");
			}
			await recordReport(context, "shield.source-design", {
				routing: "vercel.ts conditional CDN rewrites",
				middleware: "intentionally absent",
				caveat: "response evidence cannot prove invocation count",
			});
			if (!context.config.b6MiddlewareO11yPath) {
				return blocked(
					"Shield source/design is CDN-only with no middleware, but runtime invocation proof requires B6_MIDDLEWARE_O11Y_PATH",
				);
			}
			const value = await readStructuredFile(
				context.config.b6MiddlewareO11yPath,
			);
			await recordReport(context, "middleware.o11y", value);
			ensure(
				value && typeof value === "object",
				"middleware o11y was not an object",
			);
			const count = (value as Record<string, unknown>)
				.shieldMiddlewareInvocations;
			const o11y = value as Record<string, unknown>;
			ensure(
				o11y.target === context.environment,
				`middleware o11y target ${String(o11y.target)} did not match ${String(context.environment)}`,
			);
			ensure(
				typeof o11y.shieldDeploymentId === "string" &&
					o11y.shieldDeploymentId.length > 0,
				"middleware o11y omitted shieldDeploymentId",
			);
			ensure(
				typeof o11y.windowStart === "string" &&
					typeof o11y.windowEnd === "string" &&
					Date.parse(o11y.windowStart) < Date.parse(o11y.windowEnd),
				"middleware o11y omitted a valid observation window",
			);
			ensure(
				count === 0,
				`observed Shield middleware invocation count ${String(count)}`,
			);
			return pass(
				"source design is CDN-only and o11y recorded zero Shield middleware invocations",
			);
		},
	},
	{
		id: "B6.4",
		title: "MISS cost trace from o11y or logs",
		requires: [],
		destructive: false,
		proposalDisposition: "documentable-with-caveat",
		execute: async (context) => {
			if (!context.environment) {
				return blocked("B6 o11y evidence requires --environment");
			}
			if (!context.config.b6MissO11yPath) {
				return blocked(
					"set B6_MISS_O11Y_PATH to structured log/o11y evidence containing requestId, missDurationMs, and originDurationMs",
				);
			}
			const value = await readStructuredFile(context.config.b6MissO11yPath);
			await recordReport(context, "miss-cost.o11y", value);
			ensure(value && typeof value === "object", "MISS o11y was not an object");
			const record = value as Record<string, unknown>;
			ensure(
				record.target === context.environment,
				`MISS o11y target ${String(record.target)} did not match ${String(context.environment)}`,
			);
			ensure(
				record.cacheStatus === "MISS",
				`MISS o11y cacheStatus was ${String(record.cacheStatus)}`,
			);
			ensure(
				typeof record.deploymentId === "string" &&
					record.deploymentId.length > 0,
				"MISS o11y omitted deploymentId",
			);
			ensure(
				typeof record.requestId === "string",
				"MISS o11y omitted requestId",
			);
			ensure(
				typeof record.missDurationMs === "number" &&
					Number.isFinite(record.missDurationMs) &&
					record.missDurationMs >= 0,
				"MISS o11y omitted missDurationMs",
			);
			ensure(
				typeof record.originDurationMs === "number" &&
					Number.isFinite(record.originDurationMs) &&
					record.originDurationMs >= 0,
				"MISS o11y omitted originDurationMs",
			);
			return pass(
				`request ${record.requestId}: MISS=${record.missDurationMs}ms, origin=${record.originDurationMs}ms`,
			);
		},
	},
];

export const scenarios = definitions;

export function scenarioById(id: string): ScenarioDefinition | undefined {
	return definitions.find((scenario) => scenario.id === id);
}
