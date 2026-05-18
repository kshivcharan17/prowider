// app/page.tsx
import Link from "next/link";
import Nav from "@/components/Nav";

export default function Home() {
  return (
    <>
      <Nav />
      <main className="page" style={{ maxWidth: 700, paddingTop: "4rem" }}>
        <p style={{ color: "var(--accent)", fontSize: "0.75rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.8rem" }}>
          Mini Lead Distribution System
        </p>
        <h1 className="page-title" style={{ fontSize: "2.2rem", lineHeight: 1.2 }}>
          Prowider
        </h1>
        <p className="page-sub" style={{ fontSize: "0.95rem", marginBottom: "2.5rem", lineHeight: 1.6 }}>
          A real-time lead generation and fair distribution platform. Customers submit service enquiries; providers receive leads automatically via round-robin allocation with quota management.
        </p>

        <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap" }}>
          <Link href="/request-service" className="btn btn-primary">
            Submit a Service Request →
          </Link>
          <Link href="/dashboard" className="btn btn-outline">
            View Provider Dashboard
          </Link>
          <Link href="/test-tools" className="btn btn-outline">
            Test Tools Panel
          </Link>
        </div>

        <hr className="divider" style={{ marginTop: "3rem" }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          {[
            { label: "Allocation", desc: "Mandatory + round-robin fair distribution" },
            { label: "Concurrency", desc: "Serializable transactions + advisory locks" },
            { label: "Real-time", desc: "Server-Sent Events push to all dashboards" },
            { label: "Idempotency", desc: "Webhook keys prevent duplicate quota resets" },
          ].map((f) => (
            <div key={f.label} className="card" style={{ padding: "1rem" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.3rem" }}>
                {f.label}
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-dim)" }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
