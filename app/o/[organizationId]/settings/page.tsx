"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "../../../../lib/session/SessionContext";
import { roleCan } from "../../../../lib/permissions";
import { getOrganizationSettings, updateOrganizationSettings } from "../../../../lib/api/organizationSettings";
import { ApiError } from "../../../../lib/api/errors";
import type { OrganizationSettings } from "../../../../lib/api/types";

/**
 * ADR-040: timezone lives in Na Pista's own `organization_settings` —
 * never inferred from the browser (`Intl.DateTimeFormat().resolvedOptions().timeZone`
 * is deliberately NOT read anywhere on this page as a silent default;
 * the field starts empty until the organization explicitly saves one).
 * The smallest domain-specific settings surface this needs (F26 brief
 * §25/§26) — not a generic settings framework.
 */
export default function OrganizationSettingsPage() {
  const params = useParams<{ organizationId: string }>();
  const { identity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === params.organizationId)?.roleKey;
  const canEdit = roleCan(roleKey, "scheduling.update");

  const [settings, setSettings] = useState<OrganizationSettings | null | undefined>(undefined);
  const [timezone, setTimezone] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function load() {
    setError(null);
    try {
      const result = await getOrganizationSettings(params.organizationId);
      setSettings(result);
      setTimezone(result?.timezone ?? "");
    } catch (err) {
      setError(err as Error);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const updated = await updateOrganizationSettings(params.organizationId, timezone);
      setSettings(updated);
      setSaved(true);
    } catch (err) {
      setError(err as Error);
    } finally {
      setSaving(false);
    }
  }

  if (settings === undefined && !error) return <div className="empty-state">A carregar…</div>;

  return (
    <div>
      <h1 style={{ fontSize: 20 }}>Definições</h1>

      {error && (
        <div className="card error-text" style={{ marginBottom: 16 }}>
          {error.message}
          {error instanceof ApiError && error.requestId && <div className="request-ref">Referência: {error.requestId}</div>}
        </div>
      )}

      <form onSubmit={handleSave} className="card">
        <div className="field">
          <label htmlFor="timezone">Fuso horário</label>
          <input
            id="timezone"
            className="input"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="Africa/Luanda"
            disabled={!canEdit}
            required
          />
          <p style={{ fontSize: 13, color: "var(--np-foreground-muted)", marginTop: 4 }}>
            Identificador IANA (ex.: <code>Africa/Luanda</code>). Necessário antes de configurar horários de qualquer Profissional — sem ele, a
            disponibilidade não pode ser calculada.
          </p>
        </div>

        {settings === null && !error && (
          <div className="empty-state" style={{ marginBottom: 12 }}>
            Ainda não configurado. A disponibilidade dos Profissionais ficará bloqueada até guardares um fuso horário.
          </div>
        )}

        {canEdit && (
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "A guardar…" : "Guardar"}
          </button>
        )}
        {saved && <span style={{ marginLeft: 12, color: "var(--np-success)" }}>Guardado.</span>}
      </form>
    </div>
  );
}
