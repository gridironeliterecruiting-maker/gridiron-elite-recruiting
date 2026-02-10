import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { count: programCount },
    { count: coachCount },
    { count: pipelineCount },
    { count: outreachCount },
    { data: actionItems },
  ] = await Promise.all([
    supabase.from('programs').select('*', { count: 'exact', head: true }),
    supabase.from('coaches').select('*', { count: 'exact', head: true }),
    supabase.from('pipeline_entries').select('*', { count: 'exact', head: true }),
    supabase.from('email_sends').select('*', { count: 'exact', head: true }),
    supabase.from('action_items').select('*').eq('completed', false).order('due_date', { ascending: true }).limit(10),
  ])

  const stats = [
    { label: 'Programs in DB', value: programCount ?? 0, color: 'bg-[#0047AB]' },
    { label: 'Coaches in DB', value: coachCount ?? 0, color: 'bg-[#0047AB]' },
    { label: 'Outreach Sent', value: outreachCount ?? 0, color: 'bg-[#E31937]' },
    { label: 'In Pipeline', value: pipelineCount ?? 0, color: 'bg-[#0047AB]' },
  ]

  const quickLinks = [
    { label: 'Browse Coach Database', href: '/coaches', desc: 'Search and filter college programs and coaches' },
    { label: 'CRM Pipeline', href: '/pipeline', desc: 'Track your recruiting pipeline stages' },
    { label: 'Outreach Center', href: '/outreach', desc: 'Manage email templates and outreach' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Your recruiting overview at a glance</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="text-sm font-medium text-gray-500">{s.label}</div>
            <div className="mt-1 text-3xl font-bold text-gray-900">{s.value}</div>
            <div className={`mt-2 h-1 w-12 rounded ${s.color}`} />
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Action Items */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Action Items</h2>
          {actionItems && actionItems.length > 0 ? (
            <ul className="space-y-3">
              {actionItems.map((item: Record<string, string>) => (
                <li key={item.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-[#E31937] mt-2 shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{item.title || item.description}</div>
                    {item.due_date && <div className="text-xs text-gray-500 mt-0.5">Due: {new Date(item.due_date).toLocaleDateString()}</div>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 text-sm">No pending action items</p>
          )}
        </div>

        {/* Quick Links */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Links</h2>
          <div className="space-y-3">
            {quickLinks.map(l => (
              <Link key={l.href} href={l.href}
                className="block p-4 bg-gray-50 hover:bg-blue-50 rounded-lg transition group">
                <div className="text-sm font-semibold text-[#0047AB] group-hover:underline">{l.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{l.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
