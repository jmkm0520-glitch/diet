"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { ApiClientError, fetchApi } from "../services/apiClient";
import type { Member } from "../types/auth";
import styles from "./AuthGate.module.css";

type Mode = "login" | "signup";

export function AuthGate({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<Member | null>(null);
  const [mode, setMode] = useState<Mode>("login");
  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.allSettled([
      fetchApi<Member>("/api/auth/session"),
      fetchApi<{ canCreate: boolean }>("/api/auth/signup"),
    ]).then(([sessionResult, signupResult]) => {
      if (sessionResult.status === "fulfilled") setMember(sessionResult.value);
      if (signupResult.status === "fulfilled") {
        setCanCreate(signupResult.value.canCreate);
        if (signupResult.value.canCreate) setMode("signup");
      }
      setLoading(false);
    });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload: Record<string, string> = {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    };
    if (mode === "signup") payload.display_name = String(form.get("displayName") ?? "");
    try {
      const authenticated = await fetchApi<Member>(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setMember(authenticated);
      setCanCreate(false);
    } catch (caught) {
      setError(
        caught instanceof ApiClientError ? caught.message : "요청을 처리하지 못했습니다. 다시 시도해 주세요.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function logout() {
    await fetchApi<{ loggedOut: boolean }>("/api/auth/logout", { method: "POST" });
    setMember(null);
    setMode("login");
  }

  if (loading) return <main className={styles.center}>로그인 상태를 확인하고 있어요.</main>;

  if (!member) {
    return (
      <main className={styles.center}>
        <section className={styles.card} aria-labelledby="auth-title">
          <span className={styles.eyebrow}>오늘도 가볍게</span>
          <h1 id="auth-title">{mode === "signup" ? "첫 회원 만들기" : "로그인"}</h1>
          <p>
            {mode === "signup"
              ? "이 서비스는 한 명만 사용합니다. 생성한 계정에 기존 기록이 연결됩니다."
              : "식단과 체중 기록을 보려면 로그인해 주세요."}
          </p>
          <form className={styles.form} onSubmit={submit}>
            {mode === "signup" && (
              <label>
                이름
                <input name="displayName" maxLength={50} required autoComplete="name" />
              </label>
            )}
            <label>
              이메일
              <input name="email" type="email" required autoComplete="email" />
            </label>
            <label>
              비밀번호
              <input name="password" type="password" minLength={8} maxLength={128} required autoComplete={mode === "signup" ? "new-password" : "current-password"} />
            </label>
            {error && <p className={styles.error} role="alert">{error}</p>}
            <button type="submit" disabled={submitting}>
              {submitting ? "처리 중…" : mode === "signup" ? "회원 생성" : "로그인"}
            </button>
          </form>
          {canCreate && (
            <button className={styles.switch} type="button" onClick={() => setMode(mode === "signup" ? "login" : "signup")}>
              {mode === "signup" ? "이미 계정이 있나요? 로그인" : "첫 회원 만들기"}
            </button>
          )}
        </section>
      </main>
    );
  }

  return (
    <>
      <div className={styles.memberBar}>
        <span>{member.displayName}님</span>
        <button type="button" onClick={logout}>로그아웃</button>
      </div>
      {children}
    </>
  );
}
