import { VpsToolsPage } from "./vps-tools-page";
// Preserve bookmarks to /settings/vps-overview while new sidebar links use /vps/overview.
export function VpsOverviewPage() {
  return <VpsToolsPage tool="overview" />;
}
