'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatDate, formatPrice, STATUT_COLORS, STATUTS } from '@/lib/utils'
import type { Devis, Client } from '@/lib/types'
import { Search, FolderOpen, ChevronRight } from 'lucide-react'

interface DevisWithClient extends Devis { clients: Client }
interface ClientGroup {
  client: Client
  devis: DevisWithClient[]
  totalEncaisse: number
  montantAttente: number
  hasMultiple: boolean
}

export default function HistoriquePage() {
  const [allDevis, setAllDevis] = useState<DevisWithClient[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [view, setView] = useState<'liste' | 'dossiers'>('liste')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('devis')
        .select('*, clients(*)')
        .order('created_at', { ascending: false })
      if (data) setAllDevis(data as DevisWithClient[])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = allDevis.filter(d => {
    const name = `${d.clients.prenom} ${d.clients.nom}`.toLowerCase()
    const matchSearch = !search || name.includes(search.toLowerCase()) || d.titre.toLowerCase().includes(search.toLowerCase())
    const matchStatut = !filterStatut || d.statut === filterStatut
    return matchSearch && matchStatut
  })

  // Group by client
  const clientGroups: ClientGroup[] = Object.values(
    allDevis.reduce((acc, d) => {
      const cid = d.client_id
      if (!acc[cid]) acc[cid] = { client: d.clients, devis: [], totalEncaisse: 0, montantAttente: 0, hasMultiple: false }
      acc[cid].devis.push(d)
      if (d.statut === 'Soldé') acc[cid].totalEncaisse += d.total_ht
      if (['Envoyé', 'Validé', 'Acompte reçu'].includes(d.statut)) acc[cid].montantAttente += d.total_ht
      acc[cid].hasMultiple = acc[cid].devis.length >= 2
      return acc
    }, {} as Record<string, ClientGroup>)
  ).sort((a, b) => b.devis.length - a.devis.length)

  if (loading) return <div className="text-muted text-sm pt-8 text-center">Chargement…</div>

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-stone-800">Historique</h1>
        <p className="text-xs text-muted mt-0.5">{allDevis.length} devis au total</p>
      </div>

      {/* View toggle */}
      <div className="flex bg-beige-100 rounded-xl p-1 gap-1">
        {(['liste', 'dossiers'] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${view === v ? 'bg-surface text-stone-800 shadow-sm' : 'text-muted'}`}>
            {v === 'liste' ? 'Liste' : 'Dossiers clients'}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="w-full pl-9 pr-4 py-2.5 border border-border rounded-xl text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>
        {view === 'liste' && (
          <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
            className="border border-border rounded-xl px-3 py-2.5 text-sm bg-surface focus:outline-none">
            <option value="">Tous</option>
            {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>

      {/* Liste view */}
      {view === 'liste' && (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted text-sm">Aucun devis trouvé</div>
          )}
          {filtered.map(d => (
            <Link key={d.id} href={`/devis/${d.id}`}
              className="flex items-center justify-between bg-surface rounded-2xl px-4 py-3 border border-border hover:border-primary/30 transition">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted font-mono">#{String(d.numero).padStart(3, '0')}</span>
                  <p className="text-sm font-semibold text-stone-800 truncate">{d.clients.prenom} {d.clients.nom}</p>
                </div>
                <p className="text-xs text-muted mt-0.5 truncate">{d.titre} • {formatDate(d.created_at)}</p>
              </div>
              <div className="flex flex-col items-end gap-1 ml-3 shrink-0">
                <span className="text-sm font-semibold text-stone-800">{formatPrice(d.total_ht)}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_COLORS[d.statut]}`}>{d.statut}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Dossiers view */}
      {view === 'dossiers' && (
        <div className="space-y-3">
          {clientGroups.filter(g => !search || `${g.client.prenom} ${g.client.nom}`.toLowerCase().includes(search.toLowerCase())).map(g => (
            <div key={g.client.id}>
              {g.hasMultiple ? (
                <Link href={`/historique/client/${g.client.id}`}
                  className="block bg-surface rounded-2xl border border-border hover:border-primary/30 transition overflow-hidden">
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-light rounded-xl flex items-center justify-center">
                        <FolderOpen size={18} className="text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-stone-800 text-sm">{g.client.prenom} {g.client.nom}</p>
                        <p className="text-xs text-muted">{g.devis.length} devis</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        {g.totalEncaisse > 0 && <p className="text-xs text-green-600 font-medium">{formatPrice(g.totalEncaisse)} encaissé</p>}
                        {g.montantAttente > 0 && <p className="text-xs text-amber-600">{formatPrice(g.montantAttente)} en attente</p>}
                      </div>
                      <ChevronRight size={16} className="text-muted" />
                    </div>
                  </div>
                </Link>
              ) : (
                g.devis.map(d => (
                  <Link key={d.id} href={`/devis/${d.id}`}
                    className="flex items-center justify-between bg-surface rounded-2xl px-4 py-3 border border-border hover:border-primary/30 transition">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-stone-800">{d.clients.prenom} {d.clients.nom}</p>
                      <p className="text-xs text-muted mt-0.5 truncate">{d.titre} • {formatDate(d.created_at)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 ml-3 shrink-0">
                      <span className="text-sm font-semibold text-stone-800">{formatPrice(d.total_ht)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_COLORS[d.statut]}`}>{d.statut}</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          ))}
          {clientGroups.length === 0 && (
            <div className="text-center py-12 text-muted text-sm">Aucun client trouvé</div>
          )}
        </div>
      )}
    </div>
  )
}
