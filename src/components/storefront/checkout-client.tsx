"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Calendar, MapPin, ShoppingBag } from "lucide-react";
import { useCart } from "@/components/providers/cart-provider";
import { Button } from "@/components/ui/button";
import {
  LIFT_SERVICE_FEE,
  getDefaultDeliveryDate,
  getDeliveryDateAvailability,
} from "@/lib/delivery-rules";
import { formatCurrency } from "@/lib/utils";

export function CheckoutClient({
  user,
  addresses,
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
}) {
  const router = useRouter();
  const { items, subtotal, clear, updateQuantity, removeItem, hydrated } = useCart();
  const minDeliveryDate = getDefaultDeliveryDate();
  const [date, setDate] = useState(() => minDeliveryDate);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [addressId, setAddressId] = useState(addresses[0]?.id ?? "");
  const [needsLift, setNeedsLift] = useState(false);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const deliveryAvailability = getDeliveryDateAvailability(date);
  const liftFee = needsLift ? LIFT_SERVICE_FEE : 0;
  const total = useMemo(() => subtotal + liftFee, [liftFee, subtotal]);

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
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      }),
    });
    setIsSubmitting(false);

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
        {!isCheckoutOpen ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Итого в корзине</h2>
              <p className="text-sm text-[var(--muted)]">
                Данные доставки заполним на следующем шаге, когда вы перейдёте к
                оформлению.
              </p>
            </div>

            <div className="rounded-[1.5rem] bg-white/90 p-4">
              <div className="flex items-center justify-between text-sm text-[var(--muted)]">
                <span>Позиций</span>
                <span>{items.length}</span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-[var(--line)] pt-4 text-lg font-bold">
                <span>Товары</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => setIsCheckoutOpen(true)}
              disabled={items.length === 0}
            >
              Перейти к оформлению
            </Button>
          </div>
        ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Оформление заказа</h2>
            <p className="text-sm text-[var(--muted)]">
              Сумма по весовым товарам предварительная. Доставим в течение дня,
              после сборки администратор уточнит итог.
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
              min={minDeliveryDate}
              onChange={(event) => setDate(event.target.value)}
              className="h-12 w-full rounded-2xl bg-white px-4 outline-none ring-1 ring-[var(--line)]"
            />
            {!deliveryAvailability.available ? (
              <span className="block rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {deliveryAvailability.reason}
              </span>
            ) : null}
          </label>

          <div className="rounded-2xl bg-white/75 px-4 py-3 text-sm text-[var(--muted)] ring-1 ring-[var(--line)]">
            Точное время согласуем при сборке. Заказ приедет в течение дня.
          </div>

          <label className="flex items-start gap-3 rounded-2xl bg-white/85 p-4 text-sm ring-1 ring-[var(--line)]">
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
              <span>Подъём</span>
              <span>{needsLift ? formatCurrency(LIFT_SERVICE_FEE) : "не нужен"}</span>
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
            disabled={
              isSubmitting ||
              !addressId ||
              !deliveryAvailability.available ||
              items.length === 0
            }
          >
            {isSubmitting ? "Оформляем..." : "Оформить заказ"}
          </Button>
        </div>
        )}
      </aside>
    </div>
  );
}
