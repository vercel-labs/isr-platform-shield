import { registerOTel } from '@vercel/otel';

export function register() {
  registerOTel({
    serviceName: 'cache-layer',
    instrumentationConfig: {
      fetch: {
        propagateContextUrls: []
      }
    }
  });
}
