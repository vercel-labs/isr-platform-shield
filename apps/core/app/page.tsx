import Link from 'next/link';
import { SubdomainForm } from './subdomain-form';

export default async function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4">
        <Link
          href="/admin"
          className="text-sm transition-colors"
        >
          Admin
        </Link>
      </div>

      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            Multi-Tenant Platform with Durable ISR Cache
          </h1>
          <p className="mt-3 text-md text-muted-foreground">
            Reference architecture by the <br/><span className="font-bold text-foreground">Vercel Developer Success Team</span>
          </p>
        </div>

        <div className="mt-8 shadow-md rounded-lg p-6">
          <SubdomainForm host={process.env.CACHE_LAYER_HOST} />
        </div>
      </div>
    </div>
  );
}
