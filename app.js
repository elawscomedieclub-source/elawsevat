const EVAT_VERSION_ACTUELLE = "v3.47";

let versionEnregistree = localStorage.getItem('evat_version_app');

if (versionEnregistree !== EVAT_VERSION_ACTUELLE) {
    let ancienProfil = JSON.parse(localStorage.getItem('evat_profil'));
    if (ancienProfil) {
        ancienProfil.quetes = [
            { id: 1, titre: "Configurer le profil & le métier", fait: true, qubits: 50 },
            { id: 2, titre: "Enregistrer une note dans le bloc-notes", fait: false, qubits: 30 },
            { id: 3, titre: "Générer un Plan de Succès 1000%", fait: false, qubits: 70 },
            { id: 4, titre: "Calculer une empreinte carbone de voyage", fait: false, qubits: 40 },
            { id: 5, titre: "Utiliser l'assistant Visa & Billets d'avion", fait: false, qubits: 60 }
        ];
        localStorage.setItem('evat_profil', JSON.stringify(ancienProfil));
    }
    localStorage.setItem('evat_version_app', EVAT_VERSION_ACTUELLE);
    window.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => { afficherNotificationMiseAJour(EVAT_VERSION_ACTUELLE); }, 500);
    });
}

function afficherNotificationMiseAJour(version) {
    const div = document.createElement('div');
    div.style.cssText = "position:fixed; top:20px; left:50%; transform:translateX(-50%); background:var(--success); color:#fff; padding:10px 20px; border-radius:12px; font-weight:700; z-index:9999; box-shadow:0 0 20px rgba(16,185,129,0.8); font-size:13px; text-align:center;";
    div.innerHTML = `🚀 Application mise à jour vers ${version} !<br><span style="font-size:11px; font-weight:400;">Logo quantique intégré avec éclat.</span>`;
    document.body.appendChild(div);
    setTimeout(() => { div.remove(); }, 3500);
}

