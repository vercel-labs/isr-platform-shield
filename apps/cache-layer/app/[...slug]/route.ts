import { NextRequest } from "next/server";
import { protocol } from "@/lib/utils";

export const dynamic = "force-static";
export const revalidate = 3600;

const getCoreUrl = () => {
  const coreHost = process.env.CORE_HOST || "localhost:3001";
  return `${protocol}://${coreHost}`;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
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
