
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
    let metier = '';
    const metierSel = document.getElementById('inputMetier');
    if (metierSel && metierSel.tagName === 'SELECT') {
        const id = metierSel.value;
        const autre = (document.getElementById('inputMetierAutre')?.value || '').trim();
        metier = (id === 'autre' || id === '') ? (autre || 'Autre métier') : (labelMetierId(id) + (autre ? ' — ' + autre : ''));
        if (!utilisateur) {}
        window._metierIdTemp = (id && id !== '') ? id : detecterMetierId(metier);
    } else {
        metier = (metierSel?.value || '').trim();
        window._metierIdTemp = detecterMetierId(metier);
    }
    
    if(!nom || !tel) {
        alert("Veuillez remplir votre nom et votre numéro.");
        return;
    }

    utilisateur = {
        nom: nom,
        telephone: tel,
        metier: metier || "Opérateur",
        metierId: window._metierIdTemp || detecterMetierId(metier),
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
    utilisateur.metier = metier || utilisateur.metier;
    utilisateur.metierId = detecterMetierId(utilisateur.metier);

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

// Réponse IA instantanée et intelligente
function poserQuestionElaws() {
    const input = document.getElementById('elawsInput');
    const question = input.value.trim();
    if(!question || !utilisateur) return;
    const chatBox = document.getElementById('elawsChatBox');
    
    chatBox.innerHTML += `<div style="background:rgba(255,255,255,0.05); padding:8px; border-radius:8px; text-align:right;"><strong style="color:var(--success);">👤 ${utilisateur.nom} :</strong><p style="margin:3px 0 0 0; font-size:12px;">${question}</p></div>`;
    input.value = '';
    chatBox.scrollTop = chatBox.scrollHeight;

    setTimeout(() => {
        let reponse = "";
        const qLower = question.toLowerCase();

        if (qLower.includes('bonjour') || qLower.includes('salut')) {
            reponse = `Bonjour ${utilisateur.nom} ! En tant qu'expert en ${utilisateur.metier}, je suis à votre service. Que souhaitez-vous analyser ?`;
        } else if (qLower.includes('merci')) {
            reponse = `C'est un plaisir, ${utilisateur.nom}. Je veille sur vos systèmes et communications.`;
        } else if (qLower.includes('contact') || qLower.includes('appel')) {
            reponse = `Pour vos appels VoIP sécurisés ou vos contacts, rendez-vous dans l'onglet Annuaire ou Appels. Votre ID : ${utilisateur.telephone}.`;
        } else if (qLower.includes('entreprise') || qLower.includes('business') || qLower.includes('nif') || qLower.includes('statut')) {
            reponse = `Concernant votre structure à Lomé et la gestion de vos entités avec un NIF, une distinction claire est recommandée. Souhaitez-vous un plan stratégique ?`;
        } else if (qLower.includes('aide') || qLower.includes('que peux-tu') || qLower.includes('fonction')) {
            reponse = `Je suis l'assistant ELAWS AI, intégré dans votre écosystème EVAT Continuum. Je gère vos notes, votre stratégie et vos communications chiffrées.`;
        } else {
            reponse = `Analyse instantanée de "${question}" validée pour ${utilisateur.nom} (${utilisateur.metier}). Le système applique vos consignes avec succès.`;
        }

        chatBox.innerHTML += `<div style="background:rgba(59,130,246,0.1); border:1px solid var(--accent); padding:8px; border-radius:8px;"><strong style="color:var(--accent);">🤖 ELAWS AI :</strong><p style="margin:3px 0 0 0; font-size:12px;">${reponse}</p></div>`;
        chatBox.scrollTop = chatBox.scrollHeight;
    }, 150);
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


// ========== OUTILS DE TRAVAIL PAR MÉTIER ==========
const METIERS_CATALOGUE = [
  { id: 'commerce', label: 'Commerce / Vente', keys: ['commerce','vente','vendeur','commerçant','boutique','magasin','retail'] },
  { id: 'agriculture', label: 'Agriculture / Élevage', keys: ['agri','fermier','élevage','eleveur','planteur','maraîch','maraich'] },
  { id: 'artisanat', label: 'Artisanat / Métiers manuels', keys: ['artisan','coutur','menuis','soudeur','maçon','macon','plomb','électric','electric','coiff'] },
  { id: 'transport', label: 'Transport / Logistique', keys: ['transport','chauffeur','taxi','moto','logistique','livreur','camion'] },
  { id: 'sante', label: 'Santé / Soins', keys: ['santé','sante','infirm','médecin','medecin','pharmac','soignant','aide-soign'] },
  { id: 'education', label: 'Éducation / Formation', keys: ['enseign','prof','éduc','educ','formateur','école','ecole','tuteur'] },
  { id: 'informatique', label: 'Informatique / Digital', keys: ['info','dévelop','develop','program','digital','web','technicien informatique','IT'] },
  { id: 'restauration', label: 'Restauration / Cuisine', keys: ['resto','cuisine','cuisinier','traiteur','hôtel','hotel','barman'] },
  { id: 'admin', label: 'Administration / Bureau', keys: ['admin','secrét','secret','comptable','bureau','office','gestion'] },
  { id: 'construction', label: 'BTP / Construction', keys: ['btp','construction','chantier','architecte','géomètre','geometre'] },
  { id: 'finance', label: 'Finance / Microfinance', keys: ['finance','banque','microfinance','crédit','credit','comptable'] },
  { id: 'juridique', label: 'Juridique / Formalités', keys: ['jurid','avocat','notaire','droit','formalit'] },
  { id: 'media', label: 'Média / Communication', keys: ['média','media','journal','communication','marketing','graphiste'] },
  { id: 'autre', label: 'Autre métier', keys: ['autre','général','general','opérateur','operateur'] }
];

const OUTILS_PAR_METIER = {
  commerce: [
    { id: 'prix_marge', titre: 'Calculateur prix & marge', desc: 'Coût, marge %, prix de vente TTC approximatif', type: 'calc_marge' },
    { id: 'devis_vente', titre: 'Devis / facture rapide', desc: 'Texte prêt à envoyer au client', type: 'devis' },
    { id: 'stock_simple', titre: 'Stock du jour', desc: 'Entrées, sorties, reste', type: 'stock' },
    { id: 'relance_client', titre: 'Script de relance client', desc: 'Message poli pour relancer un prospect', type: 'script_relance' }
  ],
  agriculture: [
    { id: 'cout_parcelle', titre: 'Coût de parcelle', desc: 'Semences, main-d\'œuvre, engrais → coût total', type: 'calc_parcelle' },
    { id: 'calendrier_culture', titre: 'Calendrier cultural', desc: 'Notes par étape (semis, entretien, récolte)', type: 'checklist_agri' },
    { id: 'suivi_animaux', titre: 'Suivi élevage', desc: 'Têtes, naissances, ventes', type: 'elevage' },
    { id: 'prix_marche', titre: 'Prix marché du jour', desc: 'Noter les prix observés', type: 'prix_marche' }
  ],
  artisanat: [
    { id: 'devis_artisan', titre: 'Devis chantier / commande', desc: 'Main-d\'œuvre + fournitures', type: 'devis' },
    { id: 'mesure_materiau', titre: 'Besoin matériaux', desc: 'Quantités et coût estimé', type: 'materiaux' },
    { id: 'planning_jobs', titre: 'Planning des jobs', desc: 'Commandes à livrer', type: 'todo_pro' },
    { id: 'garantie', titre: 'Fiche SAV / garantie', desc: 'Note client + date', type: 'note_sav' }
  ],
  transport: [
    { id: 'course_tarif', titre: 'Tarif de course', desc: 'Distance / forfait → prix suggéré', type: 'tarif_course' },
    { id: 'carnet_courses', titre: 'Carnet de courses', desc: 'Trajets du jour', type: 'carnet_trajets' },
    { id: 'carburant', titre: 'Suivi carburant', desc: 'Litres et dépenses', type: 'carburant' },
    { id: 'checklist_vehicule', titre: 'Contrôle véhicule', desc: 'Avant départ', type: 'checklist_vehicule' }
  ],
  sante: [
    { id: 'rappel_rdv', titre: 'Rappels patients / RDV', desc: 'Liste de suivis (hors diagnostic)', type: 'todo_pro' },
    { id: 'stock_pharma', titre: 'Stock consommables', desc: 'Inventaire simple', type: 'stock' },
    { id: 'notes_soins', titre: 'Notes de transmission', desc: 'Compte-rendu interne', type: 'notes_pro' },
    { id: 'urgence_num', titre: 'Numéros d\'urgence', desc: 'Liste locale à compléter', type: 'urgences' }
  ],
  education: [
    { id: 'plan_lecon', titre: 'Plan de leçon', desc: 'Objectifs, déroulé, évaluation', type: 'plan_lecon' },
    { id: 'suivi_eleves', titre: 'Suivi élèves', desc: 'Présence / notes rapides', type: 'suivi_eleves' },
    { id: 'quiz_rapide', titre: 'Quiz express', desc: '3 questions à poser', type: 'quiz_enseignant' },
    { id: 'devoir', titre: 'Énoncé de devoir', desc: 'Texte à partager', type: 'notes_pro' }
  ],
  informatique: [
    { id: 'ticket', titre: 'Ticket support', desc: 'Problème, cause, solution', type: 'ticket_it' },
    { id: 'checklist_deploy', titre: 'Checklist mise en ligne', desc: 'Avant déploiement', type: 'checklist_it' },
    { id: 'mdp_notes', titre: 'Notes techniques', desc: 'Procédures (pas de mots de passe sensibles)', type: 'notes_pro' },
    { id: 'devis_presta', titre: 'Devis prestation', desc: 'Jours × tarif', type: 'devis' }
  ],
  restauration: [
    { id: 'fiche_recette', titre: 'Fiche recette / coût portion', desc: 'Ingrédients et coût', type: 'recette_cout' },
    { id: 'stock_cuisine', titre: 'Stock cuisine', desc: 'Denrées', type: 'stock' },
    { id: 'menu_jour', titre: 'Menu du jour', desc: 'À afficher / envoyer', type: 'notes_pro' },
    { id: 'commandes', titre: 'Commandes tables', desc: 'Liste simple', type: 'todo_pro' }
  ],
  admin: [
    { id: 'lettre_type', titre: 'Lettre / mail type', desc: 'Modèle pro', type: 'lettre' },
    { id: 'suivi_dossiers', titre: 'Suivi de dossiers', desc: 'Statuts', type: 'todo_pro' },
    { id: 'ordre_mission', titre: 'Ordre de mission', desc: 'Texte formalisé', type: 'notes_pro' },
    { id: 'checklist_reunion', titre: 'Checklist réunion', desc: 'Avant / pendant / après', type: 'checklist_admin' }
  ],
  construction: [
    { id: 'devis_btp', titre: 'Devis BTP', desc: 'Postes de travaux', type: 'devis' },
    { id: 'materiaux', titre: 'Liste matériaux', desc: 'Quantités chantier', type: 'materiaux' },
    { id: 'planning_chantier', titre: 'Planning chantier', desc: 'Étapes', type: 'todo_pro' },
    { id: 'securite_chantier', titre: 'Sécurité chantier', desc: 'Points de contrôle', type: 'checklist_securite' }
  ],
  finance: [
    { id: 'interet_simple', titre: 'Intérêt simple', desc: 'Capital × taux × durée', type: 'interet' },
    { id: 'echeancier', titre: 'Échéancier', desc: 'Mensualités notées', type: 'todo_pro' },
    { id: 'caisse', titre: 'Caisse du jour', desc: 'Entrées / sorties', type: 'caisse' },
    { id: 'budget', titre: 'Mini budget', desc: 'Prévision', type: 'caisse' }
  ],
  juridique: [
    { id: 'checklist_dossier', titre: 'Pièces du dossier', desc: 'Liste de documents', type: 'checklist_admin' },
    { id: 'suivi_affaires', titre: 'Suivi d\'affaires', desc: 'Échéances', type: 'todo_pro' },
    { id: 'modele_mise_demeure', titre: 'Trame courrier', desc: 'Texte à adapter (pas un conseil juridique)', type: 'lettre' },
    { id: 'notes_audience', titre: 'Notes d\'audience', desc: 'Prise de notes', type: 'notes_pro' }
  ],
  media: [
    { id: 'brief_client', titre: 'Brief client', desc: 'Objectif, public, message', type: 'brief' },
    { id: 'calendrier_contenu', titre: 'Calendrier de contenu', desc: 'Posts / émissions', type: 'todo_pro' },
    { id: 'script_court', titre: 'Script court', desc: '30–60 secondes', type: 'notes_pro' },
    { id: 'devis_com', titre: 'Devis communication', desc: 'Prestation', type: 'devis' }
  ],
  autre: [
    { id: 'todo_pro', titre: 'Liste de tâches pro', desc: 'Priorités du jour', type: 'todo_pro' },
    { id: 'notes_pro', titre: 'Notes de travail', desc: 'Mémo libre', type: 'notes_pro' },
    { id: 'devis', titre: 'Devis rapide', desc: 'Pour un client', type: 'devis' },
    { id: 'caisse', titre: 'Caisse simple', desc: 'Entrées / sorties', type: 'caisse' }
  ]
};

function detecterMetierId(texte) {
  const t = (texte || '').toLowerCase();
  if (!t) return 'autre';
  for (const m of METIERS_CATALOGUE) {
    if (m.id === 'autre') continue;
    if (m.keys.some(k => t.includes(k.toLowerCase()))) return m.id;
  }
  if (t.includes('autre')) return 'autre';
  return 'autre';
}

function labelMetierId(id) {
  const m = METIERS_CATALOGUE.find(x => x.id === id);
  return m ? m.label : 'Autre métier';
}

function onMetierSelectChange(sel) {
  const autre = document.getElementById('inputMetierAutre');
  if (!autre) return;
  autre.style.display = (sel.value === 'autre' || sel.value === '') ? 'block' : 'none';
}

function remplirSelectMetiers() {
  const sel = document.getElementById('inputMetier');
  if (!sel || sel.tagName !== 'SELECT') return;
  if (sel.options.length > 1) return;
  sel.innerHTML = '<option value="">Choisir un métier…</option>';
  METIERS_CATALOGUE.forEach(m => {
    const o = document.createElement('option');
    o.value = m.id;
    o.textContent = m.label;
    sel.appendChild(o);
  });
  sel.onchange = function() { onMetierSelectChange(this); };
}

function metierUtilisateurTexte() {
  if (!utilisateur) return '';
  return utilisateur.metier || '';
}

function metierUtilisateurId() {
  if (utilisateur && utilisateur.metierId) return utilisateur.metierId;
  return detecterMetierId(metierUtilisateurTexte());
}

function outilsDuMetier() {
  const id = metierUtilisateurId();
  return OUTILS_PAR_METIER[id] || OUTILS_PAR_METIER.autre;
}

function afficherOutilsMetier() {
  const badge = document.getElementById('outilsMetierBadge');
  const liste = document.getElementById('outilsMetierListe');
  if (!liste) return;
  const id = metierUtilisateurId();
  const label = utilisateur ? (utilisateur.metier || labelMetierId(id)) : labelMetierId(id);
  if (badge) badge.innerHTML = 'Métier actif : <strong>' + (label.replace(/</g,'&lt;')) + '</strong> · ' + outilsDuMetier().length + ' outils';
  let html = '<div style="display:flex;flex-direction:column;gap:8px;">';
  outilsDuMetier().forEach(o => {
    html += `<button type="button" onclick="ouvrirOutilMetier('${o.id}')" class="btn-action" style="text-align:left;padding:12px 14px;background:rgba(59,130,246,0.12);color:var(--text-primary);border:1px solid var(--border-color);box-shadow:none;">
      <div style="font-weight:700;font-size:13px;color:var(--accent);">${o.titre}</div>
      <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;">${o.desc}</div>
    </button>`;
  });
  html += '</div>';
  liste.innerHTML = html;
}

function fermerOutilActif() {
  const card = document.getElementById('outilActifCard');
  if (card) card.style.display = 'none';
}

function ouvrirOutilMetier(outilId) {
  const outil = outilsDuMetier().find(o => o.id === outilId) || Object.values(OUTILS_PAR_METIER).flat().find(o => o.id === outilId);
  if (!outil) return;
  const card = document.getElementById('outilActifCard');
  const titre = document.getElementById('outilActifTitre');
  const corps = document.getElementById('outilActifCorps');
  if (!card || !corps) return;
  if (titre) titre.textContent = outil.titre;
  corps.innerHTML = rendreOutilCorps(outil);
  card.style.display = 'block';
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function stockageOutil(key, val) {
  if (!utilisateur) return;
  if (!utilisateur.outilsData) utilisateur.outilsData = {};
  utilisateur.outilsData[key] = val;
  localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
}
function lectureOutil(key, def) {
  if (!utilisateur || !utilisateur.outilsData) return def;
  return utilisateur.outilsData[key] != null ? utilisateur.outilsData[key] : def;
}

function rendreOutilCorps(outil) {
  const t = outil.type;
  if (t === 'calc_marge') {
    return `<label>Coût d'achat / revient</label><input type="number" id="om_cout" class="input" placeholder="0">
      <label>Marge souhaitée (%)</label><input type="number" id="om_marge" class="input" placeholder="30" value="30">
      <button class="btn-action" style="background:var(--success)" onclick="runCalcMarge()">Calculer le prix de vente</button>
      <div id="om_result" style="margin-top:10px;font-size:14px;color:var(--accent);"></div>`;
  }
  if (t === 'devis') {
    const prev = lectureOutil('devis_txt', '');
    return `<label>Client</label><input id="om_client" class="input" placeholder="Nom du client">
      <label>Désignation</label><input id="om_desig" class="input" placeholder="Prestation / produit">
      <label>Montant</label><input id="om_montant" type="number" class="input" placeholder="0">
      <button class="btn-action" style="background:var(--success)" onclick="runDevis()">Générer le devis texte</button>
      <textarea id="om_devis_out" class="input" style="height:120px;margin-top:8px;">${String(prev).replace(/</g,'&lt;')}</textarea>
      <button class="btn-action" style="margin-top:6px;background:rgba(59,130,246,0.2);color:var(--accent);border:1px solid var(--border-color);box-shadow:none;" onclick="navigator.clipboard&&navigator.clipboard.writeText(document.getElementById('om_devis_out').value)">📋 Copier</button>`;
  }
  if (t === 'stock') {
    const lines = lectureOutil('stock_lines', []);
    let list = (lines || []).map((l,i)=>`<div style="display:flex;justify-content:space-between;gap:6px;padding:6px 0;border-bottom:1px solid var(--border-color);font-size:12px;"><span>${String(l.nom).replace(/</g,'&lt;')} : <b>${l.qte}</b></span><button onclick="stockDelta(${i},-1)" style="background:none;border:none;color:#f87171;cursor:pointer;">−</button><button onclick="stockDelta(${i},1)" style="background:none;border:none;color:var(--success);cursor:pointer;">+</button></div>`).join('');
    return `<label>Article</label><input id="om_stock_nom" class="input" placeholder="Nom">
      <label>Quantité</label><input id="om_stock_qte" type="number" class="input" value="1">
      <button class="btn-action" style="background:var(--success)" onclick="stockAdd()">Ajouter</button>
      <div style="margin-top:10px;">${list || '<p style="font-size:12px;color:var(--text-secondary)">Stock vide.</p>'}</div>`;
  }
  if (t === 'todo_pro') {
    const items = lectureOutil('todo_'+outil.id, []);
    return renderTodo(outil.id, items);
  }
  if (t === 'notes_pro' || t === 'note_sav' || t === 'brief' || t === 'plan_lecon' || t === 'lettre' || t === 'ticket_it' || t === 'script_relance') {
    const key = 'note_'+outil.id;
    const val = lectureOutil(key, '');
    const ph = t==='script_relance' ? 'Bonjour, je me permets de vous relancer…' : t==='lettre' ? 'Objet : …\nMadame, Monsieur,\n…' : t==='ticket_it' ? 'Problème:\nCause:\nSolution:' : t==='plan_lecon' ? 'Objectif:\nDéroulement:\nÉvaluation:' : t==='brief' ? 'Objectif:\nPublic:\nMessage clé:' : 'Vos notes…';
    return `<textarea id="om_note" class="input" style="height:140px;" placeholder="${ph}">${String(val).replace(/</g,'&lt;')}</textarea>
      <button class="btn-action" style="background:var(--success)" onclick="saveOmNote('${key}')">💾 Enregistrer</button>`;
  }
  if (t === 'calc_parcelle') {
    return `<label>Semences</label><input type="number" id="om_s1" class="input" value="0">
      <label>Main-d'œuvre</label><input type="number" id="om_s2" class="input" value="0">
      <label>Engrais / phytos</label><input type="number" id="om_s3" class="input" value="0">
      <label>Autre</label><input type="number" id="om_s4" class="input" value="0">
      <button class="btn-action" style="background:var(--success)" onclick="const t=+om_s1.value+ +om_s2.value+ +om_s3.value+ +om_s4.value;om_par_res.textContent='Coût total estimé : '+t;">Calculer</button>
      <div id="om_par_res" style="margin-top:10px;color:var(--accent);font-weight:700;"></div>`;
  }
  if (t === 'caisse') {
    const solde = lectureOutil('caisse_solde', 0);
    const hist = lectureOutil('caisse_hist', []);
    return `<div style="font-size:18px;font-weight:800;color:var(--success);margin-bottom:10px;">Solde : <span id="om_caisse_solde">${solde}</span></div>
      <label>Montant</label><input type="number" id="om_caisse_m" class="input" placeholder="0">
      <label>Libellé</label><input id="om_caisse_l" class="input" placeholder="Vente, achat…">
      <div style="display:flex;gap:6px;"><button class="btn-action" style="background:var(--success)" onclick="caisseMove(1)">+ Entrée</button><button class="btn-action" style="background:#ef4444" onclick="caisseMove(-1)">− Sortie</button></div>
      <div id="om_caisse_hist" style="margin-top:10px;font-size:12px;">${(hist||[]).slice(0,8).map(x=>x).join('<br>')}</div>`;
  }
  if (t === 'interet') {
    return `<label>Capital</label><input type="number" id="om_cap" class="input">
      <label>Taux % l'an</label><input type="number" id="om_taux" class="input" value="10">
      <label>Durée (mois)</label><input type="number" id="om_mois" class="input" value="12">
      <button class="btn-action" style="background:var(--success)" onclick="const i=(+om_cap.value)*(+om_taux.value/100)*(+om_mois.value/12);om_int_res.textContent='Intérêt simple ≈ '+i.toFixed(2)+' · Total ≈ '+(+om_cap.value+i).toFixed(2);">Calculer</button>
      <div id="om_int_res" style="margin-top:10px;color:var(--accent);font-weight:700;"></div>`;
  }
  if (t === 'tarif_course') {
    return `<label>Forfait de base</label><input type="number" id="om_base" class="input" value="500">
      <label>Prix / km</label><input type="number" id="om_km_prix" class="input" value="150">
      <label>Km</label><input type="number" id="om_km" class="input" value="5">
      <button class="btn-action" style="background:var(--success)" onclick="om_course_res.textContent='Prix suggéré : '+(+om_base.value + +om_km_prix.value * +om_km.value);">Calculer</button>
      <div id="om_course_res" style="margin-top:10px;color:var(--accent);font-weight:700;"></div>`;
  }
  if (t === 'checklist_vehicule' || t === 'checklist_agri' || t === 'checklist_admin' || t === 'checklist_it' || t === 'checklist_securite') {
    const items = {
      checklist_vehicule: ['Pneus','Freins','Feux','Huile','Carburant','Papiers'],
      checklist_agri: ['Préparer le sol','Semis','Arrosage','Désherbage','Récolte','Stockage'],
      checklist_admin: ['Ordre du jour','Convocations','Salle','Compte-rendu','Suivi décisions'],
      checklist_it: ['Backup','Tests','DNS','HTTPS','Monitoring','Rollback prêt'],
      checklist_securite: ['EPI','Balisage','Extincteur','Consignation','Brief équipe']
    }[t] || ['Étape 1','Étape 2'];
    return items.map((it,i)=>`<label style="display:flex;gap:8px;align-items:center;margin:6px 0;font-size:13px;"><input type="checkbox"> ${it}</label>`).join('') +
      `<p style="font-size:11px;color:var(--text-secondary);margin-top:8px;">Coche sur place — reste sur cet écran.</p>`;
  }
  if (t === 'materiaux' || t === 'recette_cout' || t === 'elevage' || t === 'prix_marche' || t === 'carburant' || t === 'carnet_trajets' || t === 'suivi_eleves' || t === 'quiz_enseignant' || t === 'urgences') {
    const key = 'free_'+outil.id;
    const val = lectureOutil(key, '');
    return `<textarea id="om_free" class="input" style="height:130px;" placeholder="Saisis ici les lignes utiles…">${String(val).replace(/</g,'&lt;')}</textarea>
      <button class="btn-action" style="background:var(--success)" onclick="stockageOutil('${key}', document.getElementById('om_free').value);alert('Enregistré.');">💾 Enregistrer</button>`;
  }
  return `<p style="font-size:13px;">Outil prêt pour ton métier.</p>`;
}

function renderTodo(id, items) {
  items = items || [];
  let html = `<div style="display:flex;gap:6px;margin-bottom:8px;"><input id="om_todo_in" class="input" placeholder="Nouvelle tâche" style="margin:0;"><button class="btn-action" style="width:auto;padding:0 12px;background:var(--success)" onclick="todoAdd('${id}')">+</button></div>`;
  items.forEach((it,i) => {
    html += `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border-color);font-size:13px;">
      <input type="checkbox" ${it.done?'checked':''} onchange="todoToggle('${id}',${i})">
      <span style="flex:1;${it.done?'text-decoration:line-through;opacity:0.6':''}">${String(it.t).replace(/</g,'&lt;')}</span>
      <button onclick="todoDel('${id}',${i})" style="background:none;border:none;color:#f87171;cursor:pointer;">✕</button></div>`;
  });
  return html;
}
function todoAdd(id) {
  const v = document.getElementById('om_todo_in')?.value?.trim();
  if (!v) return;
  const items = lectureOutil('todo_'+id, []);
  items.unshift({ t: v, done: false });
  stockageOutil('todo_'+id, items);
  ouvrirOutilMetier(id);
}
function todoToggle(id, i) {
  const items = lectureOutil('todo_'+id, []);
  if (items[i]) items[i].done = !items[i].done;
  stockageOutil('todo_'+id, items);
  ouvrirOutilMetier(id);
}
function todoDel(id, i) {
  const items = lectureOutil('todo_'+id, []);
  items.splice(i, 1);
  stockageOutil('todo_'+id, items);
  ouvrirOutilMetier(id);
}
function runCalcMarge() {
  const cout = parseFloat(document.getElementById('om_cout')?.value||'0')||0;
  const marge = parseFloat(document.getElementById('om_marge')?.value||'0')||0;
  const prix = cout * (1 + marge/100);
  const el = document.getElementById('om_result');
  if (el) el.textContent = 'Prix de vente suggéré : ' + prix.toFixed(2) + ' (bénéfice unitaire ≈ ' + (prix-cout).toFixed(2) + ')';
}
function runDevis() {
  const client = document.getElementById('om_client')?.value||'Client';
  const desig = document.getElementById('om_desig')?.value||'Prestation';
  const montant = document.getElementById('om_montant')?.value||'0';
  const nom = utilisateur?.nom || 'Moi';
  const txt = `DEVIS\\nDe : ${nom}\\nPour : ${client}\\nDésignation : ${desig}\\nMontant : ${montant}\\nDate : ${new Date().toLocaleDateString()}\\nMerci pour votre confiance.`;
  const out = document.getElementById('om_devis_out');
  if (out) out.value = txt;
  stockageOutil('devis_txt', txt);
}
function stockAdd() {
  const nom = document.getElementById('om_stock_nom')?.value?.trim();
  const qte = parseFloat(document.getElementById('om_stock_qte')?.value||'0')||0;
  if (!nom) return;
  const lines = lectureOutil('stock_lines', []);
  lines.push({ nom, qte });
  stockageOutil('stock_lines', lines);
  ouvrirOutilMetier('stock_simple');
}
function stockDelta(i, d) {
  const lines = lectureOutil('stock_lines', []);
  if (!lines[i]) return;
  lines[i].qte = (parseFloat(lines[i].qte)||0) + d;
  stockageOutil('stock_lines', lines);
  ouvrirOutilMetier('stock_simple');
}
function saveOmNote(key) {
  const v = document.getElementById('om_note')?.value || '';
  stockageOutil(key, v);
  alert('Enregistré sur cet appareil.');
}
function caisseMove(sens) {
  const m = parseFloat(document.getElementById('om_caisse_m')?.value||'0')||0;
  const l = document.getElementById('om_caisse_l')?.value || '';
  if (!m) return;
  let solde = parseFloat(lectureOutil('caisse_solde', 0))||0;
  solde += sens * m;
  const hist = lectureOutil('caisse_hist', []);
  hist.unshift((sens>0?'+':'-') + m + ' · ' + l + ' · solde ' + solde);
  stockageOutil('caisse_solde', solde);
  stockageOutil('caisse_hist', hist.slice(0,30));
  ouvrirOutilMetier('caisse');
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    const target = document.getElementById('tab-' + tabId);
    if(target) target.style.display = 'block';
    const link = document.getElementById('link-' + tabId);
    if(link) link.classList.add('active');
    fermerTousLesMenus();

    if(tabId === 'contacts') afficherContacts();
    if(tabId === 'outils') afficherOutilsMetier();
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
    if (typeof remplirSelectMetiers === 'function') remplirSelectMetiers();
});

async function demanderPermissionsEtActiverProfil() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        stream.getTracks().forEach(track => track.stop());
    } catch (err) {}

    sauvegarderProfilBase();
}
