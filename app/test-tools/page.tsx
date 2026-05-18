"use client";
// app/test-tools/page.tsx
import { useState } from "react";
import Nav from "@/components/Nav";

type LogEntry = { time: string; type: "info" | "success" | "error" | "warn"; msg: string };

export default function TestToolsPage() {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const addLog = (type: LogEntry["type"], msg: string) => {
    setLog((prev) => [
      { time: new Date().toLocaleTimeString(), type, msg },
      ...prev,
    ]);
  };

  const setL = (key: string, val: boolean) =>
    setLoading((prev) => ({ ...prev, [key]: val }));

  // ── Reset quota via webhook with a fresh idempotency key
  const resetQuota = async () => {
    const key = `reset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setL("reset", true);
    addLog("info", `POST /api/webhook  Idempotency-Key: ${key}`);
    try {
      const res = await fetch("/api/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        body: JSON.stringify({ action: "reset_quota" }),
      });
      const data = await res.json();
      addLog(res.ok ? "success" : "error", JSON.stringify(data));
    } catch (e) {
      addLog("error", String(e));
    } finally {
      setL("reset", false);
    }
  };

  // ── Call webhook 5× with the SAME idempotency key to verify idempotency
  const testIdempotency = async () => {
    const key = `idem-test-${Date.now()}`;
    setL("idem", true);
    addLog("info", `Calling webhook 5× with the same key: ${key}`);
    for (let i = 1; i <= 5; i++) {
      try {
        const res = await fetch("/api/webhook", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": key,
          },
          body: JSON.stringify({ action: "reset_quota" }),
        });
        const data = await res.json();
        addLog(
          data.status === "already_processed" ? "warn" : "success",
          `Call ${i}: ${JSON.stringify(data)}`
        );
      } catch (e) {
        addLog("error", `Call ${i}: ${String(e)}`);
      }
    }
    setL("idem", false);
  };

  // ── Generate 10 concurrent leads
  const bulkLeads = async () => {
    setL("bulk", true);
    addLog("info", "Generating 10 concurrent leads…");
    try {
      const res = await fetch("/api/leads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 10 }),
      });
      const data = await res.json();
      const ok = data.results?.filter((r: { status: string }) => r.status === "ok").length ?? 0;
      const fail = (data.results?.length ?? 0) - ok;
      addLog(fail === 0 ? "success" : "warn", `Done. ${ok} ok, ${fail} failed.`);
      data.results?.forEach((r: { leadId: number; service: string; status: string }) => {
        addLog(r.status === "ok" ? "success" : "error", `  Lead #${r.leadId} [${r.service}]: ${r.status}`);
      });
    } catch (e) {
      addLog("error", String(e));
    } finally {
      setL("bulk", false);
    }
  };

  const clearLog = () => setLog([]);

  const logColor: Record<LogEntry["type"], string> = {
    info: "var(--text-muted)",
    success: "var(--success)",
    error: "var(--danger)",
    warn: "var(--warn)",
  };

  return (
    <>
      <Nav />
      <main className="page">
        <h1 className="page-title">Test Tools</h1>
        <p className="page-sub">
          Simulate payment webhooks, test idempotency, and generate concurrent leads. This panel exists for QA only — quota resets are only possible via webhook.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
          {/* Reset Quota */}
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: "0.4rem" }}>Reset Provider Quotas</div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "1rem", lineHeight: 1.5 }}>
              Simulates a successful subscription payment. Sends webhook with a new idempotency key. All providers get quota reset to 10.
            </div>
            <button
              className="btn btn-primary"
              onClick={resetQuota}
              disabled={loading["reset"]}
              style={{ width: "100%" }}
            >
              {loading["reset"] ? "Resetting…" : "↺ Reset Quota via Webhook"}
            </button>
          </div>

          {/* Idempotency test */}
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: "0.4rem" }}>Test Webhook Idempotency</div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "1rem", lineHeight: 1.5 }}>
              Fires the same webhook 5× with an identical idempotency key. Only the first call should apply; the rest return <code style={{ color: "var(--warn)" }}>already_processed</code>.
            </div>
            <button
              className="btn btn-outline"
              onClick={testIdempotency}
              disabled={loading["idem"]}
              style={{ width: "100%" }}
            >
              {loading["idem"] ? "Running…" : "⚡ Call Webhook 5× (Same Key)"}
            </button>
          </div>

          {/* Bulk leads */}
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: "0.4rem" }}>Generate 10 Concurrent Leads</div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "1rem", lineHeight: 1.5 }}>
              Creates 10 leads simultaneously via <code style={{ color: "var(--accent)" }}>Promise.allSettled</code> to stress-test concurrency handling and allocation correctness.
            </div>
            <button
              className="btn btn-outline"
              onClick={bulkLeads}
              disabled={loading["bulk"]}
              style={{ width: "100%" }}
            >
              {loading["bulk"] ? "Generating…" : "⚙ Generate 10 Leads"}
            </button>
          </div>
        </div>

        {/* Log panel */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Activity Log
            </div>
            <button className="btn btn-outline" onClick={clearLog} style={{ fontSize: "0.7rem", padding: "0.25rem 0.6rem" }}>
              Clear
            </button>
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: "0.78rem",
              background: "var(--bg)",
              borderRadius: 6,
              padding: "0.8rem",
              minHeight: 120,
              maxHeight: 400,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
            }}
          >
            {log.length === 0 ? (
              <span style={{ color: "var(--text-muted)" }}>No activity yet. Run a test above.</span>
            ) : (
              log.map((entry, i) => (
                <div key={i} style={{ color: logColor[entry.type] }}>
                  <span style={{ color: "var(--text-muted)", marginRight: "0.6rem" }}>{entry.time}</span>
                  {entry.msg}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="alert alert-info" style={{ marginTop: "1rem" }}>
          <strong>Implementation notes:</strong> Advisory locks (<code>pg_advisory_xact_lock</code>) + serializable transactions prevent duplicate assignments under concurrent load. Idempotency keys are stored in <code>WebhookEvent</code> table; re-submitted keys short-circuit without any DB writes.
        </div>
      </main>
    </>
  );
}
