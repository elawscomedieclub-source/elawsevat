/* ============================================================
   EVAT Continuum v3.95 — Client dynamique
   ============================================================ */

let utilisateur = JSON.parse(localStorage.getItem('evat_profil')) || null;
let iaDejaPresentee = localStorage.getItem('elaws_presentee') === 'true';
let deferredPrompt = null;
let onlineUsers = new Map(); // tel → {nom, metier, lastSeen}

// ---------- Service Worker ----------
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    });
}

// ---------- Wake Lock ----------
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

// ---------- PWA Install ----------
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const banner = document.getElementById('installBanner');
    if (banner) banner.style.display = 'flex';
});

function declencherInstallationApp() {
    const banner = document.getElementById('installBanner');
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted' && banner) banner.style.display = 'none';
            deferredPrompt = null;
        });
    } else {
        alert("Pour installer l'application, utilisez le menu de votre navigateur (Chrome / Safari) → « Ajouter à l'écran d'accueil ».");
    }
}

function fermerBanniereInstall() {
    const banner = document.getElementById('installBanner');
    if (banner) banner.style.display = 'none';
}

// ---------- Indicatif téléphone ----------
function mettreAJourIndicatif() {
    const select = document.getElementById('selectPays');
    const telInput = document.getElementById('inputTelProfil');
    if (!select || !telInput) return;
    const prefix = select.value;
    let currentVal = telInput.value.trim();
    ['+228', '+233', '+225', '+33', '+1'].forEach(p => {
        if (currentVal.startsWith(p)) currentVal = currentVal.substring(p.length);
    });
    telInput.value = prefix + currentVal;
}

// ---------- Socket.io ----------
const socket = io(SERVER_URL, {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    timeout: 20000
});

socket.on('connect', () => {
    const statusEl = document.getElementById('serverConnectionStatus');
    if (statusEl) {
        statusEl.innerHTML = "🟢 Connecté";
        statusEl.style.color = "var(--success)";
    }
    if (utilisateur && utilisateur.telephone && utilisateur.recoveryPin) {
        socket.emit('register_user', {
            nom: utilisateur.nom,
            telephone: utilisateur.telephone,
            metier: utilisateur.metier,
            recoveryPin: utilisateur.recoveryPin
        }, (res) => {
            if (res && res.ok === false) {
                // PIN invalide ou compte pris → forcer la récupération
                montrerNotification(res.error || 'Session non reconnue. Récupérez votre compte.');
            }
        });
        if (window._heartbeatInterval) clearInterval(window._heartbeatInterval);
        window._heartbeatInterval = setInterval(() => socket.emit('heartbeat'), 25000);
    }
});

socket.on('disconnect', () => {
    const statusEl = document.getElementById('serverConnectionStatus');
    if (statusEl) {
        statusEl.innerHTML = "🔴 Déconnecté";
        statusEl.style.color = "var(--danger)";
    }
});

// Compte ouvert sur un autre téléphone → cet appareil est déconnecté automatiquement
socket.on('force_logout', (data) => {
    const msg = (data && data.message)
        ? data.message
        : 'Votre compte a été ouvert sur un autre appareil. Vous êtes déconnecté.';

    try {
        if (typeof fermerAppelTotalLocally === 'function') fermerAppelTotalLocally();
    } catch (e) {}

    localStorage.removeItem('evat_profil');
    localStorage.removeItem('elaws_presentee');
    utilisateur = null;
    iaDejaPresentee = false;

    if (window._heartbeatInterval) {
        clearInterval(window._heartbeatInterval);
        window._heartbeatInterval = null;
    }

    fermerTousLesMenus();

    const welcomeModal = document.getElementById('welcomeModal');
    if (welcomeModal) {
        welcomeModal.style.display = 'flex';
        if (typeof afficherModeAuth === 'function') afficherModeAuth('recover');
    }

    alert(msg);
    montrerNotification('🔒 Session terminée — compte ouvert ailleurs');
});

socket.on('contact_registered', (data) => {
    if (utilisateur && utilisateur.contacts) {
        const match = utilisateur.contacts.find(c => c.telephone === data.telephone);
        if (match) {
            match.metier = data.metier;
            match.online = true;
            localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
            afficherContacts();
            montrerNotification(`🚨 ${match.nom} (${data.telephone}) vient de s'inscrire ! Métier : ${data.metier}`);
        }
    }
});

// Présence temps réel
socket.on('presence_update', (list) => {
    onlineUsers.clear();
    if (Array.isArray(list)) {
        list.forEach(u => onlineUsers.set(u.telephone, u));
    }
    // Mettre à jour les contacts
    if (utilisateur && utilisateur.contacts) {
        utilisateur.contacts.forEach(c => {
            const online = onlineUsers.has(c.telephone);
            c.online = online;
            if (online) {
                const info = onlineUsers.get(c.telephone);
                if (info.metier) c.metier = info.metier;
            }
        });
        localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
        afficherContacts();
    }
    // Mettre à jour le compteur dashboard
    const el = document.getElementById('onlineCount');
    if (el) el.textContent = onlineUsers.size;
});

// Nouveau message temps réel
socket.on('new_message', (msg) => {
    if (!utilisateur) return;
    if (!utilisateur.messagesLocaux) utilisateur.messagesLocaux = [];

    // Éviter les doublons
    if (utilisateur.messagesLocaux.some(m => m.id === msg.id)) return;

    utilisateur.messagesLocaux.push({
        id: msg.id,
        expediteur: msg.fromName || msg.from,
        texte: msg.texte,
        heure: msg.heure,
        fromMe: msg.from === utilisateur.telephone,
        to: msg.to
    });

    // Garder max 150 messages
    if (utilisateur.messagesLocaux.length > 150) {
        utilisateur.messagesLocaux = utilisateur.messagesLocaux.slice(-150);
    }
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));

    // Si on est sur l'onglet messagerie → rafraîchir
    const tab = document.getElementById('tab-messagerie');
    if (tab && tab.style.display !== 'none') {
        afficherMessagesLocaux();
    } else {
        // Notification discrète
        montrerNotification(`💬 ${msg.fromName || 'Quelqu’un'} : ${msg.texte.slice(0, 40)}${msg.texte.length > 40 ? '…' : ''}`);
    }
});

