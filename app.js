
let utilisateur = JSON.parse(localStorage.getItem('evat_profil')) || null;
let iaDejaPresentee = localStorage.getItem('elaws_presentee') === 'true';
let deferredPrompt = null;

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => {});
    });
}

let wakeLock = null;
async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
        }
    } catch (err) {}
}
document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
        await requestWakeLock();
    }
});
requestWakeLock();

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const banner = document.getElementById('installBanner');
    if(banner) banner.style.display = 'flex';
});

function declencherInstallationApp() {
    const banner = document.getElementById('installBanner');
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                if(banner) banner.style.display = 'none';
            }
            deferredPrompt = null;
        });
    } else {
        alert("Pour installer l'application, utilisez le menu de votre navigateur (Chrome / Safari) et sélectionnez 'Ajouter à l'écran d'accueil'.");
    }
}

function fermerBanniereInstall() {
    const banner = document.getElementById('installBanner');
    if(banner) banner.style.display = 'none';
}

function mettreAJourIndicatif() {
    const select = document.getElementById('selectPays');
    const telInput = document.getElementById('inputTelProfil');
    if(!select || !telInput) return;
    const prefix = select.value;
    let currentVal = telInput.value.trim();
    ['+228', '+233', '+225', '+33', '+1'].forEach(p => {
        if(currentVal.startsWith(p)) {
            currentVal = currentVal.substring(p.length);
        }
    });
    telInput.value = prefix + currentVal;
}

const socket = io(SERVER_URL, {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    timeout: 20000
});

socket.on('connect', () => {
    const statusEl = document.getElementById('serverConnectionStatus');
    if(statusEl) {
        statusEl.innerHTML = "🟢 Connecté";
        statusEl.style.color = "var(--success)";
    }
    if(utilisateur) {
        socket.emit('register_user', { nom: utilisateur.nom, telephone: utilisateur.telephone, metier: utilisateur.metier });
    }
});

socket.on('disconnect', () => {
    const statusEl = document.getElementById('serverConnectionStatus');
    if(statusEl) {
        statusEl.innerHTML = "🔴 Déconnecté";
        statusEl.style.color = "var(--danger)";
    }
});

socket.on('contact_registered', (data) => {
    if(utilisateur && utilisateur.contacts) {
        const match = utilisateur.contacts.find(c => c.telephone === data.telephone);
        if(match) {
            match.metier = data.metier;
            localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
            afficherContacts();
            montrerNotification(`🚨 Votre contact ${match.nom} (${data.telephone}) vient de s'inscrire ! Métier : ${data.metier}`);
        }
    }
});

function montrerNotification(texte) {
    const banner = document.getElementById('notificationBanner');
    const textEl = document.getElementById('notificationText');
    if(banner && textEl) {
        textEl.innerText = texte;
        banner.style.display = 'block';
        setTimeout(() => { fermerNotification(); }, 10000);
    }
}

function fermerNotification() {
    const banner = document.getElementById('notificationBanner');
    if(banner) banner.style.display = 'none';
}

function sauvegarderProfilBase() {
    const nom = document.getElementById('inputNom').value.trim();
    const tel = document.getElementById('inputTelProfil').value.trim();
    const metier = document.getElementById('inputMetier').value.trim();
    
    if(!nom || !tel) {
        alert("Veuillez remplir votre nom et votre numéro.");
        return;
    }

    utilisateur = {
        nom: nom,
        telephone: tel,
        metier: metier || "Opérateur",
        qubits: 365,
        notes: [],
        messagesLocaux: [],
        contacts: [
            { nom: "Directeur Cabinet", telephone: "+22898231401", metier: "Cosmétiques & Management" },
            { nom: "Support Technique", telephone: "+22898231402", metier: "Ingénierie Continuum" }
        ],
        historiqueElaws: [],
        parametres: {
            sonnerieType: 'iphone',
            customRingtoneBase64: null,
            vibration: true
        }
    };

    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    const welcomeModal = document.getElementById('welcomeModal');
    if(welcomeModal) welcomeModal.style.display = 'none';
    
    socket.emit('register_user', { nom: utilisateur.nom, telephone: utilisateur.telephone, metier: utilisateur.metier });
    appliquerInfosProfil();
    verifierEtSynchroniserContacts();
}

function sauvegarderProfilBaseDesdeProfil() {
    const nom = document.getElementById('inputNomProfil').value.trim();
    const tel = document.getElementById('inputTelProfil2').value.trim();
    const metier = document.getElementById('inputMetierProfil').value.trim();
    
    if(!nom || !tel) {
        alert("Le nom et le téléphone sont obligatoires.");
        return;
    }

    if(!utilisateur) utilisateur = {};
    utilisateur.nom = nom;
    utilisateur.telephone = tel;
    utilisateur.metier = metier;

    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    socket.emit('register_user', { nom: utilisateur.nom, telephone: utilisateur.telephone, metier: utilisateur.metier });
    appliquerInfosProfil();
    alert("✅ Profil mis à jour ! Vous pouvez modifier vos réglages ici à tout moment.");
}

function sauvegarderParametresApp() {
    if(!utilisateur) return;
    if(!utilisateur.parametres) utilisateur.parametres = {};
    
    const selectSon = document.getElementById('selectSonnerieType');
    if(selectSon) {
        utilisateur.parametres.sonnerieType = selectSon.value;
    }
    
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    alert("⚙️ Paramètres enregistrés !");
}

function chargerSonneriePerso(event) {
    const file = event.target.files[0];
    if(!file) return;
    if(file.size > 1024 * 1024) {
        alert("Fichier trop volumineux. Choisissez un fichier MP3 de moins de 1 Mo.");
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        if(!utilisateur.parametres) utilisateur.parametres = {};
        utilisateur.parametres.customRingtoneBase64 = e.target.result;
        utilisateur.parametres.sonnerieType = 'custom';
        localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
        alert("🎵 Sonnerie MP3 personnelle enregistrée !");
    };
    reader.readAsDataURL(file);
}

function deconnecterUtilisateur() {
    if(confirm("Voulez-vous vraiment réinitialiser et refaire l'enregistrement ?")) {
        localStorage.removeItem('evat_profil');
        localStorage.removeItem('elaws_presentee');
        iaDejaPresentee = false;
        utilisateur = null;
        fermerTousLesMenus();
        const welcomeModal = document.getElementById('welcomeModal');
        if(welcomeModal) welcomeModal.style.display = 'flex';
    }
}

function appliquerInfosProfil() {
    if(!utilisateur) return;
    if(!utilisateur.contacts) {
        utilisateur.contacts = [
            { nom: "Directeur Cabinet", telephone: "+22898231401", metier: "Cosmétiques & Management" },
            { nom: "Support Technique", telephone: "+22898231402", metier: "Ingénierie Continuum" }
        ];
    }
    if(!utilisateur.parametres) {
        utilisateur.parametres = { sonnerieType: 'iphone', customRingtoneBase64: null };
    }

    if(document.getElementById('inputNom')) document.getElementById('inputNom').value = utilisateur.nom;
    if(document.getElementById('inputNomProfil')) document.getElementById('inputNomProfil').value = utilisateur.nom;
    if(document.getElementById('inputTelProfil')) document.getElementById('inputTelProfil').value = utilisateur.telephone;
    if(document.getElementById('inputTelProfil2')) document.getElementById('inputTelProfil2').value = utilisateur.telephone;
    if(document.getElementById('inputMetier')) document.getElementById('inputMetier').value = utilisateur.metier;
    if(document.getElementById('inputMetierProfil')) document.getElementById('inputMetierProfil').value = utilisateur.metier;
    
    if(document.getElementById('sidebarUserName')) document.getElementById('sidebarUserName').innerText = utilisateur.nom;
    if(document.getElementById('sidebarUserRole')) document.getElementById('sidebarUserRole').innerText = utilisateur.metier;
    if(document.getElementById('dashUserName')) document.getElementById('dashUserName').innerText = utilisateur.nom.toUpperCase();
    if(document.getElementById('dashUserMetier')) document.getElementById('dashUserMetier').innerText = utilisateur.metier;
    if(document.getElementById('voipStatusDisplay')) document.getElementById('voipStatusDisplay').innerText = "ID : " + utilisateur.telephone;

    const selectSon = document.getElementById('selectSonnerieType');
    if(selectSon && utilisateur.parametres.sonnerieType) {
        selectSon.value = utilisateur.parametres.sonnerieType;
    }
    
    verifierEtSynchroniserContacts();
    afficherContacts();
}

