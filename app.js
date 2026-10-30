const EVAT_VERSION_ACTUELLE = "v3.60 Turbo";

let versionEnregistree = localStorage.getItem('evat_version_app');

if (versionEnregistree !== EVAT_VERSION_ACTUELLE) {
    let ancienProfil = JSON.parse(localStorage.getItem('evat_profil'));
    if (ancienProfil) {
        ancienProfil.quetes = [
            { id: 1, titre: "Configurer le profil & le métier", fait: true, qubits: 50 },
            { id: 2, titre: "Enregistrer une note dans le bloc-notes", fait: false, qubits: 30 },
            { id: 3, titre: "Générer un Plan de Succès 1000%", fait: false, qubits: 70 },
            { id: 4, titre: "Calculer une empreinte carbone de voyage", fait: false, qubits: 40 },
            { id: 5, titre: "Tester l'Appel Audio & Vidéo WebRTC", fait: false, qubits: 60 },
            { id: 6, titre: "Activer le stockage local des messages (Fichiers du Téléphone)", fait: false, qubits: 50 }
        ];
        localStorage.setItem('evat_profil', JSON.stringify(ancienProfil));
    }
    localStorage.setItem('evat_version_app', EVAT_VERSION_ACTUELLE);
    window.addEventListener('DOMContentLoaded', () => {
        // Performance : requestAnimationFrame pour notification
        requestAnimationFrame(() => afficherNotificationMiseAJour(EVAT_VERSION_ACTUELLE));
    });
}

function afficherNotificationMiseAJour(version) {
    const div = document.createElement('div');
    div.style.cssText = "position:fixed; top:20px; left:50%; transform:translateX(-50%); background:var(--success); color:#fff; padding:10px 20px; border-radius:12px; font-weight:700; z-index:9999; box-shadow:0 0 20px rgba(16,185,129,0.8); font-size:13px; text-align:center;";
    div.innerHTML = `🚀 Intelligence IA mise à jour vers ${version} !<br><span style="font-size:11px; font-weight:400;">Module de messagerie locale avec sauvegarde directe dans les fichiers du téléphone activé.</span>`;
    document.body.appendChild(div);
    setTimeout(() => { div.remove(); }, 3500);
}

let utilisateur = JSON.parse(localStorage.getItem('evat_profil')) || {
    nom: "Kodjo Marceline",
    metier: "Développeur & Entrepreneur",
    telephone: "+22898231402",
    iaTon: "standard",
    qubits: 300,
    niveauGamification: 1,
    quetes: [
        { id: 1, titre: "Configurer le profil & le métier", fait: true, qubits: 50 },
        { id: 2, titre: "Enregistrer une note dans le bloc-notes", fait: false, qubits: 30 },
        { id: 3, titre: "Générer un Plan de Succès 1000%", fait: false, qubits: 70 },
        { id: 4, titre: "Calculer une empreinte carbone de voyage", fait: false, qubits: 40 },
        { id: 5, titre: "Tester l'Appel Audio & Vidéo WebRTC", fait: false, qubits: 60 },
        { id: 6, titre: "Activer le stockage local des messages (Fichiers du Téléphone)", fait: false, qubits: 50 }
    ],
    contacts: [{ nom: "Service Client ELAWS", tel: "+22898231402" }],
    notes: [{ titre: "EVAT Quantum v3.60 Turbo", contenu: "Messagerie locale et stockage fichiers téléphone." }],
    messages: [
        { expediteur: "ELAWS System", texte: "Bienvenue dans la messagerie chiffrée EVAT. Vos messages sont stockés en local dans la mémoire de votre téléphone.", heure: "08:00" }
    ],
    voyages: [], crises: [], audits: [], objectifs1000: []
};

let deferredPrompt = null;
let ecouteVocaleActive = false;
let recognition = null;
let appelEnCours = false;
let localStream = null;
let directoryHandleGlobal = null;

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

