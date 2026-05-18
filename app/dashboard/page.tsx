"use client";
// app/dashboard/page.tsx
import { useEffect, useState, useCallback } from "react";
import Nav from "@/components/Nav";

interface Lead {
  id: number;
  name: string;
  phone: string;
  city: string;
  description: string;
  createdAt: string;
  service: { name: string };
}

interface Assignment {
  id: number;
  assignedAt: string;
  lead: Lead;
}

interface Provider {
  id: number;
  name: string;
  monthlyQuota: number;
  leadsReceived: number;
  assignments: Assignment[];
}

function QuotaBar({ used, max }: { used: number; max: number }) {
  const pct = max > 0 ? Math.min((used / max) * 100, 100) : 0;
  const cls = pct >= 100 ? "full" : pct >= 70 ? "warn" : "";
  return (
    <div className="quota-bar-wrap">
      <div className={`quota-bar ${cls}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function DashboardPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch("/api/providers");
      const data = await res.json();
      setProviders(data);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();

    // Set up SSE for real-time updates
    const evtSource = new EventSource("/api/sse");

    evtSource.onopen = () => setConnected(true);

    evtSource.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "heartbeat" || data.type === "connected") return;
      // Any lead or quota update → refetch
      fetchProviders();
    };

    evtSource.onerror = () => {
      setConnected(false);
    };

    return () => {
      evtSource.close();
      setConnected(false);
    };
  }, [fetchProviders]);

  const totalLeads = providers.reduce((s, p) => s + p.leadsReceived, 0);

  return (
    <>
      <Nav />
      <main className="page">
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginBottom: "0.4rem" }}>
          <h1 className="page-title" style={{ margin: 0 }}>Provider Dashboard</h1>
          <div style={{ fontSize: "0.75rem", color: connected ? "var(--success)" : "var(--text-muted)" }}>
            {connected ? <><span className="live-dot" />Live</> : "Connecting…"}
          </div>
        </div>
        <p className="page-sub">
          Real-time view of all provider quotas and assigned leads.
          {lastUpdate && (
            <span style={{ marginLeft: "0.5rem", color: "var(--text-muted)" }}>
              Updated at {lastUpdate}
            </span>
          )}
        </p>

        {/* Summary bar */}
        <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          {[
            { label: "Providers", value: providers.length },
            { label: "Total Leads", value: totalLeads },
            { label: "Quota Used", value: providers.length > 0 ? `${Math.round((totalLeads / (providers.length * 10)) * 100)}%` : "0%" },
          ].map((s) => (
            <div key={s.label} className="card" style={{ padding: "0.8rem 1.2rem", minWidth: 120 }}>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 600, color: "var(--text)", marginTop: "0.2rem" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Loading providers…</div>
        ) : (
          <div className="grid-2">
            {providers.map((p) => {
              const remaining = p.monthlyQuota - p.leadsReceived;
              const isExpanded = expanded === p.id;
              return (
                <div key={p.id} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{p.name}</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                        {p.leadsReceived} leads received
                      </div>
                    </div>
                    <span
                      className={`badge ${remaining === 0 ? "badge-red" : remaining <= 3 ? "badge-yellow" : "badge-green"}`}
                    >
                      {remaining} left
                    </span>
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.3rem" }}>
                      <span>Quota</span>
                      <span>{p.leadsReceived} / {p.monthlyQuota}</span>
                    </div>
                    <QuotaBar used={p.leadsReceived} max={p.monthlyQuota} />
                  </div>

                  {p.assignments.length > 0 && (
                    <>
                      <hr className="divider" style={{ margin: "0.2rem 0" }} />
                      <div
                        style={{ fontSize: "0.72rem", color: "var(--accent)", cursor: "pointer", userSelect: "none" }}
                        onClick={() => setExpanded(isExpanded ? null : p.id)}
                      >
                        {isExpanded ? "▲ Hide" : "▼ Show"} {p.assignments.length} lead{p.assignments.length !== 1 ? "s" : ""}
                      </div>

                      {isExpanded && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: 260, overflowY: "auto" }}>
                          {p.assignments.map((a) => (
                            <div
                              key={a.id}
                              style={{
                                background: "var(--surface2)",
                                borderRadius: 6,
                                padding: "0.6rem 0.8rem",
                                fontSize: "0.78rem",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                                <strong>{a.lead.name}</strong>
                                <span className="badge badge-blue">{a.lead.service.name}</span>
                              </div>
                              <div style={{ color: "var(--text-muted)" }}>{a.lead.city} · {a.lead.phone}</div>
                              <div style={{ color: "var(--text-muted)", marginTop: "0.2rem", fontSize: "0.72rem" }}>
                                {new Date(a.assignedAt).toLocaleString()}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
