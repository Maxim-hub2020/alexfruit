"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Eye, EyeOff, MessageSquareReply, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CatalogImage } from "@/components/ui/catalog-image";
import { cn, formatDateLabel } from "@/lib/utils";

export type AdminReviewRecord = {
  id: string;
  rating: number;
  comment?: string | null;
  adminReply?: string | null;
  adminReplyAt?: string | null;
  isPublished: boolean;
  createdAt: string;
  product: {
    id: string;
    name: string;
    imageUrl?: string | null;
    category?: {
      name: string;
    } | null;
  };
  order: {
    id: string;
    orderNumber: string;
    deliveryDate: string;
  };
  user: {
    id: string;
    name: string;
    phone?: string | null;
  };
  adminReplyBy?: {
    id: string;
    name: string;
  } | null;
  photos: Array<{
    id: string;
    url: string;
  }>;
};

type Feedback = {
  type: "success" | "error";
  message: string;
};

function createDraftReplies(reviews: AdminReviewRecord[]) {
  return Object.fromEntries(
    reviews.map((review) => [review.id, review.adminReply ?? ""]),
  );
}

function RatingStars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`Оценка ${value} из 5`}>
      {Array.from({ length: 5 }).map((_, index) => {
        const isActive = index < value;

        return (
          <Star
            key={index}
            size={18}
            className={
              isActive
                ? "fill-amber-400 text-amber-400"
                : "fill-none text-[var(--line)]"
            }
          />
        );
      })}
    </div>
  );
}

export function AdminReviewsManager({
  initialReviews,
}: {
  initialReviews: AdminReviewRecord[];
}) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [reviews, setReviews] = useState(initialReviews);
  const [draftReplies, setDraftReplies] = useState(() =>
    createDraftReplies(initialReviews),
  );
  const [savingReviewId, setSavingReviewId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function updateReview(
    reviewId: string,
    payload: { adminReply?: string; isPublished?: boolean },
  ) {
    setSavingReviewId(reviewId);
    setFeedback(null);

    try {
      const response = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Не удалось обновить отзыв");
      }

      setReviews((current) =>
        current.map((review) =>
          review.id === reviewId ? (result as AdminReviewRecord) : review,
        ),
      );
      setDraftReplies((current) => ({
        ...current,
        [reviewId]: (result as AdminReviewRecord).adminReply ?? "",
      }));
      setFeedback({
        type: "success",
        message: "Отзыв обновлён.",
      });
      startRefresh(() => router.refresh());
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Не удалось обновить отзыв",
      });
    } finally {
      setSavingReviewId(null);
    }
  }

  if (reviews.length === 0) {
    return (
      <div className="glass-panel rounded-[2rem] p-8 text-center">
        <p className="text-lg font-semibold">Отзывов пока нет</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Когда клиент получит заказ, приложение предложит ему оценить товары.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {feedback ? (
        <div
          className={cn(
            "rounded-[1.5rem] p-4 text-sm font-semibold ring-1",
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-900 ring-emerald-100"
              : "bg-rose-50 text-rose-900 ring-rose-100",
          )}
        >
          {feedback.message}
        </div>
      ) : null}

      {reviews.map((review) => {
        const isSaving = savingReviewId === review.id || isRefreshing;
        const draftReply = draftReplies[review.id] ?? "";

        return (
          <article
            key={review.id}
            className={cn(
              "glass-panel rounded-[2rem] p-5",
              !review.isPublished && "ring-2 ring-amber-200",
            )}
          >
            <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  {review.product.imageUrl ? (
                    <CatalogImage
                      src={review.product.imageUrl}
                      alt={review.product.name}
                      width={96}
                      height={96}
                      className="h-24 w-24 rounded-[1.4rem] object-cover ring-1 ring-[var(--line)]"
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-[1.4rem] bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent-strong)]">
                      АлексФрут
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-semibold">
                        {review.product.name}
                      </h2>
                      {!review.isPublished ? (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                          Скрыт
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {review.product.category?.name ?? "Без категории"} · заказ{" "}
                      {review.order.orderNumber} · доставка{" "}
                      {formatDateLabel(review.order.deliveryDate)}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <RatingStars value={review.rating} />
                      <span className="text-sm font-semibold">
                        {review.rating}/5
                      </span>
                      <span className="text-sm text-[var(--muted)]">
                        {formatDateLabel(review.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.4rem] bg-white/85 p-4 ring-1 ring-[var(--line)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                    Клиент
                  </p>
                  <p className="mt-2 text-lg font-semibold">{review.user.name}</p>
                  <p className="text-sm text-[var(--muted)]">
                    {review.user.phone ?? "Телефон не указан"}
                  </p>
                </div>

                <div className="rounded-[1.4rem] bg-white/85 p-4 ring-1 ring-[var(--line)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                    Отзыв
                  </p>
                  <p className="mt-2 text-base leading-7">
                    {review.comment?.trim() || "Клиент оставил только оценку."}
                  </p>
                </div>

                {review.photos.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {review.photos.map((photo) => (
                      <a
                        key={photo.id}
                        href={photo.url}
                        target="_blank"
                        rel="noreferrer"
                        className="overflow-hidden rounded-[1.3rem] ring-1 ring-[var(--line)]"
                      >
                        <CatalogImage
                          src={photo.url}
                          alt="Фото из отзыва"
                          width={260}
                          height={220}
                          className="h-40 w-full object-cover transition hover:scale-105"
                        />
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="rounded-[1.6rem] bg-[#f5f8ef] p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-white p-3 text-[var(--accent-strong)] shadow-sm">
                    <MessageSquareReply size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">Ответ администратора</h3>
                    <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                      Ответ сохранится в карточке отзыва и будет виден клиенту в его
                      заказе.
                    </p>
                  </div>
                </div>

                <textarea
                  value={draftReply}
                  onChange={(event) =>
                    setDraftReplies((current) => ({
                      ...current,
                      [review.id]: event.target.value,
                    }))
                  }
                  className="mt-4 min-h-40 w-full rounded-[1.25rem] bg-white px-4 py-3 text-sm outline-none ring-1 ring-[var(--line)] focus:ring-[var(--accent-soft)]"
                  placeholder="Например: спасибо за отзыв, уже передали закупке..."
                  maxLength={1000}
                />

                {review.adminReplyBy ? (
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    Последний ответ: {review.adminReplyBy.name}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Button
                    className="flex-1"
                    disabled={isSaving}
                    onClick={() =>
                      void updateReview(review.id, {
                        adminReply: draftReply,
                      })
                    }
                  >
                    {isSaving ? "Сохраняем..." : "Сохранить ответ"}
                  </Button>
                  <Button
                    variant={review.isPublished ? "ghost" : "secondary"}
                    disabled={isSaving}
                    onClick={() =>
                      void updateReview(review.id, {
                        isPublished: !review.isPublished,
                      })
                    }
                  >
                    {review.isPublished ? <EyeOff size={16} /> : <Eye size={16} />}
                    {review.isPublished ? "Скрыть" : "Показать"}
                  </Button>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
