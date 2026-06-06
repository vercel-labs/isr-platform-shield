import { config, urls } from "@platform/config";
import { requestPage, sleep } from "./util";

describe("Cache", () => {
	test("should serve homepage from cache", async () => {
		const response = await requestPage(urls.homepage);
		expect(response.status).toBe(200);

		const h = new Headers(response.headers);
		expect(h.get("cdn-cache-control")).toBe(
			"s-maxage=120, stale-while-revalidate=31556952",
		);

		const age = h.get("Age");
		if (age && Number.parseInt(age) < 120) {
			expect(h.get("x-vercel-cache")).toBe("HIT");
		} else if (age && Number.parseInt(age) >= 120) {
			expect(h.get("x-vercel-cache")).toBe("STALE");

			await sleep(3000);

			const response2 = await requestPage(urls.altWww);
			expect(response2.status).toBe(200);

			const h2 = new Headers(response2.headers);
			expect(h2.get("x-vercel-cache")).toBe("HIT");
		} else {
			expect(h.get("x-vercel-cache")).toBe("MISS");

			await sleep(3000);

			const response2 = await requestPage(urls.homepage);
			expect(response2.status).toBe(200);

			const h2 = new Headers(response2.headers);
			expect(h2.get("x-vercel-cache")).toBe("HIT");
		}
	});

	test("should serve subdomain homepage from cache", async () => {
		const response = await requestPage(urls.primarySubdomain);
		expect(response.status).toBe(200);

		const h = new Headers(response.headers);
		expect(h.get("cdn-cache-control")).toBe(
			"s-maxage=120, stale-while-revalidate=31556952",
		);

		const age = h.get("Age");
		if (age && Number.parseInt(age) < 120) {
			expect(["HIT", "STALE"]).toContain(h.get("x-vercel-cache"));
		} else if (age && Number.parseInt(age) >= 120) {
			expect(h.get("x-vercel-cache")).toBe("STALE");

			await sleep(3000);

			const response2 = await requestPage(urls.primarySubdomain);
			expect(response2.status).toBe(200);

			const h2 = new Headers(response2.headers);
			expect(h2.get("x-vercel-cache")).toBe("HIT");
		} else {
			expect(h.get("x-vercel-cache")).toBe("MISS");

			await sleep(3000);

			const response2 = await requestPage(urls.altPrimarySubdomain);
			expect(response2.status).toBe(200);

			const h2 = new Headers(response2.headers);
			expect(h2.get("x-vercel-cache")).toBe("HIT");
		}
	});

	test("should serve blog post page from cache", async () => {
		const response = await requestPage(urls.altPrimaryPost);
		expect(response.status).toBe(200);

		const h = new Headers(response.headers);
		expect(h.get("cdn-cache-control")).toBe(
			"s-maxage=120, stale-while-revalidate=31556952",
		);

		const age = h.get("Age");
		if (age && Number.parseInt(age) < 120) {
			expect(["HIT", "STALE"]).toContain(h.get("x-vercel-cache"));
		} else if (age && Number.parseInt(age) >= 120) {
			expect(h.get("x-vercel-cache")).toBe("STALE");

			await sleep(3000);

			const response2 = await requestPage(urls.altPrimaryPost);
			expect(response2.status).toBe(200);

			const h2 = new Headers(response2.headers);
			expect(h2.get("x-vercel-cache")).toBe("HIT");
		} else {
			expect(h.get("x-vercel-cache")).toBe("MISS");

			await sleep(3000);

			const response2 = await requestPage(urls.altPrimaryPost);
			expect(response2.status).toBe(200);

			const h2 = new Headers(response2.headers);
			expect(h2.get("x-vercel-cache")).toBe("HIT");
		}
	});

	test("should not serve incorrect subdomain page from cache", async () => {
		const response = await requestPage(urls.primarySubdomain);
		expect(response.status).toBe(200);

		const html = await response.text();
		expect(html).toContain("😎");
		expect(html).toContain(config.subdomains.primary);

		const response2 = await fetch(urls.secondarySubdomain);
		expect(response.status).toBe(200);

		const html2 = await response2.text();
		expect(html2).not.toContain("😎");
		expect(html2).not.toContain("cool");
	});
});
