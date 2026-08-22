import { invalidateByTag } from "@vercel/functions";
import { authorizeControl, noStoreJson } from "@/lib/control-auth";

export async function POST(request: Request) {
  const unauthorized = authorizeControl(request, "CACHE_CONTROL_TOKEN");
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json()) as { tag?: unknown };
    if (
      typeof body.tag !== "string" ||
      !body.tag ||
      body.tag.length > 256 ||
      body.tag.includes(",")
    ) {
      return noStoreJson({ error: "tag must be a single cache tag" }, 400);
    }

    const coreHost = process.env.CORE_HOST;
    if (!coreHost) {
      return noStoreJson({ error: "CORE_HOST is not configured" }, 500);
    }

    const childResponse = await fetch(`https://${coreHost}/api/delete`, {
      method: "POST",
      headers: {
        Authorization: request.headers.get("authorization") ?? "",
        "Content-Type": "application/json",
        ...(process.env.VERCEL_BYPASS_TOKEN
          ? {
              "x-vercel-protection-bypass": process.env.VERCEL_BYPASS_TOKEN,
            }
          : {}),
      },
      body: JSON.stringify({ tag: body.tag }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const childResponseData = (await childResponse.json()) as {
      error?: string;
    };

    // If the core tag deletion fails, bail out and don't invalidate shield because it
    // will refetch stale content unnecessarily
    if (!childResponse.ok || childResponseData.error) {
      return noStoreJson(
        { error: childResponseData.error ?? "Core cache deletion failed" },
        502,
      );
    } else {
      // If the core app is able to delete the tag, invalidate the tag on the shield app
      await invalidateByTag(body.tag);

      return noStoreJson({
        message: "Cache invalidated successfully",
        tag: body.tag,
      });
    }
  } catch (error) {
    console.error("Invalidation error:", error);
    return noStoreJson({ error: "Internal server error" }, 500);
  }
}
