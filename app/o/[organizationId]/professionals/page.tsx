"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useSession } from "../../../../lib/session/SessionContext";
import { roleCan } from "../../../../lib/permissions";
import { createProfessional, listProfessionals } from "../../../../lib/api/professionals";
import { useAsync } from "../../../../lib/useAsync";
import { statusInfo } from "../../../../lib/status";
import { LIST_LIMIT, ListPage, StatusFilter, useCreateFromUrl, type StatusFilterValue } from "../../../../components/patterns/ListPage";
import { Badge } from "../../../../components/ui/Data";
import { Button } from "../../../../components/ui/Button";
import { SearchInput, Field } from "../../../../components/ui/Form";
import { Modal } from "../../../../components/ui/Overlay";
import { ErrorNotice } from "../../../../components/ui/Feedback";
import { useToast } from "../../../../components/ui/Toast";

export default function ProfessionalsPage() {
  const params = useParams<{ organizationId: string }>();
  const org = params.organizationId;
  const { identity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === org)?.roleKey;
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("ACTIVE");
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [showCreate, setShowCreate] = useCreateFromUrl();
  const professionals = useAsync(() => listProfessionals(org, { status: statusFilter || undefined, q: appliedQ || undefined, limit: LIST_LIMIT }), [org, statusFilter, appliedQ]);
  const canCreate = roleCan(roleKey, "professionals.create");

  return (
    <ListPage
      title="Profissionais"
      description="Quem presta os serviços. Os horários e a disponibilidade de cada profissional estão na respectiva página."
      moduleName="Profissionais"
      primaryAction={
        canCreate ? (
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            + Novo profissional
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
      state={professionals}
      rowKey={(p) => p.id}
      empty={{ title: "Nenhum profissional encontrado.", description: canCreate ? "Cria o primeiro profissional para depois lhe associar serviços e horário." : undefined }}
      columns={[
        { key: "name", header: "Nome", wrap: true, cell: (p) => <Link href={`/o/${org}/professionals/${p.id}`}>{p.name}</Link> },
        { key: "contact", header: "Contacto", wrap: true, cell: (p) => [p.phone, p.email].filter(Boolean).join(" · ") || "—" },
        { key: "status", header: "Estado", cell: (p) => <Badge tone={statusInfo("catalog", p.status).tone}>{statusInfo("catalog", p.status).label}</Badge> },
      ]}
    >
      {showCreate && (
        <CreateProfessionalDialog
          organizationId={org}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            professionals.reload();
          }}
        />
      )}
    </ListPage>
  );
}

function CreateProfessionalDialog({ organizationId, onClose, onCreated }: { organizationId: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const toast = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError("O nome é obrigatório");
      return;
    }
    setNameError(null);
    setSubmitting(true);
    setError(null);
    try {
      await createProfessional(organizationId, { name, description: description || undefined, phone: phone || undefined, email: email || undefined });
      toast.success("Profissional criado.");
      onCreated();
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Novo profissional">
      <form onSubmit={handleSubmit} noValidate>
        <Field label="Nome" error={nameError}>
          <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} data-autofocus required />
        </Field>
        <Field label="Descrição">
          <textarea id="description" className="textarea" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Telefone">
          <input id="phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+244 923 456 789" />
        </Field>
        <Field label="Email">
          <input id="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
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
