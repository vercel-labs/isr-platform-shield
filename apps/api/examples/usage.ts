import {
  getAllAuthors,
  getAuthorById,
  getAllPosts,
  getPostById,
  getPostsByAuthor,
  getPostsByTag,
  getPostsByTags,
  getPostsByAuthorAndTag,
  getPostsWithAuthors,
  getAllTags,
  getPostCountByAuthor,
  getPostCountByTag,
  searchPosts,
  getRecentPosts,
} from "../lib/data-utils";

// Example usage of the data utilities

console.log("=== Data Utility Examples ===\n");

// Get all authors
console.log("All authors:", getAllAuthors().length);

// Get specific author
const author = getAuthorById(1);
console.log("Author 1:", author);

// Get all posts
console.log("All posts:", getAllPosts().length);

// Get specific post
const post = getPostById(1);
console.log("Post 1:", post?.title);

// Get posts by author
const postsByAuthor = getPostsByAuthor(1);
console.log("Posts by author 1:", postsByAuthor.length);

// Get posts by tag
const postsByTag = getPostsByTag("agnosco");
console.log('Posts with tag "agnosco":', postsByTag.length);

// Get posts by multiple tags
const postsByTags = getPostsByTags(["agnosco", "adsum"]);
console.log('Posts with tags "agnosco" or "adsum":', postsByTags.length);

// Get posts by author and tag
const postsByAuthorAndTag = getPostsByAuthorAndTag(1, "agnosco");
console.log(
  'Posts by author 1 with tag "agnosco":',
  postsByAuthorAndTag.length,
);

// Get posts with author info
const postsWithAuthors = getPostsWithAuthors();
console.log("Posts with author info:", postsWithAuthors.length);
console.log("First post with author:", {
  title: postsWithAuthors[0]?.title,
  author: postsWithAuthors[0]?.authorInfo.name,
});

// Get all unique tags
const allTags = getAllTags();
console.log("All unique tags:", allTags.length);
console.log("First 5 tags:", allTags.slice(0, 5));

// Get post counts
const postCountByAuthor = getPostCountByAuthor();
console.log("Post count by author:", postCountByAuthor);

const postCountByTag = getPostCountByTag();
console.log(
  "Post count by tag (first 5):",
  Object.entries(postCountByTag).slice(0, 5),
);

// Search posts
const searchResults = searchPosts("sensor");
console.log('Posts containing "sensor":', searchResults.length);

// Get recent posts
const recentPosts = getRecentPosts(5);
console.log(
  "5 most recent posts:",
  recentPosts.map((p) => p.title),
);
