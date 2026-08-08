import type { ReactNode } from 'react'

export const metadata = {
  title: 'Lab10 — Reel Script Generation',
  description: 'Generate recordable reel scripts from North Star Accounts.',
}

// Next throws at runtime unless the root layout renders <html> and <body>.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
