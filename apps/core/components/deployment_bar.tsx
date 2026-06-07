import { stringToColor } from "@/lib/deployment-id";
import { tryGetConfig } from "@platform/config";
import Link from "next/link";
import { Badge } from "./ui/badge";

export async function DeploymentBar() {
	const deploymentId = process.env.VERCEL_DEPLOYMENT_ID ?? "local";
	const rootDomain = tryGetConfig()?.rootDomain;
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
				{rootDomain ? (
					<Link
						className="text-sm font-bold"
						href={`https://${rootDomain}`}
					>
						Platform Home
					</Link>
				) : null}
				<Link className="text-sm font-bold" href="/">
					Tenant Home
				</Link>
				<Link className="text-sm font-bold" href="/admin">
					Admin
				</Link>
			</div>
		</div>
	);
}
