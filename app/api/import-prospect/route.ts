import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SECRET       = process.env.AGENDA_SECRET   ?? 'fayko-agenda-2026-mds'
const ADMIN_UID    = process.env.ADMIN_USER_ID

export async function POST(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const body      = await req.json()
  const items     = Array.isArray(body) ? body : [body]
  const today     = new Date().toISOString().split('T')[0]
  const imported: string[] = []
  const skipped:  string[] = []
  const errors:   { entreprise: string; reason: string }[] = []

  for (const p of items) {
    const entreprise = (p.entreprise ?? '').trim()
    if (!entreprise) { errors.push({ entreprise: '(vide)', reason: 'entreprise manquante' }); continue }

    // Évite les doublons : même entreprise déjà dans Source
    const { data: existing } = await supabase
      .from('prospects')
      .select('id')
      .eq('entreprise', entreprise)
      .eq('statut', 'source')
      .eq('user_id', ADMIN_UID)
      .maybeSingle()

    if (existing) { skipped.push(entreprise); continue }

    const { error } = await supabase.from('prospects').insert({
      user_id:        ADMIN_UID,
      prenom:         p.dirigeant_prenom ?? '',
      nom:            p.dirigeant_nom    ?? p.dirigeant ?? '',
      entreprise,
      secteur:        p.secteur         ?? null,
      ville:          p.ville           ?? null,
      score_site:     p.score_site      ?? null,
      score_linkedin: p.score_linkedin  ?? null,
      canal_propose:  p.canal_propose   ?? 'linkedin',
      message_type:   p.message_propose ?? null,
      source_detail:  p.source          ?? null,
      montant_estime: 0,
      notes:          p.notes           ?? null,
      statut:         'source',
      last_action_at: today,
    })

    if (error) errors.push({ entreprise, reason: error.message })
    else       imported.push(entreprise)
  }

  return NextResponse.json({ imported: imported.length, skipped: skipped.length, errors })
}
