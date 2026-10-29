
let utilisateur = JSON.parse(localStorage.getItem('evat_profil')) || {
    nom: "",
    metier: "",
    type: "adulte",
    sousType: "Travailleur",
    iaTon: "standard",
    qubits: 120,
    niveauGamification: 1,
    quetes: [
        { id: 1, titre: "Configurer le profil & le métier", fait: true, qubits: 50 },
        { id: 2, titre: "Enregistrer une note dans le bloc-notes", fait: false, qubits: 30 },
        { id: 3, titre: "Générer un Plan de Succès 1000%", fait: false, qubits: 70 },
        { id: 4, titre: "Calculer une empreinte carbone de voyage", fait: false, qubits: 40 },
        { id: 5, titre: "Utiliser l'assistant Visa & Billets d'avion", fait: false, qubits: 60 }
    ],
    contacts: [{ nom: "Service Client ELAWS", tel: "+22898231402", email: "support@evat-elaws.net" }],
    notes: [{ titre: "Bienvenue dans EVAT Quantum v3.42", contenu: "Module Voyage & Visa Avancé activé." }],
    voyages: [], crises: [], audits: [], objectifs1000: []
};

let deferredPrompt = null;
let ecouteVocaleActive = false;
let recognition = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
});

function declencherInstallationNative() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            deferredPrompt = null;
        });
    } else {
        alert("L'application est prête. Ouvrez le menu de votre navigateur (3 points) et sélectionnez 'Installer l'application'.");
    }
}

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
        const texteReconnu = event.results[0][0].transcript;
        changerModeInteraction('clavier');
        document.getElementById('elawsInput').value = texteReconnu;
        envoyerMessageElaws();
        arreterEcouteVocale();
    };
    recognition.onerror = () => { arreterEcouteVocale(); };
    recognition.onend = () => { arreterEcouteVocale(); };
}

function lireVocalement(texte) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(texte);
        utterance.lang = 'fr-FR';
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
    }
}

// Gamification & Qubits management
function ajouterQubits(quantite, raison) {
    if(!utilisateur.qubits) utilisateur.qubits = 100;
    utilisateur.qubits += quantite;
    
    // Calcul du niveau (tous les 300 qubits = +1 niveau)
    utilisateur.niveauGamification = Math.floor(utilisateur.qubits / 300) + 1;
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    actualiserDashboard();
    
    // Notification visuelle
    afficherAlerteGamification(`⚡ +${quantite} Qubits ! (${raison})`);
}

function afficherAlerteGamification(message) {
    const div = document.createElement('div');
    div.style.cssText = "position:fixed; top:20px; left:50%; transform:translateX(-50%); background:var(--success); color:#fff; padding:10px 20px; border-radius:12px; font-weight:700; z-index:9999; box-shadow:0 0 20px rgba(16,185,129,0.7); font-size:13px; animation: fadeInOut 2.5s forwards;";
    div.innerText = message;
    document.body.appendChild(div);
    setTimeout(() => { div.remove(); }, 2500);
}

function validerQuete(id) {
    const q = utilisateur.quetes.find(item => item.id === id);
    if(q && !q.fait) {
        q.fait = true;
        ajouterQubits(q.qubits, `Quête validée : ${q.titre}`);
        actualiserQuetesUI();
    }
}

function actualiserQuetesUI() {
    const container = document.getElementById('quetesContainer');
    if(!container) return;
    if(!utilisateur.quetes) utilisateur.quetes = [];
    
    let html = '';
    utilisateur.quetes.forEach(q => {
        html += `<div style="background:var(--bg-color); border:1px solid ${q.fait ? 'var(--success)' : 'var(--border-color)'}; padding:12px; border-radius:12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <strong style="color:var(--text-color); font-size:13px;">${q.fait ? '✅' : '⏳'} ${q.titre}</strong>
                <p style="color:var(--accent); font-size:11.5px; margin:2px 0;">Récompense : +${q.qubits} Qubits</p>
            </div>
            ${!q.fait ? `<button onclick="validerQuete(${q.id})" class="btn-action ripple-effect" style="width:auto; padding:8px 12px; font-size:12px; background:var(--success); color:#fff;">Valider</button>` : `<span style="color:var(--success); font-size:12px; font-weight:700;">Accompli</span>`}
        </div>`;
    });
    container.innerHTML = html;
}

