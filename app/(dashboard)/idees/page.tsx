'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, ChevronDown, ChevronUp, ArrowRight, ExternalLink } from 'lucide-react'

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

const STATUS_DOT: Record<IdeaStatut, string> = {
  capture:            'bg-stone-300',
  a_challenger:       'bg-amber-400',
  en_evaluation:      'bg-blue-400',
  liee_projet:        'bg-violet-400',
  transformee_tache:  'bg-green-400',
  transformee_projet: 'bg-green-400',
  en_attente:         'bg-stone-200',
  abandonnee:         'bg-stone-200',
}

const ACTIVE_STATUTS: IdeaStatut[] = ['capture', 'a_challenger', 'en_evaluation', 'liee_projet']
const DONE_STATUTS:   IdeaStatut[] = ['transformee_tache', 'transformee_projet', 'en_attente', 'abandonnee']

const NEXT_ACTIONS: Partial<Record<IdeaStatut, { label: string; next: IdeaStatut }[]>> = {
  capture:       [{ label: 'Challenger', next: 'a_challenger' }, { label: 'Mettre en attente', next: 'en_attente' }],
  a_challenger:  [{ label: 'Evaluer',    next: 'en_evaluation' }, { label: 'Abandonner', next: 'abandonnee' }],
  en_evaluation: [{ label: 'Lier à un projet', next: 'liee_projet' }, { label: 'En attente', next: 'en_attente' }],
  liee_projet:   [{ label: 'Créer une tâche', next: 'transformee_tache' }, { label: 'Créer un projet', next: 'transformee_projet' }],
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
  const [chats, setChats]               = useState<Record<string, { role: 'user' | 'assistant'; content: string }[]>>({})
  const [chatInputs, setChatInputs]     = useState<Record<string, string>>({})
  const [chatLoading, setChatLoading]   = useState<Record<string, boolean>>({})
  const [notionSyncing, setNotionSyncing] = useState<Record<string, boolean>>({})
  const [notionUrls,    setNotionUrls]    = useState<Record<string, string>>({})
  const [showPicker,    setShowPicker]    = useState<Record<string, boolean>>({})

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

  // IA : suggest-projet — non-blocking, can be called at any point
  function fetchSuggestion(ideeId: string, texte: string) {
    if (projets.length === 0) return
    fetch('/api/suggest-projet', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ texte, projets }),
    })
      .then(r => r.json())
      .then((result: { projet_id: string | null; raison: string | null }) => {
        if (result.projet_id && result.raison) {
          const proj = projets.find(p => p.id === result.projet_id)
          if (proj) {
            setSuggestions(prev => ({
              ...prev,
              [ideeId]: {
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
      fetchSuggestion(newIdee.id, texteCapture)
    }

    setNewTexte('')
    setShowForm(false)
    setSaving(false)
  }

  async function startChallenge(idee: Idee) {
    if (chats[idee.id]?.length || chatLoading[idee.id]) return
    setChatLoading(prev => ({ ...prev, [idee.id]: true }))
    try {
      const res = await fetch('/api/challenge-idee', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ texte: idee.texte, messages: [] }),
      })
      const { message } = await res.json() as { message: string | null }
      if (message) setChats(prev => ({ ...prev, [idee.id]: [{ role: 'assistant' as const, content: message }] }))
    } catch {}
    setChatLoading(prev => ({ ...prev, [idee.id]: false }))
  }

  async function sendChat(idee: Idee) {
    const input = (chatInputs[idee.id] ?? '').trim()
    if (!input || chatLoading[idee.id]) return
    const history = chats[idee.id] ?? []
    const updated = [...history, { role: 'user' as const, content: input }]
    setChats(prev => ({ ...prev, [idee.id]: updated }))
    setChatInputs(prev => ({ ...prev, [idee.id]: '' }))
    setChatLoading(prev => ({ ...prev, [idee.id]: true }))
    try {
      const res = await fetch('/api/challenge-idee', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ texte: idee.texte, messages: updated }),
      })
      const { message } = await res.json() as { message: string | null }
      if (message) setChats(prev => ({
        ...prev,
        [idee.id]: [...(prev[idee.id] ?? []), { role: 'assistant' as const, content: message }],
      }))
    } catch {}
    setChatLoading(prev => ({ ...prev, [idee.id]: false }))
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

  async function syncToNotion(idee: Idee) {
    setNotionSyncing(prev => ({ ...prev, [idee.id]: true }))
    try {
      const res = await fetch('/api/notion/sync-idee', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ texte: idee.texte, statut: idee.statut, notes: idee.notes }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) setNotionUrls(prev => ({ ...prev, [idee.id]: data.url! }))
    } catch {}
    setNotionSyncing(prev => ({ ...prev, [idee.id]: false }))
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
            placeholder="Décris ton idée..."
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
            <div key={idee.id} className="bg-surface border border-border rounded-xl overflow-hidden">

              {/* Header — titre seul, tout le reste au clic */}
              <button
                onClick={() => setExpanded(e => ({ ...e, [idee.id]: !e[idee.id] }))}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-beige-50 transition"
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[idee.statut] ?? 'bg-stone-300'}`} />
                <span className="flex-1 text-sm text-stone-800 leading-snug line-clamp-1">{idee.texte}</span>
                {isOpen
                  ? <ChevronUp size={14} className="text-stone-300 shrink-0" />
                  : <ChevronDown size={14} className="text-stone-300 shrink-0" />}
              </button>

              {/* Détail — visible uniquement au clic */}
              {isOpen && (
                <div className="border-t border-border">

                  {/* Statut + suggestion IA */}
                  <div className="px-4 pt-3 flex items-start gap-2 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </div>

                  {/* ── Liaison projet ── */}
                  {(idee.statut === 'en_evaluation' || idee.statut === 'liee_projet') && (
                    <div className="mx-4 mt-2">
                      {linkedProj ? (
                        /* Projet déjà lié */
                        <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2">
                          <span className="w-2 h-2 rounded-full bg-violet-400 shrink-0" />
                          <span className="text-xs font-semibold text-violet-700 flex-1">{linkedProj.nom}</span>
                          <button
                            onClick={() => { setShowPicker(p => ({ ...p, [idee.id]: true })) }}
                            className="text-[11px] text-violet-500 hover:text-violet-700 transition"
                          >
                            Changer
                          </button>
                        </div>
                      ) : showPicker[idee.id] ? (
                        /* Picker ouvert — liste tous les projets */
                        <div className="bg-white border border-primary/30 rounded-xl overflow-hidden shadow-card">
                          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                            <span className="text-xs font-semibold text-stone-700">Lier à un projet :</span>
                            <button
                              onClick={() => setShowPicker(p => ({ ...p, [idee.id]: false }))}
                              className="text-xs text-muted hover:text-stone-700 transition"
                            >✕</button>
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {projets.length === 0 ? (
                              <p className="text-xs text-muted px-3 py-3">Aucun projet actif</p>
                            ) : projets.map(p => (
                              <button
                                key={p.id}
                                onClick={() => { linkProjet(idee.id, p.id); setShowPicker(prev => ({ ...prev, [idee.id]: false })); dismissSuggestion(idee.id) }}
                                className="w-full text-left px-3 py-2.5 text-sm text-stone-700 hover:bg-primary-light hover:text-primary transition flex items-center gap-2"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                                {p.nom}
                              </button>
                            ))}
                          </div>
                          <div className="px-3 py-2 border-t border-border">
                            <button
                              onClick={() => setShowPicker(p => ({ ...p, [idee.id]: false }))}
                              className="text-xs text-muted hover:text-stone-600 transition"
                            >
                              Pas de projet pour l'instant
                            </button>
                          </div>
                        </div>
                      ) : suggestion ? (
                        /* Suggestion IA */
                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                          <div className="flex items-start gap-2">
                            <span className="text-sm shrink-0">✦</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-amber-800 font-semibold leading-snug">
                                IA suggère : <strong>{suggestion.projet_nom}</strong>
                              </p>
                              <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">{suggestion.raison}</p>
                            </div>
                          </div>
                          <div className="flex gap-1.5 mt-2">
                            <button
                              onClick={() => acceptSuggestion(idee, suggestion)}
                              className="text-[11px] bg-amber-500 text-white px-2.5 py-1.5 rounded-lg font-semibold hover:bg-amber-600 transition"
                            >
                              Lier à ce projet
                            </button>
                            <button
                              onClick={() => { dismissSuggestion(idee.id); setShowPicker(p => ({ ...p, [idee.id]: true })) }}
                              className="text-[11px] text-amber-700 border border-amber-300 px-2.5 py-1.5 rounded-lg font-medium hover:bg-amber-100 transition"
                            >
                              Autre projet ▾
                            </button>
                            <button
                              onClick={() => dismissSuggestion(idee.id)}
                              className="text-[11px] text-amber-600/70 px-2 py-1.5 rounded-lg hover:bg-amber-100 transition ml-auto"
                            >
                              Ignorer
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Pas de suggestion — bouton pour ouvrir picker */
                        <button
                          onClick={() => setShowPicker(p => ({ ...p, [idee.id]: true }))}
                          className="flex items-center gap-2 text-xs text-primary border border-primary/30 px-3 py-1.5 rounded-xl hover:bg-primary-light transition"
                        >
                          <ArrowRight size={12} /> Lier à un projet
                        </button>
                      )}
                    </div>
                  )}

                  {/* ── Sparring IA (statut a_challenger uniquement) ── */}
                  {idee.statut === 'a_challenger' && (
                    <div className="p-4 space-y-3 bg-amber-50/50 border-b border-amber-100">
                      <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">
                        🤖 Sparring IA — Challenge ton idée
                      </p>

                      {!chats[idee.id] ? (
                        /* Pas encore de dialogue : bouton de lancement */
                        <button
                          onClick={() => startChallenge(idee)}
                          disabled={!!chatLoading[idee.id]}
                          className="w-full text-sm font-semibold text-amber-700 border border-amber-300 bg-white px-3 py-2.5 rounded-xl hover:bg-amber-50 transition disabled:opacity-50"
                        >
                          {chatLoading[idee.id] ? '⏳ Analyse...' : '▶ Lancer le dialogue'}
                        </button>
                      ) : (
                        /* Chat en cours */
                        <div className="space-y-3">
                          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                            {chats[idee.id].map((msg, i) => (
                              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                                  msg.role === 'user'
                                    ? 'bg-primary text-white'
                                    : 'bg-white border border-amber-200 text-stone-700'
                                }`}>
                                  {msg.content}
                                </div>
                              </div>
                            ))}
                            {!!chatLoading[idee.id] && (
                              <div className="flex justify-start">
                                <div className="bg-white border border-amber-200 text-amber-400 px-3 py-2 rounded-2xl text-xs">⏳</div>
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <input
                              value={chatInputs[idee.id] ?? ''}
                              onChange={e => setChatInputs(prev => ({ ...prev, [idee.id]: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter' && !chatLoading[idee.id]) sendChat(idee) }}
                              placeholder="Ta réponse..."
                              className="flex-1 text-sm border border-amber-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
                            />
                            <button
                              onClick={() => sendChat(idee)}
                              disabled={!(chatInputs[idee.id] ?? '').trim() || !!chatLoading[idee.id]}
                              className="bg-amber-500 text-white text-sm font-bold px-3 py-2 rounded-xl disabled:opacity-40 hover:bg-amber-600 transition"
                            >
                              ➜
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="p-4 space-y-3">

                    {/* Notes */}
                    <textarea
                      value={idee.notes ?? ''}
                      onChange={e => updateNotes(idee.id, e.target.value)}
                      placeholder="Notes, contexte, questions..."
                      rows={2}
                      className="w-full text-sm border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-beige-50 resize-none"
                    />


                    {/* Next actions */}
                    {actions.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {actions.map(a => {
                          /* "Lier à un projet" ouvre le picker au lieu de changer le statut */
                          if (a.next === 'liee_projet') {
                            return (
                              <button
                                key={a.next}
                                onClick={() => setShowPicker(p => ({ ...p, [idee.id]: true }))}
                                className="flex items-center gap-1 text-xs font-medium text-primary border border-primary/30 px-2.5 py-1.5 rounded-xl hover:bg-primary-light transition"
                              >
                                <ArrowRight size={12} /> {a.label}
                              </button>
                            )
                          }
                          /* "En attente" — label explicite pour éviter la surprise */
                          const isArchive = a.next === 'en_attente' || a.next === 'abandonnee'
                          return (
                            <button
                              key={a.next}
                              onClick={() => {
                                updateStatut(idee.id, a.next)
                                if (a.next === 'a_challenger') {
                                  setExpanded(e => ({ ...e, [idee.id]: true }))
                                  startChallenge(idee)
                                }
                                if (a.next === 'en_evaluation') fetchSuggestion(idee.id, idee.texte)
                              }}
                              className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-xl transition ${
                                isArchive
                                  ? 'text-muted border border-border hover:bg-beige-50'
                                  : 'text-primary border border-primary/30 hover:bg-primary-light'
                              }`}
                            >
                              <ArrowRight size={12} /> {a.label}
                              {isArchive && <span className="text-[10px] opacity-60 ml-0.5">(archive)</span>}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* Notion sync — visible si en_attente ou abandonnee */}
                    {(idee.statut === 'en_attente' || idee.statut === 'abandonnee' || idee.statut === 'en_evaluation') && (
                      notionUrls[idee.id] ? (
                        <a
                          href={notionUrls[idee.id]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition"
                        >
                          <ExternalLink size={12} /> Voir sur Notion ✓
                        </a>
                      ) : (
                        <button
                          onClick={() => syncToNotion(idee)}
                          disabled={notionSyncing[idee.id]}
                          className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-700 border border-stone-200 hover:border-stone-400 px-2 py-1 rounded-lg transition disabled:opacity-40"
                        >
                          {notionSyncing[idee.id] ? '⏳ Envoi…' : '📎 Archiver sur Notion'}
                        </button>
                      )
                    )}

                    {/* Delete */}
                    <button
                      onClick={() => remove(idee.id)}
                      className="flex items-center gap-1 text-xs text-muted hover:text-red-400 transition"
                    >
                      <Trash2 size={12} /> Supprimer
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {active.length === 0 && !showForm && (
          <div className="text-center py-10 bg-surface border border-border rounded-2xl">
            <p className="text-3xl mb-2">💡</p>
            <p className="text-sm font-medium text-stone-700">Aucune idée en cours</p>
            <p className="text-xs text-muted mt-1">Clique sur "Capturer" pour noter une idée</p>
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
              {done.map(idee => (
                <div key={idee.id} className="flex items-center gap-3 px-4 py-2.5 bg-surface border border-border rounded-xl opacity-50 group">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[idee.statut] ?? 'bg-stone-200'}`} />
                  <span className="flex-1 text-sm text-muted line-clamp-1">{idee.texte}</span>
                  <button onClick={() => remove(idee.id)} className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-red-400 transition shrink-0">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
