import { config, urls } from "@platform/config";
import { requestPage } from "./util";

describe("Routing", () => {
	test("should load homepage", async () => {
		const response = await requestPage(urls.homepage);
		expect(response.status).toBe(200);

		const html = await response.text();
		expect(html).toContain("$validator_home_page$");
	});

	test("should load subdomain page", async () => {
		const response = await requestPage(urls.primarySubdomain);
		expect(response.status).toBe(200);

		const html = await response.text();
		expect(html).toContain("$validator_subdomain_page$");
		expect(html).toContain("😎");
		expect(html).toContain(config.subdomains.primary);
	});

	test("should load post page", async () => {
		const response = await requestPage(urls.primaryPost);
		expect(response.status).toBe(200);

		const html = await response.text();
		expect(html).toContain("$validator_post_page$");
	});

	test("should load admin page", async () => {
		const response = await requestPage(urls.admin);
		expect(response.status).toBe(200);

		const html = await response.text();
		expect(html).toContain("$validator_admin_page$");
	});

	test("should show 404 page for non-existent subdomain", async () => {
		const response = await requestPage(urls.nonexistentSubdomain);
		const html = await response.text();
		expect(html.toLowerCase()).toContain("not found");
	});

	test("should show 404 page for non-existent blog post ID", async () => {
		const response = await requestPage(urls.altPrimaryMissingPost);
		const html = await response.text();
		expect(html.toLowerCase()).toContain("not found");
	});

	test("should show 404 page for invalid blog post ID format", async () => {
		const response = await requestPage(urls.altPrimaryInvalidPost);
		const html = await response.text();
		expect(html.toLowerCase()).toContain("not found");
	});
});
