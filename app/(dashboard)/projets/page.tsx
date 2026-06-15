'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, ChevronRight, Briefcase, Cpu, Heart } from 'lucide-react'
import Link from 'next/link'
import type { Projet } from '@/lib/types'

const TYPE_CONFIG = {
  client:    { label: 'Client',    color: 'bg-orange-50 text-orange-600 border-orange-200', dot: 'bg-orange-400', icon: Briefcase },
  interne:   { label: 'Interne',   color: 'bg-blue-50 text-blue-600 border-blue-200',       dot: 'bg-blue-400',   icon: Cpu },
  personnel: { label: 'Personnel', color: 'bg-violet-50 text-violet-600 border-violet-200', dot: 'bg-violet-400', icon: Heart },
}

const STATUT_CONFIG = {
  actif:    { label: 'Actif',    badge: 'bg-green-50 text-green-600' },
  en_pause: { label: 'En pause', badge: 'bg-amber-50 text-amber-600' },
  termine:  { label: 'Terminé',  badge: 'bg-beige-100 text-muted' },
  archive:  { label: 'Archivé',  badge: 'bg-beige-50 text-muted/60' },
}

const TABS = ['Tous', 'Client', 'Interne', 'Personnel'] as const
type Tab = typeof TABS[number]

interface ProjetWithProgress extends Projet {
  etapes_total: number
  etapes_done: number
}

const emptyForm = { nom: '', type: 'client' as Projet['type'], client_nom: '', description: '' }

export default function ProjetsPage() {
  const [projets, setProjets] = useState<ProjetWithProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('Tous')
  const [showArchived, setShowArchived] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: projetsData }, { data: etapesData }] = await Promise.all([
      supabase.from('projets').select('*').order('created_at', { ascending: false }),
      supabase.from('etapes').select('projet_id, statut'),
    ])
    if (!projetsData) { setLoading(false); return }

    const etapesMap: Record<string, { total: number; done: number }> = {}
    for (const e of etapesData ?? []) {
      if (!etapesMap[e.projet_id]) etapesMap[e.projet_id] = { total: 0, done: 0 }
      etapesMap[e.projet_id].total++
      if (e.statut === 'termine') etapesMap[e.projet_id].done++
    }
    setProjets(projetsData.map(p => ({
      ...p,
      etapes_total: etapesMap[p.id]?.total ?? 0,
      etapes_done:  etapesMap[p.id]?.done  ?? 0,
    })))
    setLoading(false)
  }

  async function create() {
    if (!form.nom.trim()) return
    setSaving(true)
    const { data } = await supabase.from('projets').insert({
      nom: form.nom.trim(),
      type: form.type,
      client_nom: form.type === 'client' ? form.client_nom.trim() || null : null,
      description: form.description.trim() || null,
      statut: 'actif',
    }).select().single()
    if (data) setProjets(prev => [{ ...data, etapes_total: 0, etapes_done: 0 }, ...prev])
    setForm(emptyForm)
    setShowForm(false)
    setSaving(false)
  }

  const filtered = projets.filter(p => {
    if (!showArchived && p.statut === 'archive') return false
    if (tab === 'Tous') return true
    return p.type === tab.toLowerCase()
  })

  const hasArchived = projets.some(p => p.statut === 'archive')
  const actifCount  = projets.filter(p => p.statut === 'actif').length

  if (loading) return <div className="text-muted text-sm pt-8 text-center">Chargement…</div>

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Projets</h1>
          <p className="text-xs text-muted mt-0.5">{actifCount} actif{actifCount !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 bg-primary text-white text-sm font-medium px-3 py-2 rounded-xl hover:bg-primary-dark transition"
        >
          <Plus size={15} /> Nouveau
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-surface border border-primary/20 rounded-2xl p-4 space-y-3">
          <input
            autoFocus
            value={form.nom}
            onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && create()}
            placeholder="Nom du projet…"
            className="w-full text-sm border border-border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-beige-50"
          />
          <div className="flex gap-1.5">
            {(['client', 'interne', 'personnel'] as const).map(t => (
              <button
                key={t}
                onClick={() => setForm(f => ({ ...f, type: t }))}
                className={`flex-1 text-xs py-2 rounded-xl border font-medium transition ${
                  form.type === t ? TYPE_CONFIG[t].color : 'border-border text-muted hover:border-stone-300'
                }`}
              >
                {TYPE_CONFIG[t].label}
              </button>
            ))}
          </div>
          {form.type === 'client' && (
            <input
              value={form.client_nom}
              onChange={e => setForm(f => ({ ...f, client_nom: e.target.value }))}
              placeholder="Nom du client…"
              className="w-full text-sm border border-border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-beige-50"
            />
          )}
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Description (optionnel)…"
            rows={2}
            className="w-full text-sm border border-border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-beige-50 resize-none"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="text-sm text-muted px-3 py-2 rounded-xl hover:bg-beige-100 transition"
            >
              Annuler
            </button>
            <button
              onClick={create}
              disabled={!form.nom.trim() || saving}
              className="bg-primary text-white text-sm font-medium px-3 py-2 rounded-xl disabled:opacity-40 hover:bg-primary-dark transition"
            >
              {saving ? 'Création…' : 'Créer'}
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-surface border border-border rounded-xl p-1">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 text-xs py-2 rounded-lg font-medium transition ${
              tab === t ? 'bg-primary text-white' : 'text-muted hover:text-ink'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 bg-surface border border-border rounded-2xl">
          <p className="text-3xl mb-2">📁</p>
          <p className="text-sm font-medium text-ink">
            Aucun projet {tab !== 'Tous' ? tab.toLowerCase() : ''}
          </p>
          <p className="text-xs text-muted mt-1">Clique sur &quot;Nouveau&quot; pour en créer un</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden divide-y divide-border/40">
        {filtered.map(p => {
          const cfg    = TYPE_CONFIG[p.type]
          const statut = STATUT_CONFIG[p.statut]
          const pct    = p.etapes_total > 0 ? Math.round((p.etapes_done / p.etapes_total) * 100) : 0
          return (
            <Link
              key={p.id}
              href={`/projets/${p.id}`}
              className="block p-4 hover:bg-beige-50 transition group"
            >
              <div className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${cfg.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-ink">{p.nom}</span>
                    {p.client_nom && <span className="text-xs text-muted">· {p.client_nom}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md border ${cfg.color}`}>{cfg.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${statut.badge}`}>{statut.label}</span>
                    {p.etapes_total > 0 && (
                      <span className="text-xs text-muted">{p.etapes_done}/{p.etapes_total} étapes</span>
                    )}
                  </div>
                  {p.description && (
                    <p className="text-xs text-muted mt-1.5 line-clamp-1">{p.description}</p>
                  )}
                  {p.etapes_total > 0 && (
                    <div className="mt-2 h-1 bg-beige-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-400' : 'bg-primary'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
                <ChevronRight size={16} className="text-muted group-hover:text-primary transition shrink-0 mt-0.5" />
              </div>
            </Link>
          )
        })}

        </div>
      )}

      {hasArchived && (
        <button
          onClick={() => setShowArchived(v => !v)}
          className="text-xs text-muted underline w-full text-center py-2"
        >
          {showArchived ? 'Masquer les archivés' : 'Voir les archivés'}
        </button>
      )}
    </div>
  )
}
