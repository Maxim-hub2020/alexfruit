"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Clock3, MapPin, ShoppingBag } from "lucide-react";
import { useCart } from "@/components/providers/cart-provider";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

type TimeSlot = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  maxOrders: number;
  reserved?: number;
  available?: boolean;
  reason?: string | null;
  distanceLimitKm?: number;
};

export function CheckoutClient({
  user,
  addresses,
  initialSlots,
}: {
  user: { id: string; name: string } | null;
  addresses: Array<{
    id: string;
    title: string;
    city: string;
    street: string;
    house: string;
    latitude?: string | null;
    longitude?: string | null;
  }>;
  initialSlots: TimeSlot[];
}) {
  const router = useRouter();
  const { items, subtotal, clear, updateQuantity, removeItem, hydrated } = useCart();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState(initialSlots);
  const [addressId, setAddressId] = useState(addresses[0]?.id ?? "");
  const [slotId, setSlotId] = useState(
    initialSlots.find((slot) => slot.available !== false)?.id ?? "",
  );
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!addressId) {
      return;
    }

    startTransition(async () => {
      const response = await fetch(
        `/api/time-slots/available?date=${date}&addressId=${addressId}`,
      );
      const result = await response.json();
      setSlots(result);
      const firstAvailable = result.find((slot: TimeSlot) => slot.available !== false);
      setSlotId((current) =>
        result.some((slot: TimeSlot) => slot.id === current && slot.available !== false)
          ? current
          : (firstAvailable?.id ?? ""),
      );
    });
  }, [addressId, date]);

  const total = useMemo(() => subtotal + 250, [subtotal]);

  async function submitOrder() {
    setError("");
    setSuccess("");

    if (!user) {
      setError("Для оформления заказа нужно войти в систему.");
      return;
    }

    if (items.length === 0) {
      setError("Корзина пока пустая.");
      return;
    }

    if (!addressId) {
      setError("Сначала выберите или добавьте адрес доставки.");
      return;
    }

    if (!slotId) {
      setError("Выберите доступный временной интервал после адреса доставки.");
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
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.error ?? "Не удалось оформить заказ");
      return;
    }

    clear();
    setSuccess(`Заказ ${result.orderNumber ?? result.order?.orderNumber ?? ""} оформлен.`);
    router.push("/orders");
    router.refresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
      <section className="space-y-4">
        <div className="glass-panel rounded-[2rem] p-5">
          <div className="mb-4 flex items-center gap-3">
            <ShoppingBag size={20} />
            <h2 className="text-xl font-semibold">Содержимое корзины</h2>
          </div>

          {items.length === 0 ? (
            <div className="rounded-[1.5rem] bg-white/80 p-8 text-center text-[var(--muted)]">
              {hydrated
                ? "Добавьте товары из каталога, и они появятся здесь."
                : "Загружаем локальную корзину..."}
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-center justify-between gap-4 rounded-[1.5rem] bg-white/90 p-4"
                >
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm text-[var(--muted)]">
                      {formatCurrency(item.price)} за {item.unit}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 rounded-full bg-[var(--surface-muted)] px-2 py-1">
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        className="h-8 w-8 rounded-full bg-white"
                      >
                        -
                      </button>
                      <span className="min-w-6 text-center font-semibold">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        className="h-8 w-8 rounded-full bg-white"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(item.productId)}
                      className="text-sm text-[var(--danger)]"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <aside className="glass-panel h-fit rounded-[2rem] p-5">
        <div className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Оформление заказа</h2>
            <p className="text-sm text-[var(--muted)]">
              Сумма по весовым товарам предварительная. После сборки администратор
              уточнит итог.
            </p>
          </div>

          {!user && (
            <div className="rounded-[1.25rem] bg-amber-50 p-4 text-sm text-amber-900">
              Войдите как клиент, чтобы выбрать адрес, дату и завершить оформление.
            </div>
          )}

          <label className="space-y-2 text-sm font-medium">
            <span className="flex items-center gap-2">
              <MapPin size={16} />
              Адрес доставки
            </span>
            <select
              value={addressId}
              onChange={(event) => setAddressId(event.target.value)}
              className="h-12 w-full rounded-2xl bg-white px-4 outline-none ring-1 ring-[var(--line)]"
            >
              {addresses.map((address) => (
                <option key={address.id} value={address.id}>
                  {address.title}: {address.city}, {address.street}, {address.house}
                </option>
              ))}
            </select>
            {addresses.length === 0 && (
              <span className="block rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Добавьте адрес в профиле. Временные интервалы появятся только после
                выбора адреса доставки.
              </span>
            )}
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
              className="h-12 w-full rounded-2xl bg-white px-4 outline-none ring-1 ring-[var(--line)]"
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
              className="h-12 w-full rounded-2xl bg-white px-4 outline-none ring-1 ring-[var(--line)]"
            >
              {slots.map((slot) => (
                <option
                  key={slot.id}
                  value={slot.id}
                  disabled={slot.available === false}
                >
                  {slot.title}
                  {slot.available === false
                    ? ` — ${slot.reason ?? "недоступен"}`
                    : ""}
                </option>
              ))}
            </select>
            {!addressId && (
              <span className="block rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Сначала выберите адрес доставки. После этого система покажет только
                подходящие временные интервалы.
              </span>
            )}
            {addressId && slots.length > 0 && (
              <span className="block text-xs leading-relaxed text-[var(--muted)]">
                В одном интервале принимаем заказы в радиусе до 2 км, чтобы курьер
                успевал без гонок по всему городу.
              </span>
            )}
            {addressId && slots.length === 0 && (
              <span className="block rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-900">
                На выбранную дату нет доступных интервалов для этого адреса.
              </span>
            )}
          </label>

          <label className="space-y-2 text-sm font-medium">
            <span>Комментарий</span>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={4}
              className="w-full rounded-2xl bg-white px-4 py-3 outline-none ring-1 ring-[var(--line)]"
              placeholder="Например: не звонить в домофон, оставить у двери."
            />
          </label>

          <div className="rounded-[1.5rem] bg-white/90 p-4">
            <div className="flex items-center justify-between text-sm text-[var(--muted)]">
              <span>Товары</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm text-[var(--muted)]">
              <span>Доставка</span>
              <span>{formatCurrency(250)}</span>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-4 text-lg font-bold">
              <span>Итого</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          {error && (
            <div className="rounded-[1.25rem] bg-rose-50 p-4 text-sm text-rose-900">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-[1.25rem] bg-emerald-50 p-4 text-sm text-emerald-900">
              {success}
            </div>
          )}

          <Button
            className="w-full"
            onClick={() => submitOrder()}
            disabled={isPending || !addressId || !slotId || items.length === 0}
          >
            {isPending ? "Проверяем слот..." : "Оформить заказ"}
          </Button>
        </div>
      </aside>
    </div>
  );
}