// Position partagée
socket.on('signal', (data) => {
    if (data.type === 'location') {
        if (mapInstance) {
            L.marker([data.lat, data.lng])
                .addTo(mapInstance)
                .bindPopup(`<b>📍 ${data.sender}</b>`)
                .openPopup();
        }
        if (mapInstanceMessage) {
            L.marker([data.lat, data.lng])
                .addTo(mapInstanceMessage)
                .bindPopup(`<b>📍 ${data.sender}</b>`)
                .openPopup();
        }
        montrerNotification(`📍 Position reçue de ${data.sender}`);
    }
});

// ---------- Notifications ----------
function montrerNotification(texte) {
    const banner = document.getElementById('notificationBanner');
    const textEl = document.getElementById('notificationText');
    if (banner && textEl) {
        textEl.innerText = texte;
        banner.style.display = 'block';
        banner.classList.add('notif-in');
        clearTimeout(window._notifTimer);
        window._notifTimer = setTimeout(() => fermerNotification(), 9000);
    }
}

function fermerNotification() {
    const banner = document.getElementById('notificationBanner');
    if (banner) {
        banner.classList.remove('notif-in');
        banner.style.display = 'none';
    }
}

// ---------- Auth sécurisée (1 numéro = 1 compte) ----------
const NOMS_INTERDITS = [
    'kodjo marceline', 'kodjo', 'marceline', 'test', 'admin',
    'utilisateur', 'user', 'exemple', 'demo', 'opérateur', 'operateur'
];

function nomEstValideClient(nom) {
    if (!nom || nom.trim().length < 3) return false;
    const n = nom.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (NOMS_INTERDITS.some(x => n === x || n.includes(x))) return false;
    if (!/[a-zàâäéèêëïîôùûüç]/i.test(nom)) return false;
    return true;
}

function telEstValideClient(tel) {
    const t = String(tel || '').replace(/[\s\-\.\(\)]/g, '');
    return /^\+[1-9]\d{8,14}$/.test(t);
}

function afficherErreurAuth(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
}

function afficherModeAuth(mode) {
    const create = document.getElementById('authModeCreate');
    const recover = document.getElementById('authModeRecover');
    const btnC = document.getElementById('tabBtnCreate');
    const btnR = document.getElementById('tabBtnRecover');
    if (!create || !recover) return;
    if (mode === 'recover') {
        create.style.display = 'none';
        recover.style.display = 'block';
        if (btnC) btnC.classList.remove('active');
        if (btnR) btnR.classList.add('active');
    } else {
        create.style.display = 'block';
        recover.style.display = 'none';
        if (btnC) btnC.classList.add('active');
        if (btnR) btnR.classList.remove('active');
    }
    afficherErreurAuth('authCreateError', '');
    afficherErreurAuth('authRecoverError', '');
}

function creerProfilLocal(nom, tel, metier, recoveryPin) {
    return {
        nom,
        telephone: tel,
        metier: metier || 'Opérateur',
        recoveryPin: recoveryPin || null,
        qubits: 365,
        notes: [],
        messagesLocaux: [],
        contacts: [],
        historiqueElaws: [],
        parametres: {
            sonnerieType: 'iphone',
            customRingtoneBase64: null,
            vibration: true
        },
        photo: null
    };
}

function sauvegarderProfilBase() {
    const nom = document.getElementById('inputNom').value.trim();
    const tel = document.getElementById('inputTelProfil').value.trim().replace(/[\s\-\.\(\)]/g, '');
    const metier = document.getElementById('inputMetier').value.trim();

    afficherErreurAuth('authCreateError', '');

    if (!nom || !tel) {
        afficherErreurAuth('authCreateError', 'Nom et numéro obligatoires.');
        return;
    }
    if (!nomEstValideClient(nom)) {
        afficherErreurAuth('authCreateError', 'Entrez VOTRE vrai nom et prénom (les noms d’exemple / test sont interdits).');
        return;
    }
    if (!telEstValideClient(tel)) {
        afficherErreurAuth('authCreateError', 'Numéro invalide. Format : +228XXXXXXXX');
        return;
    }

    if (!socket.connected) {
        afficherErreurAuth('authCreateError', 'Serveur hors ligne. Réessayez dans un instant.');
        return;
    }

    // Création sécurisée côté serveur (1 numéro = 1 compte)
    socket.emit('register_new', { nom, telephone: tel, metier }, (res) => {
        if (!res || !res.ok) {
            afficherErreurAuth('authCreateError', (res && res.error) || 'Échec de la création.');
            if (res && res.needsRecovery) afficherModeAuth('recover');
            return;
        }

        utilisateur = creerProfilLocal(nom, tel, metier, res.recoveryPin);
        localStorage.setItem('evat_profil', JSON.stringify(utilisateur));

        // Afficher le code UNE SEULE FOIS
        const pinModal = document.getElementById('pinModal');
        const pinDisplay = document.getElementById('pinDisplay');
        if (pinDisplay) pinDisplay.textContent = res.recoveryPin;
        if (pinModal) pinModal.style.display = 'flex';

        const welcomeModal = document.getElementById('welcomeModal');
        if (welcomeModal) welcomeModal.style.display = 'none';

        appliquerInfosProfil();
        verifierEtSynchroniserContacts();
        montrerNotification(`Bienvenue ${utilisateur.nom} ! Notez votre code de récupération.`);
    });
}

function fermerPinModal() {
    const pinModal = document.getElementById('pinModal');
    if (pinModal) pinModal.style.display = 'none';
}