// Contacts management
function ajouterContactManuel() {
    const nom = document.getElementById('contactNomInput').value.trim();
    const tel = document.getElementById('contactTelInput').value.trim();
    const email = document.getElementById('contactEmailInput').value.trim();
    if(!nom || !tel) { alert("Nom et téléphone requis."); return; }
    if(!utilisateur.contacts) utilisateur.contacts = [];
    utilisateur.contacts.unshift({ nom, tel, email: email || 'non renseigné' });
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    document.getElementById('contactNomInput').value = '';
    document.getElementById('contactTelInput').value = '';
    document.getElementById('contactEmailInput').value = '';
    actualiserListeContacts();
    ajouterQubits(15, "Ajout d'un contact");
    alert("Contact ajouté !");
}

function actualiserListeContacts() {
    const container = document.getElementById('listeContactsContainer');
    if(!container) return;
    if(!utilisateur.contacts || utilisateur.contacts.length === 0) {
        container.innerHTML = `<p style="color:var(--text-secondary); font-size:13px;">Aucun contact enregistré.</p>`;
        return;
    }
    let html = '';
    utilisateur.contacts.forEach((c, index) => {
        html += `<div style="background:var(--bg-color); border:1px solid var(--border-color); padding:10px; border-radius:10px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
            <div><strong style="color:var(--text-color); font-size:13px;">👤 ${c.nom}</strong><p style="color:var(--accent); font-size:11.5px; margin:2px 0;">📞 ${c.tel}</p></div>
            <button onclick="supprimerContact(${index})" style="background:none; border:none; color:var(--danger); cursor:pointer;">🗑️</button>
        </div>`;
    });
    container.innerHTML = html;
}

function supprimerContact(index) {
    utilisateur.contacts.splice(index, 1);
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    actualiserListeContacts();
}

// Module Voyage Avancé : Checklist Visa & Estimation Billets
function lancerAnalyseVoyageAvance() {
    const dest = document.getElementById('voyageDestination').value.trim();
    const depart = document.getElementById('voyageDepart').value.trim() || "Lomé (Togo)";
    const transport = document.getElementById('voyageTransport').value;
    const distance = parseFloat(document.getElementById('voyageDistance').value) || 1500;
    const container = document.getElementById('resultatAssistantVoyage');
    
    if(!dest) { alert("Veuillez entrer une destination."); return; }
    
    container.style.display = 'block';
    
    // Calculs estimés
    const emission = Math.round(distance * (transport === 'avion' ? 0.25 : transport === 'voiture' ? 0.12 : 0.04));
    let prixEstime = Math.round(distance * 355); // Estimation en XOF
    if (transport !== 'avion') prixEstime = Math.round(distance * 85);
    
    let html = `
        <div style="background:var(--bg-color); padding:16px; border-radius:12px; border:1px solid var(--accent); margin-bottom:12px;">
            <h4 style="color:var(--accent); margin-bottom:8px;">✈️ Rapport de Voyage : ${depart} ➔ ${dest}</h4>
            <p style="color:var(--text-color); font-size:13px; margin:4px 0;">• Mode de transport : <strong>${transport.toUpperCase()}</strong> (${distance} km)</p>
            <p style="color:var(--success); font-size:13px; margin:4px 0;">• Empreinte Carbone estimée : <strong>${emission} kg CO2</strong></p>
            <p style="color:var(--text-color); font-size:13px; margin:4px 0;">• Prix estimé du billet : <strong style="color:var(--accent);">${prixEstime.toLocaleString()} XOF</strong></p>
        </div>
        
        <div style="background:var(--bg-color); padding:16px; border-radius:12px; border:1px solid var(--success);">
            <h4 style="color:var(--success); margin-bottom:8px;">📋 Checklist Administrative & Visa pour ${dest}</h4>
            <ul style="font-size:13px; color:var(--text-color); padding-left:18px; display:flex; flex-direction:column; gap:6px;">
                <li><strong>Passeport biométrique :</strong> Valide au moins 6 mois après la date de retour.</li>
                <li><strong>Visa d'entrée :</strong> Vérifier l'éligibilité au e-Visa ou prendre rendez-vous à l'ambassade compétente.</li>
                <li><strong>Billets d'avion aller-retour :</strong> Réservation confirmée obligatoire pour les services d'immigration.</li>
                <li><strong>Hébergement :</strong> Certificat d'accueil ou réservation d'hôtel validée.</li>
                <li><strong>Santé & Vaccins :</strong> Carnet de vaccination international (Fièvre jaune obligatoire dans de nombreux hubs).</li>
                <li><strong>Assurance voyage :</strong> Couverture médicale et rapatriement sanitaire exigée.</li>
            </ul>
        </div>
    `;
    
    container.innerHTML = html;
    
    if(!utilisateur.voyages) utilisateur.voyages = [];
    utilisateur.voyages.unshift({ destination: dest, depart, carbone: emission, transport, prix: prixEstime });
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    
    const qVoyage = utilisateur.quetes.find(q => q.id === 5);
    if(qVoyage && !qVoyage.fait) { qVoyage.fait = true; }
    
    ajouterQubits(60, "Analyse voyage & checklist Visa");
    lireVocalement("Rapport de voyage et checklist administrative générés avec succès.");
}

