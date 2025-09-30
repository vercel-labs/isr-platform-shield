import { NextRequest, NextResponse } from "next/server";
import { dangerouslyDeleteByTag } from "@vercel/functions"

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { tag } = await req.json();

    if (!tag) {
      return NextResponse.json(
        { error: "Tag is required" },
        { status: 400 }
      );
    }

    await dangerouslyDeleteByTag(tag);

    return NextResponse.json({
      message: "Cache deleted successfully",
      tag,
    });
  } catch (error) {
    console.error("Deletion error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}