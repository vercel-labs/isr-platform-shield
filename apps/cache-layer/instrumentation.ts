import { OTLPHttpJsonTraceExporter, registerOTel } from '@vercel/otel';
import pkg from './package.json';

export function register() {
  registerOTel({
    serviceName: 'cache-layer',
    traceExporter: new OTLPHttpJsonTraceExporter({
      url: 'https://http.otel.pzona.biz',
      headers: {}
    }),
    attributes: {
      'next.version': pkg.dependencies['next']
    }
  });
}