import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    const { tachesFaites, interactions, prioritesCochees, prioritesTotal, prioritesTextes, semaine } = await req.json()

    const prompt = `Tu es un coach bienveillant qui aide Mame Diarra Thioune (YaatalCo — communication strategique B2B pour PME techniques : bureaux d'etudes, ingenierie, industrie, ESN) a faire sa revue de semaine.

Semaine : ${semaine}
Taches accomplies : ${tachesFaites} tache${tachesFaites !== 1 ? 's' : ''}
Interactions prospects : ${interactions} interaction${interactions !== 1 ? 's' : ''}
Priorites atteintes : ${prioritesCochees}/${prioritesTotal}
${prioritesTextes?.length ? `Priorites de la semaine :\n${prioritesTextes.map((t: string, i: number) => `- ${t}`).join('\n')}` : ''}

Redige une revue de semaine en JSON avec ces 5 champs (2-3 phrases max chacun, ton direct et encourage, en francais) :
- ce_qui_a_marche : ce qui s'est bien passe (base sur les stats et priorites)
- ce_qui_na_pas_avance : ce qui a freine (honnete mais constructif)
- apprentissages : la lecon cle de la semaine
- celebration : une victoire concrete a celebrer (meme petite)
- ajustements : une chose concrete a faire differemment la semaine prochaine

Reponds UNIQUEMENT en JSON valide, sans markdown.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) return NextResponse.json({ error: 'API error' }, { status: 500 })

    const data = await response.json()
    const text: string = data.content?.[0]?.text ?? ''

    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'Parse error' }, { status: 500 })

    const result = JSON.parse(match[0])
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
