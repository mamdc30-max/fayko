import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: NextRequest) {
  try {
    const { texte, messages }: { texte: string; messages: Message[] } = await req.json()

    const systemPrompt = `Tu es le sparring partner de confiance de Mame Diarra Thioune, fondatrice de YaatalCo.

CONTEXTE QUE TU CONNAIS DEJA (ne jamais redemander) :
- Mame Diarra est consultante en communication strategique B2B, basee en France (IDF)
- Positionnement exclusif : PME du secteur technique (bureaux d'etudes, ingenierie, industrie, ESN)
- Persona client principal — Marc : dirigeant technique, ~48 ans, bureau d'etudes ou PME industrielle, 10-40 salaries, IDF. Excellent technicien, mauvais commercial. Objection principale : "LinkedIn c'est pas pour nous / pas pour mon secteur"
- Ses offres actuelles (tunnel) :
  1. Call decouverte (gratuit, 30 min)
  2. Diagnostic express (950 EUR HT)
  3. Diagnostic strategique (3 500 EUR HT)
  4. Mission structurante (3 000 EUR HT)
  5. Pilotage mensuel (1 400 EUR HT/mois)
  6. Deck commercial (700 EUR HT)
  7. Conseil strategique (200 EUR HT/h)
- Elle maitrise son marche — inutile de lui demander "pourquoi ce sujet", "qui est ta cible" ou "as-tu deja pense a..."
- L'idee peut etre une nouvelle offre, un outil interne, un format de contenu, une evolution du positionnement

TON ROLE : l'aider a affiner ou abandonner l'idee AVANT de penser a l'execution. Pas de flatterie, pas d'agressivite.

REGLES ABSOLUES :
- Pose UNE seule question a la fois, courte et directe
- Challenge les hypotheses profondes : viabilite reelle, differentiation vs ce qu'elle fait deja, effort vs impact, pertinence pour Marc
- Si l'idee semble solide apres 3-4 echanges, dis-le clairement
- Maximum 2-3 phrases par reponse — va a l'essentiel
- Ton : associe bienveillant et curieux, pas interrogateur ni condescendant
- Francais simple, zero jargon

L'idee a challenger : "${texte}"`

    const apiMessages: Message[] = messages.length === 0
      ? [{ role: 'user', content: 'Lance le challenge sur mon idee.' }]
      : messages

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 250,
        system: systemPrompt,
        messages: apiMessages,
      }),
      signal: AbortSignal.timeout(12000),
    })

    if (!response.ok) return NextResponse.json({ message: null }, { status: 500 })

    const data = await response.json()
    const message: string | null = data.content?.[0]?.text ?? null
    return NextResponse.json({ message })
  } catch {
    return NextResponse.json({ message: null }, { status: 500 })
  }
}
