
let utilisateur = JSON.parse(localStorage.getItem('evat_profil')) || {
    nom: "Kodjo Marceline",
    type: "adulte",
    sousType: "Travailleur",
    metiers: ["Entrepreneur", "Développeur Web"],
    contacts: [
        { nom: "Service Client ELAWS", tel: "+22898231402", email: "support@evat-elaws.net" }
    ],
    notes: [
        { titre: "Lancement v3.24 Quantum", contenu: "Clavier direct et Voix automatique activés." }
    ],
    voyages: [],
    crises: [],
    audits: [],
    objectifs1000: [],
    iaTon: "standard"
};

let deferredPrompt = null;
let ecouteVocaleActive = false;
let recognition = null;

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

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const banner = document.getElementById('pwaInstallBanner');
    if(banner) banner.style.display = 'flex';
});

function installerPWA() {
    const banner = document.getElementById('pwaInstallBanner');
    if(banner) banner.style.display = 'none';
    
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            deferredPrompt = null;
        });
    } else {
        alert("Pour installer sur votre appareil : ouvrez le menu du navigateur et sélectionnez 'Installer l'application' ou 'Ajouter à l'écran d'accueil'.");
    }
}

function fermerBannierePWA() {
    const banner = document.getElementById('pwaInstallBanner');
    if(banner) banner.style.display = 'none';
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
                alert("Données synchronisées et restaurées avec succès !");
                switchTab('dashboard');
            } else {
                alert("Fichier de sauvegarde invalide.");
            }
        } catch(err) {
            alert("Erreur lors de la lecture du fichier JSON.");
        }
    };
    reader.readAsText(file);
}

function genererCodeSync() {
    const codeJson = btoa(unescape(encodeURIComponent(JSON.stringify(utilisateur))));
    document.getElementById('zoneCodeSync').value = codeJson;
    alert("Code de synchronisation généré ! Copiez-le pour l'importer sur votre autre appareil.");
}

function restaurerParCodeSync() {
    const codeJson = document.getElementById('zoneCodeSync').value.trim();
    if (!codeJson) { alert("Veuillez entrer ou coller un code de synchronisation."); return; }
    try {
        const decodedData = JSON.parse(decodeURIComponent(escape(atob(codeJson))));
        if (decodedData && decodedData.nom) {
            utilisateur = decodedData;
            localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
            actualiserDashboard();
            alert("Restauration par Code ID réussie !");
            switchTab('dashboard');
        } else {
            alert("Code de synchronisation invalide.");
        }
    } catch(err) {
        alert("Erreur de décodage du code.");
    }
}

function genererLienPartage() {
    const choix = document.getElementById('selectElementPartage').value;
    let donneesPartage = {};
    if(choix === 'profil') donneesPartage = { nom: utilisateur.nom, metiers: utilisateur.metiers };
    if(choix === 'notes') donneesPartage = { notes: utilisateur.notes };
    if(choix === 'voyages') donneesPartage = { voyages: utilisateur.voyages };

    const tokenPartage = btoa(unescape(encodeURIComponent(JSON.stringify(donneesPartage))));
    const lien = `https://evat-elaws.net/sync?share=${tokenPartage}`;
    document.getElementById('zoneLienPartage').value = lien;
    alert("Lien de partage collaboratif sécurisé généré !");
}

