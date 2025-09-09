import { type NextRequest, NextResponse } from "next/server";
import { trace } from '@opentelemetry/api';


function extractSubdomain(request: NextRequest): string | null {
  const url = request.url;
  const host = request.headers.get("host") || "";
  const hostname = host.split(":")[0];

  // Local development environment
  if (url.includes("localhost") || url.includes("127.0.0.1")) {
    // Try to extract subdomain from the full URL
    const fullUrlMatch = url.match(/http:\/\/([^.]+)\.localhost/);
    if (fullUrlMatch?.[1]) {
      return fullUrlMatch[1];
    }

    // Fallback to host header approach
    if (hostname.includes(".localhost")) {
      return hostname.split(".")[0];
    }

    return null;
  }

  // Production environment
  const rootDomainFormatted = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.split(":")[0] || "pzona.lol";

  // Handle preview deployment URLs (tenant---branch-name.vercel.app)
  if (hostname.includes("---") && hostname.endsWith(".vercel.app")) {
    const parts = hostname.split("---");
    return parts.length > 0 ? parts[0] : null;
  }

  // Regular subdomain detection
  const isSubdomain =
    hostname !== rootDomainFormatted &&
    hostname !== `www.${rootDomainFormatted}` &&
    hostname.endsWith(`.${rootDomainFormatted}`);

  return isSubdomain ? hostname.replace(`.${rootDomainFormatted}`, "") : null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const subdomain = await trace.getTracer('cache-layer').startActiveSpan('extractSubdomain', async (span) => {
    try {
      return extractSubdomain(request);
    } finally {
      span.end();
    }
  });

  if (subdomain) {
    return await trace.getTracer('cache-layer').startActiveSpan('subdomain_routing', async (span) => {
      try {
        // Block access to admin page from subdomains
        if (pathname.startsWith("/admin")) {
          return NextResponse.redirect(new URL("/", `${process.env.NEXT_PUBLIC_PROTOCOL}://${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`));
        }

        // Pass /_next static assets to the core app
        if (pathname.startsWith("/_next")) {
          return NextResponse.next();
        }

        return NextResponse.rewrite(
          new URL(`/s/${subdomain}${pathname}`, `${process.env.NEXT_PUBLIC_PROTOCOL}://${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`),
        );

      } finally {
        span.end();
      }
    });
  }



  // Allow normal access for other root domain requests
  return NextResponse.next();
}

// export const config = {
//   matcher: [
//     "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
//   ],
// };