import { getVercelOidcToken } from "@vercel/oidc";
import { authorizePocControl, PocInputError, pocJson } from "@/lib/poc";

export const dynamic = "force-dynamic";

function allowedProjects(): Set<string> {
  return new Set(
    (process.env.POC_ALLOWED_PROJECT_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export async function POST(request: Request) {
  const unauthorized = authorizePocControl(request);
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json()) as {
      projectId?: unknown;
      tags?: unknown;
      target?: unknown;
    };
    if (
      typeof body.projectId !== "string" ||
      !allowedProjects().has(body.projectId)
    ) {
      throw new PocInputError("projectId is not allowlisted");
    }
    if (body.target !== "preview" && body.target !== "production") {
      throw new PocInputError("target must be preview or production");
    }
    if (
      !Array.isArray(body.tags) ||
      body.tags.length === 0 ||
      body.tags.length > 16 ||
      body.tags.some(
        (tag) => typeof tag !== "string" || !tag.startsWith("poc:"),
      )
    ) {
      throw new PocInputError("tags must contain 1-16 namespaced PoC tags");
    }

    const token = await getVercelOidcToken({
      audience: "https://api.vercel.com/edge-cache",
    });
    const url = new URL(
      "https://api.vercel.com/v1/edge-cache/dangerously-delete-by-tags",
    );
    url.searchParams.set("projectIdOrName", body.projectId);
    if (process.env.POC_VERCEL_TEAM_ID) {
      url.searchParams.set("teamId", process.env.POC_VERCEL_TEAM_ID);
    } else if (process.env.POC_VERCEL_TEAM_SLUG) {
      url.searchParams.set("slug", process.env.POC_VERCEL_TEAM_SLUG);
    }

    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tags: body.tags,
        target: body.target,
        revalidationDeadlineSeconds: 0,
      }),
      cache: "no-store",
    });
    const upstreamBody = await upstream.text();
    return pocJson({
      upstreamStatus: upstream.status,
      upstreamBody: upstreamBody.slice(0, 2_000),
    });
  } catch (error) {
    if (error instanceof PocInputError) {
      return pocJson({ error: error.message }, 400);
    }
    console.error("PoC OIDC REST probe failed", error);
    return pocJson({
      upstreamStatus: null,
      error: error instanceof Error ? error.message : "OIDC probe failed",
    });
  }
}
