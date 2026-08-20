"use client";

import { useEffect, useState } from "react";

import styles from "../app/page.module.css";
import { fetchApi } from "../services/apiClient";
import type { DietStats } from "../types/api";
import { buildDailyBars, donutDash, donutLabel } from "./statsChart";

const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * Statistics are never computed in the browser, even as a fallback. The server
 * owns the counting rule, so a failed request shows an error rather than a
 * second implementation that could quietly disagree with it.
 */
type LoadState =
  { status: "loading" } | { status: "ready"; stats: DietStats } | { status: "failed" };

function formatRange(range: DietStats["range"]): string {
  const label = (value: string) => {
    const [, month, day] = value.split("-");
    return `${Number(month)}월 ${Number(day)}일`;
  };
  return `${label(range.start)} ~ ${label(range.end)}`;
}

export function StatsView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchApi<DietStats>("/api/stats")
      .then((stats) => {
        if (!cancelled) setState({ status: "ready", stats });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "failed" });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <section className={styles.statsSection} aria-busy="true" aria-labelledby="stats-title">
        <p className={styles.statsEyebrow}>최근 7일</p>
        <h1 id="stats-title">식단 통계</h1>
        <p className={styles.statsMessage} role="status" aria-live="polite">
          통계를 불러오고 있습니다...
        </p>
      </section>
    );
  }

  if (state.status === "failed") {
    return (
      <section className={styles.statsSection} aria-labelledby="stats-title">
        <p className={styles.statsEyebrow}>최근 7일</p>
        <h1 id="stats-title">식단 통계</h1>
        <p className={styles.statsError} role="alert">
          식단 기록을 불러오지 못했습니다.
          <br />
          잠시 후 다시 시도해주세요.
        </p>
      </section>
    );
  }

  const { stats } = state;
  const cards = [
    { key: "total", label: "총 기록", value: `${stats.total}회`, hint: "저장한 끼니 수" },
    { key: "clean", label: "클린식", value: `${stats.clean}회`, hint: "가볍게 먹은 끼니" },
    { key: "free", label: "자유식", value: `${stats.free}회`, hint: "자유롭게 먹은 끼니" },
    {
      key: "ratio",
      label: "클린식 비율",
      value: `${stats.cleanRatio}%`,
      hint: `기록한 날 ${stats.recordedDays}일 / ${stats.range.days}일`,
    },
  ];

  return (
    <section className={styles.statsSection} aria-labelledby="stats-title">
      <p className={styles.statsEyebrow}>최근 7일</p>
      <h1 id="stats-title">식단 통계</h1>
      <p className={styles.statsRange}>{formatRange(stats.range)}</p>

      {stats.total === 0 ? (
        <p className={styles.statsMessage}>
          아직 통계를 만들기 위한 기록이 부족합니다.
          <br />
          식단을 조금 더 기록해보세요.
        </p>
      ) : (
        <>
          <dl className={styles.statsGrid}>
            {cards.map((card) => (
              <div
                className={`${styles.statCard} ${card.key === "free" ? styles.freeStatCard : ""}`}
                key={card.key}
              >
                <dt>{card.label}</dt>
                <dd>{card.value}</dd>
                <p>{card.hint}</p>
              </div>
            ))}
          </dl>
          <div className={styles.chartRow}>
            <figure className={styles.donutCard}>
              <figcaption>클린식 / 자유식 비율</figcaption>
              <div className={styles.donutWrap}>
                <svg
                  className={styles.donut}
                  viewBox="0 0 120 120"
                  role="img"
                  aria-label={donutLabel(stats.clean, stats.free, stats.cleanRatio)}
                >
                  <circle className={styles.donutTrack} cx="60" cy="60" r={RING_RADIUS} />
                  <circle
                    className={styles.donutValue}
                    cx="60"
                    cy="60"
                    r={RING_RADIUS}
                    strokeDasharray={donutDash(stats.cleanRatio, RING_CIRCUMFERENCE).join(" ")}
                    transform="rotate(-90 60 60)"
                  />
                </svg>
                <p className={styles.donutCenter}>
                  <strong>{stats.cleanRatio}%</strong>
                  <span>클린식</span>
                </p>
              </div>
              <ul className={styles.chartLegend}>
                <li>
                  <i className={styles.cleanSwatch} aria-hidden="true" />
                  클린식 {stats.clean}회
                </li>
                <li>
                  <i className={styles.freeSwatch} aria-hidden="true" />
                  자유식 {stats.free}회
                </li>
              </ul>
            </figure>

            <figure className={styles.barCard}>
              <figcaption>날짜별 기록</figcaption>
              <ol className={styles.barChart}>
                {buildDailyBars(stats.daily).map((bar) => (
                  <li key={bar.date}>
                    <div
                      className={styles.barTrack}
                      role="img"
                      aria-label={`${bar.label}일 클린식 ${bar.clean}회, 자유식 ${bar.free}회`}
                    >
                      <span
                        className={styles.barFree}
                        style={{ height: `${bar.freeHeight * 100}%` }}
                      />
                      <span
                        className={styles.barClean}
                        style={{ height: `${bar.cleanHeight * 100}%` }}
                      />
                    </div>
                    <span className={styles.barLabel}>{bar.label}</span>
                  </li>
                ))}
              </ol>
              <p className={styles.barHint}>막대가 없는 날은 기록하지 않은 날입니다.</p>
            </figure>
          </div>

          <p className={styles.statsFootnote}>
            {stats.range.days}일 중 {stats.recordedDays}일을 기록했습니다. 기록하지 않은 끼니는
            집계에 들어가지 않습니다.
          </p>
        </>
      )}
    </section>
  );
}
