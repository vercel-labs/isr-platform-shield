import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { trace, Span } from "@opentelemetry/api";

// Simple types
export interface Author {
	id: number;
	name: string;
}

export interface BlogPost {
	id: number;
	title: string;
	content: string;
	author: string;
	publishedAt: string;
	tags: string[];
}

const tracer = trace.getTracer("core.blog-posts");

export class BlogPostService {
	constructor() {}

	private async loadData() {
		return await tracer.startActiveSpan("loadData", {}, async (span: Span) => {
			try {
				const dataPath = join(process.cwd(), "lib", "data.json");
				const data = await readFile(dataPath, "utf8");
				return JSON.parse(data);
			} finally {
				span.end();
			}
		});
	}

	// Get single post by ID
	async getPost(id: string): Promise<BlogPost | null> {
		const postId = Number.parseInt(id, 10);
		if (Number.isNaN(postId)) {
			return null;
		}

		const data = await this.loadData();
		const post = data.posts.find((p: any) => p.id === postId);

		if (!post) return null;

		const author = data.authors.find((a: Author) => a.id === post.author);
		return {
			...post,
			author: author?.name || "Unknown",
		};
	}

	// Get posts (limit 5 by default)
	async getRandomPosts(limit = 5): Promise<BlogPost[]> {
		const data = await this.loadData();
		const posts = data.posts.slice(0, limit);
		const authors = data.authors;

		return posts.map((post: any) => ({
			...post,
			author:
				authors.find((a: Author) => a.id === post.author)?.name || "Unknown",
		}));
	}
}

// Default instance
export const blogPostService = new BlogPostService();