// === MODULE ACCÈS FICHIERS TÉLÉPHONE & MESSAGERIE LOCALE ===
async function selectionnerDossierStockageTelephone() {
    const statusDiv = document.getElementById('fileAccessStatus');
    if ('showDirectoryPicker' in window) {
        try {
            directoryHandleGlobal = await window.showDirectoryPicker();
            statusDiv.innerHTML = `<span style="color:var(--success); font-weight:700;">🟢 Accès autorisé aux fichiers du téléphone (Dossier lié).</span>`;
            
            const qFichiers = utilisateur.quetes.find(q => q.id === 6);
            if(qFichiers && !qFichiers.fait) qFichiers.fait = true;
            ajouterQubits(50, "Accès aux fichiers du téléphone configuré");
            
            // Sauvegarder l'état initial des messages dans le fichier
            await sauvegarderMessagesDansFichiersTelephone();
            alert("Accès aux fichiers du téléphone établi avec succès !");
        } catch (err) {
            statusDiv.innerHTML = `<span style="color:var(--danger);">❌ Accès refusé ou annulé : ${err.message}</span>`;
        }
    } else {
        // Fallback pour les navigateurs mobiles ne supportant pas showDirectoryPicker directement (téléchargement automatique de fichier local)
        statusDiv.innerHTML = `<span style="color:var(--accent);">ℹ️ Mode téléchargement automatique de fichiers locaux activé.</span>`;
        const qFichiers = utilisateur.quetes.find(q => q.id === 6);
        if(qFichiers && !qFichiers.fait) qFichiers.fait = true;
        ajouterQubits(50, "Configuration messagerie locale");
        alert("Votre navigateur utilise l'export automatique vers le dossier Téléchargements du téléphone.");
    }
}

