import { type Post, type ApiClient } from "./api-client";

export interface BlogPost {
  id: number;
  title: string;
  content: string;
  author: string;
  publishedAt: string;
  tags: string[];
}

export interface BlogPostService {
  getPost(id: string): Promise<BlogPost | null>;
  getRandomPosts(): Promise<BlogPost[]>;
}

export class ApiBlogPostService implements BlogPostService {
  constructor(private apiClient: ApiClient) { }

  async getPost(id: string): Promise<BlogPost | null> {
    const postId = Number.parseInt(id, 10);
    if (Number.isNaN(postId)) {
      return null;
    }

    return await this.apiClient.getPostById(postId);
  }

  async getRandomPosts(): Promise<BlogPost[]> {
    return await this.apiClient.getPosts();
  }
}

// Default instance
import { apiClient } from "./api-client";
export const blogPostService = new ApiBlogPostService(apiClient);