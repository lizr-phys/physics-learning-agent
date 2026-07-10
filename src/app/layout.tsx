import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "Physics Learning Agent",
  title: {
    default: "Physics Learning Agent",
    template: "%s | Physics Learning Agent",
  },
  description:
    "A LangGraph-orchestrated workspace for undergraduate physics, combining bilingual tutoring, original practice generation, and private document-grounded retrieval.",
  keywords: [
    "undergraduate physics",
    "physics learning",
    "LangGraph",
    "RAG",
    "practice problems",
    "knowledge base",
  ],
  openGraph: {
    title: "Physics Learning Agent",
    description:
      "Bilingual physics tutoring, original practice generation, and private document-grounded retrieval in a focused learning workspace.",
    type: "website",
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
      <body className="min-h-full bg-white text-zinc-950">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
