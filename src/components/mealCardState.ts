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

export function toggleMealType(
  currentType: MealType | null,
  selectedType: MealType,
): MealType | null {
  return currentType === selectedType ? null : selectedType;
}
