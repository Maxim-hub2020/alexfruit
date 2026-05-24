"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";

type TimeSlot = {
  id: string;
  title: string;
  available?: boolean;
  reason?: string | null;
};

function getTomorrowDate(value: string) {
  const date = new Date(`${value}T00:00:00.000`);

  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function RescheduleOrderDelivery({
  orderId,
  addressId,
  currentDate,
  currentSlotTitle,
}: {
  orderId: string;
  addressId: string;
  currentDate: string;
  currentSlotTitle: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [date, setDate] = useState(() => getTomorrowDate(currentDate));
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotId, setSlotId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isOpen) {
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
  }, [addressId, date, isOpen]);

  async function submit() {
    setError("");
    setMessage("");

    if (!slotId) {
      setError("Выберите доступный временной интервал.");
      return;
    }

    const response = await fetch(`/api/orders/${orderId}/reschedule`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deliveryDate: date,
        deliveryTimeSlotId: slotId,
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      setError(result.error ?? "Не удалось перенести заказ");
      return;
    }

    setMessage("Дата доставки обновлена. Администратор подтвердит перенос.");
    startTransition(() => router.refresh());
  }

  return (
    <div className="mt-4 rounded-[1.5rem] bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-100">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-semibold">Нужно выбрать новую дату доставки</p>
          <p className="mt-1 text-amber-900">
            Сейчас стоит {currentDate} · {currentSlotTitle}. Выберите удобный день и
            свободный интервал.
          </p>
        </div>
        <Button
          variant="secondary"
          className="gap-2 bg-white text-amber-950 hover:bg-white/85"
          onClick={() => setIsOpen((current) => !current)}
        >
          <CalendarClock size={16} />
          {isOpen ? "Свернуть" : "Перенести дату"}
        </Button>
      </div>

      {isOpen && (
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="space-y-2 font-medium">
            <span>Новая дата</span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="h-11 w-full rounded-2xl bg-white px-4 outline-none ring-1 ring-amber-100"
            />
          </label>

          <label className="space-y-2 font-medium">
            <span>Интервал</span>
            <select
              value={slotId}
              onChange={(event) => setSlotId(event.target.value)}
              className="h-11 w-full rounded-2xl bg-white px-4 outline-none ring-1 ring-amber-100"
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
          </label>

          <Button onClick={submit} disabled={isPending || !slotId}>
            Сохранить
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
