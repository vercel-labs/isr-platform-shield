import { NextRequest, NextResponse } from "next/server";
import { invalidateByTag } from "@vercel/functions"

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const tag = req.nextUrl.searchParams.get("tag");

    if (!tag) {
      return NextResponse.json(
        { error: "Tag is required" },
        { status: 400 }
      );
    }

    const childResponse = await fetch(`https://core.pzvtest314.vercel.app/api/delete?tag=${tag}`);
    const childResponseData = await childResponse.json();

    if (childResponseData.error) {
      return NextResponse.json(
        { error: childResponseData.error },
        { status: 500 }
      );
    }

    await invalidateByTag(tag);

    return NextResponse.json({
      message: "Cache invalidated successfully",
      tag,
    });
  } catch (error) {
    console.error("Invalidation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}