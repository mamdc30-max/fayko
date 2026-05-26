'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Check, Trash2, ChevronDown, ChevronUp } from 'lucide-react'

interface Priorite {
  id: string
  semaine: string
  texte: string
  cochee: boolean
  ordre: number
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

type Tab = 'priorites' | 'revue'

export default function HebdoPage() {
  const currentWeek = getISOWeek()
  const [week, setWeek]           = useState(currentWeek)
  const [tab, setTab]             = useState<Tab>('priorites')
  const [priorites, setPriorites] = useState<Priorite[]>([])
  const [revue, setRevue]         = useState<Partial<Revue> & { semaine: string }>({ semaine: week })
  const [loading, setLoading]     = useState(true)
  const [newTexte, setNewTexte]   = useState('')
  const [saving, setSaving]       = useState(false)
  const [showRevue, setShowRevue] = useState(false)

  useEffect(() => { loadWeek(week) }, [week])

  async function loadWeek(w: string) {
    setLoading(true)
    const [{ data: pData }, { data: rData }] = await Promise.all([
      supabase.from('priorites_hebdo').select('*').eq('semaine', w).order('ordre'),
      supabase.from('revues_hebdo').select('*').eq('semaine', w).maybeSingle(),
    ])
    setPriorites((pData ?? []) as Priorite[])
    setRevue(rData ? rData as Revue : { ...EMPTY_REVUE, semaine: w })
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

  /* ── Priorités ── */

  async function addPriorite() {
    if (!newTexte.trim()) return
    const ordre = priorites.length
    const { data } = await supabase.from('priorites_hebdo').insert({
      semaine: week, texte: newTexte.trim(), cochee: false, ordre,
    }).select().single()
    if (data) setPriorites(prev => [...prev, data as Priorite])
    setNewTexte('')
  }

  async function togglePriorite(id: string, cochee: boolean) {
    await supabase.from('priorites_hebdo').update({ cochee }).eq('id', id)
    setPriorites(prev => prev.map(p => p.id === id ? { ...p, cochee } : p))
  }

  async function deletePriorite(id: string) {
    await supabase.from('priorites_hebdo').delete().eq('id', id)
    setPriorites(prev => prev.filter(p => p.id !== id))
  }

  /* ── Revue ── */

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
        <h1 className="text-xl font-bold text-stone-800">Semaine</h1>
        <div className="flex items-center gap-3 mt-2">
          <button onClick={prevWeek} className="text-muted hover:text-stone-700 transition p-1">‹</button>
          <div className="flex-1 text-center">
            <p className="text-sm font-semibold text-stone-800">{week}</p>
            <p className="text-xs text-muted">{formatWeekLabel(week)}</p>
          </div>
          <button onClick={nextWeek} disabled={isCurrentWeek} className="text-muted hover:text-stone-700 disabled:opacity-30 transition p-1">›</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface border border-border rounded-xl p-1">
        {([['priorites', 'Priorités'], ['revue', 'Revue']] as [Tab, string][]).map(([t, l]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 text-xs py-2 rounded-lg font-medium transition ${
              tab === t ? 'bg-primary text-white' : 'text-muted hover:text-stone-700'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* ── Priorités ── */}
      {tab === 'priorites' && (
        <div className="space-y-3">
          {priorites.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted">
              <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${coched === priorites.length ? 'bg-green-400' : 'bg-primary'}`}
                  style={{ width: priorites.length > 0 ? `${Math.round((coched / priorites.length) * 100)}%` : '0%' }}
                />
              </div>
              <span className="shrink-0">{coched}/{priorites.length}</span>
            </div>
          )}

          <div className="bg-surface border border-border rounded-2xl p-3 space-y-0.5">
            {priorites.map(p => (
              <div key={p.id} className={`flex items-center gap-3 py-2.5 px-2 rounded-xl group hover:bg-beige-50 transition ${p.cochee ? 'opacity-50' : ''}`}>
                <button
                  onClick={() => togglePriorite(p.id, !p.cochee)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition ${
                    p.cochee ? 'border-green-400 bg-green-50' : 'border-border hover:border-primary'
                  }`}
                >
                  {p.cochee && <Check size={10} className="text-green-600" />}
                </button>
                <span className={`flex-1 text-sm ${p.cochee ? 'line-through text-muted' : 'text-stone-700'}`}>{p.texte}</span>
                <button
                  onClick={() => deletePriorite(p.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-red-400 transition"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}

            {/* Add inline */}
            <div className="flex items-center gap-2 pt-1">
              <Plus size={13} className="text-muted shrink-0" />
              <input
                value={newTexte}
                onChange={e => setNewTexte(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addPriorite()}
                placeholder="Ajouter une priorité…"
                className="flex-1 text-sm text-muted bg-transparent focus:outline-none placeholder:text-stone-300 py-1.5"
              />
              {newTexte.trim() && (
                <button onClick={addPriorite} className="text-xs text-primary font-medium hover:underline shrink-0">
                  Ajouter
                </button>
              )}
            </div>
          </div>

          {priorites.length === 0 && !newTexte && (
            <p className="text-xs text-muted text-center py-2">
              Définis 3 à 5 priorités pour cette semaine
            </p>
          )}
        </div>
      )}

      {/* ── Revue ── */}
      {tab === 'revue' && (
        <div className="space-y-4">
          {/* Score */}
          <div className="bg-surface border border-border rounded-2xl p-4">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Score de la semaine</p>
            <div className="flex items-center gap-3">
              <span className="text-sm text-stone-700">Priorités atteintes :</span>
              <input
                type="number"
                min={0}
                max={priorites.length || 10}
                value={revue.priorites_atteintes ?? ''}
                onChange={e => setRevue(r => ({ ...r, priorites_atteintes: parseInt(e.target.value) || null }))}
                className="w-14 text-center text-sm border border-border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-beige-50"
              />
              <span className="text-sm text-muted">/ {priorites.length}</span>
            </div>
          </div>

          {/* Questions */}
          {([
            ['ce_qui_a_marche',              '✅ Ce qui a marché'],
            ['ce_qui_na_pas_avance',         '⚠️ Ce qui n\'a pas avancé'],
            ['apprentissages',               '💡 Apprentissages'],
            ['celebration',                  '🎉 Célébration'],
            ['ajustements_semaine_suivante', '🔄 Ajustements pour la semaine prochaine'],
          ] as [keyof Revue, string][]).map(([field, label]) => (
            <div key={field} className="bg-surface border border-border rounded-2xl p-4 space-y-2">
              <p className="text-xs font-semibold text-stone-700">{label}</p>
              <textarea
                value={(revue[field] as string) ?? ''}
                onChange={e => setRevue(r => ({ ...r, [field]: e.target.value || null }))}
                rows={2}
                placeholder="Tape ta réponse…"
                className="w-full text-sm border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-beige-50 resize-none"
              />
            </div>
          ))}

          <button
            onClick={saveRevue}
            disabled={saving}
            className="w-full bg-primary text-white text-sm font-medium py-3 rounded-xl hover:bg-primary-dark disabled:opacity-40 transition"
          >
            {saving ? 'Sauvegarde…' : 'Sauvegarder la revue'}
          </button>
        </div>
      )}
    </div>
  )
}
