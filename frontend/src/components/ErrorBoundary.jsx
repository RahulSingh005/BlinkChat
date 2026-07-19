import { Component } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";

/**
 * Catches any uncaught render/runtime error anywhere below it in the tree
 * and shows a recoverable screen instead of a blank white page. Without
 * this, a single unexpected error (a flaky call, a bad network response,
 * a missing field on a user object, etc.) unmounts the entire React tree
 * and the app looks "crashed" with no way back except closing the tab.
 *
 * This is especially important on mobile, where flaky connections and
 * background/foreground tab suspension make edge-case errors more likely
 * to actually occur than they do on a desktop dev machine.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Centralized place to wire up real error reporting later
    // (Sentry, LogRocket, a custom /api/client-error endpoint, etc.)
    console.error("BlinkChat crashed:", error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh flex flex-col items-center justify-center gap-4 bg-base-200 p-6 text-center">
          <div className="size-14 rounded-2xl bg-error/10 flex items-center justify-center">
            <AlertTriangle className="size-7 text-error" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Something went wrong</h1>
            <p className="text-sm text-base-content/60 mt-1 max-w-sm">
              BlinkChat hit an unexpected error. Your messages are safe — try
              reloading the app.
            </p>
          </div>
          <button
            onClick={this.handleReload}
            className="btn btn-primary rounded-xl gap-2"
          >
            <RefreshCw className="size-4" />
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
