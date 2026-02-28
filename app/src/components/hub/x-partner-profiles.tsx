"use client"

import { useState, useEffect, useRef } from "react"
import { Card } from "@/components/ui/card"
import { ChevronDown, Users2, Plus, X, ExternalLink, AtSign } from "lucide-react"

interface XPartner {
  id: string
  twitter_handle: string
  display_name: string | null
  profile_image_url: string | null
}

export function XPartnerProfiles() {
  const [isOpen, setIsOpen] = useState(true)
  const [partners, setPartners] = useState<XPartner[]>([])
  const [loading, setLoading] = useState(true)
  const [showOverlay, setShowOverlay] = useState(false)
  const [handles, setHandles] = useState([""])
  const [saving, setSaving] = useState(false)
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetch("/api/x-partners")
      .then(r => r.json())
      .then(data => { setPartners(data.partners || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const openOverlay = () => {
    setHandles([""])
    setShowOverlay(true)
  }

  const addHandleInput = () => setHandles(h => [...h, ""])

  const updateHandle = (i: number, val: string) =>
    setHandles(h => h.map((v, j) => (j === i ? val : v)))

  const removeHandleInput = (i: number) =>
    setHandles(h => h.filter((_, j) => j !== i))

  const savePartners = async () => {
    const cleaned = handles.map(h => h.trim().replace(/^@/, "")).filter(Boolean)
    if (!cleaned.length) return
    setSaving(true)
    try {
      const res = await fetch("/api/x-partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handles: cleaned }),
      })
      const data = await res.json()
      if (data.partners) {
        setPartners(prev => {
          const map = new Map(prev.map(p => [p.twitter_handle.toLowerCase(), p]))
          for (const p of data.partners) {
            map.set(p.twitter_handle.toLowerCase(), p)
          }
          return Array.from(map.values())
        })
      }
      setShowOverlay(false)
    } finally {
      setSaving(false)
    }
  }

  const deletePartner = async (id: string) => {
    await fetch(`/api/x-partners/${id}`, { method: "DELETE" })
    setPartners(p => p.filter(x => x.id !== id))
  }

  const getInitials = (partner: XPartner) => {
    const name = partner.display_name || partner.twitter_handle
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <>
      <Card className="overflow-hidden">
        <button
          onClick={() => setIsOpen(v => !v)}
          className="flex w-full items-center justify-between px-5 py-4 sm:px-6"
        >
          <h3 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-foreground">
            <span
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-black font-black text-white"
              style={{ fontSize: 11 }}
            >
              X
            </span>
            Partner Profiles
          </h3>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </button>

        {isOpen && (
          <div className="px-5 pb-5 sm:px-6 sm:pb-6">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex animate-pulse items-center gap-3">
                    <div className="h-9 w-9 shrink-0 rounded-full bg-secondary" />
                    <div className="h-3 w-28 rounded bg-secondary" />
                  </div>
                ))}
              </div>
            ) : partners.length === 0 ? (
              <div className="flex flex-col items-center gap-4 rounded-lg border-2 border-dashed border-border py-7 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                  <Users2 className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">No partners added yet</p>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                    Add your 7v7 team, trainers, camps, media outlets, gyms, or anyone else that has played a role in your football journey.
                  </p>
                </div>
                <button
                  onClick={openOverlay}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Partner
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1">
                {partners.map(partner => (
                  <PartnerRow
                    key={partner.id}
                    partner={partner}
                    initials={getInitials(partner)}
                    hasImgError={imgErrors[partner.id]}
                    onImgError={() => setImgErrors(prev => ({ ...prev, [partner.id]: true }))}
                    onDelete={() => deletePartner(partner.id)}
                  />
                ))}
                <button
                  onClick={openOverlay}
                  className="mt-2 flex items-center gap-1.5 self-start rounded-md px-2 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <Plus className="h-3 w-3" />
                  Add Partner
                </button>
              </div>
            )}
          </div>
        )}
      </Card>

      {showOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-card shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-black font-black text-white"
                  style={{ fontSize: 11 }}
                >
                  X
                </span>
                <h2 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
                  Add Partner Profiles
                </h2>
              </div>
              <button
                onClick={() => setShowOverlay(false)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Inputs */}
            <div className="px-6 py-5">
              <p className="mb-4 text-xs text-muted-foreground">
                Enter the X handle for each partner — your 7v7 team, trainer, camp, media outlet, gym, or anyone who&apos;s been part of your journey.
              </p>
              <div className="flex flex-col gap-2">
                {handles.map((handle, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <AtSign className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        value={handle}
                        onChange={e => updateHandle(i, e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            addHandleInput()
                          }
                        }}
                        placeholder="username"
                        className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                        autoFocus={i === handles.length - 1}
                      />
                    </div>
                    {handles.length > 1 && (
                      <button
                        onClick={() => removeHandleInput(i)}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={addHandleInput}
                className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                Add another
              </button>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
              <button
                onClick={() => setShowOverlay(false)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={savePartners}
                disabled={saving || handles.every(h => !h.trim())}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function PartnerRow({
  partner,
  initials,
  hasImgError,
  onImgError,
  onDelete,
}: {
  partner: XPartner
  initials: string
  hasImgError: boolean | undefined
  onImgError: () => void
  onDelete: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-secondary"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Avatar */}
      <div className="relative h-9 w-9 shrink-0">
        {!hasImgError && partner.profile_image_url ? (
          <img
            src={partner.profile_image_url}
            alt={partner.display_name || partner.twitter_handle}
            className="h-9 w-9 rounded-full object-cover"
            onError={onImgError}
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
            {initials}
          </div>
        )}
      </div>

      {/* Name + handle */}
      <div className="min-w-0 flex-1">
        {partner.display_name ? (
          <>
            <p className="truncate text-sm font-semibold text-foreground">{partner.display_name}</p>
            <p className="truncate text-xs text-muted-foreground">@{partner.twitter_handle}</p>
          </>
        ) : (
          <p className="truncate text-sm font-semibold text-foreground">@{partner.twitter_handle}</p>
        )}
      </div>

      {/* Actions — visible on hover */}
      <div className={`flex items-center gap-1 transition-opacity ${hovered ? "opacity-100" : "opacity-0"}`}>
        <a
          href={`https://x.com/${partner.twitter_handle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          title="Open in X"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <button
          onClick={onDelete}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-destructive"
          title="Remove"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
