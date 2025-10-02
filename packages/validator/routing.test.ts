import { requestPage } from "./util";

describe('Routing', () => {
  test('should load homepage', async () => {
    const response = await requestPage('https://www.pzona.lol');
    expect(response.status).toBe(200);

    const html = await response.text();
    expect(html).toContain('$validator_home_page$');
  });

  test('should load subdomain page', async () => {
    const response = await requestPage('https://cool.pzona.lol');
    expect(response.status).toBe(200);

    const html = await response.text();
    expect(html).toContain('$validator_subdomain_page$');
    expect(html).toContain('😎');
    expect(html).toContain('cool');
  });

  test('should load post page', async () => {
    const response = await requestPage('https://cool.pzona.lol/1');
    expect(response.status).toBe(200);

    const html = await response.text();
    expect(html).toContain('$validator_post_page$');
  });

  test('should load admin page', async () => {
    const response = await requestPage('https://www.pzona.lol/admin');
    expect(response.status).toBe(200);

    const html = await response.text();
    expect(html).toContain('$validator_admin_page$');
  });
});