import { OTLPHttpProtoTraceExporter, registerOTel } from '@vercel/otel';

export function register() {
  registerOTel({
    serviceName: 'cache-layer',
    traceExporter: new OTLPHttpProtoTraceExporter({
      url: 'https://grpc.otel.pzona.biz',
      headers: {
        'Authorization': `Bearer%20${process.env.OTEL_AUTH_TOKEN}`
      }
    })
  });
}