function verifierEtSynchroniserContacts() {
    if(!utilisateur || !utilisateur.contacts) return;
    socket.emit('query_contacts', utilisateur.contacts.map(c => c.telephone), (reponses) => {
        if(reponses && Array.isArray(reponses)) {
            reponses.forEach(info => {
                const contact = utilisateur.contacts.find(c => c.telephone === info.telephone);
                if(contact && info.metier) contact.metier = info.metier;
            });
            localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
            afficherContacts();
        }
    });
}

function afficherContacts() {
    const container = document.getElementById('listeContactsContainer');
    if(!container || !utilisateur || !utilisateur.contacts) return;
    if(utilisateur.contacts.length === 0) {
        container.innerHTML = `<p style="color:var(--text-secondary); font-size:11.5px;">Aucun contact.</p>`;
        return;
    }
    let html = '';
    utilisateur.contacts.forEach((c, index) => {
        html += `<div style="background:var(--bg-color); border:1px solid var(--border-color); padding:10px; border-radius:10px; display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <div>
                <strong style="color:var(--accent); font-size:12.5px;">👤 ${c.nom}</strong>
                <div style="font-size:11px; color:var(--text-secondary);">📞 ${c.telephone} • <i style="color:var(--success);">${c.metier || 'Sync...'}</i></div>
            </div>
            <div style="display:flex; gap:4px; flex-wrap:wrap; justify-content:flex-end;">
                <button onclick="preparerAppel('${c.telephone}')" class="btn-action" style="background:var(--success); color:#fff; padding:5px 8px; font-size:10.5px;" title="Appeler">📞</button>
                <button onclick="ecrireAuContact('${c.nom}', '${c.telephone}')" class="btn-action" style="background:var(--accent); color:#030712; padding:5px 8px; font-size:10.5px;" title="Écrire">💬</button>
                <button onclick="modifierContact(${index})" class="btn-action" style="background:rgba(59,130,246,0.2); color:var(--accent); border:1px solid var(--accent); padding:5px 8px; font-size:10.5px;" title="Modifier">✏️</button>
                <button onclick="supprimerContact(${index})" class="btn-action" style="background:rgba(239,68,68,0.2); color:#ef4444; border:1px solid #ef4444; padding:5px 8px; font-size:10.5px;" title="Supprimer">🗑️</button>
            </div>
        </div>`;
    });
    container.innerHTML = html;
}

function ajouterNouveauContact() {
    const nom = document.getElementById('nouveauNomContact').value.trim();
    const tel = document.getElementById('nouveauTelContact').value.trim();
    if(!nom || !tel) {
        alert("Nom et numéro obligatoires.");
        return;
    }
    if(!utilisateur.contacts) utilisateur.contacts = [];
    utilisateur.contacts.push({ nom, telephone: tel, metier: "Recherche..." });
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    document.getElementById('nouveauNomContact').value = '';
    document.getElementById('nouveauTelContact').value = '';
    afficherContacts();
    verifierEtSynchroniserContacts();
    alert("✅ Contact enregistré !");
}

function modifierContact(index) {
    const c = utilisateur.contacts[index];
    const nouveauNom = prompt("Modifier le nom :", c.nom);
    if(nouveauNom === null) return;
    const nouveauTel = prompt("Modifier le numéro :", c.telephone);
    if(nouveauTel === null) return;
    utilisateur.contacts[index].nom = nouveauNom.trim();
    utilisateur.contacts[index].telephone = nouveauTel.trim();
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    afficherContacts();
    verifierEtSynchroniserContacts();
}

function supprimerContact(index) {
    if(confirm("Supprimer ce contact ?")) {
        utilisateur.contacts.splice(index, 1);
        localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
        afficherContacts();
    }
}

function ecrireAuContact(nom, tel) {
    const message = prompt(`Message à ${nom} (${tel}) :`);
    if(!message) return;
    if(!utilisateur.messagesLocaux) utilisateur.messagesLocaux = [];
    utilisateur.messagesLocaux.push({ expediteur: utilisateur.nom || "Moi", texte: `À ${nom} : ${message}`, heure: new Date().toLocaleTimeString() });
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    switchTab('messagerie');
    alert("✅ Message enregistré !");
}

function preparerAppel(tel) {
    switchTab('communications');
    document.getElementById('appelCibleNum').value = tel;
}

function basculerEcouteVocaleIA() {
    const statusEl = document.getElementById('micStatusElaws');
    const inputEl = document.getElementById('elawsInput');
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert("Reconnaissance vocale non supportée.");
        return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    if(statusEl) statusEl.innerText = "🎙️ Écoute...";
    
    recognition.onresult = (event) => {
        inputEl.value = event.results[0][0].transcript;
        if(statusEl) statusEl.innerText = "";
        // Réponse instantanée dès la fin de la parole
        poserQuestionElaws();
    };
    recognition.onerror = () => { if(statusEl) statusEl.innerText = ""; };
    recognition.onend = () => { if(statusEl) statusEl.innerText = ""; };
    
    recognition.start();
}

// ========== ELAWS FORMATION PRATIQUE ÉTENDUE ==========
let elawsBusy = false;
let elawsHistory = [];
let elawsMode = 'chat';

