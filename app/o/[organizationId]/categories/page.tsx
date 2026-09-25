"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useSession } from "../../../../lib/session/SessionContext";
import { roleCan } from "../../../../lib/permissions";
import { archiveCategory, createCategory, listCategories, updateCategory } from "../../../../lib/api/categories";
import type { Category } from "../../../../lib/api/types";
import { useAsync } from "../../../../lib/useAsync";
import { statusInfo } from "../../../../lib/status";
import { LIST_LIMIT, ListPage, StatusFilter, useCreateFromUrl, type StatusFilterValue } from "../../../../components/patterns/ListPage";
import { Badge } from "../../../../components/ui/Data";
import { Button } from "../../../../components/ui/Button";
import { Field } from "../../../../components/ui/Form";
import { ConfirmDialog, Modal } from "../../../../components/ui/Overlay";
import { ErrorNotice } from "../../../../components/ui/Feedback";
import { useToast } from "../../../../components/ui/Toast";

/** Categories group products. Archive = the API's DELETE (never a physical delete); reactivate/edit = PATCH. */
export default function CategoriesPage() {
  const params = useParams<{ organizationId: string }>();
  const org = params.organizationId;
  const { identity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === org)?.roleKey;
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("ACTIVE");
  const [showCreate, setShowCreate] = useCreateFromUrl();
  const [editing, setEditing] = useState<Category | null>(null);
  const [archiving, setArchiving] = useState<Category | null>(null);
  const categories = useAsync(() => listCategories(org, { status: statusFilter || undefined, limit: LIST_LIMIT }), [org, statusFilter]);
  const toast = useToast();
  const canCreate = roleCan(roleKey, "categories.create");
  const canUpdate = roleCan(roleKey, "categories.update");
  const canArchive = roleCan(roleKey, "categories.delete");

  async function reactivate(category: Category) {
    try {
      await updateCategory(org, category.id, { status: "ACTIVE" });
      toast.success("Categoria reactivada.");
      categories.reload();
    } catch (err) {
      toast.error("Não foi possível reactivar a categoria.");
      categories.reload();
      throw err;
    }
  }

  return (
    <ListPage
      title="Categorias"
      description="Agrupamento dos produtos do catálogo."
      moduleName="Categorias"
      primaryAction={
        canCreate ? (
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            + Nova categoria
          </Button>
        ) : undefined
      }
      filters={<StatusFilter value={statusFilter} onChange={setStatusFilter} />}
      state={categories}
      rowKey={(c) => c.id}
      empty={{ title: "Nenhuma categoria encontrada." }}
      columns={[
        { key: "name", header: "Nome", wrap: true, cell: (c) => <strong>{c.name}</strong> },
        { key: "description", header: "Descrição", wrap: true, cell: (c) => c.description ?? <span className="subtle">—</span> },
        { key: "status", header: "Estado", cell: (c) => <Badge tone={statusInfo("catalog", c.status).tone}>{statusInfo("catalog", c.status).label}</Badge> },
        {
          key: "actions",
          header: "Acções",
          srHeader: true,
          cell: (c) => (
            <span className="row">
              {canUpdate && (
                <Button size="sm" onClick={() => setEditing(c)}>
                  Editar
                </Button>
              )}
              {canArchive && c.status === "ACTIVE" && (
                <Button size="sm" variant="danger" onClick={() => setArchiving(c)}>
                  Arquivar
                </Button>
              )}
              {canUpdate && c.status === "ARCHIVED" && (
                <Button size="sm" onClick={() => reactivate(c).catch(() => undefined)}>
                  Reactivar
                </Button>
              )}
            </span>
          ),
        },
      ]}
    >
      {(showCreate || editing) && (
        <CategoryDialog
          organizationId={org}
          category={editing}
          onClose={() => {
            setShowCreate(false);
            setEditing(null);
          }}
          onSaved={() => {
            setShowCreate(false);
            setEditing(null);
            categories.reload();
          }}
        />
      )}
      <ConfirmDialog
        open={archiving !== null}
        onClose={() => setArchiving(null)}
        title="Arquivar categoria?"
        description={`"${archiving?.name ?? ""}" deixa de aparecer nas listas de categorias activas. Os produtos existentes mantêm-se. Pode ser reactivada mais tarde.`}
        confirmLabel="Arquivar"
        onConfirm={async () => {
          if (!archiving) return;
          await archiveCategory(org, archiving.id);
          toast.success("Categoria arquivada.");
          categories.reload();
        }}
      />
    </ListPage>
  );
}

function CategoryDialog({ organizationId, category, onClose, onSaved }: { organizationId: string; category: Category | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
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
      if (category) {
        await updateCategory(organizationId, category.id, { name, description: description || null });
        toast.success("Categoria actualizada.");
      } else {
        await createCategory(organizationId, { name, description: description || undefined });
        toast.success("Categoria criada.");
      }
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={category ? "Editar categoria" : "Nova categoria"}>
      <form onSubmit={handleSubmit} noValidate>
        <Field label="Nome" error={nameError}>
          <input id="category-name" className="input" value={name} onChange={(e) => setName(e.target.value)} data-autofocus required />
        </Field>
        <Field label="Descrição">
          <textarea id="category-description" className="textarea" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {error ? <ErrorNotice error={error} /> : null}
        <div className="modal-footer">
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary" loading={submitting}>
            {category ? "Guardar" : "Criar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
