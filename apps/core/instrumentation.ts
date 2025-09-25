import { OTLPHttpJsonTraceExporter, registerOTel } from "@vercel/otel";

export function register() {
	registerOTel({
		serviceName: "core",
		instrumentationConfig: {
			fetch: {
				propagateContextUrls: ["pzona.fun"],
			},
		},
	});
}
