import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

// The YAR dashboard is a browser-only app (all data lives in localStorage), so it is
// loaded after hydration and never evaluated during SSR.
const YarRoot = lazy(() => import("@/yar/YarRoot.jsx"));

function Splash() {
  return (
    <div className="yar-splash" role="status" aria-live="polite">
      <img src="/assets/yar-logo.svg" alt="YAR" width={120} height={60} />
    </div>
  );
}

export function YarApp() {
  return (
    <ClientOnly fallback={<Splash />}>
      <Suspense fallback={<Splash />}>
        <YarRoot />
      </Suspense>
    </ClientOnly>
  );
}
