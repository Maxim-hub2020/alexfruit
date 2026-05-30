import { notFound } from "next/navigation";
import { MainShell } from "@/components/layout/main-shell";
import { SharedCartClient } from "@/components/storefront/shared-cart-client";
import { getUserAddresses } from "@/lib/addresses";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSharedCart } from "@/lib/shared-carts";
import { toClientValue } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export default async function SharedCartPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [user, sharedCart, products] = await Promise.all([
    getCurrentUser(),
    getSharedCart(token),
    prisma.product.findMany({
      where: { isActive: true },
      include: { category: true },
      orderBy: [{ isPromo: "desc" }, { isHit: "desc" }, { name: "asc" }],
    }),
  ]);

  if (!sharedCart) {
    notFound();
  }
  const addresses =
    user && user.id === sharedCart.ownerId ? await getUserAddresses(user.id) : [];

  return (
    <MainShell user={user}>
      <section className="section-shell py-8">
        <SharedCartClient
          sharedCart={toClientValue(sharedCart as never)}
          products={toClientValue(products as never)}
          user={user ? { id: user.id, name: user.name, role: user.role } : null}
          addresses={toClientValue(addresses as never)}
          initialSlots={[]}
        />
      </section>
    </MainShell>
  );
}
