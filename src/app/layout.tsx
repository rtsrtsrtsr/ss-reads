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

export const metadata: Metadata = {
  title: "SS-Reads",
  description: "Internal bookshelf + book club reviews from Sourcing Sprints",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen text-slate-100">
        {/* Background layer */}
        <div className="fixed inset-0 -z-10 bg-gradient-to-b from-slate-950 via-slate-950 to-black" />
        {/* Subtle vignette / glow */}
        <div className="fixed inset-0 -z-10 opacity-60 [background:radial-gradient(ellipse_at_top,rgba(34,211,238,0.08),transparent_55%)]" />

        {children}
      </body>
    </html>
  );
}