import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Devis, DevisFormLigne, Client, Template } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
}

export function formatDate(date: string): string {
  return format(new Date(date), 'dd/MM/yyyy', { locale: fr })
}

export function formatDateRelative(date: string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: fr })
}

export function calcTotal(lignes: DevisFormLigne[], remiseType: string | null, remiseValeur: number | null): {
  sousTotal: number
  remise: number
  total: number
} {
  const sousTotal = lignes.reduce((s, l) => s + l.prix * (l.quantite || 1), 0)
  let remise = 0
  if (remiseType === 'fixe' && remiseValeur) remise = remiseValeur
  if (remiseType === 'pourcentage' && remiseValeur) remise = sousTotal * remiseValeur / 100
  return { sousTotal, remise, total: Math.max(0, sousTotal - remise) }
}

export function generateDevisText(
  client: Client,
  lignes: DevisFormLigne[],
  remiseType: string | null,
  remiseValeur: number | null,
  modeReglement: 'acompte' | 'total',
  acomptePourcentage: number,
  isAdmin = true
): string {
  const { remise, total } = calcTotal(lignes, remiseType, remiseValeur)
  const acompte = total * acomptePourcentage / 100

  const lignesText = lignes.map(l => {
    const qty = l.quantite || 1
    const lineTotal = l.prix * qty
    let line = qty > 1
      ? `• ${qty} × ${l.libelle} — ${formatPrice(lineTotal)}`
      : `• ${l.libelle} — ${formatPrice(l.prix)}`
    if (l.description) line += `\n  (${l.description})`
    return line
  }).join('\n')

  const marqueLabel = client.marque ? ` — *${client.marque}*` : ''
  const introText = isAdmin ? 'Voici ton devis personnalisé :' : 'Voici ta commande :'
  let text = `Bonjour ${client.prenom}${marqueLabel},\n\n${introText}\n\n${lignesText}\n`

  if (remise > 0) {
    text += `\nRemise : -${formatPrice(remise)}`
  }

  text += `\nTotal : ${formatPrice(total)}`

  if (modeReglement === 'acompte') {
    text += `\nAcompte demandé : ${formatPrice(acompte)} (${acomptePourcentage}%)`
  }

  const ctaText = isAdmin
    ? 'Pour valider, tu peux effectuer ton virement via ce lien :'
    : 'Pour confirmer ta commande, tu peux effectuer ton règlement via ce lien :'
  text += `\n\n${ctaText}\n[lien de paiement]\n\nN'hésite pas si tu as la moindre question.\nÀ très vite !`

  return text
}

export function applyTemplateVars(
  contenu: string,
  client: Client,
  devis: Devis,
  acomptePourcentage: number
): string {
  const acompte = devis.total_ht * acomptePourcentage / 100
  return contenu
    .replace(/\[Prénom\]/g, client.prenom)
    .replace(/\[Marque\]/g, client.marque || client.prenom)
    .replace(/\[Montant\]/g, formatPrice(devis.total_ht))
    .replace(/\[Acompte\]/g, formatPrice(acompte))
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    return true
  }
}

export const STATUT_COLORS: Record<string, string> = {
  'Envoyé': 'bg-blue-100 text-blue-700',
  'Validé': 'bg-purple-100 text-purple-700',
  'Acompte reçu': 'bg-amber-100 text-amber-700',
  'Soldé': 'bg-green-100 text-green-700',
  'Annulé': 'bg-stone-100 text-stone-500',
}

export const STATUTS: string[] = ['Envoyé', 'Validé', 'Acompte reçu', 'Soldé', 'Annulé']
