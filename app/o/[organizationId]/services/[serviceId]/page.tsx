"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "../../../../../lib/session/SessionContext";
import { roleCan } from "../../../../../lib/permissions";
import { getService, updateService } from "../../../../../lib/api/services";
import { listProfessionals } from "../../../../../lib/api/professionals";
import type { Service } from "../../../../../lib/api/types";
import { useAsync } from "../../../../../lib/useAsync";
import { useUnsavedChanges } from "../../../../../lib/useUnsavedChanges";
import { statusInfo } from "../../../../../lib/status";
import { formatMoney } from "../../../../../lib/format";
import { localDateTime } from "../../../../../lib/datetime";
import { useOrganizationTimezone } from "../../../../../lib/appointments/components";
import { DetailGuard } from "../../../../../components/patterns/DetailGuard";
import { ResourceHeader, Section } from "../../../../../components/patterns/Page";
import { Badge, DataTable, Timeline } from "../../../../../components/ui/Data";
import { ErrorNotice } from "../../../../../components/ui/Feedback";
import { Button } from "../../../../../components/ui/Button";
import { Field } from "../../../../../components/ui/Form";
import { ConfirmDialog } from "../../../../../components/ui/Overlay";
import { useToast } from "../../../../../components/ui/Toast";

export default function ServiceDetailPage() {
  const params = useParams<{ organizationId: string; serviceId: string }>();
  const org = params.organizationId;
  const service = useAsync(() => getService(org, params.serviceId), [org, params.serviceId]);
  return (
    <DetailGuard state={service} resourceLabel="Serviço" backHref={`/o/${org}/services`} backLabel="Serviços" moduleName="Serviços">
      {(s) => <ServiceDetail organizationId={org} service={s} onChange={service.setData} />}
    </DetailGuard>
  );
}

function ServiceDetail({ organizationId, service, onChange }: { organizationId: string; service: Service; onChange: (s: Service) => void }) {
  const { identity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === organizationId)?.roleKey;
  const canEdit = roleCan(roleKey, "services.update");
  const tz = useOrganizationTimezone(organizationId);
  const toast = useToast();
  // ADR-037: who performs this service — the API's own serviceId filter on professionals.
  const professionals = useAsync(() => listProfessionals(organizationId, { serviceId: service.id, limit: 100 }), [organizationId, service.id], { enabled: roleCan(roleKey, "professionals.read") });

  const [name, setName] = useState(service.name);
  const [description, setDescription] = useState(service.description ?? "");
  const [durationMinutes, setDurationMinutes] = useState(String(service.durationMinutes));
  const [price, setPrice] = useState(service.price ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [durationError, setDurationError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    setName(service.name);
    setDescription(service.description ?? "");
    setDurationMinutes(String(service.durationMinutes));
    setPrice(service.price ?? "");
  }, [service]);

  const dirty = name !== service.name || description !== (service.description ?? "") || durationMinutes !== String(service.durationMinutes) || price !== (service.price ?? "");
  useUnsavedChanges(canEdit && dirty);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const duration = Number(durationMinutes);
    if (!Number.isInteger(duration) || duration <= 0) {
      setDurationError("A duração tem de ser um número inteiro de minutos maior que zero");
      return;
    }
    setDurationError(null);
    setSaving(true);
    setError(null);
    try {
      onChange(await updateService(organizationId, service.id, { name, description: description || null, durationMinutes: duration, price: price.trim() || null }));
      toast.success("Serviço guardado.");
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(status: "ACTIVE" | "ARCHIVED") {
    onChange(await updateService(organizationId, service.id, { status }));
    toast.success(status === "ARCHIVED" ? "Serviço arquivado." : "Serviço reactivado.");
  }

  const status = statusInfo("catalog", service.status);
  const when = (iso: string) => (tz.timezone ? localDateTime(iso, tz.timezone) : new Date(iso).toLocaleString("pt-PT"));

  return (
    <div>
      <ResourceHeader
        name={service.name}
        status={<Badge tone={status.tone}>{status.label}</Badge>}
        subtitle={`${service.durationMinutes} min · ${service.price !== null ? formatMoney(service.price) : "sem preço"}`}
        breadcrumbs={[{ label: "Serviços", href: `/o/${organizationId}/services` }, { label: service.name }]}
        actions={
          canEdit ? (
            service.status === "ACTIVE" ? (
              <Button variant="danger" onClick={() => setArchiving(true)}>
                Arquivar
              </Button>
            ) : (
              <Button onClick={() => setStatus("ACTIVE").catch((err) => setError(err))}>Reactivar</Button>
            )
          ) : undefined
        }
      />
      {error ? <ErrorNotice error={error} /> : null}

      <div className="grid-2" style={{ alignItems: "start" }}>
        <Section title="Detalhes">
          <form onSubmit={save} className="card" noValidate>
            <Field label="Nome">
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} required />
            </Field>
            <Field label="Descrição">
              <textarea id="description" className="textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canEdit} />
            </Field>
            <div className="grid-2">
              <Field label="Duração (minutos)" error={durationError} hint="Novas marcações usam esta duração; as existentes mantêm a sua.">
                <input id="duration" className="input" type="number" min="1" step="1" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} disabled={!canEdit} required />
              </Field>
              <Field label="Preço (AOA)" hint="Vazio = sem preço">
                <input id="price" className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(",", "."))} disabled={!canEdit} placeholder="Sem preço" />
              </Field>
            </div>
            {canEdit && (
              <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>
                {saving ? "A guardar…" : "Guardar alterações"}
              </Button>
            )}
          </form>
        </Section>

        <div>
          {roleCan(roleKey, "professionals.read") && (
            <Section title="Profissionais associados" description="Quem pode prestar este serviço. As associações gerem-se na página de cada profissional.">
              {professionals.error ? (
                <ErrorNotice error={professionals.error} />
              ) : (
                <DataTable
                  rows={professionals.data}
                  loading={professionals.loading && !professionals.data}
                  rowKey={(p) => p.id}
                  empty={{ title: "Nenhum profissional presta este serviço ainda." }}
                  columns={[
                    { key: "name", header: "Profissional", wrap: true, cell: (p) => <Link href={`/o/${organizationId}/professionals/${p.id}`}>{p.name}</Link> },
                    { key: "status", header: "Estado", cell: (p) => <Badge tone={statusInfo("catalog", p.status).tone}>{statusInfo("catalog", p.status).label}</Badge> },
                  ]}
                />
              )}
            </Section>
          )}
          <Section title="Histórico">
            <Timeline
              label="Histórico do serviço"
              items={[
                { key: "created", label: "Criado", at: when(service.createdAt), tone: "gold" },
                ...(service.updatedAt !== service.createdAt ? [{ key: "updated", label: "Última alteração", at: when(service.updatedAt) }] : []),
              ]}
            />
          </Section>
        </div>
      </div>

      <ConfirmDialog
        open={archiving}
        onClose={() => setArchiving(false)}
        title="Arquivar serviço?"
        description={`"${service.name}" deixa de aceitar novas marcações e associações. Marcações existentes mantêm-se. Pode ser reactivado.`}
        confirmLabel="Arquivar"
        onConfirm={() => setStatus("ARCHIVED")}
      />
    </div>
  );
}
