'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
// no lucide icons needed

interface Priorite {
  id: string
  semaine: string
  texte: string
  cochee: boolean
  ordre: number
  tache_id?: string | null
}

interface WeekStats {
  tachesFaites: number
  interactions: number
}

interface Revue {
  id: string
  semaine: string
  priorites_atteintes: number | null
  priorites_total: number | null
  ce_qui_a_marche: string | null
  ce_qui_na_pas_avance: string | null
  apprentissages: string | null
  celebration: string | null
  ajustements_semaine_suivante: string | null
}

function getISOWeek(date = new Date()): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function weekToMonday(week: string): string {
  const [year, wStr] = week.split('-W')
  const w = parseInt(wStr)
  const jan4 = new Date(parseInt(year), 0, 4)
  const d = new Date(jan4)
  d.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1 + (w - 1) * 7)
  return d.toISOString().split('T')[0]
}

function formatWeekLabel(week: string): string {
  const [year, wStr] = week.split('-W')
  const w = parseInt(wStr)
  const jan4 = new Date(parseInt(year), 0, 4)
  const startOfWeek = new Date(jan4)
  startOfWeek.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1 + (w - 1) * 7)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  return `${fmt(startOfWeek)} – ${fmt(endOfWeek)}`
}

const EMPTY_REVUE: Omit<Revue, 'id' | 'semaine'> = {
  priorites_atteintes: null,
  priorites_total: null,
  ce_qui_a_marche: null,
  ce_qui_na_pas_avance: null,
  apprentissages: null,
  celebration: null,
  ajustements_semaine_suivante: null,
}

