import { stringToColor } from "@/lib/deployment-id";
import { Badge } from "./ui/badge";

export async function DeploymentBar() {
  const deploymentId = process.env.VERCEL_DEPLOYMENT_ID ?? 'local';
  const deploymentDate = new Date().toLocaleString("en-US", { timeZone: "America/New_York" }); // sorry i need this
  const dateColor = await stringToColor(deploymentDate);
  const idColor = await stringToColor(deploymentId);

  return (
    <div className="px-3 py-1 text-background flex justify-between">
      <Badge className="text-sm font-bold" style={{ backgroundColor: dateColor }}>
        {deploymentDate}
      </Badge>
      <Badge className="text-sm font-bold" style={{ backgroundColor: idColor }}>
      {deploymentId}
      </Badge>
    </div>
  );
}