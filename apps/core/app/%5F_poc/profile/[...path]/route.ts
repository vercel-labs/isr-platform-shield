import { renderPocResponse } from "@/lib/poc";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return renderPocResponse(request, path.join("/"), true);
}
