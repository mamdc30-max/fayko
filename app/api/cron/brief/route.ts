import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Vercel cron envoie automatiquement : Authorization: Bearer <CRON_SECRET>
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const today = new Date().toISOString().split('T')[0]

  // Récupérer toutes les tâches non terminées
  const { data: taches } = await supabase
    .from('taches')
    .select('id, texte, priorite, date, echeance, faite')
    .eq('faite', false)
    .neq('source', 'agenda')

  const eff = (t: { echeance?: string | null; date?: string | null }) =>
    t.echeance ?? t.date ?? ''

  const retard     = (taches ?? []).filter(t => eff(t) < today)
  const aujourdhui = (taches ?? []).filter(t => eff(t) === today)
  const urgentes   = (taches ?? []).filter(t => t.priorite === 'haute')

  // Corps de la notification
  const parts: string[] = []
  if (urgentes.length)   parts.push(`🔴 ${urgentes.length} urgente${urgentes.length > 1 ? 's' : ''}`)
  if (retard.length)     parts.push(`⏰ ${retard.length} en retard`)
  if (aujourdhui.length) parts.push(`📅 ${aujourdhui.length} aujourd'hui`)
  const body = parts.length ? parts.join(' · ') : '✅ Tout est à jour'

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fayko.vercel.app'

  const resp = await fetch(`${appUrl}/api/push/send`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'x-push-secret': process.env.PUSH_SECRET ?? '',
    },
    body: JSON.stringify({
      title: '🌅 Brief matinal YaatalCo',
      body,
      url: '/',
      tag: 'brief-matinal',
    }),
  })

  const result = await resp.json()
  return NextResponse.json({
    ok: true,
    sent: result.sent ?? 0,
    urgentes: urgentes.length,
    retard:   retard.length,
    aujourdhui: aujourdhui.length,
  })
}
