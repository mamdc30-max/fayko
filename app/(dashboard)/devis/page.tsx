'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { cn, calcTotal, formatPrice, generateDevisText, copyToClipboard } from '@/lib/utils'
import type { Client, Forfait, ElementCarte, DevisFormLigne, Settings } from '@/lib/types'
import { Plus, Trash2, Copy, Check, ChevronDown, ChevronUp, Search, MessageCircle, History } from 'lucide-react'
import { useUserContext } from '@/lib/user-context'

export default function NewDevisPage() {
  const router = useRouter()
  const { isAdmin } = useUserContext()

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
  const [showRemise, setShowRemise] = useState(false)

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
        supabase.from('settings').select('*').single(),
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
      modeReglement, settings.acompte_pourcentage, isAdmin
    )
    setPreview(text)
  }, [selectedClient, lignes, remiseType, remiseValeur, modeReglement, settings, isAdmin])

  const filteredClients = clients.filter(c =>
    `${c.prenom} ${c.nom}`.toLowerCase().includes(clientSearch.toLowerCase())
  )

  // Catalogue groupé par catégorie (BtoC)
  const forfaitsByCategory = forfaits.reduce((acc, f) => {
    const cat = f.categorie || 'Général'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(f)
    return acc
  }, {} as Record<string, Forfait[]>)

  function addForfait(f: Forfait) {
    setLignes(prev => [...prev, { id: crypto.randomUUID(), type: 'forfait', libelle: f.nom, description: f.description || null, prix: f.prix_ht, quantite: 1, ref_id: f.id }])
    setOpenSection(null)
  }

  function addElement(e: ElementCarte) {
    setLignes(prev => [...prev, { id: crypto.randomUUID(), type: 'element', libelle: e.nom, prix: e.prix, quantite: 1, ref_id: e.id }])
    setOpenSection(null)
  }

  function addLibre() {
    setLignes(prev => [...prev, { id: crypto.randomUUID(), type: 'libre', libelle: '', prix: 0, quantite: 1 }])
    setOpenSection(null)
  }

  function removeLigne(id: string) {
    setLignes(prev => prev.filter(l => l.id !== id))
  }

  function updateLigne(id: string, field: 'libelle' | 'prix' | 'quantite', value: string) {
    setLignes(prev => prev.map(l =>
      l.id === id ? {
        ...l,
        [field]: field === 'libelle' ? value : (parseFloat(value) || (field === 'quantite' ? 1 : 0))
      } : l
    ))
  }

  async function saveDevis(): Promise<string | null> {
    if (!selectedClient || lignes.length === 0) return null
    let clientId = selectedClient.id

    if (showClientForm) {
      const { data: created } = await supabase
        .from('clients').insert(newClient).select().single()
      if (created) {
        clientId = created.id
        setSelectedClient(created)
        setClients(prev => [...prev, created])
      }
    }

    const { total } = calcTotal(lignes, remiseType || null, remiseValeur ? parseFloat(remiseValeur) : null)
    const { data: last } = await supabase
      .from('devis').select('numero').order('numero', { ascending: false }).limit(1).single()
    const numero = (last?.numero ?? 0) + 1

    // Titre auto si vide (BtoC)
    const titreToSave = titre.trim() || `Commande du ${new Date().toLocaleDateString('fr-FR')}`

    const { data: devis } = await supabase.from('devis').insert({
      numero, titre: titreToSave, client_id: clientId, statut: 'Envoyé',
      remise_type: remiseType || null,
      remise_valeur: remiseValeur ? parseFloat(remiseValeur) : null,
      mode_reglement: modeReglement,
      acompte_pourcentage: settings.acompte_pourcentage,
      total_ht: total,
    }).select().single()

    if (devis) {
      await supabase.from('devis_lignes').insert(
        lignes.map((l, i) => ({ devis_id: devis.id, type: l.type, libelle: l.libelle, description: l.description || null, prix: l.prix, quantite: l.quantite || 1, ref_id: l.ref_id || null, ordre: i }))
      )
      await supabase.from('devis_statut_history').insert({ devis_id: devis.id, statut: 'Envoyé' })
    }
    return clientId
  }

  async function handleWhatsApp() {
    if (!selectedClient?.whatsapp || !canCopy || saving) return
    setSaving(true)
    try {
      await saveDevis()
      const url = `https://wa.me/${selectedClient.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(preview)}`
      window.open(url, '_blank')
      setCopied(true)
    } finally {
      setSaving(false)
    }
  }

  async function handleCopy() {
    setSaving(true)
    try {
      await saveDevis()
      await copyToClipboard(preview)
      setCopied(true)
    } finally {
      setSaving(false)
    }
  }

  const { total } = calcTotal(lignes, remiseType || null, remiseValeur ? parseFloat(remiseValeur) : null)
  const acompte = total * settings.acompte_pourcentage / 100
  const canCopy = !!selectedClient && lignes.length > 0

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-stone-800">{isAdmin ? 'Nouveau devis' : 'Nouvelle commande'}</h1>
        <p className="text-xs text-muted mt-0.5">
          {isAdmin ? 'Remplis les informations, copie et envoie sur WhatsApp' : 'Choisis les articles et envoie sur WhatsApp en 30 secondes'}
        </p>
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
            <input value={newClient.whatsapp} onChange={e => setNewClient(p => ({ ...p, whatsapp: e.target.value }))}
              placeholder="WhatsApp (ex: +33612345678)" className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-beige-50 focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (newClient.prenom && newClient.nom) {
                    setSelectedClient({ id: 'new', ...newClient, marque: null, derniere_synthese: null, derniere_synthese_at: null, created_at: '' })
                    setShowClientForm(false)
                  }
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
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm text-stone-800">{selectedClient.prenom} {selectedClient.nom}</p>
                {selectedClient.id === 'new' && (
                  <span className="text-[10px] font-semibold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Nouveau ✓</span>
                )}
              </div>
              {selectedClient.whatsapp && <p className="text-xs text-muted">{selectedClient.whatsapp}</p>}
            </div>
            <button onClick={() => setSelectedClient(null)} className="text-xs text-muted hover:text-stone-700">Changer</button>
          </div>
        )}
      </section>

      {/* TITRE */}
      <section className="bg-surface rounded-2xl border border-border p-4">
        <label className="block font-semibold text-stone-800 text-sm mb-2">
          {isAdmin ? "Titre de l'offre" : 'Intitulé'}
          {!isAdmin && <span className="text-muted font-normal text-xs ml-1">(optionnel)</span>}
        </label>
        <input
          value={titre}
          onChange={e => setTitre(e.target.value)}
          placeholder={isAdmin ? 'Ex : Logo + Carte de visite' : 'Ex : Commande du 15 juin'}
          className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-beige-50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </section>

      {/* LIGNES */}
      <section className="bg-surface rounded-2xl border border-border p-4 space-y-3">
        <h2 className="font-semibold text-stone-800 text-sm">{isAdmin ? 'Éléments du devis' : 'Articles de la commande'}</h2>

        {lignes.map(ligne => (
          <div key={ligne.id} className="bg-beige-50 border border-border rounded-xl p-3 space-y-2">
            {/* Ligne 1 : label + supprimer */}
            <div className="flex items-start gap-2">
              {ligne.type === 'libre' ? (
                <input
                  value={ligne.libelle}
                  onChange={e => updateLigne(ligne.id, 'libelle', e.target.value)}
                  placeholder="Description de l'article"
                  className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              ) : (
                <div className="flex-1">
                  <p className="text-sm font-medium text-stone-800">{ligne.libelle}</p>
                  {ligne.description && <p className="text-xs text-muted mt-0.5">{ligne.description}</p>}
                </div>
              )}
              <button onClick={() => removeLigne(ligne.id)} className="text-muted hover:text-red-500 transition p-1 shrink-0 mt-0.5">
                <Trash2 size={15} />
              </button>
            </div>
            {/* Ligne 2 : quantité × prix = total */}
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={ligne.quantite || 1}
                onChange={e => updateLigne(ligne.id, 'quantite', e.target.value)}
                className="w-14 border border-border rounded-lg px-2 py-1.5 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 text-center"
              />
              <span className="text-muted text-xs font-medium">×</span>
              <div className="flex-1 relative">
                <input
                  type="number"
                  value={ligne.prix || ''}
                  onChange={e => updateLigne(ligne.id, 'prix', e.target.value)}
                  placeholder="Prix unitaire"
                  className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 pr-6"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted">€</span>
              </div>
              <span className="text-muted text-xs">=</span>
              <span className="text-sm font-bold text-stone-800 shrink-0 min-w-[60px] text-right">
                {formatPrice((ligne.quantite || 1) * ligne.prix)}
              </span>
            </div>
          </div>
        ))}

        {/* Add buttons */}
        <div className="space-y-2">
          {/* Forfaits / Articles */}
          <div>
            <button
              onClick={() => setOpenSection(openSection === 'forfaits' ? null : 'forfaits')}
              className="flex items-center gap-2 text-sm text-primary font-medium"
            >
              <Plus size={15} />
              {isAdmin ? 'Ajouter un forfait' : 'Ajouter un article'}
              {openSection === 'forfaits' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {openSection === 'forfaits' && (
              <div className="mt-2 border border-border rounded-xl overflow-hidden">
                {isAdmin ? (
                  // Admin : liste plate
                  forfaits.length === 0
                    ? <p className="px-4 py-2.5 text-sm text-muted">Aucun forfait configuré</p>
                    : forfaits.map(f => (
                      <button key={f.id} onClick={() => addForfait(f)}
                        className="w-full text-left px-4 py-2.5 hover:bg-beige-50 text-sm border-b border-border last:border-0 flex justify-between">
                        <span>{f.nom}</span>
                        <span className="text-primary font-medium">{formatPrice(f.prix_ht)}</span>
                      </button>
                    ))
                ) : (
                  // BtoC : groupé par catégorie
                  Object.keys(forfaitsByCategory).length === 0
                    ? <p className="px-4 py-3 text-sm text-muted">Aucun article — crée ton catalogue dans Paramètres</p>
                    : Object.entries(forfaitsByCategory).map(([cat, items]) => (
                      <div key={cat}>
                        <div className="px-3 py-1.5 bg-beige-100 border-b border-border">
                          <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">{cat}</p>
                        </div>
                        {items.map(f => (
                          <button key={f.id} onClick={() => addForfait(f)}
                            className="w-full text-left px-4 py-2.5 hover:bg-beige-50 text-sm border-b border-border last:border-0 flex justify-between">
                            <span>{f.nom}</span>
                            <span className="text-primary font-medium">{formatPrice(f.prix_ht)}</span>
                          </button>
                        ))}
                      </div>
                    ))
                )}
              </div>
            )}
          </div>

          {/* Éléments — admin uniquement */}
          {isAdmin && (
            <div>
              <button
                onClick={() => setOpenSection(openSection === 'elements' ? null : 'elements')}
                className="flex items-center gap-2 text-sm text-primary font-medium"
              >
                <Plus size={15} />
                Ajouter un élément
                {openSection === 'elements' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {openSection === 'elements' && (
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
            </div>
          )}

          {/* Ligne libre */}
          <div>
            <button
              onClick={() => setOpenSection(openSection === 'libre' ? null : 'libre')}
              className="flex items-center gap-2 text-sm text-primary font-medium"
            >
              <Plus size={15} />
              Ajouter une ligne libre
              {openSection === 'libre' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {openSection === 'libre' && (
              <div className="mt-2">
                <button onClick={addLibre} className="bg-beige-100 text-stone-700 text-sm px-4 py-2 rounded-xl border border-border">
                  Ajouter une ligne vide
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* REMISE */}
      {(isAdmin || showRemise) ? (
        <section className="bg-surface rounded-2xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-stone-800 text-sm">Remise (optionnelle)</h2>
            {!isAdmin && <button onClick={() => { setShowRemise(false); setRemiseType(''); setRemiseValeur('') }} className="text-xs text-muted">Supprimer</button>}
          </div>
          <div className="flex gap-2">
            <select value={remiseType} onChange={e => setRemiseType(e.target.value as 'fixe' | 'pourcentage' | '')}
              className="border border-border rounded-xl px-3 py-2.5 text-sm bg-beige-50 focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">Aucune</option>
              <option value="fixe">Montant fixe (€)</option>
              <option value="pourcentage">Pourcentage (%)</option>
            </select>
            {remiseType && (
              <input type="number" value={remiseValeur} onChange={e => setRemiseValeur(e.target.value)}
                className="flex-1 border border-border rounded-xl px-3 py-2.5 text-sm bg-beige-50 focus:outline-none focus:ring-2 focus:ring-primary/30" />
            )}
          </div>
        </section>
      ) : (
        <button onClick={() => setShowRemise(true)} className="text-xs text-muted flex items-center gap-1 px-1">
          + Ajouter une remise
        </button>
      )}

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

      {/* CTA BUTTONS */}
      {!copied ? (
        <div className="space-y-3">
          {selectedClient?.whatsapp ? (
            <>
              {/* Primary: WhatsApp */}
              <button
                onClick={handleWhatsApp}
                disabled={!canCopy || saving}
                className={cn(
                  'flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-bold text-base transition',
                  canCopy && !saving
                    ? 'bg-[#25D366] text-white hover:bg-[#1ebe5d]'
                    : 'bg-beige-200 text-muted cursor-not-allowed'
                )}
              >
                <MessageCircle size={20} />
                {saving ? 'Enregistrement…' : 'Envoyer sur WhatsApp'}
              </button>
              {/* Secondary: Copy */}
              {canCopy && (
                <button onClick={handleCopy}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border border-border text-stone-600 text-sm font-medium hover:bg-beige-50 transition">
                  <Copy size={16} /> Copier le texte sans envoyer
                </button>
              )}
            </>
          ) : (
            <>
              {/* Primary: Copy (no WhatsApp number) */}
              <button
                onClick={handleCopy}
                disabled={!canCopy || saving}
                className={cn(
                  'w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition',
                  canCopy ? 'bg-primary text-white hover:bg-primary-dark' : 'bg-beige-200 text-muted cursor-not-allowed'
                )}
              >
                <Copy size={20} />
                {saving ? 'Enregistrement…' : (isAdmin ? 'Copier le devis' : 'Copier la commande')}
              </button>
              {/* Warning: no WhatsApp */}
              {canCopy && (
                <p className="text-center text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  💡 Ajoute le numéro WhatsApp du client pour envoyer directement
                </p>
              )}
            </>
          )}
          {!canCopy && (
            <p className="text-center text-xs text-muted">
              Sélectionne un client et ajoute au moins un article
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-green-100 text-green-700 font-bold text-base">
            <Check size={20} /> {isAdmin ? 'Devis envoyé !' : 'Commande envoyée ! 🎉'}
          </div>
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
