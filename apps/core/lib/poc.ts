import { randomUUID, timingSafeEqual } from "node:crypto";
import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
import { addCacheTag } from "@vercel/functions";

const CORE_TTL_SECONDS = 60;
const SWR_SECONDS = 31_536_000;
const MAX_DELAY_MS = 30_000;
const MAX_PATH_LENGTH = 200;

export const POC_PROFILES = ["free", "member", "enterprise"] as const;

export interface PocMarker {
  renderId: string;
  contentVersion: number;
  profile: string;
  deploymentId: string;
  renderedAt: string;
  path: string;
  tags: string[];
}

export interface PocFault {
  delayMs: number;
  force500: boolean;
}

export interface PocState {
  path: string;
  contentVersion: number;
  profiles: Record<string, number>;
  fault: PocFault;
  updatedAt: string;
}

interface StateRecord {
  state: PocState;
  etag?: string;
}

export class PocInputError extends Error {}

const localState = new Map<string, PocState>();

function defaultState(path: string): PocState {
  return {
    path,
    contentVersion: 0,
    profiles: {},
    fault: { delayMs: 0, force500: false },
    updatedAt: new Date(0).toISOString(),
  };
}

function hasBlobStore(): boolean {
  return Boolean(
    process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN,
  );
}

export function pocStorageBackend(): "blob" | "memory" | "unconfigured" {
  if (hasBlobStore()) return "blob";
  return allowLocalMemory() ? "memory" : "unconfigured";
}

function environmentScope(): string {
  const environment = process.env.VERCEL_ENV;
  if (!environment) {
    if (allowLocalMemory()) {
      return "development";
    }
    throw new Error(
      "VERCEL_ENV is required; enable Vercel system environment variables",
    );
  }
  return environment.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function allowLocalMemory(): boolean {
  return (
    process.env.POC_ALLOW_MEMORY === "1" &&
    process.env.VERCEL !== "1" &&
    process.env.NODE_ENV !== "production"
  );
}

export function normalizePocPath(input: string): string {
  const path = input.trim().replace(/^\/+|\/+$/g, "");
  if (!path || path.length > MAX_PATH_LENGTH) {
    throw new PocInputError(
      `path must contain 1-${MAX_PATH_LENGTH} characters`,
    );
  }
  if (
    path
      .split("/")
      .some((segment) => !segment || segment === "." || segment === "..") ||
    !/^[a-zA-Z0-9._/-]+$/.test(path)
  ) {
    throw new PocInputError("path contains unsupported characters");
  }
  return path;
}

function statePathname(path: string): string {
  return `shield-poc/${environmentScope()}/${path}.json`;
}

function assertStoredState(value: unknown, path: string): PocState {
  if (!value || typeof value !== "object") {
    throw new Error(`invalid PoC state for ${path}`);
  }
  const candidate = value as Partial<PocState>;
  if (
    candidate.path !== path ||
    !Number.isInteger(candidate.contentVersion) ||
    (candidate.contentVersion as number) < 0 ||
    !candidate.profiles ||
    typeof candidate.profiles !== "object" ||
    !candidate.fault ||
    typeof candidate.fault !== "object" ||
    !Number.isInteger(candidate.fault.delayMs) ||
    typeof candidate.fault.force500 !== "boolean" ||
    typeof candidate.updatedAt !== "string"
  ) {
    throw new Error(`invalid PoC state for ${path}`);
  }
  for (const version of Object.values(candidate.profiles)) {
    if (!Number.isInteger(version) || version < 0) {
      throw new Error(`invalid profile version in PoC state for ${path}`);
    }
  }
  return candidate as PocState;
}

async function readBlobState(path: string): Promise<StateRecord> {
  const result = await get(statePathname(path), {
    access: "private",
    useCache: false,
  });
  if (!result) {
    return { state: defaultState(path) };
  }
  if (result.statusCode !== 200 || !result.stream) {
    throw new Error(`could not read PoC state for ${path}`);
  }
  const body = await new Response(result.stream).json();
  return {
    state: assertStoredState(body, path),
    etag: result.blob.etag,
  };
}

export async function readPocState(input: string): Promise<PocState> {
  const path = normalizePocPath(input);
  if (hasBlobStore()) {
    return (await readBlobState(path)).state;
  }
  if (!allowLocalMemory()) {
    throw new Error(
      "connect a Vercel Blob store, or set POC_ALLOW_MEMORY=1 for local-only testing",
    );
  }
  return structuredClone(localState.get(path) ?? defaultState(path));
}

async function mutatePocState(
  input: string,
  mutate: (current: PocState) => PocState,
): Promise<PocState> {
  const path = normalizePocPath(input);
  if (!hasBlobStore()) {
    if (!allowLocalMemory()) {
      throw new Error(
        "connect a Vercel Blob store, or set POC_ALLOW_MEMORY=1 for local-only testing",
      );
    }
    const next = mutate(
      structuredClone(localState.get(path) ?? defaultState(path)),
    );
    localState.set(path, next);
    return structuredClone(next);
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const current = await readBlobState(path);
    const next = mutate(structuredClone(current.state));
    try {
      await put(statePathname(path), JSON.stringify(next), {
        access: "private",
        allowOverwrite: Boolean(current.etag),
        ifMatch: current.etag,
        contentType: "application/json",
        cacheControlMaxAge: 60,
      });
      return next;
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError) {
        continue;
      }
      if (!current.etag) {
        try {
          if ((await readBlobState(path)).etag) continue;
        } catch {
          // Preserve the original write error when the follow-up read also fails.
        }
      }
      throw error;
    }
  }
  throw new Error(
    `PoC state for ${path} changed too many times; retry the operation`,
  );
}

