import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDailyBars, donutDash, donutLabel } from "./statsChart.ts";

describe("donutDash", () => {
  it("fills the whole ring when every meal is clean", () => {
    assert.deepEqual(donutDash(100, 300), [300, 0]);
  });

  it("leaves the ring empty when nothing is clean", () => {
    assert.deepEqual(donutDash(0, 300), [0, 300]);
  });

  it("splits the ring by the clean ratio", () => {
    assert.deepEqual(donutDash(76, 300), [228, 72]);
  });

  it("clamps a ratio that falls outside 0 to 100", () => {
    assert.deepEqual(donutDash(140, 300), [300, 0]);
    assert.deepEqual(donutDash(-20, 300), [0, 300]);
  });
});

describe("buildDailyBars", () => {
  const daily = [
    { date: "2026-08-18", clean: 2, free: 2 },
    { date: "2026-08-19", clean: 0, free: 0 },
    { date: "2026-08-20", clean: 1, free: 0 },
  ];

  it("scales the busiest day to the full chart height", () => {
    const bars = buildDailyBars(daily);
    assert.equal(bars[0].cleanHeight + bars[0].freeHeight, 1);
  });

  it("keeps a day without records as an empty slot", () => {
    const bars = buildDailyBars(daily);
    assert.equal(bars[1].total, 0);
    assert.equal(bars[1].cleanHeight, 0);
    assert.equal(bars[1].freeHeight, 0);
    assert.equal(bars.length, 3);
  });

  it("labels each column with the day of the month", () => {
    assert.deepEqual(
      buildDailyBars(daily).map((bar) => bar.label),
      ["18", "19", "20"],
    );
  });

  it("scales a quieter day proportionally", () => {
    assert.equal(buildDailyBars(daily)[2].cleanHeight, 0.25);
  });

  it("gives every day zero height when nothing is recorded", () => {
    const bars = buildDailyBars([{ date: "2026-08-20", clean: 0, free: 0 }]);
    assert.equal(bars[0].cleanHeight, 0);
    assert.equal(bars[0].freeHeight, 0);
  });
});

describe("donutLabel", () => {
  it("describes both shares for screen readers", () => {
    assert.equal(donutLabel(16, 5, 76), "클린식 16회 76퍼센트, 자유식 5회 24퍼센트");
  });
});
