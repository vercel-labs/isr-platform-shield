// Simple API client for the new simplified API
export interface Post {
  id: number;
  title: string;
  content: string;
  author: string; // Now just the author name
  publishedAt: string;
  tags: string[];
}

export class ApiClient {
  constructor(
    private baseUrl: string,
    private fetchClient: typeof fetch = fetch,
  ) { }

  private async request<T>(endpoint: string): Promise<T> {
    const response = await this.fetchClient(`${this.baseUrl}${endpoint}`);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    return await response.json();
  }

  // Get single post by ID
  async getPostById(id: number): Promise<Post | null> {
    try {
      const result = await this.request<{ post: Post }>(`/posts/${id}`);
      return result.post;
    } catch {
      return null;
    }
  }

  // Get posts (limit 5 by default)
  async getPosts(): Promise<Post[]> {
    const result = await this.request<{ posts: Post[] }>("/posts");
    return result.posts;
  }
}

// Default instance
export const apiClient = new ApiClient(`${process.env.NEXT_PUBLIC_PROTOCOL}://${process.env.API_HOST}`);