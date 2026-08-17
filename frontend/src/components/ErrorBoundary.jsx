import { Component } from "react";

/**
 * Catches render-time crashes so one broken page cannot blank the whole app.
 *
 * Without this a thrown error in any page unmounts the React tree and the user
 * is left staring at an empty document with no way back.
 *
 * @param {object} props
 * @param {(error: Error, info: object) => void} [props.onError]  reporting hook
 * @param {React.ReactNode} [props.fallback]  custom fallback UI
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.props.onError?.(error, info);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="panel error-boundary" role="alert">
        <h2>This page could not be displayed</h2>
        <p className="muted">
          Something went wrong while rendering. Your notes are safe — this is a display problem.
        </p>
        <div className="row-inline" style={{ gap: "0.5rem" }}>
          <button type="button" className="primary-btn" onClick={this.reset}>
            Try again
          </button>
          <a className="ghost-btn" href="/">
            Back to the archive
          </a>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
