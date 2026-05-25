export type Statut = 'Envoyé' | 'Validé' | 'Acompte reçu' | 'Soldé' | 'Annulé'
export type ModeReglement = 'acompte' | 'total'
export type RemiseType = 'fixe' | 'pourcentage'
export type LigneType = 'forfait' | 'element' | 'libre'
export type TemplateType = 'paiement' | 'relance' | 'remerciement'

export interface Client {
  id: string
  prenom: string
  nom: string
  marque: string | null
  whatsapp: string | null
  derniere_synthese: string | null
  derniere_synthese_at: string | null
  created_at: string
}

export interface Forfait {
  id: string
  nom: string
  description: string | null
  prix_ht: number
  categorie: string | null
  created_at: string
}

export interface ElementCarte {
  id: string
  nom: string
  prix: number
  created_at: string
}

export interface DevisLigne {
  id: string
  devis_id: string
  type: LigneType
  libelle: string
  prix: number
  quantite: number
  ref_id: string | null
  ordre: number
}

export interface DevisStatutHistory {
  id: string
  devis_id: string
  statut: Statut
  changed_at: string
}

export interface Devis {
  id: string
  numero: number
  titre: string
  client_id: string
  statut: Statut
  remise_type: RemiseType | null
  remise_valeur: number | null
  mode_reglement: ModeReglement
  acompte_pourcentage: number
  total_ht: number
  created_at: string
  updated_at: string
  clients?: Client
  devis_lignes?: DevisLigne[]
  devis_statut_history?: DevisStatutHistory[]
}

export interface Relance {
  id: string
  devis_id: string
  effectuee: boolean
  effectuee_at: string | null
  created_at: string
  devis?: Devis & { clients: Client }
}

export interface Template {
  id: number
  type: TemplateType
  contenu: string
}

export interface Settings {
  id: number
  acompte_pourcentage: number
}

export interface Tache {
  id: string
  texte: string
  faite: boolean
  faite_at: string | null
  date: string
  created_at: string
}

export interface DevisFormLigne {
  id: string
  type: LigneType
  libelle: string
  description?: string | null
  prix: number
  quantite: number
  ref_id?: string
}

export interface ClientDossier extends Client {
  total_devis: number
  total_encaisse: number
  montant_en_attente: number
  statut_global: string
  devis: Devis[]
}
