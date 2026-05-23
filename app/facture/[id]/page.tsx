'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatPrice, formatDate, calcTotal } from '@/lib/utils'
import type { Devis, Client, DevisLigne } from '@/lib/types'

export default function FacturePage() {
  const { id } = useParams<{ id: string }>()
  const [devis, setDevis] = useState<Devis | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [lignes, setLignes] = useState<DevisLigne[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('devis')
        .select('*, clients(*), devis_lignes(*)')
        .eq('id', id)
        .single()
      if (data) {
        setDevis(data)
        setClient(data.clients)
        setLignes((data.devis_lignes || []).sort((a: DevisLigne, b: DevisLigne) => a.ordre - b.ordre))
      }
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 text-sm">Chargement…</p>
      </div>
    )
  }

  if (!devis || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 text-sm">Facture introuvable</p>
      </div>
    )
  }

  const { sousTotal, remise, total } = calcTotal(
    lignes.map(l => ({ id: l.id, type: l.type, libelle: l.libelle, prix: l.prix })),
    devis.remise_type,
    devis.remise_valeur
  )
  const acompte = total * devis.acompte_pourcentage / 100
  const numero = String(devis.numero).padStart(3, '0')
  const isPaid = ['Soldé', 'Acompte reçu'].includes(devis.statut)

  return (
    <>
      {/* Print button - hidden when printing */}
      <div className="print:hidden fixed top-4 right-4 flex gap-2 z-10">
        <button
          onClick={() => window.print()}
          className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow transition"
        >
          Télécharger PDF
        </button>
        <button
          onClick={() => window.close()}
          className="bg-white border border-gray-200 text-gray-600 text-sm px-4 py-2.5 rounded-xl shadow hover:bg-gray-50 transition"
        >
          Fermer
        </button>
      </div>

      {/* Invoice */}
      <div className="min-h-screen bg-white p-8 md:p-16 print:p-8 max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-start mb-12">
          <div>
            <h1 className="text-3xl font-bold text-orange-500">Fayko</h1>
            <p className="text-xs text-gray-400 mt-1">Communication pour entrepreneurs</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-800">FACTURE</p>
            <p className="text-sm text-gray-500 mt-1">N° {numero}</p>
            <p className="text-sm text-gray-500">Date : {formatDate(devis.created_at)}</p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t-2 border-orange-100 mb-8" />

        {/* Client info */}
        <div className="mb-10">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Facturé à</p>
          <p className="text-lg font-bold text-gray-800">{client.prenom} {client.nom}</p>
          {client.marque && <p className="text-sm text-orange-500 font-medium">{client.marque}</p>}
          {client.whatsapp && <p className="text-sm text-gray-500">{client.whatsapp}</p>}
        </div>

        {/* Object */}
        <div className="mb-8">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Objet</p>
          <p className="text-sm font-medium text-gray-700">{devis.titre}</p>
        </div>

        {/* Lines table */}
        <div className="mb-8">
          <div className="bg-gray-50 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_auto] px-5 py-3 border-b border-gray-200">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Prestation</span>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Montant</span>
            </div>
            {lignes.map((ligne, i) => (
              <div key={ligne.id} className={`grid grid-cols-[1fr_auto] px-5 py-3.5 ${i < lignes.length - 1 ? 'border-b border-gray-100' : ''}`}>
                <div>
                  <p className="text-sm font-medium text-gray-800">{ligne.libelle}</p>
                  {(ligne as DevisLigne & { description?: string | null }).description && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {(ligne as DevisLigne & { description?: string | null }).description}
                    </p>
                  )}
                </div>
                <p className="text-sm font-semibold text-gray-800 text-right">{formatPrice(ligne.prix)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="ml-auto max-w-xs space-y-2 mb-10">
          {remise > 0 && (
            <>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Sous-total</span>
                <span>{formatPrice(sousTotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-green-600">
                <span>Remise</span>
                <span>- {formatPrice(remise)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between text-base font-bold text-gray-800 pt-2 border-t border-gray-200">
            <span>Total TTC</span>
            <span>{formatPrice(total)}</span>
          </div>
          {devis.mode_reglement === 'acompte' && (
            <div className="flex justify-between text-sm text-orange-500 font-medium">
              <span>Acompte ({devis.acompte_pourcentage}%)</span>
              <span>{formatPrice(acompte)}</span>
            </div>
          )}
        </div>

        {/* Payment status */}
        {isPaid && (
          <div className="border-2 border-green-200 bg-green-50 rounded-2xl px-6 py-4 mb-10 flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="text-sm font-bold text-green-700">
                {devis.statut === 'Soldé' ? 'Paiement intégral reçu' : 'Acompte reçu'}
              </p>
              <p className="text-xs text-green-600">
                {devis.statut === 'Soldé'
                  ? `${formatPrice(total)} encaissé`
                  : `${formatPrice(acompte)} encaissé — solde restant : ${formatPrice(total - acompte)}`
                }
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-gray-100 pt-6 text-center">
          <p className="text-xs text-gray-400">Merci pour votre confiance 🙏</p>
          <p className="text-xs text-gray-300 mt-1">Document généré par Fayko</p>
        </div>
      </div>
    </>
  )
}
