import { NextRequest, NextResponse } from 'next/server'

// POST /api/next-step
// Prend un prospect + ses interactions, retourne la prochaine action suggérée
export async function POST(req: NextRequest) {
  const { prospect, interactions } = await req.json() as {
    prospect: {
      prenom: string; nom?: string; entreprise?: string | null
      statut: string; offre_associee?: string | null; notes?: string | null
    }
    interactions: { type: string; label?: string | null; date: string; notes?: string | null }[]
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ suggestion: null })
  }

  const name    = [prospect.prenom, prospect.nom].filter(Boolean).join(' ')
  const interStr = interactions?.length
    ? interactions.slice(0, 5).map(i => `${i.type} le ${i.date}${i.label ? ` (${i.label})` : ''}${i.notes ? ` — ${i.notes}` : ''}`).join(' ; ')
    : 'aucune interaction enregistrée'

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 80,
        messages: [{
          role: 'user',
          content: `Tu es consultante en communication pour entrepreneurs de la diaspora africaine. Prospect : ${name}, ${prospect.entreprise ?? 'entreprise ?'}, statut pipeline : ${prospect.statut}, offre : ${prospect.offre_associee ?? 'non définie'}. Interactions : ${interStr}. Donne UNE prochaine action concrète en 1 phrase courte (ex: "Envoyer la proposition retravaillée avec le budget ajusté"). Sans ponctuation finale, sans préambule.`,
        }],
      }),
      signal: AbortSignal.timeout(8000),
    })

    const data = await res.json() as { content?: { text: string }[] }
    const suggestion = data.content?.[0]?.text?.trim()
    return NextResponse.json({ suggestion: suggestion ?? null })
  } catch {
    return NextResponse.json({ suggestion: null })
  }
}
