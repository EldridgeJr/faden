import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import { themeClass } from "@/lib/theme";
import { getTheme } from "@/lib/theme-server";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Faden",
  description: "Fragen an deine Quellen – mit Belegen, die zur Textstelle springen.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The class comes from the cookie, so the first HTML already has the
  // right colors. Without a cookie ("system") CSS follows the OS setting.
  const theme = await getTheme();

  return (
    <html
      lang="de"
      className={cn(geistSans.variable, geistMono.variable, "h-full antialiased", themeClass(theme))}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
