import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/vps/")({
  beforeLoad: () => {
    throw redirect({
      to: "/vps/$tool",
      params: { tool: "overview" },
      replace: true,
    });
  },
});