function recupererCompteExistant() {
    const tel = document.getElementById('inputTelRecover').value.trim().replace(/[\s\-\.\(\)]/g, '');
    const pin = document.getElementById('inputPinRecover').value.trim();
    const metier = document.getElementById('inputMetierRecover').value.trim();

    afficherErreurAuth('authRecoverError', '');

    if (!tel || !pin) {
        afficherErreurAuth('authRecoverError', 'Numéro et code de récupération obligatoires.');
        return;
    }
    if (!telEstValideClient(tel)) {
        afficherErreurAuth('authRecoverError', 'Numéro invalide. Format : +228XXXXXXXX');
        return;
    }

    if (!socket.connected) {
        afficherErreurAuth('authRecoverError', 'Serveur hors ligne. Réessayez.');
        return;
    }

    socket.emit('recover_account', { telephone: tel, recoveryPin: pin, metier }, (res) => {
        if (!res || !res.ok) {
            afficherErreurAuth('authRecoverError', (res && res.error) || 'Récupération impossible.');
            return;
        }

        const p = res.profil;
        // Nouveau code d'activation (l'ancien n'est plus valide)
        const nouveauPin = res.recoveryPin || pin;
        utilisateur = creerProfilLocal(p.nom, p.telephone, p.metier || metier, nouveauPin);
        localStorage.setItem('evat_profil', JSON.stringify(utilisateur));

        const welcomeModal = document.getElementById('welcomeModal');
        if (welcomeModal) welcomeModal.style.display = 'none';

        // Afficher le NOUVEAU code une seule fois
        if (res.recoveryPin) {
            const pinModal = document.getElementById('pinModal');
            const pinDisplay = document.getElementById('pinDisplay');
            if (pinDisplay) pinDisplay.textContent = res.recoveryPin;
            if (pinModal) pinModal.style.display = 'flex';
        }

        appliquerInfosProfil();
        verifierEtSynchroniserContacts();
        montrerNotification(`Compte récupéré : ${utilisateur.nom} — notez le nouveau code`);
    });
}

function sauvegarderProfilBaseDesdeProfil() {
    if (!utilisateur) return;
    const nom = document.getElementById('inputNomProfil').value.trim();
    const tel = document.getElementById('inputTelProfil2').value.trim().replace(/[\s\-\.\(\)]/g, '');
    const metier = document.getElementById('inputMetierProfil').value.trim();

    if (!nom || !tel) {
        alert('Le nom et le téléphone sont obligatoires.');
        return;
    }
    if (!nomEstValideClient(nom)) {
        alert('Nom invalide ou réservé. Entrez votre vrai nom.');
        return;
    }

    // Le numéro ne peut PAS être changé librement (1 numéro = 1 compte)
    if (tel !== utilisateur.telephone) {
        alert('Le numéro de compte ne peut pas être modifié ici.\nPour un nouveau numéro, créez un nouveau compte.\nPour changer d’appareil, utilisez « Récupérer mon compte » avec votre code.');
        document.getElementById('inputTelProfil2').value = utilisateur.telephone;
        return;
    }

    utilisateur.nom = nom;
    utilisateur.metier = metier;
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));

    // Re-lier avec le PIN pour prouver l'identité
    socket.emit('register_user', {
        nom: utilisateur.nom,
        telephone: utilisateur.telephone,
        metier: utilisateur.metier,
        recoveryPin: utilisateur.recoveryPin
    }, (res) => {
        if (res && res.ok === false) {
            alert(res.error || 'Mise à jour serveur refusée.');
            return;
        }
        appliquerInfosProfil();
        alert('✅ Profil mis à jour !');
    });
}

function sauvegarderParametresApp() {
    if (!utilisateur) return;
    if (!utilisateur.parametres) utilisateur.parametres = {};
    const selectSon = document.getElementById('selectSonnerieType');
    if (selectSon) utilisateur.parametres.sonnerieType = selectSon.value;
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    alert("⚙️ Paramètres enregistrés !");
}

function chargerSonneriePerso(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
        alert("Fichier trop volumineux (max 1 Mo).");
        return;
    }
    const reader = new FileReader();
    reader.onload = function (e) {
        if (!utilisateur.parametres) utilisateur.parametres = {};
        utilisateur.parametres.customRingtoneBase64 = e.target.result;
        utilisateur.parametres.sonnerieType = 'custom';
        localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
        alert("🎵 Sonnerie personnelle enregistrée !");
    };
    reader.readAsDataURL(file);
}

function deconnecterUtilisateur() {
    if (confirm("Voulez-vous vraiment réinitialiser et refaire l'enregistrement ?")) {
        localStorage.removeItem('evat_profil');
        localStorage.removeItem('elaws_presentee');
        iaDejaPresentee = false;
        utilisateur = null;
        fermerTousLesMenus();
        const welcomeModal = document.getElementById('welcomeModal');
        if (welcomeModal) welcomeModal.style.display = 'flex';
    }
}

function appliquerInfosProfil() {
    if (!utilisateur) return;
    if (!utilisateur.contacts) {
        utilisateur.contacts = [
            { nom: "Directeur Cabinet", telephone: "+22898231401", metier: "Cosmétiques & Management", online: false },
            { nom: "Support Technique", telephone: "+22898231402", metier: "Ingénierie Continuum", online: false }
        ];
    }
    if (!utilisateur.parametres) {
        utilisateur.parametres = { sonnerieType: 'iphone', customRingtoneBase64: null };
    }

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    };
    setVal('inputNom', utilisateur.nom);
    setVal('inputNomProfil', utilisateur.nom);
    setVal('inputTelProfil', utilisateur.telephone);
    setVal('inputTelProfil2', utilisateur.telephone);
    setVal('inputMetier', utilisateur.metier);
    setVal('inputMetierProfil', utilisateur.metier);

    if (document.getElementById('sidebarUserName')) document.getElementById('sidebarUserName').innerText = utilisateur.nom;
    if (document.getElementById('sidebarUserRole')) document.getElementById('sidebarUserRole').innerText = utilisateur.metier;
    if (document.getElementById('dashUserName')) document.getElementById('dashUserName').innerText = utilisateur.nom.toUpperCase();
    if (document.getElementById('dashUserMetier')) document.getElementById('dashUserMetier').innerText = utilisateur.metier;
    if (document.getElementById('voipStatusDisplay')) document.getElementById('voipStatusDisplay').innerText = "ID : " + utilisateur.telephone;

    const selectSon = document.getElementById('selectSonnerieType');
    if (selectSon && utilisateur.parametres.sonnerieType) {
        selectSon.value = utilisateur.parametres.sonnerieType;
    }

    rafraichirHeaderProfil();
    verifierEtSynchroniserContacts();
    afficherContacts();
}

