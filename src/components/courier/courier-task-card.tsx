"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PhoneCallLink } from "@/components/ui/phone-call-link";
import { formatCurrency } from "@/lib/utils";

export function CourierTaskCard({
  task,
}: {
  task: {
    id: string;
    status: string;
    order: {
      orderNumber: string;
      finalTotal: number | string | null;
      preliminaryTotal: number | string;
      customerComment?: string | null;
      user: { name: string; phone?: string | null };
      address: { city: string; street: string; house: string; apartment?: string | null };
      deliveryTimeSlot: { title: string };
    };
  };
}) {
  const router = useRouter();

  async function updateStatus(status: string) {
    await fetch(`/api/courier/tasks/${task.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  async function reportProblem() {
    await fetch(`/api/courier/tasks/${task.id}/problem`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        problemType: "CUSTOMER_UNREACHABLE",
        problemComment: "Клиент не взял трубку",
      }),
    });
    router.refresh();
  }

  return (
    <article className="glass-panel rounded-[2rem] p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold">{task.order.orderNumber}</h3>
          <p className="text-sm text-[var(--muted)]">
            {task.order.user.name} · {task.order.user.phone || "без телефона"}
          </p>
          <PhoneCallLink phone={task.order.user.phone} className="mt-1" />
          <p className="text-sm text-[var(--muted)]">
            {task.order.address.city}, {task.order.address.street}, {task.order.address.house}
            {task.order.address.apartment ? `, кв. ${task.order.address.apartment}` : ""}
          </p>
          <p className="text-sm text-[var(--muted)]">
            Окно: {task.order.deliveryTimeSlot.title}
          </p>
          <p className="font-semibold">
            {formatCurrency(task.order.finalTotal ?? task.order.preliminaryTotal)}
          </p>
          {task.order.customerComment && (
            <p className="text-sm text-[var(--muted)]">
              Комментарий: {task.order.customerComment}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {task.status !== "IN_PROGRESS" ? (
            <Button onClick={() => updateStatus("IN_PROGRESS")}>Выехал</Button>
          ) : null}
          <Button onClick={() => updateStatus("DELIVERED")}>Доставлено</Button>
          <Button variant="danger" onClick={() => reportProblem()}>
            Проблема
          </Button>
        </div>
      </div>
    </article>
  );
}
