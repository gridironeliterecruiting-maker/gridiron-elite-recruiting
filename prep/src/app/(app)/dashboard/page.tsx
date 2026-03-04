import { createClient } from '@/lib/supabase/server'
import { Target, Dumbbell, BookOpen, TrendingUp, Users, Calendar } from 'lucide-react'
import Link from 'next/link'
import { formatGPA } from '@/lib/utils'

export const metadata = { title: 'Dashboard — Runway Elite Prep' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: athletes },
    { count: connectionCount },
    { data: subscription },
  ] = await Promise.all([
    supabase.from('athletes').select('*').eq('parent_id', user!.id).order('created_at'),
    supabase.from('connections').select('*', { count: 'exact', head: true }).eq('parent_id', user!.id),
    supabase.from('subscriptions').select('plan, status').eq('user_id', user!.id).maybeSingle(),
  ])

  const athlete = athletes?.[0]
  const connections = connectionCount ?? 0
  const plan = subscription?.plan ?? 'free'

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">
          {athlete ? `${athlete.first_name}'s Dashboard` : 'Dashboard'}
        </h1>
        {athlete && (
          <p className="text-muted-foreground mt-1 capitalize">
            {athlete.sport} · Class of {athlete.grad_year}
            {athlete.position ? ` · ${athlete.position}` : ''}
          </p>
        )}
      </div>

      {/* Free tier banner */}
      {plan === 'free' && (
        <div className="mb-6 rounded-xl bg-blue-900 text-white p-4 flex items-center justify-between">
          <div>
            <p className="font-semibold">You&apos;re on the Free plan</p>
            <p className="text-blue-200 text-sm mt-0.5">Upgrade to unlock unlimited connections, training tasks, and more.</p>
          </div>
          <Link
            href="/settings"
            className="shrink-0 bg-white text-blue-900 font-semibold text-sm px-4 py-2 rounded-lg hover:bg-blue-50 transition"
          >
            Upgrade
          </Link>
        </div>
      )}

      {/* Three Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <PillarCard
          href="/exposure"
          icon={<Target className="w-6 h-6" />}
          label="Exposure & Brand"
          description="HS coaches, camps, travel teams"
          stat={`${connections} connections`}
          primary
          color="blue"
        />
        <PillarCard
          href="/training"
          icon={<Dumbbell className="w-6 h-6" />}
          label="Athletic Development"
          description="Workouts, tasks, check-ins"
          stat="Coming soon"
          color="green"
        />
        <PillarCard
          href="/academics"
          icon={<BookOpen className="w-6 h-6" />}
          label="Academic Foundation"
          description="GPA tracking, study habits"
          stat={athlete?.gpa ? `${formatGPA(athlete.gpa)} GPA` : 'Add GPA'}
          color="purple"
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <QuickAction
          href="/exposure"
          icon={<Users className="w-5 h-5 text-blue-900" />}
          title="Add a Connection"
          description="Track a coach, camp, or travel team"
        />
        <QuickAction
          href="/profile"
          icon={<TrendingUp className="w-5 h-5 text-green-700" />}
          title="Update Measurables"
          description="40 time, vertical, height, weight"
        />
        <QuickAction
          href="/academics"
          icon={<BookOpen className="w-5 h-5 text-purple-700" />}
          title="Log GPA / Courses"
          description="Keep academics on track"
        />
        <QuickAction
          href="/settings"
          icon={<Calendar className="w-5 h-5 text-gray-600" />}
          title="Manage Subscription"
          description="View or upgrade your plan"
        />
      </div>
    </div>
  )
}

function PillarCard({
  href, icon, label, description, stat, primary, color,
}: {
  href: string
  icon: React.ReactNode
  label: string
  description: string
  stat: string
  primary?: boolean
  color: 'blue' | 'green' | 'purple'
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-900 border-blue-200',
    green: 'bg-green-50 text-green-900 border-green-200',
    purple: 'bg-purple-50 text-purple-900 border-purple-200',
  }
  const iconColors = {
    blue: 'bg-blue-100 text-blue-900',
    green: 'bg-green-100 text-green-900',
    purple: 'bg-purple-100 text-purple-900',
  }

  return (
    <Link
      href={href}
      className={`relative block rounded-xl border-2 p-5 hover:shadow-md transition-shadow ${colors[color]}`}
    >
      {primary && (
        <span className="absolute top-3 right-3 text-[10px] font-bold bg-blue-900 text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
          Primary
        </span>
      )}
      <div className={`inline-flex p-2 rounded-lg mb-3 ${iconColors[color]}`}>
        {icon}
      </div>
      <p className="font-bold text-base">{label}</p>
      <p className="text-sm opacity-70 mt-0.5">{description}</p>
      <p className="text-sm font-semibold mt-3 opacity-90">{stat}</p>
    </Link>
  )
}

function QuickAction({
  href, icon, title, description,
}: {
  href: string
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:shadow-sm transition-shadow"
    >
      <div className="shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </Link>
  )
}
