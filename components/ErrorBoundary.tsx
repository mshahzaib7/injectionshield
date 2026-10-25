"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Short name of what failed, e.g. "chart" or "detector". */
  what: string;
}

/** Keeps one broken widget from blanking the whole page. */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="rounded-2xl border-2 border-dashed border-line bg-surface p-6 text-ink">
        <p className="font-bold">This {this.props.what} could not be displayed.</p>
        <p className="mt-1 text-sm text-muted">The rest of the page still works. Reloading may help.</p>
        <button
          type="button"
          onClick={() => this.setState({ failed: false })}
          className="mt-4 rounded-full border-2 border-line px-4 py-2 text-sm font-bold hover:bg-ink hover:text-bg"
        >
          Try again
        </button>
      </div>
    );
  }
}
