'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Plus, Check, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import type { Projet, Etape, Tache } from '@/lib/types'

const TYPE_LABEL: Record<string, string> = {
  client: 'Client', interne: 'Interne', personnel: 'Personnel',
}
const TYPE_COLOR: Record<string, string> = {
  client:    'bg-orange-50 text-orange-600 border-orange-200',
  interne:   'bg-blue-50 text-blue-600 border-blue-200',
  personnel: 'bg-violet-50 text-violet-600 border-violet-200',
}
const STATUT_OPTIONS: Projet['statut'][] = ['actif', 'en_pause', 'termine', 'archive']
const STATUT_LABEL: Record<string, string> = {
  actif: 'Actif', en_pause: 'En pause', termine: 'Terminé', archive: 'Archivé',
}

interface EtapeWithTaches extends Etape {
  taches: Tache[]
  open: boolean
}

export default function ProjetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  const [projet, setProjet]   = useState<Projet | null>(null)
  const [etapes, setEtapes]   = useState<EtapeWithTaches[]>([])
  const [orphans, setOrphans] = useState<Tache[]>([])   // tâches sans étape
  const [loading, setLoading] = useState(true)

  const [newEtapeName, setNewEtapeName]       = useState('')
  const [addingEtape, setAddingEtape]         = useState(false)
  const [newTacheText, setNewTacheText]        = useState<Record<string, string>>({})   // key = etape_id | 'orphan'
  const [showStatutMenu, setShowStatutMenu]   = useState(false)
  const [savingStatut, setSavingStatut]       = useState(false)

  const load = useCallback(async () => {
    const [{ data: proj }, { data: etapesData }, { data: tachesData }] = await Promise.all([
      supabase.from('projets').select('*').eq('id', id).single(),
      supabase.from('etapes').select('*').eq('projet_id', id).order('ordre'),
      supabase.from('taches').select('*').eq('projet_id', id).order('created_at'),
    ])
    if (!proj) { router.replace('/projets'); return }
    setProjet(proj)

    const taches = (tachesData ?? []) as Tache[]
    const built: EtapeWithTaches[] = (etapesData ?? []).map(e => ({
      ...e,
      taches: taches.filter(t => t.etape_id === e.id),
      open: e.statut !== 'termine',
    }))
    setEtapes(built)
    setOrphans(taches.filter(t => !t.etape_id))
    setLoading(false)
  }, [id, router])

  useEffect(() => { load() }, [load])

  /* ── Statut projet ── */
  async function updateStatut(statut: Projet['statut']) {
    setSavingStatut(true)
    await supabase.from('projets').update({ statut }).eq('id', id)
    setProjet(p => p ? { ...p, statut } : p)
    setShowStatutMenu(false)
    setSavingStatut(false)
  }

  /* ── Étape : toggle done ── */
  async function toggleEtape(etapeId: string, done: boolean) {
    const statut = done ? 'termine' : 'en_cours'
    await supabase.from('etapes').update({ statut }).eq('id', etapeId)
    setEtapes(prev => prev.map(e => e.id === etapeId ? { ...e, statut } : e))
  }

  /* ── Étape : delete ── */
  async function deleteEtape(etapeId: string) {
    if (!confirm('Supprimer cette étape et ses tâches ?')) return
    await supabase.from('etapes').delete().eq('id', etapeId)
    setEtapes(prev => prev.filter(e => e.id !== etapeId))
  }

  /* ── Étape : create ── */
  async function createEtape() {
    const nom = newEtapeName.trim()
    if (!nom) return
    const ordre = etapes.length
    const { data } = await supabase.from('etapes').insert({
      projet_id: id, nom, ordre, statut: 'en_cours',
    }).select().single()
    if (data) setEtapes(prev => [...prev, { ...data, taches: [], open: true }])
    setNewEtapeName('')
    setAddingEtape(false)
  }

  /* ── Tâche : toggle done ── */
  async function toggleTache(tacheId: string, faite: boolean, etapeId: string | null) {
    await supabase.from('taches').update({ faite, faite_at: faite ? new Date().toISOString() : null }).eq('id', tacheId)
    if (etapeId) {
      setEtapes(prev => prev.map(e =>
        e.id === etapeId
          ? { ...e, taches: e.taches.map(t => t.id === tacheId ? { ...t, faite } : t) }
          : e
      ))
    } else {
      setOrphans(prev => prev.map(t => t.id === tacheId ? { ...t, faite } : t))
    }
  }

  /* ── Tâche : delete ── */
  async function deleteTache(tacheId: string, etapeId: string | null) {
    await supabase.from('taches').delete().eq('id', tacheId)
    if (etapeId) {
      setEtapes(prev => prev.map(e =>
        e.id === etapeId ? { ...e, taches: e.taches.filter(t => t.id !== tacheId) } : e
      ))
    } else {
      setOrphans(prev => prev.filter(t => t.id !== tacheId))
    }
  }

  /* ── Tâche : create ── */
  async function createTache(etapeId: string | null) {
    const key  = etapeId ?? 'orphan'
    const text = (newTacheText[key] ?? '').trim()
    if (!text) return
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('taches').insert({
      texte: text,
      faite: false,
      date: today,
      priorite: 'normale',
      source: 'manuel',
      projet_id: id,
      etape_id: etapeId,
    }).select().single()
    if (data) {
      if (etapeId) {
        setEtapes(prev => prev.map(e =>
          e.id === etapeId ? { ...e, taches: [...e.taches, data as Tache] } : e
        ))
      } else {
        setOrphans(prev => [...prev, data as Tache])
      }
    }
    setNewTacheText(prev => ({ ...prev, [key]: '' }))
  }

  if (loading || !projet) return <div className="text-muted text-sm pt-8 text-center">Chargement…</div>

  const cfg    = TYPE_COLOR[projet.type]
  const totalE = etapes.length
  const doneE  = etapes.filter(e => e.statut === 'termine').length

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-muted hover:text-stone-700 transition mb-3"
        >
          <ArrowLeft size={14} /> Projets
        </button>
        <div className="flex items-start gap-3 justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-stone-800 leading-tight">{projet.nom}</h1>
            {projet.client_nom && (
              <p className="text-sm text-muted mt-0.5">{projet.client_nom}</p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md border ${cfg}`}>
                {TYPE_LABEL[projet.type]}
              </span>
              {totalE > 0 && (
                <span className="text-xs text-muted">{doneE}/{totalE} étapes</span>
              )}
            </div>
            {projet.description && (
              <p className="text-sm text-muted mt-2 leading-relaxed">{projet.description}</p>
            )}
          </div>

          {/* Statut picker */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowStatutMenu(v => !v)}
              disabled={savingStatut}
              className={`text-xs px-2.5 py-1.5 rounded-xl border font-medium transition ${
                projet.statut === 'actif'    ? 'bg-green-50 text-green-600 border-green-200' :
                projet.statut === 'en_pause' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                projet.statut === 'termine'  ? 'bg-stone-100 text-stone-500 border-stone-200' :
                                               'bg-stone-50 text-stone-400 border-stone-200'
              }`}
            >
              {STATUT_LABEL[projet.statut]}
            </button>
            {showStatutMenu && (
              <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-xl shadow-md z-10 py-1 min-w-[120px]">
                {STATUT_OPTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => updateStatut(s)}
                    className={`w-full text-left text-xs px-3 py-2 hover:bg-beige-100 transition ${
                      s === projet.statut ? 'font-semibold text-primary' : 'text-stone-700'
                    }`}
                  >
                    {STATUT_LABEL[s]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {totalE > 0 && (
          <div className="mt-3 h-1.5 bg-stone-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${doneE === totalE ? 'bg-green-400' : 'bg-primary'}`}
              style={{ width: `${Math.round((doneE / totalE) * 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* Étapes */}
      <div className="space-y-3">
        {etapes.map(etape => (
          <EtapeSection
            key={etape.id}
            etape={etape}
            newText={newTacheText[etape.id] ?? ''}
            onNewTextChange={text => setNewTacheText(prev => ({ ...prev, [etape.id]: text }))}
            onToggleOpen={() => setEtapes(prev => prev.map(e => e.id === etape.id ? { ...e, open: !e.open } : e))}
            onToggleDone={done => toggleEtape(etape.id, done)}
            onDelete={() => deleteEtape(etape.id)}
            onAddTache={() => createTache(etape.id)}
            onToggleTache={(tid, faite) => toggleTache(tid, faite, etape.id)}
            onDeleteTache={tid => deleteTache(tid, etape.id)}
          />
        ))}
      </div>

      {/* Add étape */}
      {addingEtape ? (
        <div className="flex gap-2">
          <input
            autoFocus
            value={newEtapeName}
            onChange={e => setNewEtapeName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createEtape(); if (e.key === 'Escape') setAddingEtape(false) }}
            placeholder="Nom de l'étape…"
            className="flex-1 text-sm border border-border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-surface"
          />
          <button
            onClick={createEtape}
            disabled={!newEtapeName.trim()}
            className="bg-primary text-white text-sm px-3 py-2 rounded-xl disabled:opacity-40 hover:bg-primary-dark transition"
          >
            <Check size={16} />
          </button>
          <button
            onClick={() => setAddingEtape(false)}
            className="text-sm text-muted px-3 py-2 rounded-xl hover:bg-beige-100 transition"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAddingEtape(true)}
          className="flex items-center gap-2 text-sm text-muted hover:text-primary transition w-full py-2"
        >
          <Plus size={15} /> Ajouter une étape
        </button>
      )}

      {/* Tâches sans étape */}
      {(orphans.length > 0 || true) && (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Tâches générales
            </span>
          </div>
          <div className="p-3 space-y-0.5">
            {orphans.map(t => (
              <TacheRow
                key={t.id}
                tache={t}
                onToggle={faite => toggleTache(t.id, faite, null)}
                onDelete={() => deleteTache(t.id, null)}
              />
            ))}
            <AddTacheInline
              value={newTacheText['orphan'] ?? ''}
              onChange={text => setNewTacheText(prev => ({ ...prev, orphan: text }))}
              onAdd={() => createTache(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Sub-components ──────────────────────────────────────────────── */

function EtapeSection({
  etape, newText, onNewTextChange, onToggleOpen, onToggleDone, onDelete, onAddTache, onToggleTache, onDeleteTache,
}: {
  etape: EtapeWithTaches
  newText: string
  onNewTextChange: (t: string) => void
  onToggleOpen: () => void
  onToggleDone: (done: boolean) => void
  onDelete: () => void
  onAddTache: () => void
  onToggleTache: (id: string, faite: boolean) => void
  onDeleteTache: (id: string) => void
}) {
  const done     = etape.statut === 'termine'
  const doneCount = etape.taches.filter(t => t.faite).length

  return (
    <div className={`bg-surface border rounded-2xl overflow-hidden transition ${done ? 'border-green-200' : 'border-border'}`}>
      {/* Étape header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          onClick={() => onToggleDone(!done)}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition ${
            done ? 'border-green-400 bg-green-50' : 'border-stone-300 hover:border-primary'
          }`}
        >
          {done && <Check size={10} className="text-green-600" />}
        </button>
        <button
          onClick={onToggleOpen}
          className="flex-1 text-left flex items-center gap-2 min-w-0"
        >
          <span className={`text-sm font-semibold ${done ? 'line-through text-muted' : 'text-stone-800'}`}>
            {etape.nom}
          </span>
          {etape.taches.length > 0 && (
            <span className="text-xs text-muted shrink-0">{doneCount}/{etape.taches.length}</span>
          )}
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onToggleOpen} className="p-1 text-muted hover:text-stone-700 transition">
            {etape.open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button onClick={onDelete} className="p-1 text-muted hover:text-red-400 transition">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Tâches */}
      {etape.open && (
        <div className="border-t border-border px-3 py-2 space-y-0.5">
          {etape.taches.map(t => (
            <TacheRow
              key={t.id}
              tache={t}
              onToggle={faite => onToggleTache(t.id, faite)}
              onDelete={() => onDeleteTache(t.id)}
            />
          ))}
          <AddTacheInline
            value={newText}
            onChange={onNewTextChange}
            onAdd={onAddTache}
          />
        </div>
      )}
    </div>
  )
}

