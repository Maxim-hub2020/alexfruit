import { Role } from "@/generated/prisma";
import { MainShell } from "@/components/layout/main-shell";
import { AdminCatalogManager } from "@/components/admin/admin-catalog-manager";
import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toClientValue } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const user = await requirePageUser([Role.ADMIN]);
  const [categories, products] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.product.findMany({
      include: { category: true },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  return (
    <MainShell active="admin-products" user={user}>
      <section className="section-shell space-y-6 py-8">
        <div className="glass-panel rounded-[2.2rem] p-6">
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">Каталог</p>
          <h1 className="mt-3 font-serif text-5xl font-semibold">Товары, цены и категории</h1>
          <p className="mt-3 max-w-2xl text-lg text-[var(--muted)]">
            Добавляйте новые позиции, обновляйте цену и управляйте тем, что клиент видит в
            витрине прямо из админской панели.
          </p>
        </div>

        <AdminCatalogManager
          categories={toClientValue(categories)}
          products={toClientValue(products as never)}
        />
      </section>
    </MainShell>
  );
}
