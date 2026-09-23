"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "../../../../../lib/session/SessionContext";
import { roleCan } from "../../../../../lib/permissions";
import { listServices } from "../../../../../lib/api/services";
import {
  associateService,
  getProfessional,
  listServicesForProfessional,
  removeServiceAssociation,
  updateProfessional,
} from "../../../../../lib/api/professionals";
import { ApiError } from "../../../../../lib/api/errors";
import type { AssociatedService, Professional, Service } from "../../../../../lib/api/types";

export default function ProfessionalDetailPage() {
  const params = useParams<{ organizationId: string; professionalId: string }>();
  const { identity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === params.organizationId)?.roleKey;
  const canEdit = roleCan(roleKey, "professionals.update");

  const [professional, setProfessional] = useState<Professional | null>(null);
  const [associatedServices, setAssociatedServices] = useState<AssociatedService[] | null>(null);
  const [allActiveServices, setAllActiveServices] = useState<Service[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const [associationError, setAssociationError] = useState<Error | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [associating, setAssociating] = useState(false);

  async function load() {
    setError(null);
    setNotFound(false);
    try {
      const [p, services, active] = await Promise.all([
        getProfessional(params.organizationId, params.professionalId),
        listServicesForProfessional(params.organizationId, params.professionalId),
        listServices(params.organizationId, { status: "ACTIVE" }),
      ]);
      setProfessional(p);
      setName(p.name);
      setDescription(p.description ?? "");
      setPhone(p.phone ?? "");
      setEmail(p.email ?? "");
      setAssociatedServices(services);
      setAllActiveServices(active);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true);
      else setError(err as Error);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.professionalId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await updateProfessional(params.organizationId, params.professionalId, {
        name,
        description: description || null,
        phone: phone || null,
        email: email || null,
      });
      setProfessional(updated);
    } catch (err) {
      setError(err as Error);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus() {
    if (!professional) return;
    setError(null);
    try {
      const updated = await updateProfessional(params.organizationId, params.professionalId, { status: professional.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE" });
      setProfessional(updated);
    } catch (err) {
      setError(err as Error);
    }
  }

  async function handleAssociate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedServiceId) return;
    setAssociating(true);
    setAssociationError(null);
    try {
      await associateService(params.organizationId, params.professionalId, selectedServiceId);
      setSelectedServiceId("");
      setAssociatedServices(await listServicesForProfessional(params.organizationId, params.professionalId));
    } catch (err) {
      setAssociationError(err as Error);
    } finally {
      setAssociating(false);
    }
  }

  async function handleRemoveAssociation(serviceId: string) {
    setAssociationError(null);
    try {
      await removeServiceAssociation(params.organizationId, params.professionalId, serviceId);
      setAssociatedServices((prev) => prev?.filter((s) => s.id !== serviceId) ?? null);
    } catch (err) {
      setAssociationError(err as Error);
    }
  }

  if (notFound) {
    return (
      <div className="empty-state card">
        Profissional não encontrado. <Link href={`/o/${params.organizationId}/professionals`}>Voltar à lista</Link>
      </div>
    );
  }

  if (!professional && !error) return <div className="empty-state">A carregar…</div>;

  const associatedIds = new Set((associatedServices ?? []).map((s) => s.id));
  const availableToAssociate = allActiveServices.filter((s) => !associatedIds.has(s.id));

  return (
    <div>
      <p>
        <Link href={`/o/${params.organizationId}/professionals`}>← Profissionais</Link>
      </p>
      <h1 style={{ fontSize: 20 }}>{professional?.name}</h1>

      {error && (
        <div className="card error-text" style={{ marginBottom: 16 }}>
          {error.message}
          {error instanceof ApiError && error.requestId && <div className="request-ref">Referência: {error.requestId}</div>}
        </div>
      )}

      {professional && (
        <form onSubmit={handleSave} className="card" style={{ marginBottom: 24 }}>
          <div className="field">
            <label htmlFor="name">Nome</label>
            <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} required />
          </div>
          <div className="field">
            <label htmlFor="description">Descrição</label>
            <textarea id="description" className="textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="field">
            <label htmlFor="phone">Telefone</label>
            <input id="phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="field">
            <label>Estado</label>
            <span className={`badge${professional.status === "ACTIVE" ? " badge-success" : ""}`}>{professional.status}</span>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {canEdit && (
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "A guardar…" : "Guardar alterações"}
              </button>
            )}
            {canEdit && (
              <button type="button" className="btn btn-danger" onClick={handleToggleStatus}>
                {professional.status === "ACTIVE" ? "Arquivar" : "Reactivar"}
              </button>
            )}
          </div>
        </form>
      )}

      <h2 style={{ fontSize: 16 }}>Serviços associados</h2>

      {canEdit && (
        <form onSubmit={handleAssociate} className="card" style={{ marginBottom: 16 }}>
          {availableToAssociate.length === 0 ? (
            <div className="empty-state">Nenhum serviço activo por associar.</div>
          ) : (
            <div className="field">
              <label htmlFor="service">Adicionar serviço</label>
              <div style={{ display: "flex", gap: 8 }}>
                <select id="service" className="select" value={selectedServiceId} onChange={(e) => setSelectedServiceId(e.target.value)} style={{ flex: 1 }}>
                  <option value="">Escolhe um serviço…</option>
                  {availableToAssociate.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.durationMinutes} min{s.price !== null ? ` — ${s.price} AOA` : ""}
                    </option>
                  ))}
                </select>
                <button type="submit" className="btn btn-primary" disabled={associating || !selectedServiceId}>
                  {associating ? "A associar…" : "Associar"}
                </button>
              </div>
            </div>
          )}
          {associationError && (
            <div className="error-text" style={{ marginTop: 12 }}>
              {associationError.message}
              {associationError instanceof ApiError && associationError.requestId && <div className="request-ref">Referência: {associationError.requestId}</div>}
            </div>
          )}
        </form>
      )}

      {associatedServices === null ? (
        <div className="empty-state">A carregar…</div>
      ) : associatedServices.length === 0 ? (
        <div className="empty-state card">Nenhum serviço associado ainda.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Serviço</th>
              <th>Duração</th>
              <th>Preço</th>
              <th>Estado</th>
              {canEdit && <th></th>}
            </tr>
          </thead>
          <tbody>
            {associatedServices.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/o/${params.organizationId}/services/${s.id}`}>{s.name}</Link>
                </td>
                <td>{s.durationMinutes} min</td>
                <td>{s.price !== null ? `${s.price} AOA` : "—"}</td>
                <td>
                  <span className={`badge${s.status === "ACTIVE" ? " badge-success" : " badge-warning"}`}>{s.status}</span>
                </td>
                {canEdit && (
                  <td>
                    <button type="button" className="btn btn-danger" onClick={() => handleRemoveAssociation(s.id)}>
                      Remover
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
