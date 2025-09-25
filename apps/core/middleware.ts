import { type NextRequest, NextResponse } from "next/server";
import { extractSubdomain } from "./lib/subdomains";

export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;
	const subdomain = extractSubdomain(request);

	const headers = new Headers(request.headers);
	console.log("headers", headers);

	if (subdomain && subdomain !== "www") {
		headers.set('x-vercel-cache-tag', subdomain);

		// Block access to admin page from subdomains
		if (pathname.startsWith("/admin")) {
			return NextResponse.redirect(new URL("/", request.url));
		}

		// For the root path on a subdomain, rewrite to the subdomain page
		if (pathname === "/") {
			return NextResponse.rewrite(new URL(`/s/${subdomain}`, request.url));
		}

		// For all other paths on a subdomain, rewrite to that path
		return NextResponse.rewrite(
			new URL(`/s/${subdomain}${pathname}`, request.url),
		);
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
		"/((?!api|_next|[\\w-]+\\.\\w+).*)",
	],
};
