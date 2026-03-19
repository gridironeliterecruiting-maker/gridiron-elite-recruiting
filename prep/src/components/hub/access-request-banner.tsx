"use client"

import { useState } from "react"
import { Bell, ChevronRight, X, UserCheck, UserX } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface PendingRequest {
  id: string
  user_email: string
  user_name: string | null
}

interface AccessRequestBannerProps {
  requests: PendingRequest[]
  programName: string
}

export function AccessRequestBanner({ requests: initial, programName }: AccessRequestBannerProps) {
  const [requests, setRequests] = useState<PendingRequest[]>(initial)
  const [active, setActive] = useState<PendingRequest | null>(null)
  const [step, setStep] = useState<"review" | "role">("review")
  const [selectedRole, setSelectedRole] = useState<"coach" | "player" | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (requests.length === 0) return null

  const openModal = (req: PendingRequest) => {
    setActive(req)
    setStep("review")
    setSelectedRole(null)
    setError(null)
  }

  const closeModal = () => {
    setActive(null)
    setStep("review")
    setSelectedRole(null)
    setError(null)
  }

  const resolve = (id: string) => setRequests(prev => prev.filter(r => r.id !== id))

  const handleAction = async (action: "approve" | "deny") => {
    if (!active) return
    if (action === "approve" && !selectedRole) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/access-requests/${active.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, role: selectedRole }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Something went wrong")
        return
      }
      resolve(active.id)
      closeModal()
    } catch {
      setError("Network error — please try again")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {requests.map(req => (
          <button
            key={req.id}
            onClick={() => openModal(req)}
            className="group flex w-full items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left transition-colors hover:bg-amber-100"
          >
            <Bell className="h-4 w-4 shrink-0 text-amber-600" />
            <span className="flex-1 text-sm text-amber-900">
              Pending request to join <strong>{programName}</strong> from{" "}
              <strong>{req.user_email}</strong>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-amber-500 transition-transform group-hover:translate-x-0.5" />
          </button>
        ))}
      </div>

      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-md rounded-xl bg-card shadow-2xl">
            <button
              onClick={closeModal}
              className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            {step === "review" && (
              <div className="p-6">
                <h2 className="mb-1 font-display text-lg font-bold uppercase tracking-wide text-foreground">
                  Access Request
                </h2>
                <p className="mb-6 text-sm text-muted-foreground">
                  This person wants to join <strong>{programName}</strong>.
                </p>
                <div className="mb-6 rounded-lg bg-secondary px-4 py-3">
                  {active.user_name && (
                    <p className="text-sm font-medium text-foreground">{active.user_name}</p>
                  )}
                  <p className="text-sm text-muted-foreground">{active.user_email}</p>
                </div>
                {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                    onClick={() => handleAction("deny")}
                    disabled={loading}
                  >
                    <UserX className="mr-2 h-4 w-4" />
                    Deny
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => setStep("role")}
                    disabled={loading}
                  >
                    <UserCheck className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                </div>
              </div>
            )}

            {step === "role" && (
              <div className="p-6">
                <h2 className="mb-1 font-display text-lg font-bold uppercase tracking-wide text-foreground">
                  Assign Role
                </h2>
                <p className="mb-6 text-sm text-muted-foreground">
                  What role should <strong>{active.user_email}</strong> have on{" "}
                  <strong>{programName}</strong>?
                </p>
                <div className="mb-6 grid grid-cols-2 gap-3">
                  {(["player", "coach"] as const).map(r => (
                    <button
                      key={r}
                      onClick={() => setSelectedRole(r)}
                      className={`rounded-lg border-2 px-4 py-5 text-sm font-semibold capitalize transition-colors ${
                        selectedRole === r
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-foreground hover:border-primary/50"
                      }`}
                    >
                      {r === "player" ? "Player" : "Coach"}
                    </button>
                  ))}
                </div>
                {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setStep("review")}
                    disabled={loading}
                  >
                    Back
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={!selectedRole || loading}
                    onClick={() => handleAction("approve")}
                  >
                    Confirm & Approve
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
