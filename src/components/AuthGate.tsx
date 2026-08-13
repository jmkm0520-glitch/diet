"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { ApiClientError, fetchApi } from "../services/apiClient";
import type { Member } from "../types/auth";
import styles from "./AuthGate.module.css";

type Mode = "login" | "signup" | "verify";

export function AuthGate({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<Member | null>(null);
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [status, setStatus] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sideMenuRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const savedPendingEmail = window.sessionStorage.getItem("pendingSignupEmail") ?? "";
    const pendingStateTimer = window.setTimeout(() => {
      if (savedPendingEmail) {
        setPendingEmail(savedPendingEmail);
        setMode("verify");
      }
    }, 0);
    fetchApi<Member>("/api/authentication?action=session").then((authenticated) => {
      setMember(authenticated);
    }).catch(() => undefined).finally(() => {
      setLoading(false);
    });
    return () => window.clearTimeout(pendingStateTimer);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const focusTimer = window.setTimeout(() => sideMenuRef.current?.focus(), 0);
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsMenuOpen(false);
      window.setTimeout(() => menuButtonRef.current?.focus(), 0);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isMenuOpen]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? pendingEmail);
    const payload: Record<string, string> = { email };
    if (mode === "verify") {
      payload.token = String(form.get("token") ?? "");
    } else {
      payload.password = String(form.get("password") ?? "");
      if (mode === "signup") payload.display_name = String(form.get("displayName") ?? "");
    }
    try {
      if (mode === "signup") {
        await fetchApi<{ email: string; verificationRequired: boolean }>(
          "/api/authentication?action=signup",
          {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          },
        );
        setPendingEmail(email);
        window.sessionStorage.setItem("pendingSignupEmail", email);
        setMode("verify");
        setStatus("인증 메일을 보냈습니다. 이메일의 6자리 인증번호를 입력해 주세요.");
        return;
      }
      const endpoint = mode === "verify" ? "verify_email" : "login";
      const authenticated = await fetchApi<Member>(`/api/authentication?action=${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setMember(authenticated);
      window.sessionStorage.removeItem("pendingSignupEmail");
    } catch (caught) {
      setError(
        caught instanceof ApiClientError ? caught.message : "요청을 처리하지 못했습니다. 다시 시도해 주세요.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function resendVerification() {
    if (!pendingEmail) {
      setError("먼저 가입에 사용한 이메일을 입력해 주세요.");
      return;
    }
    setError("");
    try {
      await fetchApi<{ sent: boolean }>("/api/authentication?action=resend_verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail }),
      });
      setStatus("인증 메일을 다시 보냈습니다.");
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : "인증 메일을 보내지 못했습니다.");
    }
  }

  async function logout() {
    await fetchApi<{ loggedOut: boolean }>("/api/authentication?action=logout", {
      method: "POST",
    });
    setMember(null);
    setMode("login");
    setIsMenuOpen(false);
  }

  function closeMenu() {
    setIsMenuOpen(false);
    window.setTimeout(() => menuButtonRef.current?.focus(), 0);
  }

  if (loading) return <main className={styles.center}>로그인 상태를 확인하고 있어요.</main>;

  if (!member) {
    return (
      <main className={styles.center}>
        <section className={styles.card} aria-labelledby="auth-title">
          <span className={styles.eyebrow}>오늘도 가볍게</span>
          <h1 id="auth-title">
            {mode === "signup" ? "첫 회원 만들기" : mode === "verify" ? "이메일 인증" : "로그인"}
          </h1>
          <p>
            {mode === "signup"
              ? "이메일 인증을 완료하면 나만의 식단과 체중 기록을 시작할 수 있습니다."
              : mode === "verify"
                ? "가입한 이메일로 보낸 인증번호를 입력해 주세요."
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
              <input name="email" type="email" required autoComplete="email" value={mode === "verify" ? pendingEmail : undefined} onChange={mode === "verify" ? (event) => setPendingEmail(event.target.value) : undefined} />
            </label>
            {mode === "verify" ? (
              <label>
                6자리 인증번호
                <input name="token" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" />
              </label>
            ) : (
              <label>
                비밀번호
                <input name="password" type="password" minLength={8} maxLength={128} required autoComplete={mode === "signup" ? "new-password" : "current-password"} />
              </label>
            )}
            {status && <p className={styles.status} role="status">{status}</p>}
            {error && <p className={styles.error} role="alert">{error}</p>}
            <button type="submit" disabled={submitting}>
              {submitting ? "처리 중…" : mode === "signup" ? "인증 메일 받기" : mode === "verify" ? "인증하고 가입 완료" : "로그인"}
            </button>
          </form>
          {mode === "verify" && (
            <button className={styles.switch} type="button" onClick={resendVerification}>
              인증 메일 다시 보내기
            </button>
          )}
          {mode !== "verify" && (
            <button className={styles.switch} type="button" onClick={() => setMode(mode === "signup" ? "login" : "signup")}>
              {mode === "signup" ? "이미 계정이 있나요? 로그인" : "계정이 없나요? 회원가입"}
            </button>
          )}
          {mode === "verify" && (
            <button className={styles.switch} type="button" onClick={() => setMode("login")}>
              로그인으로 돌아가기
            </button>
          )}
        </section>
      </main>
    );
  }

  return (
    <>
      <button
        aria-controls="account-side-menu"
        aria-expanded={isMenuOpen}
        aria-label="메뉴 열기"
        className={styles.menuButton}
        ref={menuButtonRef}
        type="button"
        onClick={() => setIsMenuOpen(true)}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>
      {isMenuOpen ? (
        <>
          <button
            aria-label="메뉴 닫기"
            className={styles.menuBackdrop}
            type="button"
            onClick={closeMenu}
          />
          <aside
            aria-label="사용자 메뉴"
            aria-modal="true"
            className={styles.sideMenu}
            id="account-side-menu"
            ref={sideMenuRef}
            role="dialog"
            tabIndex={-1}
          >
            <div className={styles.sideMenuHeader}>
              <div>
                <span>로그인 계정</span>
                <strong>{member.displayName}님</strong>
              </div>
              <button aria-label="메뉴 닫기" type="button" onClick={closeMenu}>
                ×
              </button>
            </div>
            <nav aria-label="추가 메뉴" className={styles.sideMenuNav}>
              <Link href="/import" onClick={() => setIsMenuOpen(false)}>
                <span aria-hidden="true">⇧</span>
                <span>
                  <strong>가져오기</strong>
                  <small>CSV 기록 불러오기</small>
                </span>
                <b aria-hidden="true">›</b>
              </Link>
            </nav>
            <button className={styles.logoutButton} type="button" onClick={logout}>
              로그아웃
            </button>
          </aside>
        </>
      ) : null}
      {children}
    </>
  );
}
