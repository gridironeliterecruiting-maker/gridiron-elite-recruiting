import { createClient } from "@/lib/supabase/server"
import { Settings } from "lucide-react"
import { ProfileForm } from "./profile-form"
import { RecruitingDrive } from "@/components/profile/recruiting-drive"

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user?.id)
    .single()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground sm:text-3xl">
          Profile
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Settings className="h-3.5 w-3.5 text-accent" />
          MANAGE YOUR INFO THAT POWERS OUTREACH
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Profile form */}
        <div className="lg:col-span-5">
          <ProfileForm profile={profile} />
        </div>

        {/* Right: Recruiting Drive */}
        <div className="lg:col-span-7">
          <RecruitingDrive />
        </div>
      </div>
    </div>
  )
}
