import { Redis } from '@upstash/redis';
import { config } from '@platform/config';

export const redis = new Redis({
  url: config.redis.restApiUrl,
  token: config.redis.restApiToken
});