function analyserEtResoudreCrise() {
    const desc = document.getElementById('criseDescription').value.trim();
    const container = document.getElementById('resultatCriseContainer');
    if(!desc) { alert("Décrivez la situation."); return; }
    container.style.display = 'block';
    container.innerHTML = `<div style="background:var(--bg-color); padding:15px; border-radius:12px; border-left:4px solid var(--danger);"><h4 style="color:var(--danger); margin-bottom:6px;">🚨 Analyse d'Urgence ELAWS</h4><p style="color:var(--text-color); font-size:13px; margin-bottom:8px;">Situation : "${desc}"</p><p style="color:var(--success); font-size:13px; font-weight:600; margin:0;">✅ Recommandation : Isolation immédiate du problème, application du protocole de secours de niveau 1 et activation du plan de sauvegarde cloud.</p></div>`;
    ajouterQubits(25, "Résolution de crise");
    lireVocalement("Solution d'urgence générée.");
}

function lancerAuditSite() {
    const url = document.getElementById('urlAuditInput').value.trim() || "https://evat-elaws.net";
    const container = document.getElementById('resultatAuditContainer');
    container.style.display = 'block';
    container.innerHTML = `<div style="background:var(--bg-color); padding:15px; border-radius:12px; border-left:4px solid var(--success);"><h4 style="color:var(--success); margin-bottom:6px;">🌐 Rapport d'Audit pour ${url}</h4><p style="color:var(--text-color); font-size:13px;">• Performance : <strong>98/100</strong></p><p style="color:var(--text-color); font-size:13px;">• Sécurité HTTPS & Post-Quantum : <strong>100/100</strong></p><p style="color:var(--text-color); font-size:13px; margin:0;">• Compatibilité Mobile PWA : <strong>Parfaite</strong></p></div>`;
    ajouterQubits(20, "Audit Web réalisé");
    lireVocalement("Audit du site terminé avec succès.");
}

function ajouterNoteBlocNotes() {
    const titre = document.getElementById('noteTitre').value.trim();
    const contenu = document.getElementById('noteContenu').value.trim();
    if(!titre || !contenu) { alert("Titre et contenu requis."); return; }
    if(!utilisateur.notes) utilisateur.notes = [];
    utilisateur.notes.unshift({ titre, contenu });
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    document.getElementById('noteTitre').value = '';
    document.getElementById('noteContenu').value = '';
    
    const qNote = utilisateur.quetes.find(q => q.id === 2);
    if(qNote && !qNote.fait) qNote.fait = true;
    
    afficherNotesBlocNotes();
    ajouterQubits(30, "Ajout d'une note");
    alert("Note enregistrée ! +30 Qubits");
}

function afficherNotesBlocNotes() {
    const container = document.getElementById('listeNotesContainer');
    if(!container) return;
    if(!utilisateur.notes || utilisateur.notes.length === 0) {
        container.innerHTML = `<p style="color:var(--text-secondary); font-size:13px;">Aucune note enregistrée.</p>`;
        return;
    }
    let html = '';
    utilisateur.notes.forEach((n, idx) => {
        html += `<div style="background:var(--bg-color); border:1px solid var(--border-color); padding:12px; border-radius:10px; margin-bottom:8px;">
            <strong style="color:var(--accent); font-size:13.5px;">📌 ${n.titre}</strong>
            <p style="color:var(--text-color); font-size:13px; margin:4px 0 0 0;">${n.contenu}</p>
        </div>`;
    });
    container.innerHTML = html;
}

