import Image from "next/image";
import { useState } from "react";

import styles from "../app/page.module.css";
import type { Meal, MealRecord, MealType } from "../types/api";
import { getMealCardState, getMealSaveInput } from "./mealCardState";

export type MealCardProps = {
  meal: Meal;
  title: string;
  defaultFood: string;
  defaultType: MealType;
  record: MealRecord | null;
  isLoading: boolean;
  onSave: (meal: Meal, food: string, type: MealType) => Promise<void>;
  onDelete: (meal: Meal) => Promise<void>;
};

export function MealCard({
  meal,
  title,
  defaultFood,
  defaultType,
  record,
  isLoading,
  onSave,
  onDelete,
}: MealCardProps) {
  const food = record?.food ?? defaultFood;
  const initialType = record?.type ?? (food.trim() ? defaultType : null);
  const [type, setType] = useState<MealType | null>(initialType);
  const [foodInput, setFoodInput] = useState(food);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(() => Boolean(record));
  const [isDeleting, setIsDeleting] = useState(false);
  const { isFree, isSelected, label } = getMealCardState(type);

  async function saveMeal() {
    const input = getMealSaveInput(foodInput, type, defaultType);
    if (!input.ok) {
      setError(input.error);
      setSaveStatus("");
      return;
    }

    const { food: inputFood, type: selectedType } = input;
    setIsSaving(true);
    setError(null);
    setSaveStatus("");
    try {
      await onSave(meal, inputFood, selectedType);
      setFoodInput(inputFood);
      setType(selectedType);
      setIsLocked(true);
      setSaveStatus(`${title} 식단이 저장되었습니다.`);
    } catch {
      setError("식단을 저장하지 못했어요. 입력 내용은 유지했으니 다시 저장해 주세요.");
    } finally {
      setIsSaving(false);
    }
  }

  function unlockMeal() {
    setIsLocked(false);
    setError(null);
    setSaveStatus(`${title} 식단 수정 모드입니다.`);
  }

  async function deleteMeal() {
    if (!window.confirm(`${title} 식단 기록을 삭제할까요?`)) return;
    setIsDeleting(true);
    setError(null);
    setSaveStatus("");
    try {
      await onDelete(meal);
    } catch {
      setError("식단을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.");
      setIsDeleting(false);
    }
  }

  return (
    <article
      aria-label={`${title} (${meal}) 식단 기록`}
      aria-busy={isLoading || isSaving || isDeleting}
      className={`${styles.mealCard} ${isFree ? styles.freeMealCard : ""} ${!isSelected ? styles.unselectedMealCard : ""}`}
    >
      <div className={styles.mealHeader}>
        <p className={styles.mealName}>
          {title}
          {isSelected ? (
            <Image
              className={styles.mealEmoji}
              src={isFree ? "/free.png" : "/clean.png"}
              alt={`${label} 이모티콘`}
              width={35}
              height={35}
            />
          ) : null}
        </p>
        <span
          className={!isSelected ? styles.unselectedTag : isFree ? styles.freeTag : styles.cleanTag}
        >
          {label}
        </span>
      </div>
      <div className={styles.mealContent}>
        <label className={styles.srOnly} htmlFor={`food-${meal}`}>
          {title} 음식 내용
        </label>
        <input
          aria-describedby={error ? `food-error-${meal}` : undefined}
          aria-invalid={Boolean(error)}
          aria-label={`${title} 음식 내용`}
          className={styles.foodInput}
          disabled={isLoading || isSaving || isDeleting || isLocked}
          id={`food-${meal}`}
          maxLength={500}
          name="food"
          placeholder="음식을 입력해 주세요"
          type="text"
          value={foodInput}
          onChange={(event) => {
            const nextFood = event.target.value;
            setFoodInput(nextFood);
            if (!nextFood.trim() && !record) setType(null);
            if (nextFood.trim() && type === null) setType(defaultType);
            setError(null);
            setSaveStatus("");
          }}
        />
        <div className={styles.mealActions}>
          <div className={styles.mealChoices} aria-label={`${title} 식단 종류`}>
            <button
              aria-label={`${title} 클린식 선택`}
              aria-pressed={type === "clean"}
              className={type === "clean" ? styles.selectedChoice : ""}
              disabled={isSaving || isDeleting || isLocked}
              type="button"
              onClick={() => {
                setType((current) => (current === "clean" ? null : "clean"));
              }}
            >
              클린식
            </button>
            <button
              aria-label={`${title} 자유식 선택`}
              aria-pressed={isFree}
              className={isFree ? styles.selectedChoice : ""}
              disabled={isSaving || isDeleting || isLocked}
              type="button"
              onClick={() => {
                setType((current) => (current === "free" ? null : "free"));
              }}
            >
              자유식
            </button>
          </div>
          <button
            aria-label={`${title} 식단 ${isLocked ? "수정" : "저장"}`}
            className={`${styles.mealSaveButton} ${isLocked ? styles.mealSaveButtonEdit : ""}`}
            disabled={isSaving || isDeleting}
            type="button"
            onClick={isLocked ? unlockMeal : saveMeal}
          >
            {isSaving ? "저장 중..." : isLocked ? "수정" : "저장"}
          </button>
          {record ? (
            <button
              aria-label={`${title} 식단 삭제`}
              className={styles.mealDeleteButton}
              disabled={isSaving || isDeleting}
              type="button"
              onClick={deleteMeal}
            >
              {isDeleting ? "삭제 중..." : "삭제"}
            </button>
          ) : null}
        </div>
        {error && (
          <p className={styles.mealInputError} id={`food-error-${meal}`} role="alert">
            {error}
          </p>
        )}
        {saveStatus ? (
          <p className={styles.srOnly} role="status" aria-live="polite">
            {saveStatus}
          </p>
        ) : null}
      </div>
    </article>
  );
}