function verifierEtSynchroniserContacts() {
    if (!utilisateur || !utilisateur.contacts) return;
    socket.emit('query_contacts', utilisateur.contacts.map(c => c.telephone), (reponses) => {
        if (reponses && Array.isArray(reponses)) {
            reponses.forEach(info => {
                const contact = utilisateur.contacts.find(c => c.telephone === info.telephone);
                if (contact) {
                    if (info.metier) contact.metier = info.metier;
                    contact.online = !!info.online;
                }
            });
            localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
            afficherContacts();
        }
    });
}

// ---------- Contacts dynamiques ----------
function afficherContacts() {
    const container = document.getElementById('listeContactsContainer');
    if (!container || !utilisateur || !utilisateur.contacts) return;

    if (utilisateur.contacts.length === 0) {
        container.innerHTML = `<p style="color:var(--text-secondary); font-size:11.5px;">Aucun contact.</p>`;
        return;
    }

    let html = '';
    utilisateur.contacts.forEach((c, index) => {
        const isOnline = c.online || onlineUsers.has(c.telephone);
        const statusDot = isOnline
            ? `<span class="online-dot" title="En ligne"></span>`
            : `<span class="offline-dot" title="Hors ligne"></span>`;

        html += `
        <div class="contact-card">
            <div class="contact-info">
                <strong>👤 ${c.nom} ${statusDot}</strong>
                <div class="contact-meta">📞 ${c.telephone} • <i>${c.metier || 'Sync...'}</i></div>
            </div>
            <div class="contact-actions">
                <button onclick="preparerAppel('${c.telephone}')" class="btn-mini success" title="Appeler">📞</button>
                <button onclick="ecrireAuContact('${c.nom}', '${c.telephone}')" class="btn-mini accent" title="Écrire">💬</button>
                <button onclick="modifierContact(${index})" class="btn-mini blue" title="Modifier">✏️</button>
                <button onclick="supprimerContact(${index})" class="btn-mini danger" title="Supprimer">🗑️</button>
            </div>
        </div>`;
    });
    container.innerHTML = html;
}

function ajouterNouveauContact() {
    const nom = document.getElementById('nouveauNomContact').value.trim();
    const tel = document.getElementById('nouveauTelContact').value.trim();
    if (!nom || !tel) {
        alert("Nom et numéro obligatoires.");
        return;
    }
    if (!utilisateur.contacts) utilisateur.contacts = [];
    utilisateur.contacts.push({ nom, telephone: tel, metier: "Recherche...", online: false });
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    document.getElementById('nouveauNomContact').value = '';
    document.getElementById('nouveauTelContact').value = '';
    afficherContacts();
    verifierEtSynchroniserContacts();
    montrerNotification(`✅ Contact ${nom} enregistré`);
}

function modifierContact(index) {
    const c = utilisateur.contacts[index];
    const nouveauNom = prompt("Modifier le nom :", c.nom);
    if (nouveauNom === null) return;
    const nouveauTel = prompt("Modifier le numéro :", c.telephone);
    if (nouveauTel === null) return;
    utilisateur.contacts[index].nom = nouveauNom.trim();
    utilisateur.contacts[index].telephone = nouveauTel.trim();
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    afficherContacts();
    verifierEtSynchroniserContacts();
}

function supprimerContact(index) {
    if (confirm("Supprimer ce contact ?")) {
        utilisateur.contacts.splice(index, 1);
        localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
        afficherContacts();
    }
}

function ecrireAuContact(nom, tel) {
    const message = prompt(`Message à ${nom} (${tel}) :`);
    if (!message) return;

    // Envoi temps réel
    socket.emit('send_message', {
        from: utilisateur.telephone,
        fromName: utilisateur.nom,
        to: tel,
        texte: message
    });

    // Aussi localement pour l’historique
    if (!utilisateur.messagesLocaux) utilisateur.messagesLocaux = [];
    utilisateur.messagesLocaux.push({
        id: 'local-' + Date.now(),
        expediteur: utilisateur.nom,
        texte: `À ${nom} : ${message}`,
        heure: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        fromMe: true
    });
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    switchTab('messagerie');
    afficherMessagesLocaux();
}

function preparerAppel(tel) {
    switchTab('messagerie');
    setTimeout(() => {
        const input = document.getElementById('appelCibleNum');
        if (input && tel) input.value = String(tel).replace(/\s+/g, '');
        toggleChoixAppel(true);
    }, 80);
}

// ---------- IA ELAWS améliorée (dynamique) ----------
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
    if (statusEl) statusEl.innerText = "🎙️ Écoute...";

    recognition.onresult = (event) => {
        inputEl.value = event.results[0][0].transcript;
        if (statusEl) statusEl.innerText = "";
        poserQuestionElaws();
    };
    recognition.onerror = () => { if (statusEl) statusEl.innerText = ""; };
    recognition.onend = () => { if (statusEl) statusEl.innerText = ""; };
    recognition.start();
}

function poserQuestionElaws() {
    const input = document.getElementById('elawsInput');
    const question = input.value.trim();
    if (!question || !utilisateur) return;

    const chatBox = document.getElementById('elawsChatBox');
    const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    // Message utilisateur
    chatBox.innerHTML += `
        <div class="msg-user">
            <strong>👤 ${utilisateur.nom}</strong>
            <span class="msg-time">${now}</span>
            <p>${escapeHtml(question)}</p>
        </div>`;
    input.value = '';
    input.style.height = '42px'; // reset hauteur pour revoir tout le prochain texte
    chatBox.scrollTop = chatBox.scrollHeight;

    // Typing indicator
    const typingId = 'typing-' + Date.now();
    chatBox.innerHTML += `<div id="${typingId}" class="msg-ai typing">🤖 ELAWS analyse...</div>`;
    chatBox.scrollTop = chatBox.scrollHeight;

    // Réponse dynamique (simulation de latence réaliste)
    setTimeout(() => {
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();

        const reponse = genererReponseElaws(question);
        chatBox.innerHTML += `
            <div class="msg-ai">
                <strong>🤖 ELAWS AI</strong>
                <span class="msg-time">${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                <p>${reponse}</p>
            </div>`;
        chatBox.scrollTop = chatBox.scrollHeight;

        // Historique local
        if (!utilisateur.historiqueElaws) utilisateur.historiqueElaws = [];
        utilisateur.historiqueElaws.push({ q: question, r: reponse, t: Date.now() });
        if (utilisateur.historiqueElaws.length > 30) utilisateur.historiqueElaws.shift();
        localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    }, 400 + Math.random() * 600);
}

