import React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, Oswald } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const oswald = Oswald({ subsets: ["latin"], variable: "--font-oswald" })

export const metadata: Metadata = {
  title: "Runway Elite Prep",
  description: "The athlete development platform for 6th–8th grade student-athletes — exposure, training, and academics in one place.",
}

export const viewport: Viewport = {
  themeColor: "#1a3a6e",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${oswald.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  )
}
