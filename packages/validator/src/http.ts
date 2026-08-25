import type { RuntimeConfig } from "./config";
import type { EvidenceWriter } from "./evidence";
import type {
	CookieEvidence,
	Marker,
	OperationEvidence,
	RecordedResponse,
} from "./types";

interface RequestOptions {
	scenarioId: string;
	run: number;
	url: string;
	method?: "GET" | "POST";
	headers?: Record<string, string>;
	body?: unknown;
	cookies?: Record<string, string>;
	redirect?: RequestRedirect;
	debugProxyTiming?: boolean;
	operation: OperationEvidence;
}

function markerCandidate(body: unknown): unknown {
	if (!body || typeof body !== "object") {
		return null;
	}
	const record = body as Record<string, unknown>;
	return record.marker && typeof record.marker === "object"
		? record.marker
		: body;
}

export function parseMarker(body: unknown): Marker | null {
	const candidate = markerCandidate(body);
	if (!candidate || typeof candidate !== "object") {
		return null;
	}
	const marker = candidate as Record<string, unknown>;
	if (
		typeof marker.renderId !== "string" ||
		!Number.isInteger(marker.contentVersion) ||
		(marker.profile !== "default" &&
			marker.profile !== "free" &&
			marker.profile !== "member" &&
			marker.profile !== "enterprise") ||
		typeof marker.deploymentId !== "string" ||
		typeof marker.renderedAt !== "string" ||
		typeof marker.path !== "string" ||
		!Array.isArray(marker.tags) ||
		!marker.tags.every((tag) => typeof tag === "string")
	) {
		return null;
	}

	return {
		renderId: marker.renderId,
		contentVersion: marker.contentVersion as number,
		profile: marker.profile,
		deploymentId: marker.deploymentId,
		renderedAt: marker.renderedAt,
		path: marker.path,
		tags: marker.tags as string[],
	};
}

function parseBody(text: string): unknown {
	if (!text) {
		return null;
	}
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return text;
	}
}

export class EvidenceHttpClient {
	constructor(
		private readonly writer: EvidenceWriter,
		private readonly config: RuntimeConfig,
	) {}

	async request(options: RequestOptions): Promise<RecordedResponse> {
		const method = options.method ?? "GET";
		const headers = new Headers(options.headers);
		if (options.debugProxyTiming ?? true) {
			headers.set("x-vercel-debug-proxy-timing", "1");
		}
		if (options.body !== undefined) {
			headers.set("content-type", "application/json");
		}
		if (options.cookies && Object.keys(options.cookies).length > 0) {
			headers.set(
				"cookie",
				Object.entries(options.cookies)
					.map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
					.join("; "),
			);
		}

		const cookieEvidence: CookieEvidence = {
			names: Object.keys(options.cookies ?? {}).sort(),
		};
		const profile = options.cookies?.["poc-profile"];
		if (profile) {
			cookieEvidence.profile = profile;
		}
		const requestHeaders = Object.fromEntries(headers.entries());

		const controller = new AbortController();
		const timeout = setTimeout(
			() => controller.abort(),
			this.config.requestTimeoutMs,
		);
		const startedAt = performance.now();

		try {
			const response = await fetch(options.url, {
				method,
				headers,
				body:
					options.body === undefined ? undefined : JSON.stringify(options.body),
				redirect: options.redirect ?? "follow",
				signal: controller.signal,
			});
			const text = await response.text();
			const body = parseBody(text);
			const durationMs = Math.round(performance.now() - startedAt);
			const marker = parseMarker(body);
			const recorded: RecordedResponse = {
				status: response.status,
				ok: response.ok,
				durationMs,
				xVercelCache: response.headers.get("x-vercel-cache"),
				xVercelId: response.headers.get("x-vercel-id"),
				age: response.headers.get("age"),
				cacheControl: response.headers.get("cache-control"),
				cdnCacheControl: response.headers.get("cdn-cache-control"),
				vercelCdnCacheControl: response.headers.get("vercel-cdn-cache-control"),
				vary: response.headers.get("vary"),
				body,
				marker,
			};

			await this.writer.event({
				timestamp: new Date().toISOString(),
				scenarioId: options.scenarioId,
				run: options.run,
				url: options.url,
				method,
				requestHeaders,
				cookies: cookieEvidence,
				status: response.status,
				durationMs,
				"x-vercel-cache": recorded.xVercelCache,
				"x-vercel-id": recorded.xVercelId,
				age: recorded.age,
				"cache-control": recorded.cacheControl,
				"cdn-cache-control": recorded.cdnCacheControl,
				"vercel-cdn-cache-control": recorded.vercelCdnCacheControl,
				vary: recorded.vary,
				parsedMarker: marker,
				operation: options.operation,
				sanitizedResponseBody: body,
			});

			return recorded;
		} catch (error) {
			const durationMs = Math.round(performance.now() - startedAt);
			const message = error instanceof Error ? error.message : String(error);
			await this.writer.event({
				timestamp: new Date().toISOString(),
				scenarioId: options.scenarioId,
				run: options.run,
				url: options.url,
				method,
				requestHeaders,
				cookies: cookieEvidence,
				status: null,
				durationMs,
				"x-vercel-cache": null,
				"x-vercel-id": null,
				age: null,
				"cache-control": null,
				"cdn-cache-control": null,
				"vercel-cdn-cache-control": null,
				vary: null,
				parsedMarker: null,
				operation: options.operation,
				sanitizedResponseBody: { error: message },
			});
			throw error;
		} finally {
			clearTimeout(timeout);
		}
	}
}
