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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
		className="bg-gradient-to-b from-slate-950 via-slate-950 to-black text-slate-100 min-h-screen"
      >
        {children}
      </body>
    </html>
  );
}
