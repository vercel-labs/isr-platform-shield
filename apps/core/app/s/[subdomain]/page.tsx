import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSubdomainData } from "@/lib/subdomains";
import { protocol, rootDomain } from "@/lib/utils";
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
      title: rootDomain,
    };
  }

  return {
    title: `${subdomain}.${rootDomain}`,
    description: `Subdomain page for ${subdomain}.${rootDomain}`,
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
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="text-9xl mb-6">{subdomainData.emoji}</div>
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Welcome to {subdomain}.{rootDomain}
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Your custom subdomain with the latest blog posts
          </p>
          <Link
            href={`${protocol}://${rootDomain}`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to {rootDomain}
          </Link>
        </div>

        {/* Recent Posts */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Recent Posts</h2>
          {recentPosts.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {recentPosts.map((post) => (
                <Link
                  key={post.id}
                  href={`/${post.id}`}
                  className="block rounded-lg p-6 bg-card text-card-foreground hover:bg-accent transition-colors border"
                >
                  <h3 className="text-xl font-semibold mb-2 line-clamp-2">
                    {post.title}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-4 line-clamp-3">
                    {post.content}
                  </p>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>By {post.author}</span>
                    <time dateTime={post.publishedAt}>
                      {new Date(post.publishedAt).toLocaleDateString()}
                    </time>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {post.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 text-muted-foreground rounded text-xs"
                      >
                        #{tag}
                      </span>
                    ))}
                    {post.tags.length > 3 && (
                      <span className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs">
                        +{post.tags.length - 3} more
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
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
