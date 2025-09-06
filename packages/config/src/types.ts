export interface Config {
  api: {
    url: string;
  };
  cacheLayer: {
    url: string;
  };
  redis: {
    url: string;
    restApiUrl: string;
    restApiToken: string;
  };
  protocol: 'http' | 'https';
  rootDomain: string;
}
