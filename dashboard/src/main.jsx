import { Component, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { configError } from "./firebase";
import "./App.css";

// Show what went wrong instead of a blank page.
const Problem = ({ title, lines }) => (
  <div style={{ maxWidth: 640, margin: "48px auto", padding: 24, font: "15px/1.6 system-ui, sans-serif", color: "#24201C" }}>
    <h1 style={{ fontSize: 20, margin: "0 0 12px" }}>{title}</h1>
    {lines.map((l, i) => <p key={i} style={{ margin: "6px 0" }}>{l}</p>)}
  </div>
);

class Boundary extends Component {
  state = { err: null };
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    return this.state.err
      ? <Problem title="The dashboard hit an error" lines={[String(this.state.err?.message || this.state.err), "Open the browser console (F12) for the full trace."]} />
      : this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {configError
      ? <Problem title="Firebase settings are missing" lines={[configError, "Copy .env.example to .env in the dashboard folder, fill in the values from the Firebase console (Project settings, Your apps, Web), then stop and restart npm run dev."]} />
      : <Boundary><App /></Boundary>}
  </StrictMode>
);
