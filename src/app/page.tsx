import { MainShell } from "@/components/layout/main-shell";
import { CatalogExplorer } from "@/components/storefront/catalog-explorer";
import { getCurrentUser } from "@/lib/auth";
import { getStorefrontData } from "@/lib/orders";
import { toClientValue } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  const data = await getStorefrontData(user?.role === "CUSTOMER" ? user.id : undefined);

  return (
    <MainShell active="home" user={user}>
      <section className="section-shell pb-6 pt-3 md:pt-4">
        <CatalogExplorer
          categories={toClientValue(data.categories)}
          products={toClientValue(data.products as never)}
          compactHome
        />
      </section>
    </MainShell>
  );
}
