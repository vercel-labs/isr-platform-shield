import { OTLPHttpJsonTraceExporter, registerOTel } from '@vercel/otel';

export function register() {
  registerOTel({
    serviceName: 'core',
    traceExporter: new OTLPHttpJsonTraceExporter({
      url: 'https://http.otel.pzona.biz',
      headers: {
        'Authorization': `Bearer%20${process.env.OTEL_AUTH_TOKEN}`
      }
    })
  });
}