"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "../../lib/supabase/client";
import { useSession } from "../../lib/session/SessionContext";
import { Button } from "../../components/ui/Button";
import { Alert } from "../../components/ui/Feedback";
import { Field } from "../../components/ui/Form";

/** Supabase Auth maps wrong credentials to "Invalid login credentials"; never echo other provider internals. */
function describeSignInError(message: string): string {
  if (/invalid login credentials/i.test(message)) return "Email ou palavra-passe incorrectos.";
  if (/email not confirmed/i.test(message)) return "Este email ainda não foi confirmado.";
  return "Não foi possível entrar. Tenta de novo.";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [expired, setExpired] = useState(false);
  const router = useRouter();
  const { loading, authenticated, refreshIdentity } = useSession();

  useEffect(() => {
    setExpired(new URLSearchParams(window.location.search).get("expired") === "1");
  }, []);

  useEffect(() => {
    if (!loading && authenticated) router.replace("/");
  }, [loading, authenticated, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await getSupabaseClient().auth.signInWithPassword({ email, password });
    if (signInError) {
      setSubmitting(false);
      setError(describeSignInError(signInError.message));
      return;
    }
    await refreshIdentity();
    router.push("/");
  }

  return (
    <main className="container" style={{ maxWidth: 380, paddingTop: 96 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 32 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/mark.png" alt="Na Pista" width={56} height={66} />
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 18 }}>Entrar no Na Pista</h1>
          <p className="subtle" style={{ fontSize: 13, margin: "4px 0 0" }}>
            Ideias em Operação
          </p>
        </div>
      </div>
      {expired && (
        <Alert tone="warning" title="Sessão expirada">
          A tua sessão terminou. Entra novamente para continuar.
        </Alert>
      )}
      <form onSubmit={handleSubmit} className="card" noValidate={false}>
        <Field label="Email">
          <input id="email" type="email" className="input" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Palavra-passe">
          <input id="password" type="password" className="input" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" loading={submitting} style={{ width: "100%", justifyContent: "center" }}>
          {submitting ? "A entrar…" : "Entrar"}
        </Button>
      </form>
    </main>
  );
}
