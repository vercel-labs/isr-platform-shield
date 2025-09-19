import { type NextRequest, NextResponse } from 'next/server';

function extractSubdomain(url: string, host: string): string | null {
  // Clean hostname by removing port
  const hostname = host.split(':')[0];

  console.log("🔍 Subdomain detection debug:");
  console.log("  - Original URL:", url);
  console.log("  - Original Host:", host);
  console.log("  - Cleaned hostname:", hostname);

  // Local development environment
  if (url.includes('localhost') || url.includes('127.0.0.1') || hostname.includes('localhost')) {
    console.log("  - Environment: Local development");

    // Try to extract subdomain from the full URL first
    const fullUrlMatch = url.match(/http:\/\/([^.]+)\.localhost/);
    if (fullUrlMatch && fullUrlMatch[1]) {
      console.log("  - Found subdomain from URL:", fullUrlMatch[1]);
      return fullUrlMatch[1];
    }

    // Fallback to host header approach
    if (hostname.includes('.localhost')) {
      const subdomain = hostname.split('.')[0];
      console.log("  - Found subdomain from host:", subdomain);
      // Ensure we don't return empty strings
      return subdomain && subdomain.trim() ? subdomain : null;
    }

    // Check if it's just localhost without subdomain
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      console.log("  - Root localhost, no subdomain");
      return null;
    }

    console.log("  - No subdomain found in localhost");
    return null;
  }

  // Production environment
  const rootDomainFormatted = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.split(':')[0];
  console.log("  - Environment: Production");
  console.log("  - Root domain:", rootDomainFormatted);

  if (!rootDomainFormatted) {
    console.log("  - No root domain configured");
    return null;
  }

  // Handle preview deployment URLs (tenant---branch-name.vercel.app)
  if (hostname.includes('---') && hostname.endsWith('.vercel.app')) {
    const parts = hostname.split('---');
    const subdomain = parts.length > 0 ? parts[0] : null;
    console.log("  - Vercel preview deployment subdomain:", subdomain);
    return subdomain;
  }

  // Regular subdomain detection
  const isSubdomain =
    hostname !== rootDomainFormatted &&
    hostname !== `www.${rootDomainFormatted}` &&
    hostname.endsWith(`.${rootDomainFormatted}`);

  console.log("  - Is subdomain check:");
  console.log("    - hostname !== rootDomainFormatted:", hostname !== rootDomainFormatted);
  console.log("    - hostname !== www.rootDomainFormatted:", hostname !== `www.${rootDomainFormatted}`);
  console.log("    - hostname ends with rootDomainFormatted:", hostname.endsWith(`.${rootDomainFormatted}`));
  console.log("    - Final isSubdomain:", isSubdomain);

  if (isSubdomain) {
    const subdomain = hostname.replace(`.${rootDomainFormatted}`, '');
    console.log("  - Extracted subdomain:", subdomain);
    // Ensure we don't return empty strings or just dots
    return subdomain && subdomain.trim() ? subdomain : null;
  }

  console.log("  - No subdomain detected");
  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Debug all relevant headers
  console.log("🌐 Middleware debug:");
  console.log("  - Request URL:", request.url);
  console.log("  - Pathname:", pathname);
  console.log("  - Host header:", request.headers.get('host'));
  console.log("  - X-Original-URL header:", request.headers.get('x-original-url'));
  console.log("  - X-Original-Host header:", request.headers.get('x-original-host'));
  console.log("  - User-Agent:", request.headers.get('user-agent'));
  console.log("  - Sec-Fetch-Mode:", request.headers.get('Sec-Fetch-Mode'));

  // Read the original url from the header, fallback to actual request for separation of testing
  const url = request.headers.get('x-original-url') || request.url;
  const host = request.headers.get('x-original-host') || request.headers.get('host') || '';

  console.log("  - Using URL for subdomain detection:", url);
  console.log("  - Using Host for subdomain detection:", host);

  const subdomain = extractSubdomain(url, host);
  console.log("  - Final subdomain result:", subdomain);

  if (subdomain && subdomain !== 'www') {
    console.log("✅ Subdomain detected:", subdomain);

    // Skip non-navigation requests (like API calls, assets, etc.)
    const secFetchMode = request.headers.get('Sec-Fetch-Mode');
    if (secFetchMode && secFetchMode !== 'navigate') {
      console.log("  - Skipping non-navigation request (Sec-Fetch-Mode:", secFetchMode, ")");
      return NextResponse.next();
    }

    // Block access to admin page from subdomains
    if (pathname.startsWith('/admin')) {
      console.log("  - Blocking admin access from subdomain, redirecting to root");
      return NextResponse.redirect(new URL('/', request.url));
    }

    // For the root path on a subdomain, rewrite to the subdomain page
    if (pathname === '/') {
      console.log("  - Root path on subdomain, rewriting to /s/" + subdomain);
      return NextResponse.rewrite(new URL(`/s/${subdomain}`, request.url));
    }

    // For all other paths on a subdomain, rewrite to that path
    console.log("  - Rewriting to /s/" + subdomain + pathname);
    return NextResponse.rewrite(new URL(`/s/${subdomain}${pathname}`, request.url));
  }

  console.log("ℹ️  No subdomain detected, allowing normal access");
  // On the root domain, allow normal access
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except for:
     * 1. /api routes
     * 2. /_next (Next.js internals)
     * 3. all root files inside /public (e.g. /favicon.ico)
     */
    '/((?!api|_next|[\\w-]+\\.\\w+).*)'
  ]
};