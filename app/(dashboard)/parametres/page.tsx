'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Forfait, ElementCarte, Settings, Template } from '@/lib/types'
import { formatPrice } from '@/lib/utils'
import { Plus, Trash2, Save, Check, Edit2, X } from 'lucide-react'
import { useUserContext } from '@/lib/user-context'

export default function ParametresPage() {
  const { isAdmin } = useUserContext()
  const [forfaits, setForfaits] = useState<Forfait[]>([])
  const [elements, setElements] = useState<ElementCarte[]>([])
  const [settings, setSettings] = useState<Settings>({ id: 1, acompte_pourcentage: 50 })
  const [loading, setLoading] = useState(true)

  // Forfait / article form
  const [newForfait, setNewForfait] = useState({ nom: '', description: '', prix_ht: '', categorie: '' })
  const [addingForfait, setAddingForfait] = useState(false)
  const [editingForfait, setEditingForfait] = useState<string | null>(null)
  const [editForfait, setEditForfait] = useState({ nom: '', description: '', prix_ht: '', categorie: '' })

  // Element form (admin only)
  const [newElement, setNewElement] = useState({ nom: '', prix: '' })
  const [addingElement, setAddingElement] = useState(false)
  const [editingElement, setEditingElement] = useState<string | null>(null)
  const [editElement, setEditElement] = useState({ nom: '', prix: '' })

  const [savedSettings, setSavedSettings] = useState(false)

  // Templates messages
  const [templates, setTemplates] = useState<Template[]>([])
  const [editingTemplate, setEditingTemplate] = useState<number | null>(null)
  const [editTemplateContenu, setEditTemplateContenu] = useState('')
  const [savedTemplate, setSavedTemplate] = useState<number | null>(null)

  // Catalogue groupé par catégorie (BtoC)
  const forfaitsByCategory = forfaits.reduce((acc, f) => {
    const cat = f.categorie || 'Général'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(f)
    return acc
  }, {} as Record<string, Forfait[]>)
  const uniqueCategories = Object.keys(forfaitsByCategory).sort()

  useEffect(() => {
    async function load() {
      const [{ data: f }, { data: e }, { data: s }, { data: t }] = await Promise.all([
        supabase.from('forfaits').select('*').order('categorie').order('nom'),
        supabase.from('elements_carte').select('*').order('nom'),
        supabase.from('settings').select('*').single(),
        supabase.from('templates').select('*').order('id'),
      ])
      if (f) setForfaits(f)
      if (e) setElements(e)
      if (s) setSettings(s)
      if (t) setTemplates(t)
      setLoading(false)
    }
    load()
  }, [])

  async function addForfait() {
    if (!newForfait.nom || !newForfait.prix_ht) return
    const { data } = await supabase.from('forfaits').insert({
      nom: newForfait.nom,
      description: newForfait.description || null,
      prix_ht: parseFloat(newForfait.prix_ht),
      categorie: newForfait.categorie || (isAdmin ? null : 'Général'),
    }).select().single()
    if (data) {
      setForfaits(prev => [...prev, data])
      setNewForfait({ nom: '', description: '', prix_ht: '', categorie: '' })
      setAddingForfait(false)
    }
  }

  async function updateForfait(id: string) {
    await supabase.from('forfaits').update({
      nom: editForfait.nom,
      description: editForfait.description || null,
      prix_ht: parseFloat(editForfait.prix_ht),
      categorie: editForfait.categorie || null,
    }).eq('id', id)
    setForfaits(prev => prev.map(f => f.id === id ? {
      ...f,
      nom: editForfait.nom,
      description: editForfait.description || null,
      prix_ht: parseFloat(editForfait.prix_ht),
      categorie: editForfait.categorie || null,
    } : f))
    setEditingForfait(null)
  }

  async function deleteForfait(id: string) {
    await supabase.from('forfaits').delete().eq('id', id)
    setForfaits(prev => prev.filter(f => f.id !== id))
  }

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
    await supabase.from('settings').update({ acompte_pourcentage: settings.acompte_pourcentage }).eq('id', settings.id)
    setSavedSettings(true)
    setTimeout(() => setSavedSettings(false), 2000)
  }

  async function saveTemplate(id: number) {
    await supabase.from('templates').update({ contenu: editTemplateContenu }).eq('id', id)
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, contenu: editTemplateContenu } : t))
    setEditingTemplate(null)
    setSavedTemplate(id)
    setTimeout(() => setSavedTemplate(null), 2000)
  }

  if (loading) return <div className="text-muted text-sm pt-8 text-center">Chargement…</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-stone-800">Paramètres</h1>
        <p className="text-xs text-muted mt-0.5">
          {isAdmin ? 'Gère ton catalogue, tes éléments et tes tarifs' : 'Configure ton catalogue de produits'}
        </p>
      </div>

      {/* Acompte (admin seulement) */}
      {isAdmin && (
        <section className="bg-surface rounded-2xl border border-border p-4 space-y-3">
          <h2 className="font-semibold text-stone-800 text-sm">Acompte par défaut</h2>
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <input
                type="number" min={1} max={100}
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
      )}

      {/* ========== BtoC : Mon catalogue ========== */}
      {!isAdmin && (
        <section className="bg-surface rounded-2xl border border-border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-stone-800 text-sm">Mon catalogue</h2>
              <p className="text-xs text-muted mt-0.5">{forfaits.length} article{forfaits.length !== 1 ? 's' : ''}</p>
            </div>
            <button onClick={() => setAddingForfait(true)} className="flex items-center gap-1 text-xs text-primary font-medium">
              <Plus size={14} /> Ajouter
            </button>
          </div>

          {/* Formulaire ajout article */}
          {addingForfait && (
            <div className="bg-beige-50 rounded-xl p-3 border border-border space-y-2">
              <input
                value={newForfait.categorie}
                onChange={e => setNewForfait(p => ({ ...p, categorie: e.target.value }))}
                placeholder="Catégorie (ex : Robes, Sacs, Coaching…)"
                list="cats-add"
                className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <datalist id="cats-add">
                {uniqueCategories.map(c => <option key={c} value={c} />)}
              </datalist>
              <input
                value={newForfait.nom}
                onChange={e => setNewForfait(p => ({ ...p, nom: e.target.value }))}
                placeholder="Nom de l'article *"
                className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <div className="relative">
                <input
                  type="number" value={newForfait.prix_ht}
                  onChange={e => setNewForfait(p => ({ ...p, prix_ht: e.target.value }))}
                  placeholder="Prix *"
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 pr-6"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-xs">€</span>
              </div>
              <div className="flex gap-2">
                <button onClick={addForfait} className="bg-primary text-white text-sm px-4 py-2 rounded-xl font-medium">Ajouter</button>
                <button onClick={() => { setAddingForfait(false); setNewForfait({ nom: '', description: '', prix_ht: '', categorie: '' }) }}
                  className="text-sm text-muted px-3 py-2"><X size={16} /></button>
              </div>
            </div>
          )}

          {/* État vide */}
          {forfaits.length === 0 && !addingForfait && (
            <div className="text-center py-8">
              <p className="text-3xl mb-2">🛍️</p>
              <p className="text-sm font-medium text-stone-700 mb-1">Ton catalogue est vide</p>
              <p className="text-xs text-muted">Ajoute tes articles par catégorie — tu pourras les retrouver directement dans tes commandes</p>
            </div>
          )}

          {/* Articles groupés par catégorie */}
          {uniqueCategories.map(cat => (
            <div key={cat} className="space-y-1.5">
              <p className="text-[11px] font-semibold text-muted uppercase tracking-wider px-1 mt-2">{cat}</p>
              {forfaitsByCategory[cat].map(f => editingForfait === f.id ? (
                <div key={f.id} className="bg-beige-50 rounded-xl p-3 border border-border space-y-2">
                  <input
                    value={editForfait.categorie}
                    onChange={e => setEditForfait(p => ({ ...p, categorie: e.target.value }))}
                    placeholder="Catégorie"
                    list="cats-edit"
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-surface focus:outline-none"
                  />
                  <datalist id="cats-edit">
                    {uniqueCategories.map(c => <option key={c} value={c} />)}
                  </datalist>
                  <input
                    value={editForfait.nom}
                    onChange={e => setEditForfait(p => ({ ...p, nom: e.target.value }))}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-surface focus:outline-none"
                  />
                  <div className="relative">
                    <input
                      type="number" value={editForfait.prix_ht}
                      onChange={e => setEditForfait(p => ({ ...p, prix_ht: e.target.value }))}
                      className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-surface focus:outline-none pr-6"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-xs">€</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => updateForfait(f.id)} className="bg-primary text-white text-sm px-4 py-2 rounded-xl font-medium">Enregistrer</button>
                    <button onClick={() => setEditingForfait(null)} className="text-sm text-muted px-3 py-2"><X size={16} /></button>
                  </div>
                </div>
              ) : (
                <div key={f.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-border hover:border-primary/20 transition">
                  <p className="text-sm font-medium text-stone-800 flex-1 min-w-0 truncate">{f.nom}</p>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    <span className="text-sm font-semibold text-primary">{formatPrice(f.prix_ht)}</span>
                    <button
                      onClick={() => { setEditingForfait(f.id); setEditForfait({ nom: f.nom, description: f.description || '', prix_ht: String(f.prix_ht), categorie: f.categorie || '' }) }}
                      className="p-1 text-muted hover:text-stone-700 transition"><Edit2 size={14} /></button>
                    <button onClick={() => deleteForfait(f.id)} className="p-1 text-muted hover:text-red-500 transition"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </section>
      )}

      {/* ========== ADMIN : Forfaits ========== */}
      {isAdmin && (
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
                <button onClick={() => { setAddingForfait(false); setNewForfait({ nom: '', description: '', prix_ht: '', categorie: '' }) }}
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
                  <button onClick={() => { setEditingForfait(f.id); setEditForfait({ nom: f.nom, description: f.description || '', prix_ht: String(f.prix_ht), categorie: f.categorie || '' }) }}
                    className="p-1 text-muted hover:text-stone-700 transition"><Edit2 size={14} /></button>
                  <button onClick={() => deleteForfait(f.id)} className="p-1 text-muted hover:text-red-500 transition"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            {forfaits.length === 0 && <p className="text-sm text-muted py-2">Aucun forfait configuré</p>}
          </div>
        </section>
      )}

      {/* ========== ADMIN : Éléments à la carte ========== */}
      {isAdmin && (
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
      )}

      {/* ========== Messages (admin + BtoC) ========== */}
      {templates.length > 0 && (
        <section className="bg-surface rounded-2xl border border-border p-4 space-y-3">
          <div>
            <h2 className="font-semibold text-stone-800 text-sm">Mes messages</h2>
            <p className="text-xs text-muted mt-0.5">
              Personnalise les messages envoyés sur WhatsApp. Variables disponibles : <span className="font-mono text-stone-600">[Prénom]</span> <span className="font-mono text-stone-600">[Montant]</span> <span className="font-mono text-stone-600">[Acompte]</span>
            </p>
          </div>

          <div className="space-y-3">
            {templates.map(t => {
              const meta = {
                paiement:       { emoji: '💳', label: 'Message de paiement' },
                relance:        { emoji: '🔔', label: 'Message de relance' },
                remerciement:   { emoji: '🎉', label: 'Message de remerciement' },
              }[t.type] ?? { emoji: '💬', label: t.type }

              return editingTemplate === t.id ? (
                <div key={t.id} className="bg-beige-50 rounded-xl p-3 border border-border space-y-2">
                  <p className="text-xs font-semibold text-stone-700">{meta.emoji} {meta.label}</p>
                  <textarea
                    value={editTemplateContenu}
                    onChange={e => setEditTemplateContenu(e.target.value)}
                    rows={5}
                    className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveTemplate(t.id)}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition ${savedTemplate === t.id ? 'bg-green-100 text-green-700' : 'bg-primary text-white hover:bg-primary-dark'}`}>
                      {savedTemplate === t.id ? <><Check size={14} /> Enregistré</> : <><Save size={14} /> Enregistrer</>}
                    </button>
                    <button onClick={() => setEditingTemplate(null)} className="text-sm text-muted px-3 py-2"><X size={16} /></button>
                  </div>
                </div>
              ) : (
                <div key={t.id} className="rounded-xl border border-border hover:border-primary/20 transition overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2.5 bg-beige-50 border-b border-border">
                    <p className="text-xs font-semibold text-stone-700">{meta.emoji} {meta.label}</p>
                    <button
                      onClick={() => { setEditingTemplate(t.id); setEditTemplateContenu(t.contenu) }}
                      className="flex items-center gap-1 text-xs text-primary font-medium hover:text-primary-dark transition">
                      <Edit2 size={12} /> Modifier
                    </button>
                  </div>
                  <p className="px-3 py-2.5 text-xs text-stone-600 whitespace-pre-line leading-relaxed">{t.contenu}</p>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
