'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X, FolderOpen, Users2, CheckSquare, Lightbulb, Network } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface SearchResult {
  id: string
  label: string
  sub?: string
  type: 'projet' | 'prospect' | 'tache' | 'idee' | 'reseau'
  href: string
}

const TYPE_CFG = {
  projet:   { Icon: FolderOpen,  label: 'Projets',    color: 'text-blue-500',   bg: 'bg-blue-50' },
  prospect: { Icon: Users2,      label: 'Prospects',  color: 'text-orange-500', bg: 'bg-orange-50' },
  tache:    { Icon: CheckSquare, label: 'T&acirc;ches',     color: 'text-green-500',  bg: 'bg-green-50' },
  idee:     { Icon: Lightbulb,   label: 'Id&eacute;es',      color: 'text-amber-500',  bg: 'bg-amber-50' },
  reseau:   { Icon: Network,     label: 'R&eacute;seau',     color: 'text-violet-500', bg: 'bg-violet-50' },
}

const ORDER: SearchResult['type'][] = ['projet', 'prospect', 'tache', 'idee', 'reseau']

export default function SearchModal({ onClose }: { onClose: () => void }) {
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState<SearchResult[]>([])
  const [loading,  setLoading]  = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router   = useRouter()

  // Focus input on open
  useEffect(() => { inputRef.current?.focus() }, [])

  // Keyboard navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape')    { onClose(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
      if (e.key === 'Enter' && results[selected]) navigate(results[selected])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [results, selected])

  // Debounced search
  useEffect(() => {
    setSelected(0)
    if (query.trim().length < 2) { setResults([]); return }
    const timer = setTimeout(() => doSearch(query.trim()), 280)
    return () => clearTimeout(timer)
  }, [query])

  async function doSearch(q: string) {
    setLoading(true)
    const like = `%${q}%`

    const [
      { data: projets },
      { data: prospects },
      { data: taches },
      { data: idees },
      { data: reseau },
    ] = await Promise.all([
      supabase.from('projets').select('id, nom, type').ilike('nom', like).limit(4),
      supabase.from('prospects').select('id, prenom, nom, entreprise, statut')
        .or(`prenom.ilike.${like},nom.ilike.${like},entreprise.ilike.${like}`).limit(4),
      supabase.from('taches').select('id, texte, priorite').ilike('texte', like).eq('faite', false).limit(4),
      supabase.from('idees').select('id, texte, statut').ilike('texte', like).limit(4),
      supabase.from('contacts_reseau').select('id, prenom, nom, entreprise')
        .or(`prenom.ilike.${like},nom.ilike.${like},entreprise.ilike.${like}`).limit(4),
    ])

    const mapped: SearchResult[] = [
      ...(projets   ?? []).map(p => ({ id: p.id, label: p.nom,            sub: p.type,       type: 'projet'   as const, href: `/projets/${p.id}` })),
      ...(prospects ?? []).map(p => ({ id: p.id, label: [p.prenom, p.nom].filter(Boolean).join(' '), sub: p.entreprise ?? p.statut, type: 'prospect' as const, href: '/prospects' })),
      ...(taches    ?? []).map(t => ({ id: t.id, label: t.texte,           sub: t.priorite,  type: 'tache'    as const, href: '/' })),
      ...(idees     ?? []).map(i => ({ id: i.id, label: i.texte,           sub: i.statut,    type: 'idee'     as const, href: '/idees' })),
      ...(reseau    ?? []).map(c => ({ id: c.id, label: [c.prenom, c.nom].filter(Boolean).join(' '), sub: c.entreprise ?? undefined, type: 'reseau' as const, href: '/reseau' })),
    ]

    setResults(mapped)
    setLoading(false)
  }

  function navigate(r: SearchResult) {
    router.push(r.href)
    onClose()
  }

  const grouped = ORDER
    .map(type => ({ type, items: results.filter(r => r.type === type) }))
    .filter(g => g.items.length > 0)

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[60] flex items-start justify-center pt-16 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Barre de recherche */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
          <Search size={17} className="text-muted shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher un projet, prospect, t&acirc;che..."
            className="flex-1 text-sm text-stone-800 placeholder:text-stone-300 outline-none bg-transparent"
          />
          {query ? (
            <button onClick={() => setQuery('')} className="text-muted hover:text-stone-600 transition">
              <X size={15} />
            </button>
          ) : (
            <span className="text-[10px] text-stone-300 border border-stone-200 rounded px-1.5 py-0.5">ESC</span>
          )}
        </div>

        {/* R&eacute;sultats */}
        <div className="max-h-[60vh] overflow-y-auto">

          {loading && (
            <div className="px-4 py-8 text-center text-sm text-muted animate-pulse">Recherche&hellip;</div>
          )}

          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-muted">Aucun r&eacute;sultat pour &laquo;&nbsp;{query}&nbsp;&raquo;</p>
            </div>
          )}

          {!loading && grouped.map(group => {
            const cfg = TYPE_CFG[group.type]
            return (
              <div key={group.type}>
                <div className="px-4 py-2 flex items-center gap-2 bg-stone-50 border-b border-stone-100">
                  <cfg.Icon size={11} className={cfg.color} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">{cfg.label}</span>
                </div>
                {group.items.map(r => {
                  const globalIdx = results.indexOf(r)
                  return (
                    <button
                      key={r.id}
                      onClick={() => navigate(r)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-stone-50 transition ${
                        globalIdx === selected ? 'bg-primary-light' : 'hover:bg-beige-50'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                        <cfg.Icon size={13} className={cfg.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-stone-800 truncate">{r.label}</p>
                        {r.sub && <p className="text-xs text-muted truncate capitalize">{r.sub}</p>}
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          })}

          {!query && (
            <div className="px-4 py-10 text-center">
              <Search size={24} className="text-stone-200 mx-auto mb-3" />
              <p className="text-sm text-muted">Tape pour chercher</p>
              <p className="text-xs text-stone-300 mt-1">Projets &middot; Prospects &middot; T&acirc;ches &middot; Id&eacute;es &middot; R&eacute;seau</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
