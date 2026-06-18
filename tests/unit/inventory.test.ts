import test from "node:test";
import assert from "node:assert/strict";
import {
  getInventoryAvailableQuantity,
  normalizeInventoryDate,
} from "@/lib/inventory";

test("calculates available stock from start, reserved and sold quantities", () => {
  assert.equal(
    getInventoryAvailableQuantity({
      quantityStart: "12.5",
      quantityReserved: "4.25",
      quantitySold: "3",
    }),
    5.25,
  );
});

test("never exposes negative stock to the storefront", () => {
  assert.equal(
    getInventoryAvailableQuantity({
      quantityStart: 2,
      quantityReserved: 3,
      quantitySold: 4,
    }),
    0,
  );
});

test("normalizes inventory date input to yyyy-mm-dd keys", () => {
  assert.equal(normalizeInventoryDate("2026-06-18T12:30:00.000Z"), "2026-06-18");
  assert.match(normalizeInventoryDate("bad-date"), /^\d{4}-\d{2}-\d{2}$/);
});
