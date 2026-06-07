import type { Metadata, Viewport } from 'next'
import './globals.css'
import SwRegister from '@/components/SwRegister'
import PushPrompt from '@/components/PushPrompt'

export const metadata: Metadata = {
  title: 'Fayko',
  description: 'Pilotage YaatalCo — focus, projets, prospects, missions',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Fayko',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#BF492C',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        {children}
        <SwRegister />
        <PushPrompt />
      </body>
    </html>
  )
}
