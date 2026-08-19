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

export const EMPTY_FOOD_ERROR = "먹은 음식을 입력해주세요.";

export type MealSaveInput =
  | { ok: true; food: string; type: MealType }
  | { ok: false; error: string };

/** Reject a blank food entry so an empty meal is never saved. */
export function getMealSaveInput(
  foodInput: string,
  type: MealType | null,
  defaultType: MealType,
): MealSaveInput {
  const food = foodInput.trim();
  if (!food) return { ok: false, error: EMPTY_FOOD_ERROR };
  return { ok: true, food, type: type ?? defaultType };
}
