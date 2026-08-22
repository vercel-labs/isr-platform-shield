import {
  authorizePocControl,
  bumpPocContent,
  PocInputError,
  pocJson,
} from "@/lib/poc";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = authorizePocControl(request);
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json()) as {
      path?: unknown;
      contentVersion?: unknown;
      profiles?: unknown;
    };
    if (typeof body.path !== "string") {
      throw new PocInputError("path is required");
    }
    const state = await bumpPocContent(body.path, {
      contentVersion: body.contentVersion as number | undefined,
      profiles: body.profiles as Record<string, number> | undefined,
    });
    return pocJson({ state });
  } catch (error) {
    if (error instanceof PocInputError) {
      return pocJson({ error: error.message }, 400);
    }
    console.error("PoC bump failed", error);
    return pocJson({ error: "Content mutation failed" }, 500);
  }
}
