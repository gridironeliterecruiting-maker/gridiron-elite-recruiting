"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Mail,
  FileText,
  Clock,
  ChevronRight,
  Copy,
  Eye,
  Send,
  Inbox,
} from "lucide-react"

interface EmailTemplate {
  id: string
  name: string
  subject: string
  category: string
  body?: string
}

const categoryColors: Record<string, string> = {
  introduction: "bg-primary/10 text-primary",
  "follow-up": "bg-amber-100 text-amber-700",
  camp: "bg-emerald-100 text-emerald-700",
  film: "bg-blue-100 text-blue-700",
  "thank-you": "bg-purple-100 text-purple-700",
}

const categoryLabels: Record<string, string> = {
  introduction: "Intro",
  "follow-up": "Follow-Up",
  camp: "Camp",
  film: "Film",
  "thank-you": "Thank You",
}

export function OutreachClient({ templates }: { templates: EmailTemplate[] }) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground sm:text-3xl">
          Outreach Center
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage templates and track your outreach</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Templates", value: templates.length, icon: FileText, color: "primary" },
          { label: "Total Sent", value: 0, icon: Send, color: "accent" },
          { label: "Opened", value: 0, icon: Eye, color: "primary" },
          { label: "Replied", value: 0, icon: Mail, color: "primary" },
        ].map((stat) => (
          <Card key={stat.label} className="relative overflow-hidden">
            <div className={`absolute inset-x-0 top-0 h-0.5 ${stat.color === "accent" ? "bg-accent" : "bg-primary"}`} />
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${stat.color === "accent" ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-display text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Email Templates */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="flex-row items-center gap-2.5 pb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-base font-bold">Email Templates</CardTitle>
              <Badge variant="secondary" className="ml-auto text-xs">
                {templates.length} templates
              </Badge>
            </CardHeader>
            <CardContent className="pt-0">
              {templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
                    <FileText className="h-7 w-7 text-muted-foreground/40" />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-foreground">No templates yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">Create email templates to streamline your outreach.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setSelectedTemplate(selectedTemplate === template.id ? null : template.id)}
                      className={`group flex flex-col rounded-lg border p-4 text-left transition-all ${
                        selectedTemplate === template.id
                          ? "border-primary/30 bg-primary/[0.03] shadow-sm"
                          : "border-transparent bg-secondary/40 hover:border-border hover:bg-secondary/70 hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">{template.name}</span>
                            {template.category && (
                              <Badge className={`${categoryColors[template.category] || "bg-secondary text-secondary-foreground"} border-0 text-[10px] font-semibold`}>
                                {categoryLabels[template.category] || template.category}
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1.5 truncate text-xs text-muted-foreground">{template.subject}</p>
                        </div>
                        <ChevronRight className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/30 transition-all ${
                          selectedTemplate === template.id ? "rotate-90 text-primary" : "group-hover:text-muted-foreground"
                        }`} />
                      </div>

                      {selectedTemplate === template.id && (
                        <div className="mt-3 flex items-center gap-2 border-t border-border/50 pt-3">
                          <button
                            type="button"
                            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Send className="h-3 w-3" />
                            Use Template
                          </button>
                          <button
                            type="button"
                            className="flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Eye className="h-3 w-3" />
                            Preview
                          </button>
                          <button
                            type="button"
                            className="flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Copy className="h-3 w-3" />
                            Duplicate
                          </button>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Sends */}
        <div className="lg:col-span-2">
          <Card className="flex flex-col">
            <CardHeader className="flex-row items-center gap-2.5 pb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                <Send className="h-4 w-4 text-accent" />
              </div>
              <CardTitle className="text-base font-bold">Recent Sends</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 pt-0">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
                  <Inbox className="h-7 w-7 text-muted-foreground/40" />
                </div>
                <p className="mt-4 text-sm font-semibold text-foreground">No outreach sent yet</p>
                <p className="mt-1 max-w-[200px] text-xs text-muted-foreground">
                  Start sending outreach to coaches using your templates.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
