import { readFileSync } from "node:fs";
import { join } from "node:path";

// Simple types
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

// Load data from JSON file
function loadData() {
  const dataPath = join(process.cwd(), "lib", "data.json");
  const data = readFileSync(dataPath, "utf8");
  return JSON.parse(data);
}

// Get first 5 posts with author names
export function getFirstPostsWithAuthors(limit = 5) {
  const data = loadData();
  const posts = data.posts.slice(0, limit);
  const authors = data.authors;

  return posts.map((post: Post) => ({
    ...post,
    author: authors.find((a: Author) => a.id === post.author)?.name || "Unknown"
  }));
}

// Get single post with author name
export function getPostWithAuthorById(id: number) {
  const data = loadData();
  const post = data.posts.find((p: Post) => p.id === id);

  if (!post) return null;

  const author = data.authors.find((a: Author) => a.id === post.author);
  return {
    ...post,
    author: author?.name || "Unknown"
  };
}