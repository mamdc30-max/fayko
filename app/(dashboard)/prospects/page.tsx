'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDate, formatPrice } from '@/lib/utils'
import { Plus, X, ChevronRight, Check } from 'lucide-react'
import type { Prospect, ProspectStatut, CanalContact } from '@/lib/types'

const STATUTS: ProspectStatut[] = [
  'Rencontré', 'Contacté', 'Appel découverte', 'Proposition envoyée', 'Client', 'Perdu',
]

const STATUT_COLORS: Record<ProspectStatut, string> = {
  'Rencontré':          'bg-stone-100 text-stone-600',
  'Contacté':           'bg-blue-50 text-blue-600',
  'Appel découverte':   'bg-purple-50 text-purple-600',
  'Proposition envoyée':'bg-amber-50 text-amber-700',
  'Client':             'bg-green-50 text-green-700',
  'Perdu':              'bg-red-50 text-red-500',
}

const STATUT_NEXT: Partial<Record<ProspectStatut, ProspectStatut>> = {
  'Rencontré':           'Contacté',
  'Contacté':            'Appel découverte',
  'Appel découverte':    'Proposition envoyée',
  'Proposition envoyée': 'Client',
}

const CANAUX: { value: CanalContact; label: string }[] = [
  { value: 'événement', label: 'Événement' },
  { value: 'linkedin',  label: 'LinkedIn' },
  { value: 'réseau',    label: 'Réseau' },
  { value: 'autre',     label: 'Autre' },
]

interface ProspectForm {
  prenom: string
  nom: string
  entreprise: string
  secteur: string
  canal: CanalContact
  offre_associee: string
  montant_estime: string
  notes: string
}

const EMPTY_FORM: ProspectForm = {
  prenom: '', nom: '', entreprise: '', secteur: '',
  canal: 'réseau', offre_associee: '', montant_estime: '', notes: '',
}

