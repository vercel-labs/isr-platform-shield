const isProd = process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview';
const protocol = isProd ? 'https' : 'http';

export const config = {
  api: {
    url: isProd ? 'https://api.pzvtest314.vercel.app' : 'http://localhost:3002',
  },
  cacheLayer: {
    url: isProd ? 'https://pzona.lol' : 'http://localhost:3000',
  },
  redis: {
    url: process.env.REDIS_URL || '',
    restApiUrl: process.env.KV_REST_API_URL || '',
    restApiToken: process.env.KV_REST_API_TOKEN || '',
  },
  protocol,
  rootDomain: isProd ? 'pzona.lol' : 'localhost:3000',
};

// Simple getters
export const getApiUrl = () => config.api.url;
export const getCacheLayerUrl = () => config.cacheLayer.url;
export const getProtocol = () => config.protocol;
export const getRootDomain = () => config.rootDomain;
