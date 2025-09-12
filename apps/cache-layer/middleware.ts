import { type NextRequest, NextResponse } from "next/server";
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('cache-layer');

function extractSubdomain(request: NextRequest): string | null {
  return tracer.startActiveSpan('extractSubdomain', (span) => {
    try {
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
      const rootDomainFormatted = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.split(":")[0];

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

    } finally {
      span.end();
    }
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  console.log('headers', request.headers);
  const subdomain = extractSubdomain(request);

  if (subdomain) {
    // Block access to admin page from subdomains
    if (pathname.startsWith("/admin")) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (pathname === '/') {
      return NextResponse.rewrite(`/s/${subdomain}`);
    }

    // Transform to url pattern: /s/subdomain/pathname
    return NextResponse.rewrite(`/s/${subdomain}${pathname}`);
  }

  // For root domain requests, proxy to core app
  // This illustrates a dynamic route in addition to the ISR posts
  const coreUrl = `${process.env.NEXT_PUBLIC_PROTOCOL}://${process.env.CORE_HOST}${pathname}`;
  return NextResponse.rewrite(new URL(coreUrl));
}

export const config = {
  runtime: "nodejs",
  matcher: [
    '/((?!api|_next|[\\w-]+\\.\\w+).*)'
  ]
};
