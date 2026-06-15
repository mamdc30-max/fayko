'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { Plus, X, Check, Camera } from 'lucide-react'
import type { ContactReseau } from '@/lib/types'

interface ContactForm {
  prenom: string
  entreprise: string
  sujet: string
  evenement: string
  rencontre_at: string
}

const EMPTY_FORM: ContactForm = {
  prenom: '',
  entreprise: '',
  sujet: '',
  evenement: '',
  rencontre_at: new Date().toISOString().split('T')[0],
}

export default function ContactsReseauPage() {
  const [contacts, setContacts] = useState<ContactReseau[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<ContactForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase
      .from('contacts_reseau')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setContacts(data)
    setLoading(false)
  }

  async function save() {
    if (!form.prenom.trim()) return
    setSaving(true)
    try {
      let photo_url: string | null = null

      // Upload photo si présente
      if (photoFile) {
        const ext = photoFile.name.split('.').pop()
        const fileName = `contacts/${Date.now()}.${ext}`
        const { error } = await supabase.storage.from('photos').upload(fileName, photoFile)
        if (!error) {
          const { data: urlData } = supabase.storage.from('photos').getPublicUrl(fileName)
          photo_url = urlData.publicUrl
        }
      }

      const { data: newContact } = await supabase
        .from('contacts_reseau')
        .insert({
          prenom: form.prenom.trim(),
          entreprise: form.entreprise.trim() || null,
          sujet: form.sujet.trim() || null,
          evenement: form.evenement.trim() || null,
          rencontre_at: form.rencontre_at,
          photo_url,
        })
        .select()
        .single()

      if (newContact) {
        // Créer le rappel J+3 dans les tâches
        const rappelDate = new Date()
        rappelDate.setDate(rappelDate.getDate() + 3)
        await supabase.from('taches').insert({
          texte: `📞 Recontacter ${newContact.prenom}${newContact.entreprise ? ` (${newContact.entreprise})` : ''}${newContact.sujet ? ` — ${newContact.sujet}` : ''}`,
          date: rappelDate.toISOString().split('T')[0],
          source: 'manuel',
        })

        setContacts(prev => [newContact, ...prev])
      }

      setShowForm(false)
      setForm(EMPTY_FORM)
      setPhotoFile(null)
    } finally {
      setSaving(false)
    }
  }

  async function markRappelFait(id: string) {
    await supabase.from('contacts_reseau').update({ rappel_fait: true }).eq('id', id)
    setContacts(prev => prev.map(c => c.id === id ? { ...c, rappel_fait: true } : c))
  }

  async function markConverti(id: string) {
    await supabase.from('contacts_reseau').update({ converti: true }).eq('id', id)
    setContacts(prev => prev.map(c => c.id === id ? { ...c, converti: true } : c))
  }

  // Contacts avec rappel J+3 dû (créés il y a 3+ jours, rappel non fait)
  const threeDaysAgo = new Date()
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
  const aRecontacter = contacts.filter(c =>
    !c.rappel_fait && new Date(c.created_at) <= threeDaysAgo
  )
  const autres = contacts.filter(c =>
    c.rappel_fait || new Date(c.created_at) > threeDaysAgo
  )

  if (loading) return <div className="text-muted text-sm pt-8 text-center">Chargement…</div>

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-stone-800">Contacts réseau</h1>
        <p className="text-xs text-muted mt-0.5">Capture vite, ne perds jamais une rencontre</p>
      </div>

      {/* CTA capture */}
      <button onClick={() => { setForm(EMPTY_FORM); setPhotoFile(null); setShowForm(true) }}
        className="w-full bg-primary rounded-2xl p-5 flex items-center gap-4 hover:bg-primary-dark transition">
        <span className="text-3xl">🤝</span>
        <div className="text-left">
          <p className="font-bold text-white">Capturer un contact</p>
          <p className="text-white/70 text-xs mt-0.5">Rappel automatique J+3 créé dans tes tâches</p>
        </div>
        <Plus size={20} className="ml-auto text-white/80" />
      </button>

      {/* À recontacter */}
      {aRecontacter.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold text-stone-800 text-sm flex items-center gap-2">
            🔔 À recontacter ({aRecontacter.length})
          </h2>
          {aRecontacter.map(c => (
            <div key={c.id} className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-stone-800 text-sm">{c.prenom}{c.entreprise ? ` · ${c.entreprise}` : ''}</p>
                  {c.sujet && <p className="text-xs text-muted mt-0.5 italic">{c.sujet}</p>}
                  {c.evenement && <p className="text-xs text-muted">Rencontré à : {c.evenement} · {formatDate(c.rencontre_at)}</p>}
                </div>
                {c.photo_url && (
                  <img src={c.photo_url} alt="carte" className="w-10 h-10 rounded-lg object-cover border border-amber-200" />
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => markRappelFait(c.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-green-500 text-white text-sm font-medium py-2 rounded-xl hover:bg-green-600 transition">
                  <Check size={14} /> Contacté
                </button>
                <button onClick={() => markConverti(c.id)}
                  className="px-3 py-2 text-xs text-primary border border-primary/20 rounded-xl hover:bg-primary-light transition">
                  → Prospect
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tous les contacts */}
      {autres.length > 0 && (
        <div>
          <h2 className="font-semibold text-stone-800 text-sm mb-2">
            {aRecontacter.length > 0 ? 'Autres contacts' : `Contacts (${autres.length})`}
          </h2>
          <div className="bg-surface divide-y divide-border/40">
          {autres.map(c => (
            <div key={c.id}
              className={`p-4 flex items-start gap-3 ${c.rappel_fait ? 'opacity-60' : ''}`}>
              {c.photo_url ? (
                <img src={c.photo_url} alt="carte" className="w-10 h-10 rounded-lg object-cover border border-border shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-beige-100 border border-border flex items-center justify-center shrink-0 text-sm font-bold text-stone-500">
                  {c.prenom[0].toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-stone-800 text-sm">{c.prenom}{c.entreprise ? ` · ${c.entreprise}` : ''}</p>
                {c.sujet && <p className="text-xs text-muted mt-0.5">{c.sujet}</p>}
                {c.evenement && <p className="text-xs text-muted">{c.evenement} · {formatDate(c.rencontre_at)}</p>}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {c.rappel_fait && (
                  <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                    <Check size={11} /> Contacté
                  </span>
                )}
                {c.converti && (
                  <span className="text-xs text-primary font-medium">Prospect →</span>
                )}
              </div>
            </div>
          ))}
          </div>
        </div>
      )}

      {contacts.length === 0 && (
        <div className="text-center py-10 text-muted">
          <p className="text-3xl mb-3">🤝</p>
          <p className="text-sm font-medium text-stone-700">Aucun contact pour l'instant</p>
          <p className="text-xs mt-1">Capture ton prochain contact réseau en 30 secondes</p>
        </div>
      )}

      {/* Formulaire de capture */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center">
          <div className="bg-surface w-full max-w-lg rounded-t-3xl md:rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-stone-800">Nouveau contact</h2>
              <button onClick={() => setShowForm(false)} className="p-1 text-muted hover:text-stone-800">
                <X size={20} />
              </button>
            </div>

            <div>
              <label className="text-xs text-muted mb-1 block">Prénom *</label>
              <input
                autoFocus
                value={form.prenom}
                onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))}
                placeholder="ex: Sophie"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <label className="text-xs text-muted mb-1 block">Entreprise</label>
              <input
                value={form.entreprise}
                onChange={e => setForm(f => ({ ...f, entreprise: e.target.value }))}
                placeholder="ex: Studio Créatif"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <label className="text-xs text-muted mb-1 block">Sujet évoqué</label>
              <input
                value={form.sujet}
                onChange={e => setForm(f => ({ ...f, sujet: e.target.value }))}
                placeholder="ex: Stratégie réseaux sociaux, collaboration…"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted mb-1 block">Événement</label>
                <input
                  value={form.evenement}
                  onChange={e => setForm(f => ({ ...f, evenement: e.target.value }))}
                  placeholder="ex: Salon E-commerce"
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">Date de rencontre</label>
                <input
                  type="date"
                  value={form.rencontre_at}
                  onChange={e => setForm(f => ({ ...f, rencontre_at: e.target.value }))}
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            {/* Photo carte de visite */}
            <div>
              <label className="text-xs text-muted mb-1 block">Photo carte de visite (optionnel)</label>
              <label className="flex items-center gap-2 border border-dashed border-border rounded-xl px-3 py-2.5 cursor-pointer hover:border-primary/40 transition">
                <Camera size={16} className="text-muted" />
                <span className="text-sm text-muted">
                  {photoFile ? photoFile.name : 'Appuyer pour prendre une photo ou choisir un fichier'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={e => setPhotoFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
              </label>
            </div>

            <div className="bg-primary-light border border-primary/20 rounded-xl px-3 py-2.5">
              <p className="text-xs text-primary">
                🔔 Un rappel J+3 sera automatiquement ajouté dans tes tâches du jour
              </p>
            </div>

            <button
              onClick={save}
              disabled={!form.prenom.trim() || saving}
              className="w-full bg-primary text-white font-semibold py-3 rounded-xl hover:bg-primary-dark transition disabled:opacity-40 flex items-center justify-center gap-2">
              {saving ? 'Enregistrement…' : <><Check size={16} /> Capturer le contact</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
