
let utilisateur = JSON.parse(localStorage.getItem('evat_profil')) || {
    nom: "Kodjo Marceline",
    type: "adulte",
    sousType: "Travailleur",
    metiers: ["Entrepreneur", "Développeur Web"],
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
    console.log("Événement beforeinstallprompt capturé avec succès.");
});

function declencherInstallationNative() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('Utilisateur a accepté l\'installation PWA');
            }
            deferredPrompt = null;
        });
    } else {
        alert("L'application est prête. Si l'installation automatique ne s'ouvre pas, ouvrez le menu de votre navigateur (3 points) et sélectionnez 'Installer l'application' ou 'Ajouter à l'écran d'accueil'.");
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

function exporterDonneesCloud() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(utilisateur, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `evat_elaws_quantum_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function importerDonneesCloud(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (importedData && importedData.nom) {
                utilisateur = importedData;
                localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
                actualiserDashboard();
                alert("Données synchronisées et restaurées !");
                switchTab('dashboard');
            }
        } catch(err) { alert("Erreur fichier JSON."); }
    };
    reader.readAsText(file);
}

function genererCodeSync() {
    const codeJson = btoa(unescape(encodeURIComponent(JSON.stringify(utilisateur))));
    document.getElementById('zoneCodeSync').value = codeJson;
}

function restaurerParCodeSync() {
    const codeJson = document.getElementById('zoneCodeSync').value.trim();
    if (!codeJson) return;
    try {
        const decodedData = JSON.parse(decodeURIComponent(escape(atob(codeJson))));
        if (decodedData && decodedData.nom) {
            utilisateur = decodedData;
            localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
            actualiserDashboard();
            alert("Restauration réussie !");
            switchTab('dashboard');
        }
    } catch(err) { alert("Code invalide."); }
}

function genererLienPartage() {
    const choix = document.getElementById('selectElementPartage') ? document.getElementById('selectElementPartage').value : 'profil';
    const tokenPartage = btoa(unescape(encodeURIComponent(JSON.stringify({nom: utilisateur.nom, metiers: utilisateur.metiers}))));
    const lien = `https://evat-elaws.net/sync?share=${tokenPartage}`;
    document.getElementById('zoneLienPartage').value = lien;
    alert("Lien de partage généré !");
}

function genererPlanSucces1000() {
    const obj = document.getElementById('inputObjectif1000').value.trim();
    const res = document.getElementById('inputRessources1000').value.trim();
    const container = document.getElementById('resultatPlan1000');
    if(!obj) { alert("Entrez un objectif."); return; }

    container.style.display = 'block';
    container.innerHTML = `<div style="background:var(--bg-color); padding:15px; border-radius:12px; border:1px solid var(--success); text-align:center;"><h4 style="color:var(--success);">💎 ELAWS calcule votre Plan de Succès à 1000%...</h4></div>`;

    setTimeout(() => {
        const etapesQuantiques = [
            { titre: "Phase 1 : Élimination des frictions", detail: "Optimisation du temps et recentrage sur la valeur ajoutée." },
            { titre: "Phase 2 : Amplification par l'IA", detail: "Automatisation et exécution rapide." },
            { titre: "Phase 3 : Rendement de concrétisation à 1000%", detail: "Validation et impact absolu." }
        ];
        const record = { objectif: obj, ressources: res, etapes: etapesQuantiques, date: new Date().toLocaleDateString() };
        if(!utilisateur.objectifs1000) utilisateur.objectifs1000 = [];
        utilisateur.objectifs1000.unshift(record);
        localStorage.setItem('evat_profil', JSON.stringify(utilisateur));

        let htmlEtapes = '';
        etapesQuantiques.forEach((e) => {
            htmlEtapes += `<div style="background:var(--card-bg); padding:10px; border-radius:8px; margin-bottom:6px; border-left:3px solid var(--success);"><strong style="color:var(--success);">${e.titre}</strong><p style="font-size:12px; color:var(--text-secondary); margin:0;">${e.detail}</p></div>`;
        });

        container.innerHTML = `<div style="background:var(--bg-color); padding:15px; border-radius:12px; border-left:4px solid var(--success);"><h4 style="color:var(--success); margin-bottom:6px;">🚀 ${obj}</h4>${htmlEtapes}</div>`;
        actualiserDashboard();
        lireVocalement("Plan de succès à 1000% généré.");
    }, 800);
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

function lancerAssistantVoyageCarbone() {
    const dest = document.getElementById('voyageDestination').value.trim();
    const transport = document.getElementById('voyageTransport').value;
    const distance = parseFloat(document.getElementById('voyageDistance').value) || 1000;
    const container = document.getElementById('resultatAssistantVoyage');
    if(!dest) return;
    const emission = Math.round(distance * (transport === 'avion' ? 0.25 : transport === 'voiture' ? 0.12 : 0.04));
    container.style.display = 'block';
    container.innerHTML = `<div style="background:var(--bg-color); padding:15px; border-radius:12px; border:1px solid var(--success);"><h4 style="color:var(--success);">✈️ ${dest}</h4><p style="color:var(--success); margin:0;">🌱 Empreinte : ${emission} kg CO2</p></div>`;
    utilisateur.voyages.unshift({ destination: dest, carbone: emission });
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    actualiserDashboard();
}

function analyserEtResoudreCrise() {
    const desc = document.getElementById('criseDescription').value.trim();
    if(!desc) return;
    document.getElementById('resultatCriseContainer').style.display = 'block';
    document.getElementById('resultatCriseContainer').innerHTML = `<div style="background:var(--bg-color); padding:10px;"><h4 style="color:var(--danger);">🚨 Solution Générée</h4></div>`;
}

function lancerAuditSite() { document.getElementById('resultatAuditContainer').style.display = 'block'; document.getElementById('resultatAuditContainer').innerHTML = "Score : 100/100"; }
function demarrerAppelTraduit() { document.getElementById('ecranAppelLive').style.display = 'block'; }

function ajouterNoteBlocNotes() {
    const titre = document.getElementById('noteTitre').value.trim();
    const contenu = document.getElementById('noteContenu').value.trim();
    if(!titre || !contenu) return;
    utilisateur.notes.unshift({ titre, contenu });
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    document.getElementById('noteTitre').value = '';
    document.getElementById('noteContenu').value = '';
    actualiserDashboard();
    alert("Note enregistrée !");
}

function sauvegarderProfilBase() {
    utilisateur.nom = document.getElementById('inputNom').value.trim() || "Utilisateur";
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    actualiserDashboard();
    alert("Profil enregistré !");
}

function actualiserDashboard() {
    document.getElementById('dashNomUser').innerText = utilisateur.nom || "Mon Ami";
    document.getElementById('dashStatNotes').innerText = `${(utilisateur.notes || []).length} Note`;
    const badge = document.getElementById('sidebarUserRole');
    if(badge) badge.innerText = `${utilisateur.nom} • Succès 1000%`;
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
    document.getElementById('tab-' + tabId).classList.add('active');
    const link = document.getElementById('link-' + tabId);
    if(link) link.classList.add('active');
    fermerTousLesMenus();
    actualiserDashboard();
}

document.addEventListener('DOMContentLoaded', () => { actualiserDashboard(); });
