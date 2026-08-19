"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./page.module.css";
import Link from "next/link";
import Image from "next/image";
import { MealCard } from "../components/MealCard";
import { TabNav } from "../components/TabNav";
import {
  formatLocalDate,
  isFutureLocalDate,
  isLocalDate,
  readDateFromUrl,
  writeDateToUrl,
} from "../services/date";
import { ApiClientError, fetchApi } from "../services/apiClient";
import type { DayRecord, Meal, MealRecord, MealType } from "../types/api";
import {
  clearLocalMeals,
  deleteLocalMeal,
  readLocalDay,
  saveLocalMeal,
  saveLocalWeight,
} from "../services/localDayStorage";

function isApiNotFound(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 404;
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" className={styles.calendarIcon} viewBox="0 0 24 24">
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M7.5 3.5v4M16.5 3.5v4M3.5 10h17" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" />
    </svg>
  );
}

const meals: { meal: Meal; title: string; defaultFood: string; defaultType: MealType }[] = [
  { meal: "breakfast", title: "아침", defaultFood: "", defaultType: "clean" },
  { meal: "lunch", title: "점심", defaultFood: "", defaultType: "clean" },
  { meal: "dinner", title: "저녁", defaultFood: "", defaultType: "clean" },
  { meal: "snack", title: "간식", defaultFood: "", defaultType: "clean" },
];

