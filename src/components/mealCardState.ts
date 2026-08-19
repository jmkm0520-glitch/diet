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
