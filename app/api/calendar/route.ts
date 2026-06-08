import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export interface CalEvent {
  title: string
  startTime: string   // "09:00" ou "Journée entière"
  endTime: string     // "10:30" ou ""
  location: string
  allDay: boolean
  sortKey: number
}

// ── Helpers ICS ────────────────────────────────────────────────────────────────

function unfold(ics: string): string {
  return ics.replace(/\r?\n[ \t]/g, '')
}

function unescapeICS(s: string): string {
  return s.replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')
}

// Convert wall-clock local time → UTC using Intl "twin" trick
function localToUTC(val: string, tz: string): Date {
  const y  = parseInt(val.slice(0, 4))
  const mo = parseInt(val.slice(4, 6)) - 1
  const d  = parseInt(val.slice(6, 8))
  const h  = parseInt(val.slice(9, 11))
  const mi = parseInt(val.slice(11, 13))
  const s  = parseInt(val.length >= 15 ? val.slice(13, 15) : '0')
  const iso = `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:${String(s).padStart(2, '0')}`

  const utcGuess = new Date(iso + 'Z')
  try {
    const fmted = new Intl.DateTimeFormat('sv-SE', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(utcGuess)
    const offset = utcGuess.getTime() - new Date(fmted.replace(' ', 'T') + 'Z').getTime()
    return new Date(utcGuess.getTime() + offset)
  } catch {
    return new Date(y, mo, d, h, mi, s)
  }
}

// Parse DTSTART/DTEND suffix (everything after the property name)
// e.g. ";TZID=Europe/Paris:20260608T090000"  or  ":20260608T070000Z"  or  ";VALUE=DATE:20260608"
function parseDT(suffix: string): { date: Date; allDay: boolean } | null {
  const colonIdx = suffix.lastIndexOf(':')
  if (colonIdx < 0) return null
  const params = suffix.slice(0, colonIdx).toLowerCase()
  const val    = suffix.slice(colonIdx + 1).trim()
  if (!val) return null

  // All-day
  if (params.includes('value=date') || val.length === 8) {
    const y = parseInt(val.slice(0, 4))
    const mo = parseInt(val.slice(4, 6)) - 1
    const d  = parseInt(val.slice(6, 8))
    return { date: new Date(y, mo, d), allDay: true }
  }

  if (val.length < 15) return null
  const y  = parseInt(val.slice(0, 4))
  const mo = parseInt(val.slice(4, 6)) - 1
  const d  = parseInt(val.slice(6, 8))
  const h  = parseInt(val.slice(9, 11))
  const mi = parseInt(val.slice(11, 13))
  const s  = parseInt(val.length >= 15 ? val.slice(13, 15) : '0')

  // UTC
  if (val.endsWith('Z')) {
    return { date: new Date(Date.UTC(y, mo, d, h, mi, s)), allDay: false }
  }

  // Timezone
  const tzMatch = params.match(/tzid=([^;]+)/)
  const tz = tzMatch ? decodeURIComponent(tzMatch[1]) : 'Europe/Paris'
  return { date: localToUTC(val, tz), allDay: false }
}

function todayParis(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(new Date())
}

function fmtTime(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

function dayInParis(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(date)
}

// ── Parse ICS ──────────────────────────────────────────────────────────────────

function parseICS(raw: string, today: string): CalEvent[] {
  const lines = unfold(raw).split(/\r?\n/)
  const events: CalEvent[] = []
  let inEvent = false
  let ev: Record<string, string> = {}

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { inEvent = true; ev = {}; continue }

    if (line === 'END:VEVENT') {
      inEvent = false
      const dtstart = parseDT(ev.DTSTART ?? '')
      if (!dtstart) continue

      // Filter to today
      const eventDay = dtstart.allDay
        ? (() => {
            const d = dtstart.date
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          })()
        : dayInParis(dtstart.date)
      if (eventDay !== today) continue

      if ((ev.STATUS ?? '').toUpperCase() === 'CANCELLED') continue

      const title = unescapeICS(ev.SUMMARY ?? '(Sans titre)')
      const location = unescapeICS(ev.LOCATION ?? '')

      if (dtstart.allDay) {
        events.push({ title, startTime: 'Journée entière', endTime: '', location, allDay: true, sortKey: -1 })
        continue
      }

      const startTime = fmtTime(dtstart.date)
      const dtend = parseDT(ev.DTEND ?? '')
      const endTime = dtend && !dtend.allDay ? fmtTime(dtend.date) : ''
      events.push({ title, startTime, endTime, location, allDay: false, sortKey: dtstart.date.getTime() })
      continue
    }

    if (!inEvent) continue

    const colonIdx = line.indexOf(':')
    if (colonIdx < 0) continue
    const propFull = line.slice(0, colonIdx)
    const propName = propFull.split(';')[0].toUpperCase()

    if (['SUMMARY', 'LOCATION', 'STATUS'].includes(propName)) {
      ev[propName] = line.slice(colonIdx + 1)
    } else if (propName === 'DTSTART' || propName === 'DTEND') {
      ev[propName] = line.slice(propName.length)   // includes params + ":" + value
    }
  }

  return events.sort((a, b) => a.sortKey - b.sortKey)
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: s } = await supabase.from('settings').select('gcal_ics_url').eq('id', 1).single()
  const icsUrl: string | null = (s as { gcal_ics_url?: string | null } | null)?.gcal_ics_url ?? null

  if (!icsUrl) {
    return NextResponse.json({ events: [], configured: false })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const resp = await fetch(icsUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Fayko/1.0 Calendar' },
    })
    clearTimeout(timeout)

    if (!resp.ok) {
      return NextResponse.json({ events: [], configured: true, error: `HTTP ${resp.status}` })
    }

    const ics = await resp.text()
    const events = parseICS(ics, todayParis())
    return NextResponse.json({ events, configured: true })
  } catch (err) {
    return NextResponse.json({ events: [], configured: true, error: String(err) })
  }
}
