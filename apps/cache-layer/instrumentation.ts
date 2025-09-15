import { OTLPHttpJsonTraceExporter, registerOTel } from '@vercel/otel';

export function register() {
  registerOTel({
    serviceName: 'cache-layer',
    traceExporter: new OTLPHttpJsonTraceExporter({
      url: 'https://http.otel.pzona.biz/v1/traces',
      headers: {
        'Authorization': `Bearer ${process.env.OTEL_AUTH_TOKEN}`
      }
    })
  });
}