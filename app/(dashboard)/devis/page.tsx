'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { calcTotal, formatPrice, generateDevisText, copyToClipboard } from '@/lib/utils'
import type { Client, Forfait, ElementCarte, DevisFormLigne, Settings } from '@/lib/types'
import { Plus, Trash2, Copy, Check, ChevronDown, ChevronUp, Search, MessageCircle, History } from 'lucide-react'
import { cn } from '@/lib/utils'

let lineCounter = 0
function newId() { return `line-${++lineCounter}` }

export default function NewDevisPage() {
  const router = useRouter()

  // Data
  const [clients, setClients] = useState<Client[]>([])
  const [forfaits, setForfaits] = useState<Forfait[]>([])
  const [elements, setElements] = useState<ElementCarte[]>([])
  const [settings, setSettings] = useState<Settings>({ id: 1, acompte_pourcentage: 50 })

  // Form state
  const [clientSearch, setClientSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [showClientForm, setShowClientForm] = useState(false)
  const [newClient, setNewClient] = useState({ prenom: '', nom: '', marque: '', whatsapp: '' })
  const [titre, setTitre] = useState('')
  const [lignes, setLignes] = useState<DevisFormLigne[]>([])
  const [remiseType, setRemiseType] = useState<'fixe' | 'pourcentage' | ''>('')
  const [remiseValeur, setRemiseValeur] = useState('')
  const [modeReglement, setModeReglement] = useState<'acompte' | 'total'>('acompte')

  // UI state
  const [openSection, setOpenSection] = useState<'forfaits' | 'elements' | 'libre' | null>(null)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState('')

  useEffect(() => {
    async function load() {
      const [{ data: c }, { data: f }, { data: e }, { data: s }] = await Promise.all([
        supabase.from('clients').select('*').order('nom'),
        supabase.from('forfaits').select('*').order('nom'),
        supabase.from('elements_carte').select('*').order('nom'),
        supabase.from('settings').select('*').eq('id', 1).single(),
      ])
      if (c) setClients(c)
      if (f) setForfaits(f)
      if (e) setElements(e)
      if (s) setSettings(s)
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedClient) { setPreview(''); return }
    const text = generateDevisText(
      selectedClient, lignes,
      remiseType || null, remiseValeur ? parseFloat(remiseValeur) : null,
      modeReglement, settings.acompte_pourcentage
    )
    setPreview(text)
  }, [selectedClient, lignes, remiseType, remiseValeur, modeReglement, settings])

  const filteredClients = clients.filter(c =>
    `${c.prenom} ${c.nom}`.toLowerCase().includes(clientSearch.toLowerCase())
  )

  function addForfait(f: Forfait) {
    setLignes(prev => [...prev, { id: newId(), type: 'forfait', libelle: f.nom, description: f.description || null, prix: f.prix_ht, ref_id: f.id }])
    setOpenSection(null)
  }

  function addElement(e: ElementCarte) {
    setLignes(prev => [...prev, { id: newId(), type: 'element', libelle: e.nom, prix: e.prix, ref_id: e.id }])
    setOpenSection(null)
  }

  function addLibre() {
    setLignes(prev => [...prev, { id: newId(), type: 'libre', libelle: '', prix: 0 }])
    setOpenSection(null)
  }

  function removeLigne(id: string) {
    setLignes(prev => prev.filter(l => l.id !== id))
  }

  function updateLigne(id: string, field: 'libelle' | 'prix', value: string) {
    setLignes(prev => prev.map(l =>
      l.id === id ? { ...l, [field]: field === 'prix' ? parseFloat(value) || 0 : value } : l
    ))
  }

  async function handleCopy() {
    if (!selectedClient || lignes.length === 0) return

    setSaving(true)
    try {
      let clientId = selectedClient.id

      // Create new client if needed
      if (showClientForm) {
        const { data: created } = await supabase
          .from('clients')
          .insert(newClient)
          .select()
          .single()
        if (created) {
          clientId = created.id
          setSelectedClient(created)
          setClients(prev => [...prev, created])
        }
      }

      const { sousTotal, remise, total } = calcTotal(
        lignes,
        remiseType || null,
        remiseValeur ? parseFloat(remiseValeur) : null
      )

      // Get next numero
      const { data: last } = await supabase
        .from('devis').select('numero').order('numero', { ascending: false }).limit(1).single()
      const numero = (last?.numero ?? 0) + 1

      // Save devis
      const { data: devis } = await supabase.from('devis').insert({
        numero,
        titre,
        client_id: clientId,
        statut: 'Envoyé',
        remise_type: remiseType || null,
        remise_valeur: remiseValeur ? parseFloat(remiseValeur) : null,
        mode_reglement: modeReglement,
        acompte_pourcentage: settings.acompte_pourcentage,
        total_ht: total,
      }).select().single()

      if (devis) {
        // Save lignes
        await supabase.from('devis_lignes').insert(
          lignes.map((l, i) => ({ devis_id: devis.id, type: l.type, libelle: l.libelle, description: l.description || null, prix: l.prix, ref_id: l.ref_id || null, ordre: i }))
        )
        // Save initial statut
        await supabase.from('devis_statut_history').insert({ devis_id: devis.id, statut: 'Envoyé' })
      }

      await copyToClipboard(preview)
      setCopied(true)
    } finally {
      setSaving(false)
    }
  }

  const { total } = calcTotal(lignes, remiseType || null, remiseValeur ? parseFloat(remiseValeur) : null)
  const acompte = total * settings.acompte_pourcentage / 100
  const canCopy = selectedClient && titre && lignes.length > 0

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-stone-800">Nouveau devis</h1>
        <p className="text-xs text-muted mt-0.5">Remplis les informations, copie et envoie sur WhatsApp</p>
      </div>

      {/* CLIENT */}
      <section className="bg-surface rounded-2xl border border-border p-4 space-y-3">
        <h2 className="font-semibold text-stone-800 text-sm">Client</h2>

        {!selectedClient && !showClientForm && (
          <>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                placeholder="Rechercher un client existant…"
                className="w-full pl-9 pr-4 py-2.5 border border-border rounded-xl text-sm bg-beige-50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            {clientSearch && (
              <div className="border border-border rounded-xl overflow-hidden">
                {filteredClients.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedClient(c); setClientSearch('') }}
                    className="w-full text-left px-4 py-2.5 hover:bg-beige-50 text-sm border-b border-border last:border-0"
                  >
                    {c.prenom} {c.nom} {c.whatsapp && <span className="text-muted text-xs ml-2">{c.whatsapp}</span>}
                  </button>
                ))}
                {filteredClients.length === 0 && (
                  <p className="px-4 py-2.5 text-sm text-muted">Aucun résultat</p>
                )}
              </div>
            )}
            <button
              onClick={() => setShowClientForm(true)}
              className="text-sm text-primary font-medium flex items-center gap-1"
            >
              <Plus size={15} /> Nouveau client
            </button>
          </>
        )}

        {showClientForm && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input value={newClient.prenom} onChange={e => setNewClient(p => ({ ...p, prenom: e.target.value }))}
                placeholder="Prénom *" className="border border-border rounded-xl px-3 py-2.5 text-sm bg-beige-50 focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <input value={newClient.nom} onChange={e => setNewClient(p => ({ ...p, nom: e.target.value }))}
                placeholder="Nom *" className="border border-border rounded-xl px-3 py-2.5 text-sm bg-beige-50 focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <input value={newClient.marque} onChange={e => setNewClient(p => ({ ...p, marque: e.target.value }))}
              placeholder="Nom de marque / activité (optionnel)" className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-beige-50 focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <input value={newClient.whatsapp} onChange={e => setNewClient(p => ({ ...p, whatsapp: e.target.value }))}
              placeholder="WhatsApp (ex: +33612345678)" className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-beige-50 focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (newClient.prenom && newClient.nom)
                    setSelectedClient({ id: 'new', ...newClient, marque: newClient.marque || null, derniere_synthese: null, derniere_synthese_at: null, created_at: '' })
                }}
                className="bg-primary text-white text-sm px-4 py-2 rounded-xl font-medium"
              >
                Valider
              </button>
              <button onClick={() => setShowClientForm(false)} className="text-sm text-muted px-3 py-2">Annuler</button>
            </div>
          </div>
        )}

        {selectedClient && (
          <div className="flex items-center justify-between bg-primary-light rounded-xl px-3 py-2.5">
            <div>
              <p className="font-medium text-sm text-stone-800">{selectedClient.prenom} {selectedClient.nom}</p>
              {selectedClient.marque && <p className="text-xs text-primary font-medium">{selectedClient.marque}</p>}
              {selectedClient.whatsapp && <p className="text-xs text-muted">{selectedClient.whatsapp}</p>}
            </div>
            <button onClick={() => setSelectedClient(null)} className="text-xs text-muted hover:text-stone-700">Changer</button>
          </div>
        )}
      </section>

      {/* TITRE */}
      <section className="bg-surface rounded-2xl border border-border p-4">
        <label className="block font-semibold text-stone-800 text-sm mb-2">Titre de l'offre</label>
        <input
          value={titre}
          onChange={e => setTitre(e.target.value)}
          placeholder="Ex : Logo + Carte de visite"
          className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-beige-50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </section>

      {/* LIGNES */}
      <section className="bg-surface rounded-2xl border border-border p-4 space-y-3">
        <h2 className="font-semibold text-stone-800 text-sm">Éléments du devis</h2>

        {lignes.map(ligne => (
          <div key={ligne.id} className="flex items-center gap-2">
            <div className="flex-1">
              {ligne.type === 'libre' ? (
                <input
                  value={ligne.libelle}
                  onChange={e => updateLigne(ligne.id, 'libelle', e.target.value)}
                  placeholder="Description"
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-beige-50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              ) : (
                <div className="bg-beige-50 border border-border rounded-xl px-3 py-2 text-sm text-stone-700">
                  <span>{ligne.libelle}</span>
                  {ligne.description && <p className="text-xs text-muted mt-0.5">{ligne.description}</p>}
                </div>
              )}
            </div>
            <div className="w-24">
              <div className="relative">
                <input
                  type="number"
                  value={ligne.prix || ''}
                  onChange={e => updateLigne(ligne.id, 'prix', e.target.value)}
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-beige-50 focus:outline-none focus:ring-2 focus:ring-primary/30 pr-6"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted">€</span>
              </div>
            </div>
            <button onClick={() => removeLigne(ligne.id)} className="text-muted hover:text-red-500 transition p-1">
              <Trash2 size={16} />
            </button>
          </div>
        ))}

        {/* Add buttons */}
        <div className="space-y-2">
          {(['forfaits', 'elements', 'libre'] as const).map(section => (
            <div key={section}>
              <button
                onClick={() => setOpenSection(openSection === section ? null : section)}
                className="flex items-center gap-2 text-sm text-primary font-medium"
              >
                <Plus size={15} />
                {section === 'forfaits' ? 'Ajouter un forfait' : section === 'elements' ? 'Ajouter un élément' : 'Ajouter une ligne libre'}
                {openSection === section ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {openSection === section && section === 'forfaits' && (
                <div className="mt-2 border border-border rounded-xl overflow-hidden">
                  {forfaits.map(f => (
                    <button key={f.id} onClick={() => addForfait(f)}
                      className="w-full text-left px-4 py-2.5 hover:bg-beige-50 text-sm border-b border-border last:border-0 flex justify-between">
                      <span>{f.nom}</span>
                      <span className="text-primary font-medium">{formatPrice(f.prix_ht)}</span>
                    </button>
                  ))}
                  {forfaits.length === 0 && <p className="px-4 py-2.5 text-sm text-muted">Aucun forfait configuré</p>}
                </div>
              )}

              {openSection === section && section === 'elements' && (
                <div className="mt-2 border border-border rounded-xl overflow-hidden">
                  {elements.map(e => (
                    <button key={e.id} onClick={() => addElement(e)}
                      className="w-full text-left px-4 py-2.5 hover:bg-beige-50 text-sm border-b border-border last:border-0 flex justify-between">
                      <span>{e.nom}</span>
                      <span className="text-primary font-medium">{formatPrice(e.prix)}</span>
                    </button>
                  ))}
                  {elements.length === 0 && <p className="px-4 py-2.5 text-sm text-muted">Aucun élément configuré</p>}
                </div>
              )}

              {openSection === section && section === 'libre' && (
                <div className="mt-2">
                  <button onClick={addLibre} className="bg-beige-100 text-stone-700 text-sm px-4 py-2 rounded-xl border border-border">
                    Ajouter une ligne vide
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* REMISE */}
      <section className="bg-surface rounded-2xl border border-border p-4 space-y-3">
        <h2 className="font-semibold text-stone-800 text-sm">Remise (optionnelle)</h2>
        <div className="flex gap-2">
          <select
            value={remiseType}
            onChange={e => setRemiseType(e.target.value as 'fixe' | 'pourcentage' | '')}
            className="border border-border rounded-xl px-3 py-2.5 text-sm bg-beige-50 focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Aucune</option>
            <option value="fixe">Montant fixe (€)</option>
            <option value="pourcentage">Pourcentage (%)</option>
          </select>
          {remiseType && (
            <input
              type="number"
              value={remiseValeur}
              onChange={e => setRemiseValeur(e.target.value)}
              placeholder={remiseType === 'fixe' ? '0' : '0'}
              className="flex-1 border border-border rounded-xl px-3 py-2.5 text-sm bg-beige-50 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          )}
        </div>
      </section>

      {/* MODE RÈGLEMENT */}
      <section className="bg-surface rounded-2xl border border-border p-4">
        <h2 className="font-semibold text-stone-800 text-sm mb-3">Mode de règlement</h2>
        <div className="grid grid-cols-2 gap-2">
          {(['acompte', 'total'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setModeReglement(mode)}
              className={cn(
                'py-2.5 rounded-xl text-sm font-medium border transition',
                modeReglement === mode
                  ? 'bg-primary text-white border-primary'
                  : 'bg-beige-50 text-stone-700 border-border hover:border-primary/30'
              )}
            >
              {mode === 'acompte' ? `Acompte ${settings.acompte_pourcentage}%` : 'Paiement total'}
            </button>
          ))}
        </div>
      </section>

      {/* TOTAL */}
      {lignes.length > 0 && (
        <div className="bg-primary-light border border-primary/20 rounded-2xl p-4 space-y-1">
          <div className="flex justify-between text-sm font-semibold text-stone-800">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>
          {modeReglement === 'acompte' && (
            <div className="flex justify-between text-sm text-primary font-medium">
              <span>Acompte ({settings.acompte_pourcentage}%)</span>
              <span>{formatPrice(acompte)}</span>
            </div>
          )}
        </div>
      )}

      {/* PREVIEW */}
      {preview && (
        <section className="bg-surface rounded-2xl border border-border p-4">
          <h2 className="font-semibold text-stone-800 text-sm mb-3">Aperçu WhatsApp</h2>
          <pre className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed font-sans bg-beige-50 rounded-xl p-3 border border-border">
            {preview}
          </pre>
        </section>
      )}

      {/* COPY BUTTON */}
      {!copied ? (
        <>
          <button
            onClick={handleCopy}
            disabled={!canCopy || saving}
            className={cn(
              'w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition',
              canCopy
                ? 'bg-primary text-white hover:bg-primary-dark'
                : 'bg-beige-200 text-muted cursor-not-allowed'
            )}
          >
            <Copy size={20} />
            {saving ? 'Enregistrement…' : 'Copier le devis'}
          </button>
          {!canCopy && (
            <p className="text-center text-xs text-muted -mt-3">
              Sélectionne un client, ajoute un titre et au moins un élément
            </p>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-green-100 text-green-700 font-semibold text-sm">
            <Check size={18} /> Devis copié et enregistré !
          </div>
          {selectedClient?.whatsapp && (
            <a
              href={`https://wa.me/${selectedClient.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(preview)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-[#25D366] text-white font-bold text-base hover:bg-[#1ebe5d] transition"
            >
              <MessageCircle size={20} /> Envoyer sur WhatsApp
            </a>
          )}
          <button
            onClick={() => router.push('/historique')}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border border-border text-stone-600 text-sm font-medium hover:bg-beige-50 transition"
          >
            <History size={16} /> Voir l'historique
          </button>
        </div>
      )}
    </div>
  )
}