function assertVersion(value: unknown, field: string): asserts value is number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new PocInputError(`${field} must be a non-negative integer`);
  }
}

export async function bumpPocContent(
  path: string,
  input: {
    contentVersion?: number;
    profiles?: Record<string, number>;
  },
): Promise<PocState> {
  if (input.contentVersion !== undefined) {
    assertVersion(input.contentVersion, "contentVersion");
  }
  if (input.profiles !== undefined) {
    if (!input.profiles || typeof input.profiles !== "object") {
      throw new PocInputError("profiles must be an object");
    }
    for (const [profile, version] of Object.entries(input.profiles)) {
      if (!POC_PROFILES.includes(profile as (typeof POC_PROFILES)[number])) {
        throw new PocInputError(`unsupported profile: ${profile}`);
      }
      assertVersion(version, `profiles.${profile}`);
    }
  }

  return mutatePocState(path, (current) => {
    const nextVersion = input.contentVersion ?? current.contentVersion + 1;
    if (nextVersion <= current.contentVersion) {
      throw new PocInputError(
        `contentVersion must be greater than ${current.contentVersion}`,
      );
    }
    const profiles = { ...current.profiles };
    for (const [profile, version] of Object.entries(input.profiles ?? {})) {
      const currentVersion = profiles[profile] ?? current.contentVersion;
      if (version <= currentVersion) {
        throw new PocInputError(
          `profiles.${profile} must be greater than ${currentVersion}`,
        );
      }
      profiles[profile] = version;
    }
    return {
      ...current,
      contentVersion: nextVersion,
      profiles,
      updatedAt: new Date().toISOString(),
    };
  });
}

export async function setPocFault(
  path: string,
  fault: Partial<PocFault>,
): Promise<PocState> {
  if (fault.delayMs !== undefined) {
    if (
      !Number.isInteger(fault.delayMs) ||
      fault.delayMs < 0 ||
      fault.delayMs > MAX_DELAY_MS
    ) {
      throw new PocInputError(
        `delayMs must be an integer from 0-${MAX_DELAY_MS}`,
      );
    }
  }
  if (fault.force500 !== undefined && typeof fault.force500 !== "boolean") {
    throw new PocInputError("force500 must be a boolean");
  }
  return mutatePocState(path, (current) => ({
    ...current,
    fault: {
      delayMs: fault.delayMs ?? current.fault.delayMs,
      force500: fault.force500 ?? current.fault.force500,
    },
    updatedAt: new Date().toISOString(),
  }));
}

