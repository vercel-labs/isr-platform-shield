import { type NextRequest, NextResponse } from 'next/server';
import { extractSubdomain } from './lib/subdomains';

export async function middleware(request: NextRequest) {
  console.log('middleware', request);
  console.log('request.url', request.url);
  console.log('request.headers', request.headers);
  console.log('request.nextUrl', request.nextUrl);
  console.log('request.nextUrl.pathname', request.nextUrl.pathname);
  console.log('request.nextUrl.search', request.nextUrl.search);
  console.log('request.nextUrl.hash', request.nextUrl.hash);
  console.log('request.nextUrl.host', request.nextUrl.host);
  console.log('request.nextUrl.hostname', request.nextUrl.hostname);
  console.log('request.nextUrl.port', request.nextUrl.port);
  console.log('request.nextUrl.protocol', request.nextUrl.protocol);
  // const { pathname } = request.nextUrl;
  // const subdomain = extractSubdomain(request);

  // const headers = new Headers(request.headers);
  // console.log("headers", headers);

  // if (subdomain && subdomain !== "www") {
  // 	// headers.set('vercel-cache-tag', subdomain);

  // 	// Block access to admin page from subdomains
  // 	if (pathname.startsWith("/admin")) {
  // 		return NextResponse.redirect(new URL("/", request.url));
  // 	}

  // 	// For the root path on a subdomain, rewrite to the subdomain page
  // 	if (pathname === "/") {
  // 		return NextResponse.rewrite(new URL(`/s/${subdomain}`, request.url));
  // 	}

  // 	// For all other paths on a subdomain, rewrite to that path
  // 	return NextResponse.rewrite(
  // 		new URL(`/s/${subdomain}${pathname}`, request.url),
  // 	);
  // }

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
    '/((?!api|_next|[\\w-]+\\.\\w+).*)',
  ],
};