let utilisateur = JSON.parse(localStorage.getItem('evat_profil')) || {
    nom: "",
    metier: "",
    type: "adulte",
    sousType: "Travailleur",
    iaTon: "standard",
    qubits: 170,
    niveauGamification: 1,
    quetes: [
        { id: 1, titre: "Configurer le profil & le métier", fait: true, qubits: 50 },
        { id: 2, titre: "Enregistrer une note dans le bloc-notes", fait: false, qubits: 30 },
        { id: 3, titre: "Générer un Plan de Succès 1000%", fait: false, qubits: 70 },
        { id: 4, titre: "Calculer une empreinte carbone de voyage", fait: false, qubits: 40 },
        { id: 5, titre: "Utiliser l'assistant Visa & Billets d'avion", fait: false, qubits: 60 }
    ],
    contacts: [{ nom: "Service Client ELAWS", tel: "+22898231402", email: "support@evat-elaws.net" }],
    notes: [{ titre: "Bienvenue dans EVAT Quantum v3.47", contenu: "Logo quantique intégré à l'application." }],
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
        deferredPrompt.userChoice.then(() => { deferredPrompt = null; });
    } else {
        alert("Ouvrez le menu de votre navigateur (3 points) et sélectionnez 'Installer l'application'.");
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

function ajouterQubits(quantite, raison) {
    if(!utilisateur.qubits) utilisateur.qubits = 100;
    utilisateur.qubits += quantite;
    utilisateur.niveauGamification = Math.floor(utilisateur.qubits / 300) + 1;
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    actualiserDashboard();
    afficherAlerteGamification(`⚡ +${quantite} Qubits ! (${raison})`);
}

function afficherAlerteGamification(message) {
    const div = document.createElement('div');
    div.style.cssText = "position:fixed; top:20px; left:50%; transform:translateX(-50%); background:var(--success); color:#fff; padding:10px 18px; border-radius:10px; font-weight:700; z-index:9999; box-shadow:0 0 15px rgba(16,185,129,0.7); font-size:12.5px;";
    div.innerText = message;
    document.body.appendChild(div);
    setTimeout(() => { div.remove(); }, 2200);
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
        html += `<div style="background:var(--bg-color); border:1px solid ${q.fait ? 'var(--success)' : 'var(--border-color)'}; padding:10px; border-radius:10px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <strong style="color:var(--text-color); font-size:12.5px;">${q.fait ? '✅' : '⏳'} ${q.titre}</strong>
                <p style="color:var(--accent); font-size:11px; margin:2px 0;">Récompense : +${q.qubits} Qubits</p>
            </div>
            ${!q.fait ? `<button onclick="validerQuete(${q.id})" class="btn-action ripple-effect" style="width:auto; padding:6px 10px; font-size:11.5px; background:var(--success); color:#fff;">Valider</button>` : `<span style="color:var(--success); font-size:11.5px; font-weight:700;">Accompli</span>`}
        </div>`;
    });
    container.innerHTML = html;
}

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
        container.innerHTML = `<p style="color:var(--text-secondary); font-size:12.5px;">Aucun contact enregistré.</p>`;
        return;
    }
    let html = '';
    utilisateur.contacts.forEach((c, index) => {
        html += `<div style="background:var(--bg-color); border:1px solid var(--border-color); padding:8px 10px; border-radius:8px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
            <div><strong style="color:var(--text-color); font-size:12.5px;">👤 ${c.nom}</strong><p style="color:var(--accent); font-size:11px; margin:2px 0;">📞 ${c.tel}</p></div>
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

function lancerAnalyseVoyageAvance() {
    const dest = document.getElementById('voyageDestination').value.trim();
    const depart = document.getElementById('voyageDepart').value.trim() || "Lomé (Togo)";
    const transport = document.getElementById('voyageTransport').value;
    const distance = parseFloat(document.getElementById('voyageDistance').value) || 1500;
    const container = document.getElementById('resultatAssistantVoyage');
    if(!dest) { alert("Veuillez entrer une destination."); return; }
    container.style.display = 'block';
    const emission = Math.round(distance * (transport === 'avion' ? 0.25 : transport === 'voiture' ? 0.12 : 0.04));
    let prixEstime = Math.round(distance * 355);
    if (transport !== 'avion') prixEstime = Math.round(distance * 85);
    
    container.innerHTML = `
        <div style="background:var(--bg-color); padding:14px; border-radius:10px; border:1px solid var(--accent); margin-bottom:10px;">
            <h4 style="color:var(--accent); margin-bottom:6px; font-size:13.5px;">✈️ Rapport de Voyage : ${depart} ➔ ${dest}</h4>
            <p style="color:var(--text-color); font-size:12.5px; margin:3px 0;">• Transport : <strong>${transport.toUpperCase()}</strong> (${distance} km)</p>
            <p style="color:var(--success); font-size:12.5px; margin:3px 0;">• Empreinte Carbone : <strong>${emission} kg CO2</strong></p>
            <p style="color:var(--text-color); font-size:12.5px; margin:3px 0;">• Prix estimé : <strong style="color:var(--accent);">${prixEstime.toLocaleString()} XOF</strong></p>
        </div>
        <div style="background:var(--bg-color); padding:14px; border-radius:10px; border:1px solid var(--success);">
            <h4 style="color:var(--success); margin-bottom:6px; font-size:13.5px;">📋 Checklist Visa & Formalités</h4>
            <ul style="font-size:12.5px; color:var(--text-color); padding-left:16px; display:flex; flex-direction:column; gap:4px;">
                <li>Passeport biométrique valide (6 mois min.)</li>
                <li>Visa / e-Visa pour ${dest}</li>
                <li>Billets aller-retour confirmés</li>
                <li>Certificat de vaccination (Fièvre jaune)</li>
            </ul>
        </div>`;
    
    if(!utilisateur.voyages) utilisateur.voyages = [];
    utilisateur.voyages.unshift({ destination: dest, depart, carbone: emission, transport, prix: prixEstime });
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    
    const qVoyage = utilisateur.quetes.find(q => q.id === 5);
    if(qVoyage && !qVoyage.fait) qVoyage.fait = true;
    ajouterQubits(60, "Analyse voyage & checklist Visa");
}

function analyserEtResoudreCrise() {
    const desc = document.getElementById('criseDescription').value.trim();
    const container = document.getElementById('resultatCriseContainer');
    if(!desc) { alert("Décrivez la situation."); return; }
    container.style.display = 'block';
    container.innerHTML = `<div style="background:var(--bg-color); padding:12px; border-radius:10px; border-left:4px solid var(--danger);"><h4 style="color:var(--danger); margin-bottom:4px; font-size:13.5px;">🚨 Diagnostic ELAWS</h4><p style="color:var(--text-color); font-size:12.5px; margin-bottom:6px;">"${desc}"</p><p style="color:var(--success); font-size:12.5px; font-weight:600; margin:0;">✅ Action recommandée : Isolation du processus, redémarrage du service de niveau 1 et synchronisation cloud de secours.</p></div>`;
    ajouterQubits(25, "Résolution de crise");
}

function lancerAuditSite() {
    const url = document.getElementById('urlAuditInput').value.trim() || "https://evat-elaws.net";
    const container = document.getElementById('resultatAuditContainer');
    container.style.display = 'block';
    container.innerHTML = `<div style="background:var(--bg-color); padding:12px; border-radius:10px; border-left:4px solid var(--success);"><h4 style="color:var(--success); margin-bottom:4px; font-size:13.5px;">🌐 Audit pour ${url}</h4><p style="color:var(--text-color); font-size:12.5px;">• Performance : <strong>99/100</strong></p><p style="color:var(--text-color); font-size:12.5px;">• Sécurité Post-Quantum : <strong>100/100</strong></p><p style="color:var(--text-color); font-size:12.5px; margin:0;">• Compatibilité PWA Mobile : <strong>Optimale</strong></p></div>`;
    ajouterQubits(20, "Audit Web réalisé");
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
        container.innerHTML = `<p style="color:var(--text-secondary); font-size:12.5px;">Aucune note enregistrée.</p>`;
        return;
    }
    let html = '';
    utilisateur.notes.forEach((n) => {
        html += `<div style="background:var(--bg-color); border:1px solid var(--border-color); padding:10px; border-radius:8px; margin-bottom:6px;">
            <strong style="color:var(--accent); font-size:13px;">📌 ${n.titre}</strong>
            <p style="color:var(--text-color); font-size:12.5px; margin:3px 0 0 0;">${n.contenu}</p>
        </div>`;
    });
    container.innerHTML = html;
}

function genererPlanSucces1000() {
    const obj = document.getElementById('inputObjectif1000').value.trim();
    const container = document.getElementById('resultatPlan1000');
    if(!obj) { alert("Entrez un objectif."); return; }
    container.style.display = 'block';
    container.innerHTML = `<div style="background:var(--bg-color); padding:12px; border-radius:10px; border:1px solid var(--success); text-align:center;"><h4 style="color:var(--success); font-size:13.5px;">💎 ELAWS calcule votre Plan 1000%...</h4></div>`;
    setTimeout(() => {
        container.innerHTML = `<div style="background:var(--bg-color); padding:12px; border-radius:10px; border-left:4px solid var(--success);"><h4 style="color:var(--success); margin-bottom:6px; font-size:13.5px;">🚀 ${obj}</h4><p style="font-size:12.5px; color:var(--text-color);">• Phase 1 : Suppression des frictions<br>• Phase 2 : Automatisation intelligente ELAWS<br>• Phase 3 : Concrétisation à haut rendement</p></div>`;
        const qSucces = utilisateur.quetes.find(q => q.id === 3);
        if(qSucces && !qSucces.fait) qSucces.fait = true;
        ajouterQubits(70, "Plan de succès généré");
    }, 500);
}

function chargerOutilsAdaptesAuProfil() {
    const container = document.getElementById('outilsDynamiquesContainer');
    if(!container) return;
    const metier = (utilisateur.metier || "").toLowerCase();
    let htmlOutils = `
        <div style="background:var(--bg-color); border:1px solid var(--accent); padding:12px; border-radius:10px; margin-bottom:10px;">
            <h4 style="color:var(--accent); font-size:13px; margin-bottom:6px;">📌 Bloc-Notes Rapide</h4>
            <input type="text" id="noteTitreOutils" class="input" placeholder="Titre..." style="margin-bottom:6px; font-size:12.5px; padding:8px;">
            <textarea id="noteContenuOutils" class="input" placeholder="Idée clé..." style="height:50px; resize:vertical; font-size:12.5px; padding:8px; margin-bottom:6px;"></textarea>
            <button class="btn-action ripple-effect" onclick="ajouterNoteDepuisOutils()" style="padding:8px; font-size:12.5px;">Enregistrer</button>
        </div>
    `;
    if (metier.includes('developpeur') || metier.includes('code') || metier.includes('web')) {
        htmlOutils += `<div style="background:var(--bg-color); border:1px solid var(--success); padding:12px; border-radius:10px;"><h4 style="color:var(--success); font-size:13px; margin-bottom:4px;">💻 Boîte Développeur</h4><p style="color:var(--text-secondary); font-size:11.5px; margin-bottom:6px;">Console Node.js mobile & test PWA actifs.</p><button class="btn-action ripple-effect" onclick="switchTab('audit')" style="background:var(--success); color:#fff; padding:8px; font-size:12.5px;">Lancer Audit Web</button></div>`;
    } else {
        htmlOutils += `<div style="background:var(--bg-color); border:1px solid var(--success); padding:12px; border-radius:10px;"><h4 style="color:var(--success); font-size:13px; margin-bottom:4px;">🚀 Boîte Polyvalente</h4><p style="color:var(--text-secondary); font-size:11.5px; margin-bottom:6px;">Accès universel à tous les modules.</p><button class="btn-action ripple-effect" onclick="switchTab('succes1000')" style="background:var(--success); color:#fff; padding:8px; font-size:12.5px;">Garantie Succès</button></div>`;
    }
    container.innerHTML = htmlOutils;
}

function ajouterNoteDepuisOutils() {
    const titre = document.getElementById('noteTitreOutils').value.trim();
    const contenu = document.getElementById('noteContenuOutils').value.trim();
    if(!titre || !contenu) { alert("Remplissez le titre et le contenu."); return; }
    if(!utilisateur.notes) utilisateur.notes = [];
    utilisateur.notes.unshift({ titre, contenu });
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    document.getElementById('noteTitreOutils').value = '';
    document.getElementById('noteContenuOutils').value = '';
    afficherNotesBlocNotes();
    alert("Note enregistrée !");
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
    document.getElementById('elawsPopup').style.display = 'flex';
    document.getElementById('appOverlay').classList.add('active');
    changerModeInteraction('clavier');
    document.getElementById('elawsInput').focus();
}

function basculerEcouteVocaleLiveDirect(event) {
    if (event) event.stopPropagation();
    document.getElementById('elawsPopup').style.display = 'flex';
    document.getElementById('appOverlay').classList.add('active');
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
        ajouterQubits(10, "Interaction ELAWS");
    }, 250);
}

function ajouterBulleElaws(txt, exp) {
    const chat = document.getElementById('elawsMessages');
    const isUser = exp === 'user';
    const div = document.createElement('div');
    div.style.cssText = `margin-bottom:6px; text-align:${isUser ? 'right' : 'left'};`;
    div.innerHTML = `<span style="display:inline-block; background:${isUser ? 'var(--success)' : 'var(--card-hover)'}; color:${isUser ? '#030712' : 'var(--text-color)'}; padding:8px 12px; border-radius:12px; max-width:92%; font-size:12.5px;"><strong>${isUser ? 'Moi' : '🤖 ELAWS'} :</strong><br>${txt}</span>`;
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
    alert("Profil enregistré !");
}

function verifierPremierLancement() {
    const modal = document.getElementById('welcomeModal');
    if(!utilisateur.nom || utilisateur.nom === "") {
        if(modal) modal.style.display = 'flex';
    } else {
        if(modal) modal.style.display = 'none';
    }
}

function exporterDonneesCloud() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(utilisateur, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `evat_backup_${new Date().toISOString().slice(0,10)}.json`);
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
    if(qubitsElem) qubitsElem.innerText = utilisateur.qubits || 170;
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
    if(document.getElementById('inputNom')) document.getElementById('inputNom').value = utilisateur.nom || "";
    if(document.getElementById('inputMetierProfil')) document.getElementById('inputMetierProfil').value = utilisateur.metier || "";
    if(document.getElementById('inputIaTon')) document.getElementById('inputIaTon').value = utilisateur.iaTon || "standard";
    actualiserDashboard();
    verifierPremierLancement();
});
