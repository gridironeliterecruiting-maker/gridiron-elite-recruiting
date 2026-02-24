"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Save, Check } from "lucide-react"

interface Profile {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  grad_year: number | null
  position: string | null
  high_school: string | null
  city: string | null
  state: string | null
  height: string | null
  weight: string | null
  gpa: string | null
  hudl_url: string | null
  twitter_handle: string | null
}

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputClass} />
    </div>
  )
}

export function ProfileForm({ profile }: { profile: Profile | null }) {
  const [form, setForm] = useState({
    first_name: profile?.first_name || "",
    last_name: profile?.last_name || "",
    email: profile?.email || "",
    phone: profile?.phone || "",
    grad_year: profile?.grad_year?.toString() || "",
    position: profile?.position || "",
    high_school: profile?.high_school || "",
    city: profile?.city || "",
    state: profile?.state || "",
    height: profile?.height || "",
    weight: profile?.weight || "",
    gpa: profile?.gpa || "",
    hudl_url: profile?.hudl_url || "",
    twitter_handle: profile?.twitter_handle || "",
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const update = (key: string, val: string) => {
    setForm((f) => ({ ...f, [key]: val }))
    setSaved(false)
  }

  const handleSave = async () => {
    if (!profile?.id) return
    setSaving(true)
    const supabase = createClient()
    await supabase
      .from("profiles")
      .update({
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        grad_year: form.grad_year ? parseInt(form.grad_year) : null,
        position: form.position,
        high_school: form.high_school,
        city: form.city,
        state: form.state,
        height: form.height,
        weight: form.weight,
        gpa: form.gpa,
        hudl_url: form.hudl_url,
        twitter_handle: form.twitter_handle,
      })
      .eq("id", profile.id)
    setSaving(false)
    setSaved(true)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Personal Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <Field label="First Name" value={form.first_name} onChange={(v) => update("first_name", v)} />
          <Field label="Last Name" value={form.last_name} onChange={(v) => update("last_name", v)} />
          <div className="col-span-2">
            <Field label="Email" value={form.email} onChange={() => {}} placeholder="Cannot change email" type="email" />
          </div>
          <Field label="Phone" value={form.phone} onChange={(v) => update("phone", v)} placeholder="(555) 123-4567" />
          <div />
          <Field label="City" value={form.city} onChange={(v) => update("city", v)} placeholder="Cedar Rapids" />
          <Field label="State" value={form.state} onChange={(v) => update("state", v)} placeholder="IA" />
        </CardContent>
      </Card>

      {/* Athletic Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Athletic Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <Field label="Position" value={form.position} onChange={(v) => update("position", v)} placeholder="QB, WR, LB" />
          <Field label="Grad Year" value={form.grad_year} onChange={(v) => update("grad_year", v)} placeholder="2027" type="number" />
          <div className="col-span-2">
            <Field label="High School" value={form.high_school} onChange={(v) => update("high_school", v)} placeholder="Prairie High School" />
          </div>
          <Field label="Height" value={form.height} onChange={(v) => update("height", v)} placeholder={`6'2"`} />
          <Field label="Weight" value={form.weight} onChange={(v) => update("weight", v)} placeholder="185 lbs" />
          <Field label="GPA" value={form.gpa} onChange={(v) => update("gpa", v)} placeholder="3.5" />
        </CardContent>
      </Card>

      {/* Links & Social */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Links & Social</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Field label="Hudl Profile URL" value={form.hudl_url} onChange={(v) => update("hudl_url", v)} placeholder="https://www.hudl.com/profile/..." />
          <Field label="X Handle" value={form.twitter_handle} onChange={(v) => update("twitter_handle", v)} placeholder="@yourhandle" />
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent/90 min-w-[140px]">
          {saving ? "Saving..." : saved ? <><Check className="mr-2 h-4 w-4" /> Saved</> : <><Save className="mr-2 h-4 w-4" /> Save Profile</>}
        </Button>
      </div>
    </div>
  )
}
