const globalEnv = {
  isProd: () => !!process.env.VERCEL,
  redis: {
    url: process.env.REDIS_URL || '',
    restApiUrl: process.env.KV_REST_API_URL || '',
    restApiToken: process.env.KV_REST_API_TOKEN || '',
  },
};

const protocol = globalEnv.isProd() ? 'https' : 'http';

export const config = {
  api: {
    url: globalEnv.isProd() ? 'https://api.pzvtest314.vercel.app' : 'http://localhost:3002',
  },
  cacheLayer: {
    url: globalEnv.isProd() ? 'https://pzona.lol' : 'http://localhost:3000',
  },
  core: {
    url: globalEnv.isProd() ? 'https://core.pzvtest314.vercel.app' : 'http://localhost:3001',
  },
  redis: globalEnv.redis,
  protocol,
  rootDomain: globalEnv.isProd() ? 'pzona.lol' : 'localhost:3000',
};

// Simple getters
export const getApiUrl = () => config.api.url;
export const getCacheLayerUrl = () => config.cacheLayer.url;
export const getCoreUrl = () => config.core.url;
export const getProtocol = () => config.protocol;
export const getRootDomain = () => config.rootDomain;
