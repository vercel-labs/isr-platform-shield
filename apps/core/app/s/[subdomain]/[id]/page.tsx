import { notFound } from "next/navigation";
import { blogPostService, BlogPost } from "@/lib/blog-posts";
import { stringToColor } from "@/lib/deployment-id";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface BlogPostPageProps {
  params: Promise<{
    subdomain: string;
    id: string;
  }>;
}

export const dynamic = 'force-dynamic';

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { subdomain, id } = await params;

  // Fetch blog post data from API
  const blogPost: BlogPost | null = await blogPostService.getPost(id);

  if (!blogPost) {
    notFound();
  }

  const color = await stringToColor(process.env.VERCEL_DEPLOYMENT_ID ?? 'local');

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="mb-8">
          <Card className="mb-4">
            <CardHeader >
              <CardTitle>Deployment <Badge className="ml-1 text-md" style={{ backgroundColor: color }}>{process.env.VERCEL_DEPLOYMENT_ID ?? 'local'}</Badge></CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Generated at: {new Date().toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Revalidates at: {new Date().setMinutes(new Date().getMinutes() + 60).toLocaleString()}</p>
            </CardContent>
          </Card>
          <h1 className="text-4xl font-bold mb-4">
            {blogPost.title}
          </h1>
          <div className="flex items-center gap-4 text-muted-foreground text-sm">
            <span>By {blogPost.author}</span>
            <span>•</span>
            <time dateTime={blogPost.publishedAt}>
              {new Date(blogPost.publishedAt).toLocaleDateString()}
            </time>
            <span>•</span>
            <span>Subdomain: {subdomain}</span>
          </div>
        </header>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-8">
            {blogPost.tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
              >
                #{tag}
              </Badge>
            ))}
        </div>

        {/* Content */}
        <article className="prose prose-invert max-w-none">
          <div className="whitespace-pre-wrap leading-relaxed">
            {blogPost.content}
          </div>
        </article>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-border">
          <div className="text-center text-muted-foreground">
            <p>Post ID: {id}</p>
            <p>Subdomain: {subdomain}</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
