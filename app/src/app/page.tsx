import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { HeroBackground } from '@/components/landing/hero-background'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Runway Recruit — The Recruiting Game Starts Here',
  description:
    'Maximize your exposure. Reach coaches. Get offers. Runway Recruit gives high school football athletes the tools to compete in the recruiting game.',
}

export default async function HomePage() {
  const cookieStore = await cookies()
  const siteSession = cookieStore.get('site_session')?.value

  if (siteSession === 'main') {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#04080f] text-white">

      {/* ── NAV ─────────────────────────────────────────────────────── */}
      <nav className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="relative h-9 w-9">
            <Image src="/logo.png" alt="Runway Recruit" fill className="object-contain" priority />
          </div>
          <span className="font-display text-base font-bold uppercase tracking-wider text-white">
            Runway Recruit
          </span>
        </div>
        <Link
          href="/login"
          className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/50 hover:text-white"
        >
          Log In
        </Link>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative flex min-h-screen items-center justify-center px-6 text-center">
        <HeroBackground />

        <div className="relative z-10 mx-auto max-w-4xl">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <div className="relative h-36 w-36 drop-shadow-2xl">
              <Image src="/logo.png" alt="Runway Recruit" fill className="object-contain" priority />
            </div>
          </div>

          {/* Eyebrow */}
          <p
            className="mb-4 font-display text-sm font-bold uppercase tracking-[0.3em]"
            style={{ color: '#d93025' }}
          >
            Runway Recruit · Football
          </p>

          {/* Headline */}
          <h1 className="mb-6 font-display text-5xl font-black uppercase leading-none tracking-tight md:text-7xl">
            The Recruiting Game<br />
            <span style={{ color: '#d93025' }}>Starts Here</span>
          </h1>

          {/* Subhead */}
          <p className="mx-auto mb-10 max-w-2xl text-xl leading-relaxed text-white/80 md:text-2xl">
            You compete on the field and in the classroom.{' '}
            <strong className="text-white">It&apos;s time to compete for exposure.</strong>{' '}
            Runway Recruit gives you every tool you need to reach coaches, find the right programs, and get offers.
          </p>

          {/* CTAs */}
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/login?mode=register"
              className="rounded-lg px-10 py-4 font-display text-lg font-bold uppercase tracking-wider text-white transition-all hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(135deg, #d93025 0%, #9a1010 100%)',
                boxShadow: '0 4px 24px rgba(200,32,47,0.45)',
              }}
            >
              Get Started — $50/mo
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-white/25 px-8 py-4 font-semibold text-white transition hover:border-white/60"
            >
              Log In
            </Link>
          </div>

          <p className="mt-4 text-sm text-white/35">
            $450/year — save 25% &nbsp;·&nbsp; Cancel anytime
          </p>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-white/25">
          <span className="text-[10px] uppercase tracking-widest">Scroll</span>
          <div className="h-8 w-px bg-white/20" />
        </div>
      </section>

      {/* ── THREE PILLARS ────────────────────────────────────────────── */}
      <section className="bg-white px-6 py-24 text-[#0a1525]">
        <div className="mx-auto max-w-5xl">
          <p
            className="mb-3 text-center font-display text-sm font-bold uppercase tracking-widest"
            style={{ color: '#d93025' }}
          >
            The Formula
          </p>
          <h2 className="mb-4 text-center font-display text-4xl font-black uppercase tracking-tight md:text-5xl">
            Three Things Get You a Scholarship
          </h2>
          <p className="mx-auto mb-16 max-w-xl text-center text-lg text-gray-500">
            Most families are on their own for the first two. We own the third — and help you connect all three.
          </p>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <PillarCard
              number="01"
              title="Athletic Ability"
              description="You need to be a player. That takes elite coaching, relentless training, and maximum dedication. The grind on the field is yours — we respect it."
              ours={false}
            />
            <PillarCard
              number="02"
              title="Academic Accomplishments"
              description="GPA and eligibility expand your options and are a core part of what coaches evaluate. The classroom matters as much as the field."
              ours={false}
            />
            <PillarCard
              number="03"
              title="Exposure"
              description="This is where we live. Reaching coaches, running your outreach, and building your recruiting presence — this is Runway Recruit's entire job."
              ours={true}
            />
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────── */}
      <section
        className="relative px-6 py-24"
        style={{
          backgroundImage: 'url(/hero-bg-2.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0" style={{ background: 'rgba(4,8,15,0.82)' }} aria-hidden />
        <div className="relative z-10 mx-auto max-w-5xl">
          <p
            className="mb-3 text-center font-display text-sm font-bold uppercase tracking-widest"
            style={{ color: '#d93025' }}
          >
            What&apos;s Inside
          </p>
          <h2 className="mb-4 text-center font-display text-4xl font-black uppercase tracking-tight text-white md:text-5xl">
            Your Complete Recruiting System
          </h2>
          <p className="mx-auto mb-16 max-w-xl text-center text-lg text-white/50">
            Everything you need to reach coaches, track programs, and manage your recruiting from one place.
          </p>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon="🎯"
              title="Coach Database"
              description="Search 3,000+ coaches across every level — FBS, FCS, D2, D3, NAIA, and JUCO. Filter by division, conference, and school. Find the right coaches for your profile."
            />
            <FeatureCard
              icon="✉️"
              title="Email Campaigns"
              description="Send personalized outreach to coaches at scale. Your name, position, GPA, and Hudl link automatically merge into every message. Coaches get emails that feel personal — because they are."
            />
            <FeatureCard
              icon="𝕏"
              title="X (Twitter) DMs"
              description="Reach coaches directly in their DMs on X. Build your campaign, personalize every message, and send — all from one queue. Connect your X account for one-click sending."
            />
            <FeatureCard
              icon="📋"
              title="Recruiting Pipeline"
              description="Track every program through five stages: Contact, Film Eval, Interest, Visit, Offer. Know exactly where you stand with every school — nothing falls through the cracks."
            />
            <FeatureCard
              icon="🚀"
              title="Recruiting Drive"
              description="A shareable page with everything a coach needs: your measurables, Hudl film, stats, GPA, and contact info. Not a profile page — a recruiting weapon you put in front of coaches."
              wide
            />
          </div>
        </div>
      </section>

      {/* ── PITCH ────────────────────────────────────────────────────── */}
      <section className="bg-white px-6 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2
            className="mb-8 font-display text-3xl font-black uppercase leading-tight tracking-tight md:text-5xl"
            style={{ color: '#0a1525' }}
          >
            "The athletes who get recruited didn&apos;t just train harder.{' '}
            <span style={{ color: '#d93025' }}>They prepared smarter</span> — and they started earlier."
          </h2>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-gray-500">
            You&apos;re already investing in your game and your grades. But the recruiting process
            is its own competition — and most athletes don&apos;t have a system for it. Runway Recruit
            is that system. Reach coaches, track your pipeline, and control your recruiting story
            from day one.
          </p>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────────────── */}
      <section className="bg-[#04080f] px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <p
            className="mb-3 text-center font-display text-sm font-bold uppercase tracking-widest"
            style={{ color: '#d93025' }}
          >
            Pricing
          </p>
          <h2 className="mb-4 text-center font-display text-4xl font-black uppercase tracking-tight text-white md:text-5xl">
            Simple. Everything Included.
          </h2>
          <p className="mx-auto mb-16 max-w-lg text-center text-lg text-white/50">
            No tiers, no add-ons. One price gets you the full system.
          </p>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Monthly */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
              <p className="mb-1 font-display text-sm font-bold uppercase tracking-widest text-white/50">Monthly</p>
              <div className="mb-6 flex items-end gap-2">
                <span className="font-display text-6xl font-black text-white">$50</span>
                <span className="mb-2 text-white/50">/month</span>
              </div>
              <PricingFeatures />
              <Link
                href="/login?mode=register"
                className="mt-8 block rounded-lg border border-white/20 px-6 py-3 text-center font-display font-bold uppercase tracking-wider text-white transition hover:border-white/50 hover:bg-white/5"
              >
                Get Started Monthly
              </Link>
            </div>

            {/* Annual */}
            <div
              className="relative rounded-2xl p-8"
              style={{
                background: 'linear-gradient(135deg, #1a3a6e 0%, #0d2040 100%)',
                boxShadow: '0 0 40px rgba(26,58,110,0.4)',
              }}
            >
              <div
                className="absolute right-4 top-4 rounded-full px-3 py-1 font-display text-xs font-bold uppercase tracking-wider text-white"
                style={{ background: '#d93025' }}
              >
                Save 25%
              </div>
              <p className="mb-1 font-display text-sm font-bold uppercase tracking-widest text-white/60">Annual</p>
              <div className="mb-1 flex items-end gap-2">
                <span className="font-display text-6xl font-black text-white">$450</span>
                <span className="mb-2 text-white/60">/year</span>
              </div>
              <p className="mb-6 text-sm text-white/50">$37.50/month, billed annually</p>
              <PricingFeatures />
              <Link
                href="/login?mode=register"
                className="mt-8 block rounded-lg px-6 py-3 text-center font-display font-bold uppercase tracking-wider text-white transition hover:-translate-y-0.5"
                style={{
                  background: 'linear-gradient(135deg, #d93025 0%, #9a1010 100%)',
                  boxShadow: '0 4px 20px rgba(200,32,47,0.4)',
                }}
              >
                Get Started Annually
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER CTA ───────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden px-6 py-28 text-center"
        style={{
          backgroundImage: 'url(/hero-bg-3.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div
          className="absolute inset-0"
          style={{ background: 'rgba(4,8,15,0.78)' }}
          aria-hidden
        />
        <div className="relative z-10 mx-auto max-w-2xl">
          <div className="mb-6 flex justify-center">
            <div className="relative h-20 w-20 opacity-90">
              <Image src="/logo.png" alt="Runway Recruit" fill className="object-contain" />
            </div>
          </div>
          <h2 className="mb-4 font-display text-4xl font-black uppercase tracking-tight text-white md:text-6xl">
            Ready to <span style={{ color: '#d93025' }}>Take Off?</span>
          </h2>
          <p className="mx-auto mb-10 max-w-md text-lg text-white/55">
            Join athletes who are getting ahead of the recruiting process — before their competition even starts.
          </p>
          <Link
            href="/login?mode=register"
            className="inline-block rounded-lg px-12 py-5 font-display text-xl font-black uppercase tracking-wider text-white transition-all hover:-translate-y-1"
            style={{
              background: 'linear-gradient(135deg, #d93025 0%, #9a1010 100%)',
              boxShadow: '0 4px 32px rgba(200,32,47,0.5)',
            }}
          >
            Get Started
          </Link>
          <p className="mt-4 text-sm text-white/30">$50/month · $450/year · Cancel anytime</p>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 bg-[#020509] px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 text-xs text-white/25 sm:flex-row">
          <span>© 2026 Runway Sports Technologies. All rights reserved.</span>
          <div className="flex gap-6">
            <a href="/privacy" className="hover:text-white/50 transition">Privacy Policy</a>
            <a href="/terms" className="hover:text-white/50 transition">Terms of Service</a>
            <Link href="/login" className="hover:text-white/50 transition">Log In</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function PillarCard({
  number,
  title,
  description,
  ours,
}: {
  number: string
  title: string
  description: string
  ours: boolean
}) {
  return (
    <div
      className={`rounded-2xl p-8 ${
        ours
          ? 'text-white'
          : 'border border-gray-100 bg-gray-50 text-[#0a1525]'
      }`}
      style={
        ours
          ? {
              background: 'linear-gradient(135deg, #1a3a6e 0%, #0d2040 100%)',
              boxShadow: '0 8px 32px rgba(26,58,110,0.25)',
            }
          : undefined
      }
    >
      <div
        className="mb-4 font-display text-4xl font-black tracking-tight"
        style={{ color: ours ? 'rgba(255,255,255,0.2)' : '#e5e7eb' }}
      >
        {number}
      </div>
      <h3
        className="mb-3 font-display text-xl font-black uppercase tracking-tight"
        style={{ color: ours ? '#ffffff' : '#0a1525' }}
      >
        {title}
        {ours && (
          <span
            className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{ background: '#d93025', color: 'white' }}
          >
            That&apos;s Us
          </span>
        )}
      </h3>
      <p
        className="text-sm leading-relaxed"
        style={{ color: ours ? 'rgba(255,255,255,0.65)' : '#6b7280' }}
      >
        {description}
      </p>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
  wide,
}: {
  icon: string
  title: string
  description: string
  wide?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border border-white/8 p-7 transition hover:border-white/15 ${
        wide ? 'md:col-span-2 lg:col-span-2' : ''
      }`}
      style={{ background: 'rgba(255,255,255,0.04)' }}
    >
      <span className="mb-4 block text-3xl">{icon}</span>
      <h3 className="mb-2 font-display text-lg font-bold uppercase tracking-tight text-white">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-white/55">{description}</p>
    </div>
  )
}

function PricingFeatures() {
  const features = [
    'Full coach database — 3,000+ coaches',
    'Email campaigns with merge tags',
    'X (Twitter) DM campaigns',
    'Recruiting pipeline — 5 stages',
    'Shareable Recruiting Drive',
  ]
  return (
    <ul className="space-y-3">
      {features.map((f) => (
        <li key={f} className="flex items-center gap-3 text-sm text-white/75">
          <span style={{ color: '#d93025' }}>✓</span>
          {f}
        </li>
      ))}
    </ul>
  )
}
