import type { ReactNode } from "react";

export const metadata = {
  title: "Mis finanzas",
  description: "Registro de gastos personales",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
