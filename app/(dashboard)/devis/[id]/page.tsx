'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { calcTotal, formatPrice, formatDate, generateDevisText, copyToClipboard, STATUTS, STATUT_COLORS, applyTemplateVars } from '@/lib/utils'
import type { Devis, Client, DevisLigne, DevisFormLigne, Settings, Template } from '@/lib/types'
import { Copy, Check, Trash2, ChevronLeft, Save, Download, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useUserContext } from '@/lib/user-context'

let lc = 0
function newId() { return `l-${++lc}` }

export default function DevisFichePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { isAdmin } = useUserContext()

  const [devis, setDevis] = useState<Devis | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [settings, setSettings] = useState<Settings>({ id: 1, acompte_pourcentage: 50 })
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)

  // Edit state
  const [titre, setTitre] = useState('')
  const [lignes, setLignes] = useState<DevisFormLigne[]>([])
  const [remiseType, setRemiseType] = useState<'fixe' | 'pourcentage' | ''>('')
  const [remiseValeur, setRemiseValeur] = useState('')
  const [modeReglement, setModeReglement] = useState<'acompte' | 'total'>('acompte')
  const [statut, setStatut] = useState('')

  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [templateCopied, setTemplateCopied] = useState<number | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showRemerciement, setShowRemerciement] = useState(false)
  const [prevStatut, setPrevStatut] = useState('')

  useEffect(() => {
    async function load() {
      const [{ data: d }, { data: s }, { data: t }] = await Promise.all([
        supabase.from('devis').select('*, clients(*), devis_lignes(*), devis_statut_history(*)').eq('id', id).single(),
        supabase.from('settings').select('*').single(),
        supabase.from('templates').select('*').order('id'),
      ])
      if (d) {
        setDevis(d)
        setClient(d.clients)
        setTitre(d.titre)
        setStatut(d.statut)
        setPrevStatut(d.statut)
        setRemiseType(d.remise_type || '')
        setRemiseValeur(d.remise_valeur?.toString() || '')
        setModeReglement(d.mode_reglement)
        setLignes((d.devis_lignes || []).sort((a: DevisLigne, b: DevisLigne) => a.ordre - b.ordre).map((l: DevisLigne) => ({
          id: l.id, type: l.type, libelle: l.libelle, prix: l.prix, quantite: l.quantite || 1, ref_id: l.ref_id || undefined,
        })))
      }
      if (s) setSettings(s)
      if (t) setTemplates(t)
      setLoading(false)
    }
    load()
  }, [id])

  // Auto-show remerciement template when status changes to Soldé
  useEffect(() => {
    if (statut === 'Soldé' && prevStatut !== 'Soldé') {
      setShowRemerciement(true)
    }
  }, [statut, prevStatut])

  function updateLigne(lid: string, field: 'libelle' | 'prix' | 'quantite', value: string) {
    setLignes(prev => prev.map(l =>
      l.id === lid ? {
        ...l,
        [field]: field === 'libelle' ? value : (parseFloat(value) || (field === 'quantite' ? 1 : 0))
      } : l
    ))
  }

  function removeLigne(lid: string) {
    setLignes(prev => prev.filter(l => l.id !== lid))
  }

  async function handleSave() {
    if (!devis || !client) return
    setSaving(true)
    try {
      const { total } = calcTotal(lignes, remiseType || null, remiseValeur ? parseFloat(remiseValeur) : null)

      await supabase.from('devis').update({
        titre,
        statut,
        remise_type: remiseType || null,
        remise_valeur: remiseValeur ? parseFloat(remiseValeur) : null,
        mode_reglement: modeReglement,
        total_ht: total,
        updated_at: new Date().toISOString(),
      }).eq('id', id)

      // Update lignes: delete all and re-insert
      await supabase.from('devis_lignes').delete().eq('devis_id', id)
      await supabase.from('devis_lignes').insert(
        lignes.map((l, i) => ({ devis_id: id, type: l.type, libelle: l.libelle, prix: l.prix, quantite: l.quantite || 1, ref_id: l.ref_id || null, ordre: i }))
      )

      // Track statut change
      if (statut !== prevStatut) {
        await supabase.from('devis_statut_history').insert({ devis_id: id, statut })
        setPrevStatut(statut)
      }

      setDevis(prev => prev ? { ...prev, titre, statut: statut as Devis['statut'], total_ht: total } : prev)
    } finally {
      setSaving(false)
    }
  }

  async function handleCopyDevis() {
    if (!client || !devis) return
    const text = generateDevisText(client, lignes, remiseType || null, remiseValeur ? parseFloat(remiseValeur) : null, modeReglement, settings.acompte_pourcentage, isAdmin)
    await copyToClipboard(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleCopyTemplate(template: Template) {
    if (!client || !devis) return
    const text = applyTemplateVars(template.contenu, client, { ...devis, total_ht: calcTotal(lignes, remiseType || null, remiseValeur ? parseFloat(remiseValeur) : null).total }, settings.acompte_pourcentage)
    await copyToClipboard(text)
    setTemplateCopied(template.id)
    setTimeout(() => setTemplateCopied(null), 2000)
  }

  async function handleDelete() {
    await supabase.from('devis').delete().eq('id', id)
    router.replace('/historique')
  }

  if (loading) return <div className="text-muted text-sm pt-8 text-center">Chargement…</div>
  if (!devis || !client) return <div className="text-muted text-sm pt-8 text-center">{isAdmin ? 'Devis introuvable' : 'Commande introuvable'}</div>

  const { total } = calcTotal(lignes, remiseType || null, remiseValeur ? parseFloat(remiseValeur) : null)
  const acompte = total * settings.acompte_pourcentage / 100
  const remerciementTemplate = templates.find(t => t.type === 'remerciement')

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/historique" className="p-2 rounded-xl hover:bg-beige-100 text-muted transition">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-stone-800">
            #{String(devis.numero).padStart(3, '0')} — {client.prenom} {client.nom}
          </h1>
          <p className="text-xs text-muted">{formatDate(devis.created_at)}</p>
        </div>
      </div>

      {/* Auto remerciement */}
      {showRemerciement && remerciementTemplate && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
          <p className="text-sm font-semibold text-green-800 mb-2">🎉 Paiement reçu — envoie un message de remerciement !</p>
          <pre className="text-xs text-green-700 whitespace-pre-wrap leading-relaxed font-sans mb-3 bg-white rounded-xl p-3 border border-green-100">
            {applyTemplateVars(remerciementTemplate.contenu, client, { ...devis, total_ht: total }, settings.acompte_pourcentage)}
          </pre>
          <div className="flex gap-2 flex-wrap">
            {client.whatsapp ? (
              <a
                href={`https://wa.me/${client.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(applyTemplateVars(remerciementTemplate.contenu, client, { ...devis, total_ht: total }, settings.acompte_pourcentage))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-[#25D366] text-white text-sm px-4 py-2 rounded-xl font-medium hover:bg-[#1ebe5d] transition"
              >
                <MessageCircle size={14} /> Envoyer sur WhatsApp
              </a>
            ) : (
              <button onClick={() => handleCopyTemplate(remerciementTemplate)}
                className="flex items-center gap-1.5 bg-green-600 text-white text-sm px-4 py-2 rounded-xl font-medium">
                {templateCopied === remerciementTemplate.id ? <Check size={14} /> : <Copy size={14} />}
                {templateCopied === remerciementTemplate.id ? 'Copié !' : 'Copier'}
              </button>
            )}
            <button onClick={() => setShowRemerciement(false)} className="text-sm text-muted px-3 py-2">Fermer</button>
          </div>
        </div>
      )}

      {/* Statut */}
      <section className="bg-surface rounded-2xl border border-border p-4">
        <h2 className="font-semibold text-stone-800 text-sm mb-3">Statut</h2>
        <div className="flex flex-wrap gap-2">
          {STATUTS.map(s => (
            <button
              key={s}
              onClick={() => setStatut(s)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-medium border transition',
                statut === s
                  ? `${STATUT_COLORS[s]} border-transparent`
                  : 'bg-beige-50 text-muted border-border hover:border-primary/30'
              )}
            >
              {s}
            </button>
          ))}
        </div>
        {statut !== devis.statut && (
          <p className="text-xs text-primary mt-2">* Enregistre pour sauvegarder le changement</p>
        )}
      </section>

      {/* Titre */}
      <section className="bg-surface rounded-2xl border border-border p-4">
        <label className="block font-semibold text-stone-800 text-sm mb-2">Titre de l'offre</label>
        <input
          value={titre}
          onChange={e => setTitre(e.target.value)}
          className="w-full border border-border rounded-xl px-4 py-2.5 text-sm bg-beige-50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </section>

      {/* Lignes */}
      <section className="bg-surface rounded-2xl border border-border p-4 space-y-3">
        <h2 className="font-semibold text-stone-800 text-sm">{isAdmin ? 'Éléments' : 'Articles'}</h2>
        {lignes.map(ligne => (
          <div key={ligne.id} className="bg-beige-50 border border-border rounded-xl p-3 space-y-2">
            <div className="flex items-start gap-2">
              <input
                value={ligne.libelle}
                onChange={e => updateLigne(ligne.id, 'libelle', e.target.value)}
                className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button onClick={() => removeLigne(ligne.id)} className="text-muted hover:text-red-500 p-1 shrink-0 mt-0.5">
                <Trash2 size={15} />
              </button>
            </div>
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
        <button
          onClick={() => setLignes(prev => [...prev, { id: newId(), type: 'libre', libelle: '', prix: 0, quantite: 1 }])}
          className="text-sm text-primary font-medium"
        >
          {isAdmin ? '+ Ajouter un élément' : '+ Ajouter un article'}
        </button>
      </section>

      {/* Remise */}
      <section className="bg-surface rounded-2xl border border-border p-4 space-y-3">
        <h2 className="font-semibold text-stone-800 text-sm">Remise</h2>
        <div className="flex gap-2">
          <select value={remiseType} onChange={e => setRemiseType(e.target.value as 'fixe' | 'pourcentage' | '')}
            className="border border-border rounded-xl px-3 py-2.5 text-sm bg-beige-50 focus:outline-none">
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

      {/* Total */}
      <div className="bg-primary-light border border-primary/20 rounded-2xl p-4 space-y-1">
        <div className="flex justify-between text-sm font-semibold text-stone-800">
          <span>Total</span><span>{formatPrice(total)}</span>
        </div>
        {modeReglement === 'acompte' && (
          <div className="flex justify-between text-sm text-primary font-medium">
            <span>Acompte ({settings.acompte_pourcentage}%)</span><span>{formatPrice(acompte)}</span>
          </div>
        )}
      </div>

      {/* Historique statuts */}
      {devis.devis_statut_history && devis.devis_statut_history.length > 0 && (
        <section className="bg-surface rounded-2xl border border-border p-4">
          <h2 className="font-semibold text-stone-800 text-sm mb-3">Historique des statuts</h2>
          <div className="space-y-2">
            {[...devis.devis_statut_history].sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()).map(h => (
              <div key={h.id} className="flex items-center justify-between text-sm">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUT_COLORS[h.statut]}`}>{h.statut}</span>
                <span className="text-xs text-muted">{formatDate(h.changed_at)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Templates */}
      <section className="bg-surface rounded-2xl border border-border p-4">
        <h2 className="font-semibold text-stone-800 text-sm mb-3">Messages rapides</h2>
        <div className="space-y-2">
          {templates.filter(t => t.type !== 'remerciement').map(t => {
            const msg = applyTemplateVars(t.contenu, client, { ...devis, total_ht: calcTotal(lignes, remiseType || null, remiseValeur ? parseFloat(remiseValeur) : null).total }, settings.acompte_pourcentage)
            const label = t.type === 'paiement' ? '💳 Lien de paiement' : '🔔 Relance'
            return client.whatsapp ? (
              <a
                key={t.id}
                href={`https://wa.me/${client.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between px-3 py-2.5 border border-border rounded-xl hover:border-[#25D366]/40 text-sm transition"
              >
                <span className="text-stone-700">{label}</span>
                <MessageCircle size={16} className="text-[#25D366]" />
              </a>
            ) : (
              <button key={t.id} onClick={() => handleCopyTemplate(t)}
                className="w-full flex items-center justify-between px-3 py-2.5 border border-border rounded-xl hover:border-primary/30 text-sm transition">
                <span className="text-stone-700">{label}</span>
                {templateCopied === t.id ? <Check size={16} className="text-green-500" /> : <Copy size={16} className="text-muted" />}
              </button>
            )
          })}
        </div>
      </section>

      {/* Facture PDF */}
      {['Soldé', 'Acompte reçu'].includes(statut) && (
        <a
          href={`/facture/${id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm transition"
        >
          <Download size={18} /> Télécharger la facture PDF
        </a>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={handleSave} disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-2xl font-semibold text-sm hover:bg-primary-dark transition disabled:opacity-60">
          <Save size={18} />{saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        <button onClick={handleCopyDevis}
          className="flex items-center justify-center gap-2 bg-surface border border-border py-3 px-4 rounded-2xl text-sm font-medium text-stone-700 hover:border-primary/30 transition">
          {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
        </button>
      </div>

      {/* Delete */}
      {devis.statut === 'Annulé' && (
        <div className="border-t border-border pt-4">
          {!showDeleteConfirm ? (
            <button onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 text-red-500 text-sm font-medium">
              <Trash2 size={16} /> {isAdmin ? 'Supprimer ce devis' : 'Supprimer cette commande'}
            </button>
          ) : (
            <div className="bg-red-50 rounded-2xl p-4 border border-red-200">
              <p className="text-sm text-red-700 font-medium mb-3">Confirmer la suppression ?</p>
              <div className="flex gap-2">
                <button onClick={handleDelete} className="bg-red-500 text-white text-sm px-4 py-2 rounded-xl font-medium">Supprimer</button>
                <button onClick={() => setShowDeleteConfirm(false)} className="text-sm text-muted px-3 py-2">Annuler</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
