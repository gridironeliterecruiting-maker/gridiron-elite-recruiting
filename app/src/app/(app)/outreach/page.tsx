import { createClient } from '@/lib/supabase/server'

export default async function OutreachPage() {
  const supabase = await createClient()
  const { data: templates } = await supabase.from('email_templates').select('*').order('created_at', { ascending: false })
  const { data: sends } = await supabase.from('email_sends').select('*, email_templates(name)').order('sent_at', { ascending: false }).limit(20)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Outreach Center</h1>
        <p className="text-gray-500 mt-1">Manage templates and track your outreach</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Email Templates</h2>
          {templates && templates.length > 0 ? (
            <div className="space-y-3">
              {templates.map((t: Record<string, string>) => (
                <div key={t.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="font-medium text-sm text-gray-900">{t.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{t.subject}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No templates yet</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Sends</h2>
          {sends && sends.length > 0 ? (
            <div className="space-y-3">
              {sends.map((s: Record<string, string | Record<string, string>>) => (
                <div key={s.id as string} className="p-4 bg-gray-50 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm text-gray-900">{(s.email_templates as Record<string, string>)?.name || 'Manual'}</div>
                    <div className="text-xs text-gray-500">{s.recipient_email as string}</div>
                  </div>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    s.status === 'sent' ? 'bg-green-100 text-green-700' :
                    s.status === 'opened' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>{s.status as string}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No outreach sent yet</p>
          )}
        </div>
      </div>
    </div>
  )
}
