'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Check, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import type { Tache } from '@/lib/types'

const PRIORITE = {
  haute:   { label: 'Haute',   dot: 'bg-red-400',     badge: 'bg-red-50 text-red-500 border-red-200' },
  normale: { label: 'Normale', dot: 'bg-border',      badge: 'bg-beige-50 text-muted border-border' },
  basse:   { label: 'Basse',   dot: 'bg-emerald-300', badge: 'bg-emerald-50 text-emerald-500 border-emerald-200' },
}

function formatEcheance(date: string): string {
  const today = new Date().toISOString().split('T')[0]
  if (date === today) return "Aujourd'hui"
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function EcheanceBadge({ date }: { date: string }) {
  const today = new Date().toISOString().split('T')[0]
  const isOverdue = date < today
  const isToday = date === today
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
      isOverdue ? 'bg-red-50 text-red-500' :
      isToday   ? 'bg-primary-light text-primary' :
                  'bg-beige-50 text-muted'
    }`}>
      {formatEcheance(date)}
    </span>
  )
}

interface TaskRowProps {
  tache: Tache
  onToggle: (id: string, faite: boolean) => void
  onDelete: (id: string) => void
}

function TaskRow({ tache, onToggle, onDelete }: TaskRowProps) {
  const p = PRIORITE[tache.priorite] ?? PRIORITE.normale
  return (
    <div className={`flex items-center gap-3 py-2.5 px-3 rounded-xl group hover:bg-beige-50 transition ${tache.faite ? 'opacity-50' : ''}`}>
      <button
        onClick={() => onToggle(tache.id, !tache.faite)}
        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition ${
          tache.faite
            ? 'border-green-400 bg-green-50'
            : 'border-border hover:border-primary'
        }`}
      >
        {tache.faite && <Check size={10} className="text-green-600" />}
      </button>

      <span className={`flex-1 text-sm ${tache.faite ? 'line-through text-muted' : 'text-ink'}`}>
        {tache.texte}
      </span>

      <div className="flex items-center gap-1.5 shrink-0">
        {tache.echeance && !tache.faite && <EcheanceBadge date={tache.echeance} />}
        <span className={`w-2 h-2 rounded-full ${p.dot}`} title={p.label} />
        <button
          onClick={() => onDelete(tache.id)}
          className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-red-400 transition"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

