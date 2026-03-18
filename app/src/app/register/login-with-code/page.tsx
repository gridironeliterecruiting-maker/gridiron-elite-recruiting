import { createAdminClient } from '@/lib/supabase/admin'
import { LoginWithCodeForm } from './login-with-code-form'

export const dynamic = 'force-dynamic'

export default async function LoginWithCodePage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string; code?: string }>
}) {
  const { slug, code } = await searchParams

  let branding: { name: string; logo: string; color: string; bg: string } | undefined

  if (slug) {
    const admin = createAdminClient()
    const { data: program } = await admin
      .from('managed_programs')
      .select('school_name, mascot, logo_url, background_image_url, primary_color')
      .eq('landing_slug', slug)
      .maybeSingle()

    if (program) {
      branding = {
        name: [program.school_name, program.mascot].filter(Boolean).join(' '),
        logo: program.logo_url || '/logo.png',
        color: program.primary_color || '#0047AB',
        bg: program.background_image_url || '/locker-room-bg.png',
      }
    }
  }

  return <LoginWithCodeForm slug={slug} code={code} branding={branding} />
}
