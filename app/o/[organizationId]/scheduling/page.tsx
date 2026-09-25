"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "../../../../lib/session/SessionContext";
import { roleCan } from "../../../../lib/permissions";
import { listProfessionals } from "../../../../lib/api/professionals";
import { useAsync } from "../../../../lib/useAsync";
import { statusInfo } from "../../../../lib/status";
import { useOrganizationTimezone } from "../../../../lib/appointments/components";
import { LIST_LIMIT, ListPage } from "../../../../components/patterns/ListPage";
import { Alert } from "../../../../components/ui/Feedback";
import { Badge } from "../../../../components/ui/Data";

/**
 * F29 "Agenda" hub. In the API, weekly rules, exceptions and availability
 * belong to each Professional (ADR-039) — there is no organization-level
 * calendar resource — so this page does not invent one: it shows the
 * organization timezone (the precondition for everything) and leads to
 * each active professional's schedule sections. Booked time lives in
 * Marcações.
 */
export default function SchedulingHubPage() {
  const params = useParams<{ organizationId: string }>();
  const org = params.organizationId;
  const { identity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === org)?.roleKey;
  const tz = useOrganizationTimezone(org);
  const professionals = useAsync(() => listProfessionals(org, { status: "ACTIVE", limit: LIST_LIMIT }), [org]);
  const base = `/o/${org}`;

  return (
    <ListPage
      title="Horários e disponibilidade"
      description="Cada profissional tem o seu horário semanal e as suas excepções. A disponibilidade calculada é indicativa — só uma marcação confirmada ocupa tempo."
      moduleName="Horários"
      state={professionals}
      rowKey={(p) => p.id}
      empty={{ title: "Nenhum profissional activo.", action: roleCan(roleKey, "professionals.create") ? <Link href={`${base}/professionals?new=1`}>Criar profissional</Link> : undefined }}
      columns={[
        { key: "name", header: "Profissional", wrap: true, cell: (p) => <Link href={`${base}/professionals/${p.id}`}>{p.name}</Link> },
        { key: "status", header: "Estado", cell: (p) => <Badge tone={statusInfo("catalog", p.status).tone}>{statusInfo("catalog", p.status).label}</Badge> },
        {
          key: "links",
          header: "Configuração",
          cell: (p) => (
            <span className="row">
              <Link href={`${base}/professionals/${p.id}#horario`}>Horário semanal</Link>
              <Link href={`${base}/professionals/${p.id}#excepcoes`}>Excepções</Link>
              <Link href={`${base}/professionals/${p.id}#disponibilidade`}>Disponibilidade</Link>
            </span>
          ),
        },
      ]}
    >
      {tz.loading ? null : tz.timezone ? (
        <Alert tone="info" title={`Fuso horário: ${tz.timezone}`}>
          Os horários são horas locais neste fuso. <Link href={`${base}/settings`}>Alterar em Definições</Link> · <Link href={`${base}/appointments`}>Ver marcações</Link>
        </Alert>
      ) : (
        <Alert tone="warning" title="Fuso horário por configurar">
          Sem fuso horário não é possível calcular disponibilidade nem marcar. <Link href={`${base}/settings`}>Configurar em Definições</Link>
        </Alert>
      )}
    </ListPage>
  );
}
