"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { useActionSuccess } from "@/hooks/use-action-success";
import { toast } from "sonner";
import { MailPlus, Pencil, UserMinus, UserPlus, Users, X } from "lucide-react";
import {
  deactivateStaff,
  inviteStaff,
  reactivateStaff,
  revokeInvitation,
  updateStaff,
} from "@/server/actions/staff";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/domain/labels";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { DataTable, Td, Th, Tr } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { relativeTime } from "@/lib/utils/format";
import type { ActionResult } from "@/lib/errors";
import type { Enums, Tables } from "@/types/database";

type Staff = Tables<"users">;
type Invitation = Tables<"staff_invitations">;

const ASSIGNABLE_ROLES: Enums<"user_role">[] = ["waiter", "kitchen", "manager", "admin"];

export function StaffManager({
  staff,
  invitations,
  currentUserId,
  currentRole,
}: {
  staff: Staff[];
  invitations: Invitation[];
  currentUserId: string;
  currentRole: Enums<"user_role">;
}) {
  const router = useRouter();
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [deactivating, setDeactivating] = useState<Staff | null>(null);

  const roles = ASSIGNABLE_ROLES.filter((role) => role !== "admin" || currentRole === "admin");

  return (
    <div className="flex flex-col gap-5">
      <Button icon={<MailPlus className="size-4" />} onClick={() => setInviting(true)}>
        Convidar pelo e-mail
      </Button>

      {invitations.length > 0 ? (
        <Card>
          <CardHeader
            title="Convites aguardando o primeiro acesso"
            description="O vínculo acontece quando a pessoa entrar com a conta Google desse e-mail."
          />
          <ul className="divide-border divide-y">
            {invitations.map((invitation) => (
              <li key={invitation.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="text-foreground min-w-0 flex-1 truncate text-sm font-medium">
                  {invitation.email}
                </span>
                <Badge tone="neutral" size="sm">
                  {ROLE_LABELS[invitation.role]}
                </Badge>
                <span className="text-foreground-subtle text-xs">
                  convidado {relativeTime(invitation.created_at)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Cancelar convite de ${invitation.email}`}
                  icon={<X className="text-danger size-4" />}
                  onClick={async () => {
                    const result = await revokeInvitation(invitation.id);
                    if (result.ok) toast.success("Convite cancelado.");
                    else toast.error(result.error);
                    router.refresh();
                  }}
                />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {staff.length === 0 ? (
        <EmptyState
          icon={<Users className="size-8" />}
          title="Nenhum funcionário na equipe"
          description="Convide os e-mails do salão e da cozinha. Cada pessoa entra com a própria conta Google."
          action={
            <Button size="lg" onClick={() => setInviting(true)}>
              Convidar equipe
            </Button>
          }
        />
      ) : (
        <DataTable>
          <thead>
            <tr>
              <Th>Nome</Th>
              <Th>E-mail</Th>
              <Th>Papel</Th>
              <Th>Situação</Th>
              <Th align="right">Ações</Th>
            </tr>
          </thead>
          <tbody>
            {staff.map((person) => (
              <Tr key={person.id}>
                <Td className="font-medium">
                  {person.name}
                  {person.id === currentUserId ? (
                    <Badge tone="brand" size="sm" className="ml-2">
                      você
                    </Badge>
                  ) : null}
                </Td>
                <Td className="text-foreground-muted">{person.email}</Td>
                <Td>{ROLE_LABELS[person.role]}</Td>
                <Td>
                  {person.status === "active" ? (
                    <Badge tone="success" size="sm">
                      Ativo
                    </Badge>
                  ) : (
                    <Badge tone="neutral" size="sm">
                      Inativo
                    </Badge>
                  )}
                </Td>
                <Td align="right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Editar ${person.name}`}
                      icon={<Pencil className="size-4" />}
                      onClick={() => setEditing(person)}
                    />
                    {person.status === "active" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Desativar ${person.name}`}
                        icon={<UserMinus className="text-danger size-4" />}
                        disabled={person.id === currentUserId}
                        onClick={() => setDeactivating(person)}
                      />
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Reativar ${person.name}`}
                        icon={<UserPlus className="text-success size-4" />}
                        onClick={async () => {
                          const result = await reactivateStaff(person.id);
                          if (result.ok) toast.success(`${person.name} reativado.`);
                          else toast.error(result.error);
                          router.refresh();
                        }}
                      />
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </DataTable>
      )}

      <InviteDialog open={inviting} roles={roles} onClose={() => setInviting(false)} />
      <EditStaffDialog staff={editing} roles={roles} onClose={() => setEditing(null)} />

      <ConfirmDialog
        open={Boolean(deactivating)}
        onOpenChange={(open) => !open && setDeactivating(null)}
        title={`Desativar ${deactivating?.name}?`}
        description="O acesso e bloqueado na hora, mas o histórico de pedidos e mantido."
        confirmLabel="Desativar"
        destructive
        onConfirm={async () => {
          if (!deactivating) return;
          const result = await deactivateStaff(deactivating.id);
          if (result.ok) toast.success("Acesso desativado.");
          else toast.error(result.error);
          setDeactivating(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function RoleSelect({
  id,
  roles,
  defaultValue,
  error,
}: {
  id: string;
  roles: Enums<"user_role">[];
  defaultValue?: Enums<"user_role">;
  error?: string[];
}) {
  const [role, setRole] = useState<Enums<"user_role">>(defaultValue ?? "waiter");

  return (
    <Field label="Papel" htmlFor={id} required hint={ROLE_DESCRIPTIONS[role]} error={error}>
      <Select
        id={id}
        name="role"
        value={role}
        onChange={(event) => setRole(event.target.value as Enums<"user_role">)}
      >
        {roles.map((value) => (
          <option key={value} value={value}>
            {ROLE_LABELS[value]}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function InviteDialog({
  open,
  roles,
  onClose,
}: {
  open: boolean;
  roles: Enums<"user_role">[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult<null> | null, FormData>(
    inviteStaff,
    null,
  );

  useActionSuccess(state, () => {
    toast.success("Convite criado. Peca para a pessoa entrar com o Google desse e-mail.");
    onClose();
    router.refresh();
  });

  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Convidar para a equipe"
      description="O acesso e liberado no primeiro login com a conta Google desse e-mail."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" form="invite-form" loading={pending}>
            Convidar
          </Button>
        </>
      }
    >
      <form id="invite-form" action={action} className="flex flex-col gap-4" noValidate>
        {state && !state.ok ? (
          <p role="alert" className="text-danger text-sm font-medium">
            {state.error}
          </p>
        ) : null}

        <Field
          label="E-mail da conta Google"
          htmlFor="invite-email"
          required
          hint="Precisa ser exatamente o e-mail que a pessoa usa para entrar no Google."
          error={fieldErrors?.email}
        >
          <Input
            id="invite-email"
            name="email"
            type="email"
            inputMode="email"
            required
            autoFocus
            placeholder="joao@gmail.com"
          />
        </Field>

        <RoleSelect id="invite-role" roles={roles} error={fieldErrors?.role} />
      </form>
    </Dialog>
  );
}

function EditStaffDialog({
  staff,
  roles,
  onClose,
}: {
  staff: Staff | null;
  roles: Enums<"user_role">[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult<null> | null, FormData>(
    updateStaff,
    null,
  );

  useActionSuccess(state, () => {
    toast.success("Funcionário atualizado.");
    onClose();
    router.refresh();
  });

  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;

  return (
    <Dialog
      open={Boolean(staff)}
      onOpenChange={(next) => !next && onClose()}
      title={staff?.name ?? "Funcionário"}
      description={staff?.email}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" form="staff-edit-form" loading={pending}>
            Salvar
          </Button>
        </>
      }
    >
      {staff ? (
        <form
          id="staff-edit-form"
          key={staff.id}
          action={action}
          className="flex flex-col gap-4"
          noValidate
        >
          <input type="hidden" name="id" value={staff.id} />

          {state && !state.ok ? (
            <p role="alert" className="text-danger text-sm font-medium">
              {state.error}
            </p>
          ) : null}

          <Field label="Nome" htmlFor="edit-name" required error={fieldErrors?.name}>
            <Input id="edit-name" name="name" defaultValue={staff.name} required />
          </Field>

          <RoleSelect
            id="edit-role"
            roles={roles}
            defaultValue={staff.role}
            error={fieldErrors?.role}
          />

          <Field label="Telefone" htmlFor="edit-phone">
            <Input id="edit-phone" name="phone" defaultValue={staff.phone ?? ""} inputMode="tel" />
          </Field>

          <Field label="Situação" htmlFor="edit-status">
            <Select id="edit-status" name="status" defaultValue={staff.status}>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </Select>
          </Field>
        </form>
      ) : null}
    </Dialog>
  );
}
