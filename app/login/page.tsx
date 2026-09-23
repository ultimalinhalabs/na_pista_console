"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const supabase = getSupabaseClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push("/");
  }

  return (
    <div className="container" style={{ maxWidth: 360, paddingTop: 96 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 32 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/mark.png" alt="Na Pista" width={56} height={66} />
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 18 }}>Entrar no Na Pista</h1>
          <p style={{ color: "var(--np-foreground-subtle)", fontSize: 13, margin: "4px 0 0" }}>Ideias em Operação</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="card">
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">Palavra-passe</label>
          <input
            id="password"
            type="password"
            className="input"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: "100%", justifyContent: "center" }}>
          {submitting ? "A entrar…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
