export interface AppConfig {
  api: {
    host: string;
    url: string;
  };
  cacheLayer: {
    host: string;
    url: string;
  };
  redis: {
    url: string;
    restApiUrl: string;
    restApiToken: string;
    restApiReadOnlyToken: string;
  };
  environment: 'development' | 'production';
  protocol: 'http' | 'https';
  rootDomain: string;
}

export interface EnvironmentConfig {
  apiHost: string;
  cacheLayerHost: string;
  redisUrl: string;
  redisRestApiUrl: string;
  redisRestApiToken: string;
  redisRestApiReadOnlyToken: string;
}
