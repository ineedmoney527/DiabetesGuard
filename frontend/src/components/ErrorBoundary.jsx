import React, { Component } from "react";
import logger from "../utils/logger";

/**
 * Error Boundary component that catches JavaScript errors in its child component tree,
 * logs those errors, and displays a fallback UI instead of crashing the whole app.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to our structured logging system
    logger.error("React component error", error, {
      componentStack: errorInfo.componentStack,
      component: this.props.componentName || "unknown",
    });
  }

  render() {
    if (this.state.hasError) {
      // Render fallback UI
      return (
        this.props.fallback || (
          <div className="error-boundary">
            <h2>Something went wrong.</h2>
            <p>
              The application encountered an unexpected error. Please try
              refreshing the page.
            </p>
            {process.env.NODE_ENV !== "production" && (
              <details style={{ whiteSpace: "pre-wrap" }}>
                <summary>Error details</summary>
                <p>{this.state.error && this.state.error.toString()}</p>
              </details>
            )}
          </div>
        )
      );
    }

    // If no error occurred, render children normally
    return this.props.children;
  }
}

export default ErrorBoundary;
