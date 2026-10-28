
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

// Gestion dynamique des contacts et lecture du répertoire
function ajouterContactManuel() {
    const nom = document.getElementById('contactNomInput').value.trim();
    const tel = document.getElementById('contactTelInput').value.trim();
    const email = document.getElementById('contactEmailInput').value.trim();
    
    if(!nom || !tel) {
        alert("Veuillez entrer au moins un nom et un numéro de téléphone.");
        return;
    }
    
    if(!utilisateur.contacts) utilisateur.contacts = [];
    utilisateur.contacts.unshift({ nom, tel, email: email || 'non renseigné' });
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    
    document.getElementById('contactNomInput').value = '';
    document.getElementById('contactTelInput').value = '';
    document.getElementById('contactEmailInput').value = '';
    
    actualiserListeContacts();
    alert("Contact ajouté avec succès !");
}

async function importerContactsTelephone() {
    if ('contacts' in navigator && 'Select' in navigator.contacts) {
        try {
            const props = ['name', 'tel', 'email'];
            const opts = { multiple: true };
            const results = await navigator.contacts.select(props, opts);
            
            if (results && results.length > 0) {
                if(!utilisateur.contacts) utilisateur.contacts = [];
                results.forEach(c => {
                    utilisateur.contacts.push({
                        nom: c.name ? c.name[0] : 'Inconnu',
                        tel: c.tel ? c.tel[0] : '',
                        email: c.email ? c.email[0] : 'non renseigné'
                    });
                });
                localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
                actualiserListeContacts();
                alert(`${results.length} contact(s) importé(s) depuis votre téléphone !`);
            }
        } catch (ex) {
            alert("L'accès au carnet d'adresses a été annulé ou n'est pas supporté sur ce navigateur. Utilisez l'ajout manuel ci-dessous.");
        }
    } else {
        alert("L'API de sélection des contacts natifs nécessite un smartphone compatible (Android/Chrome). Utilisez le formulaire d'ajout manuel ci-dessous pour enregistrer vos contacts instantanément.");
    }
}

function actualiserListeContacts() {
    const container = document.getElementById('listeContactsContainer');
    if(!container) return;
    
    if(!utilisateur.contacts || utilisateur.contacts.length === 0) {
        container.innerHTML = `<p style="color:var(--text-secondary); font-size:13px;">Aucun contact enregistré pour le moment.</p>`;
        return;
    }
    
    let html = '';
    utilisateur.contacts.forEach((c, index) => {
        html += `
            <div style="background:var(--bg-color); border:1px solid var(--border-color); padding:12px; border-radius:12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong style="color:var(--text-color); font-size:13.5px;">👤 ${c.nom}</strong>
                    <p style="color:var(--accent); font-size:12px; margin:2px 0;">📞 ${c.tel}</p>
                    <p style="color:var(--text-secondary); font-size:11px; margin:0;">✉️ ${c.email || 'Pas d\'email'}</p>
                </div>
                <button onclick="supprimerContact(${index})" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:16px;" title="Supprimer">🗑️</button>
            </div>
        `;
    });
    container.innerHTML = html;
}

function supprimerContact(index) {
    if(confirm("Voulez-vous supprimer ce contact ?")) {
        utilisateur.contacts.splice(index, 1);
        localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
        actualiserListeContacts();
    }
}

function genererPlanSucces1000() {
    const obj = document.getElementById('inputObjectif1000').value.trim();
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
        const record = { objectif: obj, etapes: etapesQuantiques, date: new Date().toLocaleDateString() };
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

function sauvegarderProfilBase() {
    utilisateur.nom = document.getElementById('inputNom').value.trim() || "Utilisateur";
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    actualiserDashboard();
    alert("Profil enregistré !");
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

document.addEventListener('DOMContentLoaded', () => { 
    if(document.getElementById('inputNom')) {
        document.getElementById('inputNom').value = utilisateur.nom || "";
    }
    actualiserDashboard(); 
});
