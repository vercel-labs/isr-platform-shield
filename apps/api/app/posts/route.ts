import { NextResponse } from "next/server";
import { getFirstPostsWithAuthors } from "@/lib/data-utils";

// Get posts (limit 5 by default)
export async function GET() {
  const posts = getFirstPostsWithAuthors(5);
  return NextResponse.json({ posts });
}
