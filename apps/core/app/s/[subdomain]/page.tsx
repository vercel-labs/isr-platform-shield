import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSubdomainData } from "@/lib/subdomains";
// Using environment variables directly
import { blogPostService } from "@/lib/blog-posts";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}): Promise<Metadata> {
  const { subdomain } = await params;
  const subdomainData = await getSubdomainData(subdomain);

  if (!subdomainData) {
    return {
      title: process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000",
    };
  }

  return {
    title: `${subdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000"}`,
    description: `Subdomain page for ${subdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000"}`,
  };
}

export default async function SubdomainPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  const subdomainData = await getSubdomainData(subdomain);

  if (!subdomainData) {
    notFound();
  }

  // Fetch recent posts for this subdomain
  const recentPosts = await blogPostService.getRecentPosts(5);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="text-9xl mb-6">{subdomainData.emoji}</div>
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Welcome to {subdomain}.{process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000"}
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Your custom subdomain with the latest blog posts
          </p>
          <Link
            href={`${process.env.PROTOCOL}://${process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000"}`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to {process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000"}
          </Link>
        </div>

        {/* Recent Posts */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Recent Posts</h2>
          {recentPosts.length > 0 ? (
            <ul className="space-y-3">
              {recentPosts.map((post) => (
                <li key={post.id} className="border-t border-border">
                  <Link
                    href={`/${post.id}`}
                    className="block py-3 hover:text-primary transition-colors"
                  >
                    <h3 className="text-lg font-semibold mb-1 line-clamp-1">
                      {post.title}
                    </h3>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>By {post.author}</span>
                      <time dateTime={post.publishedAt}>
                        {new Date(post.publishedAt).toLocaleDateString()}
                      </time>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {post.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-muted-foreground text-xs"
                        >
                          #{tag}
                        </span>
                      ))}
                      {post.tags.length > 3 && (
                        <span className="text-muted-foreground text-xs">
                          +{post.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">No posts available yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
