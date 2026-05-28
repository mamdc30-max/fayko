'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, X, Check } from 'lucide-react'
import type { Prospect, ProspectStatut, ProspectInteraction, InteractionType } from '@/lib/types'

const ETAPES: { key: ProspectStatut; label: string; next?: ProspectStatut; nextLabel?: string }[] = [
  { key: 'source',        label: 'Source',       next: 'contacte',      nextLabel: '→ Marquer Contacté' },
  { key: 'contacte',      label: 'Contacté',      next: 'en_discussion', nextLabel: '→ Appel découverte' },
  { key: 'en_discussion', label: 'En discussion', next: 'proposition',   nextLabel: '→ Envoyer proposition' },
  { key: 'proposition',   label: 'Proposition',   next: 'client',        nextLabel: '→ Marquer Client' },
  { key: 'client',        label: 'Client' },
]

const INTERACTION_ICONS: Record<InteractionType, string> = {
  message: '💬', appel: '📞', rdv: '🤝', relance: '🔁', email: '✉️', autre: '📝',
}

const CANAL_COLORS: Record<string, string> = {
  linkedin:             'bg-blue-50 text-blue-700',
  'événement':          'bg-purple-50 text-purple-700',
  réseau:               'bg-green-50 text-green-700',
  'prospection directe':'bg-orange-50 text-orange-700',
  autre:                'bg-stone-100 text-stone-600',
}

const EMPTY_FORM = { prenom: '', nom: '', entreprise: '', secteur: '', canal_propose: 'linkedin', montant_estime: '', notes: '' }
const EMPTY_IFORM = { type: 'rdv' as InteractionType, label: '', date: new Date().toISOString().split('T')[0], notes: '' }

