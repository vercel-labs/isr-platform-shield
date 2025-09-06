import { AppConfig, EnvironmentConfig } from './types';

// Development configuration
const devConfig: EnvironmentConfig = {
  apiHost: 'localhost:3002',
  cacheLayerHost: 'localhost:3000',
  redisUrl: process.env.REDIS_URL || '',
  redisRestApiUrl: process.env.KV_REST_API_URL || '',
  redisRestApiToken: process.env.KV_REST_API_TOKEN || '',
  redisRestApiReadOnlyToken: process.env.KV_REST_API_READ_ONLY_TOKEN || '',
};

// Production configuration
const prodConfig: EnvironmentConfig = {
  apiHost: 'api.pzvtest314.vercel.app',
  cacheLayerHost: 'pzona.lol',
  redisUrl: process.env.REDIS_URL || '',
  redisRestApiUrl: process.env.KV_REST_API_URL || '',
  redisRestApiToken: process.env.KV_REST_API_TOKEN || '',
  redisRestApiReadOnlyToken: process.env.KV_REST_API_READ_ONLY_TOKEN || '',
};

function createAppConfig(envConfig: EnvironmentConfig, isProduction: boolean): AppConfig {
  const protocol = isProduction ? 'https' : 'http';
  const rootDomain = isProduction ? 'pzona.lol' : 'localhost:3000';
  
  return {
    api: {
      host: envConfig.apiHost,
      url: `${protocol}://${envConfig.apiHost}`,
    },
    cacheLayer: {
      host: envConfig.cacheLayerHost,
      url: `${protocol}://${envConfig.cacheLayerHost}`,
    },
    redis: {
      url: envConfig.redisUrl,
      restApiUrl: envConfig.redisRestApiUrl,
      restApiToken: envConfig.redisRestApiToken,
      restApiReadOnlyToken: envConfig.redisRestApiReadOnlyToken,
    },
    environment: isProduction ? 'production' : 'development',
    protocol,
    rootDomain,
  };
}

// Determine if we're in production
const isProduction = process.env.NODE_ENV === 'production';

// Select the appropriate configuration
const envConfig = isProduction ? prodConfig : devConfig;

// Create the final configuration
export const config = createAppConfig(envConfig, isProduction);

// Export individual config getters for convenience
export const getApiUrl = () => config.api.url;
export const getCacheLayerUrl = () => config.cacheLayer.url;
export const getProtocol = () => config.protocol;
export const getRootDomain = () => config.rootDomain;
export const isProd = () => config.environment === 'production';
export const isDev = () => config.environment === 'development';