const PARCOURS_FORMATION = {
  commerce: { titre: 'Commerce & Vente', modules: [
    { id:'c1', titre:'Accueillir le client', duree:'10 min', lecon:'1) Saluez.\n2) Question ouverte sur le besoin.\n3) Reformulez.\n4) Proposez 1–2 options avec prix.\n5) Concluez (paiement + remerciement).\n\nAstuce: un client écouté achète plus facilement.', exercice:'Écris ta phrase d’accueil + 2 questions ouvertes.' },
    { id:'c2', titre:'Prix et marge', duree:'12 min', lecon:'Prix = coût total + marge.\nCoût = achat + transport + pertes.\nExemple: coût 700, marge 30% → prix ≈ 1000.\nNe vends jamais sous ton coût réel.', exercice:'Calcule le prix de 3 produits avec 25% de marge.' },
    { id:'c3', titre:'Fidéliser', duree:'10 min', lecon:'Qualité constante, souvenir du client, petit suivi, offre régulier, demande de recommandation.', exercice:'1 geste de fidélisation pour demain.' },
    { id:'c4', titre:'Gérer les objections', duree:'12 min', lecon:'Écoute → reconnais → réponds par un fait → propose une alternative.\n« C’est cher » → montre la durée / la qualité / une option plus légère.', exercice:'Réponds à « c’est trop cher » pour ton produit principal.' },
    { id:'c5', titre:'Vente du jour', duree:'8 min', lecon:'Objectif du jour (montant ou nombre de ventes).\nMidi: point intermédiaire.\nSoir: bilan 3 lignes.', exercice:'Fixe ton objectif ventes pour demain.' }
  ]},
  agri: { titre: 'Agriculture de terrain', modules: [
    { id:'a1', titre:'Plan de saison', duree:'15 min', lecon:'Pluies/sèche → 1–2 cultures prioritaires → budget semences/main-d’œuvre → calendrier semis/entretien/récolte → réserve 10–15%.', exercice:'Calendrier des 3 prochains mois.' },
    { id:'a2', titre:'Coûts et récolte', duree:'10 min', lecon:'Note dépenses chaque semaine. À la récolte: quantité + prix. Bénéfice = ventes − dépenses.', exercice:'Liste 5 dépenses récentes.' },
    { id:'a3', titre:'Stockage et perte', duree:'10 min', lecon:'Séchage, propreté, protection humidité/rongeurs. Une bonne conservation = revenu sauvé.', exercice:'Où et comment stockes-tu aujourd’hui ? 1 amélioration.' },
    { id:'a4', titre:'Vendre la récolte', duree:'12 min', lecon:'Connais 3 prix de marché. Évite de tout vendre le même jour au plus bas. Négocie volume + qualité.', exercice:'Note 3 prix observés cette semaine.' }
  ]},
  artisan: { titre: 'Artisanat & BTP', modules: [
    { id:'ar1', titre:'Devis en 5 lignes', duree:'12 min', lecon:'Description, main-d’œuvre, matériaux, total + délai, acompte/reste.', exercice:'Mini-devis pour un job typique.' },
    { id:'ar2', titre:'Chantier organisé', duree:'10 min', lecon:'Avant: matériaux, outils, accord. Pendant: étapes + notes. Après: contrôle client + paiement.', exercice:'Checklist avant démarrage.' },
    { id:'ar3', titre:'Sécurité basique', duree:'8 min', lecon:'EPI adaptés, zone rangée, couper le courant si besoin, ne jamais précipiter une fin de journée risquée.', exercice:'3 risques sur ton prochain chantier + parade.' },
    { id:'ar4', titre:'Client difficile', duree:'10 min', lecon:'Écrit (devis signé), photos avant/après, acomptes, rester calme, proposer options pas des excuses.', exercice:'Phrase type pour demander un acompte.' }
  ]},
  admin: { titre: 'Administration efficace', modules: [
    { id:'ad1', titre:'3 priorités du jour', duree:'8 min', lecon:'1 critique, 1 importante, 1 utile. Focus 25 min / pause 5 min.', exercice:'Tes 3 priorités demain.' },
    { id:'ad2', titre:'Message pro court', duree:'10 min', lecon:'Salut – pourquoi – demande claire – remerciement – signature.', exercice:'Message de 5–7 lignes pour une demande réelle.' },
    { id:'ad3', titre:'Classer pour retrouver', duree:'10 min', lecon:'Dossiers: En cours / À relancer / Archivé. Nomme fichiers: DATE_sujet.', exercice:'3 dossiers que tu crées cette semaine.' },
    { id:'ad4', titre:'Réunion utile', duree:'10 min', lecon:'Objectif, durée, décisions, responsables, deadline. Sinon ce n’est pas une réunion.', exercice:'Ordre du jour en 4 lignes.' }
  ]},
  tech: { titre: 'Tech pratique', modules: [
    { id:'t1', titre:'Débugger méthodiquement', duree:'12 min', lecon:'Reproduire → message exact → isolé le changement → 1 hypothèse à la fois → noter la fix.', exercice:'Un bug récent et ta méthode.' },
    { id:'t2', titre:'Livrer petit', duree:'15 min', lecon:'Objectif user → critères « terminé » → tâches → test → livraison.', exercice:'3 critères de fin pour une feature.' },
    { id:'t3', titre:'Sauvegarder', duree:'8 min', lecon:'Backup avant changement risqué. Versionne. Documente en 2 lignes.', exercice:'Où est ton dernier backup ?' },
    { id:'t4', titre:'Expliquer technique simplement', duree:'10 min', lecon:'Problème → impact → solution en langage non technique → prochaine étape.', exercice:'Explique un souci technique à un non-tech.' }
  ]},
  entrepreneur: { titre: 'Entrepreneuriat terrain', modules: [
    { id:'e1', titre:'Offre en une phrase', duree:'10 min', lecon:'J’aide [qui] à [résultat] grâce à [offre].', exercice:'Ta phrase d’offre.' },
    { id:'e2', titre:'Trésorerie simple', duree:'12 min', lecon:'Entrées, sorties, solde chaque semaine. Réserve 2–4 semaines de charges.', exercice:'Estime entrées/sorties du mois.' },
    { id:'e3', titre:'Trouver des clients', duree:'12 min', lecon:'Liste 20 contacts. Message clair. Suivi J+3. Compte les réponses, pas les espoirs.', exercice:'5 personnes à contacter cette semaine.' },
    { id:'e4', titre:'Augmenter le panier', duree:'10 min', lecon:'Produit principal + option complémentaire utile. Jamais forcer: proposer.', exercice:'1 vente additionnelle possible demain.' }
  ]},
  education: { titre: 'Transmission', modules: [
    { id:'ed1', titre:'Séance 30 min', duree:'12 min', lecon:'Objectif – accroche – activité – pratique – feedback.', exercice:'Plan d’une séance 30 min.' },
    { id:'ed2', titre:'Faire pratiquer', duree:'10 min', lecon:'Moins de monologue, plus d’exercice. Corrige 1 point à la fois.', exercice:'1 exercice pour ton prochain cours.' },
    { id:'ed3', titre:'Évaluer simplement', duree:'10 min', lecon:'Grille: compréhension, application, participation, autonomie (0–5).', exercice:'Note un apprenant fictif sur 4 critères.' }
  ]},
  sante: { titre: 'Organisation soin / bien-être', modules: [
    { id:'s1', titre:'Accueil et écoute', duree:'10 min', lecon:'Accueil calme, écoute active, reformulation, limite de ton rôle (pas de diagnostic hors cadre).', exercice:'Phrase d’accueil professionnelle.' },
    { id:'s2', titre:'Agenda de journée', duree:'8 min', lecon:'Créneaux, pauses, urgences possibles. Évite le surbook.', exercice:'Découpe ta prochaine journée en créneaux.' },
    { id:'s3', titre:'Hygiène et matériel', duree:'8 min', lecon:'Checklist ouverture/fermeture, stock mini, expiration.', exercice:'Ta checklist d’ouverture.' }
  ]},
  transport: { titre: 'Transport & livraison', modules: [
    { id:'tr1', titre:'Feuille de route', duree:'10 min', lecon:'Ordre des arrêts, contacts, carburant, imprévus 15%.', exercice:'Route type pour demain.' },
    { id:'tr2', titre:'Relation client livraison', duree:'8 min', lecon:'Appel avant arrivée si possible, preuve de remise, politesse = pourboire/fidélité.', exercice:'SMS type « j’arrive dans 15 min ».' },
    { id:'tr3', titre:'Entretien véhicule', duree:'8 min', lecon:'Niveaux, pneus, freins, carnet de dates. Panne = perte de revenus.', exercice:'Prochain entretien à planifier.' }
  ]},
  general: { titre: 'Compétences universelles', modules: [
    { id:'g1', titre:'Apprendre en faisant', duree:'8 min', lecon:'Observer → essayer → noter → recommencer. 15 min de pratique > 1 h passive.', exercice:'Pratique de 15 min aujourd’hui.' },
    { id:'g2', titre:'Parler clair', duree:'10 min', lecon:'Qui, quoi, quand, résultat attendu.', exercice:'Réécris un message flou en clair.' },
    { id:'g3', titre:'Gérer le stress', duree:'8 min', lecon:'Respiration 4-4-4, une tâche à la fois, demander de l’aide tôt.', exercice:'Ta technique anti-stress en 1 ligne.' },
    { id:'g4', titre:'Épargner un peu', duree:'10 min', lecon:'Règle 10%: mets de côté avant de dépenser si possible. Objectif nommé.', exercice:'Montant et objectif d’épargne du mois.' }
  ]}
};

