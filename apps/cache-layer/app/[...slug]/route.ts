import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@platform/config";

export const dynamic = "force-static";
export const revalidate = 3600;

const getCoreUrl = () => {
  const env = process.env.NODE_ENV || "development";
  const config = getConfig(env);
  const protocol = env === "production" ? "https" : "http";
  return `${protocol}://${config.core.host}`;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  console.log(slug);
  const coreUrl = getCoreUrl();
  const pageResponse = await fetch(`${coreUrl}/${slug.join("/")}`, {
    cache: "force-cache",
  });
  pageResponse.headers.delete("transfer-encoding");
  pageResponse.headers.delete("content-encoding");
  pageResponse.headers.delete("content-length");
  pageResponse.headers.set("vercel-cdn-cache-control", "public, max-age=3600");
  pageResponse.headers.set("x-proxied", "1");
  for (const [keyName] of pageResponse.headers.entries()) {
    const key = keyName.toLowerCase();
    if (key.startsWith("x-vercel-")) {
      pageResponse.headers.delete(keyName);
    }
  }
  return pageResponse;
}
