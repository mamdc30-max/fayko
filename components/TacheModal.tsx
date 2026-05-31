'use client'

import { useState, useEffect } from 'react'
import { X, Check, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Tache } from '@/lib/types'

interface Props {
  tache: Tache
  onClose: () => void
  onSave: (updated: Tache) => void
  onDelete: (id: string) => void
}

interface ProjetLight { id: string; nom: string }

type Prio = 'haute' | 'normale' | 'basse'

const PRIO_CFG: Record<Prio, { label: string; active: string; dot: string }> = {
  haute:   { label: 'Haute',   active: 'bg-red-500 text-white border-red-500',         dot: 'bg-red-500' },
  normale: { label: 'Normale', active: 'bg-stone-600 text-white border-stone-600',      dot: 'bg-stone-400' },
  basse:   { label: 'Basse',   active: 'bg-stone-200 text-stone-600 border-stone-200',  dot: 'bg-stone-300' },
}

export function PrioDot({ p }: { p: Prio }) {
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${PRIO_CFG[p].dot}`} />
}

export default function TacheModal({ tache, onClose, onSave, onDelete }: Props) {
  const [texte,    setTexte]    = useState(tache.texte)
  const [priorite, setPriorite] = useState<Prio>(tache.priorite)
  const [echeance, setEcheance] = useState(tache.echeance ?? '')
  const [date,     setDate]     = useState(tache.date)
  const [projetId, setProjetId] = useState<string>(tache.projet_id ?? '')
  const [projets,  setProjets]  = useState<ProjetLight[]>([])
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    supabase.from('projets').select('id, nom').in('statut', ['actif', 'en_pause']).order('nom')
      .then(({ data }) => setProjets((data ?? []) as ProjetLight[]))
  }, [])

  async function save() {
    if (!texte.trim()) return
    setSaving(true)
    const { data } = await supabase.from('taches').update({
      texte: texte.trim(),
      priorite,
      echeance: echeance || null,
      date,
      projet_id: projetId || null,
    }).eq('id', tache.id).select().single()
    if (data) onSave(data as Tache)
    setSaving(false)
    onClose()
  }

  async function toggleFaite() {
    const faite = !tache.faite
    const { data } = await supabase.from('taches').update({
      faite,
      faite_at: faite ? new Date().toISOString() : null,
    }).eq('id', tache.id).select().single()
    if (data) onSave(data as Tache)
    onClose()
  }

  async function del() {
    if (!confirm('Supprimer cette tache ?')) return
    setDeleting(true)
    await supabase.from('taches').delete().eq('id', tache.id)
    onDelete(tache.id)
    setDeleting(false)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg rounded-t-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto -mt-2 mb-2" />

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-stone-800">Tâche</h2>
          <button onClick={onClose} className="text-muted hover:text-stone-700 transition p-1">
            <X size={18} />
          </button>
        </div>

        {/* Texte */}
        <div>
          <label className="text-xs text-muted mb-1.5 block font-semibold uppercase tracking-wider">Description</label>
          <textarea
            autoFocus
            value={texte}
            onChange={e => setTexte(e.target.value)}
            rows={3}
            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none bg-beige-50"
          />
        </div>

        {/* Priorite */}
        <div>
          <label className="text-xs text-muted mb-1.5 block font-semibold uppercase tracking-wider">Priorité</label>
          <div className="flex gap-2">
            {(['haute', 'normale', 'basse'] as Prio[]).map(p => (
              <button
                key={p}
                onClick={() => setPriorite(p)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition ${
                  priorite === p ? PRIO_CFG[p].active : 'border-border text-stone-500 hover:border-stone-300 bg-white'
                }`}
              >
                {PRIO_CFG[p].label}
              </button>
            ))}
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted mb-1.5 block font-semibold uppercase tracking-wider">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-beige-50"
            />
          </div>
          <div>
            <label className="text-xs text-muted mb-1.5 block font-semibold uppercase tracking-wider">Échéance</label>
            <input
              type="date"
              value={echeance}
              onChange={e => setEcheance(e.target.value)}
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-beige-50"
            />
          </div>
        </div>

        {/* Projet */}
        <div>
          <label className="text-xs text-muted mb-1.5 block font-semibold uppercase tracking-wider">Projet li&#233;</label>
          <select
            value={projetId}
            onChange={e => setProjetId(e.target.value)}
            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-beige-50 text-stone-700"
          >
            <option value="">&#8212; Aucun projet</option>
            {projets.map(p => (
              <option key={p.id} value={p.id}>{p.nom}</option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={toggleFaite}
            className={`flex items-center justify-center gap-1.5 flex-1 py-3 rounded-xl text-sm font-bold transition ${
              tache.faite
                ? 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
          >
            <Check size={15} />
            {tache.faite ? 'Rouvrir' : 'Marquer faite'}
          </button>
          <button
            onClick={save}
            disabled={!texte.trim() || saving}
            className="flex-1 bg-primary text-white py-3 rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-primary-dark transition"
          >
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>

        {/* Delete */}
        <div className="flex justify-center pb-2">
          <button
            onClick={del}
            disabled={deleting}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-red-400 transition"
          >
            <Trash2 size={12} />
            {deleting ? 'Suppression...' : 'Supprimer cette tâche'}
          </button>
        </div>
      </div>
    </div>
  )
}
