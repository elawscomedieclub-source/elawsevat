# 🚀 Guide de Déploiement Complet - EVAT | ELAWS Quantum v3.60 Turbo

Ce dossier contient l'intégralité du code source de l'application **EVAT Quantum v3.60 Turbo** (Frontend PWA) ainsi que le **Serveur de Signalisation Node.js** pour la gestion des appels WebRTC à grande échelle.

---

## 📂 Structure des Fichiers

- `index.html` : Interface principale de l'application.
- `style.css` : Design système Quantum / Néon et structure UI.
- `app.js` : Logique client, stockage local, gestion du profil et PWA.
- `server.js` : Serveur Node.js (Socket.io) pour relayer les appels audio et vidéo WebRTC entre utilisateurs.
- `package.json` : Configuration des dépendances Node.js pour le serveur.
- `manifest.webmanifest` & `logo_evat.svg` : Assets de l'application mobile native (PWA).

---

## 🛠️ Comment Déployer et Utiliser le Tout ?

### Étape 1 : Déployer l'Application (Frontend sur Vercel)
1. Créez un dépôt sur [GitHub](https://github.com) et uploadez tous les fichiers de ce dossier (`index.html`, `style.css`, `app.js`, etc.).
2. Connectez-vous sur [Vercel](https://vercel.com) avec votre compte GitHub.
3. Cliquez sur **"Add New Project"**, sélectionnez votre dépôt et validez le déploiement.
4. Vercel vous fournira instantanément une URL HTTPS sécurisée (ex: `https://votre-app.vercel.app`) accessible partout dans le monde sur mobile et PC.

### Étape 2 : Déployer le Serveur de Signalisation (Pour des appels sans bug à l'international)
Pour que les appels audio/vidéo WebRTC passent de manière fluide entre des utilisateurs distants :
1. Créez un deuxième dépôt GitHub pour le serveur (ou placez `server.js` et `package.json` dans un dossier dédié).
2. Rendez-vous sur une plateforme cloud gratuite comme [Render](https://render.com) ou [Railway](https://railway.app).
3. Connectez votre dépôt GitHub et créez un **New Web Service**.
4. La plateforme détectera automatiquement le fichier `package.json` et lancera la commande `npm start`.
5. Copiez l'URL HTTPS fournie par Render/Railway (ex: `https://evat-signalisation.onrender.com`).
6. Dans votre application front-end (`app.js`), connectez votre client Socket.io à cette URL pour router les appels en temps réel.

### Étape 3 : Utilisation sur Mobile (PWA)
1. Ouvrez l'URL Vercel de votre application dans **Chrome** sur votre téléphone portable.
2. Appuyez sur les trois points verticaux du menu du navigateur et sélectionnez **"Installer l'application"**.
3. L'icône EVAT apparaîtra sur votre écran d'accueil, prête à être utilisée comme une application native par n'importe quel utilisateur dans le monde !
