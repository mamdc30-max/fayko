'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ExternalLink, RefreshCw } from 'lucide-react'

interface Mission {
  id: string
  titre: string
  entreprise: string
  zone: string
  tarif: string
  duree: string
  date_publication: string
  score: number
  priorite: 'Urgente' | 'Veille' | 'Exclue'
  source: string
  url: string
  statut: string
  note_claude: string
  created_at: string
}

type Filtre = 'all' | 'Urgente' | 'Veille'

export default function MissionsPage() {
  const [missions,  setMissions]  = useState<Mission[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState<Filtre>('all')

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('missions_detectees')
      .select('*')
      .not('priorite', 'eq', 'Exclue')
      .order('score', { ascending: false })
      .order('date_publication', { ascending: false })
      .limit(60)
    setMissions(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered  = filter === 'all' ? missions : missions.filter(m => m.priorite === filter)
  const urgentes  = missions.filter(m => m.priorite === 'Urgente').length
  const veilles   = missions.filter(m => m.priorite === 'Veille').length

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Missions détectées</h1>
          <p className="text-sm text-muted mt-0.5">Veille automatique &mdash; chaque matin en semaine</p>
        </div>
        <button
          onClick={load}
          className="p-2 text-muted hover:text-stone-700 transition active:scale-95"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface border border-border rounded-2xl p-3 text-center">
          <div className="text-2xl font-bold text-red-500">{urgentes}</div>
          <div className="text-xs text-muted mt-0.5">Urgentes</div>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-3 text-center">
          <div className="text-2xl font-bold text-primary">{veilles}</div>
          <div className="text-xs text-muted mt-0.5">En veille</div>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-3 text-center">
          <div className="text-2xl font-bold text-ink">{missions.length}</div>
          <div className="text-xs text-muted mt-0.5">Total</div>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-4 border-b border-border/40">
        {(['all', 'Urgente', 'Veille'] as Filtre[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs font-medium pb-2.5 border-b-2 -mb-px transition ${
              filter === f
                ? 'border-primary text-ink'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {f === 'all' ? 'Toutes' : f === 'Urgente' ? '🔥 Urgentes' : '👀 En veille'}
          </button>
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="text-center py-12 text-muted text-sm">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted text-sm">
          <div className="text-4xl mb-3">🔍</div>
          <p className="font-medium text-ink">Aucune mission pour l&apos;instant</p>
          <p className="text-xs mt-1 text-muted">
            La veille tourne chaque matin lun–ven via les alertes email.
          </p>
        </div>
      ) : (
        <div className="bg-surface divide-y divide-border/40">
          {filtered.map(m => <MissionCard key={m.id} mission={m} />)}
        </div>
      )}

    </div>
  )
}

function MissionCard({ mission: m }: { mission: Mission }) {
  return (
    <div className="p-4 space-y-2.5">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              m.priorite === 'Urgente'
                ? 'bg-red-100 text-red-600'
                : 'bg-primary/10 text-primary'
            }`}>
              {m.priorite === 'Urgente' ? '🔥 Urgente' : '👀 Veille'}
            </span>
            <span className="text-[10px] text-muted">{m.source}</span>
          </div>
          <h3 className="font-semibold text-ink text-sm leading-snug">{m.titre}</h3>
          {m.entreprise && (
            <p className="text-xs text-muted mt-0.5">{m.entreprise}</p>
          )}
        </div>
        {/* Score */}
        <div className="shrink-0 text-right">
          <span className={`text-xl font-bold ${
            m.score >= 7 ? 'text-red-500'
            : m.score >= 5 ? 'text-amber-500'
            : 'text-muted'
          }`}>
            {m.score}
          </span>
          <span className="text-xs text-muted">/9</span>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        {m.zone && (
          <span className="text-[10px] bg-beige-50 border border-border px-2 py-0.5 rounded-lg text-muted">
            📍 {m.zone}
          </span>
        )}
        {m.tarif && m.tarif !== 'À négocier' && (
          <span className="text-[10px] bg-beige-50 border border-border px-2 py-0.5 rounded-lg text-muted">
            💰 {m.tarif}
          </span>
        )}
        {m.duree && (
          <span className="text-[10px] bg-beige-50 border border-border px-2 py-0.5 rounded-lg text-muted">
            ⏱ {m.duree}
          </span>
        )}
      </div>

      {/* Note Claude */}
      {m.note_claude && (
        <p className="text-xs text-muted leading-relaxed italic border-l-2 border-primary/20 pl-2.5">
          {m.note_claude}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-0.5">
        <span className="text-[10px] text-stone-300">{m.date_publication}</span>
        {m.url && (
          <a
            href={m.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
          >
            Voir l&apos;offre <ExternalLink size={10} />
          </a>
        )}
      </div>
    </div>
  )
}
