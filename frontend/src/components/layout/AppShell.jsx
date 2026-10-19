import { lazy, Suspense } from "react";
import { Outlet, useMatch } from "react-router-dom";
import AppLock from "./AppLock";
import BottomNav from "./BottomNav";
import ConnectionBanner from "./ConnectionBanner";
import NavRail from "./NavRail";
import { useStoryStore } from "../../store/useStoryStore";

const StoryViewer = lazy(() => import("../stories/StoryViewer"));
const StoryComposer = lazy(() => import("../stories/StoryComposer"));

/**
 * Signed-in layout. Phones: content + bottom tabs (hidden inside a chat or a
 * settings page so they get the full screen). Tablets/desktop: icon rail.
 */
export default function AppShell() {
  const inChat = Boolean(useMatch("/chat/:conversationId"));
  const inSection = Boolean(useMatch("/settings/:section"));
  const viewer = useStoryStore((s) => Boolean(s.viewer));
  const composer = useStoryStore((s) => Boolean(s.composer));

  return (
    <div className="app-shell flex overflow-hidden bg-base-200">
      <NavRail />
      <div className="flex min-w-0 flex-1 flex-col">
        <ConnectionBanner />
        <main className="relative flex min-h-0 flex-1">
          <Outlet />
        </main>
        {!inChat && !inSection && <BottomNav />}
      </div>
      <Suspense fallback={null}>
        {viewer && <StoryViewer />}
        {composer && <StoryComposer />}
      </Suspense>
      <AppLock />
    </div>
  );
}
