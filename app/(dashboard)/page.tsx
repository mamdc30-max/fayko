'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatDate, formatPrice, STATUT_COLORS } from '@/lib/utils'
import { Bell, PlusCircle, Clock, TrendingUp } from 'lucide-react'
import type { Devis, Client } from '@/lib/types'

interface DevisWithClient extends Devis { clients: Client }

export default function HomePage() {
  const [relances, setRelances] = useState<DevisWithClient[]>([])
  const [recent, setRecent] = useState<DevisWithClient[]>([])
  const [stats, setStats] = useState({ total: 0, enCours: 0, solde: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const [{ data: allDevis }, { data: relancesData }] = await Promise.all([
        supabase.from('devis').select('*, clients(*)').order('created_at', { ascending: false }),
        supabase
          .from('devis')
          .select('*, clients(*), relances(effectuee)')
          .eq('statut', 'Envoyé')
          .lt('created_at', sevenDaysAgo.toISOString()),
      ])

      if (allDevis) {
        const d = allDevis as DevisWithClient[]
        setRecent(d.slice(0, 5))
        setStats({
          total: d.length,
          enCours: d.filter(x => !['Soldé', 'Annulé'].includes(x.statut)).length,
          solde: d.filter(x => x.statut === 'Soldé').length,
        })
      }

      if (relancesData) {
        const pending = (relancesData as (DevisWithClient & { relances: { effectuee: boolean }[] })[])
          .filter(d => !d.relances?.length || d.relances.every(r => !r.effectuee))
        setRelances(pending)
      }

      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="text-muted text-sm pt-8 text-center">Chargement…</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Bonjour 👋</h1>
        <p className="text-muted text-sm mt-0.5">Voici ce qui se passe chez Fayko</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total devis', value: stats.total, icon: TrendingUp },
          { label: 'En cours', value: stats.enCours, icon: Clock },
          { label: 'Soldés', value: stats.solde, icon: PlusCircle },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-surface rounded-2xl p-4 border border-border">
            <p className="text-xs text-muted mb-1">{label}</p>
            <p className="text-2xl font-bold text-stone-800">{value}</p>
          </div>
        ))}
      </div>

      {/* Relances */}
      {relances.length > 0 && (
        <div className="bg-primary-light border border-primary/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={18} className="text-primary" />
            <h2 className="font-semibold text-primary text-sm">
              {relances.length} relance{relances.length > 1 ? 's' : ''} en attente
            </h2>
          </div>
          <div className="space-y-2">
            {relances.map(d => (
              <Link
                key={d.id}
                href="/relances"
                className="flex items-center justify-between bg-surface rounded-xl px-3 py-2.5 border border-border"
              >
                <div>
                  <p className="text-sm font-medium text-stone-800">{d.clients.prenom} {d.clients.nom}</p>
                  <p className="text-xs text-muted">{d.titre} • {formatDate(d.created_at)}</p>
                </div>
                <span className="text-sm font-semibold text-primary">{formatPrice(d.total_ht)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Actions rapides */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/chatbot"
          className="bg-surface border border-border rounded-2xl p-4 flex flex-col gap-2 hover:border-primary/30 transition"
        >
          <span className="text-2xl">💬</span>
          <p className="font-semibold text-sm text-stone-800">Qualifier un projet</p>
          <p className="text-xs text-muted">Chatbot de qualification</p>
        </Link>
        <Link
          href="/devis"
          className="bg-primary rounded-2xl p-4 flex flex-col gap-2 hover:bg-primary-dark transition"
        >
          <span className="text-2xl">✨</span>
          <p className="font-semibold text-sm text-white">Créer un devis</p>
          <p className="text-xs text-white/70">Prêt à copier sur WhatsApp</p>
        </Link>
      </div>

      {/* Devis récents */}
      {recent.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-stone-800">Devis récents</h2>
            <Link href="/historique" className="text-xs text-primary font-medium">Voir tout</Link>
          </div>
          <div className="space-y-2">
            {recent.map(d => (
              <Link
                key={d.id}
                href={`/devis/${d.id}`}
                className="flex items-center justify-between bg-surface rounded-xl px-4 py-3 border border-border hover:border-primary/30 transition"
              >
                <div>
                  <p className="text-sm font-medium text-stone-800">
                    #{String(d.numero).padStart(3, '0')} — {d.clients.prenom} {d.clients.nom}
                  </p>
                  <p className="text-xs text-muted">{d.titre} • {formatDate(d.created_at)}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm font-semibold text-stone-800">{formatPrice(d.total_ht)}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_COLORS[d.statut]}`}>
                    {d.statut}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