export default function ProspectsPage() {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatut, setFilterStatut] = useState<ProspectStatut | 'Tous'>('Tous')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Prospect | null>(null)
  const [form, setForm] = useState<ProspectForm>(EMPTY_FORM)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase.from('prospects').select('*').order('created_at', { ascending: false })
    if (data) setProspects(data)
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(p: Prospect) {
    setEditing(p)
    setForm({
      prenom: p.prenom,
      nom: p.nom,
      entreprise: p.entreprise ?? '',
      secteur: p.secteur ?? '',
      canal: p.canal ?? 'réseau',
      offre_associee: p.offre_associee ?? '',
      montant_estime: p.montant_estime ? String(p.montant_estime) : '',
      notes: p.notes ?? '',
    })
    setShowForm(true)
  }

  async function save() {
    if (!form.prenom.trim() || !form.nom.trim()) return
    const payload = {
      prenom: form.prenom.trim(),
      nom: form.nom.trim(),
      entreprise: form.entreprise.trim() || null,
      secteur: form.secteur.trim() || null,
      canal: form.canal,
      offre_associee: form.offre_associee.trim() || null,
      montant_estime: form.montant_estime ? parseFloat(form.montant_estime) : 0,
      notes: form.notes.trim() || null,
      dernier_contact_at: new Date().toISOString().split('T')[0],
    }
    if (editing) {
      const { data } = await supabase.from('prospects').update(payload).eq('id', editing.id).select().single()
      if (data) setProspects(prev => prev.map(p => p.id === editing.id ? data : p))
    } else {
      const { data } = await supabase.from('prospects').insert(payload).select().single()
      if (data) setProspects(prev => [data, ...prev])
    }
    setShowForm(false)
  }

  async function advanceStatut(p: Prospect) {
    const next = STATUT_NEXT[p.statut]
    if (!next) return
    const { data } = await supabase
      .from('prospects')
      .update({ statut: next, dernier_contact_at: new Date().toISOString().split('T')[0] })
      .eq('id', p.id)
      .select()
      .single()
    if (data) setProspects(prev => prev.map(x => x.id === p.id ? data : x))
  }

  async function changeStatut(p: Prospect, statut: ProspectStatut) {
    const { data } = await supabase.from('prospects').update({ statut }).eq('id', p.id).select().single()
    if (data) setProspects(prev => prev.map(x => x.id === p.id ? data : x))
  }

  const counts = STATUTS.reduce((acc, s) => {
    acc[s] = prospects.filter(p => p.statut === s).length
    return acc
  }, {} as Record<ProspectStatut, number>)

  const filtered = filterStatut === 'Tous' ? prospects : prospects.filter(p => p.statut === filterStatut)

  if (loading) return <div className="text-muted text-sm pt-8 text-center">Chargement…</div>

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-stone-800">Prospects</h1>
          <p className="text-xs text-muted mt-0.5">{prospects.length} contact{prospects.length > 1 ? 's' : ''} dans le tunnel</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 bg-primary text-white text-sm font-medium px-3 py-2 rounded-xl hover:bg-primary-dark transition">
          <Plus size={15} /> Ajouter
        </button>
      </div>

      {/* Filtre par statut */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setFilterStatut('Tous')}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${filterStatut === 'Tous' ? 'bg-primary text-white' : 'bg-surface border border-border text-muted'}`}>
          Tous ({prospects.length})
        </button>
        {STATUTS.map(s => (
          <button key={s}
            onClick={() => setFilterStatut(s)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${filterStatut === s ? 'bg-primary text-white' : 'bg-surface border border-border text-muted'}`}>
            {s} ({counts[s]})
          </button>
        ))}
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-muted">
          <p className="text-3xl mb-3">🤝</p>
          <p className="text-sm font-medium text-stone-700">Aucun prospect ici</p>
          <p className="text-xs mt-1">Clique sur Ajouter pour en créer un</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <div key={p.id}
              className="bg-surface rounded-2xl border border-border p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-stone-800 text-sm">{p.prenom} {p.nom}</p>
                  {p.entreprise && <p className="text-xs text-muted mt-0.5">{p.entreprise}{p.secteur ? ` · ${p.secteur}` : ''}</p>}
                  {p.offre_associee && (
                    <p className="text-xs text-primary mt-1 font-medium">
                      {p.offre_associee}{p.montant_estime > 0 ? ` · ${formatPrice(p.montant_estime)}` : ''}
                    </p>
                  )}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${STATUT_COLORS[p.statut]}`}>
                  {p.statut}
                </span>
              </div>

              {p.notes && (
                <p className="text-xs text-muted bg-beige-50 rounded-lg px-3 py-2 italic leading-relaxed">
                  {p.notes}
                </p>
              )}

              <div className="flex gap-2">
                {STATUT_NEXT[p.statut] && (
                  <button onClick={() => advanceStatut(p)}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-white text-xs font-medium py-2 rounded-xl hover:bg-primary-dark transition">
                    <ChevronRight size={13} /> {STATUT_NEXT[p.statut]}
                  </button>
                )}
                {p.statut !== 'Perdu' && p.statut !== 'Client' && (
                  <button onClick={() => changeStatut(p, 'Perdu')}
                    className="px-3 py-2 text-xs text-red-400 border border-red-100 rounded-xl hover:bg-red-50 transition">
                    Perdu
                  </button>
                )}
                <button onClick={() => openEdit(p)}
                  className="px-3 py-2 text-xs text-muted border border-border rounded-xl hover:bg-beige-50 transition">
                  Modifier
                </button>
              </div>

              {p.dernier_contact_at && (
                <p className="text-xs text-muted">Dernier contact : {formatDate(p.dernier_contact_at)}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Formulaire (slide-in) */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center">
          <div className="bg-surface w-full max-w-lg rounded-t-3xl md:rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-stone-800">{editing ? 'Modifier le prospect' : 'Nouveau prospect'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 text-muted hover:text-stone-800">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted mb-1 block">Prénom *</label>
                <input value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">Nom *</label>
                <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted mb-1 block">Entreprise</label>
                <input value={form.entreprise} onChange={e => setForm(f => ({ ...f, entreprise: e.target.value }))}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">Secteur</label>
                <input value={form.secteur} onChange={e => setForm(f => ({ ...f, secteur: e.target.value }))}
                  placeholder="ex: Mode, E-commerce…"
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted mb-1 block">Canal de rencontre</label>
              <div className="flex gap-2 flex-wrap">
                {CANAUX.map(c => (
                  <button key={c.value}
                    onClick={() => setForm(f => ({ ...f, canal: c.value }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${form.canal === c.value ? 'bg-primary text-white' : 'bg-beige-50 border border-border text-muted hover:border-primary/40'}`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted mb-1 block">Offre associée</label>
                <input value={form.offre_associee} onChange={e => setForm(f => ({ ...f, offre_associee: e.target.value }))}
                  placeholder="ex: Mission structurante"
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">Montant estimé (€)</label>
                <input type="number" value={form.montant_estime} onChange={e => setForm(f => ({ ...f, montant_estime: e.target.value }))}
                  placeholder="0"
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted mb-1 block">Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={3} placeholder="Contexte, intérêts, points de contact…"
                className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={save} disabled={!form.prenom.trim() || !form.nom.trim()}
                className="flex-1 bg-primary text-white font-semibold py-3 rounded-xl hover:bg-primary-dark transition disabled:opacity-40 flex items-center justify-center gap-2">
                <Check size={16} /> {editing ? 'Enregistrer' : 'Ajouter le prospect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
