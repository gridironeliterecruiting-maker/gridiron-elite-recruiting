'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getPartner } from '@/lib/partners'
import { setPromoCookie, getPromoCookie } from '@/lib/promo-cookie'
import { OVERLAY_ENABLED } from '@/lib/feature-flags'

const YOUTUBE_VIDEO_ID = '' // Set this when video is uploaded

const SESSION_KEY = 'rr-overlay-dismissed'

export function VideoOverlay() {
  const searchParams = useSearchParams()
  const [visible, setVisible] = useState(false)
  const [promoCode, setPromoCode] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const [isMuted, setIsMuted] = useState(true)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Always set the promo cookie from ?partner= even when overlay is disabled
  useEffect(() => {
    const partnerSlug = searchParams.get('partner')
    if (partnerSlug) {
      const partner = getPartner(partnerSlug)
      if (partner) {
        setPromoCookie(partner.code)
        setPromoCode(partner.code)
      }
    } else {
      const existing = getPromoCookie()
      if (existing) setPromoCode(existing)
    }

    if (!OVERLAY_ENABLED) return

    // Check if already dismissed this session
    if (sessionStorage.getItem(SESSION_KEY)) return

    // Show overlay
    setVisible(true)
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = ''
    }
  }, [searchParams])

  const close = useCallback(() => {
    setVisible(false)
    sessionStorage.setItem(SESSION_KEY, '1')
    document.body.style.overflow = ''
  }, [])

  // Escape key
  useEffect(() => {
    if (!visible) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [visible, close])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) close()
  }

  const toggleMute = () => {
    const iframe = iframeRef.current
    if (iframe?.contentWindow) {
      const func = isMuted ? 'unMute' : 'mute'
      iframe.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func, args: [] }),
        '*'
      )
    }
    setIsMuted(!isMuted)
  }

  // Public method to re-open overlay (called from nav "Watch Demo")
  useEffect(() => {
    const handler = () => {
      sessionStorage.removeItem(SESSION_KEY)
      setVisible(true)
      document.body.style.overflow = 'hidden'
    }
    window.addEventListener('rr-open-overlay', handler)
    return () => window.removeEventListener('rr-open-overlay', handler)
  }, [])

  const ctaHref = promoCode ? `/register?promo=${promoCode}` : '/register'

  if (!visible) return null

  return (
    <div
      ref={overlayRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[9999] flex items-center justify-center px-5 py-6 animate-in fade-in duration-300"
      style={{
        background: 'rgba(4, 8, 15, 0.84)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
      }}
    >
      <div className="relative w-full max-w-[740px] flex flex-col items-center">
        {/* Close button */}
        <button
          onClick={close}
          aria-label="Close"
          className="absolute -top-5 -right-5 z-10 flex h-11 w-11 items-center justify-center rounded-full text-lg text-white/80 transition hover:scale-110 hover:border-white/55 active:scale-95 max-sm:-right-2 max-sm:-top-3.5 max-sm:h-[38px] max-sm:w-[38px] max-sm:text-base"
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1.5px solid rgba(255,255,255,0.28)',
          }}
        >
          ✕
        </button>

        {/* Top headline */}
        <h2 className="mb-3.5 text-center font-display text-xl font-black uppercase tracking-widest text-white sm:text-2xl md:text-3xl">
          The Recruiting Game{' '}
          <span style={{ color: '#d93025' }}>Starts Here</span>
        </h2>

        {/* Video frame */}
        <div
          className="relative w-full overflow-hidden"
          style={{
            paddingBottom: '56.25%',
            background: '#060e1e',
            border: '1px solid rgba(200,32,47,0.28)',
          }}
        >
          {/* Red corner accents */}
          <div
            className="absolute left-0 top-0 z-[3] h-4 w-4 pointer-events-none"
            style={{ borderTop: '2px solid #C8202F', borderLeft: '2px solid #C8202F' }}
          />
          <div
            className="absolute bottom-0 right-0 z-[3] h-4 w-4 pointer-events-none"
            style={{ borderBottom: '2px solid #C8202F', borderRight: '2px solid #C8202F' }}
          />

          {YOUTUBE_VIDEO_ID ? (
            <>
              <iframe
                ref={iframeRef}
                id="rr-yt-player"
                className="absolute inset-0 h-full w-full border-none"
                src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&mute=1&controls=1&rel=0&modestbranding=1&cc_load_policy=1&enablejsapi=1`}
                allow="autoplay; encrypted-media"
                allowFullScreen
              />
              <button
                onClick={toggleMute}
                className="absolute bottom-2.5 left-2.5 z-10 flex items-center gap-1.5 px-2.5 py-1 text-[11px] tracking-wide text-white/70 transition hover:bg-[rgba(4,8,15,0.9)]"
                style={{
                  background: 'rgba(4,8,15,0.7)',
                  border: '1px solid rgba(255,255,255,0.16)',
                }}
              >
                {isMuted ? '🔇 Tap to unmute' : '🔊 Mute'}
              </button>
            </>
          ) : (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center"
              style={{ background: 'linear-gradient(140deg, #080f20 0%, #0d1a35 100%)' }}
            >
              <div className="mb-2.5 flex h-14 w-14 items-center justify-center rounded-full bg-[#C8202F]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              </div>
              <div className="font-display text-xs font-bold uppercase tracking-widest text-white/40">
                Demo video coming soon
              </div>
            </div>
          )}
        </div>

        {/* Bottom section */}
        <div className="mt-4 flex w-full flex-col items-center gap-3.5 max-sm:gap-2.5">
          {/* Bottom headline */}
          <h3 className="text-center font-display text-4xl font-black uppercase tracking-tight text-white sm:text-5xl md:text-6xl" style={{ lineHeight: '0.92' }}>
            Build Your <span style={{ color: '#d93025' }}>Runway</span>
          </h3>

          {/* Promo code banner — ONLY difference in partner mode */}
          {promoCode && (
            <div
              className="flex w-full flex-wrap items-center justify-center gap-3 px-5 py-2.5"
              style={{
                background: 'rgba(212,169,42,0.07)',
                border: '1px solid rgba(212,169,42,0.28)',
              }}
            >
              <span className="text-[11px] uppercase tracking-wider text-white/35">
                Your exclusive code:
              </span>
              <span
                className="font-display text-lg font-black tracking-widest"
                style={{
                  color: '#D4A92A',
                  background: 'rgba(212,169,42,0.1)',
                  border: '1px dashed rgba(212,169,42,0.45)',
                  padding: '3px 14px',
                }}
              >
                {promoCode}
              </span>
              <span className="text-[11px] text-white/28">
                Applied automatically at checkout
              </span>
            </div>
          )}

          {/* Button row */}
          <div className="flex flex-wrap items-center justify-center gap-3.5 max-sm:flex-col max-sm:gap-2.5">
            <button
              onClick={close}
              className="rounded-lg border border-white/20 px-6 py-3 font-display text-sm font-bold uppercase tracking-wider text-white/80 transition hover:-translate-y-0.5 hover:border-white/50 hover:bg-white/5"
            >
              Learn More ↓
            </button>
            <Link
              href={ctaHref}
              className="rounded-lg px-6 py-3 font-display text-sm font-bold uppercase tracking-wider text-white transition hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(135deg, #d93025 0%, #9a1010 100%)',
                boxShadow: '0 4px 20px rgba(200,32,47,0.4)',
              }}
            >
              Get Started — $50/mo
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
