import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "오늘도 가볍게",
  description: "다이어트 식단과 체중을 기록하는 웹사이트",
  icons: {
    icon: [{ url: "/broccoli-logo.png", type: "image/png" }],
    apple: [{ url: "/broccoli-logo.png", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
