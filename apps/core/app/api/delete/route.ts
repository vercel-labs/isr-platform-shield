import { dangerouslyDeleteByTag } from "@vercel/functions";
import { authorizeCacheControl, PocInputError, pocJson } from "@/lib/poc";

export async function POST(request: Request) {
  const unauthorized = authorizeCacheControl(request);
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json()) as { tag?: unknown };
    if (
      typeof body.tag !== "string" ||
      !body.tag ||
      body.tag.length > 256 ||
      body.tag.includes(",")
    ) {
      throw new PocInputError("tag must be a single cache tag");
    }

    await dangerouslyDeleteByTag(body.tag, {
      revalidationDeadlineSeconds: 0,
    });

    return pocJson({
      message: "Cache deleted successfully",
      tag: body.tag,
    });
  } catch (error) {
    if (error instanceof PocInputError) {
      return pocJson({ error: error.message }, 400);
    }
    console.error("Deletion error:", error);
    return pocJson({ error: "Internal server error" }, 500);
  }
}