const QUIZ_FORMATION = {
  c2: { q: 'Si ton coût total est 800 et tu veux 25% de marge sur le prix, prix ≈ ?', options: ['1000', '1050', '800', '1200'], ok: 0 },
  e1: { q: 'Une bonne offre répond surtout à :', options: ['Ton ego', 'Le résultat pour le client', 'Le logo', 'Le concurrent'], ok: 1 },
  ad1: { q: 'Combien de priorités max le matin ?', options: ['10', '3', '1 seule jamais', '20'], ok: 1 },
  g1: { q: 'Le meilleur moyen d’apprendre un geste :', options: ['Lire 3h', 'Pratiquer en cycles courts', 'Attendre d’être parfait', 'Regarder sans faire'], ok: 1 }
};

function detecterParcoursFormation(metier) {
  const m = (metier || '').toLowerCase();
  if (/commerc|vente|vendeur|boutique|magasin|retail/.test(m)) return 'commerce';
  if (/agri|élev|ferme|culture|pêche/.test(m)) return 'agri';
  if (/artisan|maçonn|plomb|électric|menuis|btp|mécanicien|chantier/.test(m)) return 'artisan';
  if (/admin|secrét|comptable|bureau|rh|assistant/.test(m)) return 'admin';
  if (/dev|info|tech|program|software|réseau|data|ingénieur/.test(m)) return 'tech';
  if (/entrepr|business|startup|freelance|commerçant/.test(m)) return 'entrepreneur';
  if (/enseign|prof|formateur|éduc|coach|tuteur/.test(m)) return 'education';
  if (/santé|médic|infirm|pharmac|soin|thérapie/.test(m)) return 'sante';
  if (/transport|chauffeur|livreur|logistique|taxi/.test(m)) return 'transport';
  return 'general';
}

function getProgressionFormation() {
  if (!utilisateur) return { termines: [], notes: {}, quiz: {} };
  if (!utilisateur.formation) utilisateur.formation = { termines: [], notes: {}, quiz: {} };
  if (!utilisateur.formation.termines) utilisateur.formation.termines = [];
  if (!utilisateur.formation.notes) utilisateur.formation.notes = {};
  if (!utilisateur.formation.quiz) utilisateur.formation.quiz = {};
  return utilisateur.formation;
}
function sauvegarderFormation() {
  if (utilisateur) localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
}

function pratiqueDuJour() {
  const key = detecterParcoursFormation(utilisateur?.metier);
  const p = PARCOURS_FORMATION[key] || PARCOURS_FORMATION.general;
  const prog = getProgressionFormation();
  const rest = p.modules.filter(m => !prog.termines.includes(m.id));
  const mod = rest[0] || p.modules[p.modules.length - 1];
  return mod;
}

function afficherFormationPratique() {
  const box = document.getElementById('formationContainer');
  if (!box || !utilisateur) return;
  const key = detecterParcoursFormation(utilisateur.metier);
  const parcours = PARCOURS_FORMATION[key] || PARCOURS_FORMATION.general;
  const prog = getProgressionFormation();
  const total = parcours.modules.length;
  const done = parcours.modules.filter(m => prog.termines.includes(m.id)).length;
  const pct = total ? Math.round(done / total * 100) : 0;
  const jour = pratiqueDuJour();

  let html = `<div style="margin-bottom:14px; padding:12px; border-radius:12px; border:1px solid var(--border-color); background:rgba(16,185,129,0.08);">
    <strong style="color:var(--success);">🎯 Pratique du jour</strong>
    <div style="font-size:12.5px; margin-top:4px;">${jour.titre} · ${jour.duree}</div>
    <button onclick="lancerModuleFormation('${key}','${jour.id}')" class="btn-action" style="margin-top:8px; background:linear-gradient(135deg,#10b981,#059669); font-size:12px;">Commencer</button>
  </div>`;

  html += `<div style="margin-bottom:12px;">
    <strong style="color:var(--accent);">📚 ${parcours.titre}</strong>
    <div style="font-size:11px; color:var(--text-secondary);">${utilisateur.metier || 'Activité'} · ${done}/${total} (${pct}%)</div>
    <div style="height:6px; background:rgba(56,189,248,0.15); border-radius:4px; margin-top:8px;"><div style="height:100%; width:${pct}%; background:linear-gradient(90deg,#0ea5e9,#34d399); border-radius:4px;"></div></div>
  </div>`;

  // Switch parcours
  html += `<label style="font-size:11px;">Autre parcours</label>
  <select id="selectParcoursFormation" class="input" onchange="changerParcoursFormation(this.value)" style="margin-bottom:12px;">
    ${Object.keys(PARCOURS_FORMATION).map(k => `<option value="${k}" ${k===key?'selected':''}>${PARCOURS_FORMATION[k].titre}</option>`).join('')}
  </select>`;

  parcours.modules.forEach((mod, i) => {
    const ok = prog.termines.includes(mod.id);
    const hasQuiz = !!QUIZ_FORMATION[mod.id];
    html += `<div style="border:1px solid var(--border-color); border-radius:12px; padding:12px; margin-bottom:8px;">
      <strong style="font-size:13px;">${ok?'✅ ':(i+1)+'. '}${mod.titre}</strong>
      <div style="font-size:11px; color:var(--text-secondary);">${mod.duree}</div>
      <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">
        <button onclick="lancerModuleFormation('${key}','${mod.id}')" class="btn-action" style="width:auto;padding:7px 10px;font-size:11px;">Leçon</button>
        <button onclick="demanderCoachElaws('${key}','${mod.id}')" class="btn-action" style="width:auto;padding:7px 10px;font-size:11px;background:rgba(56,189,248,0.15);color:var(--accent);border:1px solid var(--border-color);box-shadow:none;">Coach</button>
        ${hasQuiz?`<button onclick="lancerQuizFormation('${mod.id}')" class="btn-action" style="width:auto;padding:7px 10px;font-size:11px;background:rgba(251,191,36,0.15);color:#fbbf24;border:1px solid rgba(251,191,36,0.4);box-shadow:none;">Quiz</button>`:''}
        ${!ok?`<button onclick="marquerModuleTermine('${mod.id}')" class="btn-action" style="width:auto;padding:7px 10px;font-size:11px;background:linear-gradient(135deg,#10b981,#059669);">Terminé</button>`:''}
      </div>
    </div>`;
  });

  html += `<div id="formationLeconActive" style="margin-top:12px;"></div>`;
  if (pct === 100) {
    html += `<div style="margin-top:12px; padding:12px; border-radius:12px; border:1px solid var(--success); text-align:center;">
      <strong style="color:var(--success);">🏆 Parcours terminé</strong>
      <p style="font-size:12px; margin:6px 0 0 0;">Tu as validé ${parcours.titre}. Choisis un autre parcours ou révise avec le coach ELAWS.</p>
    </div>`;
  }
  box.innerHTML = html;
}

