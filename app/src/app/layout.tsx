import React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, Oswald } from "next/font/google"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const oswald = Oswald({
  subsets: ["latin"],
  variable: "--font-oswald",
})

export const metadata: Metadata = {
  title: "Runway Recruit",
  description: "Your recruiting command center - track programs, coaches, outreach, and pipeline.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  verification: {
    google: "BQaj2mJF3p7UEXgdpKARMq6eFCdtCXthF9pYyH_3Y30",
  },
}

export const viewport: Viewport = {
  themeColor: "#1a3a6e",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${oswald.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  )
}
