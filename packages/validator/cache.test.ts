import { requestPage, sleep } from "./util";

describe('Cache', () => {
  test('should serve homepage from cache', async () => {
    const response = await requestPage('https://www.high-performance-platform.com');
    expect(response.status).toBe(200);

    const h = new Headers(response.headers);
    expect(h.get('cdn-cache-control')).toBe('s-maxage=120, stale-while-revalidate=31556952');

    if (h.get('Age') && parseInt(h.get('Age')!) < 120) {
      expect(h.get('x-vercel-cache')).toBe('HIT');
    } else {
      expect(h.get('x-vercel-cache')).not.toBe('HIT');

      await sleep(3000);

      const response2 = await requestPage('https://www.high-performance-platform.com');
      expect(response2.status).toBe(200);

      const h2 = new Headers(response2.headers);
      expect(h2.get('x-vercel-cache')).toBe('HIT');
    }
  });

  test('should serve subdomain homepage from cache', async () => {
    const response = await requestPage('https://cool.high-performance-platform.com');
    expect(response.status).toBe(200);

    const h = new Headers(response.headers);
    expect(h.get('cdn-cache-control')).toBe('s-maxage=120, stale-while-revalidate=31556952');

    if (h.get('Age') && parseInt(h.get('Age')!) < 120) {
      expect(['HIT', 'STALE']).toContain(h.get('x-vercel-cache'));
    } else {
      expect(h.get('x-vercel-cache')).not.toBe('HIT');

      await sleep(3000);

      const response2 = await requestPage('https://cool.high-performance-platform.com');
      expect(response2.status).toBe(200);

      const h2 = new Headers(response2.headers);
      expect(h2.get('x-vercel-cache')).toBe('HIT');
    }
  });

  test('should not serve incorrect subdomain page from cache', async () => {
    const response = await requestPage('https://cool.high-performance-platform.com');
    expect(response.status).toBe(200);

    const html = await response.text();
    expect(html).toContain('😎');
    expect(html).toContain('cool');

    // Serving a different subdomain was a failure mode we fixed previously
    const response2 = await fetch('https://test.high-performance-platform.com');
    expect(response.status).toBe(200);

    const html2 = await response2.text();
    expect(html2).not.toContain('😎');
    expect(html2).not.toContain('cool');
  });
});
