import { OTLPHttpProtoTraceExporter, registerOTel } from "@vercel/otel";

const traceExporter = new OTLPHttpProtoTraceExporter({
  url: `https://${process.env.AXIOM_DOMAIN}/v1/traces`,
  headers: {
    'Authorization': `Bearer ${process.env.AXIOM_TOKEN}`,
    'X-Axiom-Dataset': 'shielded-isr'
  },
});

// Force build: 0
export function register() {
	registerOTel({
		serviceName: "core",
		instrumentationConfig: {
			fetch: {
				propagateContextUrls: [
					process.env.CORE_URL || '',
					process.env.SHIELD_URL || ''
				]
			}
		},
		traceExporter
	});
}
