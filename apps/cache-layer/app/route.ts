import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const res = new NextResponse("hello /", {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
  return res;
}
