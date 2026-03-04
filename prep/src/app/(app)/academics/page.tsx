import { createClient } from '@/lib/supabase/server'
import { formatGPA } from '@/lib/utils'

export const metadata = { title: 'Academics — Runway Elite Prep' }

export default async function AcademicsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: athlete } = await supabase
    .from('athletes')
    .select('first_name, gpa')
    .eq('parent_id', user!.id)
    .order('created_at')
    .limit(1)
    .single()

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Academic Foundation</h1>
      <p className="text-muted-foreground mb-8">GPA tracking, study habits, and course planning.</p>

      {athlete?.gpa && (
        <div className="mb-6 rounded-xl bg-purple-50 border border-purple-200 p-5 inline-block">
          <p className="text-sm text-purple-700 font-medium">Current GPA</p>
          <p className="text-4xl font-bold text-purple-900 mt-1">{formatGPA(athlete.gpa)}</p>
        </div>
      )}

      <div className="rounded-xl border-2 border-dashed border-border p-12 text-center text-muted-foreground">
        <p className="font-medium">Full academics module coming soon</p>
        <p className="text-sm mt-1">Course planning, GPA goals, and study habit tracking</p>
      </div>
    </div>
  )
}
