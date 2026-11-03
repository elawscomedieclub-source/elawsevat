# Guide d'activation EVAT v4.3 (pas à pas)

Votre serveur : https://elawsserverevat.onrender.com

## Étape 1 — Mettre le nouveau serveur en ligne
- Remplacez `server.js` et `package.json` (et les autres fichiers du site) là où est votre code (GitHub).
- Render redéploie seul. Sinon : Render → votre service → **Manual Deploy → Deploy latest commit**.
- Attendez « Live » (2 à 3 minutes).

## Étape 2 — Variables d'environnement (Render → service → Environment → Add Environment Variable)
| Nom | Valeur | Rôle |
|---|---|---|
| ADMIN_TOKEN | (mot secret fourni) | ouvre la page de diagnostic |
| VAPID_SECRET | (mot secret fourni) | notifications d'appels app fermée |
| ANTHROPIC_API_KEY | clé `sk-ant-...` (étape 3) | active Mister ELAWS et Mister I |
| CF_TURN_KEY_ID | étape 5 | appels en 3G/4G |
| CF_TURN_API_TOKEN | étape 5 | appels en 3G/4G |
Après chaque changement, Render redémarre le service.

## Étape 3 — Clé IA (Anthropic)
1. console.anthropic.com → créez un compte.
2. **Billing** : ajoutez un peu de crédit (5 $ suffisent pour commencer) et fixez une limite mensuelle (Settings → Limits).
3. **API Keys → Create Key** : copiez la clé (affichée une seule fois) dans `ANTHROPIC_API_KEY`.

## Étape 4 — Recherche Internet des IA
Dans la Console Anthropic : Settings → activez **Web search** (autorisée par l'administrateur de l'organisation). Sans cela, les IA répondent normalement mais sans Internet (le serveur le détecte et continue).

## Étape 5 — Appels sur réseau mobile (TURN gratuit Cloudflare)
1. dash.cloudflare.com → créez un compte gratuit.
2. **Realtime → TURN Server → Create** : donnez un nom.
3. Copiez le **Token ID** dans `CF_TURN_KEY_ID` et le **API Token** dans `CF_TURN_API_TOKEN`.

## Étape 6 — Vérifier : page de diagnostic
Ouvrez : `https://elawsserverevat.onrender.com/diagnostic?token=VOTRE_ADMIN_TOKEN&test=1`
Chaque service affiche ✅ ou ❌ avec ce qu'il faut corriger.

## Étape 7 — Empêcher l'endormissement (gratuit)
uptimerobot.com → Add New Monitor → HTTP(s) → `https://elawsserverevat.onrender.com/health` → toutes les 5 minutes.

## Étape 8 — Test sur deux téléphones
Ouvrir l'app (mise à jour) → « Activer » les notifications sur l'accueil → s'appeler (Wi-Fi puis 4G) → fermer l'app et rappeler → poser une question à Mister ELAWS et à Mister I.

## Réglages optionnels
AI_MODEL_GENERAL / AI_MODEL_METIER (claude-haiku-5-5 = moins cher), AI_DAILY_LIMIT (100 par personne et par jour), AI_GLOBAL_DAILY_LIMIT (2000 par jour pour toute l'app), AI_WEB_SEARCH=off, AI_ENABLED=false (coupe les IA en urgence), ALLOWED_ORIGINS, DATA_DIR (disque persistant).

---

# Nouveautés v4.4

## Tous les pays
L'inscription propose les 243 pays et territoires (nom en français, drapeau, indicatif). Rien à configurer. Les numéros sont enregistrés au format international (+indicatif…). Mister ELAWS et Mister I s'adaptent au pays et au fuseau horaire de chaque personne (monnaie, réglementation, heure). L'interface reste en français ; les IA répondent dans la langue de la question.

## Appels quand l'application est fermée : ce qu'il faut sur chaque téléphone
1. Installer EVAT : Android → menu du navigateur → « Installer l'application » ; iPhone → Partager → « Sur l'écran d'accueil » (obligatoire sur iPhone, iOS 16.4 minimum).
2. Toucher « Activer » les notifications sur l'accueil et accepter.
3. Android : Réglages → Applications → EVAT → Batterie → « Sans restriction » (sinon Android peut retarder les notifications).
4. Tester : Paramètres → « Tester un appel app fermée », puis fermer EVAT. 3 notifications d'appel arrivent après 8 secondes.
Fonctionnement : le serveur renvoie la notification d'appel toutes les 4,5 secondes (6 fois) tant que personne n'a décroché, ce qui fait « sonner » le téléphone. Toucher la notification ouvre l'appel ; « Répondre » décroche directement (Android).

## Sonnerie du téléphone
Paramètres → « Sonnerie de mon téléphone » (choix par défaut des nouveaux comptes). EVAT utilise alors le son de notification de votre téléphone, application ouverte ou fermée. Pour choisir votre sonnerie : Réglages du téléphone → Applications → EVAT → Notifications → Son.

## Limite à connaître
Une application web (PWA) ne peut pas lire la vraie sonnerie système en boucle, ni afficher l'écran d'appel plein écran sur téléphone verrouillé : seule une application native Android/iOS (Google Play / App Store) le permet. La solution actuelle est la meilleure possible sans passer par une application native.
