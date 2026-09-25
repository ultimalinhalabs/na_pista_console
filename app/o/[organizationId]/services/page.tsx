"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useSession } from "../../../../lib/session/SessionContext";
import { roleCan } from "../../../../lib/permissions";
import { createService, listServices } from "../../../../lib/api/services";
import { useAsync } from "../../../../lib/useAsync";
import { statusInfo } from "../../../../lib/status";
import { formatMoney } from "../../../../lib/format";
import { LIST_LIMIT, ListPage, StatusFilter, useCreateFromUrl, type StatusFilterValue } from "../../../../components/patterns/ListPage";
import { Badge } from "../../../../components/ui/Data";
import { Button } from "../../../../components/ui/Button";
import { Field, SearchInput } from "../../../../components/ui/Form";
import { Modal } from "../../../../components/ui/Overlay";
import { ErrorNotice } from "../../../../components/ui/Feedback";
import { useToast } from "../../../../components/ui/Toast";

export default function ServicesPage() {
  const params = useParams<{ organizationId: string }>();
  const org = params.organizationId;
  const { identity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === org)?.roleKey;
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("ACTIVE");
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [showCreate, setShowCreate] = useCreateFromUrl();
  const services = useAsync(() => listServices(org, { status: statusFilter || undefined, q: appliedQ || undefined, limit: LIST_LIMIT }), [org, statusFilter, appliedQ]);
  const canCreate = roleCan(roleKey, "services.create");

  return (
    <ListPage
      title="Serviços"
      description="O que os clientes reservam: duração e preço de referência. Uma marcação guarda sempre o nome, preço e duração do momento em que foi feita."
      moduleName="Serviços"
      primaryAction={
        canCreate ? (
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            + Novo serviço
          </Button>
        ) : undefined
      }
      filters={
        <>
          <SearchInput label="Pesquisar por nome…" value={q} onChange={(e) => setQ(e.target.value)} onSubmit={() => setAppliedQ(q.trim())} />
          <StatusFilter value={statusFilter} onChange={setStatusFilter} />
          <Button onClick={() => setAppliedQ(q.trim())}>Filtrar</Button>
        </>
      }
      state={services}
      rowKey={(s) => s.id}
      empty={{ title: "Nenhum serviço encontrado." }}
      columns={[
        { key: "name", header: "Nome", wrap: true, cell: (s) => <Link href={`/o/${org}/services/${s.id}`}>{s.name}</Link> },
        { key: "duration", header: "Duração", numeric: true, cell: (s) => `${s.durationMinutes} min` },
        { key: "price", header: "Preço", numeric: true, cell: (s) => (s.price !== null ? formatMoney(s.price) : <Badge tone="warning">Sem preço</Badge>) },
        { key: "status", header: "Estado", cell: (s) => <Badge tone={statusInfo("catalog", s.status).tone}>{statusInfo("catalog", s.status).label}</Badge> },
      ]}
    >
      {showCreate && (
        <CreateServiceDialog
          organizationId={org}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            services.reload();
          }}
        />
      )}
    </ListPage>
  );
}

function CreateServiceDialog({ organizationId, onClose, onCreated }: { organizationId: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; duration?: string }>({});
  const toast = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const duration = Number(durationMinutes);
    const errors = {
      name: name.trim() ? undefined : "O nome é obrigatório",
      duration: Number.isInteger(duration) && duration > 0 ? undefined : "A duração tem de ser um número inteiro de minutos maior que zero",
    };
    setFieldErrors(errors);
    if (errors.name || errors.duration) return;
    setSubmitting(true);
    setError(null);
    try {
      await createService(organizationId, { name, description: description || undefined, durationMinutes: duration, price: price.trim() || undefined });
      toast.success("Serviço criado.");
      onCreated();
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Novo serviço">
      <form onSubmit={handleSubmit} noValidate>
        <Field label="Nome" error={fieldErrors.name}>
          <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} data-autofocus required />
        </Field>
        <Field label="Descrição">
          <textarea id="description" className="textarea" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid-2">
          <Field label="Duração (minutos)" error={fieldErrors.duration}>
            <input id="duration" className="input" type="number" min="1" step="1" inputMode="numeric" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} required />
          </Field>
          <Field label="Preço (AOA)" hint="Vazio = sem preço">
            <input id="price" className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(",", "."))} placeholder="ex.: 5000.00" />
          </Field>
        </div>
        {error ? <ErrorNotice error={error} /> : null}
        <div className="modal-footer">
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary" loading={submitting}>
            {submitting ? "A criar…" : "Criar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
