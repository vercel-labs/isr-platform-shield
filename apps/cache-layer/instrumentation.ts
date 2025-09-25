import { registerOTel } from "@vercel/otel";

// Force build: 0
export function register() {
	registerOTel({
		serviceName: "cache-layer",
		instrumentationConfig: {
			fetch: {
				propagateContextUrls: [],
			},
		},
	});
}
