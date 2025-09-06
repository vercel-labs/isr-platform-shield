// API client for the new data structure
import { getApiUrl } from "@platform/config";
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

export interface PostWithAuthor extends Post {
  authorInfo: Author;
}

export interface ApiResponse<T> {
  data: T;
}

export class ApiClient {
  constructor(
    private baseUrl: string,
    private fetchClient: typeof fetch = fetch,
  ) {}

  private async request<T>(endpoint: string): Promise<T> {
    try {
      const response = await this.fetchClient(`${this.baseUrl}${endpoint}`);

      if (!response.ok) {
        throw new Error(
          `API request failed: ${response.status} ${response.statusText}`,
        );
      }

      const result: ApiResponse<T> = await response.json();
      return result.data;
    } catch (error) {
      console.error(`Error fetching from ${endpoint}:`, error);
      throw error;
    }
  }

  // Author methods
  async getAllAuthors(): Promise<Author[]> {
    return this.request<Author[]>("/authors");
  }

  async getAuthorById(id: number): Promise<Author | null> {
    try {
      return await this.request<Author>(`/authors?id=${id}`);
    } catch {
      return null;
    }
  }

  // Post methods
  async getAllPosts(): Promise<Post[]> {
    return this.request<Post[]>("/posts");
  }

  async getPostById(id: number): Promise<Post | null> {
    try {
      return await this.request<Post>(`/posts?id=${id}`);
    } catch {
      return null;
    }
  }

  async getPostsByAuthor(authorId: number): Promise<Post[]> {
    return this.request<Post[]>(`/posts?author=${authorId}`);
  }

  async getPostsByTag(tag: string): Promise<Post[]> {
    return this.request<Post[]>(`/posts?tag=${encodeURIComponent(tag)}`);
  }

  async searchPosts(query: string): Promise<Post[]> {
    return this.request<Post[]>(`/posts?search=${encodeURIComponent(query)}`);
  }

  async getRecentPosts(limit?: number): Promise<Post[]> {
    const endpoint = limit ? `/posts?recent=${limit}` : "/posts?recent=10";
    return this.request<Post[]>(endpoint);
  }

  // Enhanced methods with author info
  async getPostsWithAuthors(): Promise<PostWithAuthor[]> {
    return this.request<PostWithAuthor[]>("/posts?withAuthors=true");
  }

  async getPostWithAuthor(id: number): Promise<PostWithAuthor | null> {
    try {
      return await this.request<PostWithAuthor>(
        `/posts?id=${id}&withAuthors=true`,
      );
    } catch {
      return null;
    }
  }

  async getPostsWithAuthorsByTag(tag: string): Promise<PostWithAuthor[]> {
    return this.request<PostWithAuthor[]>(
      `/posts?tag=${encodeURIComponent(tag)}&withAuthors=true`,
    );
  }

  async getPostsWithAuthorsByAuthor(
    authorId: number,
  ): Promise<PostWithAuthor[]> {
    return this.request<PostWithAuthor[]>(
      `/posts?author=${authorId}&withAuthors=true`,
    );
  }
}

// Default instance - uses config package for API URL
export const apiClient = new ApiClient(getApiUrl());
