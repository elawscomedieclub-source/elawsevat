# EVAT v4.2

## Les deux IA
- **ELAWS** (la sphère en haut de l'écran) : répond à toutes les questions, comme une personne réfléchie.
- **Assistant métier** (carte verte sur l'accueil, et menu « Plus ») : répond uniquement aux questions du métier renseigné dans le profil. Hors sujet, il renvoie poliment vers ELAWS.
- Chaque IA a sa propre discussion, conservée sur le téléphone. Réponses affichées en direct, bouton ■ pour arrêter, 🎙️ pour dicter.

### Activer les IA (obligatoire)
Les IA utilisent l'API Anthropic. La clé reste **sur le serveur**, jamais dans l'application.
1. Créer une clé sur console.anthropic.com.
2. Render → Environment : `ANTHROPIC_API_KEY=sk-ant-...`
3. Options : `AI_MODEL_GENERAL`, `AI_MODEL_METIER` (défaut `claude-sonnet-5-5` ; `claude-haiku-5-5` est moins cher et plus rapide), `AI_DAILY_LIMIT` (questions par personne et par jour, défaut 200), `AI_MAX_TOKENS` (défaut 1500).
Sans clé, ELAWS répond avec l'ancien mode local limité et l'assistant métier indique qu'il n'est pas activé.
Limites : les IA n'ont pas accès à Internet (pas d'actualité récente). Chaque question est facturée par Anthropic : le plafond quotidien protège votre budget.

## Déploiement
1. Serveur (Render) : remplacer `server.js` et `package.json`, ajouter les variables, redéployer.
2. Site : remplacer tous les autres fichiers, icônes PNG comprises.
3. Téléphones : ouvrir l'app une fois pour mettre à jour, puis « Activer » les notifications sur l'accueil.

## Appels et messages app fermée (notifications push)
- `npx web-push generate-vapid-keys`, puis `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:vous@exemple.com`.
- iPhone : EVAT doit être ajouté à l'écran d'accueil (iOS 16.4+).

## Appels fiables en 3G/4G
`TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` (ou `TURN_SECRET` avec coturn).

## Autres
`ALLOWED_ORIGINS`, `DATA_DIR` (disque persistant Render). Pinger `/health` toutes les 5 min (UptimeRobot).
