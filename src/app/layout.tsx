import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClientLayout } from "@/components/layout/ClientLayout";
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
  title: "Nico — Gestão de Esteiras WhatsApp",
  description: "Gestão de esteiras de disparo WhatsApp — do D1 ao D7, tudo sob controle.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
