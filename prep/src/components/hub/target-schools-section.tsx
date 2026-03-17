"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { ChevronDown, Plus, Search, X, Check as CheckIcon } from "lucide-react"

interface TargetSchool {
  id: string
  program_id: string
  school_name: string
  logo_url: string | null
  twitter_handle: string | null
}

interface Program {
  id: string
  school_name: string
  division: string
  logo_url: string | null
  twitter_handle: string | null
}

export function TargetSchoolsSection() {
  const [isOpen, setIsOpen] = useState(true)
  const [schools, setSchools] = useState<TargetSchool[]>([])
  const [loading, setLoading] = useState(true)
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({})

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [allPrograms, setAllPrograms] = useState<Program[]>([])
  const [programsLoading, setProgramsLoading] = useState(false)
  const [programSearch, setProgramSearch] = useState("")
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [staged, setStaged] = useState<Program[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/target-schools")
      .then(r => r.json())
      .then(data => { setSchools(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const openModal = async () => {
    setStaged([])
    setProgramSearch("")
    setDropdownOpen(false)
    setShowModal(true)
    if (allPrograms.length === 0) {
      setProgramsLoading(true)
      try {
        const data = await fetch("/api/programs").then(r => r.json())
        setAllPrograms(Array.isArray(data) ? data : [])
      } finally {
        setProgramsLoading(false)
      }
    }
  }

  const stageProgram = (p: Program) => {
    if (!staged.find(s => s.id === p.id)) setStaged(prev => [...prev, p])
    setProgramSearch("")
    setDropdownOpen(false)
  }

  const removeStaged = (id: string) => setStaged(prev => prev.filter(s => s.id !== id))

  const savePrograms = async () => {
    if (!staged.length) return
    setSaving(true)
    try {
      const data = await fetch("/api/target-schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(staged),
      }).then(r => r.json())
      if (Array.isArray(data)) {
        setSchools(prev => [...prev, ...data])
      }
      setShowModal(false)
    } finally {
      setSaving(false)
    }
  }

  const removeSchool = async (id: string) => {
    await fetch(`/api/target-schools/${id}`, { method: "DELETE" })
    setSchools(prev => prev.filter(s => s.id !== id))
  }

  const filtered = allPrograms
    .filter(p => p.school_name.toLowerCase().includes(programSearch.toLowerCase()))
    .slice(0, 50)

  return (
    <>
      <Card className="overflow-hidden">
        <div className="flex w-full items-center justify-between px-5 py-4 sm:px-6">
          <button
            onClick={() => setIsOpen(v => !v)}
            className="flex flex-1 items-center gap-2 text-left"
          >
            <h3 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-foreground">
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-black font-black text-white" style={{ fontSize: 11 }}>X</span>
              Engage Target Schools
              {!isOpen && schools.length > 0 && (
                <span className="inline-flex items-center rounded bg-secondary px-1.5 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                  {schools.length}
                </span>
              )}
            </h3>
            <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
          </button>
          <button
            onClick={openModal}
            className="ml-3 flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-3 w-3" />
            Add Program
          </button>
        </div>

        {isOpen && (
          <div className="px-5 pb-5 sm:px-6 sm:pb-6">
            {loading ? (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex animate-pulse flex-col items-center gap-1.5 p-2">
                    <div className="h-9 w-9 rounded-full bg-secondary" />
                    <div className="h-2.5 w-12 rounded bg-secondary" />
                  </div>
                ))}
              </div>
            ) : schools.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border py-7 text-center">
                <p className="text-sm font-semibold text-foreground">No target schools added yet</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  Add college programs you&apos;re targeting. Click their logo to engage on X.
                </p>
                <button
                  onClick={openModal}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Program
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
                {schools.map(s => (
                  <div key={s.id} className="group relative flex flex-col items-center gap-1.5 rounded-lg p-2 text-center transition-colors hover:bg-secondary">
                    <a
                      href={s.twitter_handle ? `https://x.com/${s.twitter_handle}` : "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center gap-1.5"
                    >
                      <div className="relative h-9 w-9 shrink-0">
                        {!imgErrors[s.id] && s.logo_url ? (
                          <img
                            src={s.logo_url}
                            alt={s.school_name}
                            className="h-9 w-9 object-contain"
                            onError={() => setImgErrors(prev => ({ ...prev, [s.id]: true }))}
                          />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-[10px] font-bold uppercase text-muted-foreground">
                            {s.school_name.slice(0, 2)}
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                          <svg className="h-3.5 w-3.5 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                          </svg>
                        </div>
                      </div>
                      <span className="line-clamp-2 text-[10px] font-medium leading-tight text-foreground">
                        {s.school_name}
                      </span>
                    </a>
                    <button
                      onClick={() => removeSchool(s.id)}
                      className="absolute right-0.5 top-0.5 rounded p-0.5 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground/50 hover:!text-destructive"
                      title="Remove"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-card shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-black font-black text-white" style={{ fontSize: 11 }}>X</span>
                <h2 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">Add Target Schools</h2>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Search */}
            <div className="px-6 py-5">
              <label className="mb-2 block text-sm font-medium text-foreground">Search for program</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search programs..."
                  value={programSearch}
                  onChange={e => { setProgramSearch(e.target.value); setDropdownOpen(true) }}
                  onFocus={() => setDropdownOpen(true)}
                  className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {dropdownOpen && programSearch.length > 0 && (
                  <div className="absolute z-[200] mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
                    {programsLoading ? (
                      <div className="px-3 py-4 text-center text-sm text-muted-foreground">Loading programs…</div>
                    ) : filtered.length === 0 ? (
                      <div className="px-3 py-4 text-center text-sm text-muted-foreground">No programs found</div>
                    ) : filtered.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => stageProgram(p)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-secondary"
                      >
                        {p.logo_url ? (
                          <img src={p.logo_url} alt={p.school_name} width={20} height={20} className="shrink-0 rounded object-contain" />
                        ) : (
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-[8px] font-bold text-primary">
                            {p.school_name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span className="flex-1 truncate">{p.school_name}</span>
                        <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">{p.division}</span>
                        {staged.find(s => s.id === p.id) && <CheckIcon className="h-3.5 w-3.5 shrink-0 text-primary" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Staged list */}
              {staged.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {staged.map(p => (
                    <div key={p.id} className="flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-foreground">
                      {p.logo_url && <img src={p.logo_url} alt={p.school_name} width={14} height={14} className="shrink-0 object-contain" />}
                      {p.school_name}
                      <button onClick={() => removeStaged(p.id)} className="ml-0.5 text-muted-foreground hover:text-foreground">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={savePrograms}
                disabled={saving || staged.length === 0}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? "Saving…" : `+Add Program${staged.length > 1 ? "s" : ""}${staged.length > 0 ? ` (${staged.length})` : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
