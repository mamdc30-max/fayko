-- Ajouter la colonne URL ICS Google Calendar dans la table settings
ALTER TABLE settings ADD COLUMN IF NOT EXISTS gcal_ics_url text DEFAULT NULL;
