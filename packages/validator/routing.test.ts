import { requestPage } from "./util";

describe('Routing', () => {
  test('should load homepage', async () => {
    const response = await requestPage('https://www.high-performance-platform.com');
    expect(response.status).toBe(200);

    const html = await response.text();
    expect(html).toContain('$validator_home_page$');
  });

  test('should load subdomain page', async () => {
    const response = await requestPage('https://cool.high-performance-platform.com');
    expect(response.status).toBe(200);

    const html = await response.text();
    expect(html).toContain('$validator_subdomain_page$');
    expect(html).toContain('😎');
    expect(html).toContain('cool');
  });

  test('should load post page', async () => {
    const response = await requestPage('https://cool.high-performance-platform.com/1');
    expect(response.status).toBe(200);

    const html = await response.text();
    expect(html).toContain('$validator_post_page$');
  });

  test('should load admin page', async () => {
    const response = await requestPage('https://www.high-performance-platform.com/admin');
    expect(response.status).toBe(200);

    const html = await response.text();
    expect(html).toContain('$validator_admin_page$');
  });

  test('should show 404 page for non-existent subdomain', async () => {
    const response = await requestPage('https://nonexistent-xyz-12345.pzona.lol');
    const html = await response.text();
    expect(html.toLowerCase()).toContain('not found');
  });

  test('should show 404 page for non-existent blog post ID', async () => {
    const response = await requestPage('https://cool.pzona.lol/99999');
    const html = await response.text();
    expect(html.toLowerCase()).toContain('not found');
  });

  test('should show 404 page for invalid blog post ID format', async () => {
    const response = await requestPage('https://cool.pzona.lol/abc');
    const html = await response.text();
    expect(html.toLowerCase()).toContain('not found');
  });
});