function changerParcoursFormation(key) {
  // temporary override via session
  window._parcoursOverride = key;
  const box = document.getElementById('formationContainer');
  if (!box || !utilisateur) return;
  const parcours = PARCOURS_FORMATION[key] || PARCOURS_FORMATION.general;
  const prog = getProgressionFormation();
  // re-render with override: monkey patch detect for this view
  const real = detecterParcoursFormation;
  // manual render similar - just set metier hint
  const old = utilisateur.metier;
  const mapHint = { commerce:'Commerce', agri:'Agriculture', artisan:'Artisan', admin:'Administration', tech:'Informatique', entrepreneur:'Entrepreneur', education:'Formateur', sante:'Santé', transport:'Transport', general:'Général' };
  utilisateur.metier = mapHint[key] || old;
  afficherFormationPratique();
  utilisateur.metier = old;
  // fix select after re-render
  setTimeout(() => {
    const sel = document.getElementById('selectParcoursFormation');
    if (sel) sel.value = key;
    // re-bind modules to key - call custom
    afficherFormationPourCle(key);
  }, 0);
}

function afficherFormationPourCle(key) {
  const box = document.getElementById('formationContainer');
  if (!box || !utilisateur) return;
  const parcours = PARCOURS_FORMATION[key] || PARCOURS_FORMATION.general;
  const prog = getProgressionFormation();
  const total = parcours.modules.length;
  const done = parcours.modules.filter(m => prog.termines.includes(m.id)).length;
  const pct = total ? Math.round(done/total*100) : 0;
  const jour = parcours.modules.find(m => !prog.termines.includes(m.id)) || parcours.modules[0];
  let html = `<div style="margin-bottom:14px; padding:12px; border-radius:12px; border:1px solid var(--border-color); background:rgba(16,185,129,0.08);">
    <strong style="color:var(--success);">🎯 Pratique du jour</strong>
    <div style="font-size:12.5px; margin-top:4px;">${jour.titre}</div>
    <button onclick="lancerModuleFormation('${key}','${jour.id}')" class="btn-action" style="margin-top:8px; background:linear-gradient(135deg,#10b981,#059669); font-size:12px;">Commencer</button>
  </div>
  <div style="margin-bottom:12px;"><strong style="color:var(--accent);">📚 ${parcours.titre}</strong>
  <div style="font-size:11px; color:var(--text-secondary);">${done}/${total} (${pct}%)</div>
  <div style="height:6px; background:rgba(56,189,248,0.15); border-radius:4px; margin-top:8px;"><div style="height:100%; width:${pct}%; background:linear-gradient(90deg,#0ea5e9,#34d399); border-radius:4px;"></div></div></div>
  <label style="font-size:11px;">Parcours</label>
  <select id="selectParcoursFormation" class="input" onchange="afficherFormationPourCle(this.value)" style="margin-bottom:12px;">
    ${Object.keys(PARCOURS_FORMATION).map(k => `<option value="${k}" ${k===key?'selected':''}>${PARCOURS_FORMATION[k].titre}</option>`).join('')}
  </select>`;
  parcours.modules.forEach((mod,i) => {
    const ok = prog.termines.includes(mod.id);
    const hasQuiz = !!QUIZ_FORMATION[mod.id];
    html += `<div style="border:1px solid var(--border-color); border-radius:12px; padding:12px; margin-bottom:8px;">
      <strong>${ok?'✅ ':(i+1)+'. '}${mod.titre}</strong>
      <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">
        <button onclick="lancerModuleFormation('${key}','${mod.id}')" class="btn-action" style="width:auto;padding:7px 10px;font-size:11px;">Leçon</button>
        <button onclick="demanderCoachElaws('${key}','${mod.id}')" class="btn-action" style="width:auto;padding:7px 10px;font-size:11px;background:rgba(56,189,248,0.15);color:var(--accent);border:1px solid var(--border-color);box-shadow:none;">Coach</button>
        ${hasQuiz?`<button onclick="lancerQuizFormation('${mod.id}')" class="btn-action" style="width:auto;padding:7px 10px;font-size:11px;background:rgba(251,191,36,0.15);color:#fbbf24;border:1px solid rgba(251,191,36,0.4);box-shadow:none;">Quiz</button>`:''}
        ${!ok?`<button onclick="marquerModuleTermine('${mod.id}')" class="btn-action" style="width:auto;padding:7px 10px;font-size:11px;background:linear-gradient(135deg,#10b981,#059669);">Terminé</button>`:''}
      </div></div>`;
  });
  html += `<div id="formationLeconActive" style="margin-top:12px;"></div>`;
  box.innerHTML = html;
}

function lancerModuleFormation(parcoursKey, moduleId) {
  const parcours = PARCOURS_FORMATION[parcoursKey] || PARCOURS_FORMATION.general;
  const mod = parcours.modules.find(m => m.id === moduleId);
  if (!mod) return;
  const zone = document.getElementById('formationLeconActive');
  if (!zone) return;
  zone.innerHTML = `<div style="border:1px solid var(--accent); border-radius:12px; padding:14px; background:rgba(56,189,248,0.08);">
    <strong style="color:var(--accent);">${mod.titre}</strong>
    <pre style="white-space:pre-wrap; font-family:inherit; font-size:12.5px; line-height:1.5; margin:10px 0;">${mod.lecon}</pre>
    <button onclick="soumettreExerciceFormation('${parcoursKey}','${moduleId}')" class="btn-action" style="background:linear-gradient(135deg,#10b981,#059669);">✍️ Soumettre l’exercice</button>
  </div>`;
  zone.scrollIntoView({ behavior:'smooth', block:'nearest' });
}

function marquerModuleTermine(moduleId) {
  const prog = getProgressionFormation();
  if (!prog.termines.includes(moduleId)) prog.termines.push(moduleId);
  sauvegarderFormation();
  afficherFormationPratique();
}

function soumettreExerciceFormation(parcoursKey, moduleId) {
  const parcours = PARCOURS_FORMATION[parcoursKey] || PARCOURS_FORMATION.general;
  const mod = parcours.modules.find(m => m.id === moduleId);
  if (!mod) return;
  const reponse = prompt('Exercice :\\n' + mod.exercice);
  if (reponse === null || !reponse.trim()) return;
  const prog = getProgressionFormation();
  prog.notes[moduleId] = reponse.trim();
  if (!prog.termines.includes(moduleId)) prog.termines.push(moduleId);
  sauvegarderFormation();
  elawsMode = 'formation';
  switchTab('elaws-ia');
  const input = document.getElementById('elawsInput');
  if (input) {
    input.value = `Corrige mon exercice « ${mod.titre} ». Consignes: ${mod.exercice}. Ma réponse: ${reponse.trim()}. Feedback pratique en 4–6 phrases, sans répéter ma réponse en entier.`;
    poserQuestionElaws();
  }
}

function demanderCoachElaws(parcoursKey, moduleId) {
  const parcours = PARCOURS_FORMATION[parcoursKey] || PARCOURS_FORMATION.general;
  const mod = parcours.modules.find(m => m.id === moduleId);
  if (!mod) return;
  elawsMode = 'formation';
  switchTab('elaws-ia');
  const input = document.getElementById('elawsInput');
  if (input) {
    input.value = `Formateur pratique. Module « ${mod.titre} ». 5 étapes max + mini-exercice pour mon métier (${utilisateur?.metier||'mon activité'}). Direct, sans blabla.`;
    poserQuestionElaws();
  }
}

function lancerQuizFormation(moduleId) {
  const quiz = QUIZ_FORMATION[moduleId];
  if (!quiz) return;
  const opts = quiz.options.map((o,i) => (i+1)+'. '+o).join('\\n');
  const choix = prompt(quiz.q + '\\n\\n' + opts + '\\n\\nNuméro ?');
  const idx = parseInt(choix,10)-1;
  const prog = getProgressionFormation();
  if (idx === quiz.ok) {
    prog.quiz[moduleId] = true;
    if (!prog.termines.includes(moduleId)) prog.termines.push(moduleId);
    sauvegarderFormation();
    alert('Correct ✅');
  } else {
    prog.quiz[moduleId] = false;
    sauvegarderFormation();
    alert('Pas tout à fait. Revois la leçon puis réessaie.');
  }
  afficherFormationPratique();
}