function genererReponseElaws(question) {
    const q = question.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const nom = utilisateur.nom.split(' ')[0];
    const metier = utilisateur.metier || 'opérateur';
    const onlineCount = onlineUsers.size;

    // Réponses contextuelles dynamiques
    const patterns = [
        {
            test: /(bonjour|salut|hello|bonsoir|hey)/,
            replies: [
                `Bonjour ${nom} ! En tant qu'expert en ${metier}, je suis pleinement opérationnel. Que puis-je analyser pour vous ?`,
                `Salut ${nom} 👋. Système Continuum synchronisé. Comment puis-je vous assister aujourd'hui ?`,
                `Bonjour ! ${onlineCount} opérateurs sont actuellement en ligne sur le réseau. Que souhaitez-vous ?`
            ]
        },
        {
            test: /(merci|thanks|remercie)/,
            replies: [
                `Avec plaisir, ${nom}. Je reste en veille sur vos systèmes.`,
                `C'est un honneur, ${nom}. N'hésitez pas si vous avez d'autres besoins.`,
                `Toujours à votre service. Le continuum reste stable.`
            ]
        },
        {
            test: /(contact|annuaire|qui est|numero)/,
            replies: [
                `Votre annuaire contient ${utilisateur.contacts ? utilisateur.contacts.length : 0} contacts. ${onlineCount} sont en ligne en ce moment. Allez dans l'onglet Contacts pour les gérer.`,
                `Pour appeler ou écrire, ouvrez l'Annuaire. Votre propre ID VoIP est ${utilisateur.telephone}.`
            ]
        },
        {
            test: /(appel|voip|appeler|sonnerie)/,
            replies: [
                `Les appels audio/vidéo P2P sont disponibles dans Discussion → 📞. Votre ID : ${utilisateur.telephone}.`,
                `Vous pouvez changer la sonnerie dans Paramètres. Styles iPhone, Samsung, Motorola ou MP3 perso.`
            ]
        },
        {
            test: /(entreprise|business|nif|statut|lome|togo)/,
            replies: [
                `Pour une structure à Lomé, je recommande une séparation claire entre NIF personnel et professionnel. Souhaitez-vous un plan d'action étape par étape ?`,
                `La gestion multi-entités au Togo nécessite une attention particulière sur les formalités RCCM et fiscales. Je peux vous guider.`
            ]
        },
        {
            test: /(aide|que peux|fonction|capacite|que fais)/,
            replies: [
                `Je suis ELAWS AI, cœur de l'écosystème EVAT Continuum. Je gère notes, stratégie, communications chiffrées, présence réseau et analyse contextuelle.`,
                `Fonctions principales : messagerie temps réel, appels P2P, GPS partagé, quêtes, bloc-notes et assistant stratégique. Que voulez-vous explorer ?`
            ]
        },
        {
            test: /(heure|temps|date|aujourd)/,
            replies: [
                `Il est actuellement ${new Date().toLocaleTimeString('fr-FR')}. Date : ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`
            ]
        },
        {
            test: /(en ligne|online|connecte|presence)/,
            replies: [
                `Actuellement ${onlineCount} opérateur${onlineCount > 1 ? 's' : ''} en ligne sur le continuum.`,
                `Le réseau compte ${onlineCount} présence(s) active(s). Votre statut est visible pour vos contacts.`
            ]
        },
        {
            test: /(note|bloc|ecrire|memo)/,
            replies: [
                `Utilisez l'onglet Outils pour créer des notes. Elles sont sauvegardées localement et exportables.`,
                `Je peux vous rappeler le contenu de vos notes si vous me le demandez plus tard.`
            ]
        },
        {
            test: /(voyage|visa|paris|destination)/,
            replies: [
                `Ouvrez le module Voyage pour une analyse rapide des formalités. Indiquez simplement la destination.`,
                `Pour un voyage, prévoyez passeport, visa éventuel et assurances. Je peux affiner selon le pays.`
            ]
        },
        {
            test: /(qubit|quete|score|point)/,
            replies: [
                `Vous disposez actuellement de ${utilisateur.qubits || 365} Qubits. Continuez les quêtes pour en gagner plus !`,
                `Les Qubits mesurent votre activité dans le continuum. Consultez l'onglet Quêtes.`
            ]
        }
    ];

    for (const p of patterns) {
        if (p.test.test(q)) {
            const replies = p.replies;
            return replies[Math.floor(Math.random() * replies.length)];
        }
    }

    // Réponse générique intelligente
    const generic = [
        `Analyse de « ${question} » validée pour ${nom} (${metier}). Le système applique vos consignes avec succès.`,
        `J'ai bien reçu votre requête. Dans le contexte de ${metier}, je recommande de croiser avec vos notes et contacts récents.`,
        `Traitement terminé. Souhaitez-vous que j'approfondisse un aspect particulier de « ${question.slice(0, 40)} » ?`,
        `Compris. Je reste disponible pour affiner cette analyse ou lancer une action dans le continuum.`
    ];
    return generic[Math.floor(Math.random() * generic.length)];
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ---------- Navigation ----------
window._grandModuleOuvert = null;
let mapInstanceMessage = null;
let userMarkerMessage = null;

function toggleGrandModule(id) {
    const was = window._grandModuleOuvert === id;
    window._grandModuleOuvert = was ? null : id;
    document.querySelectorAll('.nav-module').forEach(el => {
        const open = el.getAttribute('data-module') === window._grandModuleOuvert;
        el.classList.toggle('open', open);
        const sous = el.querySelector('.nav-sous');
        if (sous) sous.style.display = open ? 'flex' : 'none';
        const chev = el.querySelector('.nav-chevron');
        if (chev) chev.textContent = open ? '▲' : '▼';
    });
}

function ouvrirSousModule(tabId) {
    if (typeof switchTab === 'function') switchTab(tabId);
}

function toggleChoixAppel(forceOpen) {
    const p = document.getElementById('panneauChoixAppel');
    if (!p) return;
    const show = typeof forceOpen === 'boolean' ? forceOpen : (p.style.display === 'none' || getComputedStyle(p).display === 'none');
    p.style.display = show ? 'block' : 'none';
    if (show) {
        fermerGpsMessage();
        if (utilisateur) {
            const st = document.getElementById('voipStatusDisplay');
            if (st) st.textContent = 'ID : ' + (utilisateur.telephone || '—');
        }
    }
}

function fermerChoixAppel() {
    const p = document.getElementById('panneauChoixAppel');
    if (p) p.style.display = 'none';
}

function toggleGpsMessage(forceOpen) {
    const p = document.getElementById('panneauGpsMessage');
    if (!p) return;
    const show = typeof forceOpen === 'boolean' ? forceOpen : (p.style.display === 'none' || getComputedStyle(p).display === 'none');
    p.style.display = show ? 'block' : 'none';
    if (show) {
        fermerChoixAppel();
        setTimeout(initCarteMessage, 150);
    }
}

function fermerGpsMessage() {
    const p = document.getElementById('panneauGpsMessage');
    if (p) p.style.display = 'none';
}

function initCarteMessage() {
    const el = document.getElementById('mapContainerMessage');
    if (!el || typeof L === 'undefined') {
        const st = document.getElementById('gpsMessageStatus');
        if (st) st.textContent = 'Carte indisponible.';
        return;
    }
    try {
        if (!mapInstanceMessage) {
            mapInstanceMessage = L.map('mapContainerMessage').setView([6.1375, 1.2123], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(mapInstanceMessage);
        } else {
            mapInstanceMessage.invalidateSize();
        }
        centrerSurMoiMessage();
    } catch (e) {
        const st = document.getElementById('gpsMessageStatus');
        if (st) st.textContent = 'Erreur carte.';
    }
}

function centrerSurMoiMessage() {
    const st = document.getElementById('gpsMessageStatus');
    if (!navigator.geolocation) {
        if (st) st.textContent = 'GPS non supporté.';
        return;
    }
    if (st) st.textContent = 'Localisation…';
    navigator.geolocation.getCurrentPosition(function (pos) {
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        if (mapInstanceMessage) {
            mapInstanceMessage.setView([lat, lng], 15);
            if (userMarkerMessage) mapInstanceMessage.removeLayer(userMarkerMessage);
            userMarkerMessage = L.marker([lat, lng]).addTo(mapInstanceMessage).bindPopup('<b>📍 Vous</b>').openPopup();
        }
        if (st) st.textContent = lat.toFixed(5) + ', ' + lng.toFixed(5);
    }, function () {
        if (st) st.textContent = 'Position refusée ou indisponible.';
    }, { enableHighAccuracy: true, timeout: 12000 });
}

function rafraichirHeaderProfil() {
    if (!utilisateur) return;
    const nomEl = document.getElementById('headerProfilNom');
    const telEl = document.getElementById('headerProfilTel');
    const photoEl = document.getElementById('headerProfilPhoto');
    if (nomEl) nomEl.textContent = utilisateur.nom || 'Profil';
    if (telEl) telEl.textContent = utilisateur.telephone || '';
    if (photoEl) {
        if (utilisateur.photo) {
            photoEl.innerHTML = '<img src="' + utilisateur.photo + '" style="width:100%;height:100%;object-fit:cover;">';
        } else {
            const p = String(utilisateur.nom || '?').trim().split(/\s+/);
            photoEl.textContent = p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : (p[0] || '?').slice(0, 2).toUpperCase();
        }
    }
}

function toggleMenu(e) {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('appOverlay');
    if (sidebar && overlay) {
        const isOpen = sidebar.classList.toggle('open');
        if (isOpen) overlay.classList.add('active');
        else overlay.classList.remove('active');
    }
}

function fermerTousLesMenus() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('appOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
}

// ---------- Cartes & GPS ----------
let mapInstance = null;
let userMarker = null;

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    const target = document.getElementById('tab-' + tabId);
    if (target) {
        target.style.display = 'block';
        target.classList.add('tab-fade');
    }
    const link = document.getElementById('link-' + tabId);
    if (link) link.classList.add('active');
    fermerTousLesMenus();

    if (tabId === 'contacts') afficherContacts();
    if (tabId === 'messagerie') afficherMessagesLocaux();
    if (tabId === 'map') {
        setTimeout(() => {
            if (!mapInstance) {
                mapInstance = L.map('mapContainer').setView([6.1375, 1.2123], 13);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(mapInstance);
            } else {
                mapInstance.invalidateSize();
            }
        }, 200);
    }
    if (tabId === 'elaws-ia' && !iaDejaPresentee) {
        iaDejaPresentee = true;
        localStorage.setItem('elaws_presentee', 'true');
    }
}

function centrerSurMoi() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            if (mapInstance) {
                mapInstance.setView([lat, lng], 15);
                if (userMarker) mapInstance.removeLayer(userMarker);
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
            montrerNotification("📍 Position partagée avec le réseau !");
        }, () => alert("Impossible d'obtenir la position."));
    }
}

