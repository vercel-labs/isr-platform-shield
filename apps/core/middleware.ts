import { type NextRequest, NextResponse } from 'next/server';

function extractSubdomain(url: string, host: string): string | null {
  const hostname = host.split(':')[0];

  // Local development environment
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    // Try to extract subdomain from the full URL
    const fullUrlMatch = url.match(/http:\/\/([^.]+)\.localhost/);
    if (fullUrlMatch && fullUrlMatch[1]) {
      return fullUrlMatch[1];
    }

    // Fallback to host header approach
    if (hostname.includes('.localhost')) {
      return hostname.split('.')[0];
    }

    return null;
  }

  // Production environment
  const rootDomainFormatted = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.split(':')[0];
  console.log("rootDomainFormatted", rootDomainFormatted);

  // Handle preview deployment URLs (tenant---branch-name.vercel.app)
  if (hostname.includes('---') && hostname.endsWith('.vercel.app')) {
    const parts = hostname.split('---');
    return parts.length > 0 ? parts[0] : null;
  }

  // Regular subdomain detection
  const isSubdomain =
    hostname !== rootDomainFormatted &&
    hostname !== `www.${rootDomainFormatted}` &&
    hostname.endsWith(`.${rootDomainFormatted}`);

  console.log("hostname", hostname);
  console.log("hostname !== rootDomainFormatted", hostname !== rootDomainFormatted);
  console.log("hostname !== www.rootDomainFormatted", hostname !== `www.${rootDomainFormatted}`);
  console.log("hostname ends with rootDomainFormatted", hostname.endsWith(`.${rootDomainFormatted}`));
  console.log("isSubdomain?", isSubdomain);

  return isSubdomain ? hostname.replace(`.${rootDomainFormatted}`, '') : null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;



  // Read the original url from the header, fallback to actual request for separation of testing
  const url = request.headers.get('x-original-url') || request.url;
  const host = request.headers.get('x-original-host') || request.headers.get('host') || '';
  const subdomain = extractSubdomain(url, host);
  console.log("subdomain", subdomain);

  if (subdomain && subdomain !== 'www') {
    console.log("sec-fetch-mode", request.headers.get('Sec-Fetch-Mode'));
    // Skip non-nav
    const sefFetchMode = request.headers.get('Sec-Fetch-Mode');
    if (sefFetchMode !== 'navigate') {
      return NextResponse.next();
    }

    console.log("pathname", pathname);
    console.log("is admin?");
    // Block access to admin page from subdomains
    if (pathname.startsWith('/admin')) {
      console.log("yes");
      return NextResponse.redirect(new URL('/', request.url));
    }
    console.log("no");
    console.log("is root path?");

    // For the root path on a subdomain, rewrite to the subdomain page
    if (pathname === '/') {
      console.log("yes");
      return NextResponse.rewrite(new URL(`/s/${subdomain}`, request.url));
    }
    console.log("no");

    console.log("rewriting to", `/s/${subdomain}${pathname}`);
    // For all other paths on a subdomain, rewrite to that path
    return NextResponse.rewrite(new URL(`/s/${subdomain}${pathname}`, request.url));
  }


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