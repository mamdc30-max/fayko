'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Check, Trash2, ArrowRight, Search } from 'lucide-react'
import type { ContactReseau, ContactQualification } from '@/lib/types'

const QUAL_CONFIG: Record<ContactQualification, { label: string; badge: string; dot: string }> = {
  a_qualifier:  { label: 'A qualifier',  badge: 'bg-beige-100 text-muted',        dot: 'bg-border' },
  prospect:     { label: 'Prospect',     badge: 'bg-orange-50 text-orange-600',   dot: 'bg-orange-400' },
  prestataire:  { label: 'Prestataire',  badge: 'bg-blue-50 text-blue-600',       dot: 'bg-blue-400' },
  partenaire:   { label: 'Partenaire',   badge: 'bg-violet-50 text-violet-600',   dot: 'bg-violet-400' },
}

const FILTER_TABS: { key: ContactQualification | 'tous'; label: string }[] = [
  { key: 'tous',        label: 'Tous' },
  { key: 'a_qualifier', label: 'A qualifier' },
  { key: 'prospect',    label: 'Prospects' },
  { key: 'prestataire', label: 'Prestataires' },
  { key: 'partenaire',  label: 'Partenaires' },
]

const emptyForm = {
  prenom: '', nom: '', entreprise: '', evenement: '', sujet: '',
  qualification: 'a_qualifier' as ContactQualification,
}

