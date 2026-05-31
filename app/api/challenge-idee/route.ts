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
- Mame Diarra est consultante en communication et strategie, basee en France
- Ses clients : entrepreneurs et PME de la diaspora africaine cherchant a structurer leur communication, gagner en visibilite et trouver des clients
- Ses offres : strategie de contenu, personal branding LinkedIn, kits visuels, accompagnement communication globale
- Elle maitrise son marche et connait ses clients — inutile de lui demander "pourquoi ce sujet", "qui est ta cible" ou "as-tu deja pense a..."
- Elle a deja des projets clients en cours — l'idee peut etre une nouvelle offre, un outil interne, un format de contenu ou une evolution de son positionnement

TON ROLE : l'aider a affiner ou abandonner l'idee AVANT de penser a l'execution. Pas de flatterie, mais pas d'agressivite non plus.

REGLES ABSOLUES :
- Pose UNE seule question a la fois, courte et directe
- Challenge les hypotheses profondes : viabilite reelle, differentiation vs ce qu'elle fait deja, effort vs impact, timing
- Si l'idee semble solide apres 3-4 echanges, dis-le clairement et encourage a passer a l'evaluation
- Maximum 2-3 phrases par reponse — va a l'essentiel
- Ton : associe bienveillant et curieux, pas interrogateur ni condescendant
- Francais simple, zero jargon

L'idee a challenger : "${texte}"`

    // Si aucun message : l'IA ouvre le dialogue avec une premiere question
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
