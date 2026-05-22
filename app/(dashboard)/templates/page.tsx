'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Template } from '@/lib/types'
import { Save, Check, Info } from 'lucide-react'

const TEMPLATE_LABELS: Record<string, { label: string; description: string; vars: string[] }> = {
  paiement: {
    label: '💳 Lien de paiement',
    description: 'Envoyé après validation du devis, avec le lien Revolut.',
    vars: ['[Prénom]', '[Montant]', '[Acompte]'],
  },
  relance: {
    label: '🔔 Relance J+7',
    description: 'Message de rappel doux envoyé si pas de réponse après 7 jours.',
    vars: ['[Prénom]'],
  },
  remerciement: {
    label: '🎉 Remerciement paiement',
    description: 'Affiché automatiquement quand tu passes un devis en statut Soldé.',
    vars: ['[Prénom]', '[Montant]'],
  },
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [editing, setEditing] = useState<Record<number, string>>({})
  const [saved, setSaved] = useState<Record<number, boolean>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('templates').select('*').order('id')
      if (data) {
        setTemplates(data)
        const initial: Record<number, string> = {}
        data.forEach(t => { initial[t.id] = t.contenu })
        setEditing(initial)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave(template: Template) {
    await supabase.from('templates').update({ contenu: editing[template.id] }).eq('id', template.id)
    setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, contenu: editing[template.id] } : t))
    setSaved(prev => ({ ...prev, [template.id]: true }))
    setTimeout(() => setSaved(prev => ({ ...prev, [template.id]: false })), 2000)
  }

  if (loading) return <div className="text-muted text-sm pt-8 text-center">Chargement…</div>

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-stone-800">Templates de messages</h1>
        <p className="text-xs text-muted mt-0.5">Modifie tes messages, les variables sont remplacées automatiquement</p>
      </div>

      <div className="bg-primary-light border border-primary/20 rounded-2xl p-4">
        <div className="flex gap-2">
          <Info size={16} className="text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-stone-700 leading-relaxed">
            Les variables entre crochets (<strong>[Prénom]</strong>, <strong>[Montant]</strong>, <strong>[Acompte]</strong>) sont remplacées automatiquement par les vraies valeurs au moment de l'utilisation.
          </p>
        </div>
      </div>

      {templates.map(t => {
        const meta = TEMPLATE_LABELS[t.type]
        const hasChanged = editing[t.id] !== t.contenu
        return (
          <div key={t.id} className="bg-surface rounded-2xl border border-border p-4 space-y-3">
            <div>
              <h2 className="font-semibold text-stone-800 text-sm">{meta?.label ?? t.type}</h2>
              <p className="text-xs text-muted mt-0.5">{meta?.description}</p>
            </div>

            {/* Variables disponibles */}
            <div className="flex flex-wrap gap-1.5">
              {meta?.vars.map(v => (
                <span key={v} className="bg-beige-100 text-primary text-xs px-2 py-0.5 rounded-full font-mono border border-primary/20">
                  {v}
                </span>
              ))}
            </div>

            <textarea
              value={editing[t.id] ?? ''}
              onChange={e => setEditing(prev => ({ ...prev, [t.id]: e.target.value }))}
              rows={6}
              className="w-full border border-border rounded-xl px-4 py-3 text-sm bg-beige-50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none font-sans leading-relaxed"
            />

            <button
              onClick={() => handleSave(t)}
              disabled={!hasChanged && !saved[t.id]}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition ${
                saved[t.id]
                  ? 'bg-green-100 text-green-700'
                  : hasChanged
                  ? 'bg-primary text-white hover:bg-primary-dark'
                  : 'bg-beige-100 text-muted cursor-not-allowed'
              }`}
            >
              {saved[t.id] ? <Check size={16} /> : <Save size={16} />}
              {saved[t.id] ? 'Enregistré !' : hasChanged ? 'Enregistrer' : 'Aucune modification'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