// ---------- Messagerie dynamique ----------
/** Agrandit automatiquement le textarea pour voir tout le texte écrit */
function autoResize(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
}

function envoyerMessageChatLocal() {
    const input = document.getElementById('chatLocalInput');
    const texte = input.value.trim();
    if (!texte || !utilisateur) return;

    // Envoi temps réel (broadcast)
    socket.emit('send_message', {
        from: utilisateur.telephone,
        fromName: utilisateur.nom,
        to: null,
        texte: texte
    });

    input.value = '';
    input.style.height = '42px'; // reset hauteur
}

function afficherMessagesLocaux() {
    const container = document.getElementById('listeMessagesLocaux');
    if (!container || !utilisateur) return;

    const msgs = utilisateur.messagesLocaux || [];
    if (msgs.length === 0) {
        container.innerHTML = `<p style="color:var(--text-secondary);font-size:12px;text-align:center;padding:20px;">Aucun message. Écrivez ou attendez les messages du réseau…</p>`;
        return;
    }

    let html = '';
    msgs.forEach(m => {
        const isMe = m.fromMe || m.expediteur === utilisateur.nom;
        html += `
        <div class="msg-bubble ${isMe ? 'me' : 'other'}">
            <div class="msg-header">
                <span>${isMe ? 'Vous' : '👤 ' + escapeHtml(m.expediteur)}</span>
                <span class="msg-time">${m.heure || ''}</span>
            </div>
            <p>${escapeHtml(m.texte)}</p>
        </div>`;
    });
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

// ---------- Notes ----------
function ajouterNoteBlocNotes() {
    const titre = document.getElementById('noteTitre').value.trim();
    const contenu = document.getElementById('noteContenu').value.trim();
    if (!titre || !contenu || !utilisateur) return;
    if (!utilisateur.notes) utilisateur.notes = [];
    utilisateur.notes.unshift({ titre, contenu, date: new Date().toLocaleString('fr-FR') });
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    document.getElementById('noteTitre').value = '';
    document.getElementById('noteContenu').value = '';
    afficherNotesBlocNotes();
    montrerNotification("📌 Note enregistrée");
}

function afficherNotesBlocNotes() {
    const container = document.getElementById('listeNotesContainer');
    if (!container || !utilisateur || !utilisateur.notes) return;
    let html = '';
    utilisateur.notes.forEach((n, i) => {
        html += `
        <div class="note-card">
            <strong>📌 ${escapeHtml(n.titre)}</strong>
            <p>${escapeHtml(n.contenu)}</p>
            <small>${n.date || ''}</small>
            <button onclick="supprimerNote(${i})" class="btn-mini danger" style="margin-top:6px;">Supprimer</button>
        </div>`;
    });
    container.innerHTML = html || '<p style="color:var(--text-secondary);font-size:12px;">Aucune note.</p>';
}

function supprimerNote(index) {
    if (!utilisateur.notes) return;
    utilisateur.notes.splice(index, 1);
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    afficherNotesBlocNotes();
}

// ---------- Outils divers ----------
function genererPlanSucces1000() {
    const obj = document.getElementById('inputObjectif1000').value.trim();
    const container = document.getElementById('resultatPlan1000');
    if (!obj) return;
    container.style.display = 'block';
    const steps = [
        "1. Clarifier l'objectif en une phrase mesurable",
        "2. Identifier les 3 ressources critiques",
        "3. Planifier les 7 prochains jours",
        "4. Mesurer chaque soir (Qubits)",
        "5. Ajuster et scaler"
    ];
    container.innerHTML = `
        <div class="card" style="border-color:var(--success);">
            <h4 style="color:var(--success);">🚀 ${escapeHtml(obj)}</h4>
            <ul style="font-size:12px;padding-left:18px;margin:8px 0;">
                ${steps.map(s => `<li>${s}</li>`).join('')}
            </ul>
            <p style="font-size:11px;color:var(--text-secondary);">Plan généré dynamiquement — ${new Date().toLocaleString('fr-FR')}</p>
        </div>`;
}

function lancerAnalyseVoyageAvance() {
    const dest = document.getElementById('voyageDestination').value.trim();
    const container = document.getElementById('resultatAssistantVoyage');
    if (!dest) return;
    container.style.display = 'block';
    container.innerHTML = `
        <div class="card" style="border-color:var(--accent);">
            <h4 style="color:var(--accent);">✈️ ${escapeHtml(dest)}</h4>
            <p style="font-size:12px;">Analyse rapide :</p>
            <ul style="font-size:12px;padding-left:18px;">
                <li>Passeport valide ≥ 6 mois recommandé</li>
                <li>Vérifier visa / e-visa selon nationalité</li>
                <li>Assurances voyage + rapatriement</li>
                <li>Vaccins / certificats selon destination</li>
            </ul>
            <p style="font-size:11px;color:var(--text-secondary);">Généré le ${new Date().toLocaleString('fr-FR')}</p>
        </div>`;
}

function exporterDonneesCloud() {
    if (!utilisateur) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(utilisateur, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", "evat_backup_" + Date.now() + ".json");
    document.body.appendChild(dl);
    dl.click();
    dl.remove();
    montrerNotification("📥 Sauvegarde téléchargée");
}

// ---------- VoIP P2P (inchangé mais robustifié) ----------
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
            if (customAudioRing) return;
            customAudioRing = new Audio(utilisateur.parametres.customRingtoneBase64);
            customAudioRing.loop = true;
            customAudioRing.play().catch(() => {});
            return;
        }

        if (audioRingContext) return;
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
            if (!audioRingContext) return;
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
    } catch (e) {}
}

