"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useSession } from "../../../../lib/session/SessionContext";
import { roleCan } from "../../../../lib/permissions";
import { createCustomer, listCustomers } from "../../../../lib/api/customers";
import { useAsync } from "../../../../lib/useAsync";
import { statusInfo } from "../../../../lib/status";
import { LIST_LIMIT, ListPage, StatusFilter, useCreateFromUrl, type StatusFilterValue } from "../../../../components/patterns/ListPage";
import { Badge } from "../../../../components/ui/Data";
import { Button } from "../../../../components/ui/Button";
import { Field, SearchInput } from "../../../../components/ui/Form";
import { Modal } from "../../../../components/ui/Overlay";
import { ErrorNotice } from "../../../../components/ui/Feedback";
import { useToast } from "../../../../components/ui/Toast";

export default function CustomersPage() {
  const params = useParams<{ organizationId: string }>();
  const org = params.organizationId;
  const { identity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === org)?.roleKey;
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("ACTIVE");
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [showCreate, setShowCreate] = useCreateFromUrl();
  const customers = useAsync(() => listCustomers(org, { status: statusFilter || undefined, q: appliedQ || undefined, limit: LIST_LIMIT }), [org, statusFilter, appliedQ]);
  const canCreate = roleCan(roleKey, "customers.create");

  return (
    <ListPage
      title="Clientes"
      description="As pessoas e entidades que o negócio serve. Não precisam de conta na UL Platform."
      moduleName="Clientes"
      primaryAction={
        canCreate ? (
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            + Novo cliente
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
      state={customers}
      rowKey={(c) => c.id}
      empty={{ title: "Nenhum cliente encontrado." }}
      columns={[
        { key: "name", header: "Nome", wrap: true, cell: (c) => <Link href={`/o/${org}/customers/${c.id}`}>{c.name}</Link> },
        { key: "contact", header: "Contacto", wrap: true, cell: (c) => <span className="break-all">{[c.email, c.phone].filter(Boolean).join(" · ") || "—"}</span> },
        { key: "status", header: "Estado", cell: (c) => <Badge tone={statusInfo("catalog", c.status).tone}>{statusInfo("catalog", c.status).label}</Badge> },
      ]}
    >
      {showCreate && (
        <CreateCustomerDialog
          organizationId={org}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            customers.reload();
          }}
        />
      )}
    </ListPage>
  );
}

function CreateCustomerDialog({ organizationId, onClose, onCreated }: { organizationId: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
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
      await createCustomer(organizationId, { name, email: email || undefined, phone: phone || undefined, notes: notes || undefined });
      toast.success("Cliente criado.");
      onCreated();
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Novo cliente">
      <form onSubmit={handleSubmit} noValidate>
        <Field label="Nome" error={nameError}>
          <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} data-autofocus required />
        </Field>
        <div className="grid-2">
          <Field label="Email">
            <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Telefone">
            <input id="phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+244 923 456 789" />
          </Field>
        </div>
        <Field label="Notas">
          <textarea id="notes" className="textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
