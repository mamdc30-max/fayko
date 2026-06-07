'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, ChevronDown, ChevronUp, Check, Trash2, ArrowRight, FileText } from 'lucide-react'

/* ── Types ──────────────────────────────────────────────────────────── */

type CRType = 'kick_off' | 'point_avancement' | 'validation' | 'debrief' | 'autre'

interface CR {
  id: string
  projet_id: string
  date: string
  type: CRType
  titre: string
  participants: string
  contexte: string
  decisions: string
  points_ouverts: string
  created_at: string
}

interface CRAction {
  id: string
  cr_id: string
  texte: string
  responsable: string
  echeance: string | null
  faite: boolean
  tache_id: string | null
}

/* ── Config types CR ────────────────────────────────────────────────── */

const CR_TYPES: { value: CRType; label: string; dot: string }[] = [
  { value: 'kick_off',          label: 'Kick-off',          dot: 'bg-violet-400' },
  { value: 'point_avancement',  label: 'Point avancement',  dot: 'bg-blue-400'   },
  { value: 'validation',        label: 'Validation client', dot: 'bg-green-400'  },
  { value: 'debrief',           label: 'Débrief',           dot: 'bg-amber-400'  },
  { value: 'autre',             label: 'Autre',             dot: 'bg-stone-300'  },
]

const CR_TYPE_MAP = Object.fromEntries(CR_TYPES.map(t => [t.value, t]))

const EMPTY_FORM = {
  date:           new Date().toISOString().split('T')[0],
  type:           'point_avancement' as CRType,
  titre:          '',
  participants:   '',
  contexte:       '',
  decisions:      '',
  points_ouverts: '',
}

/* ── Composant principal ────────────────────────────────────────────── */

