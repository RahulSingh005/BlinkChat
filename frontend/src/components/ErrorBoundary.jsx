import { Component } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import StatusScreen from "./layout/StatusScreen";

/**
 * Last-resort boundary around the whole app: an unexpected render error
 * shows a recoverable screen instead of a blank page.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[BlinkChat] crashed:", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <StatusScreen
        icon={<TriangleAlert className="size-3.5" />}
        tone="error"
        title="Something went wrong"
        body="BlinkChat hit an unexpected error. Your messages are safe, and reloading usually fixes it."
        details={String(this.state.error?.message || this.state.error)}
      >
        <button type="button" className="btn btn-primary h-11 min-h-0 w-full rounded-xl px-6 sm:w-auto" onClick={() => window.location.reload()}>
          <RotateCcw className="size-4" /> Reload BlinkChat
        </button>
      </StatusScreen>
    );
  }
}
