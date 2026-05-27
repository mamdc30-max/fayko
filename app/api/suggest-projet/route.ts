import { NextRequest, NextResponse } from 'next/server'

// POST /api/suggest-projet
// Prend une idée + liste de projets actifs, retourne le projet le plus pertinent
export async function POST(req: NextRequest) {
  const { texte, projets } = await req.json() as {
    texte: string
    projets: { id: string; nom: string; description?: string | null }[]
  }

  if (!process.env.ANTHROPIC_API_KEY || !projets?.length || !texte?.trim()) {
    return NextResponse.json({ projet_id: null, raison: null })
  }

  const list = projets
    .map(p => `- "${p.nom}"${p.description ? ` (${p.description})` : ''} [id:${p.id}]`)
    .join('\n')

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
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: `Idée : "${texte}"\n\nProjets actifs :\n${list}\n\nSi cette idée se rattache clairement à un projet, réponds uniquement avec ce JSON (sans markdown) :\n{"projet_id":"ID_EXACT","raison":"une phrase courte"}\n\nSinon réponds : {"projet_id":null,"raison":null}`,
        }],
      }),
      signal: AbortSignal.timeout(8000),
    })

    const data = await res.json() as { content?: { text: string }[] }
    const text = data.content?.[0]?.text?.trim()
    if (text) {
      const parsed = JSON.parse(text) as { projet_id: string | null; raison: string | null }
      // Vérifier que l'id retourné existe bien dans la liste
      if (parsed.projet_id && projets.some(p => p.id === parsed.projet_id)) {
        return NextResponse.json(parsed)
      }
    }
  } catch { /* silently skip */ }

  return NextResponse.json({ projet_id: null, raison: null })
}