export default function CrSection({ projetId, projetNom }: { projetId: string; projetNom: string }) {
  const [crs,      setCrs]      = useState<CR[]>([])
  const [actions,  setActions]  = useState<Record<string, CRAction[]>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [form,     setForm]     = useState(EMPTY_FORM)

  /* Champ "nouvelle action" par CR */
  const [newAction, setNewAction] = useState<Record<string, string>>({})
  const [converting, setConverting] = useState<Record<string, boolean>>({})

  useEffect(() => { loadCrs() }, [projetId])

  async function loadCrs() {
    const { data } = await supabase
      .from('comptes_rendus')
      .select('*')
      .eq('projet_id', projetId)
      .order('date', { ascending: false })
    setCrs((data ?? []) as CR[])
    setLoading(false)
  }

  async function loadActions(crId: string) {
    const { data } = await supabase
      .from('cr_actions')
      .select('*')
      .eq('cr_id', crId)
      .order('created_at')
    setActions(prev => ({ ...prev, [crId]: (data ?? []) as CRAction[] }))
  }

  function toggle(crId: string) {
    const next = !expanded[crId]
    setExpanded(e => ({ ...e, [crId]: next }))
    if (next && !actions[crId]) loadActions(crId)
  }

  /* ── Créer un CR ── */
  async function saveCr() {
    if (!form.titre.trim()) return
    setSaving(true)
    const { data } = await supabase
      .from('comptes_rendus')
      .insert({ projet_id: projetId, ...form })
      .select()
      .single()
    if (data) {
      setCrs(prev => [data as CR, ...prev])
      setExpanded(e => ({ ...e, [data.id]: true }))
    }
    setForm(EMPTY_FORM)
    setShowForm(false)
    setSaving(false)
  }

  /* ── Supprimer un CR ── */
  async function deleteCr(crId: string) {
    if (!confirm('Supprimer ce compte rendu ?')) return
    await supabase.from('comptes_rendus').delete().eq('id', crId)
    setCrs(prev => prev.filter(c => c.id !== crId))
  }

  /* ── Ajouter une action dans un CR ── */
  async function addAction(crId: string) {
    const texte = (newAction[crId] ?? '').trim()
    if (!texte) return
    const { data } = await supabase
      .from('cr_actions')
      .insert({ cr_id: crId, texte, responsable: '', echeance: null, faite: false })
      .select()
      .single()
    if (data) {
      setActions(prev => ({ ...prev, [crId]: [...(prev[crId] ?? []), data as CRAction] }))
    }
    setNewAction(prev => ({ ...prev, [crId]: '' }))
  }

  /* ── Marquer action faite ── */
  async function toggleAction(crId: string, actionId: string, faite: boolean) {
    await supabase.from('cr_actions').update({ faite }).eq('id', actionId)
    setActions(prev => ({
      ...prev,
      [crId]: prev[crId].map(a => a.id === actionId ? { ...a, faite } : a),
    }))
  }

  /* ── Convertir action → tâche Fayko ── */
  async function convertToTache(crId: string, action: CRAction) {
    if (action.tache_id) return
    setConverting(prev => ({ ...prev, [action.id]: true }))
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('taches')
      .insert({
        texte:      action.texte,
        faite:      false,
        date:       action.echeance ?? today,
        priorite:   'normale',
        source:     'cr',
        projet_id:  projetId,
        etape_id:   null,
      })
      .select()
      .single()
    if (data) {
      await supabase.from('cr_actions').update({ tache_id: data.id }).eq('id', action.id)
      setActions(prev => ({
        ...prev,
        [crId]: prev[crId].map(a => a.id === action.id ? { ...a, tache_id: data.id } : a),
      }))
    }
    setConverting(prev => ({ ...prev, [action.id]: false }))
  }

  /* ── Supprimer action ── */
  async function deleteAction(crId: string, actionId: string) {
    await supabase.from('cr_actions').delete().eq('id', actionId)
    setActions(prev => ({
      ...prev,
      [crId]: prev[crId].filter(a => a.id !== actionId),
    }))
  }

  if (loading) return null

  return (
    <div className="space-y-3">

      {/* En-tête section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-primary" />
          <h2 className="text-sm font-bold text-stone-800">
            Comptes rendus
            {crs.length > 0 && (
              <span className="ml-2 text-xs text-muted font-normal">{crs.length}</span>
            )}
          </h2>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setForm(EMPTY_FORM) }}
          className="flex items-center gap-1.5 text-xs font-medium text-primary border border-primary/30 px-2.5 py-1.5 rounded-xl hover:bg-primary-light transition"
        >
          <Plus size={13} /> Nouveau CR
        </button>
      </div>

      {/* Formulaire nouveau CR */}
      {showForm && (
        <div className="bg-surface border border-primary/20 rounded-2xl p-4 space-y-3">

          {/* Type */}
          <div className="flex flex-wrap gap-1.5">
            {CR_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => setForm(f => ({ ...f, type: t.value }))}
                className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition ${
                  form.type === t.value
                    ? 'bg-navy text-white border-navy'
                    : 'text-muted border-border hover:border-stone-300'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Date + Titre */}
          <div className="flex gap-2">
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="text-xs border border-border rounded-xl px-3 py-2 bg-beige-50 focus:outline-none focus:ring-2 focus:ring-primary/30 w-36"
            />
            <input
              autoFocus
              value={form.titre}
              onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
              placeholder={`Réunion ${projetNom}…`}
              className="flex-1 text-sm border border-border rounded-xl px-3 py-2 bg-beige-50 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Participants */}
          <input
            value={form.participants}
            onChange={e => setForm(f => ({ ...f, participants: e.target.value }))}
            placeholder="Participants (ex : Mame Diarra, Client X)"
            className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-beige-50 focus:outline-none"
          />

          {/* Contexte */}
          <textarea
            value={form.contexte}
            onChange={e => setForm(f => ({ ...f, contexte: e.target.value }))}
            placeholder="Points traités / contexte de la réunion…"
            rows={2}
            className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-beige-50 focus:outline-none resize-none"
          />

          {/* Décisions */}
          <textarea
            value={form.decisions}
            onChange={e => setForm(f => ({ ...f, decisions: e.target.value }))}
            placeholder="Décisions prises…"
            rows={2}
            className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-beige-50 focus:outline-none resize-none"
          />

          {/* Points ouverts */}
          <textarea
            value={form.points_ouverts}
            onChange={e => setForm(f => ({ ...f, points_ouverts: e.target.value }))}
            placeholder="Points ouverts / questions en suspens…"
            rows={2}
            className="w-full text-sm border border-border rounded-xl px-3 py-2 bg-beige-50 focus:outline-none resize-none"
          />

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setShowForm(false)}
              className="text-sm text-muted px-3 py-2 rounded-xl hover:bg-beige-100 transition"
            >
              Annuler
            </button>
            <button
              onClick={saveCr}
              disabled={!form.titre.trim() || saving}
              className="bg-primary text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-primary-dark disabled:opacity-40 transition"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}

      {/* Liste des CRs */}
      {crs.length === 0 && !showForm ? (
        <div className="text-center py-8 bg-surface border border-border rounded-2xl">
          <FileText size={28} className="mx-auto text-stone-200 mb-2" />
          <p className="text-sm text-muted">Aucun compte rendu</p>
          <p className="text-xs text-stone-300 mt-0.5">Chaque réunion client mérite un CR</p>
        </div>
      ) : (
        <div className="space-y-2">
          {crs.map(cr => {
            const typeConf  = CR_TYPE_MAP[cr.type] ?? CR_TYPE_MAP.autre
            const isOpen    = expanded[cr.id] ?? false
            const crActions = actions[cr.id] ?? []
            const pending   = crActions.filter(a => !a.faite).length
            const dateLabel = new Date(cr.date).toLocaleDateString('fr-FR', {
              day: 'numeric', month: 'short', year: 'numeric'
            })

            return (
              <div key={cr.id} className="bg-surface border border-border rounded-xl overflow-hidden">

                {/* En-tête CR */}
                <button
                  onClick={() => toggle(cr.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-beige-50 transition"
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${typeConf.dot}`} />
                  <span className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-stone-800 leading-snug line-clamp-1">{cr.titre}</span>
                    <span className="text-[11px] text-muted ml-2">{dateLabel}</span>
                  </span>
                  {pending > 0 && (
                    <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                      {pending} action{pending > 1 ? 's' : ''}
                    </span>
                  )}
                  {isOpen
                    ? <ChevronUp size={14} className="text-stone-300 shrink-0" />
                    : <ChevronDown size={14} className="text-stone-300 shrink-0" />
                  }
                </button>

                {/* Détail CR */}
                {isOpen && (
                  <div className="border-t border-border divide-y divide-border">

                    {/* Meta */}
                    <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        cr.type === 'kick_off'         ? 'bg-violet-50 text-violet-600' :
                        cr.type === 'point_avancement' ? 'bg-blue-50 text-blue-600'    :
                        cr.type === 'validation'        ? 'bg-green-50 text-green-600'  :
                        cr.type === 'debrief'           ? 'bg-amber-50 text-amber-700'  :
                                                          'bg-stone-50 text-stone-400'
                      }`}>
                        {typeConf.label}
                      </span>
                      {cr.participants && (
                        <span className="text-[11px] text-muted">
                          👥 {cr.participants}
                        </span>
                      )}
                    </div>

                    {/* Contexte */}
                    {cr.contexte && (
                      <div className="px-4 py-3 space-y-1">
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Points traités</p>
                        <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">{cr.contexte}</p>
                      </div>
                    )}

                    {/* Décisions */}
                    {cr.decisions && (
                      <div className="px-4 py-3 space-y-1">
                        <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Décisions</p>
                        <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">{cr.decisions}</p>
                      </div>
                    )}

                    {/* Points ouverts */}
                    {cr.points_ouverts && (
                      <div className="px-4 py-3 space-y-1">
                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Points ouverts</p>
                        <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">{cr.points_ouverts}</p>
                      </div>
                    )}

                    {/* ── Actions ── */}
                    <div className="px-4 py-3 space-y-2">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-wider">
                        Actions{crActions.length > 0 ? ` (${crActions.filter(a => a.faite).length}/${crActions.length})` : ''}
                      </p>

                      {crActions.map(action => (
                        <div
                          key={action.id}
                          className={`flex items-start gap-2 py-1 group ${action.faite ? 'opacity-50' : ''}`}
                        >
                          {/* Checkbox */}
                          <button
                            onClick={() => toggleAction(cr.id, action.id, !action.faite)}
                            className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition ${
                              action.faite
                                ? 'bg-green-500 border-green-500'
                                : 'border-stone-300 hover:border-primary'
                            }`}
                          >
                            {action.faite && <Check size={9} className="text-white" />}
                          </button>

                          {/* Texte */}
                          <span className={`flex-1 text-sm leading-snug ${action.faite ? 'line-through text-muted' : 'text-stone-700'}`}>
                            {action.texte}
                            {action.echeance && (
                              <span className="ml-1.5 text-[10px] text-muted">
                                → {new Date(action.echeance).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                              </span>
                            )}
                          </span>

                          {/* Convertir → tâche */}
                          {!action.faite && (
                            action.tache_id ? (
                              <span className="text-[10px] text-green-500 shrink-0">✓ tâche</span>
                            ) : (
                              <button
                                onClick={() => convertToTache(cr.id, action)}
                                disabled={converting[action.id]}
                                title="Ajouter à mes tâches"
                                className="opacity-0 group-hover:opacity-100 text-[10px] text-primary border border-primary/30 px-1.5 py-0.5 rounded-lg hover:bg-primary-light transition shrink-0 disabled:opacity-40"
                              >
                                {converting[action.id] ? '…' : '+ tâche'}
                              </button>
                            )
                          )}

                          {/* Supprimer */}
                          <button
                            onClick={() => deleteAction(cr.id, action.id)}
                            className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition shrink-0"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}

                      {/* Nouvelle action */}
                      <div className="flex items-center gap-2 pt-1">
                        <Plus size={13} className="text-stone-300 shrink-0" />
                        <input
                          value={newAction[cr.id] ?? ''}
                          onChange={e => setNewAction(prev => ({ ...prev, [cr.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') addAction(cr.id) }}
                          placeholder="Ajouter une action…"
                          className="flex-1 text-sm bg-transparent border-b border-border focus:outline-none focus:border-primary py-0.5 placeholder:text-stone-300"
                        />
                        {(newAction[cr.id] ?? '').trim() && (
                          <button
                            onClick={() => addAction(cr.id)}
                            className="text-[11px] bg-primary text-white px-2 py-1 rounded-lg hover:bg-primary-dark transition"
                          >
                            Ajouter
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Footer CR */}
                    <div className="px-4 py-2 flex justify-end">
                      <button
                        onClick={() => deleteCr(cr.id)}
                        className="flex items-center gap-1 text-xs text-muted hover:text-red-400 transition"
                      >
                        <Trash2 size={12} /> Supprimer ce CR
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
