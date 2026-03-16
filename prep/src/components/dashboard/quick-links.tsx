import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, GitBranch, Mail, ArrowRight, Zap } from "lucide-react"

const links = [
  {
    title: "Browse Programs",
    description: "Search and filter college programs and coaches",
    icon: Users,
    color: "primary" as const,
  },
  {
    title: "Pipeline",
    description: "Track your recruiting pipeline stages",
    icon: GitBranch,
    color: "primary" as const,
  },
  {
    title: "Outreach Center",
    description: "Manage email templates and outreach",
    icon: Mail,
    color: "accent" as const,
  },
]

export function QuickLinks() {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center gap-2.5 pb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Zap className="h-4 w-4 text-primary" />
        </div>
        <CardTitle className="text-base font-bold">Quick Links</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        <div className="flex flex-col gap-2">
          {links.map((link) => (
            <button
              key={link.title}
              type="button"
              className="group flex items-center gap-4 rounded-lg border border-transparent px-4 py-3.5 text-left transition-all hover:border-border hover:bg-secondary hover:shadow-sm"
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  link.color === "accent"
                    ? "bg-accent/10 text-accent"
                    : "bg-primary/10 text-primary"
                }`}
              >
                <link.icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{link.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {link.description}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/0 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
