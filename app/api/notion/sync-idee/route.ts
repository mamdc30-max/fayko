import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

const STATUT_MAP: Record<string, string> = {
  en_attente:    'En attente',
  abandonnee:    'Abandonnée',
  en_evaluation: 'En évaluation',
  a_challenger:  'En attente',
  liee_projet:   'Intéressante',
}

export async function POST(req: NextRequest) {
  const token = process.env.NOTION_TOKEN
  const dbId  = process.env.NOTION_IDEAS_DB_ID

  if (!token || token.startsWith('secret_COLLER') || !dbId) {
    return NextResponse.json({ error: 'Notion non configuré — ajoute NOTION_TOKEN dans .env.local' }, { status: 503 })
  }

  try {
    const { texte, statut, notes } = await req.json() as {
      texte: string
      statut: string
      notes: string | null
    }

    const today = new Date().toISOString().split('T')[0]

    const body = {
      parent: { database_id: dbId },
      properties: {
        'Idée':        { title:      [{ text: { content: texte } }] },
        'Statut':      { select:     { name: STATUT_MAP[statut] ?? 'En attente' } },
        'Source':      { select:     { name: 'Fayko' } },
        'Archivée le': { date:       { start: today } },
        'Notes IA':    notes
          ? { rich_text: [{ text: { content: notes } }] }
          : { rich_text: [] },
      },
    }

    const res = await fetch('https://api.notion.com/v1/pages', {
      method:  'POST',
      headers: {
        Authorization:    `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type':   'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.json()
      console.error('[notion/sync-idee]', err)
      return NextResponse.json({ error: 'Erreur API Notion', detail: err?.message }, { status: 500 })
    }

    const page = await res.json()
    return NextResponse.json({ url: page.url })
  } catch (e) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
