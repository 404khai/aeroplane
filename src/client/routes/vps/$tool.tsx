import { createFileRoute, notFound } from "@tanstack/react-router";
import { isVpsTool } from "../../features/observability/vps-tools";
import { VpsToolsPage } from "../../pages/vps-tools-page";
export const Route = createFileRoute("/vps/$tool")({ component: VpsToolRoute });
function VpsToolRoute() {
  const { tool } = Route.useParams();
  if (!isVpsTool(tool)) throw notFound();
  return <VpsToolsPage tool={tool} />;
}
