import { useEffect, useState } from "react";

const NOTICE =
  "Session state lives in Redis for 30 minutes, keyed by session id only. No user identity is stored. Telemetry hashes session ids. Raw logging is off.";

const SEEN_KEY = "prelude_privacy_seen";

export function PrivacyNotice() {
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) setShowDialog(true);
    } catch {
      // private-browsing or blocked storage — just skip the first-visit dialog
    }
  }, []);

  function dismiss() {
    setShowDialog(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // best-effort
    }
  }

  return (
    <>
      <footer className="privacy-footer">
        {NOTICE} <a href="/documentation/SECURITY.md">SECURITY.md</a>
      </footer>
      {showDialog && (
        <div className="drawer-backdrop" onClick={dismiss}>
          <div className="drawer privacy-dialog" onClick={(e) => e.stopPropagation()}>
            <p>{NOTICE}</p>
            <button className="btn-quiet" onClick={dismiss}>
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
