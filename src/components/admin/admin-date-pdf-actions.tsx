"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  PackageCheck,
  ShoppingBasket,
  Truck,
} from "lucide-react";
import { PdfDownloadButton } from "@/components/ui/pdf-download-button";
import { cn } from "@/lib/utils";

type AdminDatePdfActionsProps = {
  basePath: string;
  selectedDate: string;
  ordersCount: number;
  labelsCount?: number;
  eyebrow: string;
  title: string;
  description: string;
  labelsUrl?: string;
  assemblyUrl?: string;
  deliveryUrl?: string;
  procurementUrl?: string;
  emptyText?: string;
  labelsEmptyText?: string;
  requireDate?: boolean;
  allowEmptyDate?: boolean;
  markedDates?: string[];
};

const WEEK_DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);

  if (!year || !month || !day) {
    return new Date();
  }

  return new Date(year, month - 1, day);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMonthCells(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const daysCount = new Date(year, month + 1, 0).getDate();
  const firstWeekDay = new Date(year, month, 1).getDay();
  const leadingEmptyCells = (firstWeekDay + 6) % 7;
  const cells: Array<Date | null> = Array.from({ length: leadingEmptyCells }, () => null);

  for (let day = 1; day <= daysCount; day += 1) {
    cells.push(new Date(year, month, day));
  }

  return cells;
}

function formatCalendarDate(dateKey: string) {
  return parseDateKey(dateKey).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function PdfActionLink({
  href,
  enabled,
  children,
  variant = "accent",
  download = false,
  downloadFilename = "alexfruit-labels.pdf",
}: {
  href?: string;
  enabled: boolean;
  children: ReactNode;
  variant?: "accent" | "light";
  download?: boolean;
  downloadFilename?: string;
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

  if (download) {
    return (
      <PdfDownloadButton href={href} filename={downloadFilename} className={className}>
        {children}
      </PdfDownloadButton>
    );
  }

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
  labelsCount,
  eyebrow,
  title,
  description,
  labelsUrl,
  assemblyUrl,
  deliveryUrl,
  procurementUrl,
  emptyText = "Нет заказов на выбранную дату",
  labelsEmptyText = "Этикетки доступны только для подтверждённых заказов.",
  requireDate = true,
  allowEmptyDate = false,
  markedDates = [],
}: AdminDatePdfActionsProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    selectedDate ? parseDateKey(selectedDate) : new Date(),
  );
  const hasDate = Boolean(selectedDate);
  const markedDateSet = new Set(markedDates);
  const canGenerate = ordersCount > 0 && (!requireDate || hasDate);
  const printableLabelsCount = labelsCount ?? ordersCount;
  const canGenerateLabels = printableLabelsCount > 0 && (!requireDate || hasDate);
  const hasLabelsAction = labelsUrl !== undefined;
  const hasAssemblyAction = assemblyUrl !== undefined;
  const hasDeliveryAction = deliveryUrl !== undefined;
  const hasProcurementAction = procurementUrl !== undefined;

  function changeDate(nextDate: string) {
    const nextUrl = nextDate
      ? `${basePath}?date=${encodeURIComponent(nextDate)}`
      : basePath;

    if (nextDate) {
      setVisibleMonth(parseDateKey(nextDate));
    }
    setIsCalendarOpen(false);

    startTransition(() => {
      router.push(nextUrl);
    });
  }

  function shiftMonth(delta: number) {
    setVisibleMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + delta, 1),
    );
  }

  const monthCells = getMonthCells(visibleMonth);
  const monthLabel = visibleMonth.toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="glass-panel relative z-[60] overflow-visible rounded-[2rem] p-5">
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
          <div className="relative z-[80]">
            <button
              type="button"
              onClick={() => setIsCalendarOpen((current) => !current)}
              className="inline-flex h-12 min-w-[13rem] items-center gap-2 rounded-2xl bg-white px-4 text-left text-sm font-semibold outline-none ring-1 ring-[var(--line)] transition hover:bg-[var(--surface-muted)]"
              aria-expanded={isCalendarOpen}
            >
              <CalendarDays size={16} className="text-[var(--muted)]" />
              <span>{hasDate ? formatCalendarDate(selectedDate) : "Все даты"}</span>
            </button>

            {isCalendarOpen ? (
              <div className="absolute right-0 top-14 z-[120] w-[20rem] rounded-[1.6rem] bg-white p-4 shadow-[0_22px_70px_rgba(37,57,45,0.18)] ring-1 ring-[var(--line)]">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => shiftMonth(-1)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--foreground)]"
                    aria-label="Предыдущий месяц"
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <p className="text-sm font-semibold capitalize">{monthLabel}</p>
                  <button
                    type="button"
                    onClick={() => shiftMonth(1)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--foreground)]"
                    aria-label="Следующий месяц"
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                  {WEEK_DAYS.map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>

                <div className="mt-2 grid grid-cols-7 gap-1">
                  {monthCells.map((cell, index) => {
                    if (!cell) {
                      return <span key={`empty-${index}`} className="h-9" />;
                    }

                    const dateKey = toDateKey(cell);
                    const isSelected = dateKey === selectedDate;
                    const hasOrders = markedDateSet.has(dateKey);

                    return (
                      <button
                        key={dateKey}
                        type="button"
                        onClick={() => changeDate(dateKey)}
                        className={cn(
                          "relative inline-flex h-9 items-center justify-center rounded-full text-sm font-semibold transition hover:bg-[var(--accent-soft)]",
                          hasOrders && "ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-white",
                          isSelected && "bg-[var(--accent)] text-white ring-[var(--accent)]",
                        )}
                        aria-label={
                          hasOrders
                            ? `${formatCalendarDate(dateKey)}, есть заказы`
                            : formatCalendarDate(dateKey)
                        }
                      >
                        {cell.getDate()}
                      </button>
                    );
                  })}
                </div>

                {allowEmptyDate ? (
                  <button
                    type="button"
                    onClick={() => changeDate("")}
                    className="mt-4 h-10 w-full rounded-2xl bg-[var(--surface-muted)] text-sm font-semibold text-[var(--accent-strong)]"
                  >
                    Показать все даты
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {hasLabelsAction ? (
            <PdfActionLink
              href={labelsUrl}
              enabled={canGenerateLabels}
              variant="accent"
              download
              downloadFilename={`alexfruit-labels-${selectedDate || "orders"}.pdf`}
            >
              <FileText size={16} />
              Скачать этикетки PDF
            </PdfActionLink>
          ) : null}

          {hasAssemblyAction ? (
            <PdfActionLink href={assemblyUrl} enabled={canGenerate} variant="light">
              <PackageCheck size={16} />
              PDF для сборщика
            </PdfActionLink>
          ) : null}

          {hasDeliveryAction ? (
            <PdfActionLink href={deliveryUrl} enabled={canGenerate} variant="light">
              <Truck size={16} />
              PDF для доставщика
            </PdfActionLink>
          ) : null}

          {hasProcurementAction ? (
            <PdfActionLink href={procurementUrl} enabled={canGenerate} variant="light">
              <ShoppingBasket size={16} />
              PDF для закупки
            </PdfActionLink>
          ) : null}

          {!canGenerate && (
            <span className="text-xs leading-relaxed text-[var(--muted)] sm:basis-full lg:text-right">
              {hasDate ? emptyText : "Сначала выберите дату доставки."}
            </span>
          )}
          {hasLabelsAction && canGenerate && !canGenerateLabels && (
            <span className="text-xs leading-relaxed text-[var(--muted)] sm:basis-full lg:text-right">
              {labelsEmptyText}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
