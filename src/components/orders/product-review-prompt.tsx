"use client";

import { useState } from "react";
import { Camera, Star, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ReviewableItem = {
  id: string;
  productName: string;
};

type ProductReviewPromptProps = {
  orderNumber: string;
  items: ReviewableItem[];
};

function getFilesArray(fileList: FileList | null) {
  return Array.from(fileList ?? []).slice(0, 5);
}

export function ProductReviewPrompt({
  orderNumber,
  items,
}: ProductReviewPromptProps) {
  const [activeItemId, setActiveItemId] = useState(items[0]?.id ?? "");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submittedItemIds, setSubmittedItemIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const visibleItems = items.filter((item) => !submittedItemIds.has(item.id));
  const activeItem =
    visibleItems.find((item) => item.id === activeItemId) ?? visibleItems[0];

  if (visibleItems.length === 0) {
    return (
      <div className="mt-5 rounded-[1.6rem] bg-emerald-50 p-4 text-sm font-medium text-emerald-900 ring-1 ring-emerald-100">
        Спасибо, отзывы по этому заказу сохранены.
      </div>
    );
  }

  async function uploadReviewPhotos() {
    const uploadedUrls: string[] = [];

    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/reviews/uploads", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Не удалось загрузить фото");
      }

      uploadedUrls.push(result.url);
    }

    return uploadedUrls;
  }

  async function submitReview() {
    if (!activeItem) {
      return;
    }

    setIsSubmitting(true);
    setMessage("");
    setError("");

    try {
      const photoUrls = await uploadReviewPhotos();
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderItemId: activeItem.id,
          rating,
          comment,
          photoUrls,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Не удалось сохранить отзыв");
      }

      setSubmittedItemIds((current) => new Set(current).add(activeItem.id));
      setComment("");
      setFiles([]);
      setRating(5);
      setActiveItemId("");
      setMessage("Спасибо! Отзыв опубликован.");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Не удалось сохранить отзыв",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-5 rounded-[1.8rem] bg-white/86 p-4 ring-1 ring-[var(--line)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--accent-strong)]">
            Заказ {orderNumber} доставлен
          </p>
          <h3 className="mt-1 text-xl font-semibold">Поделитесь впечатлением</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Оценка помогает нам отбирать лучшие фрукты и овощи на следующую поставку.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {visibleItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveItemId(item.id);
                setMessage("");
                setError("");
              }}
              className={cn(
                "rounded-full px-3 py-2 text-xs font-semibold transition",
                activeItem?.id === item.id
                  ? "bg-[var(--accent)] text-white shadow-[0_12px_24px_rgba(47,143,79,0.24)]"
                  : "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
              )}
            >
              {item.productName}
            </button>
          ))}
        </div>
      </div>

      {activeItem ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_16rem]">
          <div className="space-y-3">
            <div>
              <p className="mb-2 text-sm font-semibold">{activeItem.productName}</p>
              <div className="flex gap-1" aria-label="Оценка товара">
                {Array.from({ length: 5 }).map((_, index) => {
                  const value = index + 1;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRating(value)}
                      className="rounded-full p-1 transition hover:scale-110"
                      aria-label={`${value} из 5`}
                    >
                      <Star
                        size={28}
                        className={
                          value <= rating
                            ? "fill-amber-400 text-amber-400"
                            : "fill-none text-[var(--line)]"
                        }
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Что понравилось? Как качество, спелость, упаковка?"
              className="min-h-28 w-full rounded-[1.25rem] bg-white px-4 py-3 text-sm outline-none ring-1 ring-[var(--line)] focus:ring-[var(--accent-soft)]"
              maxLength={1000}
            />

            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-[var(--foreground)] ring-1 ring-[var(--line)] transition hover:bg-[var(--accent-soft)]">
                <Upload size={16} />
                Добавить фото
                <input
                  type="file"
                  accept="image/avif,image/jpeg,image/png,image/webp"
                  multiple
                  className="sr-only"
                  onChange={(event) => setFiles(getFilesArray(event.currentTarget.files))}
                />
              </label>
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-[var(--foreground)] ring-1 ring-[var(--line)] transition hover:bg-[var(--accent-soft)]">
                <Camera size={16} />
                Сфотографировать
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(event) => setFiles(getFilesArray(event.currentTarget.files))}
                />
              </label>
              {files.length > 0 ? (
                <span className="text-sm text-[var(--muted)]">
                  Выбрано фото: {files.length}
                </span>
              ) : null}
            </div>
          </div>

          <div className="rounded-[1.4rem] bg-[#f5f8ef] p-4">
            <p className="text-sm font-semibold">Как мы используем отзыв</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Мы передадим оценку команде качества, сможем ответить вам и учтём
              фотографии при следующей закупке.
            </p>
            <Button
              className="mt-4 w-full"
              disabled={isSubmitting}
              onClick={() => void submitReview()}
            >
              {isSubmitting ? "Сохраняем..." : "Оставить отзыв"}
            </Button>
          </div>
        </div>
      ) : null}

      {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
