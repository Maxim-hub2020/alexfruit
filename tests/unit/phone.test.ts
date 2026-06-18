import test from "node:test";
import assert from "node:assert/strict";
import { getPhoneHref, normalizeRussianPhone } from "@/lib/phone";

test("normalizes Russian customer phone numbers for auth", () => {
  assert.equal(normalizeRussianPhone("9381470060"), "+79381470060");
  assert.equal(normalizeRussianPhone("8 (938) 147-00-60"), "+79381470060");
  assert.equal(normalizeRussianPhone("+7 938 147 00 60"), "+79381470060");
});

test("keeps non-Russian or incomplete phone input unchanged after trimming", () => {
  assert.equal(normalizeRussianPhone("  +1 555 0100  "), "+1 555 0100");
  assert.equal(normalizeRussianPhone("12345"), "12345");
});

test("builds tel href value from common local phone formats", () => {
  assert.equal(getPhoneHref("8 (938) 147-00-60"), "+79381470060");
  assert.equal(getPhoneHref("79381470060"), "+79381470060");
  assert.equal(getPhoneHref(null), null);
});
