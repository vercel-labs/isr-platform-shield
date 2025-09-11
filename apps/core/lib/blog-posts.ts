import { trace } from "@opentelemetry/api";
import { type PostWithAuthor, type ApiClient } from "./api-client";

export interface BlogPost {
  id: number;
  title: string;
  content: string;
  author: string; // Author name for display
  authorId: number; // Author ID for reference
  publishedAt: string;
  tags: string[];
}

export interface BlogPostService {
  getPost(id: string): Promise<BlogPost | null>;
  getRandomPosts(): Promise<BlogPost[]>;
}

export class ApiBlogPostService implements BlogPostService {
  constructor(private apiClient: ApiClient) { }

  private convertPostWithAuthor(post: PostWithAuthor): BlogPost {
    return {
      id: post.id,
      title: post.title,
      content: post.content,
      author: post.authorInfo.name,
      authorId: post.author,
      publishedAt: post.publishedAt,
      tags: post.tags,
    };
  }

  async getPost(id: string): Promise<BlogPost | null> {
    return await trace.getTracer('core').startActiveSpan('getPost', async (span) => {
      try {
        const postId = Number.parseInt(id, 10);
        if (Number.isNaN(postId)) {
          return null;
        }

        const post = await this.apiClient.getPostById(postId);
        return post ? this.convertPostWithAuthor(post) : null;
      } catch (error) {
        console.error("Error fetching blog post:", error);
        return null;
      } finally {
        span.end();
      }
    });
  }

  async getRandomPosts(): Promise<BlogPost[]> {
    return await trace.getTracer('core').startActiveSpan('getRandomPosts', async (span) => {
      try {
        const posts = await this.apiClient.getRandomPosts();
        return posts.map((post: PostWithAuthor) =>
          this.convertPostWithAuthor(post),
        );
      } catch (error) {
        console.error("Error fetching random posts:", error);
        return [];
      } finally {
        span.end();
      }
    });
  }
}

// Default instance
import { apiClient } from "./api-client";
export const blogPostService = new ApiBlogPostService(apiClient);
