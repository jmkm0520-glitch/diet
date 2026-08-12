import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildRecordPageHref } from "./calendarNavigation.ts";

describe("buildRecordPageHref", () => {
  it("keeps the selected date when opening an existing record for editing", () => {
    assert.equal(buildRecordPageHref("2026-08-11"), "/?date=2026-08-11");
  });

  it("keeps the selected date when opening an empty date for recording", () => {
    assert.equal(buildRecordPageHref("2026-07-07"), "/?date=2026-07-07");
  });

  it("rejects an invalid selected date", () => {
    assert.throws(() => buildRecordPageHref("2026-02-29"));
  });
});
