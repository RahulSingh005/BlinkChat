import { Link, useRouteError } from "react-router-dom";
import { RotateCcw } from "lucide-react";
import { LogoMark } from "../ui/Logo";

export default function RouteError() {
  const error = useRouteError();
  // A new deploy replaced the lazily loaded chunk: a reload fixes it.
  const staleChunk = /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(String(error?.message || error));

  return (
    <div className="app-shell flex flex-col items-center justify-center gap-5 bg-base-200 p-6 text-center">
      <LogoMark size={48} />
      <div>
        <h1 className="text-xl font-semibold">{staleChunk ? "BlinkChat was updated" : "Something went wrong"}</h1>
        <p className="mx-auto mt-1 max-w-sm text-sm text-base-content/60">
          {staleChunk ? "Reload to get the latest version." : "This page hit an unexpected error. Your messages are safe."}
        </p>
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary rounded-xl" onClick={() => window.location.reload()}>
          <RotateCcw className="size-4" /> Reload
        </button>
        <Link to="/chat" className="btn btn-ghost rounded-xl">
          Go to chats
        </Link>
      </div>
    </div>
  );
}
