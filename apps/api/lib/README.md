# Data Utilities

This utility provides comprehensive functions for retrieving and filtering posts and authors from the JSON data file.

## Features

- **Type Safety**: Full TypeScript support with Zod validation
- **Caching**: In-memory caching to avoid repeated file reads
- **Error Handling**: Proper error handling with descriptive messages
- **Flexible Filtering**: Multiple ways to filter and search data

## Available Functions

### Author Functions

- `getAllAuthors()` - Get all authors
- `getAuthorById(id: number)` - Get author by ID

### Post Functions

- `getAllPosts()` - Get all posts
- `getPostById(id: number)` - Get post by ID
- `getPostsByAuthor(authorId: number)` - Get posts by author ID
- `getPostsByTag(tag: string)` - Get posts by tag
- `getPostsByTags(tags: string[])` - Get posts by multiple tags (OR logic)
- `getPostsByAuthorAndTag(authorId: number, tag: string)` - Get posts by author and tag

### Enhanced Post Functions

- `getPostsWithAuthors()` - Get posts with author information included
- `getPostsWithAuthorsByTag(tag: string)` - Get posts with author info by tag
- `searchPosts(query: string)` - Search posts by title or content
- `getRecentPosts(limit?: number)` - Get recent posts (sorted by date)

### Analytics Functions

- `getAllTags()` - Get all unique tags
- `getPostCountByAuthor()` - Get post count per author
- `getPostCountByTag()` - Get post count per tag

### Utility Functions

- `clearDataCache()` - Clear the data cache (useful for testing)

## API Endpoints

The utility is integrated with the API routes:

### Authors
- `GET /authors` - Get all authors
- `GET /authors?id=1` - Get author by ID

### Posts
- `GET /posts` - Get all posts
- `GET /posts?id=1` - Get post by ID
- `GET /posts?author=1` - Get posts by author
- `GET /posts?tag=technology` - Get posts by tag
- `GET /posts?search=sensor` - Search posts
- `GET /posts?recent=5` - Get 5 most recent posts
- `GET /posts?withAuthors=true` - Get posts with author information

## Usage Examples

```typescript
import { getAllPosts, getPostsByTag, searchPosts } from '@/lib/data-utils';

// Get all posts
const posts = getAllPosts();

// Get posts by tag
const techPosts = getPostsByTag('technology');

// Search posts
const searchResults = searchPosts('sensor');

// Get posts with author information
const postsWithAuthors = getPostsWithAuthors();
```

## Data Structure

### Author
```typescript
interface Author {
  id: number;
  name: string;
}
```

### Post
```typescript
interface Post {
  id: number;
  title: string;
  content: string;
  author: number; // Author ID
  publishedAt: string; // ISO date string
  tags: string[];
}
```

## Error Handling

The utility includes comprehensive error handling:

- **Data Loading Errors**: Throws descriptive errors if the JSON file cannot be loaded or parsed
- **Validation Errors**: Uses Zod to validate data structure
- **Missing Data**: Returns `null` for single item queries when not found
- **Type Safety**: Full TypeScript type checking

## Performance

- **Caching**: Data is cached in memory after first load
- **Efficient Filtering**: Uses native JavaScript array methods for optimal performance
- **Lazy Loading**: Data is only loaded when first accessed
