import Link from 'next/link';
import { SubdomainForm } from './subdomain-form';
import { rootDomain } from '@/lib/utils';

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
            {rootDomain}
          </h1>
          <p className="mt-3 text-lg">
            Create your own subdomain with a custom emoji
          </p>
        </div>

        <div className="mt-8 shadow-md rounded-lg p-6">
          <SubdomainForm />
        </div>
      </div>
    </div>
  );
}
