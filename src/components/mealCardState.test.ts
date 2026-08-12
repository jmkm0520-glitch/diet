import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getMealCardState } from "./mealCardState.ts";

describe("getMealCardState", () => {
  it("uses the clean card state for clean meals", () => {
    assert.deepEqual(getMealCardState("clean"), {
      isFree: false,
      isSelected: true,
      label: "클린식",
    });
  });

  it("uses the red free card state for free meals", () => {
    assert.deepEqual(getMealCardState("free"), {
      isFree: true,
      isSelected: true,
      label: "자유식",
    });
  });

  it("uses a neutral state before food is entered", () => {
    assert.deepEqual(getMealCardState(null), {
      isFree: false,
      isSelected: false,
      label: "음식 입력 전",
    });
  });
});
