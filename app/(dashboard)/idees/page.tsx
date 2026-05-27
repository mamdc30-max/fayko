'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react'

type IdeaStatut =
  | 'capture'
  | 'a_challenger'
  | 'en_evaluation'
  | 'liee_projet'
  | 'transformee_tache'
  | 'transformee_projet'
  | 'en_attente'
  | 'abandonnee'

interface Idee {
  id: string
  texte: string
  statut: IdeaStatut
  notes: string | null
  projet_id: string | null
  created_at: string
}

interface Projet {
  id: string
  nom: string
  description?: string | null
}

interface IASuggestion {
  projet_id: string
  raison: string
  projet_nom: string
}

const STATUT_CONFIG: Record<IdeaStatut, { label: string; badge: string }> = {
  capture:           { label: 'Capturée',         badge: 'bg-stone-100 text-stone-500' },
  a_challenger:      { label: 'A challenger',      badge: 'bg-amber-50 text-amber-600' },
  en_evaluation:     { label: 'En evaluation',     badge: 'bg-blue-50 text-blue-600' },
  liee_projet:       { label: 'Liee a un projet',  badge: 'bg-violet-50 text-violet-600' },
  transformee_tache: { label: 'Tache creee',       badge: 'bg-green-50 text-green-600' },
  transformee_projet:{ label: 'Projet cree',       badge: 'bg-green-50 text-green-600' },
  en_attente:        { label: 'En attente',        badge: 'bg-stone-50 text-stone-400' },
  abandonnee:        { label: 'Abandonnee',        badge: 'bg-stone-50 text-stone-400' },
}

const ACTIVE_STATUTS: IdeaStatut[] = ['capture', 'a_challenger', 'en_evaluation', 'liee_projet']
const DONE_STATUTS:   IdeaStatut[] = ['transformee_tache', 'transformee_projet', 'en_attente', 'abandonnee']

const NEXT_ACTIONS: Partial<Record<IdeaStatut, { label: string; next: IdeaStatut }[]>> = {
  capture:       [{ label: 'Challenger', next: 'a_challenger' }, { label: 'Mettre en attente', next: 'en_attente' }],
  a_challenger:  [{ label: 'Evaluer',    next: 'en_evaluation' }, { label: 'Abandonner', next: 'abandonnee' }],
  en_evaluation: [{ label: 'Lier a un projet', next: 'liee_projet' }, { label: 'En attente', next: 'en_attente' }],
  liee_projet:   [{ label: 'Creer une tache', next: 'transformee_tache' }, { label: 'Creer un projet', next: 'transformee_projet' }],
}

