import { stringToColor } from "@/lib/deployment-id";

export async function DeploymentBar() {
  const deploymentId = process.env.VERCEL_DEPLOYMENT_ID ?? 'local';
  const deploymentDate = new Date().toLocaleString("en-US", { timeZone: "America/New_York" }); // sorry i need this
  const color = await stringToColor(`${deploymentId};${deploymentDate}`);

  return (
    <div className="px-3 py-1 text-sm text-background flex justify-between" style={{ backgroundColor: color }}>
      <span className="font-bold">
        {deploymentDate}
      </span>
      <span>
      {deploymentId}
      </span>
    </div>
  );
}