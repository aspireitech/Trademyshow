"use client";

import { useEffect, useState } from "react";
import { apiFetch, apiPost } from "@/lib/apiClient";

interface ContractRow {
  contractId: string;
  termsVersion: string;
  acceptedAt: string;
}

export default function DataSection() {
  const [contracts, setContracts] = useState<ContractRow[] | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void apiFetch("/api/account/contract")
      .then((r) => (r.ok ? r.json() : { contracts: [] }))
      .then((d: { contracts: ContractRow[] }) => setContracts(d.contracts));
  }, []);

  async function remove(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { ok, data } = await apiPost<{ error?: string }>("/api/account/delete", { password, confirm });
    setBusy(false);
    if (!ok) { setError(data.error ?? "Could not delete the account."); return; }
    window.location.href = "/";
  }

  return (
    <>
      <section className="card">
        <h3>Your agreement</h3>
        <p className="dim" style={{ fontSize: 14 }}>
          A dated PDF of the terms you accepted, exactly as they were worded at the time. Yours to
          keep — we hold the same copy.
        </p>
        {contracts === null ? (
          <p className="dim" style={{ marginTop: 12 }}>Loading…</p>
        ) : contracts.length === 0 ? (
          <p className="dim" style={{ marginTop: 12, fontSize: 14 }}>No agreement on file.</p>
        ) : (
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table className="holdings">
              <thead>
                <tr><th>Contract</th><th>Version</th><th>Accepted</th><th /></tr>
              </thead>
              <tbody>
                {contracts.map((c) => (
                  <tr key={c.contractId}>
                    <td className="mono" style={{ fontSize: 12 }}>{c.contractId}</td>
                    <td className="mono dim" style={{ fontSize: 12 }}>{c.termsVersion}</td>
                    <td className="dim mono" style={{ fontSize: 12 }}>
                      {new Date(c.acceptedAt).toLocaleString()}
                    </td>
                    <td>
                      <a className="btn small secondary" href={`/api/account/contract?id=${encodeURIComponent(c.contractId)}`}>
                        Download PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h3>Export and deletion</h3>
        <p className="dim" style={{ fontSize: 14 }}>
          Download everything we hold about you, or close the account for good.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <a className="btn small secondary" href="/api/account/export">Download my data</a>
          <button className="btn small secondary" onClick={() => setOpen((v) => !v)}>
            Delete account
          </button>
        </div>

        {open && (
          <form onSubmit={remove} style={{ marginTop: 16 }}>
            <p className="error" style={{ marginTop: 0 }}>
              This deletes your watchlists, insights and history immediately. It cannot be undone.
            </p>
            <div className="field">
              <label htmlFor="del-password">Your password</label>
              <input id="del-password" type="password" className="input" value={password}
                onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="del-confirm">Type DELETE to confirm</label>
              <input id="del-confirm" className="input mono" value={confirm}
                onChange={(e) => setConfirm(e.target.value)} required />
            </div>
            <button className="btn small" disabled={busy || confirm !== "DELETE"}>
              {busy ? "…" : "Permanently delete my account"}
            </button>
            {error && <p className="error">{error}</p>}
          </form>
        )}
      </section>
    </>
  );
}