export default function ReseauPage() {
  const [contacts, setContacts] = useState<ContactReseau[]>([])
  const [loading, setLoading]   = useState(true)
  const [view, setView]         = useState<'qualification' | 'annuaire'>('qualification')
  const [tab, setTab]           = useState<ContactQualification | 'tous'>('tous')
  const [search, setSearch]     = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState(emptyForm)
  const [saving, setSaving]     = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('contacts_reseau')
      .select('*')
      .order('created_at', { ascending: false })
    setContacts((data ?? []) as ContactReseau[])
    setLoading(false)
  }

  async function create() {
    if (!form.prenom.trim()) return
    setSaving(true)
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('contacts_reseau').insert({
      prenom:        form.prenom.trim(),
      nom:           form.nom.trim() || null,
      entreprise:    form.entreprise.trim() || null,
      evenement:     form.evenement.trim() || null,
      sujet:         form.sujet.trim() || null,
      qualification: form.qualification,
      rencontre_at:  today,
      rappel_fait:   false,
      converti:      false,
    })
    await load()
    setExpanded({})
    setForm(emptyForm)
    setShowForm(false)
    setSaving(false)
  }

  async function qualify(id: string, qualification: ContactQualification) {
    await supabase.from('contacts_reseau').update({ qualification }).eq('id', id)
    setContacts(prev => prev.map(c => c.id === id ? { ...c, qualification } : c))
  }

  async function convertToProspect(contact: ContactReseau) {
    const today = new Date().toISOString().split('T')[0]
    const { error } = await supabase.from('prospects').insert({
      prenom:         contact.prenom,
      nom:            contact.nom ?? '',
      entreprise:     contact.entreprise,
      notes:          contact.sujet,
      source_detail:  contact.evenement ? `Événement : ${contact.evenement}` : 'Réseau',
      statut:         'source',
      last_action_at: today,
      montant_estime: 0,
    })
    if (!error) {
      await supabase.from('contacts_reseau').update({ converti: true }).eq('id', contact.id)
      setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, converti: true } : c))
    }
  }

  async function remove(id: string) {
    await supabase.from('contacts_reseau').delete().eq('id', id)
    setContacts(prev => prev.filter(c => c.id !== id))
  }

  const filtered  = contacts.filter(c => tab === 'tous' || c.qualification === tab)
  const toQualify = contacts.filter(c => c.qualification === 'a_qualifier').length

  const annuaireItems = contacts.filter(c =>
    (c.qualification === 'prestataire' || c.qualification === 'partenaire') &&
    (!search.trim() || `${c.prenom} ${c.nom ?? ''} ${c.entreprise ?? ''} ${c.sujet ?? ''}`.toLowerCase().includes(search.toLowerCase()))
  )

  if (loading) return <div className="text-muted text-sm pt-8 text-center">Chargement...</div>

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Réseau</h1>
          <p className="text-xs text-muted mt-0.5">
            {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
            {toQualify > 0 && <span className="text-amber-600 font-medium"> · {toQualify} à qualifier</span>}
          </p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 bg-primary text-white text-sm font-medium px-3 py-2 rounded-xl hover:bg-primary-dark transition"
        >
          <Plus size={15} /> Ajouter
        </button>
      </div>

      {/* View toggle */}
      <div className="flex gap-6 border-b border-border/40">
        <button
          onClick={() => setView('qualification')}
          className={`text-xs font-medium pb-2.5 border-b-2 -mb-px transition ${
            view === 'qualification' ? 'border-primary text-ink' : 'border-transparent text-muted hover:text-ink'
          }`}
        >
          Qualification
        </button>
        <button
          onClick={() => setView('annuaire')}
          className={`text-xs font-medium pb-2.5 border-b-2 -mb-px transition ${
            view === 'annuaire' ? 'border-primary text-ink' : 'border-transparent text-muted hover:text-ink'
          }`}
        >
          Annuaire
        </button>
      </div>

      {/* ─── QUALIFICATION VIEW ─── */}
      {view === 'qualification' && (
        <>
          {/* Form */}
          {showForm && (
            <div className="bg-surface border border-primary/20 rounded-2xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input
                  autoFocus
                  value={form.prenom}
                  onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))}
                  placeholder="Prénom *"
                  className="text-sm border border-border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-beige-50"
                />
                <input
                  value={form.nom}
                  onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                  placeholder="Nom"
                  className="text-sm border border-border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-beige-50"
                />
              </div>
              <input
                value={form.entreprise}
                onChange={e => setForm(f => ({ ...f, entreprise: e.target.value }))}
                placeholder="Entreprise"
                className="w-full text-sm border border-border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-beige-50"
              />
              <input
                value={form.evenement}
                onChange={e => setForm(f => ({ ...f, evenement: e.target.value }))}
                placeholder="Événement / lieu de rencontre"
                className="w-full text-sm border border-border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-beige-50"
              />
              <textarea
                value={form.sujet}
                onChange={e => setForm(f => ({ ...f, sujet: e.target.value }))}
                placeholder="Notes, contexte, sujet de discussion..."
                rows={2}
                className="w-full text-sm border border-border rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-beige-50 resize-none"
              />
              <div>
                <p className="text-xs text-muted mb-1.5">Qualification</p>
                <div className="flex gap-1.5 flex-wrap">
                  {(Object.keys(QUAL_CONFIG) as ContactQualification[]).map(q => (
                    <button
                      key={q}
                      onClick={() => setForm(f => ({ ...f, qualification: q }))}
                      className={`text-xs px-2.5 py-1.5 rounded-xl border font-medium transition ${
                        form.qualification === q
                          ? QUAL_CONFIG[q].badge + ' border-current'
                          : 'border-border text-muted'
                      }`}
                    >
                      {QUAL_CONFIG[q].label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowForm(false)} className="text-sm text-muted px-3 py-2 rounded-xl hover:bg-beige-100 transition">
                  Annuler
                </button>
                <button
                  onClick={create}
                  disabled={!form.prenom.trim() || saving}
                  className="bg-primary text-white text-sm font-medium px-3 py-2 rounded-xl disabled:opacity-40 hover:bg-primary-dark transition"
                >
                  {saving ? 'Ajout...' : 'Ajouter'}
                </button>
              </div>
            </div>
          )}

          {/* Filter Tabs */}
          <div className="flex gap-4 overflow-x-auto no-scrollbar border-b border-border/40">
            {FILTER_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`shrink-0 text-xs font-medium pb-2.5 border-b-2 -mb-px transition ${
                  tab === t.key ? 'border-primary text-ink' : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {t.label}
                {t.key === 'a_qualifier' && toQualify > 0 && (
                  <span className="ml-1 bg-amber-500 text-white text-[9px] rounded-full px-1">{toQualify}</span>
                )}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="bg-surface divide-y divide-border/40">
            {filtered.map(c => {
              const cfg      = QUAL_CONFIG[c.qualification]
              const isOpen   = expanded[c.id] ?? false
              const fullName = [c.prenom, c.nom].filter(Boolean).join(' ')

              return (
                <div key={c.id} className="overflow-hidden">
                  <button
                    onClick={() => setExpanded(e => ({ ...e, [c.id]: !e[c.id] }))}
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-beige-50 transition"
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-ink">{fullName}</span>
                        {c.entreprise && <span className="text-xs text-muted">· {c.entreprise}</span>}
                        {c.converti && (
                          <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded-md">Dans le pipeline</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${cfg.badge}`}>{cfg.label}</span>
                        {c.evenement && <span className="text-xs text-muted">{c.evenement}</span>}
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-border p-4 space-y-3">
                      {c.sujet && (
                        <p className="text-sm text-muted leading-relaxed">{c.sujet}</p>
                      )}

                      {!c.converti && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Qualifier comme</p>
                          <div className="flex gap-1.5 flex-wrap">
                            {(Object.keys(QUAL_CONFIG) as ContactQualification[]).map(q => (
                              <button
                                key={q}
                                onClick={() => qualify(c.id, q)}
                                className={`text-xs px-2.5 py-1.5 rounded-xl border font-medium transition ${
                                  c.qualification === q
                                    ? QUAL_CONFIG[q].badge + ' border-current'
                                    : 'border-border text-muted hover:border-stone-300'
                                }`}
                              >
                                {c.qualification === q && <span className="mr-1">✓</span>}
                                {QUAL_CONFIG[q].label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {c.qualification === 'prospect' && !c.converti && (
                        <button
                          onClick={() => convertToProspect(c)}
                          className="flex items-center gap-2 w-full bg-primary text-white text-sm font-medium px-3 py-2.5 rounded-xl hover:bg-primary-dark transition"
                        >
                          <ArrowRight size={15} />
                          Ajouter au pipeline commercial
                        </button>
                      )}

                      {c.converti && (
                        <div className="flex items-center gap-2 text-xs text-green-600 font-medium">
                          <Check size={13} /> Ajoute au pipeline
                        </div>
                      )}

                      <button
                        onClick={() => remove(c.id)}
                        className="flex items-center gap-1 text-xs text-muted hover:text-red-400 transition"
                      >
                        <Trash2 size={12} /> Supprimer
                      </button>
                    </div>
                  )}
                </div>
              )
            })}

            {filtered.length === 0 && (
              <div className="text-center py-10">
                <p className="text-3xl mb-2">🤝</p>
                <p className="text-sm font-medium text-ink">
                  {tab === 'tous'
                    ? 'Aucun contact dans le réseau'
                    : `Aucun contact "${FILTER_TABS.find(t => t.key === tab)?.label}"`}
                </p>
                <p className="text-xs text-muted mt-1">Clique sur &quot;Ajouter&quot; pour saisir un contact</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── ANNUAIRE VIEW ─── */}
      {view === 'annuaire' && (
        <div className="space-y-4">

          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par nom, entreprise..."
              className="w-full text-sm border border-border rounded-xl pl-8 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-surface"
            />
          </div>

          {annuaireItems.length === 0 ? (
            <div className="text-center py-10 bg-surface border border-border rounded-2xl">
              <p className="text-3xl mb-2">📚</p>
              <p className="text-sm font-medium text-stone-700">
                {search ? 'Aucun résultat' : 'Annuaire vide'}
              </p>
              <p className="text-xs text-muted mt-1">
                {search
                  ? 'Essaie un autre terme de recherche'
                  : 'Les prestataires et partenaires qualifiés apparaissent ici'}
              </p>
            </div>
          ) : (
            <>
              {(['prestataire', 'partenaire'] as ContactQualification[]).map(type => {
                const items = annuaireItems.filter(c => c.qualification === type)
                if (items.length === 0) return null
                const sectionLabel = type === 'prestataire' ? 'Prestataires' : 'Partenaires'
                return (
                  <div key={type}>
                    <div className="flex items-center gap-2 mb-2.5">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted">{sectionLabel}</h3>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${QUAL_CONFIG[type].badge}`}>
                        {items.length}
                      </span>
                    </div>
                    <div className="bg-surface divide-y divide-border/40">
                      {items.map(c => (
                        <div key={c.id} className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-ink leading-tight">
                                {[c.prenom, c.nom].filter(Boolean).join(' ')}
                              </p>
                              {c.entreprise && (
                                <p className="text-xs text-muted mt-0.5">{c.entreprise}</p>
                              )}
                              {c.sujet && (
                                <p className="text-xs text-stone-600 mt-1.5 leading-relaxed">{c.sujet}</p>
                              )}
                            </div>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium shrink-0 ${QUAL_CONFIG[type].badge}`}>
                              {QUAL_CONFIG[type].label}
                            </span>
                          </div>
                          {c.evenement && (
                            <p className="text-[11px] text-muted mt-2 flex items-center gap-1">
                              <span>📍</span> {c.evenement}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}
