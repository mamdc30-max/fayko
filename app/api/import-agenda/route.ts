import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// POST /api/import-agenda
// Body: { items: string[] }  (textes des événements)
// Header: Authorization: Bearer {AGENDA_SECRET}
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const secret = process.env.AGENDA_SECRET

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { items } = (await req.json()) as { items: string[] }
  const today = new Date().toISOString().split('T')[0]
  const adminId = process.env.ADMIN_USER_ID!

  // Supprime les anciens événements agenda du jour
  await supabase
    .from('taches')
    .delete()
    .eq('user_id', adminId)
    .eq('date', today)
    .eq('source', 'agenda')

  // Insère les nouveaux
  if (items.length > 0) {
    await supabase.from('taches').insert(
      items.map(texte => ({
        texte,
        date: today,
        source: 'agenda',
        user_id: adminId,
        faite: false,
        priorite: 'normale',
      }))
    )
  }

  return NextResponse.json({ success: true, count: items.length })
}
