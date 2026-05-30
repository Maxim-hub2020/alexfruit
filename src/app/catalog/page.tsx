import { MainShell } from "@/components/layout/main-shell";
import { CatalogExplorer } from "@/components/storefront/catalog-explorer";
import { getCurrentUser } from "@/lib/auth";
import { getDefaultDeliveryDate } from "@/lib/delivery-rules";
import { getStorefrontData } from "@/lib/orders";
import { toClientValue } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const defaultDeliveryDate = getDefaultDeliveryDate();
  const dateParam = Array.isArray(params.date) ? params.date[0] : params.date;
  const deliveryDate = dateParam?.slice(0, 10) || defaultDeliveryDate;
  const [user, data] = await Promise.all([
    getCurrentUser(),
    getStorefrontData(undefined, deliveryDate),
  ]);

  return (
    <MainShell active="catalog" user={user}>
      <section className="section-shell py-6">
        <CatalogExplorer
          categories={toClientValue(data.categories)}
          products={toClientValue(data.products as never)}
          deliveryDate={deliveryDate}
          defaultDeliveryDate={defaultDeliveryDate}
        />
      </section>
    </MainShell>
  );
}
