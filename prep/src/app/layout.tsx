import React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, Oswald } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const oswald = Oswald({ subsets: ["latin"], variable: "--font-oswald" })

export const metadata: Metadata = {
  title: "Runway Prep",
  description: "Your athletic development command center — build your brand, track camps, and get exposure.",
  icons: { icon: "/logo.png", apple: "/logo.png" },
}

export const viewport: Viewport = {
  themeColor: "#cc2222",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${oswald.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  )
}
