import { stringToColor } from "@/lib/deployment-id";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import Link from "next/link";

export async function DeploymentBar() {
	const deploymentId = process.env.VERCEL_DEPLOYMENT_ID ?? "local";
	const deploymentDate = new Date().toLocaleString("en-US", {
		timeZone: "America/New_York",
	}); // sorry i need this
	const dateColor = await stringToColor(deploymentDate);
	const idColor = await stringToColor(deploymentId);

	return (
		<div className="px-3 py-1 text-background flex justify-between">
			<div className="flex gap-2">
				<Badge
					className="text-sm font-bold"
					style={{ backgroundColor: dateColor }}
				>
					{deploymentDate}
				</Badge>
				<Badge
					className="text-sm font-bold"
					style={{ backgroundColor: idColor }}
				>
					{deploymentId}
				</Badge>
			</div>
			<div className="flex gap-2">
				<Button>
					<Link href={`https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`}>
						Platform Home
					</Link>
					<Link href="/">Tenant Home</Link>
					<Link href="/admin">Admin</Link>
				</Button>
			</div>
		</div>
	);
}
