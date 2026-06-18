import test from "node:test";
import assert from "node:assert/strict";
import {
  formatEtaMinutes,
  getApproximateEtaMinutes,
  getDistanceKm,
  getOrderPoint,
  toNumber,
} from "@/lib/courier-eta";

test("converts database decimal-like values to safe numbers", () => {
  assert.equal(toNumber("47.222100"), 47.2221);
  assert.equal(toNumber("not-a-number"), null);
  assert.equal(toNumber(null), null);
});

test("extracts order coordinates only when both values are valid", () => {
  assert.deepEqual(
    getOrderPoint({
      address: { latitude: "47.222100", longitude: "39.720300" },
    }),
    { latitude: 47.2221, longitude: 39.7203 },
  );
  assert.equal(
    getOrderPoint({
      address: { latitude: "47.222100", longitude: null },
    }),
    null,
  );
});

test("calculates realistic courier distance and minimum ETA", () => {
  const distance = getDistanceKm(
    { latitude: 47.2221, longitude: 39.7203 },
    { latitude: 47.2357, longitude: 39.7015 },
  );

  assert.ok(distance > 1);
  assert.ok(distance < 4);
  assert.equal(getApproximateEtaMinutes(0), 5);
  assert.ok(getApproximateEtaMinutes(distance) >= 10);
});

test("formats ETA text for minutes and hours", () => {
  assert.equal(formatEtaMinutes(35).includes("35"), true);
  assert.equal(formatEtaMinutes(60).includes("1"), true);
  assert.equal(formatEtaMinutes(75).includes("15"), true);
});
