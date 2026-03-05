'use client'

export function HeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {/* Video — swap in /hero.mp4 when ready */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 h-full w-full object-cover opacity-35"
      >
        <source src="/hero.mp4" type="video/mp4" />
      </video>

      {/* Base dark gradient — visible with or without video */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(160deg, #04080f 0%, #0a1525 40%, #130508 75%, #04080f 100%)',
        }}
      />

      {/* Red glow — bottom center */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 110%, rgba(200,32,47,0.18) 0%, transparent 55%)',
        }}
      />

      {/* Subtle runway lines — center vertical stripe */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[2px] h-3/4 opacity-10"
        style={{
          background:
            'repeating-linear-gradient(to top, white 0px, white 30px, transparent 30px, transparent 60px)',
          maskImage: 'linear-gradient(to top, white 0%, transparent 100%)',
        }}
      />
    </div>
  )
}
