-- ============================================================
-- MIGRATION MULTI-UTILISATEURS — FAYKO
-- À exécuter dans Supabase > SQL Editor (en une seule fois)
-- ============================================================

-- ÉTAPE 1 : Ajouter user_id aux tables principales
-- ============================================================
ALTER TABLE clients        ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE devis          ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE forfaits       ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE elements_carte ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE settings       ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE templates      ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Pour chat_sessions (si la table existe)
ALTER TABLE chat_sessions  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;


-- ÉTAPE 2 : Attribuer les données existantes à ton compte
-- ============================================================
-- 1) Va dans Supabase > Authentication > Users
-- 2) Copie ton User UID (ex: 3f8a1b2c-...)
-- 3) Remplace 'REMPLACE_PAR_TON_USER_ID' ci-dessous par ton vrai UID

DO $$
DECLARE
  v_user_id uuid := 'REMPLACE_PAR_TON_USER_ID';
BEGIN
  UPDATE clients        SET user_id = v_user_id WHERE user_id IS NULL;
  UPDATE devis          SET user_id = v_user_id WHERE user_id IS NULL;
  UPDATE forfaits       SET user_id = v_user_id WHERE user_id IS NULL;
  UPDATE elements_carte SET user_id = v_user_id WHERE user_id IS NULL;
  UPDATE settings       SET user_id = v_user_id WHERE user_id IS NULL;
  UPDATE templates      SET user_id = v_user_id WHERE user_id IS NULL;
  UPDATE chat_sessions  SET user_id = v_user_id WHERE user_id IS NULL;
END $$;


-- ÉTAPE 3 : Rendre user_id obligatoire (après la mise à jour)
-- ============================================================
ALTER TABLE clients        ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE devis          ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE forfaits       ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE elements_carte ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE settings       ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE templates      ALTER COLUMN user_id SET NOT NULL;
-- Note: chat_sessions laissé nullable au cas où certaines sessions n'ont pas de user


-- ÉTAPE 4 : Activer RLS sur toutes les tables
-- ============================================================
ALTER TABLE clients               ENABLE ROW LEVEL SECURITY;
ALTER TABLE devis                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE devis_lignes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE devis_statut_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE forfaits              ENABLE ROW LEVEL SECURITY;
ALTER TABLE elements_carte        ENABLE ROW LEVEL SECURITY;
ALTER TABLE relances              ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates             ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions         ENABLE ROW LEVEL SECURITY;


-- ÉTAPE 5 : Créer les politiques RLS
-- ============================================================

-- Clients
DROP POLICY IF EXISTS "users_own_clients" ON clients;
CREATE POLICY "users_own_clients" ON clients
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Devis
DROP POLICY IF EXISTS "users_own_devis" ON devis;
CREATE POLICY "users_own_devis" ON devis
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Devis lignes (via devis parent)
DROP POLICY IF EXISTS "users_own_devis_lignes" ON devis_lignes;
CREATE POLICY "users_own_devis_lignes" ON devis_lignes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM devis WHERE devis.id = devis_lignes.devis_id AND devis.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM devis WHERE devis.id = devis_lignes.devis_id AND devis.user_id = auth.uid())
  );

-- Historique statuts (via devis parent)
DROP POLICY IF EXISTS "users_own_statut_history" ON devis_statut_history;
CREATE POLICY "users_own_statut_history" ON devis_statut_history
  FOR ALL USING (
    EXISTS (SELECT 1 FROM devis WHERE devis.id = devis_statut_history.devis_id AND devis.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM devis WHERE devis.id = devis_statut_history.devis_id AND devis.user_id = auth.uid())
  );

-- Relances (via devis parent)
DROP POLICY IF EXISTS "users_own_relances" ON relances;
CREATE POLICY "users_own_relances" ON relances
  FOR ALL USING (
    EXISTS (SELECT 1 FROM devis WHERE devis.id = relances.devis_id AND devis.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM devis WHERE devis.id = relances.devis_id AND devis.user_id = auth.uid())
  );

-- Forfaits
DROP POLICY IF EXISTS "users_own_forfaits" ON forfaits;
CREATE POLICY "users_own_forfaits" ON forfaits
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Éléments à la carte
DROP POLICY IF EXISTS "users_own_elements" ON elements_carte;
CREATE POLICY "users_own_elements" ON elements_carte
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Settings
DROP POLICY IF EXISTS "users_own_settings" ON settings;
CREATE POLICY "users_own_settings" ON settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Templates
DROP POLICY IF EXISTS "users_own_templates" ON templates;
CREATE POLICY "users_own_templates" ON templates
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Chat sessions
DROP POLICY IF EXISTS "users_own_chat_sessions" ON chat_sessions;
CREATE POLICY "users_own_chat_sessions" ON chat_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ÉTAPE 6 : Trigger auto-set user_id à chaque INSERT
-- ============================================================
-- Ce trigger rempli automatiquement user_id pour les nouveaux enregistrements

CREATE OR REPLACE FUNCTION public.set_user_id_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  NEW.user_id = auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_user_id ON clients;
CREATE TRIGGER trg_set_user_id BEFORE INSERT ON clients FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();

DROP TRIGGER IF EXISTS trg_set_user_id ON devis;
CREATE TRIGGER trg_set_user_id BEFORE INSERT ON devis FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();

DROP TRIGGER IF EXISTS trg_set_user_id ON forfaits;
CREATE TRIGGER trg_set_user_id BEFORE INSERT ON forfaits FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();

DROP TRIGGER IF EXISTS trg_set_user_id ON elements_carte;
CREATE TRIGGER trg_set_user_id BEFORE INSERT ON elements_carte FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();

DROP TRIGGER IF EXISTS trg_set_user_id ON chat_sessions;
CREATE TRIGGER trg_set_user_id BEFORE INSERT ON chat_sessions FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();

-- Note: settings et templates ont leur propre trigger ci-dessous (avec defaults)


-- ÉTAPE 7 : Trigger création automatique des données par défaut pour les nouveaux utilisateurs
-- ============================================================
-- Quand quelqu'un crée un compte, ses settings et templates sont créés automatiquement

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Settings par défaut
  INSERT INTO public.settings (user_id, acompte_pourcentage)
  VALUES (NEW.id, 50);

  -- Templates par défaut
  INSERT INTO public.templates (user_id, type, contenu) VALUES
  (NEW.id, 'paiement',
   'Bonjour [Prénom] 👋' || chr(10) || chr(10) ||
   'Merci pour ta confiance ! Voici le lien pour régler ton acompte de [Acompte] :' || chr(10) || chr(10) ||
   '👉 [Lien]' || chr(10) || chr(10) ||
   'N''hésite pas si tu as des questions 😊' || chr(10) ||
   'À très vite 🙏'),
  (NEW.id, 'relance',
   'Bonjour [Prénom] 👋' || chr(10) || chr(10) ||
   'Je me permets de te relancer concernant mon offre. Est-ce que tu as eu le temps d''y jeter un œil ?' || chr(10) || chr(10) ||
   'Je reste disponible si tu as des questions 😊'),
  (NEW.id, 'remerciement',
   'Merci [Prénom] ! 🎉' || chr(10) || chr(10) ||
   'Ton paiement de [Montant] a bien été reçu.' || chr(10) ||
   'C''est un plaisir de travailler avec toi !' || chr(10) || chr(10) ||
   'Je te tiens informé(e) de la suite très bientôt 🙏');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- FIN DE LA MIGRATION
-- Si tout s'est bien passé, tu verras "Success. No rows returned."
-- ============================================================
