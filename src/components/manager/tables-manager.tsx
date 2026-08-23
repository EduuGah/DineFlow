"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LayoutGrid, Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { createTablesInBulk, deleteTable, saveTable } from "@/server/actions/tables";
import { Button } from "@/components/ui/button";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { DataTable, Td, Th, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { TableStatusBadge } from "@/components/ui/badge";
import type { ActionResult } from "@/lib/errors";
import type { Tables } from "@/types/database";

type Table = Tables<"tables">;

export function TablesManager({ tables }: { tables: Table[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Table | null>(null);
  const [creating, setCreating] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [removing, setRemoving] = useState<Table | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
          Nova mesa
        </Button>
        <Button
          variant="outline"
          icon={<Layers className="size-4" />}
          onClick={() => setBulkOpen(true)}
        >
          Criar varias de uma vez
        </Button>
      </div>

      {tables.length === 0 ? (
        <EmptyState
          icon={<LayoutGrid className="size-8" />}
          title="Nenhuma mesa cadastrada"
          description="Comece criando o intervalo de mesas do salao -- da mesa 1 ate a ultima."
          action={
            <Button size="lg" onClick={() => setBulkOpen(true)}>
              Criar mesas
            </Button>
          }
        />
      ) : (
        <DataTable>
          <thead>
            <tr>
              <Th>Mesa</Th>
              <Th>Nome</Th>
              <Th>Area</Th>
              <Th align="center">Lugares</Th>
              <Th>Situacao</Th>
              <Th align="right">Acoes</Th>
            </tr>
          </thead>
          <tbody>
            {tables.map((table) => (
              <Tr key={table.id}>
                <Td className="tabular font-bold">{table.number}</Td>
                <Td>{table.name ?? "-"}</Td>
                <Td>{table.area ?? "-"}</Td>
                <Td align="center" className="tabular">
                  {table.capacity}
                </Td>
                <Td>
                  {table.active ? (
                    <TableStatusBadge status={table.status} size="sm" />
                  ) : (
                    <span className="text-foreground-subtle text-sm">Desativada</span>
                  )}
                </Td>
                <Td align="right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Editar mesa ${table.number}`}
                      icon={<Pencil className="size-4" />}
                      onClick={() => setEditing(table)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Excluir mesa ${table.number}`}
                      icon={<Trash2 className="text-danger size-4" />}
                      onClick={() => setRemoving(table)}
                    />
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </DataTable>
      )}

      <TableFormDialog
        open={creating || Boolean(editing)}
        table={editing}
        suggestedNumber={Math.max(0, ...tables.map((table) => table.number)) + 1}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />

      <BulkDialog open={bulkOpen} onClose={() => setBulkOpen(false)} />

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Excluir a mesa ${removing?.number}?`}
        description="Se a mesa ja tiver pedidos no historico, ela sera apenas desativada."
        confirmLabel="Excluir"
        destructive
        onConfirm={async () => {
          if (!removing) return;
          const result = await deleteTable(removing.id);
          if (result.ok) {
            toast.success("Mesa excluida.");
          } else {
            toast.info(result.error);
          }
          setRemoving(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function TableFormDialog({
  open,
  table,
  suggestedNumber,
  onClose,
}: {
  open: boolean;
  table: Table | null;
  suggestedNumber: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult<null> | null, FormData>(
    saveTable,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success(table ? "Mesa atualizada." : "Mesa criada.");
      onClose();
      router.refresh();
    }
  }, [state, table, onClose, router]);

  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={table ? `Mesa ${table.number}` : "Nova mesa"}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" form="table-form" loading={pending}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="table-form" action={action} className="flex flex-col gap-4" noValidate>
        {table ? <input type="hidden" name="id" value={table.id} /> : null}

        {state && !state.ok ? (
          <p role="alert" className="text-danger text-sm font-medium">
            {state.error}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Numero" htmlFor="number" required error={fieldErrors?.number}>
            <Input
              id="number"
              name="number"
              type="number"
              inputMode="numeric"
              min={1}
              defaultValue={table?.number ?? suggestedNumber}
              required
            />
          </Field>
          <Field label="Lugares" htmlFor="capacity" required error={fieldErrors?.capacity}>
            <Input
              id="capacity"
              name="capacity"
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              defaultValue={table?.capacity ?? 4}
              required
            />
          </Field>
        </div>

        <Field label="Nome" htmlFor="name" hint="Opcional. Ex.: Varanda 1">
          <Input id="name" name="name" defaultValue={table?.name ?? ""} maxLength={60} />
        </Field>

        <Field label="Area" htmlFor="area" hint="Opcional. Ex.: Salao, Deck, Mezanino">
          <Input id="area" name="area" defaultValue={table?.area ?? ""} maxLength={60} />
        </Field>

        <label className="flex items-center gap-2.5">
          <Checkbox name="active" defaultChecked={table?.active ?? true} />
          <span className="text-foreground text-sm">
            Mesa ativa (aparece no salao para os garcons)
          </span>
        </label>
      </form>
    </Dialog>
  );
}

function BulkDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(20);
  const [capacity, setCapacity] = useState(4);
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    setSaving(true);
    try {
      const result = await createTablesInBulk(from, to, capacity);
      if (result.ok) {
        toast.success(`${result.data} mesas criadas.`);
        onClose();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Criar varias mesas"
      description="Cria todas as mesas do intervalo. Mesas que ja existem sao ignoradas."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void handleCreate()} loading={saving}>
            Criar mesas
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-3 gap-3">
        <Field label="Da mesa" htmlFor="bulk-from">
          <Input
            id="bulk-from"
            type="number"
            inputMode="numeric"
            min={1}
            value={from}
            onChange={(event) => setFrom(Number(event.target.value))}
          />
        </Field>
        <Field label="Ate a mesa" htmlFor="bulk-to">
          <Input
            id="bulk-to"
            type="number"
            inputMode="numeric"
            min={1}
            value={to}
            onChange={(event) => setTo(Number(event.target.value))}
          />
        </Field>
        <Field label="Lugares" htmlFor="bulk-capacity">
          <Input
            id="bulk-capacity"
            type="number"
            inputMode="numeric"
            min={1}
            max={50}
            value={capacity}
            onChange={(event) => setCapacity(Number(event.target.value))}
          />
        </Field>
      </div>
      <p className="text-foreground-muted mt-3 text-sm">
        Serao criadas {Math.max(0, to - from + 1)} mesas com {capacity} lugares cada.
      </p>
    </Dialog>
  );
}
