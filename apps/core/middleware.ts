import { type NextRequest, NextResponse } from 'next/server';

function extractSubdomain(url: string, host: string): string | null {
  // Clean hostname by removing port
  const hostname = host.split(':')[0];


  // Local development environment
  if (url.includes('localhost') || url.includes('127.0.0.1') || hostname.includes('localhost')) {

    // Try to extract subdomain from the full URL first
    const fullUrlMatch = url.match(/http:\/\/([^.]+)\.localhost/);
    if (fullUrlMatch && fullUrlMatch[1]) {
      return fullUrlMatch[1];
    }

    // Fallback to host header approach
    if (hostname.includes('.localhost')) {
      const subdomain = hostname.split('.')[0];
      // Ensure we don't return empty strings
      return subdomain && subdomain.trim() ? subdomain : null;
    }

    // Check if it's just localhost without subdomain
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return null;
    }

    return null;
  }

  // Production environment
  const rootDomainFormatted = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.split(':')[0];

  if (!rootDomainFormatted) {
    return null;
  }

  // Handle preview deployment URLs (tenant---branch-name.vercel.app)
  if (hostname.includes('---') && hostname.endsWith('.vercel.app')) {
    const parts = hostname.split('---');
    const subdomain = parts.length > 0 ? parts[0] : null;
    return subdomain;
  }

  // Regular subdomain detection
  const isSubdomain =
    hostname !== rootDomainFormatted &&
    hostname !== `www.${rootDomainFormatted}` &&
    hostname.endsWith(`.${rootDomainFormatted}`);


  if (isSubdomain) {
    const subdomain = hostname.replace(`.${rootDomainFormatted}`, '');
    // Ensure we don't return empty strings or just dots
    return subdomain && subdomain.trim() ? subdomain : null;
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;


  // Read the original url from the header, fallback to actual request for separation of testing
  const url = request.headers.get('x-original-url') || request.url;
  const host = request.headers.get('x-original-host') || request.headers.get('host') || '';


  const subdomain = extractSubdomain(url, host);

  if (subdomain && subdomain !== 'www') {

    // Skip non-navigation requests (like API calls, assets, etc.)
    const secFetchMode = request.headers.get('Sec-Fetch-Mode');
    if (secFetchMode && secFetchMode !== 'navigate') {
      return NextResponse.next();
    }

    // Block access to admin page from subdomains
    if (pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // For the root path on a subdomain, rewrite to the subdomain page
    if (pathname === '/') {
      return NextResponse.rewrite(new URL(`/s/${subdomain}`, request.url));
    }

    // For all other paths on a subdomain, rewrite to that path
    return NextResponse.rewrite(new URL(`/s/${subdomain}${pathname}`, request.url));
  }

  // On the root domain, allow normal access
  return NextResponse.next();
}

// export const config = {
//   matcher: [
//     /*
//      * Match all paths except for:
//      * 1. /api routes
//      * 2. /_next (Next.js internals)
//      * 3. all root files inside /public (e.g. /favicon.ico)
//      */
//     '/((?!api|_next|[\\w-]+\\.\\w+).*)'
//   ]
// };