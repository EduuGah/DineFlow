"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import {
  deleteCategory,
  deleteProduct,
  saveCategory,
  saveProduct,
  setProductAvailability,
} from "@/server/actions/menu";
import { Button } from "@/components/ui/button";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { formatCurrency } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { ActionResult } from "@/lib/errors";
import type { Tables } from "@/types/database";

type Category = Tables<"categories">;
type Product = Tables<"products">;

export function MenuManager({
  categories,
  products,
}: {
  categories: Category[];
  products: Product[];
}) {
  const router = useRouter();
  const [categoryForm, setCategoryForm] = useState<{ open: boolean; category: Category | null }>({
    open: false,
    category: null,
  });
  const [productForm, setProductForm] = useState<{ open: boolean; product: Product | null }>({
    open: false,
    product: null,
  });
  const [removingCategory, setRemovingCategory] = useState<Category | null>(null);
  const [removingProduct, setRemovingProduct] = useState<Product | null>(null);

  const grouped = useMemo(() => {
    const byCategory = new Map<string, Product[]>();
    for (const category of categories) byCategory.set(category.id, []);

    const orphans: Product[] = [];
    for (const product of products) {
      const bucket = product.category_id ? byCategory.get(product.category_id) : undefined;
      if (bucket) bucket.push(product);
      else orphans.push(product);
    }

    return { byCategory, orphans };
  }, [categories, products]);

  async function toggleAvailability(product: Product) {
    const result = await setProductAvailability(product.id, !product.available);
    if (result.ok) {
      toast.success(
        product.available
          ? `${product.name} marcado como indisponivel.`
          : `${product.name} voltou ao cardapio.`,
      );
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button
          icon={<Plus className="size-4" />}
          onClick={() => setProductForm({ open: true, product: null })}
          disabled={categories.length === 0}
        >
          Novo produto
        </Button>
        <Button
          variant="outline"
          icon={<Plus className="size-4" />}
          onClick={() => setCategoryForm({ open: true, category: null })}
        >
          Nova categoria
        </Button>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="size-8" />}
          title="Comece pelas categorias"
          description="Crie as secoes do cardapio (entradas, pratos, bebidas) e depois cadastre os produtos dentro delas."
          action={
            <Button size="lg" onClick={() => setCategoryForm({ open: true, category: null })}>
              Criar primeira categoria
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {categories.map((category) => {
            const items = grouped.byCategory.get(category.id) ?? [];

            return (
              <Card key={category.id}>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      {category.name}
                      {!category.active ? (
                        <Badge tone="neutral" size="sm">
                          Inativa
                        </Badge>
                      ) : null}
                    </span>
                  }
                  description={
                    items.length === 0
                      ? "Nenhum produto nesta categoria"
                      : `${items.length} produto(s)`
                  }
                  action={
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Editar categoria ${category.name}`}
                        icon={<Pencil className="size-4" />}
                        onClick={() => setCategoryForm({ open: true, category })}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Excluir categoria ${category.name}`}
                        icon={<Trash2 className="text-danger size-4" />}
                        onClick={() => setRemovingCategory(category)}
                      />
                    </div>
                  }
                />

                {items.length > 0 ? (
                  <ul className="divide-border divide-y">
                    {items.map((product) => (
                      <li key={product.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "text-sm font-semibold",
                              product.active
                                ? "text-foreground"
                                : "text-foreground-subtle line-through",
                            )}
                          >
                            {product.name}
                          </p>
                          {product.description ? (
                            <p className="text-foreground-muted truncate text-xs">
                              {product.description}
                            </p>
                          ) : null}
                        </div>

                        {!product.available ? (
                          <Badge tone="danger" size="sm">
                            Indisponivel
                          </Badge>
                        ) : null}

                        <span className="tabular text-foreground text-sm font-semibold">
                          {formatCurrency(product.price)}
                        </span>

                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={
                              product.available
                                ? `Marcar ${product.name} como indisponivel`
                                : `Marcar ${product.name} como disponivel`
                            }
                            icon={
                              product.available ? (
                                <Eye className="size-4" />
                              ) : (
                                <EyeOff className="text-danger size-4" />
                              )
                            }
                            onClick={() => void toggleAvailability(product)}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Editar ${product.name}`}
                            icon={<Pencil className="size-4" />}
                            onClick={() => setProductForm({ open: true, product })}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Excluir ${product.name}`}
                            icon={<Trash2 className="text-danger size-4" />}
                            onClick={() => setRemovingProduct(product)}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Card>
            );
          })}

          {grouped.orphans.length > 0 ? (
            <Card>
              <CardHeader
                title="Sem categoria"
                description="Estes produtos nao aparecem agrupados para o garcom."
              />
              <ul className="divide-border divide-y">
                {grouped.orphans.map((product) => (
                  <li key={product.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="min-w-0 flex-1 text-sm font-semibold">{product.name}</span>
                    <span className="tabular text-sm">{formatCurrency(product.price)}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Editar ${product.name}`}
                      icon={<Pencil className="size-4" />}
                      onClick={() => setProductForm({ open: true, product })}
                    />
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      )}

      <CategoryFormDialog
        open={categoryForm.open}
        category={categoryForm.category}
        onClose={() => setCategoryForm({ open: false, category: null })}
      />

      <ProductFormDialog
        open={productForm.open}
        product={productForm.product}
        categories={categories}
        onClose={() => setProductForm({ open: false, product: null })}
      />

      <ConfirmDialog
        open={Boolean(removingCategory)}
        onOpenChange={(open) => !open && setRemovingCategory(null)}
        title={`Excluir a categoria "${removingCategory?.name}"?`}
        description="Categorias com produtos nao podem ser excluidas."
        confirmLabel="Excluir"
        destructive
        onConfirm={async () => {
          if (!removingCategory) return;
          const result = await deleteCategory(removingCategory.id);
          if (result.ok) toast.success("Categoria excluida.");
          else toast.error(result.error);
          setRemovingCategory(null);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={Boolean(removingProduct)}
        onOpenChange={(open) => !open && setRemovingProduct(null)}
        title={`Excluir "${removingProduct?.name}"?`}
        description="Se o produto ja foi vendido, ele sera apenas retirado do cardapio."
        confirmLabel="Excluir"
        destructive
        onConfirm={async () => {
          if (!removingProduct) return;
          const result = await deleteProduct(removingProduct.id);
          if (result.ok) toast.success("Produto excluido.");
          else toast.info(result.error);
          setRemovingProduct(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function CategoryFormDialog({
  open,
  category,
  onClose,
}: {
  open: boolean;
  category: Category | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult<null> | null, FormData>(
    saveCategory,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success(category ? "Categoria atualizada." : "Categoria criada.");
      onClose();
      router.refresh();
    }
  }, [state, category, onClose, router]);

  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={category ? "Editar categoria" : "Nova categoria"}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" form="category-form" loading={pending}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="category-form" action={action} className="flex flex-col gap-4" noValidate>
        {category ? <input type="hidden" name="id" value={category.id} /> : null}

        {state && !state.ok ? (
          <p role="alert" className="text-danger text-sm font-medium">
            {state.error}
          </p>
        ) : null}

        <Field label="Nome" htmlFor="category-name" required error={fieldErrors?.name}>
          <Input
            id="category-name"
            name="name"
            defaultValue={category?.name ?? ""}
            required
            autoFocus
            placeholder="Pratos principais"
          />
        </Field>

        <Field label="Descricao" htmlFor="category-description" hint="Opcional.">
          <Input
            id="category-description"
            name="description"
            defaultValue={category?.description ?? ""}
            maxLength={280}
          />
        </Field>

        <Field label="Ordem" htmlFor="category-position" hint="Menor aparece primeiro no cardapio.">
          <Input
            id="category-position"
            name="position"
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={category?.position ?? 0}
          />
        </Field>

        <label className="flex items-center gap-2.5">
          <Checkbox name="active" value="true" defaultChecked={category?.active ?? true} />
          <span className="text-foreground text-sm">Categoria ativa</span>
        </label>
      </form>
    </Dialog>
  );
}

function ProductFormDialog({
  open,
  product,
  categories,
  onClose,
}: {
  open: boolean;
  product: Product | null;
  categories: Category[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult<null> | null, FormData>(
    saveProduct,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success(product ? "Produto atualizado." : "Produto criado.");
      onClose();
      router.refresh();
    }
  }, [state, product, onClose, router]);

  const fieldErrors = state?.ok === false ? state.fieldErrors : undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={product ? "Editar produto" : "Novo produto"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" form="product-form" loading={pending}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="product-form" action={action} className="flex flex-col gap-4" noValidate>
        {product ? <input type="hidden" name="id" value={product.id} /> : null}

        {state && !state.ok ? (
          <p role="alert" className="text-danger text-sm font-medium">
            {state.error}
          </p>
        ) : null}

        <Field label="Nome" htmlFor="product-name" required error={fieldErrors?.name}>
          <Input
            id="product-name"
            name="name"
            defaultValue={product?.name ?? ""}
            required
            autoFocus
            placeholder="Hamburguer artesanal"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Preco" htmlFor="product-price" required error={fieldErrors?.price}>
            <Input
              id="product-price"
              name="price"
              inputMode="decimal"
              defaultValue={product ? String(product.price).replace(".", ",") : ""}
              required
              placeholder="32,50"
            />
          </Field>

          <Field label="Categoria" htmlFor="product-category" error={fieldErrors?.categoryId}>
            <Select
              id="product-category"
              name="categoryId"
              defaultValue={product?.category_id ?? categories[0]?.id ?? ""}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="Descricao"
          htmlFor="product-description"
          hint="Opcional. Aparece para o garcom."
        >
          <Textarea
            id="product-description"
            name="description"
            defaultValue={product?.description ?? ""}
            maxLength={500}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tempo de preparo" htmlFor="product-prep" hint="Em minutos. Opcional.">
            <Input
              id="product-prep"
              name="prepMinutes"
              type="number"
              inputMode="numeric"
              min={0}
              max={600}
              defaultValue={product?.prep_minutes ?? ""}
            />
          </Field>

          <Field label="Ordem" htmlFor="product-position">
            <Input
              id="product-position"
              name="position"
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={product?.position ?? 0}
            />
          </Field>
        </div>

        <div className="flex flex-col gap-2.5">
          <label className="flex items-center gap-2.5">
            <Checkbox name="active" value="true" defaultChecked={product?.active ?? true} />
            <span className="text-foreground text-sm">Ativo no cardapio</span>
          </label>
          <label className="flex items-center gap-2.5">
            <Checkbox name="available" value="true" defaultChecked={product?.available ?? true} />
            <span className="text-foreground text-sm">
              Disponivel hoje (desmarque quando acabar o ingrediente)
            </span>
          </label>
        </div>
      </form>
    </Dialog>
  );
}
