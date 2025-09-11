// API client for the new data structure
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
  ) { }

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

  // Simplified post methods
  async getPostById(id: number): Promise<PostWithAuthor | null> {
    try {
      return await this.request<PostWithAuthor>(`/posts?id=${id}`);
    } catch {
      return null;
    }
  }

  async getRandomPosts(): Promise<PostWithAuthor[]> {
    return this.request<PostWithAuthor[]>("/posts?random=true");
  }
}

// Default instance - uses environment variables for API URL
export const apiClient = new ApiClient(`${process.env.NEXT_PUBLIC_PROTOCOL}://${process.env.API_HOST}`);
