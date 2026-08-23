"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  MessageSquarePlus,
  Minus,
  Plus,
  Search,
  Send,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchOrder, type MenuCategory, type OrderWithItems } from "@/lib/queries";
import { submit } from "@/lib/offline/outbox";
import { friendlyError } from "@/lib/errors";
import { QUICK_NOTES } from "@/domain/labels";
import { formatCurrency } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Badge, OrderStatusBadge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils/cn";
import type { Tables } from "@/types/database";

type Product = Tables<"products">;
type OrderItem = Tables<"order_items">;

export function OrderBuilder({
  restaurantId,
  waiterId,
  table,
  menu,
  initialOrder,
}: {
  restaurantId: string;
  waiterId: string;
  table: Pick<Tables<"tables">, "id" | "number" | "name">;
  menu: MenuCategory[];
  initialOrder: OrderWithItems | null;
}) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderWithItems | null>(initialOrder);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const [notesTarget, setNotesTarget] = useState<OrderItem | null>(null);

  /*
   * O id do pedido e sorteado no cliente ANTES do primeiro toque.
   *
   * E isso que torna o envio idempotente: se a rede cair no meio, a operacao
   * e reenviada com o mesmo id e o banco recusa a duplicata em vez de abrir
   * uma segunda comanda para a mesma mesa.
   */
  const draftIds = useRef({ orderId: crypto.randomUUID(), clientRequestId: crypto.randomUUID() });

  const reload = useCallback(async (orderId: string) => {
    try {
      const fresh = await fetchOrder(createClient(), orderId);
      if (fresh) setOrder(fresh);
    } catch {
      // Sem rede seguimos com o estado local; a fila reenvia depois.
    }
  }, []);

  const items = order?.order_items ?? [];
  const draftItems = items.filter((item) => item.status === "draft");
  const sentItems = items.filter((item) => item.status !== "draft" && item.status !== "cancelled");

  const draftTotal = draftItems.reduce((sum, item) => sum + Number(item.total_price), 0);
  const draftCount = draftItems.reduce((sum, item) => sum + item.quantity, 0);

  /** Pedido ja enviado: os itens novos entram como rodada adicional. */
  const isComplement = Boolean(order && order.status !== "draft");

  const products = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = menu.flatMap((category) =>
      category.products.map((product) => ({ ...product, categoryName: category.name })),
    );

    return all.filter((product) => {
      if (activeCategory !== "all" && product.category_id !== activeCategory) return false;
      if (!term) return true;
      return (
        product.name.toLowerCase().includes(term) ||
        product.categoryName.toLowerCase().includes(term)
      );
    });
  }, [menu, search, activeCategory]);

  async function addProduct(product: Product) {
    if (!product.available) return;

    setBusyProductId(product.id);
    try {
      let orderId = order?.id;

      if (!orderId) {
        orderId = draftIds.current.orderId;
        await submit({
          kind: "order.create",
          id: orderId,
          restaurantId,
          tableId: table.id,
          waiterId,
          clientRequestId: draftIds.current.clientRequestId,
          notes: null,
        });
      }

      // Mesmo produto sem observacao ja na rodada aberta: aumenta a
      // quantidade em vez de criar uma segunda linha igual.
      const existing = draftItems.find((item) => item.product_id === product.id && !item.notes);

      if (existing) {
        await submit({
          kind: "item.update",
          id: existing.id,
          quantity: Math.min(99, existing.quantity + 1),
          notes: existing.notes,
        });
      } else {
        await submit({
          kind: "item.add",
          id: crypto.randomUUID(),
          restaurantId,
          orderId,
          productId: product.id,
          productName: product.name,
          unitPrice: Number(product.price),
          quantity: 1,
          notes: null,
        });
      }

      await reload(orderId);
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setBusyProductId(null);
    }
  }

  async function changeQuantity(item: OrderItem, delta: number) {
    const quantity = item.quantity + delta;

    try {
      if (quantity <= 0) {
        await submit({ kind: "item.remove", id: item.id });
      } else {
        await submit({ kind: "item.update", id: item.id, quantity, notes: item.notes });
      }
      if (order) await reload(order.id);
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  async function saveNotes(item: OrderItem, notes: string) {
    try {
      await submit({
        kind: "item.update",
        id: item.id,
        quantity: item.quantity,
        notes: notes.trim() || null,
      });
      if (order) await reload(order.id);
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  async function sendToKitchen() {
    if (!order || draftItems.length === 0) return;

    setSending(true);
    try {
      await submit({
        kind: "order.status",
        id: crypto.randomUUID(),
        orderId: order.id,
        status: "sent",
      });
      toast.success(
        isComplement
          ? `Adicional do pedido #${order.number} enviado.`
          : `Pedido #${order.number} enviado para a cozinha.`,
      );
      setReviewOpen(false);
      router.push("/garcom");
      router.refresh();
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-28">
      {order && sentItems.length > 0 ? (
        <div className="border-border bg-surface-muted flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] border px-4 py-3">
          <span className="text-foreground text-sm font-semibold">Pedido #{order.number}</span>
          <OrderStatusBadge status={order.status} size="sm" />
          <span className="text-foreground-muted text-sm">
            {sentItems.length} item(ns) ja na cozinha
          </span>
          {isComplement ? (
            <Badge tone="brand" size="sm">
              Novos itens entram como adicional
            </Badge>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="text-foreground-subtle pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar produto..."
            className="pl-10"
            type="search"
            aria-label="Buscar produto"
          />
        </div>

        <div className="-mx-1 flex scrollbar-none gap-2 overflow-x-auto px-1">
          <CategoryChip
            label="Tudo"
            active={activeCategory === "all"}
            onClick={() => setActiveCategory("all")}
          />
          {menu.map((category) => (
            <CategoryChip
              key={category.id}
              label={category.name}
              active={activeCategory === category.id}
              onClick={() => setActiveCategory(category.id)}
            />
          ))}
        </div>
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={<Search className="size-8" />}
          title="Nenhum produto encontrado"
          description={
            search ? "Tente outro termo de busca." : "Esta categoria ainda nao tem produtos ativos."
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => {
            const inCart = draftItems
              .filter((item) => item.product_id === product.id)
              .reduce((sum, item) => sum + item.quantity, 0);

            return (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => void addProduct(product)}
                  disabled={!product.available || busyProductId === product.id}
                  className={cn(
                    "flex min-h-24 w-full flex-col justify-between gap-2 rounded-[var(--radius-card)]",
                    "border-border bg-surface border p-3.5 text-left transition-colors",
                    product.available
                      ? "hover:border-brand active:scale-[0.99]"
                      : "cursor-not-allowed opacity-60",
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-foreground text-sm leading-snug font-semibold">
                      {product.name}
                    </p>
                    {!product.available ? (
                      <Badge tone="danger" size="sm" className="mt-1">
                        Indisponivel
                      </Badge>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="tabular text-foreground-muted text-sm font-semibold">
                      {formatCurrency(product.price)}
                    </span>
                    {inCart > 0 ? (
                      <Badge tone="brand" size="sm" solid>
                        {inCart}
                      </Badge>
                    ) : product.available ? (
                      <Plus className="text-brand size-4" />
                    ) : null}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Barra de resumo: sempre visivel, ao alcance do polegar */}
      {draftCount > 0 ? (
        <div className="pb-safe border-border bg-surface fixed inset-x-0 bottom-14 z-20 border-t px-4 py-3 lg:bottom-0">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-foreground text-sm font-semibold">
                {draftCount} {draftCount === 1 ? "item" : "itens"}
                {isComplement ? " (adicional)" : ""}
              </p>
              <p className="tabular text-foreground-muted text-sm">{formatCurrency(draftTotal)}</p>
            </div>
            <Button
              size="lg"
              variant="outline"
              icon={<ShoppingBag className="size-4" />}
              onClick={() => setReviewOpen(true)}
            >
              Revisar
            </Button>
            <Button
              size="lg"
              icon={<Send className="size-4" />}
              onClick={() => void sendToKitchen()}
              loading={sending}
              loadingText="Enviando..."
            >
              Enviar
            </Button>
          </div>
        </div>
      ) : null}

      <ReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        tableNumber={table.number}
        items={draftItems}
        total={draftTotal}
        isComplement={isComplement}
        sending={sending}
        onChangeQuantity={changeQuantity}
        onEditNotes={setNotesTarget}
        onSend={sendToKitchen}
      />

      <NotesDialog item={notesTarget} onClose={() => setNotesTarget(null)} onSave={saveNotes} />
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-10 shrink-0 rounded-full px-4 text-sm font-semibold whitespace-nowrap",
        active
          ? "bg-brand text-brand-foreground"
          : "bg-surface-muted text-foreground-muted hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function ReviewDialog({
  open,
  onOpenChange,
  tableNumber,
  items,
  total,
  isComplement,
  sending,
  onChangeQuantity,
  onEditNotes,
  onSend,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableNumber: number;
  items: OrderItem[];
  total: number;
  isComplement: boolean;
  sending: boolean;
  onChangeQuantity: (item: OrderItem, delta: number) => Promise<void>;
  onEditNotes: (item: OrderItem) => void;
  onSend: () => Promise<void>;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        isComplement ? `Adicional - Mesa ${tableNumber}` : `Revisar pedido - Mesa ${tableNumber}`
      }
      description="Confira quantidades e observacoes antes de enviar."
      footer={
        <>
          <span className="tabular text-foreground mr-auto text-base font-bold">
            {formatCurrency(total)}
          </span>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Continuar adicionando
          </Button>
          <Button
            icon={<Send className="size-4" />}
            onClick={() => void onSend()}
            loading={sending}
            loadingText="Enviando..."
            disabled={items.length === 0}
          >
            Enviar para a cozinha
          </Button>
        </>
      }
    >
      {items.length === 0 ? (
        <EmptyState title="Nenhum item ainda" description="Toque nos produtos para adicionar." />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="border-border flex items-start gap-3 rounded-[var(--radius-control)] border p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-foreground text-sm font-semibold">{item.product_name}</p>
                <p className="tabular text-foreground-muted text-sm">
                  {formatCurrency(item.unit_price)} - {formatCurrency(item.total_price)}
                </p>
                {item.notes ? (
                  <p className="text-warning mt-1 text-sm font-medium">{item.notes}</p>
                ) : null}
                <button
                  type="button"
                  onClick={() => onEditNotes(item)}
                  className="text-brand mt-1.5 inline-flex items-center gap-1 text-xs font-semibold hover:underline"
                >
                  <MessageSquarePlus className="size-3.5" />
                  {item.notes ? "Editar observacao" : "Adicionar observacao"}
                </button>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => void onChangeQuantity(item, -1)}
                  className="bg-surface-muted text-foreground hover:bg-border flex size-10 items-center justify-center rounded-full"
                  aria-label={item.quantity === 1 ? "Remover item" : "Diminuir quantidade"}
                >
                  {item.quantity === 1 ? (
                    <Trash2 className="text-danger size-4" />
                  ) : (
                    <Minus className="size-4" />
                  )}
                </button>
                <span className="tabular text-foreground w-8 text-center text-base font-bold">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => void onChangeQuantity(item, 1)}
                  className="bg-surface-muted text-foreground hover:bg-border flex size-10 items-center justify-center rounded-full"
                  aria-label="Aumentar quantidade"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

function NotesDialog({
  item,
  onClose,
  onSave,
}: {
  item: OrderItem | null;
  onClose: () => void;
  onSave: (item: OrderItem, notes: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);

  // Sincroniza o campo quando o dialogo abre para outro item.
  if (item && item.id !== currentId) {
    setCurrentId(item.id);
    setValue(item.notes ?? "");
  }

  function toggleQuickNote(note: string) {
    const parts = value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    const next = parts.includes(note) ? parts.filter((part) => part !== note) : [...parts, note];

    setValue(next.join(", "));
  }

  async function handleSave() {
    if (!item) return;
    setSaving(true);
    try {
      await onSave(item, value);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const selected = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return (
    <Dialog
      open={Boolean(item)}
      onOpenChange={(open) => !open && onClose()}
      title="Observacao do item"
      description={item?.product_name}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            icon={<Check className="size-4" />}
            onClick={() => void handleSave()}
            loading={saving}
          >
            Salvar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {QUICK_NOTES.map((note) => (
            <button
              key={note}
              type="button"
              onClick={() => toggleQuickNote(note)}
              aria-pressed={selected.includes(note)}
              className={cn(
                "h-10 rounded-full px-3.5 text-sm font-medium",
                selected.includes(note)
                  ? "bg-brand text-brand-foreground"
                  : "bg-surface-muted text-foreground-muted hover:text-foreground",
              )}
            >
              {note}
            </button>
          ))}
        </div>

        <Field label="Observacao livre" htmlFor="item-notes">
          <Textarea
            id="item-notes"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            maxLength={280}
            placeholder="Ex.: trocar a batata por salada"
          />
        </Field>
      </div>
    </Dialog>
  );
}
