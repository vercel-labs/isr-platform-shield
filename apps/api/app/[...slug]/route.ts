import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getPostWithAuthorById,
  getFirstPostsWithAuthors,
} from "@/lib/data-utils";
import { trace } from "@opentelemetry/api";

// Delay for latency, not looking to illustrate anything specific
const DELAY = process.env.NODE_ENV === "production" ? 2000 : 0;

// Define the schema for valid resources
const ResourceSchema = z.enum(["posts"]);

// Query parameter schemas
const PostQuerySchema = z.object({
  id: z.string().optional(),
  random: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const { searchParams } = new URL(request.url);

  // Validate the resource parameter
  const resourceResult = ResourceSchema.safeParse(slug[0]);

  if (!resourceResult.success) {
    return NextResponse.json(
      {
        error: "Invalid resource",
        message: "Resource must be 'posts'",
        received: slug[0],
        validOptions: ["posts"],
      },
      { status: 400 },
    );
  }

  const resource = resourceResult.data;

  // Simulate latency
  await new Promise((resolve) => setTimeout(resolve, DELAY));

  try {
    if (resource === "posts") {
      const query = PostQuerySchema.parse(Object.fromEntries(searchParams));

      // Get post by ID
      if (query.id) {
        const postWithAuthor = getPostWithAuthorById(Number.parseInt(query.id, 10));
        if (!postWithAuthor) {
          return NextResponse.json(
            { error: "Post not found" },
            { status: 404 },
          );
        }

        return NextResponse.json({ data: postWithAuthor });
      }

      // Get first 5 posts for subdomain page
      if (query.random === "true") {
        return await trace.getTracer('api').startActiveSpan('getFirstPosts', async (span) => {
          try {
            const posts = getFirstPostsWithAuthors(5);
            return NextResponse.json({ data: posts });
          } finally {
            span.end();
          }
        });
      }

      // Default: return first 5 posts
      const posts = getFirstPostsWithAuthors(5);
      return NextResponse.json({ data: posts });
    }
  } catch (error) {
    console.error("API Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          details: error.issues,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 },
    );
  }
}