function echapperHtml(s){ const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
function nettoyerReponseIA(texte, question) {
  if (!texte) return texte;
  let t = texte.trim().replace(/^(ELAWS\\s*(AI)?\\s*[:\\-–—]\\s*)/i,'').replace(/^(Réponse\\s*[:\\-–—]\\s*)/i,'');
  [/^j'ai bien (reçu|compris|noté)[^.!]*[.!]?\\s*/i, /^concernant (ta|votre|la) question[^.!]*[.!]?\\s*/i, /^tu (as|m'as) (demandé|posé)[^.!]*[.!]?\\s*/i].forEach(re => { t=t.replace(re,''); });
  return t.trim()||texte.trim();
}
function reponseLocaleFormation(question, profil) {
  const q=(question||'').toLowerCase();
  if (/bonjour|salut|hello/.test(q)) return 'On enchaîne. Que veux-tu apprendre à faire concrètement ?';
  if (/exercice|corrige|feedback/.test(q)) return 'Vérifie si c’est actionnable demain et mesurable. Si oui, module validé. Sinon, raccourcis en une action claire.';
  if (/formation|module|apprendre/.test(q)) return 'Ouvre Formation pratique : leçon → exercice → feedback. Ou décris le geste à maîtriser.';
  return 'Réseau limité. Utilise Formation pratique hors-ligne, ou réessaie pour un coaching détaillé.';
}
async function appelerIAMondiale(question, profil) {
  const prenom = profil?.nom ? profil.nom.split(' ')[0] : 'toi';
  const metier = profil?.metier || 'activité de terrain';
  const modeFormation = elawsMode==='formation' || /exercice|corrige|formateur|module|leçon|apprendre|entraîne|coach/i.test(question);
  const systemPrompt = modeFormation
    ? `Tu es ELAWS, formateur pratique EVAT. Réponds UNIQUEMENT le contenu utile, sans répéter la question. Méthode + exemple + mini-exercice. 4–8 phrases/étapes. Métier: ${metier}. Prénom: ${prenom}. Feedback exigeant et clair.`
    : `Tu es ELAWS. Réponds comme un humain compétent et direct. Ne répète jamais la question. Métier: ${metier}. Si on parle d’apprendre, sois formateur pratique.`;
  const messages = [{role:'system', content:systemPrompt}];
  elawsHistory.slice(-8).forEach(m=>messages.push(m));
  messages.push({role:'user', content:question});
  try {
    const ctrl=new AbortController(); const t=setTimeout(()=>ctrl.abort(),28000);
    const res=await fetch('https://text.pollinations.ai/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages,model:'openai',seed:Math.floor(Math.random()*99999)}),signal:ctrl.signal});
    clearTimeout(t);
    if(res.ok){ let text=(await res.text()).trim(); text=nettoyerReponseIA(text,question); if(text.length>3) return text; }
  } catch(e){}
  try {
    const prompt=encodeURIComponent(systemPrompt+'\\n\\nUtilisateur: '+question+'\\nELAWS:');
    const ctrl2=new AbortController(); const t2=setTimeout(()=>ctrl2.abort(),20000);
    const res2=await fetch('https://text.pollinations.ai/'+prompt+'?model=openai',{signal:ctrl2.signal});
    clearTimeout(t2);
    if(res2.ok){ let text2=(await res2.text()).trim(); text2=nettoyerReponseIA(text2,question); if(text2.length>3) return text2; }
  } catch(e){}
  return reponseLocaleFormation(question, profil);
}
async function poserQuestionElaws() {
  const input=document.getElementById('elawsInput');
  const question=(input?.value||'').trim();
  if(!question||!utilisateur||elawsBusy) return;
  const chatBox=document.getElementById('elawsChatBox'); if(!chatBox) return;
  elawsBusy=true;
  chatBox.innerHTML+=`<div style="background:rgba(255,255,255,0.05);padding:10px;border-radius:10px;text-align:right;"><strong style="color:var(--success);font-size:12px;">👤 ${echapperHtml(utilisateur.nom)}</strong><p style="margin:4px 0 0 0;font-size:12.5px;">${echapperHtml(question)}</p></div>`;
  input.value=''; chatBox.scrollTop=chatBox.scrollHeight;
  const loadingId='elaws-load-'+Date.now();
  chatBox.innerHTML+=`<div id="${loadingId}" style="background:rgba(56,189,248,0.1);border:1px solid var(--border-color);padding:10px;border-radius:10px;"><strong style="color:var(--accent);font-size:12px;">🤖 ELAWS</strong><p style="font-size:12px;margin:6px 0 0;color:var(--text-secondary);">Réflexion…</p></div>`;
  let reponse='';
  try { reponse=await appelerIAMondiale(question,utilisateur); } catch(e){ reponse=reponseLocaleFormation(question,utilisateur); }
  elawsHistory.push({role:'user',content:question}); elawsHistory.push({role:'assistant',content:reponse});
  if(elawsHistory.length>20) elawsHistory=elawsHistory.slice(-16);
  const html=`<div style="background:rgba(56,189,248,0.1);border:1px solid var(--border-color);padding:10px;border-radius:10px;"><strong style="color:var(--accent);font-size:12px;">🤖 ELAWS</strong><p style="margin:4px 0 0;font-size:12.5px;line-height:1.5;white-space:pre-wrap;">${echapperHtml(reponse)}</p></div>`;
  const el=document.getElementById(loadingId); if(el) el.outerHTML=html; else chatBox.innerHTML+=html;
  chatBox.scrollTop=chatBox.scrollHeight; elawsBusy=false; elawsMode='chat';
}

function toggleMenu(e) {
    if(e) { e.stopPropagation(); e.preventDefault(); }
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('appOverlay');
    if(sidebar && overlay) {
        const isOpen = sidebar.classList.toggle('open');
        if(isOpen) overlay.classList.add('active');
        else overlay.classList.remove('active');
    }
}

function fermerTousLesMenus() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('appOverlay');
    if(sidebar) sidebar.classList.remove('open');
    if(overlay) overlay.classList.remove('active');
}

let mapInstance = null;
let userMarker = null;

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    const target = document.getElementById('tab-' + tabId);
    if(target) target.style.display = 'block';
    const link = document.getElementById('link-' + tabId);
    if(link) link.classList.add('active');
    fermerTousLesMenus();

    if(tabId === 'contacts') afficherContacts();
    if(tabId === 'formation') afficherFormationPratique();
    if(tabId === 'map') {
        setTimeout(() => {
            if(!mapInstance) {
                mapInstance = L.map('mapContainer').setView([6.1375, 1.2123], 13);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(mapInstance);
            } else {
                mapInstance.invalidateSize();
            }
        }, 200);
    }
}

function centrerSurMoi() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            if(mapInstance) {
                mapInstance.setView([lat, lng], 15);
                if(userMarker) mapInstance.removeLayer(userMarker);
                userMarker = L.marker([lat, lng]).addTo(mapInstance).bindPopup("<b>📍 Vous êtes ici</b>").openPopup();
            }
        });
    }
}

function partagerMaPositionGPS() {
    if (navigator.geolocation && utilisateur) {
        navigator.geolocation.getCurrentPosition(position => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            socket.emit('signal', { type: 'location', sender: utilisateur.nom, lat, lng });
            alert("Position partagée !");
        });
    }
}