function TacheRow({ tache, onToggle, onDelete }: {
  tache: Tache
  onToggle: (faite: boolean) => void
  onDelete: () => void
}) {
  return (
    <div className={`flex items-center gap-3 py-2 px-2 rounded-xl group hover:bg-beige-50 transition ${tache.faite ? 'opacity-50' : ''}`}>
      <button
        onClick={() => onToggle(!tache.faite)}
        className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition ${
          tache.faite ? 'border-green-400 bg-green-50' : 'border-border hover:border-primary'
        }`}
      >
        {tache.faite && <Check size={9} className="text-green-600" />}
      </button>
      <span className={`flex-1 text-sm ${tache.faite ? 'line-through text-muted' : 'text-stone-700'}`}>
        {tache.texte}
      </span>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-red-400 transition"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

function AddTacheInline({ value, onChange, onAdd }: {
  value: string
  onChange: (t: string) => void
  onAdd: () => void
}) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <Plus size={13} className="text-muted shrink-0" />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onAdd()}
        placeholder="Ajouter une tâche…"
        className="flex-1 text-sm text-muted bg-transparent focus:outline-none placeholder:text-stone-300 py-1.5"
      />
      {value.trim() && (
        <button
          onClick={onAdd}
          className="text-xs text-primary font-medium hover:underline transition shrink-0"
        >
          Ajouter
        </button>
      )}
    </div>
  )
}
