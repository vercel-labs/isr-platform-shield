import { NextRequest } from "next/server";

export const dynamic = "force-static";
export const revalidate = 3600;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;

  const subdomain = request.headers.get("host")?.split(".")[0]; // assume only one level matters here
  const coreUrl = `${process.env.NEXT_PUBLIC_PROTOCOL}://${subdomain}.${process.env.CORE_HOST}/${slug.join("/")}`
  const pageResponse = await fetch(coreUrl, {
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
