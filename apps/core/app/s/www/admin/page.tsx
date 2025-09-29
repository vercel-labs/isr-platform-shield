import { getAllSubdomains } from "@/lib/subdomains";
import type { Metadata } from "next";
import { AdminDashboard } from "./dashboard";
// Using environment variables directly

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: `Admin Dashboard | ${process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000"}`,
	description: `Manage subdomains for ${process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000"}`,
};

export default async function AdminPage() {
	// TODO: You can add authentication here with your preferred auth provider
	const tenants = await getAllSubdomains();

	return (
		<div className="min-h-screen p-4 md:p-8">
			<AdminDashboard tenants={tenants} />
		</div>
	);
}
