import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getMealCardState, getMealSaveInput, getMealTypeSuggestion } from "./mealCardState.ts";

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

describe("getMealSaveInput", () => {
  it("saves an empty card as a clean 공복 record", () => {
    assert.deepEqual(getMealSaveInput("   ", null, "clean"), { food: "공복", type: "clean" });
  });

  it("keeps an empty card clean even when 자유식 is selected", () => {
    assert.deepEqual(getMealSaveInput("", "free", "clean"), { food: "공복", type: "clean" });
  });

  it("trims the entered food and keeps the chosen type", () => {
    assert.deepEqual(getMealSaveInput("  햄버거 ", "free", "clean"), {
      food: "햄버거",
      type: "free",
    });
  });

  it("falls back to the card default type when none is chosen", () => {
    assert.deepEqual(getMealSaveInput("샐러드", null, "clean"), { food: "샐러드", type: "clean" });
  });
});

describe("getMealTypeSuggestion", () => {
  it("does not offer a suggestion before food is entered", () => {
    assert.equal(getMealTypeSuggestion("  "), null);
  });

  it("offers a clean-meal suggestion for a salmon poke", () => {
    assert.equal(getMealTypeSuggestion("연어 포케"), "clean");
  });

  it("offers a free-meal suggestion without selecting it", () => {
    assert.equal(getMealTypeSuggestion("치킨"), "free");
  });
});
