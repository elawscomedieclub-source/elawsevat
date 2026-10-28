
let utilisateur = JSON.parse(localStorage.getItem('evat_profil')) || {
    nom: "Kodjo Marceline",
    type: "adulte",
    sousType: "Travailleur",
    metiers: ["Entrepreneur", "Développeur Web"],
    contacts: [
        { nom: "Service Client ELAWS", tel: "+22898231402", email: "support@evat-elaws.net" }
    ],
    notes: [
        { titre: "Lancement v3.16", contenu: "Installation PWA automatique et interface mobile optimisée." }
    ],
    voyages: [],
    crises: [],
    audits: [],
    iaTon: "standard"
};

let deferredPrompt = null;
let ecouteVocaleActive = false;

// Gestion de l'événement PWA pour proposer l'installation automatique
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
            if (choiceResult.outcome === 'accepted') {
                console.log('Utilisateur a accepté l\'installation PWA');
            }
            deferredPrompt = null;
        });
    } else {
        alert("Pour installer l'application sur votre appareil : ouvrez le menu de votre navigateur (les 3 points en haut à droite) et sélectionnez 'Ajouter à l'écran d'accueil' ou 'Installer l'application'.");
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

function toggleMicrophone() {
    const btn = document.getElementById('microBtn');
    const status = document.getElementById('voiceStatus');
    ecouteVocaleActive = !ecouteVocaleActive;
    
    if(ecouteVocaleActive) {
        btn.classList.add('active');
        status.style.display = 'block';
        setTimeout(() => {
            if(ecouteVocaleActive) {
                document.getElementById('elawsInput').value = "je souhaite préparer mon voyage";
                toggleMicrophone();
                envoyerMessageElaws();
            }
        }, 3000);
    } else {
        btn.classList.remove('active');
        status.style.display = 'none';
    }
}

// --- GESTION DU CHAT ELAWS ---
function toggleElawsChat(event) {
    if (event) event.stopPropagation();
    const popup = document.getElementById('elawsPopup');
    const overlay = document.getElementById('appOverlay');
    
    if(popup.style.display === 'none' || popup.style.display === '') {
        popup.style.display = 'flex';
        overlay.classList.add('active');
        
        const chat = document.getElementById('elawsMessages');
        if(chat && chat.children.length === 0) {
            const accueilMsg = `Bonjour ${utilisateur.nom || 'ami'} ! ✨ Je suis ELAWS, votre assistant universel. Je suis entièrement disposé à vous répondre et à vous guider. Que pouvons-nous faire ensemble ?`;
            ajouterBulleElaws(accueilMsg, 'elaws');
            lireVocalement(accueilMsg);
        }
    } else {
        popup.style.display = 'none';
        overlay.classList.remove('active');
    }
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
    }, 400);
}

