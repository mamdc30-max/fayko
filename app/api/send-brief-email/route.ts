import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// POST /api/send-brief-email
// Envoie le brief du matin par email à l'admin
// Auth : Authorization: Bearer {AGENDA_SECRET}

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const MOIS  = ['jan.', 'fév.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

function formatJour(date: Date): string {
  return `${JOURS[date.getDay()]} ${date.getDate()} ${MOIS[date.getMonth()]}`
}

function listHtml(items: string[]): string {
  if (items.length === 0) return '<p style="color:#9ca3af;font-size:14px;margin:4px 0;">Aucun élément</p>'
  return items.map(i => `<li style="font-size:14px;color:#292524;line-height:1.6;margin:3px 0;">${i}</li>`).join('')
}

export async function POST(req: NextRequest) {
  const auth   = req.headers.get('authorization')
  const secret = process.env.AGENDA_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY non définie' }, { status: 500 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const adminId    = process.env.ADMIN_USER_ID!
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL!
  const today      = new Date().toISOString().split('T')[0]
  const jourLabel  = formatJour(new Date())
  const threeDaysAgo = new Date(); threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

  // Fetch données en parallèle
  const [
    { data: agendaItems },
    { data: tachesUrgentes },
    { data: contactsRelance },
    { data: autoLogs },
  ] = await Promise.all([
    supabase.from('taches')
      .select('texte,faite')
      .eq('user_id', adminId)
      .eq('date', today)
      .eq('source', 'agenda')
      .order('created_at'),

    supabase.from('taches')
      .select('texte,echeance,priorite')
      .eq('user_id', adminId)
      .eq('faite', false)
      .lte('echeance', today)
      .not('echeance', 'is', null)
      .order('echeance'),

    supabase.from('contacts_reseau')
      .select('prenom,entreprise,sujet')
      .eq('user_id', adminId)
      .eq('rappel_fait', false)
      .lte('created_at', threeDaysAgo.toISOString())
      .limit(5),

    supabase.from('automation_logs')
      .select('task_name,status,summary,ran_at')
      .eq('user_id', adminId)
      .order('ran_at', { ascending: false })
      .limit(5),
  ])

  // ── Composition des sections ───────────────────────────────────────────────

  const agendaHtml = listHtml(
    (agendaItems ?? []).map(t => `${t.faite ? '✅' : '🗓️'} ${t.texte}`)
  )

  const tachesHtml = listHtml(
    (tachesUrgentes ?? []).slice(0, 5).map(t => {
      const isOverdue = t.echeance && t.echeance < today
      return `${isOverdue ? '⚠️' : '📌'} ${t.texte}${t.echeance ? ` <span style="color:#f97316;font-size:12px;">(${t.echeance})</span>` : ''}`
    })
  )

  const reseauHtml = listHtml(
    (contactsRelance ?? []).map(c =>
      `👤 ${c.prenom}${c.entreprise ? ` · ${c.entreprise}` : ''}${c.sujet ? ` — ${c.sujet}` : ''}`
    )
  )

  const autoHtml = (autoLogs ?? []).map(log => {
    const icon   = log.status === 'success' ? '✅' : log.status === 'partial' ? '⚠️' : '❌'
    const label  = ({ brief_agenda: 'Brief agenda', veille_hebdo: 'Veille hebdo' } as Record<string, string>)[log.task_name] ?? log.task_name
    const heure  = new Date(log.ran_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    return `<li style="font-size:13px;color:#57534e;margin:3px 0;">${icon} <strong>${label}</strong> · ${heure} · ${log.summary ?? ''}</li>`
  }).join('') || '<li style="font-size:13px;color:#9ca3af;">Aucune automatisation récente</li>'

  // ── HTML de l'email ───────────────────────────────────────────────────────

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="background:#FDF8F0;margin:0;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;">

    <!-- Header -->
    <div style="background:#f97316;border-radius:16px;padding:24px;margin-bottom:20px;">
      <p style="color:rgba(255,255,255,0.7);font-size:12px;margin:0 0 4px;text-transform:uppercase;letter-spacing:.05em;">Fayko · Brief quotidien</p>
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0;">☀️ ${jourLabel}</h1>
    </div>

    <!-- Agenda -->
    <div style="background:#fff;border-radius:16px;padding:20px;margin-bottom:12px;border:1px solid #e7e5e4;">
      <h2 style="font-size:14px;font-weight:600;color:#292524;margin:0 0 12px;display:flex;align-items:center;gap:6px;">
        📅 Agenda du jour
      </h2>
      <ul style="margin:0;padding-left:20px;">${agendaHtml}</ul>
    </div>

    <!-- Tâches urgentes -->
    ${(tachesUrgentes ?? []).length > 0 ? `
    <div style="background:#fff;border-radius:16px;padding:20px;margin-bottom:12px;border:1px solid #fed7aa;">
      <h2 style="font-size:14px;font-weight:600;color:#292524;margin:0 0 12px;">
        ✅ Tâches à traiter aujourd'hui
      </h2>
      <ul style="margin:0;padding-left:20px;">${tachesHtml}</ul>
    </div>` : ''}

    <!-- Réseau J+3 -->
    ${(contactsRelance ?? []).length > 0 ? `
    <div style="background:#fff;border-radius:16px;padding:20px;margin-bottom:12px;border:1px solid #e7e5e4;">
      <h2 style="font-size:14px;font-weight:600;color:#292524;margin:0 0 12px;">
        🤝 Réseau — À recontacter
      </h2>
      <ul style="margin:0;padding-left:20px;">${reseauHtml}</ul>
    </div>` : ''}

    <!-- Statut automations -->
    <div style="background:#f5f5f4;border-radius:16px;padding:16px;margin-bottom:20px;">
      <h2 style="font-size:12px;font-weight:600;color:#78716c;margin:0 0 8px;text-transform:uppercase;letter-spacing:.05em;">
        ⚙️ Statut automations
      </h2>
      <ul style="margin:0;padding-left:16px;">${autoHtml}</ul>
    </div>

    <!-- CTA -->
    <div style="text-align:center;padding-bottom:20px;">
      <a href="https://fayko.vercel.app"
        style="display:inline-block;background:#f97316;color:#fff;font-weight:600;font-size:14px;padding:12px 28px;border-radius:12px;text-decoration:none;">
        Ouvrir Fayko →
      </a>
    </div>

    <p style="text-align:center;font-size:11px;color:#a8a29e;">
      Envoyé automatiquement chaque matin par Fayko
    </p>
  </div>
</body>
</html>`

  // ── Envoi ─────────────────────────────────────────────────────────────────

  const resend = new Resend(resendKey)
  const { error } = await resend.emails.send({
    from:    'Fayko <onboarding@resend.dev>',
    to:      adminEmail,
    subject: `☀️ Ton brief du ${jourLabel} — Fayko`,
    html,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
