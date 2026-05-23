'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Forfait, ElementCarte, Settings } from '@/lib/types'
import { formatPrice } from '@/lib/utils'
import { Plus, Trash2, Save, Check, Edit2, X } from 'lucide-react'

export default function ParametresPage() {
  const [forfaits, setForfaits] = useState<Forfait[]>([])
  const [elements, setElements] = useState<ElementCarte[]>([])
  const [settings, setSettings] = useState<Settings>({ id: 1, acompte_pourcentage: 50 })
  const [loading, setLoading] = useState(true)

  // New forfait form
  const [newForfait, setNewForfait] = useState({ nom: '', description: '', prix_ht: '' })
  const [addingForfait, setAddingForfait] = useState(false)
  const [editingForfait, setEditingForfait] = useState<string | null>(null)
  const [editForfait, setEditForfait] = useState({ nom: '', description: '', prix_ht: '' })

  // New element form
  const [newElement, setNewElement] = useState({ nom: '', prix: '' })
  const [addingElement, setAddingElement] = useState(false)
  const [editingElement, setEditingElement] = useState<string | null>(null)
  const [editElement, setEditElement] = useState({ nom: '', prix: '' })

  const [savedSettings, setSavedSettings] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: f }, { data: e }, { data: s }] = await Promise.all([
        supabase.from('forfaits').select('*').order('created_at'),
        supabase.from('elements_carte').select('*').order('created_at'),
        supabase.from('settings').select('*').eq('id', 1).single(),
      ])
      if (f) setForfaits(f)
      if (e) setElements(e)
      if (s) setSettings(s)
      setLoading(false)
    }
    load()
  }, [])

  // Forfaits CRUD
  async function addForfait() {
    if (!newForfait.nom || !newForfait.prix_ht) return
    const { data } = await supabase.from('forfaits').insert({
      nom: newForfait.nom,
      description: newForfait.description || null,
      prix_ht: parseFloat(newForfait.prix_ht),
    }).select().single()
    if (data) { setForfaits(prev => [...prev, data]); setNewForfait({ nom: '', description: '', prix_ht: '' }); setAddingForfait(false) }
  }

  async function updateForfait(id: string) {
    await supabase.from('forfaits').update({
      nom: editForfait.nom,
      description: editForfait.description || null,
      prix_ht: parseFloat(editForfait.prix_ht),
    }).eq('id', id)
    setForfaits(prev => prev.map(f => f.id === id ? { ...f, ...editForfait, prix_ht: parseFloat(editForfait.prix_ht) } : f))
    setEditingForfait(null)
  }

  async function deleteForfait(id: string) {
    await supabase.from('forfaits').delete().eq('id', id)
    setForfaits(prev => prev.filter(f => f.id !== id))
  }

  // Éléments CRUD
  async function addElement() {
    if (!newElement.nom || !newElement.prix) return
    const { data } = await supabase.from('elements_carte').insert({
      nom: newElement.nom,
      prix: parseFloat(newElement.prix),
    }).select().single()
    if (data) { setElements(prev => [...prev, data]); setNewElement({ nom: '', prix: '' }); setAddingElement(false) }
  }

  async function updateElement(id: string) {
    await supabase.from('elements_carte').update({
      nom: editElement.nom,
      prix: parseFloat(editElement.prix),
    }).eq('id', id)
    setElements(prev => prev.map(e => e.id === id ? { ...e, ...editElement, prix: parseFloat(editElement.prix) } : e))
    setEditingElement(null)
  }

  async function deleteElement(id: string) {
    await supabase.from('elements_carte').delete().eq('id', id)
    setElements(prev => prev.filter(e => e.id !== id))
  }

  async function saveSettings() {
    await supabase.from('settings').update({ acompte_pourcentage: settings.acompte_pourcentage }).eq('id', 1)
    setSavedSettings(true)
    setTimeout(() => setSavedSettings(false), 2000)
  }

  if (loading) return <div className="text-muted text-sm pt-8 text-center">Chargement…</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-stone-800">Paramètres</h1>
        <p className="text-xs text-muted mt-0.5">Configure tes forfaits, éléments et tarifs</p>
      </div>

      {/* Acompte */}
      <section className="bg-surface rounded-2xl border border-border p-4 space-y-3">
        <h2 className="font-semibold text-stone-800 text-sm">Acompte par défaut</h2>
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <input
              type="number"
              min={1}
              max={100}
              value={settings.acompte_pourcentage}
              onChange={e => setSettings(prev => ({ ...prev, acompte_pourcentage: parseInt(e.target.value) || 50 }))}
              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-beige-50 focus:outline-none focus:ring-2 focus:ring-primary/30 pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm">%</span>
          </div>
          <button onClick={saveSettings}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${savedSettings ? 'bg-green-100 text-green-700' : 'bg-primary text-white hover:bg-primary-dark'}`}>
            {savedSettings ? <Check size={16} /> : <Save size={16} />}
            {savedSettings ? 'Enregistré' : 'Enregistrer'}
          </button>
        </div>
      </section>

      {/* Forfaits */}
      <section className="bg-surface rounded-2xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-stone-800 text-sm">Forfaits ({forfaits.length})</h2>
          <button onClick={() => setAddingForfait(true)} className="flex items-center gap-1 text-xs text-primary font-medium">
            <Plus size={14} /> Ajouter
          </button>
        </div>

        {addingForfait && (
          <div className="bg-beige-50 rounded-xl p-3 border border-border space-y-2">
            <input value={newForfait.nom} onChange={e => setNewForfait(p => ({ ...p, nom: e.target.value }))}
              placeholder="Nom du forfait *"
              className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <input value={newForfait.description} onChange={e => setNewForfait(p => ({ ...p, description: e.target.value }))}
              placeholder="Description (optionnelle)"
              className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <div className="relative">
              <input type="number" value={newForfait.prix_ht} onChange={e => setNewForfait(p => ({ ...p, prix_ht: e.target.value }))}
                placeholder="Prix HT *"
                className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 pr-6" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-xs">€</span>
            </div>
            <div className="flex gap-2">
              <button onClick={addForfait} className="bg-primary text-white text-sm px-4 py-2 rounded-xl font-medium">Ajouter</button>
              <button onClick={() => { setAddingForfait(false); setNewForfait({ nom: '', description: '', prix_ht: '' }) }}
                className="text-sm text-muted px-3 py-2"><X size={16} /></button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {forfaits.map(f => editingForfait === f.id ? (
            <div key={f.id} className="bg-beige-50 rounded-xl p-3 border border-border space-y-2">
              <input value={editForfait.nom} onChange={e => setEditForfait(p => ({ ...p, nom: e.target.value }))}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-surface focus:outline-none" />
              <input value={editForfait.description} onChange={e => setEditForfait(p => ({ ...p, description: e.target.value }))}
                placeholder="Description"
                className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-surface focus:outline-none" />
              <div className="relative">
                <input type="number" value={editForfait.prix_ht} onChange={e => setEditForfait(p => ({ ...p, prix_ht: e.target.value }))}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-surface focus:outline-none pr-6" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-xs">€</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => updateForfait(f.id)} className="bg-primary text-white text-sm px-4 py-2 rounded-xl font-medium">Enregistrer</button>
                <button onClick={() => setEditingForfait(null)} className="text-sm text-muted px-3 py-2"><X size={16} /></button>
              </div>
            </div>
          ) : (
            <div key={f.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-border hover:border-primary/20 transition">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-800">{f.nom}</p>
                {f.description && <p className="text-xs text-muted mt-0.5">{f.description}</p>}
              </div>
              <div className="flex items-center gap-2 ml-2 shrink-0">
                <span className="text-sm font-semibold text-primary">{formatPrice(f.prix_ht)}</span>
                <button onClick={() => { setEditingForfait(f.id); setEditForfait({ nom: f.nom, description: f.description || '', prix_ht: String(f.prix_ht) }) }}
                  className="p-1 text-muted hover:text-stone-700 transition"><Edit2 size={14} /></button>
                <button onClick={() => deleteForfait(f.id)} className="p-1 text-muted hover:text-red-500 transition"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          {forfaits.length === 0 && <p className="text-sm text-muted py-2">Aucun forfait configuré</p>}
        </div>
      </section>

      {/* Éléments à la carte */}
      <section className="bg-surface rounded-2xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-stone-800 text-sm">Éléments à la carte ({elements.length})</h2>
          <button onClick={() => setAddingElement(true)} className="flex items-center gap-1 text-xs text-primary font-medium">
            <Plus size={14} /> Ajouter
          </button>
        </div>

        {addingElement && (
          <div className="bg-beige-50 rounded-xl p-3 border border-border space-y-2">
            <input value={newElement.nom} onChange={e => setNewElement(p => ({ ...p, nom: e.target.value }))}
              placeholder="Nom de l'élément *"
              className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <div className="relative">
              <input type="number" value={newElement.prix} onChange={e => setNewElement(p => ({ ...p, prix: e.target.value }))}
                placeholder="Prix *"
                className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 pr-6" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-xs">€</span>
            </div>
            <div className="flex gap-2">
              <button onClick={addElement} className="bg-primary text-white text-sm px-4 py-2 rounded-xl font-medium">Ajouter</button>
              <button onClick={() => { setAddingElement(false); setNewElement({ nom: '', prix: '' }) }}
                className="text-sm text-muted px-3 py-2"><X size={16} /></button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {elements.map(e => editingElement === e.id ? (
            <div key={e.id} className="bg-beige-50 rounded-xl p-3 border border-border space-y-2">
              <input value={editElement.nom} onChange={ev => setEditElement(p => ({ ...p, nom: ev.target.value }))}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-surface focus:outline-none" />
              <div className="relative">
                <input type="number" value={editElement.prix} onChange={ev => setEditElement(p => ({ ...p, prix: ev.target.value }))}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-surface focus:outline-none pr-6" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-xs">€</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => updateElement(e.id)} className="bg-primary text-white text-sm px-4 py-2 rounded-xl font-medium">Enregistrer</button>
                <button onClick={() => setEditingElement(null)} className="text-sm text-muted px-3 py-2"><X size={16} /></button>
              </div>
            </div>
          ) : (
            <div key={e.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-border hover:border-primary/20 transition">
              <p className="text-sm font-medium text-stone-800 flex-1 min-w-0 truncate">{e.nom}</p>
              <div className="flex items-center gap-2 ml-2 shrink-0">
                <span className="text-sm font-semibold text-primary">{formatPrice(e.prix)}</span>
                <button onClick={() => { setEditingElement(e.id); setEditElement({ nom: e.nom, prix: String(e.prix) }) }}
                  className="p-1 text-muted hover:text-stone-700 transition"><Edit2 size={14} /></button>
                <button onClick={() => deleteElement(e.id)} className="p-1 text-muted hover:text-red-500 transition"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          {elements.length === 0 && <p className="text-sm text-muted py-2">Aucun élément configuré</p>}
        </div>
      </section>
    </div>
  )
}
