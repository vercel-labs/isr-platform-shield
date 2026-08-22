import {
  authorizePocControl,
  PocInputError,
  pocJson,
  setPocFault,
} from "@/lib/poc";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = authorizePocControl(request);
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json()) as {
      path?: unknown;
      delayMs?: unknown;
      force500?: unknown;
    };
    if (typeof body.path !== "string") {
      throw new PocInputError("path is required");
    }
    const state = await setPocFault(body.path, {
      delayMs: body.delayMs as number | undefined,
      force500: body.force500 as boolean | undefined,
    });
    return pocJson({ state });
  } catch (error) {
    if (error instanceof PocInputError) {
      return pocJson({ error: error.message }, 400);
    }
    console.error("PoC fault control failed", error);
    return pocJson({ error: "Fault update failed" }, 500);
  }
}
