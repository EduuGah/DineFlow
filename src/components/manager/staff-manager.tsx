"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { useActionSuccess } from "@/hooks/use-action-success";
import { toast } from "sonner";
import { KeyRound, Pencil, UserMinus, UserPlus, Users } from "lucide-react";
import {
  createStaffAccount,
  deactivateStaff,
  reactivateStaff,
  resetStaffPassword,
  updateStaff,
} from "@/server/actions/staff";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/domain/labels";
import { displayCredential } from "@/domain/staff-credentials";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { DataTable, Td, Th, Tr } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import type { ActionResult } from "@/lib/errors";
import type { Enums, Tables } from "@/types/database";

type Staff = Tables<"users">;

const ASSIGNABLE_ROLES: Enums<"user_role">[] = ["waiter", "kitchen", "manager", "admin"];

export function StaffManager({
  staff,
  currentUserId,
  currentRole,
}: {
  staff: Staff[];
  currentUserId: string;
  currentRole: Enums<"user_role">;
}) {
  const router = useRouter();
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [deactivating, setDeactivating] = useState<Staff | null>(null);
  const [resetting, setResetting] = useState<Staff | null>(null);

  const roles = ASSIGNABLE_ROLES.filter((role) => role !== "admin" || currentRole === "admin");

  return (
    <div className="flex flex-col gap-5">
      <Button icon={<UserPlus className="size-4" />} onClick={() => setInviting(true)}>
        Criar acesso
      </Button>

      {staff.length === 0 ? (
        <EmptyState
          icon={<Users className="size-8" />}
          title="Nenhum funcionário na equipe"
          description="Crie o acesso de cada pessoa do salão e da cozinha. Você define a senha e entrega para ela."
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
              <Th>Usuário</Th>
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
                <Td className="text-foreground-muted">{displayCredential(person.email)}</Td>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Redefinir a senha de ${person.name}`}
                      icon={<KeyRound className="size-4" />}
                      onClick={() => setResetting(person)}
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

      <CreateAccountDialog open={inviting} roles={roles} onClose={() => setInviting(false)} />
      <ResetPasswordDialog staff={resetting} onClose={() => setResetting(null)} />
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

function CreateAccountDialog({
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
    createStaffAccount,
    null,
  );

  useActionSuccess(state, () => {
    toast.success("Acesso criado. Entregue o e-mail e a senha para a pessoa.");
    onClose();
    router.refresh();
  });

  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Criar acesso"
      description="A conta já nasce pronta. Entregue o e-mail e a senha para a pessoa."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" form="conta-form" loading={pending}>
            Criar acesso
          </Button>
        </>
      }
    >
      <form id="conta-form" action={action} className="flex flex-col gap-4" noValidate>
        {state && !state.ok ? (
          <p role="alert" className="text-danger text-sm font-medium">
            {state.error}
          </p>
        ) : null}

        <Field label="Nome" htmlFor="conta-nome" required error={fieldErrors?.name}>
          <Input id="conta-nome" name="name" required autoFocus placeholder="João Pereira" />
        </Field>

        <Field
          label="Usuário"
          htmlFor="conta-usuario"
          required
          hint="É com isso que a pessoa entra. Sem e-mail, sem espaços."
          error={fieldErrors?.username}
        >
          <Input
            id="conta-usuario"
            name="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            placeholder="joao"
          />
        </Field>

        <RoleSelect id="conta-papel" roles={roles} error={fieldErrors?.role} />

        <Field label="Telefone" htmlFor="conta-telefone" hint="Opcional.">
          <Input id="conta-telefone" name="phone" inputMode="tel" placeholder="(11) 90000-0000" />
        </Field>

        <Field
          label="Senha inicial"
          htmlFor="conta-senha"
          required
          hint="Pelo menos 8 caracteres. Fica visível para você anotar e entregar."
          error={fieldErrors?.password}
        >
          <Input
            id="conta-senha"
            name="password"
            type="text"
            minLength={8}
            required
            autoComplete="off"
          />
        </Field>
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
      description={staff ? displayCredential(staff.email) : undefined}
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

/**
 * Redefinição de senha pelo gerente.
 *
 * Não existe "esqueci minha senha" por e-mail aqui de propósito: no meio do
 * movimento, a saída que funciona é o gerente definir uma nova na hora e falar
 * em voz alta. O fluxo por e-mail pressupõe que o garçom tenha acesso à caixa
 * de entrada durante o turno.
 */
function ResetPasswordDialog({ staff, onClose }: { staff: Staff | null; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleReset() {
    if (!staff) return;

    setSaving(true);
    try {
      const result = await resetStaffPassword(staff.id, password);
      if (result.ok) {
        toast.success("Senha redefinida. Passe a nova senha para a pessoa.");
        setPassword("");
        onClose();
      } else {
        toast.error(result.error);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={Boolean(staff)}
      onOpenChange={(next) => !next && onClose()}
      title="Redefinir senha"
      description={staff ? `Nova senha para ${staff.name}.` : undefined}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={() => void handleReset()}
            loading={saving}
            disabled={password.length < 8}
          >
            Redefinir
          </Button>
        </>
      }
    >
      <Field label="Nova senha" htmlFor="nova-senha" hint="Pelo menos 8 caracteres.">
        <Input
          id="nova-senha"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={8}
          autoComplete="off"
        />
      </Field>
    </Dialog>
  );
}
