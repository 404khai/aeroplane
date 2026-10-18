import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { ProjectsDashboardSidebar } from "../src/client/features/projects/projects-dashboard-sidebar.js";
import {
  activeVpsTool,
  isVpsTool,
  vpsTools,
  workspaceSection,
} from "../src/client/features/observability/vps-tools.js";

async function sidebar(pathname: string, owner: boolean) {
  const root = createRootRoute({
    component: () =>
      createElement(ProjectsDashboardSidebar, {
        currentUser: null,
        tools: [],
        owner,
        showSystemHealth: false,
      }),
  });
  const routes = [
    "/",
    "/vps/$tool",
    "/settings/$settingsPage",
    "/$projectSlug/$serviceSlug",
  ].map((path) => createRoute({ getParentRoute: () => root, path }));
  const router = createRouter({
    routeTree: root.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [pathname] }),
  });
  await router.load();
  return renderToString(createElement(RouterProvider, { router }));
}
test("each owner tool has an independent sidebar route, icon and exactly one white selected entry", async () => {
  for (const tool of vpsTools) {
    const html = await sidebar(`/vps/${tool.slug}`, true);
    for (const entry of vpsTools)
      assert.ok(html.includes(`href="/vps/${entry.slug}"`), entry.label);
    const links = [...html.matchAll(/<a\b[^>]*>.*?<\/a>/gs)].map(
      (match) => match[0],
    );
    const selected = links.filter((link) => /aria-current="page"/.test(link));
    assert.equal(selected.length, 1, tool.slug);
    assert.ok(selected[0].includes(`href="/vps/${tool.slug}"`));
    assert.match(selected[0], /border-white/);
    assert.match(selected[0], /<svg/);
    assert.doesNotMatch(selected[0], /border-teal/);
  }
});
test("members have no owner tool links or mobile options", async () => {
  const html = await sidebar("/", false);
  assert.doesNotMatch(html, /href="\/vps\/|value="vps:/);
  assert.match(html, /Workspace navigation/);
});
test("legacy bookmarks select VPS while settings and managed services select their own section", async () => {
  assert.equal(activeVpsTool("/settings/vps-overview"), "overview");
  assert.equal(activeVpsTool("/vps/metrics/"), "metrics");
  assert.equal(activeVpsTool("/vps/not-a-tool"), undefined);
  assert.equal(isVpsTool("not-a-tool"), false);
  assert.equal(workspaceSection("/settings/domains"), "settings");
  assert.equal(workspaceSection("/sample/api"), "projects");
  for (const [path, target] of [
    ["/settings/vps-overview", "/vps/overview"],
    ["/settings/domains", "/settings/domains"],
    ["/sample/api", "/"],
  ]) {
    const html = await sidebar(path, true);
    const selected = [...html.matchAll(/<a\b[^>]*>.*?<\/a>/gs)]
      .map((match) => match[0])
      .filter((link) => /aria-current="page"/.test(link));
    assert.equal(selected.length, 1, path);
    assert.ok(selected[0].includes(`href="${target}"`));
  }
});
