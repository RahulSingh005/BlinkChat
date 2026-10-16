import { Outlet, useMatch } from "react-router-dom";
import BottomNav from "./BottomNav";
import ConnectionBanner from "./ConnectionBanner";
import NavRail from "./NavRail";

/**
 * Signed-in layout. Phones: content + bottom tabs (hidden inside a chat so
 * the conversation gets the full screen). Tablets/desktop: icon rail.
 */
export default function AppShell() {
  const inChat = Boolean(useMatch("/chat/:conversationId"));

  return (
    <div className="app-shell flex overflow-hidden bg-base-200">
      <NavRail />
      <div className="flex min-w-0 flex-1 flex-col">
        <ConnectionBanner />
        <main className="relative flex min-h-0 flex-1">
          <Outlet />
        </main>
        {!inChat && <BottomNav />}
      </div>
    </div>
  );
}
