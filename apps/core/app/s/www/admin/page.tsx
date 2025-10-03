import { getAllSubdomains } from "@/lib/subdomains";
import type { Metadata } from "next";
import { AdminDashboard } from "./dashboard";

export const metadata: Metadata = {
	title: `Admin Dashboard | ${process.env.NEXT_PUBLIC_ROOT_DOMAIN || "high-performance-platform.com"}`,
	description: `Manage subdomains for ${process.env.NEXT_PUBLIC_ROOT_DOMAIN || "high-performance-platform.com"}`,
};

export default async function AdminPage() {
	// TODO: You can add authentication here with your preferred auth provider
	const tenants = await getAllSubdomains();

	return (
		<div className="min-h-screen p-4 md:p-8">
			<span className="hidden" aria-hidden="true">
				$validator_admin_page$
			</span>
			<AdminDashboard tenants={tenants} />
		</div>
	);
}
