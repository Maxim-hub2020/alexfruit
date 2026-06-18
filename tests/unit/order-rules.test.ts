import test from "node:test";
import assert from "node:assert/strict";
import { OrderStatus } from "@/generated/prisma";
import {
  canCustomerEdit,
  CUSTOMER_ORDER_EDIT_WINDOW_HOURS,
} from "@/lib/orders";

test("allows customer edits only inside the configured edit window", () => {
  const editableUntil = new Date(Date.now() + 60 * 60 * 1000);

  assert.equal(
    canCustomerEdit({
      status: OrderStatus.CONFIRMED,
      editableUntil,
    }),
    true,
  );
  assert.equal(CUSTOMER_ORDER_EDIT_WINDOW_HOURS, 3);
});

test("blocks customer edits after delivery, cancellation or expired window", () => {
  const future = new Date(Date.now() + 60 * 60 * 1000);
  const past = new Date(Date.now() - 60 * 1000);

  assert.equal(
    canCustomerEdit({
      status: OrderStatus.DELIVERED,
      editableUntil: future,
    }),
    false,
  );
  assert.equal(
    canCustomerEdit({
      status: OrderStatus.CANCELLED,
      editableUntil: future,
    }),
    false,
  );
  assert.equal(
    canCustomerEdit({
      status: OrderStatus.CONFIRMED,
      editableUntil: past,
    }),
    false,
  );
});