export default function HebdoPage() {
  const currentWeek = getISOWeek()
  const [week, setWeek]           = useState(currentWeek)
  const [priorites, setPriorites] = useState<Priorite[]>([])
  const [revue, setRevue]         = useState<Partial<Revue> & { semaine: string }>({ semaine: week })
  const [loading, setLoading]     = useState(true)
  const [weekStats,     setWeekStats]     = useState<WeekStats | null>(null)
  const [revueLoading,  setRevueLoading]  = useState(false)
  const [saving, setSaving]       = useState(false)
  const [showRevue, setShowRevue] = useState(false)

  useEffect(() => { loadWeek(week) }, [week])

  async function loadWeek(w: string) {
    setLoading(true)
    const monday = weekToMonday(w)
    const sunday = (() => { const d = new Date(monday); d.setDate(d.getDate() + 6); return d.toISOString().split('T')[0] })()

    const [{ data: pData }, { data: rData }, { count: tachesFaites }, { count: interactions }] = await Promise.all([
      supabase.from('priorites_hebdo').select('*').eq('semaine', w).order('ordre'),
      supabase.from('revues_hebdo').select('*').eq('semaine', w).maybeSingle(),
      supabase.from('taches').select('id', { count: 'exact', head: true }).eq('faite', true).gte('faite_at', monday).lte('faite_at', sunday + 'T23:59:59'),
      supabase.from('prospect_interactions').select('id', { count: 'exact', head: true }).gte('date', monday).lte('date', sunday),
    ])
    setPriorites((pData ?? []) as Priorite[])
    setRevue(rData ? rData as Revue : { ...EMPTY_REVUE, semaine: w })
    setWeekStats({ tachesFaites: tachesFaites ?? 0, interactions: interactions ?? 0 })
    setLoading(false)
  }

  function prevWeek() {
    const [year, wStr] = week.split('-W')
    const w = parseInt(wStr)
    if (w === 1) setWeek(`${parseInt(year) - 1}-W52`)
    else setWeek(`${year}-W${String(w - 1).padStart(2, '0')}`)
  }

  function nextWeek() {
    const [year, wStr] = week.split('-W')
    const w = parseInt(wStr)
    if (w === 52) setWeek(`${parseInt(year) + 1}-W01`)
    else setWeek(`${year}-W${String(w + 1).padStart(2, '0')}`)
  }

  /* ── Revue ── */

  async function generateRevue() {
    setRevueLoading(true)
    try {
      const res = await fetch('/api/generate-revue', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          semaine: week,
          tachesFaites: weekStats?.tachesFaites ?? 0,
          interactions: weekStats?.interactions ?? 0,
          prioritesCochees: priorites.filter(p => p.cochee).length,
          prioritesTotal: priorites.length,
          prioritesTextes: priorites.map(p => p.texte),
        }),
      })
      const data = await res.json()
      if (data.ce_qui_a_marche) {
        setRevue(r => ({
          ...r,
          ce_qui_a_marche:              data.ce_qui_a_marche              ?? r.ce_qui_a_marche,
          ce_qui_na_pas_avance:         data.ce_qui_na_pas_avance         ?? r.ce_qui_na_pas_avance,
          apprentissages:               data.apprentissages               ?? r.apprentissages,
          celebration:                  data.celebration                  ?? r.celebration,
          ajustements_semaine_suivante: data.ajustements                  ?? r.ajustements_semaine_suivante,
        }))
      }
    } catch {}
    setRevueLoading(false)
  }

  async function saveRevue() {
    setSaving(true)
    const payload = {
      semaine: week,
      priorites_atteintes: revue.priorites_atteintes ?? null,
      priorites_total: priorites.length || null,
      ce_qui_a_marche: revue.ce_qui_a_marche ?? null,
      ce_qui_na_pas_avance: revue.ce_qui_na_pas_avance ?? null,
      apprentissages: revue.apprentissages ?? null,
      celebration: revue.celebration ?? null,
      ajustements_semaine_suivante: revue.ajustements_semaine_suivante ?? null,
    }
    const { data } = await supabase
      .from('revues_hebdo')
      .upsert(payload, { onConflict: 'user_id,semaine' })
      .select()
      .single()
    if (data) setRevue(data as Revue)
    setSaving(false)
  }

  const coched = priorites.filter(p => p.cochee).length
  const isCurrentWeek = week === currentWeek

  if (loading) return <div className="text-muted text-sm pt-8 text-center">Chargement…</div>

  return (
    <div className="space-y-4">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-stone-800">Revue de la semaine</h1>
        <div className="flex items-center gap-3 mt-2">
          <button onClick={prevWeek} className="text-muted hover:text-stone-700 transition p-1">‹</button>
          <div className="flex-1 text-center">
            <p className="text-sm font-semibold text-stone-800">{week}</p>
            <p className="text-xs text-muted">{formatWeekLabel(week)}</p>
          </div>
          <button onClick={nextWeek} disabled={isCurrentWeek} className="text-muted hover:text-stone-700 disabled:opacity-30 transition p-1">›</button>
        </div>
      </div>

      {/* ── Revue de la semaine ── */}
      <div className="space-y-4">

        {/* Stats */}
        {weekStats && (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-green-50 border border-green-100 rounded-2xl p-3 text-center">
              <p className="text-xl font-bold text-green-600">{weekStats.tachesFaites}</p>
              <p className="text-[10px] text-green-700 mt-0.5">tâche{weekStats.tachesFaites !== 1 ? 's' : ''} faite{weekStats.tachesFaites !== 1 ? 's' : ''}</p>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 text-center">
              <p className="text-xl font-bold text-blue-600">{weekStats.interactions}</p>
              <p className="text-[10px] text-blue-700 mt-0.5">interaction{weekStats.interactions !== 1 ? 's' : ''}</p>
            </div>
            <div className={`rounded-2xl p-3 text-center border ${
              coched === priorites.length && priorites.length > 0
                ? 'bg-amber-50 border-amber-100'
                : 'bg-surface border-border'
            }`}>
              <p className={`text-xl font-bold ${coched === priorites.length && priorites.length > 0 ? 'text-amber-500' : 'text-primary'}`}>
                {coched}/{priorites.length}
              </p>
              <p className="text-[10px] text-muted mt-0.5">priorités</p>
            </div>
          </div>
        )}

        {/* Bouton IA */}
        <button
          onClick={generateRevue}
          disabled={revueLoading}
          className="w-full flex items-center justify-center gap-2 bg-navy hover:bg-navy-deep text-white text-sm font-semibold py-3.5 rounded-2xl transition disabled:opacity-50"
        >
          {revueLoading
            ? <><span className="animate-pulse">⏳</span> Analyse en cours...</>
            : <>✨ Générer ma revue de la semaine</>
          }
        </button>

        {/* Questions */}
        {([
          ['ce_qui_a_marche',              '✅ Ce qui a bien marché',                 'Qu\'est-ce qui t\'a rendu fière cette semaine ?'],
          ['ce_qui_na_pas_avance',         '⚠️ Ce qui n\'a pas avancé',               'Qu\'est-ce qui a bloqué ou pris plus de temps que prévu ?'],
          ['apprentissages',               '💡 Apprentissage clé',                    'Qu\'est-ce que tu retiens de cette semaine ?'],
          ['celebration',                  '🎉 Célébration',                          'Petite ou grande, quelle victoire mérite d\'être célébrée ?'],
          ['ajustements_semaine_suivante', '🔄 Ajustement pour la semaine prochaine', 'Une chose concrète à faire différemment'],
        ] as [keyof Revue, string, string][]).map(([field, label, placeholder]) => (
          <div key={field} className="bg-surface border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5 bg-stone-50 border-b border-border">
              <p className="text-xs font-bold text-stone-700">{label}</p>
            </div>
            <textarea
              value={(revue[field] as string) ?? ''}
              onChange={e => setRevue(r => ({ ...r, [field]: e.target.value || null }))}
              onBlur={saveRevue}
              rows={3}
              placeholder={placeholder}
              className="w-full text-sm px-4 py-3 focus:outline-none bg-transparent placeholder:text-stone-300 resize-none leading-relaxed"
            />
          </div>
        ))}

        <button
          onClick={saveRevue}
          disabled={saving}
          className="w-full bg-primary text-white text-sm font-medium py-3 rounded-xl hover:bg-primary-dark disabled:opacity-40 transition"
        >
          {saving ? 'Sauvegarde…' : '💾 Sauvegarder la revue'}
        </button>
      </div>
    </div>
  )
}
