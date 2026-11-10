import { createFileRoute } from "@tanstack/react-router";
import { YarApp } from "@/components/YarApp";

// Legacy path-style bookmarks (/hotels, /bookings, ...) resolve to the same dashboard.
export const Route = createFileRoute("/$page")({
  head: () => ({
    meta: [
      { title: "YAR Admin" },
      { name: "description", content: "Internal YAR travel operations dashboard." },
      { property: "og:title", content: "YAR Admin" },
      { property: "og:description", content: "Internal YAR travel operations dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: YarApp,
});
