import { OTLPHttpJsonTraceExporter, registerOTel } from '@vercel/otel';
import pkg from './package.json';

export function register() {
  registerOTel({
    serviceName: 'core',
    traceExporter: new OTLPHttpJsonTraceExporter({
      url: 'https://o11y.pzona.biz',
      headers: {}
    }),
    attributes: {
      'next.version': pkg.dependencies['next']
    }
  });
}