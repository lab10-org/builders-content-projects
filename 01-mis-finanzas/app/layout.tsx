import type { ReactNode } from "react";
import { Geist, Geist_Mono, Inter } from "next/font/google";

import "./globals.css";

// The three families the mockup uses: Geist for headings, Inter for body copy,
// Geist Mono for the stepper's step numbers.
const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Mis finanzas",
  description: "Registro de gastos personales",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // The font variables go on <html>, not <body>: globals.css resolves them
    // from :root inside `@theme`, and a variable set on <body> would not be
    // visible there.
    <html
      lang="es"
      className={`h-full ${geist.variable} ${inter.variable} ${geistMono.variable}`}
    >
      <body className="h-full bg-bg font-body text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
