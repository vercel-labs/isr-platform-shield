import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getAllAuthors,
  getAuthorById,
  getAllPosts,
  getPostById,
  getPostsByAuthor,
  getPostsByTag,
  getPostsWithAuthors,
  getPostsWithAuthorsByTag,
  searchPosts,
  getRecentPosts,
  type Post,
  type Author,
} from "@/lib/data-utils";

// Delay for latency, not looking to illustrate anything specific
const DELAY = process.env.NODE_ENV === "production" ? 2000 : 0;

// Define the schema for valid resources
const ResourceSchema = z.enum(["posts", "authors"]);

// Query parameter schemas
const PostQuerySchema = z.object({
  id: z.string().optional(),
  author: z.string().optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
  recent: z.string().optional(),
  withAuthors: z.string().optional(),
});

const AuthorQuerySchema = z.object({
  id: z.string().optional(),
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
        message: "Resource must be either 'posts' or 'authors'",
        received: slug[0],
        validOptions: ["posts", "authors"],
      },
      { status: 400 },
    );
  }

  const resource = resourceResult.data;

  // Simulate latency
  await new Promise((resolve) => setTimeout(resolve, DELAY));

  try {
    if (resource === "authors") {
      const query = AuthorQuerySchema.parse(Object.fromEntries(searchParams));

      if (query.id) {
        const author = getAuthorById(Number.parseInt(query.id, 10));
        if (!author) {
          return NextResponse.json(
            { error: "Author not found" },
            { status: 404 },
          );
        }
        return NextResponse.json({ data: author });
      }

      const authors = getAllAuthors();
      return NextResponse.json({ data: authors });
    }

    if (resource === "posts") {
      const query = PostQuerySchema.parse(Object.fromEntries(searchParams));

      // Get post by ID
      if (query.id) {
        const post = getPostById(Number.parseInt(query.id, 10));
        if (!post) {
          return NextResponse.json(
            { error: "Post not found" },
            { status: 404 },
          );
        }

        if (query.withAuthors === "true") {
          const postsWithAuthors = getPostsWithAuthors();
          const postWithAuthor = postsWithAuthors.find(
            (p: Post & { authorInfo: Author }) =>
              p.id === Number.parseInt(query.id || "0", 10),
          );
          return NextResponse.json({ data: postWithAuthor });
        }

        return NextResponse.json({ data: post });
      }

      // Get posts by author
      if (query.author) {
        const posts = getPostsByAuthor(Number.parseInt(query.author, 10));
        if (query.withAuthors === "true") {
          const postsWithAuthors = getPostsWithAuthors();
          const filteredPosts = postsWithAuthors.filter(
            (p: Post & { authorInfo: Author }) =>
              p.author === Number.parseInt(query.author || "0", 10),
          );
          return NextResponse.json({ data: filteredPosts });
        }
        return NextResponse.json({ data: posts });
      }

      // Get posts by tag
      if (query.tag) {
        const posts = getPostsByTag(query.tag);
        if (query.withAuthors === "true") {
          const postsWithAuthors = getPostsWithAuthorsByTag(query.tag);
          return NextResponse.json({ data: postsWithAuthors });
        }
        return NextResponse.json({ data: posts });
      }

      // Search posts
      if (query.search) {
        const posts = searchPosts(query.search);
        if (query.withAuthors === "true") {
          const postsWithAuthors = getPostsWithAuthors();
          const filteredPosts = postsWithAuthors.filter(
            (p: Post & { authorInfo: Author }) =>
              posts.some((searchPost: Post) => searchPost.id === p.id),
          );
          return NextResponse.json({ data: filteredPosts });
        }
        return NextResponse.json({ data: posts });
      }

      // Get recent posts
      if (query.recent) {
        const limit = Number.parseInt(query.recent, 10);
        const posts = getRecentPosts(limit);
        if (query.withAuthors === "true") {
          const postsWithAuthors = getPostsWithAuthors();
          const filteredPosts = postsWithAuthors.filter(
            (p: Post & { authorInfo: Author }) =>
              posts.some((recentPost: Post) => recentPost.id === p.id),
          );
          return NextResponse.json({ data: filteredPosts });
        }
        return NextResponse.json({ data: posts });
      }

      // Get all posts
      if (query.withAuthors === "true") {
        const postsWithAuthors = getPostsWithAuthors();
        return NextResponse.json({ data: postsWithAuthors });
      }

      const posts = getAllPosts();
      return NextResponse.json({ data: posts });
    }
  } catch (error) {
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
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