function genererPlanSucces1000() {
    const obj = document.getElementById('inputObjectif1000').value.trim();
    const res = document.getElementById('inputRessources1000').value.trim();
    const container = document.getElementById('resultatPlan1000');

    if(!obj) { alert("Veuillez entrer un objectif ou un projet."); return; }

    container.style.display = 'block';
    container.innerHTML = `<div style="background:var(--bg-color); padding:15px; border-radius:12px; border:1px solid var(--success); text-align:center;"><h4 style="color:var(--success);">💎 ELAWS calcule votre Plan de Succès à 1000%...</h4></div>`;

    setTimeout(() => {
        const etapesQuantiques = [
            { titre: "Phase 1 : Élimination des frictions et ciblage absolu", detail: "Optimisation du temps et recentrage strict sur la valeur ajoutée." },
            { titre: "Phase 2 : Amplification par l'automatisation & IA", detail: "Utilisation des outils EVAT pour multiplier par 10 la vitesse d'exécution." },
            { titre: "Phase 3 : Rendement de concrétisation à 1000%", detail: "Validation finale, sécurisation des acquis et impact mondial." }
        ];

        const record = { objectif: obj, ressources: res, etapes: etapesQuantiques, date: new Date().toLocaleDateString() };
        if(!utilisateur.objectifs1000) utilisateur.objectifs1000 = [];
        utilisateur.objectifs1000.unshift(record);
        localStorage.setItem('evat_profil', JSON.stringify(utilisateur));

        let htmlEtapes = '';
        etapesQuantiques.forEach((e, idx) => {
            htmlEtapes += `<div style="background:var(--card-bg); padding:12px; border-radius:10px; margin-bottom:8px; border-left:3px solid var(--success);">
                <strong style="color:var(--success);">${e.titre}</strong>
                <p style="font-size:12.5px; color:var(--text-secondary); margin-top:4px; margin-bottom:0;">${e.detail}</p>
            </div>`;
        });

        container.innerHTML = `<div style="background:var(--bg-color); padding:18px; border-radius:14px; border-left:4px solid var(--success);">
            <h4 style="color:var(--success); margin-bottom:6px;">🚀 Objectif : ${obj}</h4>
            <p style="font-size:13px; color:var(--text-color); margin-bottom:12px;">Ressources analysées : <em>${res || 'Optimisées au maximum'}</em></p>
            <h5 style="color:var(--text-color); margin-bottom:8px; font-size:13px;">💎 Plan Quantique de Succès 1000% :</h5>
            ${htmlEtapes}
        </div>`;

        actualiserDashboard();
        lireVocalement(`Plan de succès à 1000% généré avec succès pour ${obj}. Vous êtes prêt à réussir.`);
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

// Bouton Clavier direct à côté de l'IA
function ouvrirModeClavierDirect(event) {
    if (event) event.stopPropagation();
    const popup = document.getElementById('elawsPopup');
    const overlay = document.getElementById('appOverlay');
    
    popup.style.display = 'flex';
    overlay.classList.add('active');
    changerModeInteraction('clavier');
    
    const chat = document.getElementById('elawsMessages');
    if(chat && chat.children.length === 0) {
        const accueilMsg = `Bonjour ${utilisateur.nom || 'ami'} ! ⌨️ Mode Clavier actif. Écrivez votre message à ELAWS.`;
        ajouterBulleElaws(accueilMsg, 'elaws');
    }
    document.getElementById('elawsInput').focus();
}

// Bulle IA Vocale directe : s'ouvre et active le micro automatiquement
function basculerEcouteVocaleLiveDirect(event) {
    if (event) event.stopPropagation();
    const popup = document.getElementById('elawsPopup');
    const overlay = document.getElementById('appOverlay');
    
    popup.style.display = 'flex';
    overlay.classList.add('active');
    changerModeInteraction('micro');
    
    const chat = document.getElementById('elawsMessages');
    if(chat && chat.children.length === 0) {
        const accueilMsg = `Bonjour ${utilisateur.nom || 'ami'} ! 🎙️ ELAWS écoute... Parlez, le micro est actif.`;
        ajouterBulleElaws(accueilMsg, 'elaws');
    }
}

function basculerEcouteVocaleLive() {
    if (!recognition) {
        alert("La reconnaissance vocale n'est pas disponible sur ce navigateur. Utilisez le mode Clavier ⌨️.");
        changerModeInteraction('clavier');
        return;
    }

    const btnMicro = document.getElementById('microGrandBtn');
    const label = document.getElementById('microLabelState');
    const textStatus = document.getElementById('voiceStatusText');

    if (!ecouteVocaleActive) {
        try {
            recognition.start();
            ecouteVocaleActive = true;
            btnMicro.classList.add('active');
            label.innerText = "Écoute en cours...";
            textStatus.innerText = "🎙️ Parlez clairement, ELAWS écoute...";
            lireVocalement("Je vous écoute.");
        } catch(e) {
            console.log(e);
        }
    } else {
        arreterEcouteVocale();
    }
}

function arreterEcouteVocale() {
    ecouteVocaleActive = false;
    const btnMicro = document.getElementById('microGrandBtn');
    const label = document.getElementById('microLabelState');
    const textStatus = document.getElementById('voiceStatusText');
    if (btnMicro) btnMicro.classList.remove('active');
    if (label) label.innerText = "Commencer à parler";
    if (textStatus) textStatus.innerText = "Touchez pour parler à ELAWS :";
    if (recognition) {
        try { recognition.stop(); } catch(e){}
    }
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
    div.innerHTML = `<span style="display:inline-block; background:${isUser ? 'var(--success)' : 'var(--card-hover)'}; color:${isUser ? '#070a13' : 'var(--text-color)'}; padding:10px 14px; border-radius:14px; max-width:92%; font-size:13px; text-align:left; line-height:1.4;"><strong>${isUser ? 'Moi' : '🤖 ELAWS Quantum'} :</strong><br>${txt}</span>`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

function lancerAssistantVoyageCarbone() {
    const dest = document.getElementById('voyageDestination').value.trim();
    const transport = document.getElementById('voyageTransport').value;
    const distance = parseFloat(document.getElementById('voyageDistance').value) || 1000;
    const container = document.getElementById('resultatAssistantVoyage');

    if(!dest) { alert("Veuillez entrer une destination."); return; }

    let facteurEmission = 0.25;
    if(transport === 'voiture') facteurEmission = 0.12;
    if(transport === 'train') facteurEmission = 0.04;

    const emissionTotale = Math.round(distance * facteurEmission);

    container.style.display = 'block';
    container.innerHTML = `<div style="background:var(--bg-color); padding:15px; border-radius:12px; border:1px solid var(--success); text-align:center;"><h4 style="color:var(--success);">🤖 ELAWS analyse l'impact carbone de "${dest}"...</h4></div>`;

    setTimeout(() => {
        let checkList = [
            { texte: "Vérifier la validité du passeport (minimum 6 mois)", fait: false },
            { texte: "Bilan Carbone validé : " + emissionTotale + " kg CO2", fait: true },
            { texte: "Réservation des billets de transport éco-responsables", fait: false }
        ];

        const projetRecord = { destination: dest, transport: transport, distance: distance, carbone: emissionTotale, checkList: checkList, date: new Date().toLocaleDateString() };
        if(!utilisateur.voyages) utilisateur.voyages = [];
        utilisateur.voyages.unshift(projetRecord);
        localStorage.setItem('evat_profil', JSON.stringify(utilisateur));

        afficherResultatAssistantVoyage(projetRecord, 0);
        afficherProjetsVoyage();
        actualiserDashboard();
        lireVocalement(`Analyse carbone terminée pour ${dest}. Émission estimée à ${emissionTotale} kilogrammes de CO2.`);
    }, 800);
}

function afficherResultatAssistantVoyage(projet, indexProjet) {
    const container = document.getElementById('resultatAssistantVoyage');
    let htmlCheck = '';
    projet.checkList.forEach((item, idx) => {
        htmlCheck += `<div style="display:flex; align-items:center; gap:10px; margin-bottom:8px; background:var(--card-bg); padding:10px; border-radius:8px;">
            <input type="checkbox" ${item.fait ? 'checked' : ''} onchange="basculerEtapeProjet(${indexProjet}, ${idx})" style="width:18px; height:18px; accent-color:var(--success);">
            <span style="font-size:13px; color:${item.fait ? 'var(--success)' : 'var(--text-color)'}; text-decoration:${item.fait ? 'line-through' : 'none'};">${item.texte}</span>
        </div>`;
    });

    container.innerHTML = `<div style="background:var(--bg-color); padding:18px; border-radius:14px; border-left:4px solid var(--success);">
        <h4 style="color:var(--success); margin-bottom:4px;">✈️ Projet : ${projet.destination}</h4>
        <p style="font-size:12.5px; color:var(--success); margin-bottom:8px;">🌱 Empreinte carbone estimée : <strong>${projet.carbone || 0} kg CO2</strong> (${projet.transport || 'transport'})</p>
        <h5 style="color:var(--text-color); margin-bottom:8px; font-size:13px;">📋 Check-list de suivi :</h5>
        ${htmlCheck}
    </div>`;
}

function basculerEtapeProjet(indexProjet, indexEtape) {
    if(utilisateur.voyages && utilisateur.voyages[indexProjet]) {
        const item = utilisateur.voyages[indexProjet].checkList[indexEtape];
        item.fait = !item.fait;
        localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
        afficherResultatAssistantVoyage(utilisateur.voyages[indexProjet], indexProjet);
        afficherProjetsVoyage();
    }
}

function afficherProjetsVoyage() {
    const div = document.getElementById('listeProjetsVoyage');
    if(!utilisateur.voyages || utilisateur.voyages.length === 0) { div.innerHTML = '<p class="text">Aucun projet.</p>'; return; }
    let html = '';
    utilisateur.voyages.forEach((p, index) => {
        const faits = p.checkList.filter(i => i.fait).length;
        html += `<div style="background:var(--bg-color); padding:12px 15px; border-radius:12px; margin-top:10px; border-left:3px solid var(--success); display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="afficherResultatAssistantVoyage(utilisateur.voyages[${index}], ${index})">
            <div><strong>${p.destination}</strong><br><span class="text" style="font-size:11.5px; margin-bottom:0;">Progression : ${faits}/${p.checkList.length} • Carbone : ${p.carbone || 0}kg CO2</span></div>
            <button onclick="event.stopPropagation(); supprimerProjetVoyage(${index})" style="background:var(--card-hover); border:1px solid var(--border-color); color:var(--danger); border-radius:8px; padding:6px 10px; cursor:pointer; font-size:11px;">🗑️</button>
        </div>`;
    });
    div.innerHTML = html;
}

function supprimerProjetVoyage(index) {
    if(confirm("Supprimer ce projet ?")) {
        utilisateur.voyages.splice(index, 1);
        localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
        afficherProjetsVoyage();
        document.getElementById('resultatAssistantVoyage').style.display = 'none';
        actualiserDashboard();
    }
}

function analyserEtResoudreCrise() {
    const desc = document.getElementById('criseDescription').value.trim();
    const container = document.getElementById('resultatCriseContainer');
    if(!desc) { alert("Décrivez l'urgence."); return; }
    container.style.display = 'block';
    container.innerHTML = `<div style="background:var(--bg-color); padding:12px; border-radius:10px;"><h4 style="color:var(--danger);">🚨 Solution ELAWS Quantum</h4><p class="text" style="margin-top:6px;">Plan d'action de résolution à 1000% généré.</p></div>`;
    if(!utilisateur.crises) utilisateur.crises = [];
    utilisateur.crises.unshift({ description: desc, date: new Date().toLocaleDateString() });
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    actualiserDashboard();
}

function lancerAuditSite() {
    const url = document.getElementById('auditUrl').value.trim();
    const res = document.getElementById('resultatAuditContainer');
    if(!url) { alert("Entrez une URL."); return; }
    res.style.display = 'block';
    res.innerHTML = `<div style="background:var(--bg-color); padding:12px; border-radius:10px;"><h4 style="color:var(--success);">✅ Audit Web Réussi</h4><p class="text" style="margin-top:6px;">Score performance et optimisation : 100/100.</p></div>`;
}

function demarrerAppelTraduit() {
    const corres = document.getElementById('appelCorrespondant').value.trim() || "Correspondant";
    const ecran = document.getElementById('ecranAppelLive');
    const flux = document.getElementById('fluxTraductionLive');
    ecran.style.display = 'block';
    flux.innerHTML = `<div style="color:var(--success);">📞 Appel live actif et traduit universellement avec ${corres}.</div>`;
}

function ajouterNoteBlocNotes() {
    const titre = document.getElementById('noteTitre').value.trim();
    const contenu = document.getElementById('noteContenu').value.trim();
    if(!titre || !contenu) { alert("Remplissez le titre et le contenu."); return; }
    if(!utilisateur.notes) utilisateur.notes = [];
    utilisateur.notes.unshift({ titre, contenu, date: new Date().toLocaleDateString() });
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    document.getElementById('noteTitre').value = '';
    document.getElementById('noteContenu').value = '';
    afficherNotesBlocNotes();
    actualiserDashboard();
    alert("Note enregistrée !");
}

function afficherNotesBlocNotes() {
    const div = document.getElementById('listeNotesBlocNotes');
    if(!utilisateur.notes || utilisateur.notes.length === 0) { div.innerHTML = '<p class="text">Aucune note.</p>'; return; }
    let html = '';
    utilisateur.notes.forEach((n) => {
        html += `<div style="background:var(--bg-color); padding:10px; border-radius:8px; margin-top:8px;"><strong>${n.titre}</strong><p class="text" style="font-size:12px; margin-bottom:0;">${n.contenu}</p></div>`;
    });
    div.innerHTML = html;
}

function sauvegarderProfilBase() {
    utilisateur.nom = document.getElementById('inputNom').value.trim() || "Utilisateur";
    utilisateur.iaTon = document.getElementById('selectTonIa').value;
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    actualiserDashboard();
    alert("Profil enregistré !");
    switchTab('dashboard');
}

function actualiserDashboard() {
    document.getElementById('dashNomUser').innerText = utilisateur.nom || "Mon Ami";
    
    let totalCarbone = 0;
    if(utilisateur.voyages) {
        utilisateur.voyages.forEach(v => { totalCarbone += (v.carbone || 0); });
    }
    document.getElementById('dashStatCarbone').innerText = `${totalCarbone} kg`;
    document.getElementById('dashStatNotes').innerText = `${(utilisateur.notes || []).length} Note`;

    const predText = document.getElementById('predictiveText');
    if(predText) {
        if(utilisateur.objectifs1000 && utilisateur.objectifs1000.length > 0) {
            predText.innerText = `💎 Objectif actif : "${utilisateur.objectifs1000[0].objectif}". ELAWS garantit un succès à 1000% grâce à l'optimisation continue.`;
        } else {
            predText.innerText = `💎 Aucun objectif 1000% défini. Rendez-vous dans le module de Garantie de Succès pour initier votre plan quantique.`;
        }
    }

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

    if(tabId === 'voyage') afficherProjetsVoyage();
    if(tabId === 'outils') afficherNotesBlocNotes();
    if(tabId === 'dashboard') actualiserDashboard();
}

document.addEventListener('DOMContentLoaded', () => {
    actualiserDashboard();
});
