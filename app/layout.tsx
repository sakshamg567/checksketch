import type { Metadata } from 'next'
import './globals.css'
import { Analytics } from "@vercel/analytics/next"

export const metadata: Metadata = {
  title: 'CheckSketch',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <meta property="og:image" content="https://checksketch.vercel.app/og.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://checksketch.vercel.app/og.png" />
        <meta property="twitter:title" content="CheckSketch" />
        <meta property="og:site_name" content="CheckSketch" />
      </head>
      <Analytics />
      <body>{children}</body>
    </html>
  )
}
