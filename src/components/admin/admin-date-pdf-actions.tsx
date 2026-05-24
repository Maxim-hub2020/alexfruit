"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useTransition } from "react";
import { CalendarDays, FileText, PackageCheck, Truck } from "lucide-react";

type AdminDatePdfActionsProps = {
  basePath: string;
  selectedDate: string;
  ordersCount: number;
  eyebrow: string;
  title: string;
  description: string;
  labelsUrl?: string;
  assemblyUrl?: string;
  deliveryUrl?: string;
  emptyText?: string;
  requireDate?: boolean;
};

function PdfActionLink({
  href,
  enabled,
  children,
  variant = "accent",
}: {
  href?: string;
  enabled: boolean;
  children: ReactNode;
  variant?: "accent" | "light";
}) {
  if (!enabled || !href) {
    return (
      <span className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white/70 px-5 text-sm font-semibold text-[var(--muted)] ring-1 ring-[var(--line)]">
        {children}
      </span>
    );
  }

  const className =
    variant === "accent"
      ? "inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-white"
      : "inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-semibold text-[var(--accent-strong)] ring-1 ring-[var(--line)]";

  return (
    <Link href={href} target="_blank" rel="noreferrer" className={className}>
      {children}
    </Link>
  );
}

export function AdminDatePdfActions({
  basePath,
  selectedDate,
  ordersCount,
  eyebrow,
  title,
  description,
  labelsUrl,
  assemblyUrl,
  deliveryUrl,
  emptyText = "Нет заказов на выбранную дату",
  requireDate = true,
}: AdminDatePdfActionsProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const hasDate = Boolean(selectedDate);
  const canGenerate = ordersCount > 0 && (!requireDate || hasDate);

  function changeDate(nextDate: string) {
    const nextUrl = nextDate
      ? `${basePath}?date=${encodeURIComponent(nextDate)}`
      : basePath;

    startTransition(() => {
      router.push(nextUrl);
    });
  }

  return (
    <div className="glass-panel rounded-[2rem] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-[var(--muted)]">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-semibold">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
            {description}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
          <label className="relative">
            <CalendarDays
              size={16}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            />
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => changeDate(event.target.value)}
              className="h-12 rounded-2xl bg-white pl-10 pr-4 outline-none ring-1 ring-[var(--line)]"
            />
          </label>

          <PdfActionLink href={labelsUrl} enabled={canGenerate} variant="accent">
            <FileText size={16} />
            Этикетки 40×50
          </PdfActionLink>

          <PdfActionLink href={assemblyUrl} enabled={canGenerate} variant="light">
            <PackageCheck size={16} />
            PDF для сборщика
          </PdfActionLink>

          <PdfActionLink href={deliveryUrl} enabled={canGenerate} variant="light">
            <Truck size={16} />
            PDF для доставщика
          </PdfActionLink>

          {!canGenerate && (
            <span className="text-xs leading-relaxed text-[var(--muted)] sm:basis-full lg:text-right">
              {hasDate ? emptyText : "Сначала выберите дату доставки."}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
