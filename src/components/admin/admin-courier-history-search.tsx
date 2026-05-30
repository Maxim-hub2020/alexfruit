import Link from "next/link";
import {
  CalendarDays,
  Clock,
  FileText,
  MapPin,
  PackageCheck,
  Search,
  Truck,
  UserRound,
} from "lucide-react";
import { PhoneCallLink } from "@/components/ui/phone-call-link";
import { formatCurrency, formatDateTimeLabel, getAddressLabel } from "@/lib/utils";

type MoneyValue = number | string | { toString(): string };

type CourierOption = {
  id: string;
  name: string;
  phone?: string | null;
};

type CourierHistoryTask = {
  id: string;
  deliveredAt?: Date | string | null;
  courier: {
    id: string;
    name: string;
    phone?: string | null;
    courierProfile?: {
      name: string;
      phone?: string | null;
      isActive: boolean;
    } | null;
  };
  order: {
    orderNumber: string;
    updatedAt: Date | string;
    preliminaryTotal: MoneyValue;
    finalTotal?: MoneyValue | null;
    user: {
      name: string;
      phone?: string | null;
    };
    address: {
      city: string;
      street: string;
      house: string;
      apartment?: string | null;
    };
    deliveryTimeSlot: {
      title: string;
    };
  };
};

type HistoryFilters = {
  address: string;
  date: string;
  courierId: string;
};

function getCourierName(task: CourierHistoryTask) {
  return task.courier.courierProfile?.name || task.courier.name;
}

function getCourierPhone(task: CourierHistoryTask) {
  return task.courier.courierProfile?.phone || task.courier.phone;
}

function getDeliveredAt(task: CourierHistoryTask) {
  return new Date(task.deliveredAt ?? task.order.updatedAt);
}

function hasActiveFilters(filters: HistoryFilters) {
  return Boolean(filters.address || filters.date || filters.courierId);
}

export function AdminCourierHistorySearch({
  couriers,
  history,
  filters,
}: {
  couriers: CourierOption[];
  history: CourierHistoryTask[];
  filters: HistoryFilters;
}) {
  const isFiltered = hasActiveFilters(filters);
  const routePdfUrl =
    filters.date && filters.courierId
      ? `/api/admin/orders/courier-route-pdf?date=${encodeURIComponent(
          filters.date,
        )}&courierId=${encodeURIComponent(filters.courierId)}`
      : "";

  return (
    <section className="glass-panel rounded-[2.2rem] p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
            <Truck size={22} />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
              Контроль маршрутов
            </p>
            <h2 className="mt-1 text-2xl font-semibold">Поиск по истории доставок</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Введите адрес, дату или курьера, чтобы увидеть, кто и во сколько был на точке.
              Полезно для проверки спорных доставок и повторных обращений клиентов.
            </p>
          </div>
        </div>
      </div>

      <form className="mt-5 grid gap-3 lg:grid-cols-[1.4fr_0.8fr_0.9fr_auto_auto_auto]">
        <label className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]"
          />
          <input
            name="address"
            defaultValue={filters.address}
            placeholder="Адрес, клиент, телефон или заказ"
            className="h-12 w-full rounded-2xl bg-white pl-10 pr-4 outline-none ring-1 ring-[var(--line)]"
          />
        </label>

        <label className="relative">
          <CalendarDays
            size={16}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]"
          />
          <input
            type="date"
            name="date"
            defaultValue={filters.date}
            className="h-12 w-full rounded-2xl bg-white pl-10 pr-4 outline-none ring-1 ring-[var(--line)]"
          />
        </label>

        <select
          name="courierId"
          defaultValue={filters.courierId}
          className="h-12 rounded-2xl bg-white px-4 outline-none ring-1 ring-[var(--line)]"
        >
          <option value="">Все курьеры</option>
          {couriers.map((courier) => (
            <option key={courier.id} value={courier.id}>
              {courier.name}
            </option>
          ))}
        </select>

        <button className="h-12 rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-white">
          Найти
        </button>

        {isFiltered && (
          <Link
            href="/admin/couriers"
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-white px-5 text-sm font-semibold text-[var(--foreground)] ring-1 ring-[var(--line)]"
          >
            Сбросить
          </Link>
        )}

        {routePdfUrl ? (
          <Link
            href={routePdfUrl}
            target="_blank"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-semibold text-[var(--foreground)] ring-1 ring-[var(--line)]"
          >
            <FileText size={16} />
            PDF маршрута
          </Link>
        ) : (
          <span className="inline-flex h-12 items-center justify-center rounded-2xl bg-white/60 px-5 text-sm font-semibold text-[var(--muted)] ring-1 ring-[var(--line)]">
            PDF после выбора даты и курьера
          </span>
        )}
      </form>

      <div className="mt-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--muted)]">
          <span>
            {isFiltered
              ? `Найдено записей: ${history.length}`
              : `Последние доставленные маршруты: ${history.length}`}
          </span>
          <span>Показываем до 80 записей</span>
        </div>

        {history.map((task) => (
          <article key={task.id} className="rounded-[1.7rem] bg-white/90 p-4 ring-1 ring-[var(--line)]">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">
                    <PackageCheck size={13} />
                    Доставлено
                  </span>
                  <span className="text-sm font-semibold text-[var(--muted)]">
                    {task.order.orderNumber}
                  </span>
                </div>

                <p className="flex gap-2 text-sm text-[var(--muted)]">
                  <MapPin size={15} className="mt-0.5 shrink-0" />
                  <span>{getAddressLabel(task.order.address)}</span>
                </p>
                <p className="flex gap-2 text-sm text-[var(--muted)]">
                  <UserRound size={15} className="mt-0.5 shrink-0" />
                  <span>
                    Клиент: {task.order.user.name}
                    {task.order.user.phone ? ` · ${task.order.user.phone}` : ""}
                  </span>
                </p>
                <PhoneCallLink phone={task.order.user.phone} showPhone={false} />
                <p className="flex gap-2 text-sm text-[var(--muted)]">
                  <Truck size={15} className="mt-0.5 shrink-0" />
                  <span>
                    Курьер: {getCourierName(task)}
                    {getCourierPhone(task) ? ` · ${getCourierPhone(task)}` : ""}
                  </span>
                </p>
              </div>

              <div className="rounded-[1.2rem] bg-[var(--surface-muted)] px-4 py-3 text-sm xl:min-w-[250px]">
                <p className="flex items-center gap-2 text-[var(--muted)]">
                  <Clock size={15} />
                  Был на адресе: {formatDateTimeLabel(getDeliveredAt(task))}
                </p>
                <p className="mt-2 text-[var(--muted)]">
                  Окно заказа: {task.order.deliveryTimeSlot.title}
                </p>
                <p className="mt-2 font-semibold">
                  {formatCurrency(task.order.finalTotal ?? task.order.preliminaryTotal)}
                </p>
              </div>
            </div>
          </article>
        ))}

        {history.length === 0 && (
          <div className="rounded-[1.7rem] bg-white/80 p-8 text-center text-[var(--muted)]">
            Записей по этим условиям не найдено. Попробуйте часть улицы, номер дома,
            телефон клиента или другой день.
          </div>
        )}
      </div>
    </section>
  );
}
