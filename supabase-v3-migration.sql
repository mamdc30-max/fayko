-- ============================================================
-- FAYKO V3 — Migration Supabase
-- À coller dans Supabase > SQL Editor > New Query
-- Exécuter bloc par bloc dans l'ordre indiqué
-- ============================================================


-- ============================================================
-- BLOC 1 — Trigger user_id automatique (si pas déjà en place)
-- ============================================================

CREATE OR REPLACE FUNCTION set_user_id_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  NEW.user_id := auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- BLOC 2 — TABLE : projets
-- ============================================================

CREATE TABLE IF NOT EXISTS projets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users NOT NULL,
  nom           TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('client', 'interne', 'associatif')),
  statut        TEXT NOT NULL DEFAULT 'actif'
                  CHECK (statut IN ('actif', 'en_pause', 'termine', 'archive')),
  client_nom    TEXT,                    -- nom du client si type = 'client'
  description   TEXT,
  date_debut    DATE,
  date_fin      DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE projets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projets_user_only" ON projets
  FOR ALL USING (auth.uid() = user_id);

CREATE TRIGGER projets_set_user_id
  BEFORE INSERT ON projets
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();


-- ============================================================
-- BLOC 3 — TABLE : etapes (jalons dans un projet)
-- ============================================================

CREATE TABLE IF NOT EXISTS etapes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users NOT NULL,
  projet_id   UUID REFERENCES projets(id) ON DELETE CASCADE NOT NULL,
  nom         TEXT NOT NULL,
  ordre       INTEGER NOT NULL DEFAULT 0,
  statut      TEXT NOT NULL DEFAULT 'en_cours'
                CHECK (statut IN ('en_cours', 'termine')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE etapes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "etapes_user_only" ON etapes
  FOR ALL USING (auth.uid() = user_id);

CREATE TRIGGER etapes_set_user_id
  BEFORE INSERT ON etapes
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();


-- ============================================================
-- BLOC 4 — TABLE : taches (mise à jour V2 → V3)
-- Ajoute les colonnes projet_id et etape_id
-- ============================================================

ALTER TABLE taches
  ADD COLUMN IF NOT EXISTS projet_id UUID REFERENCES projets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS etape_id  UUID REFERENCES etapes(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS echeance  DATE,
  ADD COLUMN IF NOT EXISTS priorite  TEXT DEFAULT 'normale'
    CHECK (priorite IN ('haute', 'normale', 'basse'));


-- ============================================================
-- BLOC 5 — TABLE : prospects (mise à jour V2 → V3)
-- Nouvelles colonnes pour le sourcing Cowork + pipeline V3
-- ============================================================

-- Nouveaux champs sourcing
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS ville          TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url   TEXT,
  ADD COLUMN IF NOT EXISTS effectif       INTEGER,
  ADD COLUMN IF NOT EXISTS ca_estime      TEXT,
  ADD COLUMN IF NOT EXISTS score_site     INTEGER CHECK (score_site BETWEEN 1 AND 3),
  ADD COLUMN IF NOT EXISTS score_linkedin INTEGER CHECK (score_linkedin BETWEEN 1 AND 3),
  ADD COLUMN IF NOT EXISTS canal_propose  TEXT,   -- canal d'outreach suggéré par l'agent
  ADD COLUMN IF NOT EXISTS message_type   TEXT,   -- message personnalisé préparé par l'agent
  ADD COLUMN IF NOT EXISTS source_detail  TEXT,   -- ex: Pappers, URSCOP IDF, LinkedIn search
  ADD COLUMN IF NOT EXISTS last_action_at DATE DEFAULT CURRENT_DATE;

-- Migration des statuts V2 → V3
-- (à adapter si des prospects existent déjà)
UPDATE prospects SET statut = 'source'       WHERE statut = 'Rencontré';
UPDATE prospects SET statut = 'contacte'     WHERE statut = 'Contacté';
UPDATE prospects SET statut = 'en_discussion' WHERE statut = 'Appel découverte';
UPDATE prospects SET statut = 'proposition'  WHERE statut = 'Proposition envoyée';
UPDATE prospects SET statut = 'client'       WHERE statut = 'Client';
UPDATE prospects SET statut = 'perdu'        WHERE statut = 'Perdu';

-- Mise à jour de la contrainte statut
ALTER TABLE prospects DROP CONSTRAINT IF EXISTS prospects_statut_check;
ALTER TABLE prospects ADD CONSTRAINT prospects_statut_check
  CHECK (statut IN ('source', 'contacte', 'en_discussion', 'proposition', 'client', 'perdu'));


-- ============================================================
-- BLOC 6 — TABLE : prospect_interactions (log RDV 1/2/3, relances…)
-- ============================================================

CREATE TABLE IF NOT EXISTS prospect_interactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users NOT NULL,
  prospect_id  UUID REFERENCES prospects(id) ON DELETE CASCADE NOT NULL,
  type         TEXT NOT NULL
                 CHECK (type IN ('message', 'appel', 'rdv', 'relance', 'email', 'autre')),
  label        TEXT,    -- ex: "RDV 1 — Appel découverte", "Relance J+7"
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE prospect_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "interactions_user_only" ON prospect_interactions
  FOR ALL USING (auth.uid() = user_id);

CREATE TRIGGER interactions_set_user_id
  BEFORE INSERT ON prospect_interactions
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();


-- ============================================================
-- BLOC 7 — TABLE : idees
-- ============================================================

CREATE TABLE IF NOT EXISTS idees (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users NOT NULL,
  texte       TEXT NOT NULL,
  statut      TEXT NOT NULL DEFAULT 'capture'
                CHECK (statut IN (
                  'capture', 'a_challenger', 'en_evaluation',
                  'liee_projet', 'transformee_tache',
                  'transformee_projet', 'en_attente', 'abandonnee'
                )),
  projet_id   UUID REFERENCES projets(id) ON DELETE SET NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE idees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "idees_user_only" ON idees
  FOR ALL USING (auth.uid() = user_id);

CREATE TRIGGER idees_set_user_id
  BEFORE INSERT ON idees
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();


-- ============================================================
-- BLOC 8 — TABLE : priorites_hebdo
-- ============================================================

CREATE TABLE IF NOT EXISTS priorites_hebdo (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users NOT NULL,
  semaine     TEXT NOT NULL,   -- format ISO: '2026-W22'
  texte       TEXT NOT NULL,
  cochee      BOOLEAN DEFAULT FALSE,
  ordre       INTEGER DEFAULT 0,
  tache_id    UUID REFERENCES taches(id)   ON DELETE SET NULL,
  projet_id   UUID REFERENCES projets(id)  ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE priorites_hebdo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "priorites_user_only" ON priorites_hebdo
  FOR ALL USING (auth.uid() = user_id);

CREATE TRIGGER priorites_set_user_id
  BEFORE INSERT ON priorites_hebdo
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();


-- ============================================================
-- BLOC 9 — TABLE : revues_hebdo
-- ============================================================

CREATE TABLE IF NOT EXISTS revues_hebdo (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID REFERENCES auth.users NOT NULL,
  semaine                     TEXT NOT NULL,   -- format ISO: '2026-W22'
  priorites_atteintes         INTEGER,
  priorites_total             INTEGER,
  ce_qui_a_marche             TEXT,
  ce_qui_na_pas_avance        TEXT,
  apprentissages              TEXT,
  celebration                 TEXT,
  ajustements_semaine_suivante TEXT,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, semaine)   -- une seule revue par semaine
);

ALTER TABLE revues_hebdo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "revues_user_only" ON revues_hebdo
  FOR ALL USING (auth.uid() = user_id);

CREATE TRIGGER revues_set_user_id
  BEFORE INSERT ON revues_hebdo
  FOR EACH ROW EXECUTE FUNCTION set_user_id_on_insert();


-- ============================================================
-- BLOC 10 — INDEX (performances)
-- ============================================================

-- ============================================================
-- BLOC 11 — Qualification événementielle (contacts réseau V3)
-- ============================================================

ALTER TABLE contacts_reseau
  ADD COLUMN IF NOT EXISTS qualification TEXT DEFAULT 'a_qualifier'
    CHECK (qualification IN ('prospect', 'prestataire', 'partenaire', 'a_qualifier')),
  ADD COLUMN IF NOT EXISTS nom TEXT;

CREATE INDEX IF NOT EXISTS idx_etapes_projet      ON etapes(projet_id);
CREATE INDEX IF NOT EXISTS idx_taches_projet       ON taches(projet_id);
CREATE INDEX IF NOT EXISTS idx_taches_etape        ON taches(etape_id);
CREATE INDEX IF NOT EXISTS idx_interactions_prospect ON prospect_interactions(prospect_id);
CREATE INDEX IF NOT EXISTS idx_idees_projet        ON idees(projet_id);
CREATE INDEX IF NOT EXISTS idx_priorites_semaine   ON priorites_hebdo(user_id, semaine);
CREATE INDEX IF NOT EXISTS idx_revues_semaine      ON revues_hebdo(user_id, semaine);
CREATE INDEX IF NOT EXISTS idx_prospects_statut    ON prospects(user_id, statut);
CREATE INDEX IF NOT EXISTS idx_prospects_action    ON prospects(user_id, last_action_at);
