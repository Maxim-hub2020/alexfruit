"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getDefaultDeliveryDate,
  getDeliveryDateAvailability,
} from "@/lib/delivery-rules";

function getTomorrowDate(value: string) {
  const date = new Date(`${value}T00:00:00.000`);

  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function RescheduleOrderDelivery({
  orderId,
  notificationId,
  unavailableProductName,
  currentDate,
  currentSlotTitle,
}: {
  orderId: string;
  notificationId: string;
  unavailableProductName: string;
  currentDate: string;
  currentSlotTitle: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const minDeliveryDate = getDefaultDeliveryDate();
  const [date, setDate] = useState(() => {
    const tomorrow = getTomorrowDate(currentDate);

    return tomorrow > minDeliveryDate ? tomorrow : minDeliveryDate;
  });
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const deliveryAvailability = getDeliveryDateAvailability(date);

  async function submit() {
    setError("");
    setMessage("");
    setBusyAction("reschedule");

    if (!deliveryAvailability.available) {
      setError(deliveryAvailability.reason ?? "Выберите другую дату доставки.");
      setBusyAction("");
      return;
    }

    const response = await fetch(`/api/orders/${orderId}/reschedule`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deliveryDate: date,
      }),
    });
    const result = await response.json();
    setBusyAction("");

    if (!response.ok) {
      setError(result.error ?? "Не удалось перенести заказ");
      return;
    }

    setMessage("Дата доставки обновлена. Администратор подтвердит перенос.");
    startTransition(() => router.refresh());
  }

  async function removeUnavailableItem() {
    setError("");
    setMessage("");
    setBusyAction("remove");

    const response = await fetch(`/api/orders/${orderId}/replacement/remove-item`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId }),
    });
    const result = await response.json();
    setBusyAction("");

    if (!response.ok) {
      setError(result.error ?? "Не удалось убрать позицию из заказа");
      return;
    }

    setMessage(
      result.orderCancelled
        ? `Позиция «${result.productName}» была единственной, заказ отменён.`
        : `Позиция «${result.productName}» удалена из заказа, сумма пересчитана.`,
    );
    startTransition(() => router.refresh());
  }

  return (
    <div className="mt-4 rounded-[1.5rem] bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-100">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-semibold">Сейчас нет: {unavailableProductName}</p>
          <p className="mt-1 text-amber-900">
            Можно убрать эту позицию из заказа или перенести доставку на другую дату.
            Сейчас стоит {currentDate} · {currentSlotTitle}.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="ghost"
            className="gap-2 bg-white text-rose-700 ring-1 ring-rose-100 hover:bg-rose-50"
            onClick={removeUnavailableItem}
            disabled={Boolean(busyAction) || isPending}
          >
            <Trash2 size={16} />
            {busyAction === "remove" ? "Убираем..." : "Убрать позицию"}
          </Button>
          <Button
            variant="secondary"
            className="gap-2 bg-white text-amber-950 hover:bg-white/85"
            onClick={() => setIsOpen((current) => !current)}
            disabled={busyAction === "remove"}
          >
            <CalendarClock size={16} />
            {isOpen ? "Свернуть" : "Перенести дату"}
          </Button>
        </div>
      </div>

      {isOpen && (
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <label className="space-y-2 font-medium">
            <span>Новая дата</span>
            <input
              type="date"
              value={date}
              min={minDeliveryDate}
              onChange={(event) => setDate(event.target.value)}
              className="h-11 w-full rounded-2xl bg-white px-4 outline-none ring-1 ring-amber-100"
            />
            {!deliveryAvailability.available ? (
              <span className="block rounded-2xl bg-white px-3 py-2 text-xs text-amber-900">
                {deliveryAvailability.reason}
              </span>
            ) : null}
          </label>

          <Button
            onClick={submit}
            disabled={isPending || !deliveryAvailability.available || Boolean(busyAction)}
          >
            {busyAction === "reschedule" ? "Сохраняем..." : "Сохранить"}
          </Button>
        </div>
      )}

      {error && <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p>}
      {message && (
        <p className="mt-3 text-sm font-semibold text-emerald-800">{message}</p>
      )}
    </div>
  );
}
