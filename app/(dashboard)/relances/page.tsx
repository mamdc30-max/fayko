'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatDate, formatPrice, copyToClipboard, applyTemplateVars } from '@/lib/utils'
import type { Devis, Client, Template, Settings } from '@/lib/types'
import { Check, Copy, MessageCircle } from 'lucide-react'

interface DevisAvecClient extends Devis { clients: Client }

export default function RelancesPage() {
  const [relances, setRelances] = useState<DevisAvecClient[]>([])
  const [effectuees, setEffectuees] = useState<DevisAvecClient[]>([])
  const [template, setTemplate] = useState<Template | null>(null)
  const [settings, setSettings] = useState<Settings>({ id: 1, acompte_pourcentage: 50 })
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const [done, setDone] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function load() {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const [{ data: d }, { data: t }, { data: s }] = await Promise.all([
        supabase.from('devis').select('*, clients(*), relances(*)').eq('statut', 'Envoyé').lt('created_at', sevenDaysAgo.toISOString()).order('created_at'),
        supabase.from('templates').select('*').eq('type', 'relance').single(),
        supabase.from('settings').select('*').single(),
      ])
      if (d) {
        const pending: DevisAvecClient[] = []
        const effectueesList: DevisAvecClient[] = []
        ;(d as (DevisAvecClient & { relances: { effectuee: boolean }[] })[]).forEach(item => {
          const hasEffectuee = item.relances?.some(r => r.effectuee)
          if (hasEffectuee) effectueesList.push(item)
          else pending.push(item)
        })
        setRelances(pending)
        setEffectuees(effectueesList)
      }
      if (t) setTemplate(t)
      if (s) setSettings(s)
      setLoading(false)
    }
    load()
  }, [])

  async function handleCopy(devis: DevisAvecClient) {
    if (!template) return
    const text = applyTemplateVars(template.contenu, devis.clients, devis, settings.acompte_pourcentage)
    await copyToClipboard(text)
    setCopied(devis.id)
    setTimeout(() => setCopied(null), 2000)
  }

  async function handleMarkDone(devis: DevisAvecClient) {
    const { data: existing } = await supabase.from('relances').select('id').eq('devis_id', devis.id).eq('effectuee', false).limit(1).single()
    if (existing) {
      await supabase.from('relances').update({ effectuee: true, effectuee_at: new Date().toISOString() }).eq('id', existing.id)
    } else {
      await supabase.from('relances').insert({ devis_id: devis.id, effectuee: true, effectuee_at: new Date().toISOString() })
    }
    setDone(prev => ({ ...prev, [devis.id]: true }))
    setRelances(prev => prev.filter(d => d.id !== devis.id))
    setEffectuees(prev => [...prev, devis])
  }

  if (loading) return <div className="text-muted text-sm pt-8 text-center">Chargement…</div>

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-stone-800">Relances</h1>
        <p className="text-xs text-muted mt-0.5">Commandes sans réponse depuis plus de 7 jours</p>
      </div>

      {/* Explication du fonctionnement J+7 */}
      <div className="bg-primary-light border border-primary/20 rounded-xl px-4 py-3 text-xs text-primary leading-relaxed">
        🔔 Une commande apparaît ici automatiquement <strong>7 jours après son envoi</strong>, si elle est toujours en statut "Envoyé" sans réponse.
      </div>

      {relances.length === 0 && effectuees.length === 0 && (
        <div className="bg-surface rounded-2xl border border-border p-8 text-center">
          <p className="text-4xl mb-3">✅</p>
          <p className="font-semibold text-stone-800">Aucune relance en attente</p>
          <p className="text-sm text-muted mt-1">Tous tes devis sont à jour.</p>
        </div>
      )}

      {/* Relances en attente */}
      {relances.length > 0 && (
        <div className="space-y-3">
          {relances.map(d => (
            <div key={d.id} className="bg-primary-light border border-primary/20 rounded-2xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-stone-800 text-sm">{d.clients.prenom} {d.clients.nom}</p>
                  <p className="text-xs text-muted mt-0.5">{d.titre} • Envoyé le {formatDate(d.created_at)}</p>
                  <p className="text-sm font-medium text-primary mt-1">{formatPrice(d.total_ht)}</p>
                </div>
                {d.clients.whatsapp && (
                  <a
                    href={`https://wa.me/${d.clients.whatsapp.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-green-500 text-white p-2 rounded-xl hover:bg-green-600 transition shrink-0"
                  >
                    <MessageCircle size={16} />
                  </a>
                )}
              </div>

              {template && (
                <div className="bg-surface rounded-xl p-3 border border-border">
                  <p className="text-xs text-muted mb-2">Message de relance :</p>
                  <pre className="text-xs text-stone-700 whitespace-pre-wrap font-sans leading-relaxed">
                    {applyTemplateVars(template.contenu, d.clients, d, settings.acompte_pourcentage)}
                  </pre>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => handleCopy(d)}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-white text-sm py-2.5 rounded-xl font-medium hover:bg-primary-dark transition">
                  {copied === d.id ? <Check size={16} /> : <Copy size={16} />}
                  {copied === d.id ? 'Copié !' : 'Copier le message'}
                </button>
                <button onClick={() => handleMarkDone(d)}
                  className="flex items-center justify-center gap-1.5 bg-surface border border-border text-stone-700 text-sm py-2.5 px-4 rounded-xl font-medium hover:border-green-300 hover:text-green-600 transition">
                  <Check size={16} />
                  Effectuée
                </button>
              </div>

              <Link href={`/devis/${d.id}`} className="text-xs text-primary font-medium">
                Voir le devis →
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Relances effectuées */}
      {effectuees.length > 0 && (
        <div>
          <h2 className="font-semibold text-stone-700 text-sm mb-3 flex items-center gap-2">
            <Check size={14} className="text-green-500" /> Relances effectuées ({effectuees.length})
          </h2>
          <div className="space-y-2">
            {effectuees.map(d => (
              <Link key={d.id} href={`/devis/${d.id}`}
                className="flex items-center justify-between bg-surface rounded-2xl px-4 py-3 border border-border opacity-60">
                <div>
                  <p className="text-sm font-medium text-stone-700">{d.clients.prenom} {d.clients.nom}</p>
                  <p className="text-xs text-muted">{d.titre}</p>
                </div>
                <span className="text-sm text-muted">{formatPrice(d.total_ht)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