function isStale(p: Prospect): boolean {
  if (!p.last_action_at || p.statut === 'client' || p.statut === 'source') return false
  return (Date.now() - new Date(p.last_action_at).getTime()) > 7 * 24 * 60 * 60 * 1000
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function Stars({ n, max = 3 }: { n: number; max?: number }) {
  return <span>{'★'.repeat(n)}{'☆'.repeat(max - n)}</span>
}

export default function PipelinePage() {
  const [prospects, setProspects]       = useState<Prospect[]>([])
  const [interactions, setInteractions] = useState<Record<string, ProspectInteraction[]>>({})
  const [loading, setLoading]           = useState(true)
  const [activeTab, setActiveTab]       = useState<ProspectStatut>('source')
  const [expandedId, setExpandedId]     = useState<string | null>(null)
  const [showAddProspect, setShowAddProspect]       = useState(false)
  const [showAddInteraction, setShowAddInteraction] = useState<string | null>(null)
  const [form,  setForm]  = useState(EMPTY_FORM)
  const [iform, setIform] = useState(EMPTY_IFORM)
  const [nextSteps, setNextSteps]     = useState<Record<string, string>>({})
  const [loadingStep, setLoadingStep] = useState<Record<string, boolean>>({})

  useEffect(() => { load() }, [])

  async function load() {
    const { data: pData } = await supabase
      .from('prospects')
      .select('*')
      .not('statut', 'eq', 'perdu')
      .order('last_action_at', { ascending: true, nullsFirst: true })

    if (pData) {
      setProspects(pData)
      const ids = pData.map(p => p.id)
      if (ids.length) {
        const { data: iData } = await supabase
          .from('prospect_interactions')
          .select('*')
          .in('prospect_id', ids)
          .order('date', { ascending: false })
        if (iData) {
          const grouped: Record<string, ProspectInteraction[]> = {}
          iData.forEach(i => {
            if (!grouped[i.prospect_id]) grouped[i.prospect_id] = []
            grouped[i.prospect_id].push(i)
          })
          setInteractions(grouped)
        }
      }
    }
    setLoading(false)
  }

  async function advance(p: Prospect, next: ProspectStatut) {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('prospects')
      .update({ statut: next, last_action_at: today })
      .eq('id', p.id).select().single()
    if (data) setProspects(prev => prev.map(x => x.id === p.id ? data : x))
    if (next === 'en_discussion') await addInteraction(p.id, 'rdv', 'Appel découverte', today)
    if (next === 'contacte')      await addInteraction(p.id, 'message', 'Premier contact', today)
  }

  async function markPerdu(p: Prospect) {
    await supabase.from('prospects').update({ statut: 'perdu' }).eq('id', p.id)
    setProspects(prev => prev.filter(x => x.id !== p.id))
  }

  async function changeStatut(p: Prospect, statut: ProspectStatut) {
    if (p.statut === statut) return
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('prospects')
      .update({ statut, last_action_at: today })
      .eq('id', p.id).select().single()
    if (data) setProspects(prev => prev.map(x => x.id === p.id ? data as Prospect : x))
  }

  async function addInteraction(prospectId: string, type: InteractionType, label: string, date: string, notes?: string) {
    const { data } = await supabase
      .from('prospect_interactions')
      .insert({ prospect_id: prospectId, type, label, date, notes: notes || null })
      .select().single()
    if (data) setInteractions(prev => ({ ...prev, [prospectId]: [data, ...(prev[prospectId] || [])] }))
  }

  async function saveInteraction() {
    if (!showAddInteraction || !iform.label.trim()) return
    await addInteraction(showAddInteraction, iform.type, iform.label.trim(), iform.date, iform.notes)
    await supabase.from('prospects').update({ last_action_at: iform.date }).eq('id', showAddInteraction)
    setProspects(prev => prev.map(p => p.id === showAddInteraction ? { ...p, last_action_at: iform.date } : p))
    setShowAddInteraction(null)
    setIform(EMPTY_IFORM)
  }

  async function saveProspect() {
    if (!form.entreprise.trim() && !form.prenom.trim()) return
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('prospects').insert({
      prenom: form.prenom.trim(),
      nom: form.nom.trim(),
      entreprise: form.entreprise.trim() || null,
      secteur: form.secteur.trim() || null,
      canal_propose: form.canal_propose,
      montant_estime: form.montant_estime ? parseFloat(form.montant_estime) : 0,
      notes: form.notes.trim() || null,
      statut: 'source' as ProspectStatut,
      last_action_at: today,
    }).select().single()
    if (data) { setProspects(prev => [data, ...prev]); setActiveTab('source') }
    setShowAddProspect(false)
    setForm(EMPTY_FORM)
  }

  async function fetchNextStep(p: Prospect) {
    setLoadingStep(prev => ({ ...prev, [p.id]: true }))
    try {
      const res = await fetch('/api/next-step', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prospect: p, interactions: interactions[p.id] || [] }),
      })
      const { suggestion } = await res.json() as { suggestion: string | null }
      if (suggestion) setNextSteps(prev => ({ ...prev, [p.id]: suggestion }))
    } catch {}
    setLoadingStep(prev => ({ ...prev, [p.id]: false }))
  }

  const counts = ETAPES.reduce((acc, e) => {
    acc[e.key] = prospects.filter(p => p.statut === e.key).length
    return acc
  }, {} as Record<ProspectStatut, number>)

  const filtered    = prospects.filter(p => p.statut === activeTab)
  const activeEtape = ETAPES.find(e => e.key === activeTab)

  if (loading) return <div className="text-muted text-sm pt-8 text-center">Chargement…</div>

  return (
    <div className="space-y-0 -mx-4 -mt-6">

      {/* Header + tabs */}
      <div className="px-4 pt-6 pb-3 bg-beige sticky top-0 z-10 border-b border-border/40">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-stone-800">Pipeline</h1>
            <p className="text-xs text-muted mt-0.5">{prospects.length} prospect{prospects.length > 1 ? 's' : ''} actifs</p>
          </div>
          <button onClick={() => setShowAddProspect(true)}
            className="flex items-center gap-1.5 bg-primary text-white text-sm font-semibold px-3 py-2 rounded-xl hover:bg-primary-dark transition">
            <Plus size={15} /> Prospect
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {ETAPES.map(e => (
            <button key={e.key} onClick={() => setActiveTab(e.key)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                activeTab === e.key
                  ? 'bg-stone-800 text-white'
                  : 'bg-white text-muted border border-border hover:border-stone-300'
              }`}>
              {e.label}
              <span className={`rounded-full px-1.5 text-[10px] font-bold ${
                activeTab === e.key ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'
              }`}>{counts[e.key]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="px-4 pt-3 pb-24 space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-14">
            <p className="text-4xl mb-3">🎯</p>
            <p className="text-sm font-semibold text-stone-700">Aucun prospect ici</p>
            <p className="text-xs text-muted mt-1.5">
              {activeTab === 'source'
                ? "Les prospects qualifiés par l'agent Cowork apparaîtront ici"
                : 'Fais avancer tes prospects depuis l\'onglet précédent'}
            </p>
          </div>
        ) : (
          filtered.map(p => {
            const pInter    = interactions[p.id] || []
            const expanded  = expandedId === p.id
            const stale     = isStale(p)

            return (
              <div key={p.id} className={`bg-white rounded-2xl border-l-4 shadow-sm overflow-hidden ${
                stale              ? 'border-l-amber-400' :
                activeTab === 'client' ? 'border-l-green-500' : 'border-l-primary'
              }`}>
                <div className="p-4">

                  {/* Top */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-stone-800 text-[15px] leading-tight">
                        {p.prenom || p.nom ? `${p.prenom} ${p.nom}`.trim() : p.entreprise}
                      </p>
                      {(p.prenom || p.nom) && p.entreprise && (
                        <p className="text-xs text-muted mt-0.5 truncate">
                          {p.entreprise}{p.secteur ? ` · ${p.secteur}` : ''}
                        </p>
                      )}
                      {p.montant_estime > 0 && (
                        <p className="text-xs font-bold text-primary mt-1">
                          {p.montant_estime.toLocaleString('fr-FR')} € HT
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {stale && (
                        <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold">⚠️ J+7</span>
                      )}
                      {p.canal_propose && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${CANAL_COLORS[p.canal_propose] ?? CANAL_COLORS['autre']}`}>
                          {p.canal_propose}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Scores (source only) */}
                  {activeTab === 'source' && (p.score_site || p.score_linkedin) && (
                    <div className="flex gap-4 mb-2">
                      {p.score_site     && <span className="text-[11px] text-muted">Site <strong className="text-amber-500"><Stars n={p.score_site} /></strong></span>}
                      {p.score_linkedin && <span className="text-[11px] text-muted">LinkedIn <strong className="text-amber-500"><Stars n={p.score_linkedin} /></strong></span>}
                    </div>
                  )}

                  {/* Interactions */}
                  {pInter.length > 0 && (
                    <div className="mb-3 space-y-1.5 border-t border-stone-50 pt-2 mt-2">
                      {pInter.slice(0, expanded ? undefined : 2).map(i => (
                        <div key={i.id} className="flex items-center gap-2">
                          <span className="text-xs">{INTERACTION_ICONS[i.type]}</span>
                          <span className="text-xs font-medium text-stone-700 flex-1 truncate">{i.label || i.type}</span>
                          <span className="text-[10px] text-muted shrink-0">{fmtDate(i.date)}</span>
                        </div>
                      ))}
                      {pInter.length > 2 && !expanded && (
                        <button onClick={() => setExpandedId(p.id)}
                          className="text-[10px] text-primary font-semibold">
                          +{pInter.length - 2} de plus
                        </button>
                      )}
                    </div>
                  )}

                  {/* Message prepare (expanded) */}
                  {expanded && p.message_type && (
                    <div className="mb-3 bg-stone-50 rounded-xl p-3 border border-stone-100">
                      <p className="text-[10px] text-muted font-bold uppercase tracking-wider mb-1.5">Message préparé</p>
                      <p className="text-xs text-stone-700 leading-relaxed whitespace-pre-line">{p.message_type}</p>
                    </div>
                  )}

                  {/* Notes (expanded) */}
                  {expanded && p.notes && (
                    <p className="mb-3 text-xs text-muted bg-beige-50 rounded-xl px-3 py-2 italic leading-relaxed">{p.notes}</p>
                  )}

                  {/* Statut picker (expanded) */}
                  {expanded && (
                    <div className="mb-3">
                      <p className="text-[10px] text-muted font-bold uppercase tracking-wider mb-1.5">Changer d&apos;&eacute;tape</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {ETAPES.map(e => (
                          <button
                            key={e.key}
                            onClick={() => changeStatut(p, e.key)}
                            className={`px-2.5 py-1.5 text-xs font-semibold rounded-xl border transition ${
                              p.statut === e.key
                                ? 'bg-stone-800 text-white border-stone-800'
                                : 'border-border text-stone-500 hover:border-stone-400 hover:text-stone-700'
                            }`}
                          >
                            {e.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Next step IA */}
                  {expanded && (
                    <div className="mb-3">
                      {nextSteps[p.id] ? (
                        <div className="flex items-start gap-2 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2.5">
                          <span className="text-sm shrink-0">&#x1F4A1;</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-violet-500 font-bold uppercase tracking-wider mb-0.5">Prochaine etape</p>
                            <p className="text-xs text-violet-900 font-medium leading-snug">{nextSteps[p.id]}</p>
                          </div>
                          <button
                            onClick={() => setNextSteps(prev => { const n = { ...prev }; delete n[p.id]; return n })}
                            className="text-violet-400 hover:text-violet-600 text-xs shrink-0 mt-0.5"
                          >&#x2715;</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => fetchNextStep(p)}
                          disabled={loadingStep[p.id]}
                          className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 border border-violet-200 bg-violet-50 px-3 py-2 rounded-xl hover:bg-violet-100 transition disabled:opacity-50"
                        >
                          {loadingStep[p.id] ? '⏳ Analyse...' : '💡 Prochaine etape'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 flex-wrap pt-1">
                    {activeEtape?.next && (
                      <button onClick={() => advance(p, activeEtape.next!)}
                        className="flex-1 bg-primary text-white text-xs font-bold py-2.5 rounded-xl hover:bg-primary-dark transition min-w-[130px]">
                        {activeEtape.nextLabel}
                      </button>
                    )}
                    <button
                      onClick={() => { setShowAddInteraction(p.id); setIform(EMPTY_IFORM) }}
                      className="px-3 py-2.5 text-xs text-primary border border-primary/30 bg-primary-light rounded-xl font-bold transition">
                      + Interaction
                    </button>
                    <button onClick={() => setExpandedId(expanded ? null : p.id)}
                      className="px-3 py-2.5 text-xs text-muted border border-border rounded-xl hover:bg-beige-50 transition">
                      {expanded ? '↑ R&eacute;duire' : '↓ D&eacute;tail'}
                    </button>
                    {activeTab !== 'client' && (
                      <button onClick={() => markPerdu(p)}
                        className="px-3 py-2.5 text-xs text-red-400 border border-red-100 rounded-xl hover:bg-red-50 transition">
                        Perdu
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Modal — Nouvelle interaction */}
      {showAddInteraction && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-stone-800">Ajouter une interaction</h2>
              <button onClick={() => setShowAddInteraction(null)} className="text-muted"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['rdv', 'appel', 'message', 'relance', 'email', 'autre'] as InteractionType[]).map(t => (
                <button key={t} onClick={() => setIform(f => ({ ...f, type: t }))}
                  className={`py-2.5 rounded-xl text-xs font-semibold border transition ${
                    iform.type === t ? 'bg-primary text-white border-primary' : 'border-border text-stone-600 hover:border-stone-300'
                  }`}>
                  {INTERACTION_ICONS[t]} {t}
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block font-medium">Description *</label>
              <input value={iform.label} onChange={e => setIform(f => ({ ...f, label: e.target.value }))}
                placeholder="ex: RDV 1 — Appel découverte"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block font-medium">Date</label>
              <input type="date" value={iform.date} onChange={e => setIform(f => ({ ...f, date: e.target.value }))}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block font-medium">Notes (optionnel)</label>
              <textarea value={iform.notes} onChange={e => setIform(f => ({ ...f, notes: e.target.value }))}
                rows={2} placeholder="Points clés, suite à donner…"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
            </div>
            <button onClick={saveInteraction} disabled={!iform.label.trim()}
              className="w-full bg-primary text-white font-bold py-3 rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
              <Check size={16} /> Enregistrer
            </button>
          </div>
        </div>
      )}

      {/* Modal — Nouveau prospect */}
      {showAddProspect && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 space-y-4 max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-stone-800">Nouveau prospect</h2>
              <button onClick={() => setShowAddProspect(false)} className="text-muted"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted mb-1 block font-medium">Prénom</label>
                <input value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))}
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block font-medium">Nom</label>
                <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block font-medium">Entreprise *</label>
              <input value={form.entreprise} onChange={e => setForm(f => ({ ...f, entreprise: e.target.value }))}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block font-medium">Secteur</label>
              <input value={form.secteur} onChange={e => setForm(f => ({ ...f, secteur: e.target.value }))}
                placeholder="ex: Communication B2B"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block font-medium">Canal</label>
              <div className="flex gap-2 flex-wrap">
                {['linkedin', 'événement', 'réseau', 'prospection directe', 'autre'].map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, canal_propose: c }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                      form.canal_propose === c ? 'bg-primary text-white border-primary' : 'border-border text-muted hover:border-stone-300'
                    }`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block font-medium">Montant estimé (€)</label>
              <input type="number" value={form.montant_estime} onChange={e => setForm(f => ({ ...f, montant_estime: e.target.value }))}
                placeholder="0"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block font-medium">Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} placeholder="Contexte, intérêts…"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
            </div>
            <button onClick={saveProspect} disabled={!form.entreprise.trim() && !form.prenom.trim()}
              className="w-full bg-primary text-white font-bold py-3 rounded-xl disabled:opacity-40">
              Ajouter dans Source
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
