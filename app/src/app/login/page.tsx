'use client'

import { Suspense } from 'react'
import { LoginUI } from '@/components/login-ui'

export default function LoginPage() {
  return (
    <Suspense>
      <LoginUI programName="Gridiron Elite Recruiting" />
    </Suspense>
  )
}