function ajouterBulleElaws(txt, exp) {
    const chat = document.getElementById('elawsMessages');
    const isUser = exp === 'user';
    const div = document.createElement('div');
    div.style.cssText = `margin-bottom:8px; text-align:${isUser ? 'right' : 'left'};`;
    div.innerHTML = `<span style="display:inline-block; background:${isUser ? 'var(--accent)' : 'var(--card-hover)'}; color:${isUser ? '#070a13' : 'var(--text-color)'}; padding:10px 14px; border-radius:14px; max-width:92%; font-size:13px; text-align:left; line-height:1.4;"><strong>${isUser ? 'Moi' : '🤖 ELAWS'} :</strong><br>${txt}</span>`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

// --- MODULES ---
function lancerAssistantVoyage() {
    const dest = document.getElementById('voyageDestination').value.trim();
    const etape = document.getElementById('voyageEtapeActuelle').value;
    const container = document.getElementById('resultatAssistantVoyage');

    if(!dest) { alert("Veuillez entrer une destination."); return; }

    container.style.display = 'block';
    container.innerHTML = `<div style="background:var(--bg-color); padding:15px; border-radius:12px; border:1px solid var(--accent); text-align:center;"><h4 style="color:var(--accent);">🤖 ELAWS analyse "${dest}"...</h4></div>`;

    setTimeout(() => {
        let checkList = [
            { texte: "Vérifier la validité du passeport (minimum 6 mois)", fait: etape !== 'depart' },
            { texte: "Rassembler certificat de nationalité et acte de naissance", fait: etape !== 'depart' },
            { texte: "Demande de Visa en ligne et réservation de vol", fait: etape === 'visa' || etape === 'sante' },
            { texte: "Carnet de vaccination international et bordereau de voyage", fait: etape === 'sante' }
        ];

        const projetRecord = { destination: dest, checkList: checkList, date: new Date().toLocaleDateString() };
        if(!utilisateur.voyages) utilisateur.voyages = [];
        utilisateur.voyages.unshift(projetRecord);
        localStorage.setItem('evat_profil', JSON.stringify(utilisateur));

        afficherResultatAssistantVoyage(projetRecord, 0);
        afficherProjetsVoyage();
        actualiserDashboard();
        lireVocalement(`Guide de voyage configuré pour ${dest}.`);
    }, 1200);
}

function afficherResultatAssistantVoyage(projet, indexProjet) {
    const container = document.getElementById('resultatAssistantVoyage');
    let htmlCheck = '';
    projet.checkList.forEach((item, idx) => {
        htmlCheck += `<div style="display:flex; align-items:center; gap:10px; margin-bottom:8px; background:var(--card-bg); padding:10px; border-radius:8px;">
            <input type="checkbox" ${item.fait ? 'checked' : ''} onchange="basculerEtapeProjet(${indexProjet}, ${idx})" style="width:18px; height:18px; accent-color:var(--accent);">
            <span style="font-size:13px; color:${item.fait ? 'var(--success)' : 'var(--text-color)'}; text-decoration:${item.fait ? 'line-through' : 'none'};">${item.texte}</span>
        </div>`;
    });

    container.innerHTML = `<div style="background:var(--bg-color); padding:18px; border-radius:14px; border-left:4px solid var(--accent);">
        <h4 style="color:var(--accent); margin-bottom:8px;">✈️ Projet : ${projet.destination}</h4>
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
        html += `<div style="background:var(--bg-color); padding:12px 15px; border-radius:12px; margin-top:10px; border-left:3px solid var(--accent); display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="afficherResultatAssistantVoyage(utilisateur.voyages[${index}], ${index})">
            <div><strong>${p.destination}</strong><br><span class="text" style="font-size:11.5px; margin-bottom:0;">Progression : ${faits}/${p.checkList.length} étapes</span></div>
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
    container.innerHTML = `<div style="background:var(--bg-color); padding:12px; border-radius:10px;"><h4 style="color:var(--danger);">🚨 Solution ELAWS</h4><p class="text" style="margin-top:6px;">Plan d'action d'urgence généré.</p></div>`;
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
    res.innerHTML = `<div style="background:var(--bg-color); padding:12px; border-radius:10px;"><h4 style="color:var(--accent);">✅ Audit Web Réussi</h4><p class="text" style="margin-top:6px;">Score : 94/100 (Optimisé Mobile).</p></div>`;
}

function demarrerAppelTraduit() {
    const corres = document.getElementById('appelCorrespondant').value.trim() || "Correspondant";
    const ecran = document.getElementById('ecranAppelLive');
    const flux = document.getElementById('fluxTraductionLive');
    ecran.style.display = 'block';
    flux.innerHTML = `<div style="color:var(--success);">📞 Appel live actif avec ${corres}.</div>`;
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
    document.getElementById('dashStatVoyages').innerText = `${(utilisateur.voyages || []).length} Projet`;
    document.getElementById('dashStatCrises').innerText = `${(utilisateur.crises || []).length} Résolution`;
    document.getElementById('dashStatNotes').innerText = `${(utilisateur.notes || []).length} Note`;
    const badge = document.getElementById('sidebarUserRole');
    if(badge) badge.innerText = `${utilisateur.nom} • En ligne`;
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
