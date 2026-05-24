"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState, useTransition } from "react";
import {
  PencilLine,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { stockStatusLabels, unitLabels } from "@/lib/constants";
import { cn, formatCurrency } from "@/lib/utils";

type CategoryOption = {
  id: string;
  name: string;
  slug: string;
};

type ProductRecord = {
  id: string;
  categoryId: string;
  name: string;
  description?: string | null;
  price: number | string;
  unit: string;
  imageUrl?: string | null;
  stockStatus: string;
  isActive: boolean;
  isHit: boolean;
  isNew: boolean;
  isPromo: boolean;
  category: { name: string; slug?: string };
};

type ProductFormState = {
  categoryId: string;
  name: string;
  description: string;
  price: string;
  unit: string;
  imageUrl: string;
  stockStatus: string;
  isActive: boolean;
  isHit: boolean;
  isNew: boolean;
  isPromo: boolean;
};

const unitOptions = [
  { value: "KG", label: "кг" },
  { value: "PIECE", label: "шт." },
  { value: "PACK", label: "упак." },
];

const stockOptions = [
  { value: "IN_STOCK", label: "В наличии" },
  { value: "LOW", label: "Осталось мало" },
  { value: "OUT_OF_STOCK", label: "Нет в наличии" },
];

function createEmptyProductForm(categoryId = ""): ProductFormState {
  return {
    categoryId,
    name: "",
    description: "",
    price: "",
    unit: "KG",
    imageUrl: "",
    stockStatus: "IN_STOCK",
    isActive: true,
    isHit: false,
    isNew: false,
    isPromo: false,
  };
}

export function AdminCatalogManager({
  categories,
  products,
}: {
  categories: CategoryOption[];
  products: ProductRecord[];
}) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [categoryForm, setCategoryForm] = useState({ name: "", slug: "" });
  const [productForm, setProductForm] = useState<ProductFormState>(() =>
    createEmptyProductForm(categories[0]?.id ?? ""),
  );
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);
  const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const resolvedCategoryId = productForm.categoryId || categories[0]?.id || "";

  const filteredProducts = useMemo(() => {
    const normalizedQuery = deferredSearchQuery.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory =
        categoryFilter === "all" || product.categoryId === categoryFilter;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        product.name.toLowerCase().includes(normalizedQuery) ||
        (product.description ?? "").toLowerCase().includes(normalizedQuery) ||
        product.category.name.toLowerCase().includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    });
  }, [categoryFilter, deferredSearchQuery, products]);

  function refreshCatalog() {
    startRefresh(() => {
      router.refresh();
    });
  }

  function resetEditor(nextCategoryId?: string) {
    const fallbackCategoryId = nextCategoryId ?? productForm.categoryId ?? categories[0]?.id ?? "";
    setSelectedProductId(null);
    setProductForm(createEmptyProductForm(fallbackCategoryId));
  }

  function beginEditing(product: ProductRecord) {
    setFeedback(null);
    setSelectedProductId(product.id);
    setProductForm({
      categoryId: product.categoryId,
      name: product.name,
      description: product.description ?? "",
      price: String(Number(product.price)),
      unit: product.unit,
      imageUrl: product.imageUrl ?? "",
      stockStatus: product.stockStatus,
      isActive: product.isActive,
      isHit: product.isHit,
      isNew: product.isNew,
      isPromo: product.isPromo,
    });
  }

  async function submitCategory() {
    setIsSubmittingCategory(true);
    setFeedback(null);

    const response = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...categoryForm,
        slug: categoryForm.slug.trim().toLowerCase(),
        sortOrder: categories.length + 1,
      }),
    });

    const result = await response.json();
    setIsSubmittingCategory(false);

    if (!response.ok) {
      setFeedback({ type: "error", message: result.error ?? "Не удалось добавить категорию." });
      return;
    }

    setCategoryForm({ name: "", slug: "" });
    setFeedback({ type: "success", message: "Категория добавлена." });
    refreshCatalog();
  }

  async function submitProduct() {
    setIsSubmittingProduct(true);
    setFeedback(null);

    const response = await fetch(
      selectedProductId ? `/api/admin/products/${selectedProductId}` : "/api/admin/products",
      {
        method: selectedProductId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...productForm,
          categoryId: resolvedCategoryId,
          price: Number(productForm.price),
        }),
      },
    );

    const result = await response.json();
    setIsSubmittingProduct(false);

    if (!response.ok) {
      setFeedback({ type: "error", message: result.error ?? "Не удалось сохранить товар." });
      return;
    }

    setFeedback({
      type: "success",
      message: selectedProductId
        ? "Изменения по товару сохранены."
        : "Товар добавлен в каталог.",
    });
    resetEditor(productForm.categoryId);
    refreshCatalog();
  }

  async function deleteProduct(product: ProductRecord) {
    if (!globalThis.confirm(`Удалить товар "${product.name}" из каталога?`)) {
      return;
    }

    setDeletingProductId(product.id);
    setFeedback(null);

    const response = await fetch(`/api/admin/products/${product.id}`, {
      method: "DELETE",
    });
    const result = await response.json();
    setDeletingProductId(null);

    if (!response.ok) {
      setFeedback({ type: "error", message: result.error ?? "Не удалось удалить товар." });
      return;
    }

    if (selectedProductId === product.id) {
      resetEditor(categories[0]?.id ?? "");
    }

    setFeedback({ type: "success", message: "Товар удалён из каталога." });
    refreshCatalog();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
      <div className="space-y-5">
        <section className="glass-panel rounded-[2rem] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
                Управление товаром
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                {selectedProductId ? "Редактирование карточки" : "Новый товар"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Добавляйте новые позиции, меняйте цену, наличие и отметки для витрины.
              </p>
            </div>

            {selectedProductId && (
              <Button variant="ghost" className="gap-2" onClick={() => resetEditor()}>
                <X size={16} />
                Сбросить
              </Button>
            )}
          </div>

          <div className="mt-5 grid gap-3">
            <select
              value={resolvedCategoryId}
              onChange={(event) =>
                setProductForm((current) => ({ ...current, categoryId: event.target.value }))
              }
              className="h-11 rounded-2xl bg-white px-4 outline-none ring-1 ring-[var(--line)]"
              disabled={categories.length === 0}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <input
              value={productForm.name}
              onChange={(event) =>
                setProductForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Название товара"
              className="h-11 rounded-2xl bg-white px-4 outline-none ring-1 ring-[var(--line)]"
            />

            <textarea
              value={productForm.description}
              onChange={(event) =>
                setProductForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="Короткое описание для клиента"
              rows={4}
              className="rounded-2xl bg-white px-4 py-3 outline-none ring-1 ring-[var(--line)]"
            />

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--muted)]">Цена</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={productForm.price}
                  onChange={(event) =>
                    setProductForm((current) => ({ ...current, price: event.target.value }))
                  }
                  placeholder="Например, 390"
                  className="h-11 w-full rounded-2xl bg-white px-4 outline-none ring-1 ring-[var(--line)]"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--muted)]">Единица</span>
                <select
                  value={productForm.unit}
                  onChange={(event) =>
                    setProductForm((current) => ({ ...current, unit: event.target.value }))
                  }
                  className="h-11 w-full rounded-2xl bg-white px-4 outline-none ring-1 ring-[var(--line)]"
                >
                  {unitOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--muted)]">Статус наличия</span>
                <select
                  value={productForm.stockStatus}
                  onChange={(event) =>
                    setProductForm((current) => ({
                      ...current,
                      stockStatus: event.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-2xl bg-white px-4 outline-none ring-1 ring-[var(--line)]"
                >
                  {stockOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--muted)]">Фото товара</span>
                <input
                  value={productForm.imageUrl}
                  onChange={(event) =>
                    setProductForm((current) => ({ ...current, imageUrl: event.target.value }))
                  }
                  placeholder="https://..."
                  className="h-11 w-full rounded-2xl bg-white px-4 outline-none ring-1 ring-[var(--line)]"
                />
              </label>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { key: "isActive", label: "Показывать в каталоге" },
                { key: "isHit", label: "Пометить как хит" },
                { key: "isNew", label: "Показать как новинку" },
                { key: "isPromo", label: "Выделить как акцию" },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-3 rounded-[1.25rem] bg-white/80 px-4 py-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={productForm[item.key as keyof ProductFormState] as boolean}
                    onChange={(event) =>
                      setProductForm((current) => ({
                        ...current,
                        [item.key]: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-[var(--line-strong)]"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                className="gap-2"
                onClick={() => submitProduct()}
                disabled={isSubmittingProduct || categories.length === 0}
              >
                {selectedProductId ? <PencilLine size={16} /> : <Plus size={16} />}
                {isSubmittingProduct
                  ? "Сохраняем..."
                  : selectedProductId
                    ? "Сохранить изменения"
                    : "Добавить товар"}
              </Button>
              {selectedProductId && (
                <Button variant="ghost" onClick={() => resetEditor()}>
                  Отменить редактирование
                </Button>
              )}
            </div>
          </div>
        </section>

        <section className="glass-panel rounded-[2rem] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
                Категории
              </p>
              <h2 className="mt-2 text-2xl font-semibold">Новая категория</h2>
            </div>
            <Sparkles size={18} className="text-[var(--accent-strong)]" />
          </div>

          <div className="mt-4 space-y-3">
            <input
              value={categoryForm.name}
              onChange={(event) =>
                setCategoryForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Название категории"
              className="h-11 w-full rounded-2xl bg-white px-4 outline-none ring-1 ring-[var(--line)]"
            />
            <input
              value={categoryForm.slug}
              onChange={(event) =>
                setCategoryForm((current) => ({ ...current, slug: event.target.value }))
              }
              placeholder="slug, например sezonnoe"
              className="h-11 w-full rounded-2xl bg-white px-4 outline-none ring-1 ring-[var(--line)]"
            />
            <Button onClick={() => submitCategory()} disabled={isSubmittingCategory}>
              {isSubmittingCategory ? "Добавляем..." : "Добавить категорию"}
            </Button>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {categories.map((category) => (
              <span
                key={category.id}
                className="rounded-full bg-white/82 px-3 py-2 text-xs font-semibold text-[var(--foreground)] ring-1 ring-[var(--line)]"
              >
                {category.name}
              </span>
            ))}
          </div>
        </section>
      </div>

      <section className="glass-panel rounded-[2rem] p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
                Каталог
              </p>
              <h2 className="mt-2 text-2xl font-semibold">Товары и цены</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {filteredProducts.length} позиций
                {isRefreshing ? " · обновляем список..." : ""}
              </p>
            </div>

            <div className="flex flex-col gap-3 md:flex-row">
              <label className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Найти товар"
                  className="h-11 min-w-[220px] rounded-2xl bg-white pl-10 pr-4 outline-none ring-1 ring-[var(--line)]"
                />
              </label>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="h-11 rounded-2xl bg-white px-4 outline-none ring-1 ring-[var(--line)]"
              >
                <option value="all">Все категории</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {feedback && (
            <div
              className={cn(
                "rounded-[1.4rem] px-4 py-3 text-sm",
                feedback.type === "success"
                  ? "bg-emerald-50 text-emerald-900"
                  : "bg-rose-50 text-rose-900",
              )}
            >
              {feedback.message}
            </div>
          )}

          <div className="space-y-3">
            {filteredProducts.map((product) => (
              <article
                key={product.id}
                className={cn(
                  "rounded-[1.7rem] bg-white/90 p-4 ring-1 ring-[var(--line)] transition",
                  selectedProductId === product.id && "ring-[var(--accent)] shadow-[0_18px_36px_rgba(35,105,58,0.12)]",
                )}
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex gap-4">
                    <div className="relative h-18 w-18 overflow-hidden rounded-[1.25rem] bg-[var(--surface-muted)]">
                      {product.imageUrl ? (
                        <Image
                          src={product.imageUrl}
                          alt={product.name}
                          fill
                          className="object-cover"
                          sizes="72px"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-3xl">🍎</div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold">{product.name}</h3>
                        {selectedProductId === product.id && (
                          <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
                            Редактируется
                          </span>
                        )}
                        {!product.isActive && (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            Скрыт с витрины
                          </span>
                        )}
                      </div>

                      <p className="max-w-2xl text-sm leading-6 text-[var(--muted)]">
                        {product.description || "Описание пока не добавлено."}
                      </p>

                      <div className="flex flex-wrap gap-2 text-xs font-semibold">
                        <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-[var(--foreground)]">
                          {product.category.name}
                        </span>
                        <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-[var(--foreground)]">
                          {unitLabels[product.unit] ?? product.unit}
                        </span>
                        <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-[var(--foreground)]">
                          {stockStatusLabels[product.stockStatus] ?? product.stockStatus}
                        </span>
                        {product.isHit && (
                          <span className="rounded-full bg-orange-100 px-3 py-1 text-orange-900">
                            Хит
                          </span>
                        )}
                        {product.isNew && (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-900">
                            Новинка
                          </span>
                        )}
                        {product.isPromo && (
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">
                            Акция
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-3 xl:items-end">
                    <div className="text-left xl:text-right">
                      <p className="text-sm text-[var(--muted)]">Текущая цена</p>
                      <p className="mt-1 text-2xl font-semibold">
                        {formatCurrency(product.price)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="ghost"
                        className="gap-2"
                        onClick={() => beginEditing(product)}
                      >
                        <PencilLine size={16} />
                        Редактировать
                      </Button>
                      <Button
                        variant="danger"
                        className="gap-2"
                        onClick={() => deleteProduct(product)}
                        disabled={deletingProductId === product.id}
                      >
                        <Trash2 size={16} />
                        {deletingProductId === product.id ? "Удаляем..." : "Удалить"}
                      </Button>
                    </div>
                  </div>
                </div>
              </article>
            ))}

            {filteredProducts.length === 0 && (
              <div className="rounded-[1.7rem] bg-white/80 p-8 text-center text-[var(--muted)]">
                По текущим фильтрам товары не найдены.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
