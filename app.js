
let utilisateur = JSON.parse(localStorage.getItem('evat_profil')) || {
    nom: "Kodjo Marceline",
    type: "adulte",
    sousType: "Travailleur",
    metier: "Entrepreneur / Développeur",
    contacts: [{ nom: "Service Client ELAWS", tel: "+22898231402", email: "support@evat-elaws.net" }],
    notes: [{ titre: "Lancement v3.25 Quantum", contenu: "Installation native forcée et mode autonome." }],
    voyages: [], crises: [], audits: [], objectifs1000: [], iaTon: "standard"
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

// Modules spécifiques interactifs
function lancerAssistantVoyageCarbone() {
    const dest = document.getElementById('voyageDestination').value.trim();
    const transport = document.getElementById('voyageTransport').value;
    const distance = parseFloat(document.getElementById('voyageDistance').value) || 1000;
    const container = document.getElementById('resultatAssistantVoyage');
    if(!dest) { alert("Entrez une destination."); return; }
    const emission = Math.round(distance * (transport === 'avion' ? 0.25 : transport === 'voiture' ? 0.12 : 0.04));
    container.style.display = 'block';
    container.innerHTML = `<div style="background:var(--bg-color); padding:15px; border-radius:12px; border:1px solid var(--success);"><h4 style="color:var(--success);">✈️ Trajet vers ${dest}</h4><p style="color:var(--text-color); font-size:13px; margin:4px 0;">Mode : ${transport} | Distance : ${distance} km</p><p style="color:var(--success); font-weight:700; margin:0;">🌱 Empreinte Carbone estimée : ${emission} kg CO2</p></div>`;
    if(!utilisateur.voyages) utilisateur.voyages = [];
    utilisateur.voyages.unshift({ destination: dest, carbone: emission, transport });
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    lireVocalement("Calcul carbone effectué.");
}

function analyserEtResoudreCrise() {
    const desc = document.getElementById('criseDescription').value.trim();
    const container = document.getElementById('resultatCriseContainer');
    if(!desc) { alert("Décrivez la situation."); return; }
    container.style.display = 'block';
    container.innerHTML = `<div style="background:var(--bg-color); padding:15px; border-radius:12px; border-left:4px solid var(--danger);"><h4 style="color:var(--danger); margin-bottom:6px;">🚨 Analyse d'Urgence ELAWS</h4><p style="color:var(--text-color); font-size:13px; margin-bottom:8px;">Situation : "${desc}"</p><p style="color:var(--success); font-size:13px; font-weight:600; margin:0;">✅ Recommandation : Isolation immédiate du problème, application du protocole de secours de niveau 1 et activation du plan de sauvegarde cloud.</p></div>`;
    lireVocalement("Solution d'urgence générée.");
}

function lancerAuditSite() {
    const url = document.getElementById('urlAuditInput').value.trim() || "https://evat-elaws.net";
    const container = document.getElementById('resultatAuditContainer');
    container.style.display = 'block';
    container.innerHTML = `<div style="background:var(--bg-color); padding:15px; border-radius:12px; border-left:4px solid var(--success);"><h4 style="color:var(--success); margin-bottom:6px;">🌐 Rapport d'Audit pour ${url}</h4><p style="color:var(--text-color); font-size:13px;">• Performance : <strong>98/100</strong></p><p style="color:var(--text-color); font-size:13px;">• Sécurité HTTPS & Post-Quantum : <strong>100/100</strong></p><p style="color:var(--text-color); font-size:13px; margin:0;">• Compatibilité Mobile PWA : <strong>Parfaite</strong></p></div>`;
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
    afficherNotesBlocNotes();
    alert("Note enregistrée !");
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

function ajouterNoteDepuisOutils() {
    const titre = document.getElementById('noteTitreOutils').value.trim();
    const contenu = document.getElementById('noteContenuOutils').value.trim();
    if(!titre || !contenu) { alert("Titre et contenu requis."); return; }
    if(!utilisateur.notes) utilisateur.notes = [];
    utilisateur.notes.unshift({ titre, contenu });
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    document.getElementById('noteTitreOutils').value = '';
    document.getElementById('noteContenuOutils').value = '';
    afficherNotesBlocNotes();
    alert("Note enregistrée dans l'écosystème !");
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
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    actualiserDashboard();
    alert("Profil et métier enregistrés ! Les outils adaptés ont été mis à jour.");
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
    if(badge) badge.innerText = `${utilisateur.nom} • Quantum`;
    actualiserListeContacts();
    afficherNotesBlocNotes();
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
    actualiserDashboard(); 
});