socket.on('signal', (data) => {
    if (data.type === 'location' && mapInstance) {
        L.marker([data.lat, data.lng]).addTo(mapInstance).bindPopup(`<b>📍 ${data.sender}</b>`);
    }
});

function envoyerMessageChatLocal() {
    const input = document.getElementById('chatLocalInput');
    const texte = input.value.trim();
    if(!texte || !utilisateur) return;
    if(!utilisateur.messagesLocaux) utilisateur.messagesLocaux = [];
    utilisateur.messagesLocaux.push({ expediteur: utilisateur.nom || "Moi", texte, heure: new Date().toLocaleTimeString() });
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    input.value = '';
    afficherMessagesLocaux();
}

function afficherMessagesLocaux() {
    const container = document.getElementById('listeMessagesLocaux');
    if(!container || !utilisateur || !utilisateur.messagesLocaux) return;
    let html = '';
    utilisateur.messagesLocaux.forEach(m => {
        html += `<div style="background:var(--bg-color); border:1px solid var(--border-color); padding:8px; border-radius:8px; margin-bottom:6px;"><div style="font-size:10px; color:var(--accent);">👤 ${m.expediteur} • ${m.heure}</div><p style="margin:3px 0 0 0; font-size:12px;">${m.texte}</p></div>`;
    });
    container.innerHTML = html;
}

function ajouterNoteBlocNotes() {
    const titre = document.getElementById('noteTitre').value.trim();
    const contenu = document.getElementById('noteContenu').value.trim();
    if(!titre || !contenu || !utilisateur) return;
    if(!utilisateur.notes) utilisateur.notes = [];
    utilisateur.notes.unshift({ titre, contenu });
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    document.getElementById('noteTitre').value = '';
    document.getElementById('noteContenu').value = '';
    afficherNotesBlocNotes();
}

function afficherNotesBlocNotes() {
    const container = document.getElementById('listeNotesContainer');
    if(!container || !utilisateur || !utilisateur.notes) return;
    let html = '';
    utilisateur.notes.forEach(n => {
        html += `<div style="background:var(--bg-color); border:1px solid var(--border-color); padding:10px; border-radius:10px; margin-bottom:8px;"><strong style="color:var(--accent);">📌 ${n.titre}</strong><p style="margin:3px 0; font-size:12px;">${n.contenu}</p></div>`;
    });
    container.innerHTML = html;
}

function genererPlanSucces1000() {
    const obj = document.getElementById('inputObjectif1000').value.trim();
    const container = document.getElementById('resultatPlan1000');
    if(!obj) return;
    container.style.display = 'block';
    container.innerHTML = `<div style="background:var(--bg-color); padding:12px; border-radius:12px; border:1px solid var(--success);"><h4 style="color:var(--success);">🚀 ${obj}</h4><p style="font-size:12px;">Plan en cours d'exécution.</p></div>`;
}

function lancerAnalyseVoyageAvance() {
    const dest = document.getElementById('voyageDestination').value.trim();
    const container = document.getElementById('resultatAssistantVoyage');
    if(!dest) return;
    container.style.display = 'block';
    container.innerHTML = `<div style="background:var(--bg-color); padding:12px; border-radius:12px; border:1px solid var(--accent);"><h4 style="color:var(--accent);">✈️ ${dest}</h4><p style="font-size:12px;">Formalités validées.</p></div>`;
}

function exporterDonneesCloud() {
    if(!utilisateur) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(utilisateur, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", "evat_backup.json");
    document.body.appendChild(dl);
    dl.click();
    dl.remove();
}

// VoIP P2P & Sonneries
let localStream = null;
let peerConnection = null;
let audioRingContext = null;
let ringInterval = null;
let customAudioRing = null;
let appelTimeoutTimer = null;
let incomingTimeout = null;
let pendingOfferData = null;
let activeCallType = 'audio';

const servers = { 
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ] 
};

function jouerSonSonnerie() {
    try {
        const type = utilisateur && utilisateur.parametres ? utilisateur.parametres.sonnerieType : 'iphone';

        if (type === 'custom' && utilisateur.parametres.customRingtoneBase64) {
            if(customAudioRing) return;
            customAudioRing = new Audio(utilisateur.parametres.customRingtoneBase64);
            customAudioRing.loop = true;
            customAudioRing.play().catch(e => {});
            return;
        }

        if(audioRingContext) return;
        audioRingContext = new (window.AudioContext || window.webkitAudioContext)();
        
        let notes = [523.25, 659.25, 783.99, 1046.50];
        let pattern = 1800;
        let waveType = 'sine';

        if (type === 'motorola') {
            notes = [600, 750, 900, 600];
            pattern = 1400;
            waveType = 'square';
        } else if (type === 'samsung') {
            notes = [440, 554.37, 659.25, 880, 1108.73];
            pattern = 2200;
            waveType = 'triangle';
        } else if (type === 'classique') {
            notes = [800, 1000];
            pattern = 1000;
            waveType = 'sine';
        }

        let noteIndex = 0;
        ringInterval = setInterval(() => {
            if(!audioRingContext) return;
            const osc = audioRingContext.createOscillator();
            const gain = audioRingContext.createGain();
            osc.type = waveType;
            osc.frequency.setValueAtTime(notes[noteIndex % notes.length], audioRingContext.currentTime);
            gain.gain.setValueAtTime(0.12, audioRingContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioRingContext.currentTime + 0.5);
            osc.connect(gain);
            gain.connect(audioRingContext.destination);
            osc.start();
            osc.stop(audioRingContext.currentTime + 0.5);
            noteIndex++;
        }, pattern / notes.length);
    } catch(e) {}
}

function arreterSonSonnerie() {
    if(ringInterval) { clearInterval(ringInterval); ringInterval = null; }
    if(audioRingContext) { audioRingContext.close().catch(() => {}); audioRingContext = null; }
    if(customAudioRing) { customAudioRing.pause(); customAudioRing.currentTime = 0; customAudioRing = null; }
    if(appelTimeoutTimer) { clearTimeout(appelTimeoutTimer); appelTimeoutTimer = null; }
    if(incomingTimeout) { clearTimeout(incomingTimeout); incomingTimeout = null; }
}

