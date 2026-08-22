import { timingSafeEqual } from "node:crypto";

function matches(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function noStoreJson(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export function authorizeControl(
  request: Request,
  environmentVariable:
    | "POC_CONTROL_TOKEN"
    | "CACHE_CONTROL_TOKEN" = "POC_CONTROL_TOKEN",
): Response | undefined {
  const expected = process.env[environmentVariable];
  if (!expected) {
    return noStoreJson(
      { error: `${environmentVariable} is not configured` },
      503,
    );
  }
  const authorization = request.headers.get("authorization") ?? "";
  const actual = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  if (!actual || !matches(actual, expected)) {
    return noStoreJson({ error: "Unauthorized" }, 401);
  }
  return undefined;
}