function arreterSonSonnerie() {
    if (ringInterval) { clearInterval(ringInterval); ringInterval = null; }
    if (audioRingContext) { audioRingContext.close().catch(() => {}); audioRingContext = null; }
    if (customAudioRing) { customAudioRing.pause(); customAudioRing.currentTime = 0; customAudioRing = null; }
    if (appelTimeoutTimer) { clearTimeout(appelTimeoutTimer); appelTimeoutTimer = null; }
    if (incomingTimeout) { clearTimeout(incomingTimeout); incomingTimeout = null; }
}

function afficherModalAppelEntrant(senderTel, typeAppel) {
    let modal = document.getElementById('incomingCallModal');
    let typeTxt = typeAppel === 'video' ? '📹 Appel Vidéo Entrant' : '📞 Appel Audio Entrant';
    if (!modal) {
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
    if (modal) modal.style.display = 'none';
}

async function lancerAppelDirectPeer(type) {
    const cibleTel = document.getElementById('appelCibleNum').value.trim();
    const logEl = document.getElementById('callStatusLog');
    const container = document.getElementById('callContainer');
    activeCallType = type;

    if (!cibleTel) {
        alert("Entrez le numéro du contact à appeler.");
        return;
    }
    if (cibleTel === utilisateur.telephone) {
        alert("Impossible de s'appeler soi-même !");
        return;
    }

    try {
        if (logEl) logEl.innerText = "🔄 Activation micro/caméra...";
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
                if (remoteAudio) remoteAudio.srcObject = event.streams[0];
                if (remoteVideo && type === 'video') remoteVideo.srcObject = event.streams[0];
                if (logEl) logEl.innerText = "✅ Connexion active !";
                arreterSonSonnerie();
            }
        };

        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                socket.emit('p2p_signal', {
                    target: cibleTel,
                    sender: utilisateur.telephone,
                    type: 'ice_candidate',
                    candidate: event.candidate,
                    callType: type
                });
            }
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        socket.emit('p2p_signal', {
            target: cibleTel,
            sender: utilisateur.telephone,
            type: 'offer',
            offer: offer,
            callType: type
        });

        jouerSonSonnerie();
        if (logEl) logEl.innerText = "📞 Sonnerie active...";

        appelTimeoutTimer = setTimeout(() => {
            if (peerConnection && peerConnection.connectionState !== 'connected') {
                raccrocherAppel(true);
                if (logEl) logEl.innerText = "❌ Pas de réponse.";
            }
        }, 30000);

    } catch (error) {
        if (logEl) logEl.innerText = "❌ Erreur micro/caméra.";
    }
}

