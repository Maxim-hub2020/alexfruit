"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  LIFT_SERVICE_FEE,
  getDefaultDeliveryDate,
  getDeliveryDateAvailability,
} from "@/lib/delivery-rules";
import { formatCurrency } from "@/lib/utils";

type AddressOption = {
  id: string;
  title: string;
  city: string;
  street: string;
  house: string;
};

type EditableOrderItem = {
  id: string;
  productId: string | null;
  productName: string;
  unit: string;
  quantity: number;
};

type CustomerOrderActionsProps = {
  order: {
    id: string;
    status: string;
    editableUntil: string;
    addressId: string;
    deliveryDate: string;
    deliveryTimeSlotId: string;
    needsLift: boolean;
    customerComment: string;
    items: EditableOrderItem[];
  };
  addresses: AddressOption[];
  canManage: boolean;
};

function getInitialItems(items: EditableOrderItem[]) {
  return items.map((item) => ({
    id: item.id,
    productId: item.productId,
    productName: item.productName,
    unit: item.unit,
    quantity: item.quantity,
  }));
}

export function CustomerOrderActions({
  order,
  addresses,
  canManage,
}: CustomerOrderActionsProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [addressId, setAddressId] = useState(order.addressId);
  const [deliveryDate, setDeliveryDate] = useState(order.deliveryDate);
  const [needsLift, setNeedsLift] = useState(order.needsLift);
  const [customerComment, setCustomerComment] = useState(order.customerComment);
  const [items, setItems] = useState(() => getInitialItems(order.items));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyAction, setBusyAction] = useState<"save" | "cancel" | "">("");
  const [isPending, startTransition] = useTransition();
  const minDeliveryDate = getDefaultDeliveryDate();
  const deliveryAvailability = getDeliveryDateAvailability(deliveryDate);
  const hasUneditableItems = items.some((item) => !item.productId);

  function isEditableNow() {
    const editableUntil = Date.parse(order.editableUntil);

    return (
      canManage &&
      (!Number.isFinite(editableUntil) || editableUntil > Date.now())
    );
  }

  function resetForm() {
    setAddressId(order.addressId);
    setDeliveryDate(order.deliveryDate);
    setNeedsLift(order.needsLift);
    setCustomerComment(order.customerComment);
    setItems(getInitialItems(order.items));
    setError("");
    setMessage("");
  }

  function updateQuantity(itemId: string, value: number) {
    setItems((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, quantity: Math.max(0.1, value) } : item,
      ),
    );
  }

  function removeItem(itemId: string) {
    setItems((current) => current.filter((item) => item.id !== itemId));
  }

  async function saveOrder() {
    setError("");
    setMessage("");

    if (!isEditableNow()) {
      setError("Редактирование уже недоступно: заказ собран или истекли 3 часа.");
      return;
    }

    if (!deliveryAvailability.available) {
      setError(deliveryAvailability.reason ?? "Выберите другую дату доставки.");
      return;
    }

    if (items.length === 0) {
      setError("В заказе должна остаться хотя бы одна позиция.");
      return;
    }

    if (hasUneditableItems) {
      setError("В заказе есть позиции, которые уже удалены из каталога. Такой заказ можно только отменить.");
      return;
    }

    setBusyAction("save");
    const response = await fetch(`/api/orders/${order.id}/edit`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        addressId,
        deliveryDate,
        needsLift,
        customerComment,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      }),
    });
    const result = await response.json();
    setBusyAction("");

    if (!response.ok) {
      setError(result.error ?? "Не удалось сохранить изменения.");
      return;
    }

    setMessage("Изменения сохранены.");
    setIsOpen(false);
    startTransition(() => router.refresh());
  }

  async function cancelOrder() {
    setError("");
    setMessage("");

    if (!isEditableNow()) {
      setError("Отмена уже недоступна: заказ собран или истекли 3 часа.");
      return;
    }

    if (!window.confirm("Отменить заказ? Он останется в истории со статусом «Отменён».")) {
      return;
    }

    setBusyAction("cancel");
    const response = await fetch(`/api/orders/${order.id}/cancel`, {
      method: "POST",
    });
    const result = await response.json();
    setBusyAction("");

    if (!response.ok) {
      setError(result.error ?? "Не удалось отменить заказ.");
      return;
    }

    setMessage("Заказ отменён.");
    startTransition(() => router.refresh());
  }

  if (!canManage) {
    return (
      <p className="mt-3 text-xs text-[var(--muted)]">
        Изменения доступны в течение 3 часов после оформления и только пока заказ не собран.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="secondary"
          className="gap-2"
          onClick={() => {
            resetForm();
            setIsOpen((current) => !current);
          }}
          disabled={Boolean(busyAction)}
        >
          <Pencil size={16} />
          {isOpen ? "Свернуть" : "Изменить"}
        </Button>
        <Button
          variant="danger"
          className="gap-2"
          onClick={cancelOrder}
          disabled={Boolean(busyAction) || isPending}
        >
          <Trash2 size={16} />
          {busyAction === "cancel" ? "Отменяем..." : "Отменить"}
        </Button>
      </div>

      {isOpen ? (
        <div className="space-y-4 rounded-[1.5rem] bg-white/80 p-4 ring-1 ring-[var(--line)]">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">
              <span>Адрес</span>
              <select
                value={addressId}
                onChange={(event) => setAddressId(event.target.value)}
                className="h-11 w-full rounded-2xl bg-white px-3 outline-none ring-1 ring-[var(--line)]"
              >
                {addresses.map((address) => (
                  <option key={address.id} value={address.id}>
                    {address.title}: {address.city}, {address.street}, {address.house}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium">
              <span>Дата</span>
              <input
                type="date"
                value={deliveryDate}
                min={minDeliveryDate}
                onChange={(event) => setDeliveryDate(event.target.value)}
                className="h-11 w-full rounded-2xl bg-white px-3 outline-none ring-1 ring-[var(--line)]"
              />
              {!deliveryAvailability.available ? (
                <span className="block rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {deliveryAvailability.reason}
                </span>
              ) : null}
            </label>
          </div>

          <div className="rounded-2xl bg-white/80 px-4 py-3 text-sm text-[var(--muted)] ring-1 ring-[var(--line)]">
            Доставка будет в течение дня. Точное время согласуем при сборке.
          </div>

          <label className="flex items-start gap-3 rounded-2xl bg-white/80 p-4 text-sm ring-1 ring-[var(--line)]">
            <input
              type="checkbox"
              checked={needsLift}
              onChange={(event) => setNeedsLift(event.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="flex items-center gap-2 font-semibold">
                <ArrowUp size={16} />
                Нужен подъём до двери
              </span>
              <span className="mt-1 block text-[var(--muted)]">
                {formatCurrency(LIFT_SERVICE_FEE)}
              </span>
            </span>
          </label>

          <div className="space-y-2">
            <p className="text-sm font-semibold">Состав заказа</p>
            {items.map((item) => (
              <div
                key={item.id}
                className="grid gap-2 rounded-2xl bg-[var(--surface-muted)] p-3 sm:grid-cols-[1fr_9rem_auto] sm:items-center"
              >
                <div>
                  <p className="font-medium">{item.productName}</p>
                  <p className="text-xs text-[var(--muted)]">{item.unit}</p>
                </div>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={item.quantity}
                  onChange={(event) =>
                    updateQuantity(item.id, Number(event.target.value))
                  }
                  className="h-10 rounded-2xl bg-white px-3 outline-none ring-1 ring-[var(--line)]"
                />
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="text-sm font-semibold text-[var(--danger)]"
                  disabled={items.length === 1}
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>

          <label className="block space-y-2 text-sm font-medium">
            <span>Комментарий</span>
            <textarea
              value={customerComment}
              onChange={(event) => setCustomerComment(event.target.value)}
              rows={3}
              className="w-full rounded-2xl bg-white px-3 py-2 outline-none ring-1 ring-[var(--line)]"
            />
          </label>

          <Button
            onClick={saveOrder}
            disabled={
              busyAction === "save" ||
              isPending ||
              !deliveryAvailability.available
            }
          >
            {busyAction === "save" ? "Сохраняем..." : "Сохранить изменения"}
          </Button>
        </div>
      ) : null}

      <p className="text-xs text-[var(--accent-strong)]">
        Изменения и отмена доступны 3 часа после оформления, пока заказ не собран.
      </p>
      {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}
      {message ? (
        <p className="text-sm font-semibold text-emerald-800">{message}</p>
      ) : null}
    </div>
  );
}
