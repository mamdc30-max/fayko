import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: NextRequest) {
  try {
    const { texte, messages }: { texte: string; messages: Message[] } = await req.json()

    const systemPrompt = `Tu es un sparring partner intellectuel pour Mame Diarra, consultante en communication pour entrepreneurs de la diaspora africaine (YaatalCo).

Elle vient de capturer une idee brute. Ton role : la challenger avec bienveillance mais avec rigueur pour l'aider a affiner ou abandonner l'idee AVANT de penser a l'execution.

Regles absolues :
- Pose UNE seule question a la fois, courte et percutante
- Challenge les hypotheses implicites : "pour qui vraiment ?", "pourquoi maintenant ?", "qu'est-ce qui prouve que c'est un vrai besoin ?"
- Si l'idee semble solide apres 3-4 echanges, dis-le et encourage a passer a l'evaluation
- Jamais plus de 2-3 phrases par reponse
- Parle en francais direct, pas de jargon
- Tu n'es PAS un assistant complaisant : tu poses des questions difficiles

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
