import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logAutomation } from '@/lib/automation-logger'
import type { Prospect, ContactReseau } from '@/lib/types'

// POST /api/scan-crm
// Analyse le CRM et génère les actions du jour dans daily_focus
// Auth: Bearer AGENDA_SECRET

function daysSince(dateStr: string | null | undefined): number {
  if (!dateStr) return 999
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

interface FocusItem {
  categorie: 'crm' | 'sourcing' | 'contact'
  priorite: 1 | 2 | 3        // 1=urgent🔴 2=normal🟡 3=suggestion🔵
  action: string
  contexte: string | null
  lien_type: string | null
  lien_id: string | null
}

export async function POST(req: NextRequest) {
  const auth   = req.headers.get('authorization')
  const secret = process.env.AGENDA_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const adminId = process.env.ADMIN_USER_ID!
  const today   = new Date().toISOString().split('T')[0]

  const [{ data: prospects }, { data: contacts }] = await Promise.all([
    supabase.from('prospects').select('*').eq('user_id', adminId).not('statut', 'in', '("Client","Perdu")'),
    supabase.from('contacts_reseau').select('*').eq('user_id', adminId).eq('rappel_fait', false).eq('converti', false),
  ])

  const items: FocusItem[] = []

  // ── Scan Prospects ────────────────────────────────────────────────────────

  for (const p of (prospects ?? []) as Prospect[]) {
    const name = [p.prenom, p.nom].filter(Boolean).join(' ') || 'Prospect'
    const staleDays = daysSince(p.updated_at)

    if (p.statut === 'Proposition envoyée' && staleDays >= 5) {
      items.push({
        categorie: 'crm', priorite: 1,
        action: `Relancer ${name}`,
        contexte: `Proposition sans réponse depuis ${staleDays}j`,
        lien_type: 'prospect', lien_id: p.id,
      })
    } else if (p.statut === 'Appel découverte' && staleDays >= 3) {
      items.push({
        categorie: 'crm', priorite: 2,
        action: `Appel avec ${name}`,
        contexte: `Appel découverte planifié depuis ${staleDays}j`,
        lien_type: 'prospect', lien_id: p.id,
      })
    } else if (p.statut === 'Contacté' && staleDays >= 7) {
      items.push({
        categorie: 'crm', priorite: 2,
        action: `Qualifier ${name}`,
        contexte: `Contacté il y a ${staleDays}j — à faire avancer ou archiver`,
        lien_type: 'prospect', lien_id: p.id,
      })
    } else if (p.statut === 'Rencontré' && staleDays >= 3) {
      items.push({
        categorie: 'crm', priorite: 2,
        action: `Premier contact : ${name}`,
        contexte: `Rencontré il y a ${staleDays}j — pas encore contacté`,
        lien_type: 'prospect', lien_id: p.id,
      })
    }
  }

  // ── Sourcing : contacts réseau à transformer en prospects ─────────────────

  const sourcingCandidates = ((contacts ?? []) as ContactReseau[])
    .filter(c => daysSince(c.created_at) >= 14)
    .slice(0, 3)

  for (const c of sourcingCandidates) {
    items.push({
      categorie: 'sourcing', priorite: 3,
      action: `Proposer une offre à ${c.prenom}${c.entreprise ? ` (${c.entreprise})` : ''}`,
      contexte: `Dans tes contacts depuis ${daysSince(c.created_at)}j — non converti`,
      lien_type: 'contact_reseau', lien_id: c.id,
    })
  }

  // ── Sourcing IA (si ANTHROPIC_API_KEY définie) ────────────────────────────

  if (process.env.ANTHROPIC_API_KEY && prospects && prospects.length > 0) {
    try {
      const summary = (prospects as Prospect[]).slice(0, 8).map(p =>
        `${p.prenom} ${p.nom ?? ''} (${p.statut}, ${p.offre_associee ?? 'offre ?'}, ${daysSince(p.updated_at)}j)`
      ).join('; ')

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 200,
          messages: [{
            role: 'user',
            content: `Tu es consultante en communication pour entrepreneurs de la diaspora. Voici mon pipeline CRM: ${summary}. Donne 1 suggestion de sourcing en 1 phrase courte (ex: "Contacte les participants du Forum Afrique-Europe de la semaine dernière"). Réponds uniquement avec la suggestion, sans ponctuation finale.`,
          }],
        }),
        signal: AbortSignal.timeout(6000),
      })
      const data = await res.json() as { content?: { text: string }[] }
      const suggestion = data.content?.[0]?.text?.trim()
      if (suggestion) {
        items.push({
          categorie: 'sourcing', priorite: 3,
          action: suggestion,
          contexte: 'Suggestion IA basée sur ton pipeline',
          lien_type: null, lien_id: null,
        })
      }
    } catch { /* silently skip */ }
  }

  // ── Sauvegarde dans daily_focus ───────────────────────────────────────────

  // Supprime les items d'aujourd'hui avant de réinsérer
  await supabase.from('daily_focus').delete().eq('user_id', adminId).eq('date', today)

  if (items.length > 0) {
    await supabase.from('daily_focus').insert(
      items.map(item => ({ ...item, user_id: adminId, date: today }))
    )
  }

  await logAutomation({
    task_name: 'scan_crm',
    status: 'success',
    summary: `${items.filter(i => i.categorie === 'crm').length} actions CRM · ${items.filter(i => i.categorie === 'sourcing').length} suggestions sourcing`,
  })

  return NextResponse.json({ success: true, count: items.length, items })
}
