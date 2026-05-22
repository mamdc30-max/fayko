'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatDate, formatPrice, STATUT_COLORS } from '@/lib/utils'
import type { Devis, Client } from '@/lib/types'
import { ChevronLeft, MessageCircle } from 'lucide-react'

export default function DossierClientPage() {
  const { id } = useParams<{ id: string }>()
  const [client, setClient] = useState<Client | null>(null)
  const [devis, setDevis] = useState<Devis[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: c }, { data: d }] = await Promise.all([
        supabase.from('clients').select('*').eq('id', id).single(),
        supabase.from('devis').select('*').eq('client_id', id).order('created_at', { ascending: false }),
      ])
      if (c) setClient(c)
      if (d) setDevis(d)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div className="text-muted text-sm pt-8 text-center">Chargement…</div>
  if (!client) return <div className="text-muted text-sm pt-8 text-center">Client introuvable</div>

  const totalEncaisse = devis.filter(d => d.statut === 'Soldé').reduce((s, d) => s + d.total_ht, 0)
  const montantAttente = devis.filter(d => ['Envoyé', 'Validé', 'Acompte reçu'].includes(d.statut)).reduce((s, d) => s + d.total_ht, 0)

  const statutGlobal = devis.every(d => d.statut === 'Soldé')
    ? 'Tout soldé'
    : devis.some(d => d.statut === 'Acompte reçu')
    ? 'Acompte en cours'
    : devis.some(d => d.statut === 'Validé')
    ? 'Validé'
    : devis.some(d => d.statut === 'Envoyé')
    ? 'En attente'
    : 'Annulé'

  const whatsappUrl = client.whatsapp
    ? `https://wa.me/${client.whatsapp.replace(/[^0-9]/g, '')}`
    : null

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/historique" className="p-2 rounded-xl hover:bg-beige-100 text-muted transition">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-stone-800">{client.prenom} {client.nom}</h1>
          <p className="text-xs text-muted">Dossier client</p>
        </div>
      </div>

      {/* Client info */}
      <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-stone-800">{client.prenom} {client.nom}</p>
            {client.whatsapp && <p className="text-sm text-muted">{client.whatsapp}</p>}
          </div>
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-green-500 text-white text-sm px-4 py-2 rounded-xl font-medium hover:bg-green-600 transition"
            >
              <MessageCircle size={16} /> WhatsApp
            </a>
          )}
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface rounded-2xl border border-border p-3 text-center">
          <p className="text-2xl font-bold text-stone-800">{devis.length}</p>
          <p className="text-xs text-muted mt-0.5">Devis</p>
        </div>
        <div className="bg-green-50 rounded-2xl border border-green-100 p-3 text-center">
          <p className="text-lg font-bold text-green-700">{formatPrice(totalEncaisse)}</p>
          <p className="text-xs text-green-600 mt-0.5">Encaissé</p>
        </div>
        <div className="bg-amber-50 rounded-2xl border border-amber-100 p-3 text-center">
          <p className="text-lg font-bold text-amber-700">{formatPrice(montantAttente)}</p>
          <p className="text-xs text-amber-600 mt-0.5">En attente</p>
        </div>
      </div>

      {/* Statut global */}
      <div className="bg-surface rounded-2xl border border-border px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-muted">Statut global</span>
        <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
          statutGlobal === 'Tout soldé' ? 'bg-green-100 text-green-700' :
          statutGlobal === 'En attente' ? 'bg-blue-100 text-blue-700' :
          'bg-amber-100 text-amber-700'
        }`}>{statutGlobal}</span>
      </div>

      {/* Liste des devis */}
      <div>
        <h2 className="font-semibold text-stone-800 text-sm mb-3">Tous les devis</h2>
        <div className="space-y-2">
          {devis.map(d => (
            <Link key={d.id} href={`/devis/${d.id}`}
              className="flex items-center justify-between bg-surface rounded-2xl px-4 py-3 border border-border hover:border-primary/30 transition">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted font-mono">#{String(d.numero).padStart(3, '0')}</span>
                  <p className="text-sm font-semibold text-stone-800">{d.titre}</p>
                </div>
                <p className="text-xs text-muted mt-0.5">{formatDate(d.created_at)}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-sm font-semibold text-stone-800">{formatPrice(d.total_ht)}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_COLORS[d.statut]}`}>{d.statut}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Nouveau devis pour ce client */}
      <Link href="/devis"
        className="block w-full text-center bg-primary-light border border-primary/20 text-primary font-semibold text-sm py-3 rounded-2xl hover:bg-primary/10 transition">
        + Créer un nouveau devis pour {client.prenom}
      </Link>
    </div>
  )
}
