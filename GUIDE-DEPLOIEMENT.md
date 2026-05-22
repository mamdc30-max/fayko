# Guide de déploiement — Fayko

Ce guide t'explique comment mettre Fayko en ligne, étape par étape. Tu n'as pas besoin de savoir coder.

---

## Ce dont tu as besoin

- Un ordinateur avec internet
- Environ 30 minutes

---

## Étape 1 — Créer les 3 comptes (si pas encore fait)

1. **GitHub** → [github.com](https://github.com) → "Sign up" → email `mamdc30@gmail.com`
2. **Supabase** → [supabase.com](https://supabase.com) → "Start your project" → connexion avec GitHub
3. **Vercel** → [vercel.com](https://vercel.com) → "Sign Up" → connexion avec GitHub

---

## Étape 2 — Installer Node.js

1. Va sur [nodejs.org](https://nodejs.org)
2. Télécharge la version **LTS** (bouton vert à gauche)
3. Lance l'installation, clique "Next" jusqu'à la fin
4. Redémarre ton ordinateur

---

## Étape 3 — Créer le projet Supabase

1. Va sur [supabase.com](https://supabase.com) → "New project"
2. Nom du projet : `fayko`
3. Crée un mot de passe (garde-le précieusement)
4. Région : **West EU (Ireland)** → "Create new project"
5. Attends 1-2 minutes que le projet se crée

### Créer la base de données

1. Dans ton projet Supabase, clique sur **SQL Editor** (icône `<>` dans le menu gauche)
2. Clique **"New query"**
3. Copie tout le contenu du fichier `fayko/supabase/schema.sql`
4. Colle-le dans l'éditeur
5. Clique **"Run"** (bouton vert)
6. Tu dois voir "Success. No rows returned" → c'est bon !

### Récupérer les clés API Supabase

1. Dans Supabase, clique **Settings** (roue dentée en bas à gauche)
2. Clique **API**
3. Note ces deux valeurs (tu en auras besoin à l'étape 6) :
   - **Project URL** → commence par `https://`
   - **anon public key** → longue chaîne qui commence par `eyJ`

---

## Étape 4 — Créer ton compte utilisateur dans Supabase

1. Dans Supabase, clique **Authentication** (icône cadenas)
2. Clique **"Add user"** → **"Create new user"**
3. Email : `mamdc30@gmail.com`
4. Mot de passe : choisis un mot de passe pour te connecter à Fayko
5. Clique **"Create user"**

---

## Étape 5 — Récupérer ta clé Anthropic

1. Va sur [console.anthropic.com](https://console.anthropic.com)
2. Connecte-toi (ou crée un compte)
3. Dans le menu, clique **API Keys**
4. Clique **"Create Key"**
5. Note la clé (commence par `sk-ant-`) — elle n'est affichée qu'une seule fois !

---

## Étape 6 — Publier le code sur GitHub

### Ouvre le Terminal

- Sur Windows : touche `Windows` + `R`, tape `cmd`, appuie sur Entrée

### Navigue vers le dossier fayko

```
cd "C:\Users\mdthi\OneDrive\Desktop\Claude\fayko"
```

### Installe les dépendances

```
npm install
```

(Attends 1-2 minutes)

### Crée le fichier `.env.local`

Dans le dossier `fayko`, crée un fichier nommé `.env.local` avec ce contenu (remplace par tes vraies valeurs) :

```
NEXT_PUBLIC_SUPABASE_URL=https://XXXXXXXXXXXX.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
ANTHROPIC_API_KEY=sk-ant-...
```

### Publie sur GitHub

```
git init
git add .
git commit -m "Initial commit — Fayko"
```

Puis va sur [github.com](https://github.com) → **"New repository"** → nom : `fayko` → **"Create repository"**

Copie les commandes affichées (ressemblent à) :
```
git remote add origin https://github.com/TON-PSEUDO/fayko.git
git branch -M main
git push -u origin main
```

---

## Étape 7 — Déployer sur Vercel

1. Va sur [vercel.com](https://vercel.com) → **"Add New Project"**
2. Clique **"Import"** à côté de ton dépôt `fayko`
3. Dans **"Environment Variables"**, ajoute les 3 variables :
   - `NEXT_PUBLIC_SUPABASE_URL` → ta valeur
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → ta valeur
   - `ANTHROPIC_API_KEY` → ta valeur
4. Clique **"Deploy"**
5. Attends 2-3 minutes → tu obtiens une URL du type `fayko.vercel.app` 🎉

---

## Étape 8 — Accéder à l'application

- **Sur ordinateur** : ouvre ton URL Vercel dans le navigateur
- **Sur téléphone** : ouvre l'URL dans Safari (iPhone) ou Chrome (Android)
  - **Pour l'ajouter à l'écran d'accueil** :
    - iPhone : icône "Partager" → "Sur l'écran d'accueil"
    - Android : menu ⋮ → "Ajouter à l'écran d'accueil"

---

## Mettre à jour l'application

Si une modification est apportée au code, tu n'as qu'à faire depuis le Terminal :

```
cd "C:\Users\mdthi\OneDrive\Desktop\Claude\fayko"
git add .
git commit -m "Mise à jour"
git push
```

Vercel redéploie automatiquement en 2-3 minutes.

---

## En cas de problème

- **Erreur à l'étape SQL** → vérifie que tu as bien tout copié le contenu du fichier schema.sql
- **Page blanche après déploiement** → vérifie que les 3 variables d'environnement sont bien saisies dans Vercel
- **Impossible de se connecter** → vérifie que tu as bien créé l'utilisateur dans Supabase Auth (étape 4)
