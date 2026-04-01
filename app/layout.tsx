import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// export const metadata: Metadata = {
//   title: 'Money',
//   description: 'Brandon 자산 관리',
//   icons: {
//     icon: '/favicon.ico', // 기본 브라우저 탭 아이콘
//     apple: '/touch-icon.png', // [중요] 삼성브라우저/아이폰 홈 화면 아이콘
//   },
// };

export const metadata: Metadata = {
  title: "Money",
  description: "Brandon 자산 관리",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/touch-icon.png",
  },
  // 안드로이드 및 기타 모바일 기기를 위한 설정
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Money",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/touch-icon.png" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
