# EVAT v4.1

## Déploiement
1. **Serveur (Render)** : remplacer `server.js` et `package.json`, puis redéployer (installe `web-push`).
2. **Site** : remplacer tous les autres fichiers, **y compris les 4 icônes PNG** (nouvelle icône robot).
3. Sur les téléphones : ouvrir l'app une fois (le service worker se met à jour), puis sur l'accueil appuyer sur **Activer** les notifications.

## Appels et messages même app fermée (notifications push)
- Générer des clés une seule fois : `npx web-push generate-vapid-keys`
- Les mettre dans Render → Environment :
  `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=mailto:vous@exemple.com`
  (sans ça, le serveur en génère mais les perd à chaque redémarrage ; les téléphones se réabonnent alors tout seuls.)
- Android (Chrome) : la notification fait vibrer/sonner le téléphone ; toucher « Répondre » décroche directement.
- iPhone : fonctionne seulement si EVAT est **ajouté à l'écran d'accueil** (iOS 16.4+).
- La sonnerie sur écran verrouillé est celle des notifications du téléphone (le navigateur ne permet pas de sonnerie en boucle app fermée).

## Appels fiables sur 3G/4G
Variables Render : `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` (ou `TURN_SECRET` avec coturn).

## Autres variables
`ALLOWED_ORIGINS`, `DATA_DIR` (disque persistant Render pour garder comptes et messages).
Pinger `/health` toutes les 5 min (UptimeRobot) évite l'endormissement du serveur gratuit.