export default function Home() {
  const todayDate = formatLocalDate();
  const [selectedDate, setSelectedDate] = useState(() => formatLocalDate());
  const [dayRecord, setDayRecord] = useState<DayRecord | null>(null);
  const [isLoadingDay, setIsLoadingDay] = useState(true);
  const [weightInput, setWeightInput] = useState("");
  const [weightError, setWeightError] = useState<string | null>(null);
  const [weightSaveError, setWeightSaveError] = useState<string | null>(null);
  const [weightStatus, setWeightStatus] = useState("");
  const [isSavingWeight, setIsSavingWeight] = useState(false);
  const [isWeightLocked, setIsWeightLocked] = useState(false);
  const [isResettingMeals, setIsResettingMeals] = useState(false);
  const [mealResetVersion, setMealResetVersion] = useState(0);
  const [mealVersions, setMealVersions] = useState<Record<Meal, number>>({
    breakfast: 0,
    lunch: 0,
    dinner: 0,
    snack: 0,
  });
  const [mealResetError, setMealResetError] = useState<string | null>(null);
  const [mealResetStatus, setMealResetStatus] = useState("");

  const selectDate = useCallback(
    (nextDate: string) => {
      if (!isLocalDate(nextDate)) return;
      const safeDate = isFutureLocalDate(nextDate) ? todayDate : nextDate;
      setSelectedDate(safeDate);
      writeDateToUrl(safeDate);
      setDayRecord(null);
      setIsLoadingDay(true);
      setIsWeightLocked(false);
      setWeightSaveError(null);
      setWeightStatus("");
      setMealResetError(null);
      setMealResetStatus("");
    },
    [todayDate],
  );

  useEffect(() => {
    const urlDate = readDateFromUrl("");
    if (!urlDate) return;
    const timeoutId = window.setTimeout(() => selectDate(urlDate), 0);
    return () => window.clearTimeout(timeoutId);
  }, [selectDate]);

  function updateWeightInput(value: string) {
    setWeightInput(value);
    setWeightSaveError(null);
    setWeightStatus("");
    if (!value.trim()) {
      setWeightError("체중을 입력해 주세요.");
      return;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      setWeightError("숫자를 입력해 주세요.");
      return;
    }
    setWeightError(parsed > 0 ? null : "0보다 큰 숫자를 입력해 주세요.");
  }

  async function saveWeight() {
    if (weightError || !weightInput.trim()) {
      updateWeightInput(weightInput);
      return;
    }
    setIsSavingWeight(true);
    setWeightSaveError(null);
    setWeightStatus("");
    try {
      await fetchApi(`/api/weight`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, weight: Number(weightInput) }),
      });
      setIsWeightLocked(true);
      setWeightStatus("체중이 저장되었습니다.");
    } catch (error) {
      if (isApiNotFound(error)) {
        const record = saveLocalWeight(selectedDate, Number(weightInput));
        setDayRecord((current) => ({
          ...(current ?? readLocalDay(selectedDate)),
          date: selectedDate,
          weight: record,
        }));
        setIsWeightLocked(true);
        setWeightStatus("체중이 저장되었습니다.");
      } else {
        setWeightSaveError("체중을 저장하지 못했어요. 입력값은 유지했으니 다시 저장해 주세요.");
      }
    } finally {
      setIsSavingWeight(false);
    }
  }

  function unlockWeightInput() {
    setIsWeightLocked(false);
    setWeightError(null);
    setWeightSaveError(null);
    setWeightStatus("체중 수정 모드입니다.");
  }

  async function saveMeal(meal: Meal, food: string, type: MealType) {
    let record: MealRecord;
    try {
      record = await fetchApi<MealRecord>("/api/meal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, meal, food, type }),
      });
    } catch (error) {
      if (!isApiNotFound(error)) throw error;
      record = saveLocalMeal(selectedDate, meal, food, type);
    }

    setDayRecord((current) => ({
      ...(current ?? readLocalDay(selectedDate)),
      date: selectedDate,
      meals: { ...(current?.meals ?? readLocalDay(selectedDate).meals), [meal]: record },
    }));
  }

  async function deleteMeal(meal: Meal) {
    try {
      await fetchApi<{ date: string; deleted: number }>(
        `/api/meal?date=${selectedDate}&meal=${meal}`,
        { method: "DELETE" },
      );
    } catch (error) {
      if (!isApiNotFound(error)) throw error;
    }

    const localDay = deleteLocalMeal(selectedDate, meal);
    setDayRecord((current) => ({
      ...(current ?? localDay),
      date: selectedDate,
      meals: { ...(current?.meals ?? localDay.meals), [meal]: null },
    }));
    setMealVersions((current) => ({ ...current, [meal]: current[meal] + 1 }));
  }

  async function resetMeals() {
    const confirmed = window.confirm(
      `${dateTitle}의 아침, 점심, 저녁, 간식 기록을 모두 초기화할까요?`,
    );
    if (!confirmed) return;

    setIsResettingMeals(true);
    setMealResetError(null);
    setMealResetStatus("");
    try {
      await fetchApi<{ date: string; deleted: number }>(`/api/meal?date=${selectedDate}`, {
        method: "DELETE",
      });
    } catch (error) {
      if (!isApiNotFound(error)) {
        setMealResetError("식단 기록을 초기화하지 못했어요.");
        setIsResettingMeals(false);
        return;
      }
    }

    const clearedLocalDay = clearLocalMeals(selectedDate);
    setDayRecord((current) => ({
      ...(current ?? clearedLocalDay),
      date: selectedDate,
      meals: clearedLocalDay.meals,
    }));
    setMealResetVersion((current) => current + 1);
    setMealResetStatus("식단 기록을 초기화했습니다.");
    setIsResettingMeals(false);
  }

  function shiftDate(days: number) {
    const current = new Date(`${selectedDate}T12:00:00`);
    current.setDate(current.getDate() + days);
    const nextDate = formatLocalDate(current);
    selectDate(isFutureLocalDate(nextDate) ? todayDate : nextDate);
  }

  const dateTitle = new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date(`${selectedDate}T12:00:00`));
  const isViewingToday = selectedDate === todayDate;
  const hasSavedMeals = Boolean(
    dayRecord && Object.values(dayRecord.meals).some((meal) => meal !== null),
  );

  useEffect(() => {
    let cancelled = false;
    fetchApi<DayRecord>(`/api/day?date=${selectedDate}`)
      .then((record) => {
        if (!cancelled) {
          setDayRecord(record);
          setWeightInput(record.weight ? String(record.weight.weight) : "");
          setWeightError(null);
          setWeightSaveError(null);
          setWeightStatus("");
          setIsWeightLocked(Boolean(record.weight));
          setIsLoadingDay(false);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          const localDay = isApiNotFound(error) ? readLocalDay(selectedDate) : null;
          setDayRecord(localDay);
          setWeightInput(localDay?.weight ? String(localDay.weight.weight) : "");
          setWeightError(null);
          setWeightSaveError(null);
          setWeightStatus("");
          setIsWeightLocked(Boolean(localDay?.weight));
          setIsLoadingDay(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  return (
    <main className={styles.main}>
      <header className={styles.siteHeader}>
        <Link className={styles.brand} href="/" aria-label="오늘도 가볍게 홈">
          <Image
            className={styles.brandMark}
            src="/broccoli-logo.png"
            alt=""
            width={32}
            height={32}
            priority
          />
          <span>오늘도 가볍게</span>
        </Link>
        <TabNav />
      </header>
      <section className={styles.header}>
        <h1>{dateTitle}</h1>
        <p>식단과 체중을 기록해 오늘을 완성하세요.</p>
        <div className={styles.dateControls} aria-label="날짜 이동">
          <button type="button" aria-label="이전 날짜" onClick={() => shiftDate(-1)}>
            ‹
          </button>
          <label className={styles.datePicker}>
            <CalendarIcon />
            <span className={styles.srOnly}>날짜 선택</span>
            <input
              aria-label="기록 날짜 선택"
              max={todayDate}
              type="date"
              value={selectedDate}
              onChange={(event) => selectDate(event.target.value)}
            />
          </label>
          <button
            type="button"
            aria-label="다음 날짜"
            disabled={selectedDate >= todayDate}
            onClick={() => shiftDate(1)}
          >
            ›
          </button>
        </div>
      </section>
      <section
        className={styles.weightCard}
        aria-busy={isLoadingDay || isSavingWeight}
        aria-labelledby="weight-title"
      >
        <div>
          <p className={styles.eyebrow}>오늘의 체중</p>
          <h2 id="weight-title">몸무게를 기록해 보세요</h2>
          <p className={styles.cardHint}>날짜별로 저장하고 언제든 수정할 수 있어요.</p>
        </div>
        <div className={styles.weightControl}>
          <div className={styles.weightInputRow}>
            <input
              aria-describedby={
                weightError || weightSaveError ? "weight-error weight-status" : "weight-status"
              }
              aria-invalid={Boolean(weightError || weightSaveError)}
              aria-label="오늘의 체중"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              type="text"
              placeholder="60.5"
              value={weightInput}
              disabled={isWeightLocked}
              onChange={(event) => updateWeightInput(event.target.value)}
            />
            <span>kg</span>
            <button
              aria-label={`오늘의 체중 ${isWeightLocked ? "수정" : "저장"}`}
              type="button"
              disabled={isSavingWeight}
              onClick={isWeightLocked ? unlockWeightInput : saveWeight}
            >
              {isSavingWeight ? "저장 중..." : isWeightLocked ? "수정" : "저장"}
            </button>
          </div>
          {weightError || weightSaveError ? (
            <p className={styles.inputError} id="weight-error" role="alert">
              {weightError ?? weightSaveError}
            </p>
          ) : null}
          <p className={styles.srOnly} id="weight-status" role="status" aria-live="polite">
            {weightStatus}
          </p>
        </div>
      </section>
      <section
        className={styles.mealGrid}
        aria-busy={isLoadingDay || isResettingMeals}
        aria-label="오늘의 식단"
      >
        {meals.map((meal) => (
          <MealCard
            key={`${selectedDate}-${meal.meal}-${isLoadingDay}-${mealResetVersion}-${mealVersions[meal.meal]}`}
            {...meal}
            isLoading={isLoadingDay}
            onDelete={deleteMeal}
            onSave={saveMeal}
            record={dayRecord?.meals[meal.meal] ?? null}
          />
        ))}
      </section>
      {!isViewingToday ? (
        <div className={styles.todayFooter}>
          <button
            aria-label="오늘 날짜로 돌아가기"
            type="button"
            onClick={() => selectDate(todayDate)}
          >
            오늘로 돌아가기 <span aria-hidden="true">›</span>
          </button>
        </div>
      ) : null}
      <div className={styles.mealResetRow}>
        {mealResetError ? (
          <p aria-live="polite" className={styles.mealResetError}>
            {mealResetError}
          </p>
        ) : null}
        <button
          aria-label={`${dateTitle} 식단 초기화`}
          type="button"
          disabled={isLoadingDay || isResettingMeals || !hasSavedMeals}
          onClick={resetMeals}
        >
          {isResettingMeals ? "초기화 중..." : "식단 초기화"}
        </button>
        {mealResetStatus ? (
          <p className={styles.srOnly} role="status" aria-live="polite">
            {mealResetStatus}
          </p>
        ) : null}
      </div>
    </main>
  );
}
