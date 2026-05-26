import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Parser from 'rss-parser'
import { VEILLE_FEEDS } from '@/lib/veille-feeds'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/refresh-veille
// Lit tous les flux RSS configurés, génère les résumés et met à jour Supabase.
// Auth : Authorization: Bearer {AGENDA_SECRET}
// ─────────────────────────────────────────────────────────────────────────────

interface VeilleRow {
  titre: string
  resume: string
  source_url: string
  categorie: string
  type: string
  user_id: string
  date_veille: string
}

function getMondayOfWeek(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim()
}

function isThisWeek(dateStr: string | undefined): boolean {
  if (!dateStr) return false
  const pubDate = new Date(dateStr)
  const diffDays = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60 * 24)
  return diffDays <= 7
}

// Utilise Claude Haiku pour résumer si ANTHROPIC_API_KEY est définie
async function summarize(title: string, description: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || !description) return description.slice(0, 280)

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 180,
        messages: [{
          role: 'user',
          content: `En 2-3 phrases courtes en français, résume le contenu de cet épisode de podcast ou article. Commence directement par le sujet, sans "Cet épisode" ni "Cet article".\n\nTitre : ${title}\nDescription : ${description.slice(0, 1000)}`,
        }],
      }),
      signal: AbortSignal.timeout(8000),
    })
    const data = await res.json() as { content?: { text: string }[] }
    return data.content?.[0]?.text?.trim() ?? description.slice(0, 280)
  } catch {
    return description.slice(0, 280)
  }
}

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const auth   = req.headers.get('authorization') ?? ''
  const secret = process.env.AGENDA_SECRET

  // 1. Script PowerShell / cron → bearer secret
  if (secret && auth === `Bearer ${secret}`) return true

  // 2. Bouton dans l'app → JWT Supabase de l'admin
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return false

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  return user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL
}

export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const parser = new Parser({ timeout: 10000, headers: { 'User-Agent': 'Fayko/1.0' } })
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const today   = new Date().toISOString().split('T')[0]
  const monday  = getMondayOfWeek(new Date())
  const adminId = process.env.ADMIN_USER_ID!

  const rows: VeilleRow[] = []
  const errors: string[]  = []

  // Récupère tous les flux en parallèle (erreurs silencieuses par flux)
  await Promise.allSettled(
    VEILLE_FEEDS.map(async (feed) => {
      try {
        const parsed = await parser.parseURL(feed.url)

        const recentItems = parsed.items
          .filter(item => isThisWeek(item.pubDate ?? item.isoDate))
          .slice(0, feed.maxItems)

        for (const item of recentItems) {
          const rawDesc    = item.contentSnippet ?? item.content ?? item.summary ?? ''
          const cleanDesc  = stripHtml(rawDesc)

          // Podcasts → résumé enrichi ; articles courts → description directe
          const needsSummarize = feed.type === 'podcast' && cleanDesc.length > 80
          const resume = needsSummarize
            ? await summarize(item.title ?? '', cleanDesc)
            : cleanDesc.slice(0, 280)

          rows.push({
            titre:      (item.title ?? 'Sans titre').slice(0, 90),
            resume,
            source_url: item.link ?? item.guid ?? '',
            categorie:  feed.categorie,
            type:       feed.type,
            user_id:    adminId,
            date_veille: today,
          })
        }
      } catch (err) {
        const msg = `${feed.label}: ${err instanceof Error ? err.message : String(err)}`
        errors.push(msg)
        console.warn('[refresh-veille]', msg)
      }
    })
  )

  // Remplace les items de la semaine en cours
  await supabase
    .from('veille_items')
    .delete()
    .eq('user_id', adminId)
    .gte('date_veille', monday)

  if (rows.length > 0) {
    const { error: insertErr } = await supabase.from('veille_items').insert(rows)
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    success: true,
    count: rows.length,
    errors: errors.length > 0 ? errors : undefined,
  })
}