socket.on('p2p_signal', async (data) => {
    const logEl = document.getElementById('callStatusLog');
    if (data.callType) activeCallType = data.callType;

    if (data.type === 'user_offline') {
        if (logEl) logEl.innerText = "❌ Destinataire hors ligne.";
        arreterSonSonnerie();
        return;
    }

    if (!peerConnection && data.type !== 'hangup' && data.type !== 'reject') {
        peerConnection = new RTCPeerConnection(servers);
        peerConnection.ontrack = event => {
            if (event.streams && event.streams[0]) {
                const remoteAudio = document.getElementById('remoteAudio');
                const remoteVideo = document.getElementById('remoteVideo');
                if (remoteAudio) remoteAudio.srcObject = event.streams[0];
                if (remoteVideo && activeCallType === 'video') remoteVideo.srcObject = event.streams[0];
                if (logEl) logEl.innerText = "✅ Connexion active !";
                arreterSonSonnerie();
            }
        };
        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                socket.emit('p2p_signal', {
                    target: data.sender,
                    sender: utilisateur.telephone,
                    type: 'ice_candidate',
                    candidate: event.candidate,
                    callType: activeCallType
                });
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
            if (logEl) logEl.innerText = "✅ Appel décroché !";
        } catch (e) {}
    } else if (data.type === 'ice_candidate' && data.candidate && peerConnection) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {}
    } else if (data.type === 'hangup' || data.type === 'reject') {
        fermerAppelTotalLocally();
        if (logEl) logEl.innerText = "❌ Appel terminé.";
    }
});

async function accepterAppelEntrant() {
    arreterSonSonnerie();
    cacherModalAppelEntrant();
    if (incomingTimeout) clearTimeout(incomingTimeout);

    const logEl = document.getElementById('callStatusLog');
    const container = document.getElementById('callContainer');
    container.style.display = 'block';

    if (!pendingOfferData) return;
    const data = pendingOfferData;
    activeCallType = data.callType || 'audio';

    try {
        if (logEl) logEl.innerText = "📞 Décrochage...";
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: activeCallType === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false
        });

        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        const remoteVideo = document.getElementById('remoteVideo');
        if (remoteVideo && activeCallType === 'video') {
            remoteVideo.srcObject = localStream;
        }

        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        socket.emit('p2p_signal', {
            target: data.sender,
            sender: utilisateur.telephone,
            type: 'answer',
            answer: answer,
            callType: activeCallType
        });
        if (logEl) logEl.innerText = "✅ Établi avec " + data.sender;
    } catch (err) {
        if (logEl) logEl.innerText = "❌ Erreur micro/caméra.";
    }
}

function rejeterAppelEntrant() {
    arreterSonSonnerie();
    cacherModalAppelEntrant();
    if (incomingTimeout) clearTimeout(incomingTimeout);

    if (pendingOfferData) {
        socket.emit('p2p_signal', {
            target: pendingOfferData.sender,
            sender: utilisateur.telephone,
            type: 'reject'
        });
        pendingOfferData = null;
    }
    fermerAppelTotalLocally();
}

function raccrocherAppel(isTimeout = false) {
    let targetTel = document.getElementById('appelCibleNum').value.trim();
    if (pendingOfferData && pendingOfferData.sender) {
        targetTel = pendingOfferData.sender;
    }
    if (targetTel) {
        socket.emit('p2p_signal', {
            target: targetTel,
            sender: utilisateur.telephone,
            type: 'hangup'
        });
    }
    fermerAppelTotalLocally();
}

function fermerAppelTotalLocally() {
    arreterSonSonnerie();
    cacherModalAppelEntrant();

    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    const remoteAudio = document.getElementById('remoteAudio');
    const remoteVideo = document.getElementById('remoteVideo');
    if (remoteAudio) remoteAudio.srcObject = null;
    if (remoteVideo) remoteVideo.srcObject = null;

    const container = document.getElementById('callContainer');
    if (container) container.style.display = 'none';

    pendingOfferData = null;
}

// ---------- Initialisation ----------
document.addEventListener('DOMContentLoaded', () => {
    const welcomeModal = document.getElementById('welcomeModal');
    if (!utilisateur || !utilisateur.nom || !utilisateur.telephone) {
        if (welcomeModal) welcomeModal.style.display = 'flex';
    } else {
        if (welcomeModal) welcomeModal.style.display = 'none';
        appliquerInfosProfil();
        afficherContacts();
    }
    afficherNotesBlocNotes();
    afficherMessagesLocaux();

    // Demander l'historique récent au serveur
    setTimeout(() => {
        if (socket.connected) {
            socket.emit('get_history', 40, (msgs) => {
                if (Array.isArray(msgs) && utilisateur) {
                    msgs.forEach(m => {
                        if (!utilisateur.messagesLocaux) utilisateur.messagesLocaux = [];
                        if (!utilisateur.messagesLocaux.some(x => x.id === m.id)) {
                            utilisateur.messagesLocaux.push({
                                id: m.id,
                                expediteur: m.fromName || m.from,
                                texte: m.texte,
                                heure: m.heure,
                                fromMe: m.from === utilisateur.telephone
                            });
                        }
                    });
                    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
                    afficherMessagesLocaux();
                }
            });
        }
    }, 1500);
});

async function demanderPermissionsEtActiverProfil() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        stream.getTracks().forEach(track => track.stop());
    } catch (err) {}
    sauvegarderProfilBase();
}
