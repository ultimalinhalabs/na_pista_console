"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "../../../../lib/session/SessionContext";
import { roleCan } from "../../../../lib/permissions";
import { platformRoleCan } from "../../../../lib/platformPermissions";
import { getOrganizationSettings, updateOrganizationSettings } from "../../../../lib/api/organizationSettings";
import { getOrganization, updateOrganization } from "../../../../lib/api/platform";
import type { OrganizationSettings } from "../../../../lib/api/types";
import { useAsync } from "../../../../lib/useAsync";
import { PageHeader, Section } from "../../../../components/patterns/Page";
import { CopyButton, DetailList } from "../../../../components/ui/Data";
import { Alert, ErrorNotice, Skeleton } from "../../../../components/ui/Feedback";
import { Button } from "../../../../components/ui/Button";
import { Field } from "../../../../components/ui/Form";
import { useToast } from "../../../../components/ui/Toast";

function supportedTimezones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  } catch {
    return [];
  }
}

/** Organization profile — a UL Platform resource (name/slug/id). Editable with the Platform's organization.update (OWNER/ADMIN). */
function OrganizationProfile({ organizationId, canEdit }: { organizationId: string; canEdit: boolean }) {
  const organization = useAsync(() => getOrganization(organizationId), [organizationId]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const toast = useToast();
  const { refreshIdentity } = useSession();

  useEffect(() => {
    if (organization.data) setName(organization.data.name);
  }, [organization.data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      organization.setData(await updateOrganization(organizationId, { name: name.trim() }));
      await refreshIdentity();
      toast.success("Nome da organização actualizado.");
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  if (organization.error) return <ErrorNotice error={organization.error} />;
  if (!organization.data) return <Skeleton height={60} />;
  const dirty = name.trim() !== organization.data.name && name.trim().length > 0;
  return (
    <form className="card" onSubmit={save}>
      <Field label="Nome">
        <input id="organization-name" className="input" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} maxLength={200} required />
      </Field>
      <DetailList
        items={[
          {
            label: "Identificador",
            value: (
              <span className="row">
                <code className="mono break-all">{organization.data.id}</code>
                <CopyButton value={organization.data.id} />
              </span>
            ),
          },
          { label: "Slug", value: <code className="mono">{organization.data.slug}</code> },
        ]}
      />
      {error ? <ErrorNotice error={error} /> : null}
      {canEdit && (
        <div style={{ marginTop: "var(--np-space-4)" }}>
          <Button type="submit" loading={saving} disabled={!dirty}>
            Guardar nome
          </Button>
        </div>
      )}
    </form>
  );
}

/**
 * ADR-040: timezone lives in Na Pista's own `organization_settings` —
 * never inferred from the browser (`Intl.DateTimeFormat().resolvedOptions().timeZone`
 * is deliberately NOT read anywhere on this page as a silent default;
 * the field starts empty until the organization explicitly saves one).
 * F29: the IANA list below is only a suggestion list for typing; the
 * server still validates.
 */
export default function OrganizationSettingsPage() {
  const params = useParams<{ organizationId: string }>();
  const { identity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === params.organizationId)?.roleKey;
  const canEdit = roleCan(roleKey, "scheduling.update");
  const timezones = useMemo(supportedTimezones, []);

  const [settings, setSettings] = useState<OrganizationSettings | null | undefined>(undefined);
  const [timezone, setTimezone] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getOrganizationSettings(params.organizationId)
      .then((result) => {
        setSettings(result);
        setTimezone(result?.timezone ?? "");
      })
      .catch((err) => setError(err));
  }, [params.organizationId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const updated = await updateOrganizationSettings(params.organizationId, timezone.trim());
      setSettings(updated);
      setSaved(true);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Organização" description="Dados da organização na UL Platform e configuração operacional da Na Pista." breadcrumbs={[{ label: "Definições" }, { label: "Organização" }]} />

      <Section title="Perfil">
        <OrganizationProfile organizationId={params.organizationId} canEdit={platformRoleCan(roleKey, "organization.update")} />
      </Section>

      <Section title="Fuso horário" description="Usado para horários, disponibilidade e marcações. Nunca é deduzido do navegador.">
        {settings === undefined && !error ? (
          <div role="status" aria-live="polite">
            <span className="sr-only">A carregar…</span>
            <Skeleton height={60} />
          </div>
        ) : (
          <form onSubmit={handleSave} className="card">
            <Field
              label="Fuso horário"
              hint={
                <>
                  Identificador IANA (ex.: <code className="mono">Africa/Luanda</code>). Necessário antes de configurar horários de qualquer Profissional — sem ele, a disponibilidade
                  não pode ser calculada.
                </>
              }
            >
              <input
                id="timezone"
                className="input"
                list="timezone-options"
                value={timezone}
                onChange={(e) => {
                  setTimezone(e.target.value);
                  setSaved(false);
                }}
                placeholder="Africa/Luanda"
                disabled={!canEdit}
                autoComplete="off"
                required
              />
            </Field>
            <datalist id="timezone-options">
              {timezones.map((tz) => (
                <option key={tz} value={tz} />
              ))}
            </datalist>

            {settings === null && !error && (
              <Alert tone="warning" title="Fuso horário por configurar">
                Ainda não configurado. A disponibilidade dos Profissionais ficará bloqueada até guardares um fuso horário.
              </Alert>
            )}
            {error ? <ErrorNotice error={error} /> : null}

            {canEdit && (
              <div className="row">
                <Button type="submit" variant="primary" loading={saving}>
                  {saving ? "A guardar…" : "Guardar"}
                </Button>
                {saved && (
                  <span role="status" style={{ color: "var(--np-success)" }}>
                    Guardado.
                  </span>
                )}
              </div>
            )}
          </form>
        )}
      </Section>
    </div>
  );
}
