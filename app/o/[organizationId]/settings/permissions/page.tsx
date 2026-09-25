"use client";

import { useParams } from "next/navigation";
import { useSession } from "../../../../../lib/session/SessionContext";
import { rolePermissions } from "../../../../../lib/permissions";
import { platformRoleCan } from "../../../../../lib/platformPermissions";
import { ROLE_LABELS } from "../../../../../lib/status";
import { PageHeader, Section } from "../../../../../components/patterns/Page";
import { Alert } from "../../../../../components/ui/Feedback";

const ROLES = ["OWNER", "ADMIN", "MANAGER", "STAFF"] as const;

const MODULES: { key: string; label: string; actions: { suffix: string; label: string }[] }[] = [
  { key: "products", label: "Produtos", actions: [{ suffix: "read", label: "ver" }, { suffix: "create", label: "criar" }, { suffix: "update", label: "editar" }, { suffix: "delete", label: "arquivar" }] },
  { key: "categories", label: "Categorias", actions: [{ suffix: "read", label: "ver" }, { suffix: "create", label: "criar" }, { suffix: "update", label: "editar" }, { suffix: "delete", label: "arquivar" }] },
  { key: "customers", label: "Clientes", actions: [{ suffix: "read", label: "ver" }, { suffix: "create", label: "criar" }, { suffix: "update", label: "editar" }, { suffix: "delete", label: "arquivar" }] },
  { key: "inventory", label: "Inventário", actions: [{ suffix: "read", label: "ver" }, { suffix: "create", label: "entradas" }, { suffix: "update", label: "ajustes" }] },
  { key: "orders", label: "Pedidos", actions: [{ suffix: "read", label: "ver" }, { suffix: "create", label: "criar" }, { suffix: "update", label: "editar e mudar estado" }] },
  { key: "services", label: "Serviços", actions: [{ suffix: "read", label: "ver" }, { suffix: "create", label: "criar" }, { suffix: "update", label: "editar e arquivar" }] },
  { key: "professionals", label: "Profissionais", actions: [{ suffix: "read", label: "ver" }, { suffix: "create", label: "criar" }, { suffix: "update", label: "editar, arquivar, associar serviços" }] },
  { key: "scheduling", label: "Horários", actions: [{ suffix: "read", label: "ver" }, { suffix: "create", label: "criar excepções" }, { suffix: "update", label: "horário semanal, fuso horário" }] },
  { key: "appointments", label: "Marcações", actions: [{ suffix: "read", label: "ver" }, { suffix: "create", label: "criar" }, { suffix: "update", label: "reagendar, cancelar, concluir, falta" }] },
];

const PLATFORM: { permission: string; label: string }[] = [
  { permission: "membership.read", label: "Ver equipa" },
  { permission: "membership.update", label: "Alterar papéis e estado de membros" },
  { permission: "organization.update", label: "Alterar nome da organização" },
  { permission: "usage.read", label: "Ver utilização e subscrição" },
  { permission: "api_key.read", label: "Ver credenciais" },
  { permission: "api_key.manage", label: "Criar e revogar credenciais" },
  { permission: "webhook.read", label: "Ver webhooks" },
  { permission: "webhook.manage", label: "Criar, testar e revogar webhooks" },
];

function Mark({ allowed }: { allowed: boolean }) {
  return allowed ? <span aria-label="permitido" style={{ color: "var(--np-success)" }}>✓</span> : <span aria-label="não permitido" className="subtle">—</span>;
}

/**
 * F29 Permissions — read-only matrix of what each role may do, rendered
 * from the Console's UX mirrors (lib/permissions.ts for Na Pista,
 * lib/platformPermissions.ts for UL Platform). Clearly labelled as a
 * mirror: both servers enforce their own rules on every request.
 */
export default function PermissionsPage() {
  const params = useParams<{ organizationId: string }>();
  const { identity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === params.organizationId)?.roleKey;

  return (
    <div>
      <PageHeader title="Permissões" description="O que cada papel pode fazer nesta organização." breadcrumbs={[{ label: "Definições" }, { label: "Permissões" }]} />
      <Alert tone="info" title={`O teu papel: ${roleKey ? ROLE_LABELS[roleKey] ?? roleKey : "—"}`}>
        Esta tabela é informativa. As permissões são sempre verificadas pelos servidores em cada pedido — esconder um botão na Consola nunca substitui essa verificação. Os papéis são
        fixos (definidos pela UL Platform); integrações usam âmbitos em vez de papéis.
      </Alert>

      <Section title="Na Pista">
        <div className="table-wrap">
          <table>
            <caption className="sr-only">Permissões da Na Pista por papel</caption>
            <thead>
              <tr>
                <th scope="col">Módulo</th>
                <th scope="col">Acção</th>
                {ROLES.map((r) => (
                  <th key={r} scope="col" style={{ textAlign: "center" }}>
                    {ROLE_LABELS[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULES.flatMap((m) =>
                m.actions.map((a, index) => (
                  <tr key={`${m.key}.${a.suffix}`}>
                    <td>{index === 0 ? <strong>{m.label}</strong> : null}</td>
                    <td className="wrap">
                      {a.label} <code className="mono subtle">{`${m.key}.${a.suffix}`}</code>
                    </td>
                    {ROLES.map((r) => (
                      <td key={r} style={{ textAlign: "center" }}>
                        <Mark allowed={rolePermissions(r).includes(`${m.key}.${a.suffix}`)} />
                      </td>
                    ))}
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="UL Platform (organização)">
        <div className="table-wrap">
          <table>
            <caption className="sr-only">Permissões da UL Platform por papel</caption>
            <thead>
              <tr>
                <th scope="col">Capacidade</th>
                {ROLES.map((r) => (
                  <th key={r} scope="col" style={{ textAlign: "center" }}>
                    {ROLE_LABELS[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLATFORM.map((p) => (
                <tr key={p.permission}>
                  <td className="wrap">
                    {p.label} <code className="mono subtle">{p.permission}</code>
                  </td>
                  {ROLES.map((r) => (
                    <td key={r} style={{ textAlign: "center" }}>
                      <Mark allowed={platformRoleCan(r, p.permission)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