export default function IdeesPage() {
  const [idees, setIdees]               = useState<Idee[]>([])
  const [projets, setProjets]           = useState<Projet[]>([])
  const [loading, setLoading]           = useState(true)
  const [showForm, setShowForm]         = useState(false)
  const [newTexte, setNewTexte]         = useState('')
  const [saving, setSaving]             = useState(false)
  const [expanded, setExpanded]         = useState<Record<string, boolean>>({})
  const [showDone, setShowDone]         = useState(false)
  const [suggestions, setSuggestions]   = useState<Record<string, IASuggestion>>({})

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: ideesData }, { data: projetsData }] = await Promise.all([
      supabase.from('idees').select('*').order('created_at', { ascending: false }),
      supabase.from('projets').select('id, nom, description').eq('statut', 'actif'),
    ])
    setIdees((ideesData ?? []) as Idee[])
    setProjets((projetsData ?? []) as Projet[])
    setLoading(false)
  }

  async function create() {
    if (!newTexte.trim()) return
    setSaving(true)
    const texteCapture = newTexte.trim()
    const { data } = await supabase.from('idees').insert({
      texte: texteCapture,
      statut: 'capture',
      notes: null,
      projet_id: null,
    }).select().single()

    if (data) {
      const newIdee = data as Idee
      setIdees(prev => [newIdee, ...prev])

      // Fire IA suggestion async — non-blocking
      if (projets.length > 0) {
        fetch('/api/suggest-projet', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ texte: texteCapture, projets }),
        })
          .then(r => r.json())
          .then((result: { projet_id: string | null; raison: string | null }) => {
            if (result.projet_id && result.raison) {
              const proj = projets.find(p => p.id === result.projet_id)
              if (proj) {
                setSuggestions(prev => ({
                  ...prev,
                  [newIdee.id]: {
                    projet_id: result.projet_id!,
                    raison: result.raison!,
                    projet_nom: proj.nom,
                  },
                }))
              }
            }
          })
          .catch(() => {})
      }
    }

    setNewTexte('')
    setShowForm(false)
    setSaving(false)
  }

  async function updateStatut(id: string, statut: IdeaStatut) {
    await supabase.from('idees').update({ statut }).eq('id', id)
    setIdees(prev => prev.map(i => i.id === id ? { ...i, statut } : i))
  }

  async function updateNotes(id: string, notes: string) {
    await supabase.from('idees').update({ notes: notes || null }).eq('id', id)
    setIdees(prev => prev.map(i => i.id === id ? { ...i, notes: notes || null } : i))
  }

  async function linkProjet(id: string, projet_id: string) {
    await supabase.from('idees').update({ projet_id, statut: 'liee_projet' }).eq('id', id)
    setIdees(prev => prev.map(i => i.id === id ? { ...i, projet_id, statut: 'liee_projet' } : i))
  }

  function dismissSuggestion(id: string) {
    setSuggestions(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  async function acceptSuggestion(idee: Idee, suggestion: IASuggestion) {
    await linkProjet(idee.id, suggestion.projet_id)
    dismissSuggestion(idee.id)
  }

  async function remove(id: string) {
    await supabase.from('idees').delete().eq('id', id)
    setIdees(prev => prev.filter(i => i.id !== id))
    dismissSuggestion(id)
  }

  const active = idees.filter(i => ACTIVE_STATUTS.includes(i.statut))
  const done   = idees.filter(i => DONE_STATUTS.includes(i.statut))

  if (loading) return <div className="text-muted text-sm pt-8 text-center">Chargement...</div>

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-stone-800">Idees</h1>
          <p className="text-xs text-muted mt-0.5">{active.length} active{active.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 bg-primary text-white text-sm font-medium px-3 py-2 rounded-xl hover:bg-primary-dark transition"
        >
          <Plus size={15} /> Capturer
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-surface border border-primary/20 rounded-2xl p-4 space-y-3">
          <textarea
            autoFocus
            value={newTexte}
            onChange={e => setNewTexte(e.target.value)}
            placeholder="Decris ton idee..."
            rows={3}
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
              disabled={!newTexte.trim() || saving}
              className="bg-primary text-white text-sm font-medium px-3 py-2 rounded-xl disabled:opacity-40 hover:bg-primary-dark transition"
            >
              {saving ? 'Capture...' : 'Capturer'}
            </button>
          </div>
        </div>
      )}

      {/* Active ideas */}
      <div className="space-y-2">
        {active.map(idee => {
          const cfg        = STATUT_CONFIG[idee.statut]
          const isOpen     = expanded[idee.id] ?? false
          const actions    = NEXT_ACTIONS[idee.statut] ?? []
          const linkedProj = projets.find(p => p.id === idee.projet_id)
          const suggestion = suggestions[idee.id]

          return (
            <div key={idee.id} className="bg-surface border border-border rounded-2xl overflow-hidden">

              {/* Header */}
              <button
                onClick={() => setExpanded(e => ({ ...e, [idee.id]: !e[idee.id] }))}
                className="w-full flex items-start gap-3 p-4 text-left hover:bg-beige-50 transition"
              >
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium shrink-0 mt-0.5 ${cfg.badge}`}>
                  {cfg.label}
                </span>
                <span className="flex-1 text-sm text-stone-800 leading-snug">{idee.texte}</span>
                {isOpen
                  ? <ChevronUp size={15} className="text-muted shrink-0" />
                  : <ChevronDown size={15} className="text-muted shrink-0" />}
              </button>

              {/* IA Suggestion banner */}
              {suggestion && (
                <div className="mx-4 mb-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex items-start gap-2">
                  <span className="text-sm shrink-0">&#x1F4A1;</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-amber-800 font-semibold leading-snug">
                      Lier a <strong>{suggestion.projet_nom}</strong>&nbsp;?
                    </p>
                    <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">{suggestion.raison}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => acceptSuggestion(idee, suggestion)}
                      className="text-[11px] bg-amber-500 text-white px-2 py-1 rounded-lg font-semibold hover:bg-amber-600 transition"
                    >
                      Lier
                    </button>
                    <button
                      onClick={() => dismissSuggestion(idee.id)}
                      className="text-[11px] text-amber-700 px-2 py-1 rounded-lg font-medium hover:bg-amber-100 transition"
                    >
                      &#x2715;
                    </button>
                  </div>
                </div>
              )}

              {/* Expanded */}
              {isOpen && (
                <div className="border-t border-border p-4 space-y-3">

                  {/* Notes */}
                  <textarea
                    value={idee.notes ?? ''}
                    onChange={e => updateNotes(idee.id, e.target.value)}
                    placeholder="Notes, contexte, questions..."
                    rows={2}
                    className="w-full text-sm border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-beige-50 resize-none"
                  />

                  {/* Lier a un projet */}
                  {(idee.statut === 'en_evaluation' || idee.statut === 'liee_projet') && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted shrink-0">Projet :</span>
                      {linkedProj ? (
                        <span className="text-xs font-medium text-primary">{linkedProj.nom}</span>
                      ) : (
                        <select
                          onChange={e => e.target.value && linkProjet(idee.id, e.target.value)}
                          className="text-xs border border-border rounded-lg px-2 py-1.5 bg-beige-50 focus:outline-none"
                          defaultValue=""
                        >
                          <option value="">Choisir un projet...</option>
                          {projets.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                        </select>
                      )}
                    </div>
                  )}

                  {/* Next actions */}
                  {actions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {actions.map(a => (
                        <button
                          key={a.next}
                          onClick={() => updateStatut(idee.id, a.next)}
                          className="flex items-center gap-1 text-xs font-medium text-primary border border-primary/30 px-2.5 py-1.5 rounded-xl hover:bg-primary-light transition"
                        >
                          <ArrowRight size={12} /> {a.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Delete */}
                  <button
                    onClick={() => remove(idee.id)}
                    className="flex items-center gap-1 text-xs text-muted hover:text-red-400 transition"
                  >
                    <Trash2 size={12} /> Supprimer
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {active.length === 0 && !showForm && (
          <div className="text-center py-10 bg-surface border border-border rounded-2xl">
            <p className="text-3xl mb-2">&#x1F4A1;</p>
            <p className="text-sm font-medium text-stone-700">Aucune idee en cours</p>
            <p className="text-xs text-muted mt-1">Clique sur &quot;Capturer&quot; pour noter une idee</p>
          </div>
        )}
      </div>

      {/* Done ideas */}
      {done.length > 0 && (
        <div>
          <button
            onClick={() => setShowDone(v => !v)}
            className="flex items-center gap-2 text-xs text-muted w-full py-1"
          >
            {showDone ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            <span className="font-semibold uppercase tracking-wider">Archivees</span>
            <span>({done.length})</span>
          </button>
          {showDone && (
            <div className="mt-2 space-y-2">
              {done.map(idee => {
                const cfg = STATUT_CONFIG[idee.statut]
                return (
                  <div key={idee.id} className="flex items-start gap-3 p-3 bg-surface border border-border rounded-xl opacity-60">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium shrink-0 mt-0.5 ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                    <span className="flex-1 text-sm text-muted line-clamp-2">{idee.texte}</span>
                    <button onClick={() => remove(idee.id)} className="p-1 text-muted hover:text-red-400 transition shrink-0">
                      <Trash2 size={12} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
