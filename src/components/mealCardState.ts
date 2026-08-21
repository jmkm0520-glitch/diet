import type { MealType } from "../types/api";

export type MealCardState = {
  isFree: boolean;
  isSelected: boolean;
  label: "음식 입력 전" | "클린식" | "자유식";
};

export function getMealCardState(type: MealType | null): MealCardState {
  if (type === null) return { isFree: false, isSelected: false, label: "음식 입력 전" };
  return type === "free"
    ? { isFree: true, isSelected: true, label: "자유식" }
    : { isFree: false, isSelected: true, label: "클린식" };
}

/** Food and type saved when a meal card is left empty. */
export const EMPTY_FOOD = "공복";
export const EMPTY_FOOD_TYPE: MealType = "clean";

export type MealSaveInput = { food: string; type: MealType };

const FREE_MEAL_KEYWORDS = [
  "피자",
  "치킨",
  "햄버거",
  "라면",
  "떡볶이",
  "마라탕",
  "케이크",
  "아이스크림",
  "도넛",
  "맥주",
  "소주",
];

/**
 * Offer a lightweight record-keeping suggestion only. The user must still
 * choose a meal type before saving, so this never classifies a meal by itself.
 */
export function getMealTypeSuggestion(foodInput: string): MealType | null {
  const food = foodInput.trim();
  if (!food) return null;
  return FREE_MEAL_KEYWORDS.some((keyword) => food.includes(keyword)) ? "free" : "clean";
}

/** Fill an empty meal card in as a clean 공복 record instead of blocking the save. */
export function getMealSaveInput(
  foodInput: string,
  type: MealType | null,
  defaultType: MealType,
): MealSaveInput {
  const food = foodInput.trim();
  if (!food) return { food: EMPTY_FOOD, type: EMPTY_FOOD_TYPE };
  return { food, type: type ?? defaultType };
}
