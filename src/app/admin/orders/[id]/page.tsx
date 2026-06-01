import { Role } from "@/generated/prisma";
import { AdminOrderDetails } from "@/components/admin/admin-order-details";
import { MainShell } from "@/components/layout/main-shell";
import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getAdminOrder } from "@/lib/orders";
import { toClientValue } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageUser([Role.ADMIN]);
  const { id } = await params;
  const [order, courierProfiles] = await Promise.all([
    getAdminOrder(id),
    prisma.courier.findMany({
      where: { isActive: true },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);
  const courierOptions = courierProfiles.map((profile) => ({
    id: profile.userId,
    name: profile.name || profile.user.name,
  }));
  const couriers = [
    { id: user.id, name: `${user.name} (я)` },
    ...courierOptions.filter((courier) => courier.id !== user.id),
  ];

  return (
    <MainShell active="admin-orders" user={user}>
      <section className="section-shell py-8">
        <AdminOrderDetails
          order={toClientValue(order as never)}
          couriers={toClientValue(couriers)}
        />
      </section>
    </MainShell>
  );
}