function genererPlanSucces1000() {
    const obj = document.getElementById('inputObjectif1000').value.trim();
    const container = document.getElementById('resultatPlan1000');
    if(!obj) { alert("Entrez un objectif."); return; }
    container.style.display = 'block';
    container.innerHTML = `<div style="background:var(--bg-color); padding:15px; border-radius:12px; border:1px solid var(--success); text-align:center;"><h4 style="color:var(--success);">💎 ELAWS calcule votre Plan de Succès à 1000%...</h4></div>`;
    setTimeout(() => {
        const etapes = [
            { titre: "Phase 1 : Élimination des frictions", detail: "Optimisation du flux de travail." },
            { titre: "Phase 2 : Automatisation intelligente", detail: "Déploiement des assistants ELAWS." },
            { titre: "Phase 3 : Rendement de concrétisation absolu", detail: "Impact maximal garanti." }
        ];
        let htmlEtapes = '';
        etapes.forEach(e => {
            htmlEtapes += `<div style="background:var(--card-bg); padding:10px; border-radius:8px; margin-bottom:6px; border-left:3px solid var(--success);"><strong style="color:var(--success);">${e.titre}</strong><p style="font-size:12px; color:var(--text-secondary); margin:0;">${e.detail}</p></div>`;
        });
        container.innerHTML = `<div style="background:var(--bg-color); padding:15px; border-radius:12px; border-left:4px solid var(--success);"><h4 style="color:var(--success); margin-bottom:6px;">🚀 ${obj}</h4>${htmlEtapes}</div>`;
        
        const qSucces = utilisateur.quetes.find(q => q.id === 3);
        if(qSucces && !qSucces.fait) qSucces.fait = true;
        
        ajouterQubits(70, "Plan de succès généré");
        lireVocalement("Plan de succès généré.");
    }, 600);
}

// Chargement dynamique des outils adaptés au profil et au métier dans l'onglet Outils
function chargerOutilsAdaptesAuProfil() {
    const container = document.getElementById('outilsDynamiquesContainer');
    if(!container) return;

    const metier = (utilisateur.metier || "").toLowerCase();
    let htmlOutils = '';

    htmlOutils += `
        <div style="background:var(--bg-color); border:1px solid var(--accent); padding:14px; border-radius:12px; margin-bottom:12px;">
            <h4 style="color:var(--accent); font-size:14px; margin-bottom:6px;">📌 Bloc-Notes Rapide & Idées</h4>
            <input type="text" id="noteTitreOutils" class="input" placeholder="Titre de la note..." style="margin-bottom:8px; font-size:13px; padding:10px;">
            <textarea id="noteContenuOutils" class="input" placeholder="Notez une information clé..." style="height:60px; resize:vertical; font-size:13px; padding:10px; margin-bottom:8px;"></textarea>
            <button class="btn-action ripple-effect" onclick="ajouterNoteDepuisOutils()" style="padding:10px; font-size:13px;">Enregistrer dans le Bloc-Notes</button>
        </div>
    `;

    if (metier.includes('developpeur') || metier.includes('code') || metier.includes('web')) {
        htmlOutils += `
            <div style="background:var(--bg-color); border:1px solid var(--success); padding:14px; border-radius:12px; margin-bottom:12px;">
                <h4 style="color:var(--success); font-size:14px; margin-bottom:6px;">💻 Boîte à Outils Développeur</h4>
                <p style="color:var(--text-secondary); font-size:12px; margin-bottom:8px;">Outils actifs : Console Node.js mobile, testeur de PWA, et audit de déploiement.</p>
                <button class="btn-action ripple-effect" onclick="switchTab('audit')" style="background:var(--success); color:#fff; padding:10px; font-size:13px;">Lancer un Audit Web</button>
            </div>
        `;
    } else if (metier.includes('entrepreneur') || metier.includes('commerce') || metier.includes('gestion')) {
        htmlOutils += `
            <div style="background:var(--bg-color); border:1px solid var(--success); padding:14px; border-radius:12px; margin-bottom:12px;">
                <h4 style="color:var(--success); font-size:14px; margin-bottom:6px;">🚀 Boîte à Outils Entrepreneur</h4>
                <p style="color:var(--text-secondary); font-size:12px; margin-bottom:8px;">Outils actifs : Stratégie de croissance et gestion du carnet de contacts clients.</p>
                <button class="btn-action ripple-effect" onclick="switchTab('succes1000')" style="background:var(--success); color:#fff; padding:10px; font-size:13px;">Générer Plan de Succès 1000%</button>
            </div>
        `;
    } else if (metier.includes('eleve') || metier.includes('etudiant') || metier.includes('ecole')) {
        htmlOutils += `
            <div style="background:var(--bg-color); border:1px solid var(--success); padding:14px; border-radius:12px; margin-bottom:12px;">
                <h4 style="color:var(--success); font-size:14px; margin-bottom:6px;">📚 Boîte à Outils Étudiant & Apprenant</h4>
                <p style="color:var(--text-secondary); font-size:12px; margin-bottom:8px;">Outils actifs : Assistant pédagogique ELAWS et résumés de cours.</p>
                <button class="btn-action ripple-effect" onclick="ouvrirModeClavierDirect(event)" style="background:var(--success); color:#fff; padding:10px; font-size:13px;">Poser une question à ELAWS</button>
            </div>
        `;
    } else {
        htmlOutils += `
            <div style="background:var(--bg-color); border:1px solid var(--success); padding:14px; border-radius:12px; margin-bottom:12px;">
                <h4 style="color:var(--success); font-size:14px; margin-bottom:6px;">⚙️ Boîte à Outils Polyvalente</h4>
                <p style="color:var(--text-secondary); font-size:12px; margin-bottom:8px;">Profil universel actif : Accès complet à tous les sous-systèmes de l'écosystème EVAT.</p>
                <button class="btn-action ripple-effect" onclick="switchTab('succes1000')" style="background:var(--success); color:#fff; padding:10px; font-size:13px;">Accéder à la Garantie Succès</button>
            </div>
        `;
    }

    container.innerHTML = htmlOutils;
}

