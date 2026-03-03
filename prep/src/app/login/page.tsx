import { LoginUI } from '@/components/login-ui'

export const metadata = {
  title: 'Sign In — Runway Elite Prep',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return <LoginUI authError={error} />
}
