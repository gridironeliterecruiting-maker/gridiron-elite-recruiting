import { createClient } from '@/lib/supabase/server'
import { formatGPA } from '@/lib/utils'

export const metadata = { title: 'Athlete Profile — Runway Elite Prep' }

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: athlete } = await supabase
    .from('athletes')
    .select('*')
    .eq('parent_id', user!.id)
    .order('created_at')
    .limit(1)
    .single()

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Athlete Profile</h1>
      <p className="text-muted-foreground mb-8">Highlight reel, measurables, bio, and brand building.</p>

      {athlete && (
        <div className="rounded-xl border border-border bg-card p-6 mb-6">
          <h2 className="font-bold text-xl mb-4">{athlete.first_name} {athlete.last_name}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <Stat label="Sport" value={athlete.sport} />
            <Stat label="Grad Year" value={String(athlete.grad_year)} />
            {athlete.position && <Stat label="Position" value={athlete.position} />}
            {athlete.gpa && <Stat label="GPA" value={formatGPA(athlete.gpa)} />}
          </div>
        </div>
      )}

      <div className="rounded-xl border-2 border-dashed border-border p-12 text-center text-muted-foreground">
        <p className="font-medium">Full profile builder coming soon</p>
        <p className="text-sm mt-1">Measurables history, highlights, bio, and social links</p>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs uppercase tracking-wide font-medium">{label}</p>
      <p className="font-semibold capitalize mt-0.5">{value}</p>
    </div>
  )
}
