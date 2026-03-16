import { Newspaper, Star, Mail, Trophy } from 'lucide-react'

export default function MediaPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-foreground">Media</h1>
        <p className="mt-1 text-sm text-muted-foreground">Get listed in rankings, connect with media outlets, and build your reputation.</p>
      </div>
      <div className="rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Newspaper className="h-8 w-8 text-primary" />
        </div>
        <h2 className="font-display text-xl font-bold uppercase tracking-wide text-foreground">Coming Soon</h2>
        <p className="mt-2 max-w-md mx-auto text-sm text-muted-foreground">
          Reach out to ranking sites, get featured in articles, and manage all your media relationships here.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 max-w-lg mx-auto">
          {[
            { icon: Star, label: "Get Ranked", desc: "Prep Redzone, Next, QB Hitlist & more" },
            { icon: Mail, label: "Outreach", desc: "Email ranking sites and publications" },
            { icon: Trophy, label: "Track Coverage", desc: "Log articles, rankings, and features" },
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
