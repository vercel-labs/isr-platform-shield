import { type PostWithAuthor, type Post, type ApiClient } from "./api-client";

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
  getAllPosts(): Promise<BlogPost[]>;
  getPostsByAuthor(authorId: number): Promise<BlogPost[]>;
  getPostsByTag(tag: string): Promise<BlogPost[]>;
  searchPosts(query: string): Promise<BlogPost[]>;
  getRecentPosts(limit?: number): Promise<BlogPost[]>;
}

export class ApiBlogPostService implements BlogPostService {
  constructor(private apiClient: ApiClient) {}

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
    try {
      const postId = Number.parseInt(id, 10);
      if (Number.isNaN(postId)) {
        return null;
      }

      const post = await this.apiClient.getPostWithAuthor(postId);
      return post ? this.convertPostWithAuthor(post) : null;
    } catch (error) {
      console.error("Error fetching blog post:", error);
      return null;
    }
  }

  async getAllPosts(): Promise<BlogPost[]> {
    try {
      const posts = await this.apiClient.getPostsWithAuthors();
      return posts.map((post: PostWithAuthor) =>
        this.convertPostWithAuthor(post),
      );
    } catch (error) {
      console.error("Error fetching blog posts:", error);
      return [];
    }
  }

  async getPostsByAuthor(authorId: number): Promise<BlogPost[]> {
    try {
      const posts = await this.apiClient.getPostsWithAuthorsByAuthor(authorId);
      return posts.map((post: PostWithAuthor) =>
        this.convertPostWithAuthor(post),
      );
    } catch (error) {
      console.error("Error fetching posts by author:", error);
      return [];
    }
  }

  async getPostsByTag(tag: string): Promise<BlogPost[]> {
    try {
      const posts = await this.apiClient.getPostsWithAuthorsByTag(tag);
      return posts.map((post: PostWithAuthor) =>
        this.convertPostWithAuthor(post),
      );
    } catch (error) {
      console.error("Error fetching posts by tag:", error);
      return [];
    }
  }

  async searchPosts(query: string): Promise<BlogPost[]> {
    try {
      const posts = await this.apiClient.searchPosts(query);
      // For search results, we need to get author info separately
      const postsWithAuthors = await this.apiClient.getPostsWithAuthors();
      const searchResults = postsWithAuthors.filter((post: PostWithAuthor) =>
        posts.some((searchPost: Post) => searchPost.id === post.id),
      );
      return searchResults.map((post: PostWithAuthor) =>
        this.convertPostWithAuthor(post),
      );
    } catch (error) {
      console.error("Error searching posts:", error);
      return [];
    }
  }

  async getRecentPosts(limit?: number): Promise<BlogPost[]> {
    try {
      const posts = await this.apiClient.getRecentPosts(limit);
      // For recent posts, we need to get author info separately
      const postsWithAuthors = await this.apiClient.getPostsWithAuthors();
      const recentResults = postsWithAuthors.filter((post: PostWithAuthor) =>
        posts.some((recentPost: Post) => recentPost.id === post.id),
      );
      return recentResults.map((post: PostWithAuthor) =>
        this.convertPostWithAuthor(post),
      );
    } catch (error) {
      console.error("Error fetching recent posts:", error);
      return [];
    }
  }
}

// Default instance
import { apiClient } from "./api-client";
export const blogPostService = new ApiBlogPostService(apiClient);
