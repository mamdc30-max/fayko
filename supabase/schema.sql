-- ============================================================
-- Fayko — Schéma Supabase
-- À exécuter dans Supabase > SQL Editor
-- ============================================================

-- Paramètres globaux
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  acompte_pourcentage INTEGER DEFAULT 50,
  CONSTRAINT single_row CHECK (id = 1)
);
INSERT INTO settings (id, acompte_pourcentage) VALUES (1, 50) ON CONFLICT DO NOTHING;

-- Clients
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prenom TEXT NOT NULL,
  nom TEXT NOT NULL,
  whatsapp TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Forfaits
CREATE TABLE IF NOT EXISTS forfaits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  description TEXT,
  prix_ht DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Éléments à la carte
CREATE TABLE IF NOT EXISTS elements_carte (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  prix DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Devis
CREATE TABLE IF NOT EXISTS devis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero INTEGER NOT NULL,
  titre TEXT NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE RESTRICT,
  statut TEXT DEFAULT 'Envoyé' CHECK (statut IN ('Envoyé', 'Validé', 'Acompte reçu', 'Soldé', 'Annulé')),
  remise_type TEXT CHECK (remise_type IN ('fixe', 'pourcentage')),
  remise_valeur DECIMAL(10,2),
  mode_reglement TEXT DEFAULT 'acompte' CHECK (mode_reglement IN ('acompte', 'total')),
  acompte_pourcentage INTEGER DEFAULT 50,
  total_ht DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Lignes de devis
CREATE TABLE IF NOT EXISTS devis_lignes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  devis_id UUID REFERENCES devis(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('forfait', 'element', 'libre')),
  libelle TEXT NOT NULL,
  prix DECIMAL(10,2) NOT NULL,
  ref_id UUID,
  ordre INTEGER DEFAULT 0
);

-- Historique des statuts
CREATE TABLE IF NOT EXISTS devis_statut_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  devis_id UUID REFERENCES devis(id) ON DELETE CASCADE,
  statut TEXT NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT now()
);

-- Relances
CREATE TABLE IF NOT EXISTS relances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  devis_id UUID REFERENCES devis(id) ON DELETE CASCADE,
  effectuee BOOLEAN DEFAULT false,
  effectuee_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Templates de messages
CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('paiement', 'relance', 'remerciement')),
  contenu TEXT NOT NULL
);

INSERT INTO templates (id, type, contenu) VALUES
  (1, 'paiement', 'Bonjour [Prénom],

Suite à la validation de ton devis, voici le lien pour régler ton acompte de [Acompte] :
[lien de paiement]

Merci et à très vite !'),
  (2, 'relance', 'Bonjour [Prénom],

Je me permets de revenir vers toi concernant le devis que je t''avais envoyé il y a quelques jours.

N''hésite pas si tu as des questions ou si tu souhaites qu''on ajuste quelque chose.

Je reste disponible.
À bientôt !'),
  (3, 'remerciement', 'Bonjour [Prénom],

J''ai bien reçu ton règlement de [Montant], merci beaucoup !

Je me mets au travail et je reviens vers toi très vite.
À bientôt !')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Row Level Security (RLS)
-- Accès réservé aux utilisateurs connectés
-- ============================================================

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE forfaits ENABLE ROW LEVEL SECURITY;
ALTER TABLE elements_carte ENABLE ROW LEVEL SECURITY;
ALTER TABLE devis ENABLE ROW LEVEL SECURITY;
ALTER TABLE devis_lignes ENABLE ROW LEVEL SECURITY;
ALTER TABLE devis_statut_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE relances ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_only" ON settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_only" ON clients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_only" ON forfaits FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_only" ON elements_carte FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_only" ON devis FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_only" ON devis_lignes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_only" ON devis_statut_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_only" ON relances FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_only" ON templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
