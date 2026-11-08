# EVAT Continuum — APK autonome (Trusted Web Activity)

Une TWA = application Android qui ouvre **votre site HTTPS** en plein écran.
- Permissions Micro / Caméra / Notifications apparaissent sous **EVAT** dans Réglages Android
- Les mises à jour du **site** s’appliquent **sans** reconstruire l’APK (sauf changement d’icône / package)

> **`.pkg` = macOS.** Sur Android on génère un **`.apk`** (ou `.aab` pour Play Store).

---

## Prérequis

1. Site EVAT en **HTTPS** stable (ex. Netlify, Cloudflare Pages, Firebase Hosting)
2. `index.html` avec :
   ```js
   const SERVER_URL = "https://elawsserverevat.onrender.com";
   ```
3. `manifest.webmanifest` + icônes 192 / 512 / maskable accessibles en HTTPS
4. Ordinateur avec **Node.js 18+** et **JDK 17**
5. Compte optionnel Google Play (plus tard)

---

## Étape A — Préparer le site (Digital Asset Links)

Après avoir généré le keystore (étape B), vous obtiendrez une empreinte **SHA-256**.

1. Créez le fichier sur le **site** (même domaine que l’app) :

   `https://VOTRE-SITE/.well-known/assetlinks.json`

2. Contenu : voir `twa-apk/assetlinks.json`  
   - Remplacez `com.evat.continuum` si vous changez le package  
   - Collez l’empreinte SHA-256 (sans espaces)

3. Vérifiez dans le navigateur que l’URL répond en **JSON brut** (Content-Type application/json).

Test Google :
https://developers.google.com/digital-asset-links/tools/generator

---

## Étape B — Générer le projet + APK (Bubblewrap)

Sur votre PC :

```bash
# Outils
npm install -g @bubblewrap/cli

# Créer le projet (remplacez par l’URL RÉELLE de votre site)
bubblewrap init --manifest https://VOTRE-SITE/manifest.webmanifest
```

Réponses utiles :
- **Package ID** : `com.evat.continuum` (unique, ne plus le changer ensuite)
- **Name** : `EVAT Continuum`
- **Launcher name** : `EVAT`
- **Theme / background** : `#040a1a`
- **Display** : `standalone`
- Laissez Bubblewrap **créer un keystore** (notez le mot de passe !)

Puis :

```bash
cd <dossier-créé-par-bubblewrap>
bubblewrap build
```

Fichiers produits :
- `app-release-signed.apk` → installation directe
- parfois `.aab` → Google Play

---

## Étape C — Installer sur le téléphone

1. Android : **Réglages → Sécurité → Sources inconnues / Installer des apps inconnues** (autoriser Fichiers ou Chrome)
2. Transférez l’APK → ouvrez-le → **Installer**
3. **Réglages → Applications → EVAT → Autorisations** :
   - Microphone → Autoriser
   - Caméra → Autoriser
   - Notifications → Autoriser
4. Ouvrez EVAT **depuis l’icône** (pas Chrome)

---

## Mises à jour

| Changement | Faut-il un nouvel APK ? |
|------------|-------------------------|
| Messages, appels, TURN, IA, bugfix | **Non** (site + serveur) |
| Nouvelle icône, nom, package | **Oui** (`bubblewrap build`) |
| Publication Play Store | **Oui** (AAB + versionCode++) |

---

## Dépannage TWA

| Problème | Cause |
|----------|--------|
| Barre d’URL Chrome visible | `assetlinks.json` incorrect ou SHA-256 faux |
| Micro refusé | Autorisations app EVAT pas accordées |
| Appels OK en PWA mais pas APK | Même site : vérifier SERVER_URL et HTTPS |
| Install bloquée | Sources inconnues / Play Protect |

Empreinte SHA-256 du keystore :

```bash
keytool -list -v -keystore chemin/vers/android.keystore -alias android
```

Copiez la ligne **SHA256:** dans `assetlinks.json`.

---

## Play Store (plus tard)

1. `bubblewrap build` → fichier `.aab`
2. Google Play Console → application → production / test interne
3. Politique confidentialité (micro, caméra, notifs)
4. versionCode incrémenté à chaque upload

---

## Checklist rapide

- [ ] Site HTTPS + manifest + icônes
- [ ] SERVER_URL = serveur Render
- [ ] `bubblewrap init` + `build`
- [ ] SHA-256 dans `/.well-known/assetlinks.json`
- [ ] APK installé + permissions Micro/Caméra/Notifs
- [ ] Test d’appel (TURN déjà vert)
