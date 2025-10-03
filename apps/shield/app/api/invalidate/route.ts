import { NextRequest, NextResponse } from "next/server";
import { invalidateByTag } from "@vercel/functions"

export async function GET(req: NextRequest) {
  try {
    const tag = req.nextUrl.searchParams.get("tag");

    if (!tag) {
      return NextResponse.json(
        { error: "Tag is required" },
        { status: 400 }
      );
    }

    const childResponse = await fetch(`https://core.labs.vercel.dev/api/delete?tag=${tag}`);
    const childResponseData = await childResponse.json();

    // If the core tag deletion fails, bail out and don't invalidate shield because it
    // will refetch stale content unnecessarily
    if (childResponseData.error) {
      return NextResponse.json(
        { error: childResponseData.error },
        { status: 500 }
      );
    } else { // If the core app is able to delete the tag, invalidate the tag on the shield app
      await invalidateByTag(tag);

      return NextResponse.json({
        message: "Cache invalidated successfully",
        tag,
      });
    }
  } catch (error) {
    console.error("Invalidation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}