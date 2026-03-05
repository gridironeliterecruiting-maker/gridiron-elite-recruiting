'use client'

import Image from 'next/image'

export function HeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {/* Fighter jet image */}
      <Image
        src="/hero-bg.png"
        alt=""
        fill
        className="object-cover object-center"
        priority
        quality={90}
      />

      {/* Dark overlay — keeps text readable */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgba(4,8,15,0.55) 0%, rgba(4,8,15,0.35) 40%, rgba(4,8,15,0.65) 100%)',
        }}
      />

      {/* Extra darkening at top for nav legibility */}
      <div
        className="absolute inset-x-0 top-0 h-32"
        style={{
          background: 'linear-gradient(to bottom, rgba(4,8,15,0.7) 0%, transparent 100%)',
        }}
      />
    </div>
  )
}