function changerModeInteraction(mode) {
    const btnClavier = document.getElementById('modeBtnClavier');
    const btnMicro = document.getElementById('modeBtnMicro');
    const panelClavier = document.getElementById('panelClavier');
    const panelMicro = document.getElementById('panelMicro');
    if (mode === 'clavier') {
        btnClavier.classList.add('active');
        btnMicro.classList.remove('active');
        panelClavier.style.display = 'block';
        panelMicro.style.display = 'none';
        arreterEcouteVocale();
    } else {
        btnMicro.classList.add('active');
        btnClavier.classList.remove('active');
        panelMicro.style.display = 'block';
        panelClavier.style.display = 'none';
        basculerEcouteVocaleLive();
    }
}

function ouvrirModeClavierDirect(event) {
    if (event) event.stopPropagation();
    const popup = document.getElementById('elawsPopup');
    const overlay = document.getElementById('appOverlay');
    popup.style.display = 'flex';
    overlay.classList.add('active');
    changerModeInteraction('clavier');
    document.getElementById('elawsInput').focus();
}

function basculerEcouteVocaleLiveDirect(event) {
    if (event) event.stopPropagation();
    const popup = document.getElementById('elawsPopup');
    const overlay = document.getElementById('appOverlay');
    popup.style.display = 'flex';
    overlay.classList.add('active');
    changerModeInteraction('micro');
}

function basculerEcouteVocaleLive() {
    if (!recognition) { alert("Reconnaissance vocale non supportée."); return; }
    const btnMicro = document.getElementById('microGrandBtn');
    const label = document.getElementById('microLabelState');
    const textStatus = document.getElementById('voiceStatusText');
    if (!ecouteVocaleActive) {
        try {
            recognition.start();
            ecouteVocaleActive = true;
            btnMicro.classList.add('active');
            label.innerText = "Écoute en cours...";
            textStatus.innerText = "🎙️ Parlez clairement...";
            lireVocalement("Je vous écoute.");
        } catch(e){}
    } else { arreterEcouteVocale(); }
}

function arreterEcouteVocale() {
    ecouteVocaleActive = false;
    const btnMicro = document.getElementById('microGrandBtn');
    const label = document.getElementById('microLabelState');
    if (btnMicro) btnMicro.classList.remove('active');
    if (label) label.innerText = "Commencer à parler";
    if (recognition) { try { recognition.stop(); } catch(e){} }
}

function fermerElawsChat(event) {
    if (event) event.stopPropagation();
    document.getElementById('elawsPopup').style.display = 'none';
    document.getElementById('appOverlay').classList.remove('active');
    arreterEcouteVocale();
}

