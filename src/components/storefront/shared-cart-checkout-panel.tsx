"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Calendar, MapPin, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  LIFT_SERVICE_FEE,
  getDefaultDeliveryDate,
  getDeliveryDateAvailability,
} from "@/lib/delivery-rules";
import { formatCurrency } from "@/lib/utils";

type SharedCartCheckoutPanelProps = {
  token: string;
  subtotal: number;
  itemsCount: number;
  isOwner: boolean;
  isOrdered: boolean;
  addresses: Array<{
    id: string;
    title: string;
    city: string;
    street: string;
    house: string;
  }>;
  initialSlots?: unknown[];
};

export function SharedCartCheckoutPanel({
  token,
  subtotal,
  itemsCount,
  isOwner,
  isOrdered,
  addresses,
}: SharedCartCheckoutPanelProps) {
  const router = useRouter();
  const minDeliveryDate = getDefaultDeliveryDate();
  const [date, setDate] = useState(() => minDeliveryDate);
  const [addressId, setAddressId] = useState(addresses[0]?.id ?? "");
  const [needsLift, setNeedsLift] = useState(false);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const deliveryAvailability = getDeliveryDateAvailability(date);
  const liftFee = needsLift ? LIFT_SERVICE_FEE : 0;
  const total = useMemo(() => subtotal + liftFee, [liftFee, subtotal]);

  async function submitSharedOrder() {
    setError("");

    if (!isOwner) {
      setError("Оформить общую корзину может только организатор.");
      return;
    }

    if (itemsCount === 0) {
      setError("Общая корзина пока пустая.");
      return;
    }

    if (!addressId) {
      setError("Выберите адрес доставки.");
      return;
    }

    if (!deliveryAvailability.available) {
      setError(deliveryAvailability.reason ?? "Выберите другую дату доставки.");
      return;
    }

    setIsSubmitting(true);
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        addressId,
        deliveryDate: date,
        needsLift,
        customerComment: comment,
        sharedCartToken: token,
      }),
    });
    setIsSubmitting(false);
    const result = await response.json();

    if (!response.ok) {
      setError(result.error ?? "Не удалось оформить общий заказ.");
      return;
    }

    router.push("/orders");
    router.refresh();
  }

  if (isOrdered) {
    return (
      <div className="rounded-[1.5rem] bg-emerald-50 p-4 text-sm text-emerald-950 ring-1 ring-emerald-100">
        Эта общая корзина уже оформлена. Новые позиции больше не добавляются, чтобы
        заказ у администратора не расходился с составом корзины.
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="rounded-[1.5rem] bg-white/82 p-4 text-sm text-[var(--muted)] ring-1 ring-[var(--line)]">
        Вы можете добавить свои товары в общий список. Дату, адрес и оформление
        заказа выбирает организатор корзины.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-[1.7rem] bg-white/86 p-4 ring-1 ring-[var(--line)]">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-[var(--accent-strong)]">
          <ShoppingBag size={16} />
          Оформление общей корзины
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Это отдельный заказ. Личная корзина клиента не смешивается с общей.
        </p>
      </div>

      <label className="space-y-2 text-sm font-medium">
        <span className="flex items-center gap-2">
          <MapPin size={16} />
          Адрес доставки
        </span>
        <select
          value={addressId}
          onChange={(event) => setAddressId(event.target.value)}
          className="h-11 w-full rounded-2xl bg-white px-4 outline-none ring-1 ring-[var(--line)]"
        >
          {addresses.map((address) => (
            <option key={address.id} value={address.id}>
              {address.title}: {address.city}, {address.street}, {address.house}
            </option>
          ))}
        </select>
        {addresses.length === 0 ? (
          <span className="block rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Сначала добавьте адрес в профиле.
          </span>
        ) : null}
      </label>

      <label className="space-y-2 text-sm font-medium">
        <span className="flex items-center gap-2">
          <Calendar size={16} />
          Дата доставки
        </span>
        <input
          type="date"
          value={date}
          min={minDeliveryDate}
          onChange={(event) => setDate(event.target.value)}
          className="h-11 w-full rounded-2xl bg-white px-4 outline-none ring-1 ring-[var(--line)]"
        />
        {!deliveryAvailability.available ? (
          <span className="block rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {deliveryAvailability.reason}
          </span>
        ) : null}
      </label>

      <div className="rounded-2xl bg-white/75 px-4 py-3 text-sm text-[var(--muted)] ring-1 ring-[var(--line)]">
        Доставим в течение дня. Точное время согласуем при сборке.
      </div>

      <label className="flex items-start gap-3 rounded-2xl bg-white p-4 text-sm ring-1 ring-[var(--line)]">
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
            Добавим {formatCurrency(LIFT_SERVICE_FEE)} к заказу.
          </span>
        </span>
      </label>

      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        rows={3}
        placeholder="Комментарий к общему заказу"
        className="w-full rounded-2xl bg-white px-4 py-3 text-sm outline-none ring-1 ring-[var(--line)]"
      />

      <div className="rounded-[1.5rem] bg-[var(--surface-muted)] p-4 text-sm">
        <div className="flex items-center justify-between text-[var(--muted)]">
          <span>Товары</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-[var(--muted)]">
          <span>Подъём</span>
          <span>{needsLift ? formatCurrency(LIFT_SERVICE_FEE) : "не нужен"}</span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-[var(--line)] pt-3 text-base font-bold">
          <span>Итого</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}

      <Button
        className="w-full"
        onClick={submitSharedOrder}
        disabled={
          isSubmitting ||
          !addressId ||
          !deliveryAvailability.available ||
          itemsCount === 0
        }
      >
        {isSubmitting ? "Оформляем..." : "Оформить общий заказ"}
      </Button>
    </div>
  );
}
