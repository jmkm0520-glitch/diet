"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MouseEvent } from "react";
import styles from "../app/page.module.css";

const tabs = [
  { id: "today", label: "오늘 기록", href: "/" },
  { id: "calendar", label: "캘린더", href: "/calendar" },
] as const;

export function TabNav() {
  const pathname = usePathname();
  const router = useRouter();
  const activeTab = pathname === "/calendar" ? "calendar" : pathname === "/" ? "today" : null;

  function preserveSelectedDate(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (typeof window === "undefined" || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const date = new URLSearchParams(window.location.search).get("date");
    if (!date) return;

    event.preventDefault();
    router.push(`${href}?date=${date}`);
  }

  return (
    <nav className={styles.tabNav} aria-label="화면 전환">
      {tabs.map((tab) => (
        <Link
          aria-current={activeTab === tab.id ? "page" : undefined}
          className={`${styles.tab} ${activeTab === tab.id ? styles.activeTab : ""}`}
          href={tab.href}
          key={tab.id}
          onClick={(event) => preserveSelectedDate(event, tab.href)}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
