import { Tent, Calendar, MapPin, Trophy } from 'lucide-react'

export default function CampsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-foreground">Camps</h1>
        <p className="mt-1 text-sm text-muted-foreground">Track camp registrations, log performances, and find your next opportunity.</p>
      </div>
      <div className="rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Tent className="h-8 w-8 text-primary" />
        </div>
        <h2 className="font-display text-xl font-bold uppercase tracking-wide text-foreground">Coming Soon</h2>
        <p className="mt-2 max-w-md mx-auto text-sm text-muted-foreground">
          Register for camps, log your performances, and track your results — all in one place.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 max-w-lg mx-auto">
          {[
            { icon: Calendar, label: "Find & Register", desc: "Browse camps by date and location" },
            { icon: Trophy, label: "Log Performance", desc: "Record 40 time, verticals, and more" },
            { icon: MapPin, label: "Track Results", desc: "See your progress across every camp" },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="rounded-xl border bg-secondary/50 p-4 text-center">
              <Icon className="h-5 w-5 text-primary mx-auto mb-2" />
              <p className="text-xs font-bold uppercase tracking-wide text-foreground">{label}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
