import { cookies, headers } from "next/headers";

export const dynamic = "force-dynamic";

interface DebugPageProps {
	params: Promise<{ subdomain: string }>;
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DebugPage({
	params,
	searchParams,
}: DebugPageProps) {
	const { subdomain } = await params;
	const headersList = await headers();
	const cookieStore = await cookies();
	const search = await searchParams;

	// Convert headers to an object
	const headersObj: Record<string, string> = {};
	headersList.forEach((value, key) => {
		headersObj[key] = value;
	});

	// Convert cookies to an object
	const cookiesObj: Record<string, string> = {};
	cookieStore.getAll().forEach((cookie) => {
		cookiesObj[cookie.name] = cookie.value;
	});

	const debugData = {
		timestamp: new Date().toISOString(),
		subdomain,
		searchParams: search,
		headers: headersObj,
		cookies: cookiesObj,
		url: {
			host: headersObj.host,
			referer: headersObj.referer,
			origin: headersObj.origin,
		},
		request: {
			method: headersObj["x-http-method"] || "GET",
			userAgent: headersObj["user-agent"],
			ip: headersObj["x-forwarded-for"] || headersObj["x-real-ip"] || "unknown",
			forwardedProto: headersObj["x-forwarded-proto"],
			forwardedHost: headersObj["x-forwarded-host"],
		},
		vercel: {
			deploymentId: headersObj["x-vercel-deployment-id"],
			deploymentUrl: headersObj["x-vercel-deployment-url"],
			id: headersObj["x-vercel-id"],
			proxyBypass: headersObj["x-vercel-proxy-bypass"],
			sc: headersObj["x-vercel-sc"],
			skr: headersObj["x-vercel-skr"],
		},
	};

	return (
		<div
			style={{
				minHeight: "100vh",
				backgroundColor: "#1e1e1e",
				color: "#d4d4d4",
				padding: "2rem",
				fontFamily: "monospace",
			}}
		>
			<div style={{ maxWidth: "1200px", margin: "0 auto" }}>
				<h1
					style={{
						fontSize: "2rem",
						fontWeight: "bold",
						marginBottom: "1rem",
						color: "#ffffff",
					}}
				>
					Debug Information
				</h1>
				<p style={{ marginBottom: "2rem", color: "#888" }}>
					Request metadata for subdomain: <strong>{subdomain}</strong>
				</p>

				<pre
					style={{
						backgroundColor: "#252526",
						border: "1px solid #3e3e42",
						borderRadius: "6px",
						padding: "1.5rem",
						overflowX: "auto",
						fontSize: "0.875rem",
						lineHeight: "1.5",
					}}
				>
					<code>{JSON.stringify(debugData, null, 2)}</code>
				</pre>
			</div>
		</div>
	);
}
