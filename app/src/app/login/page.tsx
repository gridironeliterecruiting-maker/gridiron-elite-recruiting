import { Suspense } from 'react'
import { LoginUI } from '@/components/login-ui'

interface LoginPageProps {
  searchParams: Promise<{ mode?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { mode } = await searchParams
  return (
    <Suspense>
      <LoginUI
        programName="Runway Recruit"
        registerMode={mode === 'register'}
      />
    </Suspense>
  )
}
