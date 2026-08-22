import { authorizePocControl, pocJson, pocStorageBackend } from "@/lib/poc";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unauthorized = authorizePocControl(request);
  if (unauthorized) return unauthorized;
  return pocJson({
    storage: pocStorageBackend(),
    environment: process.env.VERCEL_ENV ?? "development",
    shieldEnvironment:
      request.headers.get("x-poc-shield-environment") ?? "direct-core",
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? "local",
  });
}
