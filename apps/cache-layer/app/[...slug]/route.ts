import { NextRequest } from "next/server";

export const dynamic = "force-static";
export const revalidate = 3600;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;

  // Handle root domain requests (no slug means root page)
  if (slug.length === 0) {
    const pageResponse = await fetch(`${process.env.NEXT_PUBLIC_PROTOCOL}://${process.env.CORE_HOST}/`, {
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

  // Handle other requests
  const pageResponse = await fetch(`${process.env.NEXT_PUBLIC_PROTOCOL}://${process.env.CORE_HOST}/${slug.join("/")}`, {
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
