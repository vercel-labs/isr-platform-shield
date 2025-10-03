import { notFound } from "next/navigation";
import { blogPostService, BlogPost } from "@/lib/blog-posts";
import { stringToColor } from "@/lib/deployment-id";
import { getSubdomainData } from "@/lib/subdomains";
import { Badge } from "@/components/ui/badge";
import { unstable_cache } from "next/cache";
import Link from "next/link";

interface BlogPostPageProps {
	params: Promise<{
		subdomain: string;
		id: string;
	}>;
}

export const dynamic = "force-static";
export const revalidate = 3600;

export default async function BlogPostPage({ params }: BlogPostPageProps) {
	const { subdomain, id } = await params;
	unstable_cache(async	() =>	{}, [], {tags: ["blog-post", subdomain, id]})()

	// Fetch blog post data from API
	const blogPost: BlogPost | null = await blogPostService.getPost(id);

	if (!blogPost) {
		notFound();
	}

	// Fetch subdomain data for emoji
	const subdomainData = await getSubdomainData(subdomain);

	const deploymentId = process.env.VERCEL_DEPLOYMENT_ID ?? "local";
	const idColor = await stringToColor(deploymentId);
	const dateColor = await stringToColor(new Date().toLocaleString());

	return (
		<div className="min-h-screen bg-background">
			<span className="hidden" aria-hidden="true">
				$validator_post_page$
			</span>

			<div className="max-w-4xl mx-auto px-6 py-12">
				{/* Header */}
				<header className="mb-8">
					<small>
						{subdomainData && (
							<span className="mr-2" title={`Subdomain: ${subdomain}`}>
								{subdomainData.emoji}
							</span>
						)}
						<span>
							{subdomain}.{process.env.NEXT_PUBLIC_ROOT_DOMAIN}
						</span>
					</small>
					<h1 className="text-4xl font-bold mb-4">{blogPost.title}</h1>
					<div className="flex items-center gap-4 text-muted-foreground text-sm">
						<span>By {blogPost.author}</span>
						<span>•</span>
						<time dateTime={blogPost.publishedAt}>
							{new Date(blogPost.publishedAt).toLocaleDateString()}
						</time>
					</div>
				</header>

				{/* Tags */}
				<div className="flex flex-wrap gap-2 mb-8">
					{blogPost.tags.map((tag) => (
						<Badge key={tag} variant="outline">
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
					<div className="text-muted-foreground space-y-4">
						<p>Post ID: {id}</p>
						<p>Subdomain: {subdomain}</p>

						{/* Links to other posts */}
						<div>
							<p className="font-medium mb-2">Other posts:</p>
							<div className="flex flex-wrap gap-2">
								{Array.from({ length: 10 }, (_, i) => i + 1).map((postId) => (
									<Link
										key={postId}
										href={`/${postId}`}
										className="px-2 py-1 text-sm bg-muted hover:bg-muted/80 rounded transition-colors"
									>
										{postId}
									</Link>
								))}
							</div>
						</div>
					</div>
				</footer>
			</div>
		</div>
	);
}
