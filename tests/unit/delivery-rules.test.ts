import test from "node:test";
import assert from "node:assert/strict";
import {
  addDaysToDateKey,
  getDefaultDeliveryDate,
  getDeliveryDateAvailability,
  isTodayDeliveryClosed,
} from "@/lib/delivery-rules";

test("keeps today delivery open before the 09:00 Moscow cutoff", () => {
  const beforeCutoff = new Date("2026-06-18T05:59:00.000Z"); // 08:59 MSK

  assert.equal(isTodayDeliveryClosed(beforeCutoff), false);
  assert.equal(getDefaultDeliveryDate(beforeCutoff), "2026-06-18");
});

test("moves default delivery date to tomorrow at and after 09:00 Moscow time", () => {
  const atCutoff = new Date("2026-06-18T06:00:00.000Z"); // 09:00 MSK

  assert.equal(isTodayDeliveryClosed(atCutoff), true);
  assert.equal(getDefaultDeliveryDate(atCutoff), "2026-06-19");
});

test("rejects past delivery dates and today's date after cutoff unless explicitly allowed", () => {
  const now = new Date("2026-06-18T10:00:00.000Z"); // 13:00 MSK

  assert.equal(getDeliveryDateAvailability("2026-06-17", now).available, false);
  assert.equal(getDeliveryDateAvailability("2026-06-18", now).available, false);
  assert.equal(
    getDeliveryDateAvailability("2026-06-18", now, {
      allowTodayAfterCutoff: true,
    }).available,
    true,
  );
});

test("adds days to date keys without local timezone drift", () => {
  assert.equal(addDaysToDateKey("2026-12-31", 1), "2027-01-01");
});
