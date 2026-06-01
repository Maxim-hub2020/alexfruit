import { MainShell } from "@/components/layout/main-shell";
import { CatalogExplorer } from "@/components/storefront/catalog-explorer";
import { getCurrentUser } from "@/lib/auth";
import { getDefaultDeliveryDate } from "@/lib/delivery-rules";
import { getStorefrontData } from "@/lib/orders";
import { toClientValue } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const defaultDeliveryDate = getDefaultDeliveryDate();
  const [user, data] = await Promise.all([
    getCurrentUser(),
    getStorefrontData(undefined, defaultDeliveryDate),
  ]);

  return (
    <MainShell active="catalog" user={user}>
      <section className="section-shell py-6">
        <CatalogExplorer
          categories={toClientValue(data.categories)}
          products={toClientValue(data.products as never)}
        />
      </section>
    </MainShell>
  );
}
