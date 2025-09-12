import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

// Type definitions
export interface Author {
  id: number;
  name: string;
}

export interface Post {
  id: number;
  title: string;
  content: string;
  author: number;
  publishedAt: string;
  tags: string[];
}

export interface DataStore {
  authors: Author[];
  posts: Post[];
}

// Zod schemas for validation
const AuthorSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const PostSchema = z.object({
  id: z.number(),
  title: z.string(),
  content: z.string(),
  author: z.number(),
  publishedAt: z.string(),
  tags: z.array(z.string()),
});

const DataStoreSchema = z.object({
  authors: z.array(AuthorSchema),
  posts: z.array(PostSchema),
});

/**
 * Load and validate data from the JSON file (reads from disk every time)
 */
function loadData(): DataStore {
  try {
    const dataPath = join(process.cwd(), "lib", "data.json");
    const data = readFileSync(dataPath, "utf8");
    const jsonData = JSON.parse(data);
    return DataStoreSchema.parse(jsonData);
  } catch (error) {
    throw new Error(
      `Failed to load data: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Get first posts with author information
 */
export function getFirstPostsWithAuthors(count: number = 5): (Post & { authorInfo: Author })[] {
  const data = loadData();
  const posts = data.posts.slice(0, count);
  const authors = data.authors;

  return posts.map((post) => {
    const authorInfo = authors.find((author) => author.id === post.author);
    if (!authorInfo) {
      throw new Error(`Author with ID ${post.author} not found`);
    }
    return {
      ...post,
      authorInfo,
    };
  });
}

/**
 * Get post by ID with author information
 */
export function getPostWithAuthorById(id: number): (Post & { authorInfo: Author }) | null {
  const data = loadData();
  const post = data.posts.find((post) => post.id === id);

  if (!post) {
    return null;
  }

  const authorInfo = data.authors.find((author) => author.id === post.author);
  if (!authorInfo) {
    throw new Error(`Author with ID ${post.author} not found`);
  }

  return {
    ...post,
    authorInfo,
  };
}

