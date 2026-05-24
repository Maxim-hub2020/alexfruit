"use client";

import { useRouter } from "next/navigation";
import { useCart } from "@/components/providers/cart-provider";
import { Button } from "@/components/ui/button";

export function RepeatOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { items, replaceAll } = useCart();

  return (
    <Button
      variant="secondary"
      onClick={async () => {
        const response = await fetch(`/api/orders/${orderId}/repeat`, {
          method: "POST",
        });
        const result = await response.json();

        if (!response.ok) {
          return;
        }

        const merged = [...items];
        for (const item of result.items) {
          const existing = merged.find((entry) => entry.productId === item.productId);
          if (existing) {
            existing.quantity += item.quantity;
          } else {
            merged.push(item);
          }
        }
        replaceAll(merged);
        router.push("/cart");
      }}
    >
      Повторить заказ
    </Button>
  );
}
