import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

interface BriefInput {
  taches:    { texte: string; priorite: string }[]
  prospects: { prenom: string; nom: string; entreprise: string | null; statut: string; last_action_at: string | null }[]
  projets:   { nom: string; etapes_done: number; etapes_total: number }[]
  priorites: string[]
}

export async function POST(req: NextRequest) {
  try {
    const { taches, prospects, projets, priorites }: BriefInput = await req.json()

    const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

    const tachesStr = taches.length === 0
      ? 'Aucune tache en attente'
      : taches.slice(0, 8).map(t => `[${t.priorite}] ${t.texte}`).join('\n')

    const prospectsStr = prospects.length === 0
      ? 'Aucun prospect actif'
      : prospects.slice(0, 6).map(p => {
          const name = [p.prenom, p.nom].filter(Boolean).join(' ') || p.entreprise || 'Inconnu'
          const days = p.last_action_at
            ? Math.floor((Date.now() - new Date(p.last_action_at).getTime()) / 86400000)
            : null
          return `${name} (${p.statut})${days !== null ? ` — dernier contact il y a ${days}j` : ''}`
        }).join('\n')

    const projetsStr = projets.length === 0
      ? 'Aucun projet actif'
      : projets.map(p => `${p.nom} (${p.etapes_done}/${p.etapes_total} etapes)`).join('\n')

    const prioritesStr = priorites.length === 0
      ? 'Aucune priorite definie cette semaine'
      : priorites.map(p => `- ${p}`).join('\n')

    const prompt = `Tu es l'assistante IA de Mame Diarra, consultante en communication pour entrepreneurs de la diaspora africaine (YaatalCo).

Aujourd'hui : ${today}

TACHES A FAIRE (${taches.length}) :
${tachesStr}

PROSPECTS EN COURS :
${prospectsStr}

PROJETS ACTIFS :
${projetsStr}

PRIORITES DE LA SEMAINE :
${prioritesStr}

Genere un brief de debut de journee en francais, concis et actionnable. Reponds UNIQUEMENT avec ce JSON valide :
{
  "salutation": "phrase d'accroche courte et motivante (1 phrase, tutoiement)",
  "actions": ["action 1 concrete avec nom de prospect ou projet", "action 2", "action 3"],
  "note": "1 observation ou opportunite a saisir aujourd'hui (peut etre null si rien de notable)"
}

Regles : actions precisent qui contacter ou quelle tache faire en premier, pas de generalites.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(12000),
    })

    if (!response.ok) return NextResponse.json({ error: 'api_error' }, { status: 500 })

    const data = await response.json()
    const text: string = data.content?.[0]?.text ?? ''

    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'parse_error' }, { status: 500 })

    const brief = JSON.parse(match[0]) as {
      salutation: string
      actions: string[]
      note: string | null
    }

    return NextResponse.json(brief)
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
