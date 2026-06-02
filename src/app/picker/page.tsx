import Link from "next/link";
import { addDays, format } from "date-fns";
import { Role } from "@/generated/prisma";
import { PickerAssemblyDashboard } from "@/components/picker/picker-assembly-dashboard";
import { MainShell } from "@/components/layout/main-shell";
import { requirePageUser } from "@/lib/auth";
import { getPickerAssemblyOrders } from "@/lib/orders";
import { toClientValue } from "@/lib/serialize";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function getDateOrToday(value?: string | string[]) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return format(new Date(), "yyyy-MM-dd");
}

export default async function PickerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePageUser([Role.PICKER]);
  const params = await searchParams;
  const selectedDate = getDateOrToday(params.date);
  const today = format(new Date(), "yyyy-MM-dd");
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const orders = await getPickerAssemblyOrders({ date: selectedDate });
  const dateTabs = [
    { label: "Сегодня", date: today },
    { label: "Завтра", date: tomorrow },
  ];

  return (
    <MainShell active="picker-assembly" user={user}>
      <section className="section-shell space-y-6 py-8">
        <div className="glass-panel rounded-[2.2rem] p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
            Кабинет сборщика
          </p>
          <h1 className="mt-3 font-serif text-5xl font-semibold">Сборка заказов</h1>
          <p className="mt-3 max-w-2xl text-lg text-[var(--muted)]">
            Сверяйте наличие, фиксируйте фактический вес и печатайте этикетки для
            каждого клиента перед передачей заказа в доставку.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {dateTabs.map((tab) => (
              <Link
                key={tab.date}
                href={`/picker?date=${tab.date}`}
                className={cn(
                  "inline-flex h-11 items-center rounded-2xl px-4 text-sm font-semibold ring-1 transition",
                  selectedDate === tab.date
                    ? "bg-[var(--accent)] text-white ring-[var(--accent)]"
                    : "bg-white text-[var(--foreground)] ring-[var(--line)]",
                )}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>

        <PickerAssemblyDashboard
          date={selectedDate}
          orders={toClientValue(orders as never)}
        />
      </section>
    </MainShell>
  );
}
