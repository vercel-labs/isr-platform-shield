import { revalidateTag } from "next/cache";
import { authorizePocControl, PocInputError, pocJson } from "@/lib/poc";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = authorizePocControl(request);
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json()) as { tag?: unknown; mode?: unknown };
    if (
      typeof body.tag !== "string" ||
      !body.tag.startsWith("poc:") ||
      body.tag.length > 256
    ) {
      throw new PocInputError("tag must be a namespaced PoC cache tag");
    }
    if (body.mode !== "revalidate") {
      throw new PocInputError("mode must be revalidate");
    }
    revalidateTag(body.tag, "max");
    return pocJson({ revalidated: true, tag: body.tag, semantics: "stale" });
  } catch (error) {
    if (error instanceof PocInputError) {
      return pocJson({ error: error.message }, 400);
    }
    console.error("PoC revalidation failed", error);
    return pocJson({ error: "Tag revalidation failed" }, 500);
  }
}
