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

// Cache for the data to avoid reading from disk repeatedly
let dataCache: DataStore | null = null;

/**
 * Load and validate data from the JSON file
 */
function loadData(): DataStore {
  if (dataCache) {
    return dataCache;
  }

  try {
    const dataPath = join(process.cwd(), "lib", "data.json");
    const data = readFileSync(dataPath, "utf8");
    const jsonData = JSON.parse(data);

    // Validate the data structure
    const validatedData = DataStoreSchema.parse(jsonData);
    dataCache = validatedData;

    return validatedData;
  } catch (error) {
    throw new Error(
      `Failed to load data: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Get all authors
 */
export function getAllAuthors(): Author[] {
  const data = loadData();
  return data.authors;
}

/**
 * Get author by ID
 */
export function getAuthorById(id: number): Author | null {
  const authors = getAllAuthors();
  return authors.find((author) => author.id === id) || null;
}

/**
 * Get all posts
 */
export function getAllPosts(): Post[] {
  const data = loadData();
  return data.posts;
}

/**
 * Get post by ID
 */
export function getPostById(id: number): Post | null {
  const posts = getAllPosts();
  return posts.find((post) => post.id === id) || null;
}

/**
 * Get posts by author ID
 */
export function getPostsByAuthor(authorId: number): Post[] {
  const posts = getAllPosts();
  return posts.filter((post) => post.author === authorId);
}

/**
 * Get posts by tag
 */
export function getPostsByTag(tag: string): Post[] {
  const posts = getAllPosts();
  return posts.filter((post) => post.tags.includes(tag));
}

/**
 * Get posts by multiple tags (posts that have ANY of the specified tags)
 */
export function getPostsByTags(tags: string[]): Post[] {
  const posts = getAllPosts();
  return posts.filter((post) => tags.some((tag) => post.tags.includes(tag)));
}

/**
 * Get posts by author and tag combination
 */
export function getPostsByAuthorAndTag(authorId: number, tag: string): Post[] {
  const posts = getAllPosts();
  return posts.filter(
    (post) => post.author === authorId && post.tags.includes(tag),
  );
}

/**
 * Get posts with author information included
 */
export function getPostsWithAuthors(): (Post & { authorInfo: Author })[] {
  const posts = getAllPosts();
  const authors = getAllAuthors();

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
 * Get posts with author information by tag
 */
export function getPostsWithAuthorsByTag(
  tag: string,
): (Post & { authorInfo: Author })[] {
  const posts = getPostsByTag(tag);
  const authors = getAllAuthors();

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
 * Get all unique tags
 */
export function getAllTags(): string[] {
  const posts = getAllPosts();
  const allTags = posts.flatMap((post) => post.tags);
  return [...new Set(allTags)].sort();
}

/**
 * Get posts count by author
 */
export function getPostCountByAuthor(): Record<number, number> {
  const posts = getAllPosts();
  const count: Record<number, number> = {};

  for (const post of posts) {
    count[post.author] = (count[post.author] || 0) + 1;
  }

  return count;
}

/**
 * Get posts count by tag
 */
export function getPostCountByTag(): Record<string, number> {
  const posts = getAllPosts();
  const count: Record<string, number> = {};

  for (const post of posts) {
    for (const tag of post.tags) {
      count[tag] = (count[tag] || 0) + 1;
    }
  }

  return count;
}

/**
 * Search posts by title or content
 */
export function searchPosts(query: string): Post[] {
  const posts = getAllPosts();
  const lowercaseQuery = query.toLowerCase();

  return posts.filter(
    (post) =>
      post.title.toLowerCase().includes(lowercaseQuery) ||
      post.content.toLowerCase().includes(lowercaseQuery),
  );
}

/**
 * Get recent posts (sorted by publishedAt, most recent first)
 */
export function getRecentPosts(limit?: number): Post[] {
  const posts = getAllPosts();
  const sorted = posts.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  return limit ? sorted.slice(0, limit) : sorted;
}

/**
 * Get first posts (for subdomain page)
 */
export function getFirstPosts(count: number = 5): Post[] {
  const posts = getAllPosts();
  return posts.slice(0, count);
}

/**
 * Get first posts with author information
 */
export function getFirstPostsWithAuthors(count: number = 5): (Post & { authorInfo: Author })[] {
  const posts = getFirstPosts(count);
  const authors = getAllAuthors();

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
  const post = getPostById(id);
  if (!post) {
    return null;
  }

  const authors = getAllAuthors();
  const authorInfo = authors.find((author) => author.id === post.author);
  if (!authorInfo) {
    throw new Error(`Author with ID ${post.author} not found`);
  }

  return {
    ...post,
    authorInfo,
  };
}

/**
 * Clear the data cache (useful for testing or when data changes)
 */
export function clearDataCache(): void {
  dataCache = null;
}
