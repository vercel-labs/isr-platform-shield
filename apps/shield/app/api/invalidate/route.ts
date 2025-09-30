import { NextRequest, NextResponse } from "next/server";
import { invalidateByTag } from "@vercel/functions"

export async function GET(req: NextRequest) {
  try {
    const { tag } = await req.json();

    if (!tag) {
      return NextResponse.json(
        { error: "Tag is required" },
        { status: 400 }
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