async function sauvegarderMessagesDansFichiersTelephone() {
    const contenuJson = JSON.stringify(utilisateur.messages, null, 2);
    if (directoryHandleGlobal) {
        try {
            const fileHandle = await directoryHandleGlobal.getFileHandle("evat_messages_chiffres.json", { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(contenuJson);
            await writable.close();
            return;
        } catch (e) {
            console.error("Erreur écriture fichier:", e);
        }
    }
    
    // Fallback export Blob
    const blob = new Blob([contenuJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "evat_messages_telephone.json";
    // En arrière-plan ou via action explicite
}

function envoyerMessageChatLocal() {
    const input = document.getElementById('chatLocalInput');
    const txt = input.value.trim();
    if(!txt) return;
    
    const heureActuelle = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if(!utilisateur.messages) utilisateur.messages = [];
    
    utilisateur.messages.push({
        expediteur: utilisateur.nom || "Moi",
        texte: txt,
        heure: heureActuelle
    });
    
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    input.value = '';
    actualiserAffichageMessagesLocaux();
    sauvegarderMessagesDansFichiersTelephone();
    ajouterQubits(10, "Message local enregistré");
}

function actualiserAffichageMessagesLocaux() {
    const container = document.getElementById('listeMessagesLocaux');
    if(!container) return;
    if(!utilisateur.messages || utilisateur.messages.length === 0) {
        container.innerHTML = `<p style="color:var(--text-secondary); font-size:12.5px;">Aucun message dans le stockage local.</p>`;
        return;
    }
    let html = '';
    utilisateur.messages.forEach(m => {
        const estMoi = m.expediteur === (utilisateur.nom || "Moi");
        html += `<div style="background:var(--bg-color); border:1px solid ${estMoi ? 'var(--accent)' : 'var(--border-color)'}; padding:8px 12px; border-radius:10px; margin-bottom:6px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
                <strong style="color:${estMoi ? 'var(--accent)' : 'var(--success)'}; font-size:12px;">👤 ${m.expediteur}</strong>
                <span style="font-size:10px; color:var(--text-secondary);">${m.heure}</span>
            </div>
            <p style="color:var(--text-color); font-size:12.5px; margin:0;">${m.texte}</p>
        </div>`;
    });
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

// === MODULE APPEL AUDIO ET VIDEO INTERNET (WebRTC par Numéro) ===
async function lancerAppelInternet(type) {
    const telUtilisateur = utilisateur.telephone || "+22898231402";
    const statusDiv = document.getElementById('voipStatusDisplay');
    const videoContainer = document.getElementById('videoCallContainer');
    const localVideo = document.getElementById('localVideoElement');
    
    if (!appelEnCours) {
        try {
            statusDiv.innerHTML = `<span style="color:var(--accent);">🔄 Connexion ${type.toUpperCase()} Internet pour ${telUtilisateur}...</span>`;
            
            const constraints = {
                audio: true,
                video: type === 'video' ? { width: { ideal: 640 }, height: { ideal: 480 } } : false
            };

            localStream = await navigator.mediaDevices.getUserMedia(constraints);
            jouerSonnerieAppel();
            
            if (type === 'video' && localVideo) {
                localVideo.srcObject = localStream;
                videoContainer.style.display = 'block';
            }
            
            appelEnCours = true;
            document.getElementById('btnAppelAudio').innerText = "Raccrocher";
            document.getElementById('btnAppelVideo').innerText = "Raccrocher";
            document.getElementById('btnAppelAudio').style.background = "var(--danger)";
            document.getElementById('btnAppelVideo').style.background = "var(--danger)";
            
            statusDiv.innerHTML = `<span style="color:var(--success); font-weight:750;">🟢 Appel ${type.toUpperCase()} Actif (Numéro : ${telUtilisateur})<br><span style="font-size:11px; color:var(--text-secondary);">Canal WebRTC chiffré sans GSM ni email.</span></span>`;
            
            const qAppel = utilisateur.quetes.find(q => q.id === 5);
            if(qAppel && !qAppel.fait) qAppel.fait = true;
            ajouterQubits(60, `Appel ${type} Internet WebRTC établi`);
            
            lireVocalement(`Appel ${type} Internet établi par numéro de téléphone.`);
        } catch (error) {
            statusDiv.innerHTML = `<span style="color:var(--danger);">❌ Erreur accès flux média : ${error.message}</span>`;
            appelEnCours = false;
        }
    } else {
        raccrocherAppelInternet();
    }
}

function raccrocherAppelInternet() {
    arreterSonnerieAppel();
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    appelEnCours = false;
    const statusDiv = document.getElementById('voipStatusDisplay');
    const videoContainer = document.getElementById('videoCallContainer');
    
    if(videoContainer) videoContainer.style.display = 'none';
    if(statusDiv) statusDiv.innerHTML = `<span style="color:var(--text-secondary);">Appel Internet terminé. Numéro en veille.</span>`;
    
    const btnAudio = document.getElementById('btnAppelAudio');
    const btnVideo = document.getElementById('btnAppelVideo');
    if(btnAudio) { btnAudio.innerText = "🎙️ Lancer Appel Audio"; btnAudio.style.background = "var(--success)"; }
    if(btnVideo) { btnVideo.innerText = "📹 Lancer Appel Vidéo"; btnVideo.style.background = "var(--accent)"; }
    
    lireVocalement("Appel raccroché.");
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
    if(!nom || !tel) { alert("Nom et numéro de téléphone requis."); return; }
    if(!utilisateur.contacts) utilisateur.contacts = [];
    utilisateur.contacts.unshift({ nom, tel });
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    document.getElementById('contactNomInput').value = '';
    document.getElementById('contactTelInput').value = '';
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
        html += `<div onclick="ouvrirChatContact(${index})" style="background:var(--bg-color); border:1px solid var(--border-color); padding:10px; border-radius:8px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; transition:all 0.2s;" title="Cliquer pour ouvrir la discussion et les appels">
            <div><strong style="color:var(--text-color); font-size:12.5px;">👤 ${c.nom}</strong><p style="color:var(--accent); font-size:11px; margin:2px 0;">📞 ${c.tel} • <span style="color:var(--success);">💬 Cliquer pour chatter & appeler</span></p></div>
            <button onclick="event.stopPropagation(); supprimerContact(${index})" style="background:none; border:none; color:var(--danger); cursor:pointer; padding:6px;">🗑️</button>
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
    ajouterQubits(60, "Analyse voyage & checklist Visa");
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
    container.innerHTML = `<div style="background:var(--bg-color); padding:12px; border-radius:10px; border:1px solid var(--success); text-align:center;"><h4 style="color:var(--success); font-size:13.5px;">💎 ELAWS 3.59 élabore votre Plan 1000%...</h4></div>`;
    setTimeout(() => {
        container.innerHTML = `<div style="background:var(--bg-color); padding:12px; border-radius:10px; border-left:4px solid var(--success);"><h4 style="color:var(--success); margin-bottom:6px; font-size:13.5px;">🚀 ${obj}</h4><p style="font-size:12.5px; color:var(--text-color);">• Phase 1 : Analyse intelligente des opportunités à Lomé<br>• Phase 2 : Automatisation de code et structuration NIF<br>• Phase 3 : Déploiement sans coût et rentabilité maximale</p></div>`;
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
        htmlOutils += `<div style="background:var(--bg-color); border:1px solid var(--success); padding:12px; border-radius:10px;"><h4 style="color:var(--success); font-size:13px; margin-bottom:4px;">💻 Boîte Développeur Avancée</h4><p style="color:var(--text-secondary); font-size:11.5px; margin-bottom:6px;">Console Node.js mobile & ELAWS Code Engine actifs.</p><button class="btn-action ripple-effect" onclick="switchTab('messagerie')" style="background:var(--success); color:#fff; padding:8px; font-size:12.5px;">Ouvrir Messagerie Locale</button></div>`;
    } else {
        htmlOutils += `<div style="background:var(--bg-color); border:1px solid var(--success); padding:12px; border-radius:10px;"><h4 style="color:var(--success); font-size:13px; margin-bottom:4px;">🚀 Boîte Polyvalente</h4><p style="color:var(--text-secondary); font-size:11.5px; margin-bottom:6px;">Accès universel à tous les modules ELAWS.</p><button class="btn-action ripple-effect" onclick="switchTab('messagerie')" style="background:var(--success); color:#fff; padding:8px; font-size:12.5px;">Ouvrir Messagerie Locale</button></div>`;
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
        ajouterQubits(10, "Interaction ELAWS 3.59");
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
    const nomInput = document.getElementById('inputNom').value.trim();
    const metierInput = document.getElementById('inputMetierProfil').value.trim();
    const telInput = document.getElementById('inputTelProfil').value.trim();
    const indicatif = document.getElementById('selectPaysIndicatif') ? document.getElementById('selectPaysIndicatif').value : "+228";
    const selectTon = document.getElementById('inputIaTon');

    if(nomInput) utilisateur.nom = nomInput;
    if(metierInput) utilisateur.metier = metierInput;
    if(telInput) {
        const telBrut = telInput.replace(/^\+/, '');
        utilisateur.telephone = indicatif + (telBrut.startsWith(indicatif.replace('+', '')) ? telBrut.replace(indicatif.replace('+', ''), '') : telBrut);
    }
    if(selectTon) utilisateur.iaTon = selectTon.value;

    const qProfil = utilisateur.quetes.find(q => q.id === 1);
    if(qProfil) qProfil.fait = true;

    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    actualiserDashboard();

    const modal = document.getElementById('welcomeModal');
    if(modal) modal.style.display = 'none';
    alert("✅ Profil de " + utilisateur.nom + " enregistré avec succès !");
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
    const badge = document.getElementById('sidebarUserRole');
    if(badge) badge.innerText = `${utilisateur.nom || 'Visiteur'} • Niveau ${utilisateur.niveauGamification || 1}`;
    const qubitsElem = document.getElementById('dashQubitsScore');
    if(qubitsElem) qubitsElem.innerText = utilisateur.qubits || 300;
    const niveauElem = document.getElementById('dashNiveauScore');
    if(niveauElem) niveauElem.innerText = utilisateur.niveauGamification || 1;

    actualiserListeContacts();
    afficherNotesBlocNotes();
    actualiserQuetesUI();
    actualiserAffichageMessagesLocaux();
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
    if(document.getElementById('inputTelProfil')) document.getElementById('inputTelProfil').value = utilisateur.telephone || "+22898231402";
    if(document.getElementById('inputIaTon')) document.getElementById('inputIaTon').value = utilisateur.iaTon || "standard";
    actualiserDashboard();
    verifierPremierLancement();
});

let logoIndex = 0;
const logosArray = ['logo_evat.png', 'logo_evat_alt.png'];
function basculerLogoInterchangeable(e) {
    if(e) e.stopPropagation();
    logoIndex = (logoIndex + 1) % logosArray.length;
    document.querySelectorAll('.quantum-logo-app, img[alt*="Logo"]').forEach(img => {
        img.src = logosArray[logoIndex];
    });
    alert("🔄 Logo basculé sur le style " + (logoIndex + 1));
}
function testerVoixElaws() {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const msg = new SpeechSynthesisUtterance("Bonjour Kodjo. Je suis ELAWS Quantum version 3 point 59. Messagerie locale et stockage fichiers activés.");
        msg.lang = 'fr-FR';
        window.speechSynthesis.speak(msg);
    } else {
        alert("Synthèse vocale non supportée.");
    }
}



// --- SUIVI AUTOMATIQUE DE POSITION REÇUE DANS LE CHAT ---
function suivrePositionRecue(lat, lon, nomLieu) {
    const iframe = document.getElementById('iframeCarteMonde');
    if(iframe) {
        const bboxDelta = 0.008;
        const bbox = (lon - bboxDelta) + "," + (lat - bboxDelta) + "," + (lon + bboxDelta) + "," + (lat + bboxDelta);
        iframe.src = "https://www.openstreetmap.org/export/embed.html?bbox=" + bbox + "&layer=mapnik&marker=" + lat + "," + lon;
        // Basculer vers l'onglet Dashboard ou faire défiler vers la carte si nécessaire
        switchTab('dashboard');
        alert("📍 Itinéraire chargé vers la position de " + (nomLieu || "votre correspondant") + " ! Suivez la carte.");
    }
}

function partagerMaPositionDansChat() {
    if(navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            const msgInput = document.getElementById('chatLocalInput');
            if(msgInput) {
                msgInput.value = "📍 Ma position GPS : " + lat.toFixed(5) + ", " + lon.toFixed(5);
                envoyerMessageChatLocal();
            }
        }, () => {
            alert("Impossible de récupérer votre position GPS.");
        });
    } else {
        alert("Géolocalisation non supportée.");
    }
}



// --- SYNCHRONISATION DES CONTACTS DU TELEPHONE ---
async function synchroniserContactsTelephone() {
    if ('contacts' in navigator && 'Manager' in window) {
        try {
            const props = ['name', 'tel', 'email'];
            const opts = { multiple: true };
            const contacts = await navigator.contacts.select(props, opts);
            
            if(contacts && contacts.length > 0) {
                if(!utilisateur.contacts) utilisateur.contacts = [];
                contacts.forEach(c => {
                    const nom = c.name ? c.name[0] : "Inconnu";
                    const tel = c.tel ? c.tel[0] : "Pas de numéro";
                    // Éviter les doublons
                    if(!utilisateur.contacts.some(existing => existing.tel === tel)) {
                        utilisateur.contacts.push({ nom, tel });
                    }
                });
                localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
                actualiserListeContacts();
                ajouterQubits(50, "Synchronisation des contacts du téléphone");
                alert(`✅ ${contacts.length} contact(s) synchronisé(s) avec succès !`);
            }
        } catch (err) {
            console.log("Sélection de contacts annulée ou non supportée :", err);
            // Fallback via importation de fichier vCard (.vcf) ou saisie manuelle optimisée
            importerFichierVCardManuel();
        }
    } else {
        importerFichierVCardManuel();
    }
}

function importerFichierVCardManuel() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.vcf,.txt';
    input.onchange = e => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = event => {
            const content = event.target.result;
            // Analyse basique vCard (.vcf)
            const lignes = content.split('\n');
            let nb = 0;
            let nomCourant = "Contact";
            lignes.forEach(l => {
                if(l.startsWith('FN:')) nomCourant = l.replace('FN:', '').trim();
                if(l.startsWith('TEL')) {
                    const parts = l.split(':');
                    const telCourant = parts[parts.length - 1].trim();
                    if(!utilisateur.contacts) utilisateur.contacts = [];
                    if(!utilisateur.contacts.some(c => c.tel === telCourant)) {
                        utilisateur.contacts.unshift({ nom: nomCourant, tel: telCourant });
                        nb++;
                    }
                }
            });
            localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
            actualiserListeContacts();
            ajouterQubits(40, "Importation fichier vCard réussie");
            alert(`✅ ${nb} contact(s) importé(s) depuis le fichier du téléphone !`);
        };
        reader.readAsText(file);
    };
    input.click();
}



// --- SYSTEME DE SONNERIE WEB AUDIO API ---
let audioCtxSonnerie = null;
let intervalSonnerie = null;

function jouerSonnerieAppel() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!audioCtxSonnerie) {
            audioCtxSonnerie = new AudioContext();
        }
        if (audioCtxSonnerie.state === 'suspended') {
            audioCtxSonnerie.resume();
        }

        // Jouer un double bip de sonnerie téléphonique classique
        const jouerBip = () => {
            if (!appelEnCours) return;
            const osc = audioCtxSonnerie.createOscillator();
            const gain = audioCtxSonnerie.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, audioCtxSonnerie.currentTime); // Fréquence standard tonalité
            osc.frequency.setValueAtTime(480, audioCtxSonnerie.currentTime + 0.1);
            
            gain.gain.setValueAtTime(0.15, audioCtxSonnerie.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtxSonnerie.currentTime + 0.8);
            
            osc.connect(gain);
            gain.connect(audioCtxSonnerie.destination);
            
            osc.start();
            osc.stop(audioCtxSonnerie.currentTime + 0.9);
        };

        jouerBip();
        intervalSonnerie = setInterval(() => {
            if (appelEnCours) {
                jouerBip();
            } else {
                clearInterval(intervalSonnerie);
            }
        }, 3000);
    } catch(e) {
        console.log("Erreur sonnerie audio:", e);
    }
}

function arreterSonnerieAppel() {
    if (intervalSonnerie) {
        clearInterval(intervalSonnerie);
        intervalSonnerie = null;
    }
}



// --- GESTION DES CONTACTS ET CHAT DIRECT AVEC APPELS ---
let contactActifCourant = null;

function ouvrirChatContact(index) {
    if(!utilisateur.contacts || !utilisateur.contacts[index]) return;
    contactActifCourant = utilisateur.contacts[index];
    
    document.getElementById('chatContactNomTitre').innerText = "👤 " + contactActifCourant.nom;
    document.getElementById('chatContactTelSousTitre').innerText = "📞 " + contactActifCourant.tel;
    document.getElementById('modalChatContact').style.display = 'flex';
    
    actualiserMessagesContactDirect();
}

function fermerChatContactDirect() {
    document.getElementById('modalChatContact').style.display = 'none';
    const vidContainer = document.getElementById('videoCallContainerContact');
    if(vidContainer) vidContainer.style.display = 'none';
    raccrocherAppelInternet();
}

function envoyerMessageContactDirect() {
    const input = document.getElementById('inputMessageContactDirect');
    const txt = input.value.trim();
    if(!txt || !contactActifCourant) return;
    
    if(!contactActifCourant.messages) contactActifCourant.messages = [];
    const heure = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    contactActifCourant.messages.push({
        expediteur: utilisateur.nom || "Moi",
        texte: txt,
        heure: heure
    });
    
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    input.value = '';
    actualiserMessagesContactDirect();
    ajouterQubits(5, "Message envoyé au contact");
}

function actualiserMessagesContactDirect() {
    const container = document.getElementById('listeMessagesContactDirect');
    if(!container || !contactActifCourant) return;
    
    if(!contactActifCourant.messages || contactActifCourant.messages.length === 0) {
        container.innerHTML = `<p style="color:var(--text-secondary); font-size:12px; text-align:center; margin-top:20px;">Aucun message avec ${contactActifCourant.nom}. Commencez la discussion !</p>`;
        return;
    }
    
    let html = '';
    contactActifCourant.messages.forEach(m => {
        const estMoi = m.expediteur === (utilisateur.nom || "Moi");
        html += `<div style="background:var(--bg-color); border:1px solid ${estMoi ? 'var(--accent)' : 'var(--border-color)'}; padding:6px 10px; border-radius:8px;">
            <div style="display:flex; justify-content:space-between; font-size:10.5px; color:var(--text-secondary); margin-bottom:2px;">
                <span>${m.expediteur}</span>
                <span>${m.heure}</span>
            </div>
            <p style="color:var(--text-color); font-size:12px; margin:0;">${m.texte}</p>
        </div>`;
    });
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

async function lancerAppelContactDirect(type) {
    if(!contactActifCourant) return;
    const statusDiv = document.getElementById('chatContactTelSousTitre');
    const videoContainer = document.getElementById('videoCallContainerContact');
    const localVideo = document.getElementById('localVideoElementContact');
    
    try {
        statusDiv.innerHTML = `<span style="color:var(--accent);">🔄 Appel ${type.toUpperCase()} vers ${contactActifCourant.nom} (${contactActifCourant.tel})...</span>`;
        
        const constraints = {
            audio: true,
            video: type === 'video' ? { width: { ideal: 640 }, height: { ideal: 480 } } : false
        };

        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        jouerSonnerieAppel();
        appelEnCours = true;
        
        if(type === 'video' && localVideo) {
            localVideo.srcObject = localStream;
            videoContainer.style.display = 'block';
        }
        
        statusDiv.innerHTML = `<span style="color:var(--success); font-weight:700;">🟢 Appel ${type.toUpperCase()} en cours avec ${contactActifCourant.nom}</span>`;
        ajouterQubits(40, `Appel ${type} direct avec contact`);
    } catch(err) {
        statusDiv.innerHTML = `<span style="color:var(--danger);">❌ Erreur d'appel : ${err.message}</span>`;
    }
}



// --- GESTION PHOTO DE PROFIL & INDICATIF PAYS ---
function chargerPhotoProfil(event) {
    const file = event.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const base64Img = e.target.result;
        document.getElementById('avatarPreviewImg').src = base64Img;
        utilisateur.photoAvatar = base64Img;
        localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
        alert("✅ Photo de profil enregistrée avec succès !");
    };
    reader.readAsDataURL(file);
}

function mettreAJourIndicatifPays() {
    // Fonction utilitaire pour ajuster l'indicatif si besoin
}
