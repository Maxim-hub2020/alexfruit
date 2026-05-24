import { format } from "date-fns";
import Link from "next/link";
import { CalendarDays, Clock, History, MapPin, PackageCheck, Search, UserRound } from "lucide-react";
import { PhoneCallLink } from "@/components/ui/phone-call-link";
import { formatCurrency, formatDateLabel, formatDateTimeLabel, getAddressLabel } from "@/lib/utils";

type MoneyValue = number | string | { toString(): string };

type CourierHistoryTask = {
  id: string;
  deliveredAt?: Date | string | null;
  order: {
    orderNumber: string;
    updatedAt: Date | string;
    preliminaryTotal: MoneyValue;
    finalTotal?: MoneyValue | null;
    user: {
      name: string;
      phone?: string | null;
      email?: string | null;
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

function getTaskDate(task: CourierHistoryTask) {
  return new Date(task.deliveredAt ?? task.order.updatedAt);
}

function groupTasksByDay(tasks: CourierHistoryTask[]) {
  return tasks.reduce<Map<string, CourierHistoryTask[]>>((groups, task) => {
    const dateKey = format(getTaskDate(task), "yyyy-MM-dd");
    const group = groups.get(dateKey) ?? [];

    group.push(task);
    groups.set(dateKey, group);

    return groups;
  }, new Map());
}

export function CourierHistory({
  tasks,
  query,
  tab = "history",
  queryParamName = "history",
  eyebrow = "Доставленные заказы",
  title = "История заказов",
  description = "Здесь сохраняются все завершённые доставки. Можно найти адрес, клиента, телефон или номер заказа и быстро проверить детали выполненного заказа.",
}: {
  tasks: CourierHistoryTask[];
  query: string;
  tab?: string;
  queryParamName?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
}) {
  const groupedTasks = Array.from(groupTasksByDay(tasks).entries());

  return (
    <section className="glass-panel rounded-[2.2rem] p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
            <History size={22} />
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
              {eyebrow}
            </p>
            <h2 className="mt-1 text-2xl font-semibold">{title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              {description}
            </p>
          </div>
        </div>

        <form action="/courier" className="flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="tab" value={tab} />
          <label className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            />
            <input
              name={queryParamName}
              defaultValue={query}
              placeholder="Адрес, клиент, заказ"
              className="h-12 w-full min-w-[260px] rounded-2xl bg-white pl-10 pr-4 outline-none ring-1 ring-[var(--line)] sm:w-[320px]"
            />
          </label>
          <button className="h-12 rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-white">
            Найти
          </button>
          {query && (
            <Link
              href={`/courier?tab=${tab}`}
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-white px-5 text-sm font-semibold text-[var(--foreground)] ring-1 ring-[var(--line)]"
            >
              Сбросить
            </Link>
          )}
        </form>
      </div>

      <div className="mt-5 space-y-5">
        {groupedTasks.map(([dateKey, dayTasks]) => (
          <div key={dateKey} className="rounded-[1.7rem] bg-white/80 p-4 ring-1 ring-[var(--line)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CalendarDays size={17} className="text-[var(--accent-strong)]" />
                <h3 className="font-semibold">
                  {formatDateLabel(new Date(`${dateKey}T12:00:00.000Z`))}
                </h3>
              </div>
              <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">
                {dayTasks.length} доставок
              </span>
            </div>

            <div className="mt-4 grid gap-3">
              {dayTasks.map((task) => (
                <article key={task.id} className="rounded-[1.35rem] bg-white p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
                          {task.order.user.name}
                          {task.order.user.phone ? ` · ${task.order.user.phone}` : ""}
                        </span>
                      </p>
                      <PhoneCallLink phone={task.order.user.phone} showPhone={false} />
                    </div>

                    <div className="rounded-[1.2rem] bg-[var(--surface-muted)] px-4 py-3 text-sm lg:min-w-[220px]">
                      <p className="flex items-center gap-2 text-[var(--muted)]">
                        <Clock size={15} />
                        {formatDateTimeLabel(getTaskDate(task))}
                      </p>
                      <p className="mt-2 text-[var(--muted)]">
                        Окно: {task.order.deliveryTimeSlot.title}
                      </p>
                      <p className="mt-2 font-semibold">
                        {formatCurrency(task.order.finalTotal ?? task.order.preliminaryTotal)}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}

        {tasks.length === 0 && (
          <div className="rounded-[1.7rem] bg-white/80 p-8 text-center text-[var(--muted)]">
            {query
              ? "По этому запросу в истории доставок ничего не найдено."
              : "История пока пустая: после первой доставки заказ появится здесь автоматически."}
          </div>
        )}
      </div>
    </section>
  );
}
