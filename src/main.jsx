
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("CloudClass rendering error:", error);
    console.error(info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{
          padding: "32px",
          fontFamily: "Arial, sans-serif",
          color: "#20283b"
        }}>
          <h1>CloudClass could not load</h1>
          <p>JavaScript error:</p>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {String(this.state.error.message || this.state.error)}
          </pre>
          <button onClick={() => window.location.reload()}>
            Reload page
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}

const root = document.getElementById("root");

if (!root) {
  throw new Error('Missing <div id="root"></div> in index.html');
}

createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
