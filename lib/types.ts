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
  echeance: string | null
  priorite: 'haute' | 'normale' | 'basse'
  source: 'manuel' | 'agenda'
  projet_id: string | null
  etape_id: string | null
  created_at: string
}

// ---- V3 Pipeline ----

export type ProspectStatut =
  | 'source'
  | 'contacte'
  | 'en_discussion'
  | 'proposition'
  | 'client'
  | 'perdu'

export type InteractionType = 'message' | 'appel' | 'rdv' | 'relance' | 'email' | 'autre'
export type TypeEvenement = 'networking' | 'conférence' | 'atelier' | 'autre'

export interface Prospect {
  id: string
  prenom: string
  nom: string
  entreprise: string | null
  secteur: string | null
  ville: string | null
  linkedin_url: string | null
  effectif: number | null
  ca_estime: string | null
  score_site: number | null
  score_linkedin: number | null
  canal_propose: string | null
  message_type: string | null
  source_detail: string | null
  offre_associee: string | null
  montant_estime: number
  statut: ProspectStatut
  notes: string | null
  last_action_at: string | null
  created_at: string
}

export interface ProspectInteraction {
  id: string
  prospect_id: string
  type: InteractionType
  label: string | null
  date: string
  notes: string | null
  created_at: string
}

// ---- V3 Projets ----

export type ProjetType   = 'client' | 'interne' | 'associatif'
export type ProjetStatut = 'actif' | 'en_pause' | 'termine' | 'archive'

export interface Projet {
  id: string
  nom: string
  type: ProjetType
  statut: ProjetStatut
  client_nom: string | null
  description: string | null
  date_debut: string | null
  date_fin: string | null
  created_at: string
}

export interface Etape {
  id: string
  projet_id: string
  nom: string
  ordre: number
  statut: 'en_cours' | 'termine'
  created_at: string
}

export interface ContactReseau {
  id: string
  prenom: string
  entreprise: string | null
  sujet: string | null
  evenement: string | null
  rencontre_at: string
  photo_url: string | null
  rappel_fait: boolean
  converti: boolean
  created_at: string
}

export interface EvenementReseau {
  id: string
  nom: string
  date_event: string | null
  lieu: string | null
  type: TypeEvenement
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

// ---- Daily focus ----

export type FocusCategorie = 'crm' | 'sourcing' | 'contact'
export type FocusPriorite = 1 | 2 | 3

export interface DailyFocus {
  id: string
  user_id?: string
  date: string
  categorie: FocusCategorie
  priorite: FocusPriorite
  action: string
  contexte: string | null
  lien_type: string | null
  lien_id: string | null
  fait: boolean
  created_at: string
}

// ---- Automation logs ----

export interface AutomationLog {
  id: string
  user_id?: string
  task_name: string
  status: 'success' | 'error' | 'partial'
  summary: string | null
  ran_at: string
}

// ---- Veille hebdo ----

export type VeilleCategorie = 'communication' | 'diaspora' | 'linkedin' | 'outils'
export type VeilleType = 'article' | 'evenement' | 'outil' | 'tendance' | 'podcast'

export interface VeilleItem {
  id: string
  user_id?: string
  titre: string
  source_url: string | null
  resume: string | null
  categorie: VeilleCategorie
  type: VeilleType
  date_veille: string
  created_at: string
}