function Section({ title, tasks, onToggle, onDelete, defaultOpen = true }: {
  title: string
  tasks: Tache[]
  onToggle: (id: string, faite: boolean) => void
  onDelete: (id: string) => void
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  if (tasks.length === 0) return null
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full py-1 text-left"
      >
        {open ? <ChevronDown size={13} className="text-muted" /> : <ChevronUp size={13} className="text-muted" />}
        <span className="text-xs font-semibold text-muted uppercase tracking-wider">{title}</span>
        <span className="text-xs text-muted ml-1">({tasks.length})</span>
      </button>
      {open && (
        <div className="mt-1 space-y-0.5">
          {tasks.map(t => (
            <TaskRow key={t.id} tache={t} onToggle={onToggle} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function TachesPage() {
  const [taches, setTaches] = useState<Tache[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newTexte, setNewTexte] = useState('')
  const [newEcheance, setNewEcheance] = useState('')
  const [newPriorite, setNewPriorite] = useState<'haute' | 'normale' | 'basse'>('normale')
  const [bulkLoading, setBulkLoading] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('taches')
      .select('*')
      .neq('source', 'agenda')
      .order('echeance', { ascending: true, nullsFirst: false })
    if (data) setTaches(data)
    setLoading(false)
  }

  async function add() {
    if (!newTexte.trim()) return
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('taches').insert({
      texte: newTexte.trim(),
      date: newEcheance || today,
      echeance: newEcheance || null,
      priorite: newPriorite,
      source: 'manuel',
      faite: false,
    }).select().single()
    if (data) setTaches(prev => [...prev, data].sort((a, b) => {
      if (!a.echeance && !b.echeance) return 0
      if (!a.echeance) return 1
      if (!b.echeance) return -1
      return a.echeance < b.echeance ? -1 : 1
    }))
    setNewTexte('')
    setNewEcheance('')
    setNewPriorite('normale')
    setShowForm(false)
  }

  async function toggle(id: string, faite: boolean) {
    await supabase.from('taches').update({ faite, faite_at: faite ? new Date().toISOString() : null }).eq('id', id)
    setTaches(prev => prev.map(t => t.id === id ? { ...t, faite } : t))
  }

  async function remove(id: string) {
    await supabase.from('taches').delete().eq('id', id)
    setTaches(prev => prev.filter(t => t.id !== id))
  }

  async function reporterToutes(ids: string[]) {
    if (!ids.length) return
    setBulkLoading(true)
    const todayStr = new Date().toISOString().split('T')[0]
    await supabase.from('taches').update({ date: todayStr, echeance: null }).in('id', ids)
    setTaches(prev => prev.map(t => ids.includes(t.id) ? { ...t, date: todayStr, echeance: null } : t))
    setBulkLoading(false)
  }

  async function supprimerToutes(ids: string[]) {
    if (!ids.length) return
    if (!confirm(`Supprimer ${ids.length} tâches en retard définitivement ?`)) return
    setBulkLoading(true)
    await supabase.from('taches').delete().in('id', ids)
    setTaches(prev => prev.filter(t => !ids.includes(t.id)))
    setBulkLoading(false)
  }

  const today = new Date().toISOString().split('T')[0]
  const endOfWeek = new Date()
  endOfWeek.setDate(endOfWeek.getDate() + 7)
  const endOfWeekStr = endOfWeek.toISOString().split('T')[0]

  const pending = taches.filter(t => !t.faite)
  const done = taches.filter(t => t.faite)

  // Date effective = echeance si définie, sinon date de planification
  const eff       = (t: Tache) => t.echeance ?? t.date
  const overdue   = pending.filter(t => eff(t) < today)
  const todayT    = pending.filter(t => eff(t) === today)
  const thisWeek  = pending.filter(t => eff(t) > today && eff(t) <= endOfWeekStr)
  const later     = pending.filter(t => eff(t) > endOfWeekStr)
  const noDate    = pending.filter(t => !t.echeance && !t.date)

  if (loading) return <div className="text-muted text-sm pt-8 text-center">Chargement…</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Tâches</h1>
          <p className="text-xs text-muted mt-0.5">
            {pending.length} à faire · {done.length} terminée{done.length > 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 bg-primary text-white text-sm font-medium px-3 py-2 rounded-xl hover:bg-primary-dark transition"
        >
          <Plus size={15} /> Nouvelle
        </button>
      </div>

      {/* Formulaire inline */}
      {showForm && (
        <div className="bg-surface border border-primary/20 rounded-2xl p-4 space-y-3">
          <input
            autoFocus
            value={newTexte}
            onChange={e => setNewTexte(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="Décris la tâche…"
            className="w-full text-sm border border-border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-beige-50"
          />
          <div className="flex gap-2 items-center flex-wrap">
            <input
              type="date"
              value={newEcheance}
              onChange={e => setNewEcheance(e.target.value)}
              className="text-sm border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-beige-50"
            />
            <div className="flex gap-1">
              {(Object.keys(PRIORITE) as (keyof typeof PRIORITE)[]).map(p => (
                <button
                  key={p}
                  onClick={() => setNewPriorite(p)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border transition font-medium ${
                    newPriorite === p ? PRIORITE[p].badge : 'border-border text-muted hover:border-primary/30'
                  }`}
                >
                  {PRIORITE[p].label}
                </button>
              ))}
            </div>
            <button
              onClick={add}
              disabled={!newTexte.trim()}
              className="ml-auto flex items-center gap-1 bg-primary text-white text-sm font-medium px-3 py-2 rounded-xl disabled:opacity-40 hover:bg-primary-dark transition"
            >
              <Check size={14} /> Ajouter
            </button>
          </div>
        </div>
      )}

      {/* Bannière retard bulk */}
      {overdue.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-600">
              {overdue.length} tâche{overdue.length > 1 ? 's' : ''} en retard
            </p>
            <p className="text-xs text-red-400 mt-0.5">Que veux-tu faire avec elles ?</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => reporterToutes(overdue.map(t => t.id))}
              disabled={bulkLoading}
              className="text-xs font-semibold bg-navy text-white px-3 py-1.5 rounded-xl hover:bg-navy-deep transition disabled:opacity-50"
            >
              {bulkLoading ? '…' : 'Reporter à aujourd\'hui'}
            </button>
            <button
              onClick={() => supprimerToutes(overdue.map(t => t.id))}
              disabled={bulkLoading}
              className="text-xs font-semibold text-red-600 border border-red-200 px-3 py-1.5 rounded-xl hover:bg-red-100 transition disabled:opacity-50"
            >
              Tout supprimer
            </button>
          </div>
        </div>
      )}

      {/* Sections groupées */}
      <div className="space-y-4 py-1">
        <Section title="🔴 En retard"    tasks={overdue}  onToggle={toggle} onDelete={remove} />
        <Section title="📅 Aujourd'hui" tasks={todayT}   onToggle={toggle} onDelete={remove} />
        <Section title="📆 Cette semaine" tasks={thisWeek} onToggle={toggle} onDelete={remove} />
        <Section title="🗓️ Plus tard"   tasks={later}    onToggle={toggle} onDelete={remove} />
        <Section title="Sans date"       tasks={noDate}   onToggle={toggle} onDelete={remove} />

        {pending.length === 0 && (
          <div className="text-center py-6">
            <p className="text-3xl mb-2">✅</p>
            <p className="text-sm font-medium text-ink">Tout est à jour !</p>
            <p className="text-xs text-muted mt-1">Clique sur "Nouvelle" pour ajouter une tâche</p>
          </div>
        )}
      </div>

      {/* Terminées */}
      {done.length > 0 && (
        <Section title="✓ Terminées" tasks={done} onToggle={toggle} onDelete={remove} defaultOpen={false} />
      )}
    </div>
  )
}
