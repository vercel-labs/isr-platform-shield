import { appendFile, mkdir, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type {
	EvidenceEvent,
	OperationEvidence,
	ValidationSummary,
} from "./types";

const SECRET_KEY =
	/(authorization|cookie|credential|password|secret|token|bypass|api[-_]?key)/i;
const MAX_BODY_LENGTH = 12_000;

function redactString(input: string, secrets: string[] = []): string {
	let redacted = input;
	for (const secret of secrets) {
		if (secret) {
			redacted = redacted.split(secret).join("[REDACTED]");
		}
	}
	return redacted
		.replace(/Bearer\s+[^\s"']+/gi, "Bearer [REDACTED]")
		.replace(
			/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
			"[REDACTED]",
		)
		.replace(/\b(?:vcp_|vercel_)[A-Za-z0-9._-]+\b/g, "[REDACTED]")
		.replace(
			/([?&](?:token|secret|key|password|bypass)=)[^&]*/gi,
			"$1[REDACTED]",
		);
}

function redactValue(
	value: unknown,
	key?: string,
	secrets: string[] = [],
): unknown {
	if (key && SECRET_KEY.test(key)) {
		return "[REDACTED]";
	}
	if (typeof value === "string") {
		return redactString(value, secrets);
	}
	if (Array.isArray(value)) {
		return value.map((item) => redactValue(item, undefined, secrets));
	}
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([childKey, childValue]) => [
				childKey,
				redactValue(childValue, childKey, secrets),
			]),
		);
	}
	return value;
}

export function sanitizeResponseBody(
	value: unknown,
	secrets: string[] = [],
): unknown {
	const redacted = redactValue(value, undefined, secrets);
	const serialized = JSON.stringify(redacted) ?? String(redacted);
	if (serialized.length <= MAX_BODY_LENGTH) {
		return redacted;
	}
	return {
		truncated: true,
		preview: redactString(serialized.slice(0, MAX_BODY_LENGTH), secrets),
	};
}

export function sanitizeUrl(value: string, secrets: string[] = []): string {
	try {
		const parsed = new URL(value);
		if (parsed.username) {
			parsed.username = "REDACTED";
		}
		if (parsed.password) {
			parsed.password = "REDACTED";
		}
		for (const key of parsed.searchParams.keys()) {
			if (SECRET_KEY.test(key)) {
				parsed.searchParams.set(key, "[REDACTED]");
			}
		}
		return redactString(parsed.toString(), secrets);
	} catch {
		return redactString(value, secrets);
	}
}

export class EvidenceWriter {
	readonly outputDirectory: string;
	readonly eventsPath: string;
	readonly summaryPath: string;
	private pendingWrite: Promise<void> = Promise.resolve();

	constructor(
		outputDirectory: string,
		private readonly secrets: string[] = [],
	) {
		this.outputDirectory = resolve(outputDirectory);
		this.eventsPath = resolve(this.outputDirectory, "events.jsonl");
		this.summaryPath = resolve(this.outputDirectory, "summary.json");
	}

	async initialize(): Promise<void> {
		await mkdir(this.outputDirectory, { recursive: true });
		await writeFile(this.eventsPath, "", { encoding: "utf8", flag: "wx" });
	}

	async event(event: EvidenceEvent): Promise<void> {
		const safeEvent = {
			...event,
			url: event.url ? sanitizeUrl(event.url, this.secrets) : null,
			sanitizedResponseBody: sanitizeResponseBody(
				event.sanitizedResponseBody,
				this.secrets,
			),
		};
		this.pendingWrite = this.pendingWrite.then(() =>
			appendFile(this.eventsPath, `${JSON.stringify(safeEvent)}\n`, "utf8"),
		);
		await this.pendingWrite;
	}

	async operation(
		scenarioId: string,
		run: number,
		operation: OperationEvidence,
		body: unknown,
	): Promise<void> {
		await this.event({
			timestamp: new Date().toISOString(),
			scenarioId,
			run,
			url: null,
			method: null,
			cookies: { names: [] },
			status: null,
			durationMs: 0,
			"x-vercel-cache": null,
			"x-vercel-id": null,
			age: null,
			"cache-control": null,
			"cdn-cache-control": null,
			"vercel-cdn-cache-control": null,
			vary: null,
			parsedMarker: null,
			operation,
			sanitizedResponseBody: body,
		});
	}

	async summary(summary: ValidationSummary): Promise<void> {
		const temporaryPath = `${this.summaryPath}.tmp`;
		await writeFile(
			temporaryPath,
			`${JSON.stringify(summary, null, 2)}\n`,
			"utf8",
		);
		await rename(temporaryPath, this.summaryPath);
	}
}
