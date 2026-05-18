"use client";
// app/request-service/page.tsx
import { useState } from "react";
import Nav from "@/components/Nav";

interface Service {
  id: number;
  name: string;
}

const SERVICES: Service[] = [
  { id: 1, name: "Service 1" },
  { id: 2, name: "Service 2" },
  { id: 3, name: "Service 3" },
];

export default function RequestServicePage() {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    city: "",
    serviceId: "",
    description: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [assignedProviders, setAssignedProviders] = useState<string[]>([]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    setAssignedProviders([]);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          serviceId: Number(form.serviceId),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Something went wrong.");
        return;
      }

      // Fetch assigned providers for this lead
      const leadId = data.lead?.id;
      if (leadId) {
        const leadsRes = await fetch("/api/leads");
        const leads = await leadsRes.json();
        const lead = leads.find((l: { id: number; assignments: { provider: { name: string } }[] }) => l.id === leadId);
        if (lead) {
          setAssignedProviders(lead.assignments.map((a: { provider: { name: string } }) => a.provider.name));
        }
      }

      setStatus("success");
      setMessage("Your service request has been submitted successfully!");
      setForm({ name: "", phone: "", city: "", serviceId: "", description: "" });
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  };

  return (
    <>
      <Nav />
      <main className="page" style={{ maxWidth: 560 }}>
        <h1 className="page-title">Request a Service</h1>
        <p className="page-sub">Fill in the form below and a provider will be assigned to you automatically.</p>

        {status === "success" && (
          <div className="alert alert-success">
            ✓ {message}
            {assignedProviders.length > 0 && (
              <div style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>
                Assigned to:{" "}
                {assignedProviders.map((p) => (
                  <span key={p} className="tag" style={{ color: "var(--success)", borderColor: "var(--success)" }}>
                    {p}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {status === "error" && (
          <div className="alert alert-error">✗ {message}</div>
        )}

        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                className="form-input"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. Ravi Kumar"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                className="form-input"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="e.g. 9999999999"
                required
                pattern="[0-9]+"
                title="Digits only"
              />
            </div>

            <div className="form-group">
              <label className="form-label">City</label>
              <input
                className="form-input"
                name="city"
                value={form.city}
                onChange={handleChange}
                placeholder="e.g. Bangalore"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Service Type</label>
              <select
                className="form-input"
                name="serviceId"
                value={form.serviceId}
                onChange={handleChange}
                required
              >
                <option value="">— Select a service —</option>
                {SERVICES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-input"
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Describe what you need..."
                rows={4}
                required
                style={{ resize: "vertical" }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={status === "loading"}
              style={{ width: "100%" }}
            >
              {status === "loading" ? "Submitting…" : "Submit Request"}
            </button>
          </form>
        </div>

        <div className="card" style={{ marginTop: "1rem", padding: "0.9rem 1.2rem" }}>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.7 }}>
            <strong style={{ color: "var(--text-dim)" }}>Note:</strong> The same phone number cannot submit two requests for the same service. You may request different services with the same number.
          </div>
        </div>
      </main>
    </>
  );
}
