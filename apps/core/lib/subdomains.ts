import { redis } from '@/lib/redis';
import { trace } from '@opentelemetry/api';
import { NextRequest } from 'next/server';

export function extractSubdomain(request: NextRequest): string | null {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const hostname = host.split(':')[0];

  // Local development environment
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    // Try to extract subdomain from the full URL
    const fullUrlMatch = host.match(/([^.]+)\.localhost/);
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

  return isSubdomain ? hostname.replace(`.${rootDomainFormatted}`, '') : null;
}

export function isValidIcon(str: string) {
  if (str.length > 10) {
    return false;
  }

  try {
    // Primary validation: Check if the string contains at least one emoji character
    // This regex pattern matches most emoji Unicode ranges
    const emojiPattern = /[\p{Emoji}]/u;
    if (emojiPattern.test(str)) {
      return true;
    }
  } catch (error) {
    // If the regex fails (e.g., in environments that don't support Unicode property escapes),
    // fall back to a simpler validation
  }

  // Fallback validation: Check if the string is within a reasonable length
  // This is less secure but better than no validation
  return str.length >= 1 && str.length <= 10;
}

type SubdomainData = {
  emoji: string;
  createdAt: number;
};

export async function getSubdomainData(subdomain: string) {
  return await trace.getTracer('core').startActiveSpan('getSubdomainData', async (span) => {
    try {
      const sanitizedSubdomain = subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '');
      const data = await redis.get<SubdomainData>(
        `subdomain:${sanitizedSubdomain}`
      );
      return data
    } finally {
      span.end();
    }
  });

}

export async function getAllSubdomains() {
  return await trace.getTracer('core').startActiveSpan('getAllSubdomains', async (span) => {
    try {
      const keys = await redis.keys('subdomain:*');

      if (!keys.length) {
        return [];
      }
      const values = await redis.mget<SubdomainData[]>(...keys);
      return keys.map((key, index) => {
        const subdomain = key.replace('subdomain:', '');
        const data = values[index];

        return {
          subdomain,
          emoji: data?.emoji || '❓',
          createdAt: data?.createdAt || Date.now()
        };
      });
    } finally {
      span.end();
    }
  });


}
