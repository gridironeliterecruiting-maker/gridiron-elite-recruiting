"use client"

import * as React from "react"
import {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

interface SaveExitDialogProps {
  isOpen: boolean
  onClose: () => void
  onSave: (title: string) => void
  onDelete: () => void
  initialTitle?: string
}

export function SaveExitDialog({ isOpen, onClose, onSave, onDelete, initialTitle = "" }: SaveExitDialogProps) {
  const [campaignTitle, setCampaignTitle] = React.useState(initialTitle)

  const handleSaveClick = () => {
    onSave(campaignTitle)
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogPortal>
        <AlertDialogOverlay />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save Campaign as Draft?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Would you like to save this campaign as a draft or discard your changes?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="campaignTitle" className="text-right">
                Campaign Title
              </Label>
              <Input
                id="campaignTitle"
                value={campaignTitle}
                onChange={(e) => setCampaignTitle(e.target.value)}
                className="col-span-3"
                placeholder="e.g., Spring 2026 Recruiting Emails"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button variant="destructive" onClick={onDelete}>Delete</Button>
            </AlertDialogAction>
            <AlertDialogAction asChild>
              <Button onClick={handleSaveClick} disabled={!campaignTitle.trim()}>Save as Draft</Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialog>
  )
}
