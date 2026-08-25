export type Environment = "preview" | "production";

export type Profile = "free" | "member" | "enterprise";

export type ResultStatus = "PASS" | "FAIL" | "BLOCKED";

export type ProposalDisposition =
	| "documentable"
	| "documentable-with-caveat"
	| "escalate-to-sign-off"
	| "architecture-change"
	| "undetermined";

export type Confidence = "observed 3x" | "observed once" | "failed" | "blocked";

export interface Marker {
	renderId: string;
	contentVersion: number;
	profile: "default" | Profile;
	deploymentId: string;
	renderedAt: string;
	path: string;
	tags: string[];
}

export interface CookieEvidence {
	names: string[];
	profile?: string;
}

export interface OperationEvidence {
	name: string;
	path?: string;
	target?: Environment;
	project?: string;
	tags?: string[];
}

export interface EvidenceEvent {
	timestamp: string;
	scenarioId: string;
	run: number;
	url: string | null;
	method: string | null;
	requestHeaders: Record<string, string>;
	cookies: CookieEvidence;
	status: number | null;
	durationMs: number;
	"x-vercel-cache": string | null;
	"x-vercel-id": string | null;
	age: string | null;
	"cache-control": string | null;
	"cdn-cache-control": string | null;
	"vercel-cdn-cache-control": string | null;
	vary: string | null;
	parsedMarker: Marker | null;
	operation: OperationEvidence;
	sanitizedResponseBody: unknown;
}

export interface RecordedResponse {
	status: number;
	ok: boolean;
	durationMs: number;
	xVercelCache: string | null;
	xVercelId: string | null;
	age: string | null;
	cacheControl: string | null;
	cdnCacheControl: string | null;
	vercelCdnCacheControl: string | null;
	vary: string | null;
	body: unknown;
	marker: Marker | null;
}

export interface ScenarioOutcome {
	disposition: ResultStatus;
	observedResult: string;
	proposalDisposition?: ProposalDisposition;
}

export interface ScenarioSummary {
	id: string;
	title: string;
	observedResult: string;
	runCount: number;
	environments: Environment[];
	confidence: Confidence;
	disposition: ResultStatus;
	proposalDisposition: ProposalDisposition;
	failures: string[];
}

export interface ValidationSummary {
	schemaVersion: 1;
	invocationId: string;
	startedAt: string;
	finishedAt: string;
	suites: string[];
	selectedScenarioIds: string[];
	observedResult: string;
	runCount: number;
	environments: Environment[];
	confidence: Confidence;
	disposition: ResultStatus;
	proposalDisposition: ProposalDisposition;
	failures: string[];
	scenarios: ScenarioSummary[];
}