function tokenMatches(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function authorizeBearer(
  request: Request,
  environmentVariable: "POC_CONTROL_TOKEN" | "CACHE_CONTROL_TOKEN",
): Response | undefined {
  const expected = process.env[environmentVariable];
  if (!expected) {
    return pocJson({ error: `${environmentVariable} is not configured` }, 503);
  }
  const authorization = request.headers.get("authorization") ?? "";
  const actual = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  if (!actual || !tokenMatches(actual, expected)) {
    return pocJson({ error: "Unauthorized" }, 401);
  }
  return undefined;
}

export function authorizePocControl(request: Request): Response | undefined {
  return authorizeBearer(request, "POC_CONTROL_TOKEN");
}

export function authorizeCacheControl(request: Request): Response | undefined {
  return authorizeBearer(request, "CACHE_CONTROL_TOKEN");
}

export function pocJson(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}

function cookieValue(request: Request, name: string): string | undefined {
  const cookie = request.headers.get("cookie");
  if (!cookie) return undefined;
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

function profileFor(request: Request, includeProfile: boolean): string {
  if (!includeProfile) return "default";
  const candidate =
    request.headers.get("x-content-profile") ??
    cookieValue(request, "poc-profile") ??
    "free";
  return POC_PROFILES.includes(candidate as (typeof POC_PROFILES)[number])
    ? candidate
    : "free";
}

function tagsFor(path: string, profile: string): string[] {
  const tags = ["poc:content", `poc:path:${path}`];
  if (profile !== "default") {
    tags.push(`poc:path:${path}:profile:${profile}`);
  }
  return tags;
}

function envPathSet(name: string): Set<string> {
  return new Set(
    (process.env[name] ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function effectiveFault(path: string, state: PocState): PocFault {
  const configuredDelay = Number.parseInt(process.env.DELAY_MS ?? "0", 10);
  const delayedPaths = envPathSet("DELAY_PATHS");
  const failedPaths = envPathSet("FORCE_500_PATHS");
  return {
    delayMs:
      Number.isFinite(configuredDelay) &&
      configuredDelay > 0 &&
      (delayedPaths.size === 0 || delayedPaths.has(path))
        ? Math.min(configuredDelay, MAX_DELAY_MS)
        : state.fault.delayMs,
    force500:
      process.env.FORCE_500 === "1" ||
      failedPaths.has(path) ||
      state.fault.force500,
  };
}

export async function renderPocResponse(
  request: Request,
  input: string,
  includeProfile: boolean,
): Promise<Response> {
  const path = normalizePocPath(input);
  const state = await readPocState(path);
  const fault = effectiveFault(path, state);
  if (fault.delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, fault.delayMs));
  }
  if (fault.force500) {
    console.error(
      JSON.stringify({ event: "poc.render.failed", path, force500: true }),
    );
    return pocJson({ error: "Injected Core failure", path }, 500);
  }

  const profile = profileFor(request, includeProfile);
  const tags = tagsFor(path, profile);
  const marker: PocMarker = {
    renderId: randomUUID(),
    contentVersion:
      profile === "default"
        ? state.contentVersion
        : (state.profiles[profile] ?? state.contentVersion),
    profile,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? "local",
    renderedAt: new Date().toISOString(),
    path,
    tags,
  };

  await addCacheTag(tags);
  console.log(JSON.stringify({ event: "poc.render", ...marker }));

  const headers = new Headers({
    "Cache-Control": "public, max-age=0, must-revalidate",
    "Vercel-CDN-Cache-Control": `s-maxage=${CORE_TTL_SECONDS}, stale-while-revalidate=${SWR_SECONDS}`,
    "x-poc-render-id": marker.renderId,
    "x-poc-content-version": String(marker.contentVersion),
  });
  if (includeProfile) {
    headers.set(
      "Vary",
      request.headers.has("x-content-profile") ? "x-content-profile" : "Cookie",
    );
  }
  return Response.json(marker, { headers });
}
