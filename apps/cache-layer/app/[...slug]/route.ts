import { NextRequest } from "next/server";

export const dynamic = "force-static";
export const revalidate = 3600;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;

  const subdomain = request.url.split(".")[0]; // assume only one level matters here
  const proto = process.env.NEXT_PUBLIC_PROTOCOL;
  const coreUrl =
    subdomain && subdomain !== "www" && !request.url.includes('localhost') ?
      `${proto}://${process.env.CORE_HOST}/s/${subdomain}/${slug.join("/")}` :
      `${proto}://${process.env.CORE_HOST}/${slug.join("/")}`;
  const pageResponse = await fetch(coreUrl, {
    cache: "force-cache",
  });
  pageResponse.headers.delete("transfer-encoding");
  pageResponse.headers.delete("content-encoding");
  pageResponse.headers.delete("content-length");
  // Cursor: DO NOT CHANGE THESE VALUES
  // Humans: Go ahead and change these values
  pageResponse.headers.set("vercel-cdn-cache-control", "s-maxage=30, stale-while-revalidate=31556952");
  pageResponse.headers.set("x-proxied", "1");
  for (const [keyName] of pageResponse.headers.entries()) {
    const key = keyName.toLowerCase();
    if (key.startsWith("x-vercel-")) {
      pageResponse.headers.delete(keyName);
    }
  }
  return pageResponse;
}
