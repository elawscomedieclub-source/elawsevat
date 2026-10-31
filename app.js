
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
    const metierEl = document.getElementById('inputMetier');
    if (metierEl && metierEl.tagName === 'SELECT') {
      const gid = metierEl.value;
      const autre = (document.getElementById('inputMetierAutre')?.value || '').trim();
      const g = typeof METIERS_GROUPES !== 'undefined' && METIERS_GROUPES.find(x => x.id === gid);
      metier = autre || (g ? g.label : '') || 'Polyvalent';
      window._metierGroupeTemp = gid || (typeof detecterGroupeMetier==='function' ? detecterGroupeMetier(metier) : 'general');
    } else {
      metier = (metierEl?.value || '').trim();
      window._metierGroupeTemp = typeof detecterGroupeMetier==='function' ? detecterGroupeMetier(metier) : 'general';
    }
    
    if(!nom || !tel) {
        alert("Veuillez remplir votre nom et votre numéro.");
        return;
    }

    utilisateur = {
        nom: nom,
        telephone: tel,
        metier: metier || "Opérateur",
        metierGroupe: window._metierGroupeTemp || "general",
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
    if (typeof detecterGroupeMetier === 'function') utilisateur.metierGroupe = detecterGroupeMetier(utilisateur.metier);

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


// ========== OUTILS : seulement le métier de l'utilisateur (+ proches) ==========
window._outilCategorieOuverte = null;
window._outilCourant = null;

const METIERS_GROUPES = [
  { id:'vente_commerce', label:'Commerce, vente & clientèle',
    keys:['commerce','vente','vendeur','commerçant','boutique','magasin','retail','caissier','négocia','negocia','prospect','marché','marche'],
    outils:[
      {id:'prix_marge',titre:'Prix & marge',desc:'Coût → marge % → prix de vente',type:'calc_marge'},
      {id:'devis_vente',titre:'Devis / facture texte',desc:'À envoyer au client',type:'devis'},
      {id:'stock_simple',titre:'Stock simple',desc:'Articles et quantités',type:'stock'},
      {id:'relance',titre:'Script de relance',desc:'Message de suivi client',type:'script_relance'},
      {id:'caisse_vente',titre:'Caisse du jour',desc:'Entrées / sorties',type:'caisse'}
    ]},
  { id:'prod_artisanal', label:'Artisanat, BTP & production',
    keys:['artisan','coutur','menuis','soudeur','maçon','macon','plomb','électric','electric','coiff','btp','construction','chantier','architecte','mécanicien','mecanicien','soudure','carreleur'],
    outils:[
      {id:'devis_artisan',titre:'Devis travaux / commande',desc:'Main-d’œuvre + fournitures',type:'devis'},
      {id:'materiaux',titre:'Liste matériaux',desc:'Quantités et coûts',type:'notes_pro'},
      {id:'planning_jobs',titre:'Planning des jobs',desc:'Commandes à livrer',type:'todo_pro'},
      {id:'securite',titre:'Checklist sécurité',desc:'Avant de démarrer',type:'checklist_secu'},
      {id:'sav',titre:'Fiche SAV',desc:'Client + date + problème',type:'notes_pro'}
    ]},
  { id:'agro', label:'Agriculture & élevage',
    keys:['agri','fermier','élevage','eleveur','planteur','maraîch','maraich','pêche','peche','pisciculture','ferme'],
    outils:[
      {id:'cout_parcelle',titre:'Coût de parcelle',desc:'Semences, main-d’œuvre, engrais',type:'calc_somme'},
      {id:'calendrier',titre:'Étapes culturales',desc:'Semis → récolte',type:'checklist_agri'},
      {id:'elevage',titre:'Suivi élevage',desc:'Notes têtes / ventes',type:'notes_pro'},
      {id:'prix_marche',titre:'Prix du marché',desc:'Relevés du jour',type:'notes_pro'}
    ]},
  { id:'transport', label:'Transport & livraison',
    keys:['transport','chauffeur','taxi','moto','logistique','livreur','camion','bus'],
    outils:[
      {id:'tarif_course',titre:'Tarif de course',desc:'Forfait + km',type:'tarif_course'},
      {id:'carnet',titre:'Carnet de trajets',desc:'Courses du jour',type:'todo_pro'},
      {id:'carburant',titre:'Carburant',desc:'Dépenses essence',type:'caisse'},
      {id:'vehicule',titre:'Contrôle véhicule',desc:'Avant départ',type:'checklist_vehicule'}
    ]},
  { id:'services_humains', label:'Santé, éducation & social',
    keys:['santé','sante','infirm','médecin','medecin','pharmac','soignant','enseign','prof','éduc','educ','formateur','école','ecole','tuteur','social'],
    outils:[
      {id:'rdv',titre:'Rappels / RDV',desc:'Liste de suivis',type:'todo_pro'},
      {id:'plan_lecon',titre:'Plan de leçon / séance',desc:'Objectifs et déroulé',type:'plan_lecon'},
      {id:'notes_trans',titre:'Notes de transmission',desc:'Compte-rendu interne',type:'notes_pro'},
      {id:'stock_cons',titre:'Stock consommables',desc:'Inventaire simple',type:'stock'}
    ]},
  { id:'bureau_digital', label:'Bureau, digital & finance',
    keys:['admin','secrét','secret','comptable','bureau','office','gestion','info','dévelop','develop','program','digital','web','IT','finance','banque','microfinance','crédit','credit','jurid','avocat','média','media','marketing'],
    outils:[
      {id:'lettre',titre:'Lettre / mail type',desc:'Modèle pro',type:'lettre'},
      {id:'dossiers',titre:'Suivi de dossiers',desc:'Statuts et échéances',type:'todo_pro'},
      {id:'devis_presta',titre:'Devis prestation',desc:'Service facturé',type:'devis'},
      {id:'caisse_b',titre:'Caisse / budget',desc:'Entrées et sorties',type:'caisse'},
      {id:'interet',titre:'Intérêt simple',desc:'Capital × taux × durée',type:'interet'},
      {id:'ticket',titre:'Ticket / brief',desc:'Problème ou brief client',type:'ticket'}
    ]},
  { id:'resto', label:'Restauration & hôtellerie',
    keys:['resto','cuisine','cuisinier','traiteur','hôtel','hotel','barman','restauration'],
    outils:[
      {id:'recette',titre:'Coût de portion',desc:'Ingrédients → coût',type:'calc_somme'},
      {id:'stock_cuisine',titre:'Stock cuisine',desc:'Denrées',type:'stock'},
      {id:'menu',titre:'Menu du jour',desc:'Texte à afficher',type:'notes_pro'},
      {id:'commandes',titre:'Commandes',desc:'Tables / à emporter',type:'todo_pro'}
    ]},
  { id:'general', label:'Polyvalent / autre métier',
    keys:['autre','général','general','opérateur','operateur','freelance','indépendant','independant'],
    outils:[
      {id:'todo_g',titre:'Tâches du jour',desc:'Priorités',type:'todo_pro'},
      {id:'notes_g',titre:'Notes de travail',desc:'Mémo',type:'notes_pro'},
      {id:'devis_g',titre:'Devis rapide',desc:'Client + montant',type:'devis'},
      {id:'caisse_g',titre:'Caisse simple',desc:'Entrées / sorties',type:'caisse'}
    ]}
];

function detecterGroupeMetier(texte) {
  const t = (texte || '').toLowerCase();
  if (!t) return 'general';
  for (const g of METIERS_GROUPES) {
    if (g.id === 'general') continue;
    if (g.keys.some(k => t.includes(k.toLowerCase()))) return g.id;
  }
  return 'general';
}

function scoreGroupe(g, texte) {
  const t = (texte || '').toLowerCase();
  if (!t) return 0;
  let s = 0;
  g.keys.forEach(k => { if (t.includes(k.toLowerCase())) s += 1; });
  return s;
}

/** Uniquement les groupes qui matchent le métier de l'utilisateur (pas toute la liste). */
function groupesPourUtilisateur() {
  const texte = (utilisateur && (utilisateur.metier || '')) || '';
  const forceId = utilisateur && utilisateur.metierGroupe;
  const scored = METIERS_GROUPES.map(g => ({ g, s: scoreGroupe(g, texte) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map(x => x.g);

  if (forceId) {
    const forced = METIERS_GROUPES.find(g => g.id === forceId);
    if (forced && !scored.find(g => g.id === forced.id)) scored.unshift(forced);
  }

  if (!scored.length) {
    const id = forceId || detecterGroupeMetier(texte);
    const g = METIERS_GROUPES.find(x => x.id === id) || METIERS_GROUPES[METIERS_GROUPES.length - 1];
    return [g];
  }
  return scored;
}

function onMetierSelectChange(sel) {
  const autre = document.getElementById('inputMetierAutre');
  if (autre) autre.style.display = (!sel.value || sel.value === 'general') ? 'block' : 'none';
}

function remplirSelectMetiers() {
  const sel = document.getElementById('inputMetier');
  if (!sel || sel.tagName !== 'SELECT') return;
  if (sel.options.length > 2) return;
  sel.innerHTML = '<option value="">Choisir ton domaine de métier…</option>';
  METIERS_GROUPES.forEach(g => {
    const o = document.createElement('option');
    o.value = g.id;
    o.textContent = g.label;
    sel.appendChild(o);
  });
}

function afficherOutilsMetier() {
  const badge = document.getElementById('outilsMetierBadge');
  const liste = document.getElementById('outilsMetierListe');
  if (!liste) return;

  if (!utilisateur || !(utilisateur.metier || utilisateur.metierGroupe)) {
    liste.innerHTML = '<p style="font-size:13px;color:var(--text-secondary);padding:12px;text-align:center;">Indique ton <b>métier</b> dans le profil pour voir uniquement tes outils.</p>';
    if (badge) badge.textContent = '';
    return;
  }

  const groupes = groupesPourUtilisateur();
  if (badge) {
    badge.innerHTML = 'Métier : <strong>' + String(utilisateur.metier || groupes[0].label).replace(/</g,'&lt;') + '</strong> · ' +
      groupes.length + ' famille' + (groupes.length > 1 ? 's proches' : '') + ' d’outils';
  }

  // Ouvrir automatiquement la première catégorie si rien d'ouvert
  if (!window._outilCategorieOuverte || !groupes.find(g => g.id === window._outilCategorieOuverte)) {
    window._outilCategorieOuverte = groupes[0].id;
  }

  let html = '';
  groupes.forEach(g => {
    const ouverte = window._outilCategorieOuverte === g.id;
    html += '<div style="border:1px solid '+(ouverte?'var(--accent)':'var(--border-color)')+';border-radius:14px;margin-bottom:8px;overflow:hidden;background:var(--bg-color);">';
    html += '<button type="button" onclick="toggleCategorieOutil(\''+g.id+'\')" style="width:100%;text-align:left;padding:12px 14px;border:none;background:rgba(59,130,246,0.1);cursor:pointer;color:var(--text-primary);display:flex;justify-content:space-between;align-items:center;">';
    html += '<span><strong style="font-size:13px;color:var(--accent);">'+g.label+'</strong>';
    html += '<div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">'+g.outils.length+' outils — toucher pour '+(ouverte?'replier':'déplier')+'</div></span>';
    html += '<span style="color:var(--accent);">'+(ouverte?'▲':'▼')+'</span></button>';
    if (ouverte) {
      html += '<div style="padding:0 10px 12px;border-top:1px solid var(--border-color);">';
      g.outils.forEach(o => {
        html += '<button type="button" onclick="ouvrirOutilMetier(\''+g.id+'\',\''+o.id+'\')" class="btn-action" style="text-align:left;padding:10px 12px;margin-top:8px;background:rgba(15,23,42,0.55);color:var(--text-primary);border:1px solid var(--border-color);box-shadow:none;">';
        html += '<div style="font-weight:700;font-size:12.5px;color:var(--success);">'+o.titre+'</div>';
        html += '<div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">'+o.desc+'</div></button>';
      });
      html += '</div>';
    }
    html += '</div>';
  });
  liste.innerHTML = html;
}

function toggleCategorieOutil(id) {
  window._outilCategorieOuverte = (window._outilCategorieOuverte === id) ? null : id;
  fermerOutilActif();
  afficherOutilsMetier();
}

function fermerOutilActif() {
  const card = document.getElementById('outilActifCard');
  if (card) card.style.display = 'none';
}

function ouvrirOutilMetier(groupeId, outilId) {
  const g = METIERS_GROUPES.find(x => x.id === groupeId);
  const outil = g && g.outils.find(o => o.id === outilId);
  if (!outil) return;
  window._outilCourant = { groupeId, outilId, type: outil.type };
  const card = document.getElementById('outilActifCard');
  const titre = document.getElementById('outilActifTitre');
  const corps = document.getElementById('outilActifCorps');
  if (!card || !corps) return;
  if (titre) titre.textContent = outil.titre;
  corps.innerHTML = rendreCorpsOutil(outil);
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

function rendreCorpsOutil(outil) {
  const t = outil.type;
  if (t === 'calc_marge') {
    return `<label>Coût de revient</label><input type="number" id="om_cout" class="input" placeholder="0">
      <label>Marge %</label><input type="number" id="om_marge" class="input" value="30">
      <button class="btn-action" style="background:var(--success)" onclick="runCalcMargeUI()">Calculer</button>
      <div id="om_res" style="margin-top:10px;color:var(--accent);font-weight:700;"></div>`;
  }
  if (t === 'devis') {
    return `<label>Client</label><input id="om_client" class="input">
      <label>Désignation</label><input id="om_desig" class="input">
      <label>Montant</label><input id="om_montant" type="number" class="input">
      <button class="btn-action" style="background:var(--success)" onclick="runDevisUI()">Générer</button>
      <textarea id="om_out" class="input" style="height:110px;margin-top:8px;"></textarea>`;
  }
  if (t === 'stock') {
    const lines = lectureOutil('stock', []) || [];
    let list = lines.map((l,i) => `<div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 0;border-bottom:1px solid var(--border-color);"><span>${String(l.n).replace(/</g,'&lt;')} : <b>${l.q}</b></span><span><button type="button" onclick="stockAdj(${i},-1)" style="background:none;border:none;color:#f87171;cursor:pointer">−</button> <button type="button" onclick="stockAdj(${i},1)" style="background:none;border:none;color:var(--success);cursor:pointer">+</button></span></div>`).join('');
    return `<label>Article</label><input id="om_sn" class="input"><label>Qté</label><input id="om_sq" type="number" class="input" value="1">
      <button class="btn-action" style="background:var(--success)" onclick="stockAddLine()">Ajouter</button>
      <div style="margin-top:8px;">${list || '<p style="font-size:12px;color:var(--text-secondary)">Vide</p>'}</div>`;
  }
  if (t === 'caisse') {
    const solde = lectureOutil('caisse_s', 0);
    const hist = lectureOutil('caisse_h', []) || [];
    return `<div style="font-size:18px;font-weight:800;color:var(--success);margin-bottom:8px;">Solde : <span id="om_cs">${solde}</span></div>
      <input id="om_cm" type="number" class="input" placeholder="Montant">
      <input id="om_cl" class="input" placeholder="Libellé">
      <div style="display:flex;gap:6px;"><button class="btn-action" style="background:var(--success)" onclick="caisseAdj(1)">Entrée</button><button class="btn-action" style="background:#ef4444" onclick="caisseAdj(-1)">Sortie</button></div>
      <div style="margin-top:8px;font-size:11px;color:var(--text-secondary);">${hist.slice(0,6).join('<br>')}</div>`;
  }
  if (t === 'todo_pro') {
    const items = lectureOutil('todo_' + outil.id, []) || [];
    let htm = `<div style="display:flex;gap:6px;"><input id="om_ti" class="input" placeholder="Tâche" style="margin:0;"><button class="btn-action" style="width:auto;padding:0 12px;background:var(--success)" onclick="todoAdd('${outil.id}')">+</button></div>`;
    items.forEach((it, i) => {
      htm += `<div style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--border-color);font-size:13px;"><input type="checkbox" ${it.d?'checked':''} onchange="todoTg('${outil.id}',${i})"><span style="flex:1;${it.d?'text-decoration:line-through;opacity:.6':''}">${String(it.t).replace(/</g,'&lt;')}</span><button type="button" onclick="todoRm('${outil.id}',${i})" style="background:none;border:none;color:#f87171;cursor:pointer">✕</button></div>`;
    });
    return htm;
  }
  if (t === 'calc_somme') {
    return `<label>Ligne 1</label><input type="number" id="om_a" class="input" value="0">
      <label>Ligne 2</label><input type="number" id="om_b" class="input" value="0">
      <label>Ligne 3</label><input type="number" id="om_c" class="input" value="0">
      <label>Ligne 4</label><input type="number" id="om_d" class="input" value="0">
      <button class="btn-action" style="background:var(--success)" onclick="runSommeUI()">Additionner</button>
      <div id="om_sum" style="margin-top:10px;color:var(--accent);font-weight:700;"></div>`;
  }
  if (t === 'tarif_course') {
    return `<label>Base</label><input type="number" id="om_base" class="input" value="500">
      <label>Prix / km</label><input type="number" id="om_pk" class="input" value="150">
      <label>Km</label><input type="number" id="om_km" class="input" value="5">
      <button class="btn-action" style="background:var(--success)" onclick="runTarifUI()">Calculer</button>
      <div id="om_tr" style="margin-top:10px;color:var(--accent);font-weight:700;"></div>`;
  }
  if (t === 'interet') {
    return `<label>Capital</label><input type="number" id="om_cap" class="input">
      <label>Taux % / an</label><input type="number" id="om_tx" class="input" value="10">
      <label>Mois</label><input type="number" id="om_mo" class="input" value="12">
      <button class="btn-action" style="background:var(--success)" onclick="runInteretUI()">Calculer</button>
      <div id="om_ir" style="margin-top:10px;color:var(--accent);font-weight:700;"></div>`;
  }
  if (t === 'checklist_vehicule' || t === 'checklist_agri' || t === 'checklist_secu') {
    const map = {
      checklist_vehicule: ['Pneus','Freins','Feux','Huile','Carburant','Papiers'],
      checklist_agri: ['Sol','Semis','Arrosage','Entretien','Récolte','Stockage'],
      checklist_secu: ['EPI','Balisage','Brief équipe','Extincteur','Zone sécurisée']
    };
    return (map[t] || []).map(x => `<label style="display:flex;gap:8px;margin:6px 0;font-size:13px;"><input type="checkbox"> ${x}</label>`).join('');
  }
  const key = 'note_' + outil.id;
  const val = lectureOutil(key, '');
  return `<textarea id="om_note" class="input" style="height:130px;">${String(val).replace(/</g,'&lt;')}</textarea>
    <button class="btn-action" style="background:var(--success)" onclick="saveNoteUI('${key}')">💾 Enregistrer</button>`;
}

function runCalcMargeUI() {
  const c = +document.getElementById('om_cout').value || 0;
  const m = +document.getElementById('om_marge').value || 0;
  const p = c * (1 + m / 100);
  document.getElementById('om_res').textContent = 'Prix vente ≈ ' + p.toFixed(2) + ' (gain ≈ ' + (p - c).toFixed(2) + ')';
}
function runDevisUI() {
  const t = 'DEVIS\\nDe: ' + ((utilisateur && utilisateur.nom) || '') + '\\nPour: ' + (document.getElementById('om_client').value || '') + '\\n' + (document.getElementById('om_desig').value || '') + '\\nMontant: ' + (document.getElementById('om_montant').value || '');
  document.getElementById('om_out').value = t.replace(/\\\\n/g, '\\n');
  stockageOutil('devis', document.getElementById('om_out').value);
}
function runSommeUI() {
  document.getElementById('om_sum').textContent = 'Total : ' + (+om_a.value + +om_b.value + +om_c.value + +om_d.value);
}
function runTarifUI() {
  document.getElementById('om_tr').textContent = 'Prix suggéré : ' + (+om_base.value + +om_pk.value * +om_km.value);
}
function runInteretUI() {
  const i = (+om_cap.value) * (+om_tx.value / 100) * (+om_mo.value / 12);
  document.getElementById('om_ir').textContent = 'Intérêt ≈ ' + i.toFixed(2) + ' · Total ≈ ' + (+om_cap.value + i).toFixed(2);
}
function saveNoteUI(key) {
  stockageOutil(key, document.getElementById('om_note').value);
  alert('Enregistré.');
}

function stockAddLine() {
  const n = document.getElementById('om_sn')?.value?.trim();
  const q = parseFloat(document.getElementById('om_sq')?.value||'0')||0;
  if (!n) return;
  const lines = lectureOutil('stock', []) || [];
  lines.push({ n: n, q: q });
  stockageOutil('stock', lines);
  if (window._outilCourant) ouvrirOutilMetier(window._outilCourant.groupeId, window._outilCourant.outilId);
}
function stockAdj(i, d) {
  const lines = lectureOutil('stock', []) || [];
  if (!lines[i]) return;
  lines[i].q = (parseFloat(lines[i].q)||0) + d;
  stockageOutil('stock', lines);
  if (window._outilCourant) ouvrirOutilMetier(window._outilCourant.groupeId, window._outilCourant.outilId);
}
function caisseAdj(sens) {
  const m = parseFloat(document.getElementById('om_cm')?.value||'0')||0;
  const l = document.getElementById('om_cl')?.value || '';
  if (!m) return;
  let s = parseFloat(lectureOutil('caisse_s', 0))||0;
  s += sens * m;
  const h = lectureOutil('caisse_h', []) || [];
  h.unshift((sens>0?'+':'-')+m+' · '+l+' · '+s);
  stockageOutil('caisse_s', s);
  stockageOutil('caisse_h', h.slice(0, 20));
  if (window._outilCourant) ouvrirOutilMetier(window._outilCourant.groupeId, window._outilCourant.outilId);
}
function todoAdd(id) {
  const v = document.getElementById('om_ti')?.value?.trim();
  if (!v) return;
  const items = lectureOutil('todo_'+id, []) || [];
  items.unshift({ t: v, d: false });
  stockageOutil('todo_'+id, items);
  if (window._outilCourant) ouvrirOutilMetier(window._outilCourant.groupeId, window._outilCourant.outilId);
}
function todoTg(id, i) {
  const items = lectureOutil('todo_'+id, []) || [];
  if (items[i]) items[i].d = !items[i].d;
  stockageOutil('todo_'+id, items);
  if (window._outilCourant) ouvrirOutilMetier(window._outilCourant.groupeId, window._outilCourant.outilId);
}
function todoRm(id, i) {
  const items = lectureOutil('todo_'+id, []) || [];
  items.splice(i, 1);
  stockageOutil('todo_'+id, items);
  if (window._outilCourant) ouvrirOutilMetier(window._outilCourant.groupeId, window._outilCourant.outilId);
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
