import Link from "next/link";
import { SubdomainForm } from "./subdomain-form";

export const dynamic = "force-static";
export const revalidate = 3600;

export default async function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 relative">
      <span className="hidden" aria-hidden="true">
        $validator_home_page$
      </span>

      <div className="absolute top-4 right-4">
        <Link href="/admin" className="text-sm transition-colors">
          Admin
        </Link>
      </div>

      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            Multi-Tenant Platform with Shielded ISR Cache
          </h1>
          <p className="mt-3 text-md text-muted-foreground">
            Reference architecture by{" "}
            <span className="font-bold text-foreground">Vercel</span>
          </p>
        </div>

        <div className="mt-8 shadow-md rounded-lg p-6">
          <SubdomainForm host={process.env.NEXT_PUBLIC_ROOT_DOMAIN} />
        </div>
      </div>
    </div>
  );
}
