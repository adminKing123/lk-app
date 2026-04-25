import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import StartPage        from "./pages/StartPage";
import ConversationPage from "./pages/ConversationPage";

/* ─────────────────────────────────────────────────────────────────────────────
   ServerGate — pings /health before rendering any route.

   States:
     'checking'  — initial fetch in-flight (full-screen spinner)
     'up'        — server responded OK → render children normally
     'down'      — server unreachable or returned non-OK → error screen
───────────────────────────────────────────────────────────────────────────── */
function ServerGate({ children }) {
  const [status, setStatus] = useState("checking"); // 'checking' | 'up' | 'down'
  const [errorMsg, setErrorMsg] = useState("");

  const checkHealth = async () => {
    setStatus("checking");
    setErrorMsg("");

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    /* Fetch never throws — always resolves with {ok, msg} */
    const doFetch = async () => {
      try {
        const base = import.meta.env.VITE_BACKEND_URL ?? "";
        const url  = base ? `${base}/health` : "/api/health";
        const res  = await fetch(url, { method: "GET", signal: AbortSignal.timeout(8000) });
        return res.ok
          ? { ok: true }
          : { ok: false, msg: `Server responded with status ${res.status}.` };
      } catch (err) {
        const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError";
        return {
          ok: false,
          msg: isTimeout
            ? "Connection timed out. The server may be starting up — please try again."
            : "Could not reach the backend server. Make sure it is running.",
        };
      }
    };

    /* Always show the animation for at least 3 seconds */
    const [result] = await Promise.all([doFetch(), sleep(3000)]);

    if (result.ok) {
      setStatus("up");
    } else {
      setErrorMsg(result.msg);
      setStatus("down");
    }
  };

  useEffect(() => { checkHealth(); }, []);

  /* ── Checking — clean splash screen ── */
  if (status === "checking") {
    return (
      <div style={gateStyles.page}>
        <h1 style={gateStyles.appName}>AI Assistant</h1>
        <p style={gateStyles.label}>Starting up…</p>
        {/* Thin indeterminate shimmer bar */}
        <div style={gateStyles.barTrack}>
          <div style={gateStyles.barFill} />
        </div>
      </div>
    );
  }

  /* ── Down (error screen) ── */
  if (status === "down") {
    return (
      <div style={gateStyles.page}>
        <div style={gateStyles.card}>
          {/* Warning icon */}
          <svg style={gateStyles.icon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
              stroke="#f28b82" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h1 style={gateStyles.title}>Server Unavailable</h1>
          <p style={gateStyles.message}>{errorMsg}</p>
          <button style={gateStyles.retryBtn} onClick={checkHealth}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  /* ── Up — render routes normally ── */
  return children;
}

/* Inline styles — keeps this self-contained without a new CSS file */
const gateStyles = {
  page: {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    background: "#0f1117",
    animation: "gate-fadein 0.4s ease",
  },
  appName: {
    fontSize: "1.75rem",
    fontWeight: 600,
    color: "#e8eaed",
    letterSpacing: "-0.01em",
    margin: 0,
    marginBottom: "10px",
  },
  label: {
    fontSize: "0.875rem",
    color: "rgba(255,255,255,0.35)",
    margin: 0,
    marginBottom: "24px",
  },
  barTrack: {
    width: "180px",
    height: "2px",
    background: "rgba(255,255,255,0.08)",
    borderRadius: "999px",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    width: "45%",
    borderRadius: "999px",
    background: "linear-gradient(90deg, transparent, #8ab4f8, transparent)",
    animation: "gate-shimmer 1.6s ease-in-out infinite",
  },
  card: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "14px",
    padding: "40px 36px",
    borderRadius: "20px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    maxWidth: "380px",
    width: "90vw",
    textAlign: "center",
  },
  icon: {
    width: "48px",
    height: "48px",
    flexShrink: 0,
  },
  title: {
    fontSize: "1.25rem",
    fontWeight: 600,
    color: "#e8eaed",
    margin: 0,
  },
  message: {
    fontSize: "0.9rem",
    color: "rgba(255,255,255,0.5)",
    lineHeight: 1.6,
    margin: 0,
  },
  retryBtn: {
    marginTop: "4px",
    padding: "0 28px",
    height: "44px",
    borderRadius: "999px",
    border: "none",
    background: "#1a73e8",
    color: "#fff",
    fontSize: "0.9375rem",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
};

/* Inject keyframes once into the document head */
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `
    @keyframes gate-shimmer {
      0%   { transform: translateX(-200%); }
      100% { transform: translateX(450%); }
    }
    @keyframes gate-fadein {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

function App() {
  return (
    <ServerGate>
      <BrowserRouter>
        <Routes>
          {/* Landing screen — generates token and navigates to conversation */}
          <Route path="/" element={<StartPage />} />

          {/* Conversation screen — avatar video + mic + transcript */}
          <Route path="/conversation" element={<ConversationPage />} />

          {/* Redirect everything else to the start screen */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ServerGate>
  );
}

export default App;

