import { NextResponse } from "next/server";
import { getPostWithAuthorById } from "@/lib/data-utils";

// Get individual post by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const post = getPostWithAuthorById(Number(id));

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  return NextResponse.json({ post });
}
