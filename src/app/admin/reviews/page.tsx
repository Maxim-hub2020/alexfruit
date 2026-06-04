import Link from "next/link";
import { Role } from "@/generated/prisma";
import {
  AdminReviewsManager,
  type AdminReviewRecord,
} from "@/components/admin/admin-reviews-manager";
import { MainShell } from "@/components/layout/main-shell";
import { requirePageUser } from "@/lib/auth";
import {
  getAdminProductReviews,
  getAdminProductReviewStats,
} from "@/lib/reviews";
import { toClientValue } from "@/lib/serialize";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type ReviewsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const reviewFilters = [
  { key: "all", label: "Все отзывы" },
  { key: "unanswered", label: "Без ответа" },
  { key: "hidden", label: "Скрытые" },
] as const;

type ReviewFilter = (typeof reviewFilters)[number]["key"];

function getFilterParam(value: string | string[] | undefined): ReviewFilter {
  const filter = Array.isArray(value) ? value[0] : value;

  return reviewFilters.some((item) => item.key === filter)
    ? (filter as ReviewFilter)
    : "all";
}

function getFilterCount(
  filter: ReviewFilter,
  stats: Awaited<ReturnType<typeof getAdminProductReviewStats>>,
) {
  if (filter === "unanswered") {
    return stats.unanswered;
  }

  if (filter === "hidden") {
    return stats.hidden;
  }

  return stats.total;
}

export default async function AdminReviewsPage({
  searchParams,
}: ReviewsPageProps) {
  const [user, params, stats] = await Promise.all([
    requirePageUser([Role.ADMIN]),
    searchParams,
    getAdminProductReviewStats(),
  ]);
  const filter = getFilterParam(params.filter);
  const reviews = await getAdminProductReviews(filter === "all" ? null : filter);

  return (
    <MainShell active="admin-reviews" user={user}>
      <section className="section-shell space-y-6 py-8">
        <div className="glass-panel rounded-[2.2rem] p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
            Клиенты
          </p>
          <h1 className="mt-3 font-serif text-5xl font-semibold">
            Отзывы и обратная связь
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-[var(--muted)]">
            Отвечайте клиентам, проверяйте фотографии и управляйте тем, какие отзывы
            отображаются на витрине товаров.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Всего отзывов", stats.total],
            ["Ждут ответа", stats.unanswered],
            ["Скрыто", stats.hidden],
          ].map(([label, value]) => (
            <article key={label} className="glass-panel rounded-[1.75rem] p-4">
              <p className="text-sm text-[var(--muted)]">{label}</p>
              <p className="mt-3 text-3xl font-semibold">{value}</p>
            </article>
          ))}
        </div>

        <div className="glass-panel flex flex-wrap gap-2 rounded-[1.75rem] p-2">
          {reviewFilters.map((item) => (
            <Link
              key={item.key}
              href={
                item.key === "all"
                  ? "/admin/reviews"
                  : `/admin/reviews?filter=${item.key}`
              }
              className={cn(
                "rounded-[1.25rem] px-4 py-3 text-sm font-semibold transition",
                filter === item.key
                  ? "bg-[var(--accent)] text-white shadow-[0_12px_30px_rgba(47,143,79,0.18)]"
                  : "bg-white/70 text-[var(--foreground)] hover:bg-white",
              )}
            >
              {item.label} · {getFilterCount(item.key, stats)}
            </Link>
          ))}
        </div>

        <AdminReviewsManager
          initialReviews={toClientValue(reviews) as unknown as AdminReviewRecord[]}
        />
      </section>
    </MainShell>
  );
}
