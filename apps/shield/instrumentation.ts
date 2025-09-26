import { registerOTel } from "@vercel/otel";

// Force build: 0
export function register() {
	registerOTel({
		serviceName: "shield",
		instrumentationConfig: {
			fetch: {
				propagateContextUrls: [],
			},
		},
	});
}