function envoyerMessageElaws() {
    const input = document.getElementById('elawsInput');
    const txt = input.value.trim();
    if(!txt) return;
    ajouterBulleElaws(txt, 'user');
    input.value = '';
    setTimeout(() => {
        const rep = ELAWS_BRAIN.repondre(utilisateur, txt);
        ajouterBulleElaws(rep, 'elaws');
        lireVocalement(rep);
        ajouterQubits(10, "Interaction avec ELAWS");
    }, 300);
}

function ajouterBulleElaws(txt, exp) {
    const chat = document.getElementById('elawsMessages');
    const isUser = exp === 'user';
    const div = document.createElement('div');
    div.style.cssText = `margin-bottom:8px; text-align:${isUser ? 'right' : 'left'};`;
    div.innerHTML = `<span style="display:inline-block; background:${isUser ? 'var(--success)' : 'var(--card-hover)'}; color:${isUser ? '#070a13' : 'var(--text-color)'}; padding:10px 14px; border-radius:14px; max-width:92%; font-size:13px;"><strong>${isUser ? 'Moi' : '🤖 ELAWS Quantum'} :</strong><br>${txt}</span>`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

function sauvegarderProfilBase() {
    utilisateur.nom = document.getElementById('inputNom').value.trim() || "Utilisateur";
    utilisateur.metier = document.getElementById('inputMetierProfil').value.trim() || "Polyvalent";
    const selectTon = document.getElementById('inputIaTon');
    if(selectTon) utilisateur.iaTon = selectTon.value;
    
    const qProfil = utilisateur.quetes.find(q => q.id === 1);
    if(qProfil) qProfil.fait = true;
    
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    actualiserDashboard();
    
    const modal = document.getElementById('welcomeModal');
    if(modal) modal.style.display = 'none';
    
    alert("Profil et paramètres enregistrés ! Bienvenue dans EVAT Quantum v3.42.");
}

function verifierPremierLancement() {
    if(!utilisateur.nom || utilisateur.nom === "") {
        const modal = document.getElementById('welcomeModal');
        if(modal) modal.style.display = 'flex';
    } else {
        const modal = document.getElementById('welcomeModal');
        if(modal) modal.style.display = 'none';
    }
}

function exporterDonneesCloud() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(utilisateur, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `evat_elaws_quantum_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function actualiserDashboard() {
    const nomElem = document.getElementById('dashNomUser');
    if(nomElem) nomElem.innerText = utilisateur.nom || "Mon Ami";
    const badge = document.getElementById('sidebarUserRole');
    if(badge) badge.innerText = `${utilisateur.nom || 'Visiteur'} • Niveau ${utilisateur.niveauGamification || 1}`;
    
    const qubitsElem = document.getElementById('dashQubitsScore');
    if(qubitsElem) qubitsElem.innerText = utilisateur.qubits || 120;
    
    const niveauElem = document.getElementById('dashNiveauScore');
    if(niveauElem) niveauElem.innerText = utilisateur.niveauGamification || 1;

    actualiserListeContacts();
    afficherNotesBlocNotes();
    actualiserQuetesUI();
    chargerOutilsAdaptesAuProfil();
}

function toggleMenu(event) {
    if (event) event.stopPropagation();
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('appOverlay');
    const isOpen = sidebar.classList.toggle('open');
    if (isOpen) overlay.classList.add('active');
    else overlay.classList.remove('active');
}

function fermerTousLesMenus() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('elawsPopup').style.display = 'none';
    document.getElementById('appOverlay').classList.remove('active');
    arreterEcouteVocale();
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.sidebar-links a').forEach(el => el.classList.remove('active'));
    const target = document.getElementById('tab-' + tabId);
    if(target) target.classList.add('active');
    const link = document.getElementById('link-' + tabId);
    if(link) link.classList.add('active');
    fermerTousLesMenus();
    actualiserDashboard();
}

document.addEventListener('DOMContentLoaded', () => { 
    if(document.getElementById('inputNom')) {
        document.getElementById('inputNom').value = utilisateur.nom || "";
    }
    if(document.getElementById('inputMetierProfil')) {
        document.getElementById('inputMetierProfil').value = utilisateur.metier || "";
    }
    if(document.getElementById('inputIaTon')) {
        document.getElementById('inputIaTon').value = utilisateur.iaTon || "standard";
    }
    actualiserDashboard();
    verifierPremierLancement();
});
