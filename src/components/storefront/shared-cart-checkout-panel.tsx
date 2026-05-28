"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Clock3, MapPin, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

type TimeSlot = {
  id: string;
  title: string;
  available?: boolean;
  reason?: string | null;
};

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
  initialSlots: TimeSlot[];
};

const DELIVERY_FEE = 250;

export function SharedCartCheckoutPanel({
  token,
  subtotal,
  itemsCount,
  isOwner,
  isOrdered,
  addresses,
  initialSlots,
}: SharedCartCheckoutPanelProps) {
  const router = useRouter();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState(initialSlots);
  const [addressId, setAddressId] = useState(addresses[0]?.id ?? "");
  const [slotId, setSlotId] = useState(
    initialSlots.find((slot) => slot.available !== false)?.id ?? "",
  );
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const total = useMemo(() => subtotal + DELIVERY_FEE, [subtotal]);

  useEffect(() => {
    if (!addressId || isOrdered) {
      return;
    }

    startTransition(async () => {
      const response = await fetch(
        `/api/time-slots/available?date=${date}&addressId=${addressId}`,
      );
      const result: TimeSlot[] = await response.json();
      const firstAvailable = result.find((slot) => slot.available !== false);

      setSlots(result);
      setSlotId((current) =>
        result.some((slot) => slot.id === current && slot.available !== false)
          ? current
          : (firstAvailable?.id ?? ""),
      );
    });
  }, [addressId, date, isOrdered]);

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

    if (!slotId) {
      setError("Выберите доступный временной интервал.");
      return;
    }

    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        addressId,
        deliveryDate: date,
        deliveryTimeSlotId: slotId,
        customerComment: comment,
        sharedCartToken: token,
      }),
    });
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
          onChange={(event) => setDate(event.target.value)}
          className="h-11 w-full rounded-2xl bg-white px-4 outline-none ring-1 ring-[var(--line)]"
        />
      </label>

      <label className="space-y-2 text-sm font-medium">
        <span className="flex items-center gap-2">
          <Clock3 size={16} />
          Временной интервал
        </span>
        <select
          value={slotId}
          onChange={(event) => setSlotId(event.target.value)}
          disabled={!addressId || slots.length === 0}
          className="h-11 w-full rounded-2xl bg-white px-4 outline-none ring-1 ring-[var(--line)]"
        >
          {slots.map((slot) => (
            <option key={slot.id} value={slot.id} disabled={slot.available === false}>
              {slot.title}
              {slot.available === false ? ` — ${slot.reason ?? "недоступен"}` : ""}
            </option>
          ))}
        </select>
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
          <span>Доставка</span>
          <span>{formatCurrency(DELIVERY_FEE)}</span>
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
        disabled={isPending || !addressId || !slotId || itemsCount === 0}
      >
        {isPending ? "Проверяем слот..." : "Оформить общий заказ"}
      </Button>
    </div>
  );
}
