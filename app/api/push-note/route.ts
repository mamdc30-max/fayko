import { NextRequest, NextResponse } from 'next/server'
import { logAutomation } from '@/lib/automation-logger'

// POST /api/push-note
// Endpoint universel : n'importe quelle tâche Claude pousse son output ici
// Body: { task_name: string, content: string, status?: "success"|"error"|"partial" }
// Auth : Authorization: Bearer {AGENDA_SECRET}

export async function POST(req: NextRequest) {
  const auth   = req.headers.get('authorization')
  const secret = process.env.AGENDA_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const body = (await req.json()) as {
    task_name: string
    content: string
    status?: 'success' | 'error' | 'partial'
  }

  if (!body.task_name || !body.content) {
    return NextResponse.json({ error: 'task_name et content requis' }, { status: 400 })
  }

  await logAutomation({
    task_name: body.task_name,
    status: body.status ?? 'success',
    summary: body.content.slice(0, 500),
  })

  return NextResponse.json({ success: true })
}
