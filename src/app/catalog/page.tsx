import { MainShell } from "@/components/layout/main-shell";
import { CatalogExplorer } from "@/components/storefront/catalog-explorer";
import { getCurrentUser } from "@/lib/auth";
import { getBusinessDateKey } from "@/lib/delivery-rules";
import { getStorefrontData } from "@/lib/orders";
import { toClientValue } from "@/lib/serialize";

export const dynamic = "force-dynamic";

type CatalogPageProps = {
  searchParams?: Promise<{ category?: string | string[] }>;
};

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams;
  const requestedCategory =
    typeof params?.category === "string" ? params.category : null;
  const today = getBusinessDateKey();
  const [user, data] = await Promise.all([
    getCurrentUser(),
    getStorefrontData(undefined, today),
  ]);
  const initialCategory =
    requestedCategory &&
    data.categories.some((category) => category.slug === requestedCategory)
      ? requestedCategory
      : null;

  return (
    <MainShell active="catalog" user={user}>
      <section className="section-shell py-6">
        <CatalogExplorer
          categories={toClientValue(data.categories)}
          initialCategory={initialCategory}
          products={toClientValue(data.products as never)}
        />
      </section>
    </MainShell>
  );
}
