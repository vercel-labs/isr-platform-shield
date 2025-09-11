import { OTLPHttpJsonTraceExporter, registerOTel } from '@vercel/otel';
import pkg from './package.json';

export function register() {
  registerOTel({
    serviceName: 'cache-layer',
    traceExporter: new OTLPHttpJsonTraceExporter({
      url: 'https://http.otel.pzona.biz',
      headers: {
        'Authorization': `Bearer ${process.env.OTEL_AUTH_TOKEN}`
      }
    }),
    attributes: {
      'next.version': pkg.dependencies['next']
    }
  });
}