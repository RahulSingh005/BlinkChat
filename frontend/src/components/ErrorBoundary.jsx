import { Component } from "react";

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
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-base-200 p-6 text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="max-w-sm text-sm text-base-content/60">BlinkChat hit an unexpected error. Your messages are safe — reloading usually fixes it.</p>
        <button type="button" className="btn btn-primary rounded-xl" onClick={() => window.location.reload()}>
          Reload BlinkChat
        </button>
      </div>
    );
  }
}
