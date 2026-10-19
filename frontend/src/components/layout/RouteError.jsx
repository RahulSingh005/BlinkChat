import { Link, isRouteErrorResponse, useRouteError } from "react-router-dom";
import { CloudOff, Home, RotateCcw, Sparkles, TriangleAlert } from "lucide-react";
import StatusScreen from "./StatusScreen";

export default function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : String(error?.message || error || "");
  // A new deploy replaced the lazily loaded chunk: a reload fixes it.
  const staleChunk = /dynamically imported module|Importing a module script failed|error loading dynamically/i.test(message);
  const offline = typeof navigator !== "undefined" && !navigator.onLine;

  const title = staleChunk ? "A new version is ready" : offline ? "You're offline" : "Something went wrong";
  const body = staleChunk
    ? "BlinkChat was updated while you were away. Reload to get the latest version."
    : offline
      ? "Check your internet connection, then try again."
      : "This screen hit an unexpected error. Your messages are safe, and reloading usually fixes it.";
  const icon = staleChunk ? <Sparkles className="size-3.5" /> : offline ? <CloudOff className="size-3.5" /> : <TriangleAlert className="size-3.5" />;

  return (
    <StatusScreen icon={icon} tone={staleChunk ? "primary" : "error"} title={title} body={body} details={staleChunk || offline ? null : message}>
      <button type="button" className="btn btn-primary h-11 min-h-0 w-full rounded-xl px-6 sm:w-auto" onClick={() => window.location.reload()}>
        <RotateCcw className="size-4" /> Reload
      </button>
      <Link to="/chat" reloadDocument className="btn h-11 min-h-0 w-full rounded-xl border-base-300 bg-base-100 px-6 sm:w-auto">
        <Home className="size-4" /> Go home
      </Link>
    </StatusScreen>
  );
}
