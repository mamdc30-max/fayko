import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// POST /api/import-veille
// Body: { items: VeilleItemInput[] }
// Header: Authorization: Bearer {AGENDA_SECRET}
//
// Remplace tous les items de la semaine en cours pour l'admin.

interface VeilleItemInput {
  titre: string
  resume: string
  source_url: string
  categorie: 'communication' | 'diaspora' | 'linkedin' | 'outils'
  type: 'article' | 'evenement' | 'outil' | 'tendance' | 'podcast'
}

function getMondayOfWeek(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split('T')[0]
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

  const { items } = (await req.json()) as { items: VeilleItemInput[] }
  const today   = new Date().toISOString().split('T')[0]
  const monday  = getMondayOfWeek(new Date())
  const adminId = process.env.ADMIN_USER_ID!

  // Supprime les items de la semaine en cours
  await supabase
    .from('veille_items')
    .delete()
    .eq('user_id', adminId)
    .gte('date_veille', monday)

  // Insère les nouveaux items
  if (items.length > 0) {
    const rows = items.map(item => ({
      titre:      item.titre,
      resume:     item.resume ?? null,
      source_url: item.source_url ?? null,
      categorie:  item.categorie,
      type:       item.type,
      date_veille: today,
      user_id:    adminId,
    }))

    const { error } = await supabase.from('veille_items').insert(rows)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, count: items.length })
}