function afficherModalAppelEntrant(senderTel, typeAppel) {
    let modal = document.getElementById('incomingCallModal');
    let typeTxt = typeAppel === 'video' ? '📹 Appel Vidéo Entrant' : '📞 Appel Audio Entrant';
    if(!modal) {
        modal = document.createElement('div');
        modal.id = 'incomingCallModal';
        modal.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(3,7,18,0.95); z-index:99999; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; box-sizing:border-box; text-align:center;";
        modal.innerHTML = `
            <div style="background:rgba(255,255,255,0.05); border:1px solid var(--border-color); padding:30px; border-radius:24px; max-width:340px; width:100%; box-shadow:0 10px 25px rgba(0,0,0,0.5);">
                <div style="font-size:50px; margin-bottom:15px;">📞</div>
                <h2 id="incomingCallTitle" style="color:var(--text-primary); font-size:20px; margin:0 0 8px 0;">${typeTxt}</h2>
                <p id="incomingCallerName" style="color:var(--accent); font-size:15px; font-weight:bold; margin:0 0 25px 0;">${senderTel}</p>
                <div style="display:flex; gap:15px; justify-content:center;">
                    <button onclick="rejeterAppelEntrant()" style="background:#ef4444; color:#fff; border:none; padding:12px 24px; border-radius:50px; font-size:14px; font-weight:bold; cursor:pointer; flex:1;">Rejeter ❌</button>
                    <button onclick="accepterAppelEntrant()" style="background:#10b981; color:#fff; border:none; padding:12px 24px; border-radius:50px; font-size:14px; font-weight:bold; cursor:pointer; flex:1;">Décrocher 🟢</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    } else {
        document.getElementById('incomingCallTitle').innerText = typeTxt;
        document.getElementById('incomingCallerName').innerText = senderTel;
        modal.style.display = 'flex';
    }
}

function cacherModalAppelEntrant() {
    const modal = document.getElementById('incomingCallModal');
    if(modal) modal.style.display = 'none';
}

async function lancerAppelDirectPeer(type) {
    const cibleTel = document.getElementById('appelCibleNum').value.trim();
    const logEl = document.getElementById('callStatusLog');
    const container = document.getElementById('callContainer');
    activeCallType = type;

    if(!cibleTel) {
        alert("Entrez le numéro du contact à appeler.");
        return;
    }
    if(cibleTel === utilisateur.telephone) {
        alert("Impossible de s'appeler soi-même !");
        return;
    }

    try {
        if(logEl) logEl.innerText = "🔄 Activation micro/caméra...";
        container.style.display = 'block';

        localStream = await navigator.mediaDevices.getUserMedia({ 
            audio: true, 
            video: type === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false 
        });

        peerConnection = new RTCPeerConnection(servers);
        
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        peerConnection.ontrack = event => {
            if (event.streams && event.streams[0]) {
                const remoteAudio = document.getElementById('remoteAudio');
                const remoteVideo = document.getElementById('remoteVideo');
                if(remoteAudio) remoteAudio.srcObject = event.streams[0];
                if(remoteVideo && type === 'video') remoteVideo.srcObject = event.streams[0];
                if(logEl) logEl.innerText = "✅ Connexion active !";
                arreterSonSonnerie();
            }
        };

        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                socket.emit('p2p_signal', { target: cibleTel, sender: utilisateur.telephone, type: 'ice_candidate', candidate: event.candidate, callType: type });
            }
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        socket.emit('p2p_signal', { target: cibleTel, sender: utilisateur.telephone, type: 'offer', offer: offer, callType: type });

        jouerSonSonnerie();
        if(logEl) logEl.innerText = "📞 Sonnerie active...";

        appelTimeoutTimer = setTimeout(() => {
            if(peerConnection && peerConnection.connectionState !== 'connected') {
                raccrocherAppel(true);
                if(logEl) logEl.innerText = "❌ Pas de réponse.";
            }
        }, 30000);

    } catch (error) {
        if(logEl) logEl.innerText = "❌ Erreur micro/caméra.";
    }
}

socket.on('p2p_signal', async (data) => {
    const logEl = document.getElementById('callStatusLog');
    if(data.callType) activeCallType = data.callType;

    if (!peerConnection && data.type !== 'hangup' && data.type !== 'reject') {
        peerConnection = new RTCPeerConnection(servers);
        peerConnection.ontrack = event => {
            if (event.streams && event.streams[0]) {
                const remoteAudio = document.getElementById('remoteAudio');
                const remoteVideo = document.getElementById('remoteVideo');
                if(remoteAudio) remoteAudio.srcObject = event.streams[0];
                if(remoteVideo && activeCallType === 'video') remoteVideo.srcObject = event.streams[0];
                if(logEl) logEl.innerText = "✅ Connexion active !";
                arreterSonSonnerie();
            }
        };
        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                socket.emit('p2p_signal', { target: data.sender, sender: utilisateur.telephone, type: 'ice_candidate', candidate: event.candidate, callType: activeCallType });
            }
        };
    }

    if (data.type === 'offer') {
        pendingOfferData = data;
        jouerSonSonnerie();
        afficherModalAppelEntrant(data.sender, data.callType || 'audio');
        incomingTimeout = setTimeout(() => { rejeterAppelEntrant(); }, 30000);
    } else if (data.type === 'answer') {
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            arreterSonSonnerie();
            if(logEl) logEl.innerText = "✅ Appel décroché !";
        } catch(e) {}
    } else if (data.type === 'ice_candidate' && data.candidate && peerConnection) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch(e) {}
    } else if (data.type === 'hangup' || data.type === 'reject') {
        fermerAppelTotalLocally();
        if(logEl) logEl.innerText = "❌ Appel terminé.";
    }
});

async function accepterAppelEntrant() {
    arreterSonSonnerie();
    cacherModalAppelEntrant();
    if(incomingTimeout) clearTimeout(incomingTimeout);

    const logEl = document.getElementById('callStatusLog');
    const container = document.getElementById('callContainer');
    container.style.display = 'block';

    if(!pendingOfferData) return;
    const data = pendingOfferData;
    activeCallType = data.callType || 'audio';

    try {
        if(logEl) logEl.innerText = "📞 Décrochage...";
        localStream = await navigator.mediaDevices.getUserMedia({ 
            audio: true, 
            video: activeCallType === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false 
        });

        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        const remoteVideo = document.getElementById('remoteVideo');
        if(remoteVideo && activeCallType === 'video') {
            remoteVideo.srcObject = localStream;
        }

        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        socket.emit('p2p_signal', { target: data.sender, sender: utilisateur.telephone, type: 'answer', answer: answer, callType: activeCallType });
        if(logEl) logEl.innerText = "✅ Établi avec " + data.sender;
    } catch(err) {
        if(logEl) logEl.innerText = "❌ Erreur micro/caméra.";
    }
}

function rejeterAppelEntrant() {
    arreterSonSonnerie();
    cacherModalAppelEntrant();
    if(incomingTimeout) clearTimeout(incomingTimeout);

    if(pendingOfferData) {
        socket.emit('p2p_signal', { target: pendingOfferData.sender, sender: utilisateur.telephone, type: 'reject' });
        pendingOfferData = null;
    }
    fermerAppelTotalLocally();
}

function raccrocherAppel(isTimeout = false) {
    let targetTel = document.getElementById('appelCibleNum').value.trim();
    if(pendingOfferData && pendingOfferData.sender) {
        targetTel = pendingOfferData.sender;
    }
    if(targetTel) {
        socket.emit('p2p_signal', { target: targetTel, sender: utilisateur.telephone, type: 'hangup' });
    }
    fermerAppelTotalLocally();
}

function fermerAppelTotalLocally() {
    arreterSonSonnerie();
    cacherModalAppelEntrant();
    
    if(peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if(localStream) {
        localStream.getTracks().forEach(track => {
            track.stop();
        });
        localStream = null;
    }
    
    const remoteAudio = document.getElementById('remoteAudio');
    const remoteVideo = document.getElementById('remoteVideo');
    if(remoteAudio) remoteAudio.srcObject = null;
    if(remoteVideo) remoteVideo.srcObject = null;

    const container = document.getElementById('callContainer');
    if(container) container.style.display = 'none';
    
    pendingOfferData = null;
}

// LOGIQUE CRITIQUE DE GESTION DE LA PAGE D'ACCUEIL ET DE L'ENREGISTREMENT UNIQUE
document.addEventListener('DOMContentLoaded', () => {
    const welcomeModal = document.getElementById('welcomeModal');
    if (!utilisateur || !utilisateur.nom || !utilisateur.telephone) {
        // Premier accès : on affiche la modal d'enregistrement
        if(welcomeModal) welcomeModal.style.display = 'flex';
    } else {
        // Déjà enregistré : on masque définitivement la modal d'enregistrement
        if(welcomeModal) welcomeModal.style.display = 'none';
        appliquerInfosProfil();
        afficherContacts();
    }
    afficherNotesBlocNotes();
    afficherMessagesLocaux();
});

async function demanderPermissionsEtActiverProfil() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        stream.getTracks().forEach(track => track.stop());
    } catch (err) {}

    sauvegarderProfilBase();
}
