import { NextRequest } from "next/server";
import { extractSubdomain } from "@/lib/util";

export const dynamic = "force-static";
export const revalidate = 300; // Easier to test

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  try {
    const { slug } = await params;
    const subdomain = extractSubdomain(request);
    const host = subdomain ? `${subdomain}.${process.env.CORE_HOST}` : process.env.CORE_HOST;

    const pageResponse = await fetch(`${process.env.NEXT_PUBLIC_PROTOCOL}://${host}/${slug.join("/")}`, {
      cache: "force-cache",
    });
    console.log("pageResponse", pageResponse);
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
  } catch (error) {
    console.error("error", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
