'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Check, AlertCircle, Loader2 } from 'lucide-react'

const today = new Date().toISOString().split('T')[0]

export default function ImportPage() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [log, setLog]       = useState<string[]>([])
  const [errMsg, setErrMsg] = useState<string | null>(null)

  function addLog(msg: string) {
    setLog(prev => [...prev, msg])
  }

  async function runImport() {
    setStatus('running')
    setLog([])
    setErrMsg(null)

    try {

      // ── 1. Projet ISI ──────────────────────────────────────────
      addLog('Creation du projet ISI...')
      const { data: isiData, error: e1 } = await supabase
        .from('projets')
        .insert({
          nom:         'ISI - Infra&Structure Ingenierie',
          type:        'client',
          statut:      'actif',
          client_nom:  'ISI',
          description: 'Structuration de la visibilite + Accompagnement dans la duree. Ingenierie / BTP, Noisy-le-Grand. Contact : Lamine Diaite.',
          date_debut:  '2026-01-20',
        })
        .select()
        .single()
      if (e1) throw new Error('Projet ISI : ' + e1.message)
      addLog('OK - Projet ISI cree')

      // ── 2. Etapes ISI ─────────────────────────────────────────
      const isiEtapes = [
        { nom: 'Offre commerciale + devis',                 ordre: 1 },
        { nom: 'Plaquette commerciale (France + Senegal)',   ordre: 2 },
        { nom: 'Google My Business',                         ordre: 3 },
        { nom: 'Templates visuels + formation LinkedIn ISI', ordre: 4 },
      ]
      for (const et of isiEtapes) {
        const { error: ee } = await supabase.from('etapes').insert({
          projet_id: isiData.id,
          nom:       et.nom,
          ordre:     et.ordre,
          statut:    'en_cours',
        })
        if (ee) throw new Error('Etape ISI : ' + ee.message)
      }
      addLog('OK - 4 etapes ISI creees')

      // ── 3. Projet Seramos ──────────────────────────────────────
      addLog('Creation du projet Seramos...')
      const { error: e2 } = await supabase.from('projets').insert({
        nom:         'Seramos',
        type:        'client',
        statut:      'en_pause',
        client_nom:  'Seramos',
        description: 'Structuration + Pilotage editorial. Phase 1 terminee (sept-nov 2025). En pause depuis mai 2026.',
        date_debut:  '2025-09-15',
      })
      if (e2) throw new Error('Projet Seramos : ' + e2.message)
      addLog('OK - Projet Seramos cree')

      // ── 4. Prospects pipeline ──────────────────────────────────
      addLog('Import des prospects pipeline...')
      const { error: e3 } = await supabase.from('prospects').insert([
        {
          prenom:         'STEGO Ingenierie',
          nom:            '',
          entreprise:     'STEGO Ingenierie',
          statut:         'proposition',
          offre_associee: 'Mission structurante',
          canal_propose:  'prospection directe',
          montant_estime: 5000,
          notes:          'Pilotage et structuration. Proposition a aligner sur nouvelle grille tarifaire (5000-8000 EUR).',
          last_action_at: today,
        },
        {
          prenom:         'DK Ingenierie',
          nom:            '',
          entreprise:     'DK Ingenierie',
          statut:         'proposition',
          offre_associee: 'Mission structurante',
          canal_propose:  'prospection directe',
          montant_estime: 5000,
          notes:          'Structuration. Proposition a aligner sur nouvelle grille tarifaire.',
          last_action_at: today,
        },
        {
          prenom:         'SEGM',
          nom:            '',
          entreprise:     'SEGM',
          statut:         'en_discussion',
          offre_associee: 'Diagnostic strategique',
          canal_propose:  'prospection directe',
          montant_estime: 3500,
          notes:          'Diagnostic strategique en cours. Verifier prochaine action.',
          last_action_at: today,
        },
        {
          prenom:         'MD Structure',
          nom:            '',
          entreprise:     'MD Structure',
          statut:         'en_discussion',
          offre_associee: 'Diagnostic strategique',
          canal_propose:  'prospection directe',
          montant_estime: 3500,
          notes:          '',
          last_action_at: today,
        },
        {
          prenom:         'Axial',
          nom:            'Ingenierie et Conseils',
          entreprise:     'Axial Ingenierie et Conseils',
          statut:         'en_discussion',
          offre_associee: 'Diagnostic strategique',
          canal_propose:  'prospection directe',
          montant_estime: 3500,
          notes:          '',
          last_action_at: today,
        },
        {
          prenom:         'Abibou',
          nom:            '',
          entreprise:     '',
          statut:         'proposition',
          offre_associee: '',
          canal_propose:  'reseau',
          montant_estime: 0,
          notes:          'Prospect pipeline actif. Grille tarifaire a appliquer.',
          last_action_at: today,
        },
      ])
      if (e3) throw new Error('Prospects : ' + e3.message)
      addLog('OK - 6 prospects importes')

      // ── 5. Taches ─────────────────────────────────────────────
      addLog('Import des taches actives...')
      const { error: e4 } = await supabase.from('taches').insert([
        {
          texte:      'Contacter ISI pour planifier le point restitution finale',
          faite:      false,
          date:       today,
          priorite:   'haute',
          source:     'manuel',
          projet_id:  isiData.id,
        },
        {
          texte:      'Demander recommandations actives a ISI + RISCE + 101 Entrepreneures (post-restitution)',
          faite:      false,
          date:       today,
          priorite:   'normale',
          source:     'manuel',
          projet_id:  isiData.id,
        },
        {
          texte:      'Demarrer le sourcing pipeline outbound (15-20 structures cibles a identifier)',
          faite:      false,
          date:       today,
          priorite:   'haute',
          source:     'manuel',
          projet_id:  null,
        },
        {
          texte:      'Auditer les 3 structures POC priorite 1 : ALISEA, Structalis, BET Structuris',
          faite:      false,
          date:       today,
          priorite:   'haute',
          source:     'manuel',
          projet_id:  null,
        },
        {
          texte:      'Creer le portfolio YaatalCo (prerequis inscription Entrepair)',
          faite:      false,
          date:       today,
          priorite:   'haute',
          source:     'manuel',
          projet_id:  null,
        },
        {
          texte:      'Prendre RDV conseiller France Travail (PPAE + AIF formation IA + AREF)',
          faite:      false,
          date:       today,
          priorite:   'haute',
          source:     'manuel',
          projet_id:  null,
        },
        {
          texte:      "S'inscrire sur Entrepair.fr (apres creation du portfolio)",
          faite:      false,
          date:       today,
          priorite:   'normale',
          source:     'manuel',
          projet_id:  null,
        },
        {
          texte:      'Identifier 2-3 formations IA strategiques eligibles AIF demarrant en juin 2026',
          faite:      false,
          date:       today,
          priorite:   'normale',
          source:     'manuel',
          projet_id:  null,
        },
        {
          texte:      'Identifier 3-5 evenements B2B (CCI, club entrepreneurs, salons) avant fin juin 2026',
          faite:      false,
          date:       today,
          priorite:   'normale',
          source:     'manuel',
          projet_id:  null,
        },
        {
          texte:      'Terminer la mise a jour du profil Malt',
          faite:      false,
          date:       today,
          priorite:   'normale',
          source:     'manuel',
          projet_id:  null,
        },
        {
          texte:      'Bloquer 4h/sem dans agenda pour le sourcing pipeline (lundi, mercredi, vendredi)',
          faite:      false,
          date:       today,
          priorite:   'normale',
          source:     'manuel',
          projet_id:  null,
        },
        {
          texte:      'Reactiver 5 anciens contacts par mois (Wellpack, Kinome, Ingemedia, partenaires)',
          faite:      false,
          date:       today,
          priorite:   'normale',
          source:     'manuel',
          projet_id:  null,
        },
        {
          texte:      "Reflechir a une offre rapport d'impact pour les acteurs de l'ESS",
          faite:      false,
          date:       today,
          priorite:   'basse',
          source:     'manuel',
          projet_id:  null,
        },
      ])
      if (e4) throw new Error('Taches : ' + e4.message)
      addLog('OK - 13 taches importees')

      addLog('Import termine avec succes !')
      setStatus('done')

    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Erreur inconnue')
      setStatus('error')
    }
  }

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <h1 className="text-xl font-bold text-stone-800">Import depuis Notion</h1>
        <p className="text-xs text-muted mt-0.5">Donnees lues dans ton workspace — un clic pour tout importer dans Fayko</p>
      </div>

      {/* ── IDLE: preview ── */}
      {status === 'idle' && (
        <div className="space-y-3">

          <ImportSection emoji="📁" title="Projets clients" count={2}>
            <ImportItem label="ISI — Infra&Structure Ingenierie" sub="client · actif · 4 etapes (offre, plaquette, GMB, templates)" />
            <ImportItem label="Seramos" sub="client · en pause depuis mai 2026" />
          </ImportSection>

          <ImportSection emoji="🎯" title="Pipeline prospects" count={6}>
            <ImportItem label="STEGO Ingenierie" sub="Proposition · Mission structurante · 5 000 EUR" />
            <ImportItem label="DK Ingenierie" sub="Proposition · Mission structurante · 5 000 EUR" />
            <ImportItem label="SEGM" sub="En discussion · Diagnostic strategique · 3 500 EUR" />
            <ImportItem label="MD Structure" sub="En discussion · Diagnostic strategique · 3 500 EUR" />
            <ImportItem label="Axial Ingenierie et Conseils" sub="En discussion · Diagnostic strategique · 3 500 EUR" />
            <ImportItem label="Abibou" sub="Proposition · a qualifier" />
          </ImportSection>

          <ImportSection emoji="✅" title="Taches actives" count={13}>
            <ImportItem label="Contacter ISI — point restitution finale" sub="Haute · lie au projet ISI" />
            <ImportItem label="Sourcing pipeline outbound (15-20 structures)" sub="Haute" />
            <ImportItem label="Auditer ALISEA, Structalis, BET Structuris" sub="Haute" />
            <ImportItem label="Creer le portfolio YaatalCo" sub="Haute" />
            <ImportItem label="RDV France Travail (PPAE + AIF + AREF)" sub="Haute" />
            <ImportItem label="+ 8 autres taches..." sub="Normale / Basse" />
          </ImportSection>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <p className="text-xs text-amber-800 font-medium">Note sur le pipeline</p>
            <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
              Les stades des prospects ont ete deduits du contexte (taches, semaines hebdo).
              Tu pourras les ajuster manuellement dans Pipeline apres import.
            </p>
          </div>

          <button
            onClick={runImport}
            className="w-full bg-primary text-white font-bold py-3.5 rounded-2xl hover:bg-primary-dark transition text-sm"
          >
            Importer dans Fayko →
          </button>
        </div>
      )}

      {/* ── RUNNING ── */}
      {status === 'running' && (
        <div className="bg-surface border border-border rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-stone-700 mb-3">
            <Loader2 size={16} className="animate-spin text-primary" />
            Import en cours...
          </div>
          {log.map((l, i) => (
            <p key={i} className={`text-xs ${l.startsWith('OK') ? 'text-green-600 font-medium' : 'text-stone-500'}`}>{l}</p>
          ))}
        </div>
      )}

      {/* ── DONE ── */}
      {status === 'done' && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-green-700 font-bold mb-3">
              <Check size={18} /> Import reussi !
            </div>
            <div className="space-y-1">
              {log.map((l, i) => (
                <p key={i} className={`text-xs ${l.startsWith('OK') ? 'text-green-600 font-medium' : 'text-green-500'}`}>{l}</p>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <a href="/projets"   className="bg-primary text-white text-center text-xs font-bold py-3 rounded-xl hover:bg-primary-dark transition">Projets</a>
            <a href="/prospects" className="bg-surface border border-border text-stone-700 text-center text-xs font-bold py-3 rounded-xl hover:bg-beige-50 transition">Pipeline</a>
            <a href="/"          className="bg-surface border border-border text-stone-700 text-center text-xs font-bold py-3 rounded-xl hover:bg-beige-50 transition">Focus</a>
          </div>
          <p className="text-[11px] text-muted text-center">Tu peux supprimer cette page apres — elle ne sert qu'une fois.</p>
        </div>
      )}

      {/* ── ERROR ── */}
      {status === 'error' && (
        <div className="space-y-3">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-red-700 font-bold mb-2">
              <AlertCircle size={16} /> Erreur
            </div>
            <p className="text-xs text-red-600 font-medium">{errMsg}</p>
            {log.length > 0 && (
              <div className="mt-2 pt-2 border-t border-red-100 space-y-1">
                {log.map((l, i) => <p key={i} className="text-xs text-stone-500">{l}</p>)}
              </div>
            )}
          </div>
          <p className="text-xs text-muted">Si une partie a deja ete importee, verifie dans Projets et Pipeline avant de relancer.</p>
          <button
            onClick={() => { setStatus('idle'); setLog([]); setErrMsg(null) }}
            className="text-xs text-primary underline"
          >
            Retour
          </button>
        </div>
      )}
    </div>
  )
}

function ImportSection({ emoji, title, count, children }: {
  emoji: string; title: string; count: number; children: React.ReactNode
}) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-stone-800">{emoji} {title}</h3>
        <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full font-semibold">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function ImportItem({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-stone-300 text-xs mt-0.5 shrink-0">•</span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-stone-700 leading-tight">{label}</p>
        {sub && <p className="text-[11px] text-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}
