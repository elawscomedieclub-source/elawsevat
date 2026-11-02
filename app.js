/* ============================================================
   EVAT Continuum v4.1 — Client dynamique
   ============================================================ */

/* ---------- Persistance optimisée ----------
   Avant : tout le profil (sonnerie en base64 jusqu'à 1,4 Mo incluse) était ré-écrit à CHAQUE message.
   Maintenant : écriture groupée (debounce) et gros fichiers dans des clés séparées, écrites seulement si modifiées. */
let _saveTimer = null, _ringSauvee = null, _photoSauvee = null;

function chargerProfil() {
    try {
        const p = JSON.parse(localStorage.getItem('evat_profil'));
        if (!p) return null;
        const ring = localStorage.getItem('evat_ringtone');
        if (ring) { p.parametres = p.parametres || {}; p.parametres.customRingtoneBase64 = ring; _ringSauvee = ring; }
        const photo = localStorage.getItem('evat_photo');
        if (photo) { p.photo = photo; _photoSauvee = photo; }
        return p;
    } catch (e) { return null; }
}

function sauverProfil() {
    if (_saveTimer) return;
    _saveTimer = setTimeout(sauverProfilMaintenant, 300);
}

function sauverProfilMaintenant() {
    clearTimeout(_saveTimer); _saveTimer = null;
    if (!utilisateur) return;
    try {
        const copie = Object.assign({}, utilisateur, { photo: null });
        copie.parametres = Object.assign({}, utilisateur.parametres, { customRingtoneBase64: null });
        localStorage.setItem('evat_profil', JSON.stringify(copie));

        const ring = (utilisateur.parametres && utilisateur.parametres.customRingtoneBase64) || null;
        if (ring !== _ringSauvee) {
            if (ring) localStorage.setItem('evat_ringtone', ring); else localStorage.removeItem('evat_ringtone');
            _ringSauvee = ring;
        }
        const photo = utilisateur.photo || null;
        if (photo !== _photoSauvee) {
            if (photo) localStorage.setItem('evat_photo', photo); else localStorage.removeItem('evat_photo');
            _photoSauvee = photo;
        }
    } catch (e) {
        console.warn('Sauvegarde locale impossible :', e);
    }
}

function effacerProfilLocal() {
    clearTimeout(_saveTimer); _saveTimer = null;
    ['evat_profil', 'evat_ringtone', 'evat_photo'].forEach(k => localStorage.removeItem(k));
    _ringSauvee = _photoSauvee = null;
}

// Écriture immédiate quand l'app passe en arrière-plan / se ferme
window.addEventListener('pagehide', () => { if (_saveTimer) sauverProfilMaintenant(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && _saveTimer) sauverProfilMaintenant(); });

let utilisateur = chargerProfil();
let iaDejaPresentee = localStorage.getItem('elaws_presentee') === 'true';
let deferredPrompt = null;
let onlineUsers = new Map(); // tel → {nom, metier, lastSeen}

// ---------- Service Worker ----------
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    });
}

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
// Réveille le serveur (hébergement gratuit qui s'endort) dès l'ouverture, en parallèle du chargement
try { fetch(SERVER_URL + '/health', { mode: 'no-cors', cache: 'no-store' }).catch(() => {}); } catch (e) {}

const socket = io(SERVER_URL, {
    transports: ['websocket', 'polling'],   // WebSocket d'abord : connexion plus rapide, moins de requêtes
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 6000,
    randomizationFactor: 0.4,
    timeout: 30000
});

let onlineTotal = 0;
const _outbox = [];

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
                return;
            }
            // Les abonnements de présence sont perdus à chaque reconnexion : on les refait
            verifierEtSynchroniserContacts();
            chargerHistorique();
            signalerVisibilite();
            activerPush();
            majStatsAccueil();
            while (_outbox.length) { const m = _outbox.shift(); envoyerMessage(m.to, m.texte, m.cid); }
        });
        if (window._heartbeatInterval) clearInterval(window._heartbeatInterval);
        window._heartbeatInterval = setInterval(() => socket.emit('heartbeat'), 25000);
    }
});

socket.on('disconnect', () => {
    const statusEl = document.getElementById('serverConnectionStatus');
    if (statusEl) {
        statusEl.textContent = "🔴 Déconnecté — reconnexion…";
        statusEl.style.color = "var(--danger)";
    }
});

socket.on('connect_error', () => {
    const statusEl = document.getElementById('serverConnectionStatus');
    if (statusEl && !socket.connected) {
        statusEl.textContent = "⏳ Réveil du serveur…";
        statusEl.style.color = "var(--text-secondary)";
    }
});

// Revenir sur l'app (réseau mobile coupé en arrière-plan) → reconnecte tout de suite
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !socket.connected) socket.connect();
});
window.addEventListener('online', () => { if (!socket.connected) socket.connect(); });

// Compte ouvert sur un autre téléphone → cet appareil est déconnecté automatiquement
socket.on('force_logout', (data) => {
    const msg = (data && data.message)
        ? data.message
        : 'Votre compte a été ouvert sur un autre appareil. Vous êtes déconnecté.';

    try {
        if (typeof fermerAppelTotalLocally === 'function') fermerAppelTotalLocally();
    } catch (e) {}

    effacerProfilLocal();
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
            sauverProfil();
            afficherContacts();
            montrerNotification(`🚨 ${match.nom} (${data.telephone}) vient de s'inscrire ! Métier : ${data.metier}`);
        }
    }
});

// Présence temps réel : le serveur n'envoie plus que les changements des contacts suivis
socket.on('presence', (info) => {
    if (!info || !utilisateur || !utilisateur.contacts) return;
    const c = utilisateur.contacts.find(x => x.telephone === info.telephone);
    if (!c) return;
    c.online = !!info.online;
    if (info.metier) c.metier = info.metier;
    sauverProfil();
    afficherContacts();
    if (convoOuverte) majEntetePeer();
    const tm = document.getElementById('tab-messagerie');
    if (!convoOuverte && tm && tm.style.display !== 'none') afficherMessagesLocaux();
});

socket.on('online_count', (n) => {
    onlineTotal = n | 0;
    const el = document.getElementById('onlineCount');
    if (el) el.textContent = onlineTotal;
});

// Position partagée
socket.on('signal', (data) => {
    if (data.type === 'location') {
        if (mapInstance) {
            L.marker([data.lat, data.lng])
                .addTo(mapInstance)
                .bindPopup(`<b>📍 ${escapeHtml(data.sender)}</b>`)
                .openPopup();
        }
        if (mapInstanceMessage) {
            L.marker([data.lat, data.lng])
                .addTo(mapInstanceMessage)
                .bindPopup(`<b>📍 ${escapeHtml(data.sender)}</b>`)
                .openPopup();
        }
        montrerNotification(`📍 Position reçue de ${String(data.sender).slice(0, 40)}`);
    }
});

// ---------- Notifications ----------
function montrerNotification(texte, onClick) {
    const banner = document.getElementById('notificationBanner');
    const textEl = document.getElementById('notificationText');
    if (banner && textEl) {
        window._notifClick = typeof onClick === 'function' ? onClick : null;
        banner.style.cursor = window._notifClick ? 'pointer' : '';
        textEl.innerText = texte;
        banner.style.display = 'block';
        banner.classList.add('notif-in');
        clearTimeout(window._notifTimer);
        window._notifTimer = setTimeout(() => fermerNotification(), 9000);
    }
}

document.addEventListener('click', (e) => {
    const b = document.getElementById('notificationBanner');
    if (b && b.contains(e.target) && !e.target.closest('.btn-close') && window._notifClick) {
        const f = window._notifClick; window._notifClick = null; fermerNotification(); f();
    }
});

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
        sauverProfil();

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
        sauverProfil();

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
    sauverProfil();

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
    sauverProfil();
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
        sauverProfil();
        alert("🎵 Sonnerie personnelle enregistrée !");
    };
    reader.readAsDataURL(file);
}

function deconnecterUtilisateur() {
    if (confirm("Voulez-vous vraiment réinitialiser et refaire l'enregistrement ?")) {
        effacerProfilLocal();
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
            sauverProfil();
            afficherContacts();
        }
    });
}

// ---------- Contacts dynamiques ----------
function afficherContacts() {
    if (_ctRaf) return;
    _ctRaf = requestAnimationFrame(() => { _ctRaf = 0; rendreContacts(); });
}
let _ctRaf = 0;

function rendreContacts() {
    const container = document.getElementById('listeContactsContainer');
    if (!container || !utilisateur || !utilisateur.contacts) return;

    if (utilisateur.contacts.length === 0) {
        container.innerHTML = `<p style="color:var(--text-secondary); font-size:11.5px;">Aucun contact.</p>`;
        return;
    }

    container.innerHTML = utilisateur.contacts.map((c, index) => {
        const statusDot = c.online
            ? `<span class="online-dot" title="En ligne"></span>`
            : `<span class="offline-dot" title="Hors ligne"></span>`;
        return `
        <div class="contact-card">
            <div class="contact-info">
                <strong>👤 ${escapeHtml(c.nom)} ${statusDot}</strong>
                <div class="contact-meta">📞 ${escapeHtml(c.telephone)} • <i>${escapeHtml(c.metier || 'Sync...')}</i></div>
            </div>
            <div class="contact-actions">
                <button data-act="call" data-i="${index}" class="btn-mini success" title="Appel audio">📞</button>
                <button data-act="vcall" data-i="${index}" class="btn-mini success" title="Appel vidéo">📹</button>
                <button data-act="write" data-i="${index}" class="btn-mini accent" title="Écrire">💬</button>
                <button data-act="edit" data-i="${index}" class="btn-mini blue" title="Modifier">✏️</button>
                <button data-act="del" data-i="${index}" class="btn-mini danger" title="Supprimer">🗑️</button>
            </div>
        </div>`;
    }).join('');
}

// Un seul écouteur pour tous les boutons de contacts (plus de onclick avec des noms injectés dans le HTML)
document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('#listeContactsContainer [data-act]');
    if (!b || !utilisateur) return;
    const c = utilisateur.contacts[Number(b.dataset.i)];
    if (!c) return;
    const act = b.dataset.act;
    if (act === 'call') lancerAppelDirectPeer('audio', c.telephone);
    else if (act === 'vcall') lancerAppelDirectPeer('video', c.telephone);
    else if (act === 'write') ouvrirMessagerie(c.telephone);
    else if (act === 'edit') modifierContact(Number(b.dataset.i));
    else if (act === 'del') supprimerContact(Number(b.dataset.i));
});

function ajouterNouveauContact() {
    const nom = document.getElementById('nouveauNomContact').value.trim();
    const tel = normaliserTel(document.getElementById('nouveauTelContact').value);
    if (!nom || !tel) {
        alert("Nom et numéro obligatoires.");
        return;
    }
    if (!telEstValideClient(tel)) {
        alert("Numéro invalide. Format : +228XXXXXXXX (ou 8 chiffres pour le Togo).");
        return;
    }
    if (!utilisateur.contacts) utilisateur.contacts = [];
    if (utilisateur.contacts.some(c => c.telephone === tel)) {
        alert("Ce numéro est déjà dans vos contacts.");
        return;
    }
    utilisateur.contacts.push({ nom, telephone: tel, metier: "Recherche...", online: false });
    sauverProfil();
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
    const nouveauTelBrut = prompt("Modifier le numéro :", c.telephone);
    if (nouveauTelBrut === null) return;
    const nouveauTel = normaliserTel(nouveauTelBrut);
    if (!telEstValideClient(nouveauTel)) { alert("Numéro invalide."); return; }
    utilisateur.contacts[index].nom = nouveauNom.trim() || c.nom;
    utilisateur.contacts[index].telephone = nouveauTel;
    sauverProfil();
    afficherContacts();
    verifierEtSynchroniserContacts();
}

function supprimerContact(index) {
    if (confirm("Supprimer ce contact ?")) {
        utilisateur.contacts.splice(index, 1);
        sauverProfil();
        afficherContacts();
    }
}

function ecrireAuContact(nom, tel) { ouvrirMessagerie(tel); }

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
    chatBox.insertAdjacentHTML('beforeend', `
        <div class="msg-user">
            <strong>👤 ${escapeHtml(utilisateur.nom)}</strong>
            <span class="msg-time">${now}</span>
            <p>${escapeHtml(question)}</p>
        </div>`);
    input.value = '';
    input.style.height = '42px'; // reset hauteur pour revoir tout le prochain texte
    chatBox.scrollTop = chatBox.scrollHeight;

    // Typing indicator
    const typingId = 'typing-' + Date.now();
    chatBox.insertAdjacentHTML('beforeend', `<div id="${typingId}" class="msg-ai typing">🤖 ELAWS analyse...</div>`);
    chatBox.scrollTop = chatBox.scrollHeight;

    // Réponse dynamique (simulation de latence réaliste)
    setTimeout(() => {
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();

        const reponse = genererReponseElaws(question);
        chatBox.insertAdjacentHTML('beforeend', `
            <div class="msg-ai">
                <strong>🤖 ELAWS AI</strong>
                <span class="msg-time">${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                <p>${escapeHtml(reponse)}</p>
            </div>`);
        chatBox.scrollTop = chatBox.scrollHeight;

        // Historique local
        if (!utilisateur.historiqueElaws) utilisateur.historiqueElaws = [];
        utilisateur.historiqueElaws.push({ q: question, r: reponse, t: Date.now() });
        if (utilisateur.historiqueElaws.length > 30) utilisateur.historiqueElaws.shift();
        sauverProfil();
    }, 200 + Math.random() * 250);
}

function genererReponseElaws(question) {
    const q = question.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const nom = utilisateur.nom.split(' ')[0];
    const metier = utilisateur.metier || 'opérateur';
    const onlineCount = onlineTotal;

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

const _ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(text) {
    return String(text == null ? '' : text).replace(/[&<>"']/g, ch => _ESC[ch]);
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

function toggleGpsMessage(forceOpen) {
    const p = document.getElementById('panneauGpsMessage');
    if (!p) return;
    const show = typeof forceOpen === 'boolean' ? forceOpen : (p.style.display === 'none' || getComputedStyle(p).display === 'none');
    p.style.display = show ? 'block' : 'none';
    if (show) {
        fermerChoixAppel();
        chargerLeaflet().then(() => setTimeout(initCarteMessage, 100)).catch(() => { const st = document.getElementById('gpsMessageStatus'); if (st) st.textContent = 'Carte indisponible (hors ligne).'; });
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
// Leaflet (~150 Ko) n'est plus chargé au démarrage mais seulement à la première ouverture d'une carte
let _leafletPromise = null;
function chargerLeaflet() {
    if (typeof L !== 'undefined') return Promise.resolve();
    if (_leafletPromise) return _leafletPromise;
    _leafletPromise = new Promise((resolve, reject) => {
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(css);
        const js = document.createElement('script');
        js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        js.onload = () => resolve();
        js.onerror = () => { _leafletPromise = null; reject(new Error('leaflet')); };
        document.head.appendChild(js);
    });
    return _leafletPromise;
}

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
    if (tabId === 'messagerie') rendreMessagesLocaux(true);
    if (tabId === 'dashboard') majStatsAccueil();
    majNavChat();
    majNavActive(tabId);
    window.scrollTo(0, 0);
    if (tabId === 'map') {
        chargerLeaflet().then(() => setTimeout(() => {
            if (!mapInstance) {
                mapInstance = L.map('mapContainer').setView([6.1375, 1.2123], 13);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(mapInstance);
            } else {
                mapInstance.invalidateSize();
            }
        }, 150)).catch(() => montrerNotification('🗺️ Carte indisponible (hors ligne).'));
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

// ---------- Notes ----------
function ajouterNoteBlocNotes() {
    const titre = document.getElementById('noteTitre').value.trim();
    const contenu = document.getElementById('noteContenu').value.trim();
    if (!titre || !contenu || !utilisateur) return;
    if (!utilisateur.notes) utilisateur.notes = [];
    utilisateur.notes.unshift({ titre, contenu, date: new Date().toLocaleString('fr-FR') });
    sauverProfil();
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
    sauverProfil();
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

// ---------- VoIP P2P v4 (appels audio / vidéo WebRTC) ----------
/*  Corrections majeures par rapport à la v3.95 :
    - candidats ICE mis en file d'attente tant que l'offre n'est pas appliquée (perte de candidats = appel muet)
    - serveur TURN fourni par le serveur (indispensable sur les réseaux mobiles / CGNAT)
    - états d'appel propres (occupé, ça sonne, manqué, hors ligne, annulé)
    - reconnexion automatique (ICE restart) en cas de coupure réseau
    - raccrocher utilise l'appel réel (plus le champ texte)
    - sonnerie fiable (AudioContext unique débloqué au 1er geste) + vibration + notification système
    - micro coupé / caméra coupée, aperçu local, durée d'appel, wake-lock seulement pendant l'appel */

const STUN_SECOURS = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];

const Call = {
    state: 'idle',          // idle | calling | ringing | connecting | connected
    id: null, peer: null, type: 'audio', isCaller: false,
    pc: null, local: null, remote: null,
    pendingOffer: null, pendingCandidates: [],
    timers: { ring: null, drop: null, tick: null },
    startedAt: 0, restarts: 0, muted: false, camOff: false,
    ice: null, iceAt: 0
};

let audioCtx = null;
let ringInterval = null;
let customAudioRing = null;
let wakeLock = null;

/* ---------- Utilitaires ---------- */
function normaliserTel(v) {
    let t = String(v || '').replace(/[\s\-.()]/g, '');
    if (t.startsWith('00')) t = '+' + t.slice(2);
    if (/^\d{8}$/.test(t)) t = '+228' + t;          // numéro togolais local (8 chiffres)
    return t;
}

function nomPourTel(tel) {
    const c = utilisateur && utilisateur.contacts && utilisateur.contacts.find(x => x.telephone === tel);
    return c ? c.nom : tel;
}

function setStatutAppel(txt) {
    const el = document.getElementById('callStatusLog');
    if (el) el.textContent = txt;
}

function nouvelIdAppel() {
    return (window.crypto && crypto.randomUUID) ? crypto.randomUUID().slice(0, 18)
        : Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function signaler(type, extra) {
    if (!Call.peer) return;
    socket.emit('p2p_signal', Object.assign({
        target: Call.peer, callId: Call.id, callType: Call.type, type
    }, extra || {}));
}

/* ---------- Audio : sonnerie fiable ---------- */
function obtenirAudioCtx() {
    if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
}
// Le 1er geste de l'utilisateur débloque l'audio : sans ça, la sonnerie reste muette sur mobile
['pointerdown', 'touchstart', 'keydown'].forEach(ev =>
    document.addEventListener(ev, () => obtenirAudioCtx(), { passive: true }));

function jouerNote(freq, wave, dur, vol) {
    const ctx = obtenirAudioCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
}

/** mode 'entrant' = sonnerie choisie par l'utilisateur ; 'sortant' = tonalité de retour d'appel */
function jouerSonSonnerie(mode) {
    arreterSonSonnerie(true);
    try {
        if (mode === 'sortant') {
            const bip = () => { jouerNote(425, 'sine', 1.0, 0.09); };
            bip();
            ringInterval = setInterval(bip, 3000);
            return;
        }
        const p = (utilisateur && utilisateur.parametres) || {};
        const type = p.sonnerieType || 'iphone';

        if (type === 'custom' && p.customRingtoneBase64) {
            customAudioRing = new Audio(p.customRingtoneBase64);
            customAudioRing.loop = true;
            customAudioRing.play().catch(() => {});
        } else {
            let notes = [523.25, 659.25, 783.99, 1046.50], pattern = 1800, wave = 'sine';
            if (type === 'motorola') { notes = [600, 750, 900, 600]; pattern = 1400; wave = 'square'; }
            else if (type === 'samsung') { notes = [440, 554.37, 659.25, 880, 1108.73]; pattern = 2200; wave = 'triangle'; }
            else if (type === 'classique') { notes = [800, 1000]; pattern = 1000; wave = 'sine'; }
            let i = 0;
            const tick = () => jouerNote(notes[i++ % notes.length], wave, 0.45, 0.14);
            tick();
            ringInterval = setInterval(tick, pattern / notes.length);
        }
        if (!p || p.vibration !== false) {
            const vib = () => { if (navigator.vibrate) navigator.vibrate([700, 300, 700, 300]); };
            vib();
            Call.timers.vib = setInterval(vib, 2000);
        }
    } catch (e) { /* audio indisponible : on continue sans son */ }
}

function arreterSonSonnerie(garderTimers) {
    if (ringInterval) { clearInterval(ringInterval); ringInterval = null; }
    if (Call.timers.vib) { clearInterval(Call.timers.vib); Call.timers.vib = null; }
    if (navigator.vibrate) navigator.vibrate(0);
    if (customAudioRing) { customAudioRing.pause(); customAudioRing.currentTime = 0; customAudioRing = null; }
    if (!garderTimers && Call.timers.ring) { clearTimeout(Call.timers.ring); Call.timers.ring = null; }
}

/* ---------- Notifications système (écran verrouillé / onglet en arrière-plan) ---------- */
function demanderPermissionNotifications() {
    try {
        if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    } catch (e) {}
}

async function notifierAppelEntrant(nom, type) {
    try {
        if (!document.hidden || !('Notification' in window) || Notification.permission !== 'granted') return;
        const reg = await navigator.serviceWorker.ready;
        reg.showNotification(type === 'video' ? '📹 Appel vidéo EVAT' : '📞 Appel EVAT', {
            body: nom + ' vous appelle',
            tag: 'evat-call', renotify: true, requireInteraction: true,
            vibrate: [500, 200, 500, 200, 500], icon: 'icon-192.png', badge: 'icon-192.png'
        });
    } catch (e) {}
}

async function fermerNotificationAppel() {
    try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) return;
        (await reg.getNotifications({ tag: 'evat-call' })).forEach(n => n.close());
    } catch (e) {}
}

/* ---------- Wake lock (seulement pendant un appel) ---------- */
async function verrouillerEcran() {
    try { if ('wakeLock' in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
}
function libererEcran() {
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
}
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Call.state === 'connected') { wakeLock = null; verrouillerEcran(); }
});

/* ---------- ICE (STUN + TURN fournis par le serveur) ---------- */
function chargerIce() {
    if (Call.ice && Date.now() - Call.iceAt < 30 * 60 * 1000) return Promise.resolve(Call.ice);
    return new Promise(resolve => {
        const fin = servers => { Call.ice = servers; Call.iceAt = Date.now(); resolve(servers); };
        const garde = setTimeout(() => fin(STUN_SECOURS), 2500);
        try {
            socket.emit('get_ice', null, res => {
                clearTimeout(garde);
                fin(res && Array.isArray(res.iceServers) && res.iceServers.length ? res.iceServers : STUN_SECOURS);
            });
        } catch (e) { clearTimeout(garde); fin(STUN_SECOURS); }
    });
}
// Précharge les serveurs ICE pour que l'appel démarre sans attente
socket.on('connect', () => { Call.iceAt = 0; setTimeout(() => chargerIce(), 800); });

/* ---------- Médias ---------- */
async function obtenirMedia(type) {
    const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    const video = type === 'video'
        ? { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 }, facingMode: 'user' }
        : false;
    try {
        return await navigator.mediaDevices.getUserMedia({ audio, video });
    } catch (e) {
        if (type === 'video' && e && e.name !== 'NotAllowedError') {
            // pas de caméra : on bascule en audio
            Call.type = 'audio';
            return await navigator.mediaDevices.getUserMedia({ audio, video: false });
        }
        throw e;
    }
}

function messageErreurMedia(e) {
    if (e && e.name === 'NotAllowedError') return '❌ Micro/caméra refusés. Autorisez-les dans les réglages du navigateur.';
    if (e && e.name === 'NotFoundError') return '❌ Aucun micro détecté.';
    return '❌ Impossible d’activer le micro/caméra.';
}

function attacherLocal() {
    const lv = document.getElementById('localVideo');
    if (lv) { lv.srcObject = Call.type === 'video' ? Call.local : null; lv.style.display = Call.type === 'video' ? 'block' : 'none'; }
    const bc = document.getElementById('btnCam');
    if (bc) bc.style.display = Call.type === 'video' ? 'inline-block' : 'none';
}

function attacherDistant() {
    const ra = document.getElementById('remoteAudio');
    const rv = document.getElementById('remoteVideo');
    if (ra) ra.srcObject = Call.remote;
    if (rv) { rv.srcObject = Call.type === 'video' ? Call.remote : null; rv.style.display = Call.type === 'video' ? 'block' : 'none'; }
    if (ra && ra.play) ra.play().catch(() => {});
}

/* ---------- PeerConnection ---------- */
async function creerPeerConnection() {
    const iceServers = await chargerIce();
    const pc = new RTCPeerConnection({ iceServers, bundlePolicy: 'max-bundle', iceCandidatePoolSize: 2 });

    pc.onicecandidate = e => { if (e.candidate) signaler('ice_candidate', { candidate: e.candidate }); };

    pc.ontrack = e => {
        if (!Call.remote) Call.remote = new MediaStream();
        if (!Call.remote.getTracks().includes(e.track)) Call.remote.addTrack(e.track);
        attacherDistant();
    };

    const surChangement = () => {
        const s = pc.connectionState || pc.iceConnectionState;
        if (pc !== Call.pc) return;
        if (s === 'connected' || s === 'completed') {
            clearTimeout(Call.timers.drop);
            if (Call.state !== 'connected') passerConnecte();
            else setStatutAppel('✅ Reconnecté');
        } else if (s === 'disconnected') {
            setStatutAppel('⚠️ Connexion instable…');
            clearTimeout(Call.timers.drop);
            Call.timers.drop = setTimeout(() => redemarrerIce(), 3500);
        } else if (s === 'failed') {
            redemarrerIce(true);
        }
    };
    pc.onconnectionstatechange = surChangement;
    pc.oniceconnectionstatechange = surChangement;
    return pc;
}

function passerConnecte() {
    Call.state = 'connected';
    Call.startedAt = Date.now();
    Call.restarts = 0;
    arreterSonSonnerie();
    clearTimeout(Call.timers.ring);
    verrouillerEcran();
    // Vidéo plafonnée pour les réseaux mobiles (évite les saccades et la consommation excessive)
    try {
        Call.pc.getSenders().forEach(s => {
            if (s.track && s.track.kind === 'video') {
                const p = s.getParameters();
                if (!p.encodings || !p.encodings.length) p.encodings = [{}];
                p.encodings[0].maxBitrate = 700000;
                s.setParameters(p).catch(() => {});
            }
        });
    } catch (e) {}
    clearInterval(Call.timers.tick);
    const maj = () => {
        const sec = Math.floor((Date.now() - Call.startedAt) / 1000);
        const mm = String(Math.floor(sec / 60)).padStart(2, '0');
        const ss = String(sec % 60).padStart(2, '0');
        setStatutAppel('✅ En ligne • ' + mm + ':' + ss);
    };
    maj();
    Call.timers.tick = setInterval(maj, 1000);
}

async function redemarrerIce(force) {
    if (!Call.pc || Call.state === 'idle') return;
    if (Call.restarts >= 3) { terminerAppel('❌ Connexion perdue.', true); return; }
    // Seul l'appelant relance la négociation (évite les collisions)
    if (!Call.isCaller) {
        if (force) setStatutAppel('⚠️ Connexion perdue, attente de l’appelant…');
        return;
    }
    Call.restarts++;
    try {
        setStatutAppel('🔄 Reconnexion…');
        if (Call.pc.restartIce) Call.pc.restartIce();
        const offer = await Call.pc.createOffer({ iceRestart: true });
        await Call.pc.setLocalDescription(offer);
        signaler('offer', { offer: Call.pc.localDescription, renegotiate: true });
        clearTimeout(Call.timers.drop);
        Call.timers.drop = setTimeout(() => redemarrerIce(true), 8000);
    } catch (e) {
        terminerAppel('❌ Connexion perdue.', true);
    }
}

async function appliquerCandidatsEnAttente() {
    const liste = Call.pendingCandidates.splice(0);
    for (const c of liste) {
        try { await Call.pc.addIceCandidate(c); } catch (e) { /* candidat périmé */ }
    }
}

/* ---------- Appel sortant ---------- */
async function lancerAppelDirectPeer(type, telOverride) {
    const input = document.getElementById('appelCibleNum');
    const cible = normaliserTel(telOverride || (input ? input.value : ''));
    if (input && !telOverride) input.value = cible;

    if (!utilisateur) { alert('Créez ou récupérez votre compte avant d’appeler.'); return; }
    if (!telEstValideClient(cible)) { alert('Numéro invalide. Format : +228XXXXXXXX'); return; }
    if (cible === utilisateur.telephone) { alert('Impossible de s’appeler soi-même !'); return; }
    if (Call.state !== 'idle') { alert('Un appel est déjà en cours.'); return; }
    if (!socket.connected) { setStatutAppel('❌ Serveur hors ligne. Réessayez dans un instant.'); return; }
    if (!navigator.mediaDevices || !window.RTCPeerConnection) { alert('Votre navigateur ne supporte pas les appels.'); return; }

    demanderPermissionNotifications();
    Object.assign(Call, {
        state: 'calling', id: nouvelIdAppel(), peer: cible, type, isCaller: true,
        pendingOffer: null, pendingCandidates: [], remote: null, restarts: 0, muted: false, camOff: false
    });
    const idLocal = Call.id;
    afficherEcranAppel(cible);
    setStatutAppel('🔄 Activation micro/caméra…');

    try {
        Call.local = await obtenirMedia(type);
        if (Call.id !== idLocal) { Call.local.getTracks().forEach(t => t.stop()); return; } // annulé entre-temps

        const pc = await creerPeerConnection();
        Call.pc = pc;
        Call.local.getTracks().forEach(t => pc.addTrack(t, Call.local));
        attacherLocal();

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        signaler('offer', { offer: pc.localDescription });

        setStatutAppel('📞 Appel de ' + nomPourTel(cible) + '…');
        jouerSonSonnerie('sortant');
        Call.timers.ring = setTimeout(() => {
            if (Call.state === 'calling') terminerAppel('❌ Pas de réponse.', true);
        }, 35000);
    } catch (e) {
        if (Call.id === idLocal) terminerAppel(messageErreurMedia(e), true);
    }
}

/* ---------- Appel entrant ---------- */
function afficherModalAppelEntrant(tel, type) {
    let modal = document.getElementById('incomingCallModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'incomingCallModal';
        modal.className = 'incoming-call';
        modal.setAttribute('role', 'alertdialog');
        modal.innerHTML =
            '<div class="incoming-card">' +
            '<div class="incoming-icon">📞</div>' +
            '<h2 id="incomingCallTitle"></h2>' +
            '<p id="incomingCallerName"></p>' +
            '<div class="incoming-actions">' +
            '<button type="button" class="btn-reject" onclick="rejeterAppelEntrant()">Rejeter ❌</button>' +
            '<button type="button" class="btn-accept" onclick="accepterAppelEntrant()">Décrocher 🟢</button>' +
            '</div></div>';
        document.body.appendChild(modal);
    }
    document.getElementById('incomingCallTitle').textContent = type === 'video' ? '📹 Appel vidéo entrant' : '📞 Appel audio entrant';
    document.getElementById('incomingCallerName').textContent = nomPourTel(tel) + (nomPourTel(tel) !== tel ? ' (' + tel + ')' : '');
    modal.style.display = 'flex';
}

function cacherModalAppelEntrant() {
    const modal = document.getElementById('incomingCallModal');
    if (modal) modal.style.display = 'none';
}

async function accepterAppelEntrant() {
    if (Call.state !== 'ringing' || !Call.pendingOffer) return;
    const idLocal = Call.id;
    arreterSonSonnerie();
    cacherModalAppelEntrant();
    fermerNotificationAppel();
    Call.state = 'connecting';

    afficherEcranAppel(Call.peer);
    setStatutAppel('📞 Décrochage…');

    try {
        Call.local = await obtenirMedia(Call.type);
        if (Call.id !== idLocal) { Call.local.getTracks().forEach(t => t.stop()); return; }

        const pc = await creerPeerConnection();
        Call.pc = pc;
        await pc.setRemoteDescription(Call.pendingOffer);
        Call.pendingOffer = null;
        Call.local.getTracks().forEach(t => pc.addTrack(t, Call.local));
        attacherLocal();
        await appliquerCandidatsEnAttente();

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        signaler('answer', { answer: pc.localDescription });
        setStatutAppel('🔄 Connexion avec ' + nomPourTel(Call.peer) + '…');

        Call.timers.drop = setTimeout(() => {
            if (Call.state === 'connecting') terminerAppel('❌ Connexion impossible (réseau).', true);
        }, 20000);
    } catch (e) {
        if (Call.id === idLocal) terminerAppel(messageErreurMedia(e), true);
    }
}

function rejeterAppelEntrant() {
    if (Call.state !== 'ringing') { cacherModalAppelEntrant(); return; }
    signaler('reject');
    terminerAppel(null, false);
}

function raccrocherAppel() {
    if (Call.state === 'idle') { fermerAppelTotalLocally(); return; }
    terminerAppel('📴 Appel terminé.', true);
}

/** Termine proprement l'appel. notifier=true → prévient l'autre personne */
function terminerAppel(message, notifier) {
    if (notifier && Call.peer && Call.state !== 'idle') signaler('hangup');

    arreterSonSonnerie();
    clearTimeout(Call.timers.ring);
    clearTimeout(Call.timers.drop);
    clearInterval(Call.timers.tick);
    cacherModalAppelEntrant();
    fermerNotificationAppel();
    libererEcran();

    if (Call.pc) {
        Call.pc.onicecandidate = Call.pc.ontrack = Call.pc.onconnectionstatechange = Call.pc.oniceconnectionstatechange = null;
        try { Call.pc.close(); } catch (e) {}
    }
    if (Call.local) Call.local.getTracks().forEach(t => t.stop());

    ['remoteAudio', 'remoteVideo', 'localVideo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.srcObject = null;
    });
    const container = document.getElementById('callContainer');
    if (container) container.style.display = 'none';

    Object.assign(Call, {
        state: 'idle', id: null, peer: null, pc: null, local: null, remote: null,
        pendingOffer: null, pendingCandidates: [], isCaller: false, restarts: 0, startedAt: 0
    });
    if (message) montrerNotification(message);
}

// Compatibilité (utilisé par la déconnexion forcée)
function fermerAppelTotalLocally() { terminerAppel(null, false); }

/* ---------- Boutons micro / caméra ---------- */
function afficherEcranAppel(tel) {
    const nom = nomPourTel(tel);
    const n = document.getElementById('callPeerName');
    const a = document.getElementById('callPeerAvatar');
    if (n) n.textContent = nom;
    if (a) a.textContent = initialesDe(nom);
    document.getElementById('callContainer').style.display = 'flex';
    majBoutonsAppel();
}

function majBoutonsAppel() {
    const m = document.getElementById('btnMute');
    const c = document.getElementById('btnCam');
    if (m) m.textContent = Call.muted ? '🔇 Micro coupé' : '🎙️ Micro';
    if (c) { c.textContent = Call.camOff ? '🚫 Caméra off' : '📷 Caméra'; c.style.display = Call.type === 'video' ? 'inline-block' : 'none'; }
}
function basculerMicro() {
    if (!Call.local) return;
    Call.muted = !Call.muted;
    Call.local.getAudioTracks().forEach(t => { t.enabled = !Call.muted; });
    majBoutonsAppel();
}
function basculerCamera() {
    if (!Call.local) return;
    Call.camOff = !Call.camOff;
    Call.local.getVideoTracks().forEach(t => { t.enabled = !Call.camOff; });
    majBoutonsAppel();
}

/* ---------- Signalisation entrante ---------- */
socket.on('p2p_signal', async (data) => {
    if (!data || !data.type) return;
    try {
        // Nouvelle sonnerie
        if (data.type === 'offer' && !data.renegotiate) {
            if (!utilisateur) return;
            if (Call.id && data.callId === Call.id) return;        // doublon (rejeu après réouverture)
            if (Call.state !== 'idle') {
                // occupé : on prévient l'appelant sans perturber l'appel en cours
                socket.emit('p2p_signal', { type: 'busy', target: data.sender, callId: data.callId });
                return;
            }
            Object.assign(Call, {
                state: 'ringing', id: data.callId, peer: data.sender, type: data.callType || 'audio',
                isCaller: false, pendingOffer: data.offer, pendingCandidates: [], remote: null,
                restarts: 0, muted: false, camOff: false
            });
            signaler('ringing');
            afficherModalAppelEntrant(data.sender, Call.type);
            jouerSonSonnerie('entrant');
            notifierAppelEntrant(nomPourTel(data.sender), Call.type);
            if (Date.now() - autoDecrocher < 60000) { autoDecrocher = 0; setTimeout(() => accepterAppelEntrant(), 300); }
            Call.timers.ring = setTimeout(() => {
                if (Call.state === 'ringing') {
                    signaler('hangup');
                    montrerNotification('📵 Appel manqué de ' + nomPourTel(Call.peer));
                    terminerAppel(null, false);
                }
            }, 35000);
            return;
        }

        // Tout le reste doit concerner l'appel en cours
        if (Call.state === 'idle') return;
        if (data.callId && Call.id && data.callId !== Call.id) return;

        switch (data.type) {
            case 'ringing':
                if (Call.state === 'calling') setStatutAppel('📞 Ça sonne chez ' + nomPourTel(Call.peer) + '…');
                break;

            case 'answer':
                if (Call.pc && Call.pc.signalingState === 'have-local-offer') {
                    await Call.pc.setRemoteDescription(data.answer);
                    await appliquerCandidatsEnAttente();
                    if (Call.state === 'calling') {
                        Call.state = 'connecting';
                        arreterSonSonnerie();
                        clearTimeout(Call.timers.ring);
                        setStatutAppel('🔄 Connexion…');
                        Call.timers.drop = setTimeout(() => {
                            if (Call.state === 'connecting') redemarrerIce(true);
                        }, 12000);
                    }
                }
                break;

            case 'offer': // renégociation (ICE restart) — silencieuse
                if (Call.pc && (Call.state === 'connected' || Call.state === 'connecting')) {
                    await Call.pc.setRemoteDescription(data.offer);
                    const answer = await Call.pc.createAnswer();
                    await Call.pc.setLocalDescription(answer);
                    signaler('answer', { answer: Call.pc.localDescription });
                }
                break;

            case 'ice_candidate':
                if (!data.candidate) break;
                if (Call.pc && Call.pc.remoteDescription) {
                    try { await Call.pc.addIceCandidate(data.candidate); } catch (e) {}
                } else {
                    Call.pendingCandidates.push(data.candidate);  // l'offre n'est pas encore appliquée
                }
                break;

            case 'busy':
                terminerAppel('📵 ' + nomPourTel(Call.peer) + ' est déjà en ligne.', false);
                break;
            case 'user_offline':
                terminerAppel('📵 ' + nomPourTel(Call.peer) + ' est hors ligne. Il verra l’appel manqué à sa reconnexion.', false);
                break;
            case 'reject':
                terminerAppel('❌ Appel refusé.', false);
                break;
            case 'hangup':
                if (Call.state === 'ringing') montrerNotification('📵 Appel manqué de ' + nomPourTel(Call.peer));
                terminerAppel('📴 Appel terminé par ' + nomPourTel(Call.peer) + '.', false);
                break;
        }
    } catch (e) {
        console.warn('Signal appel :', e);
    }
});

socket.on('missed_calls', (liste) => {
    if (!Array.isArray(liste) || !liste.length) return;
    const noms = [...new Set(liste.map(c => c.fromName || c.from))].slice(0, 3).join(', ');
    montrerNotification('📵 ' + liste.length + ' appel(s) manqué(s) : ' + noms);
});

// Fermeture de l'onglet / de l'app pendant un appel : prévenir l'autre côté
window.addEventListener('pagehide', () => {
    if (Call.state !== 'idle' && Call.peer) {
        try { signaler(Call.state === 'ringing' ? 'reject' : 'hangup'); } catch (e) {}
    }
});

// ---------- Conversations (v4.1) : vrais échanges, un fil par contact ----------
/*  - un fil de discussion par contact + le fil « Réseau » (général)
    - envoi instantané (message affiché tout de suite, ✓ envoyé / ✓✓ reçu / ✓✓ bleu lu)
    - « écrit… », pastilles de messages non lus, séparateurs de dates
    - hors ligne : le message part dès que la connexion revient                         */

let convoOuverte = null;                 // 'general' ou numéro du contact ; null = liste
let _typingStop = null, _typingEnvoye = 0, _typingAffTimer = null;
const MAX_MESSAGES_LOCAUX = 400;

function nouvelIdMsg() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function cleConvo(m) {
    if (!m.to) return 'general';
    if (m.fromMe) return m.to;
    if (m.from) return m.from;
    const c = (utilisateur.contacts || []).find(x => x.nom === m.expediteur);   // anciens messages sans numéro
    return c ? c.telephone : 'general';
}

function nomConvo(k) { return k === 'general' ? 'Réseau EVAT' : nomPourTel(k); }

function initialesDe(nom) {
    const p = String(nom || '?').trim().split(/\s+/).slice(0, 2);
    return p.map(w => (w[0] || '').toUpperCase()).join('') || '?';
}

function heureCourte(ts) {
    try { return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
}

function libelleJour(ts) {
    const d = new Date(ts), now = new Date();
    const j0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dj = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diff = Math.round((j0 - dj) / 86400000);
    if (diff === 0) return 'Aujourd’hui';
    if (diff === 1) return 'Hier';
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function coches(m) {
    if (!m.fromMe || !m.to) return '';
    if (m.etat === 'failed') return '<span class="tick fail" title="Non envoyé">!</span>';
    if (m.etat === 'pending') return '<span class="tick">🕓</span>';
    if (m.etat === 'read') return '<span class="tick read">✓✓</span>';
    if (m.etat === 'delivered') return '<span class="tick">✓✓</span>';
    return '<span class="tick">✓</span>';
}

function nbNonLusTotal() {
    const n = (utilisateur && utilisateur.nonLus) || {};
    return Object.keys(n).reduce((s, k) => s + (n[k] || 0), 0);
}

function majBadges() {
    const total = nbNonLusTotal();
    const b = document.getElementById('badgeMsg');
    if (b) { b.textContent = total > 99 ? '99+' : String(total); b.hidden = total === 0; }
    const s = document.getElementById('statNonLus');
    if (s) s.textContent = total;
    const sc = document.getElementById('statContacts');
    if (sc && utilisateur) sc.textContent = (utilisateur.contacts || []).length;
    try { if (navigator.setAppBadge) { total ? navigator.setAppBadge(total) : navigator.clearAppBadge(); } } catch (e) {}
}

function messagesDe(cle) {
    return (utilisateur.messagesLocaux || []).filter(m => cleConvo(m) === cle);
}

/* ---------- Réception ---------- */
socket.on('new_message', (msg) => {
    if (!utilisateur) return;
    if (!utilisateur.messagesLocaux) utilisateur.messagesLocaux = [];
    const fromMe = msg.from === utilisateur.telephone;

    // Écho de mon propre message : on remplace la version « en attente »
    if (fromMe && msg.cid) {
        const loc = utilisateur.messagesLocaux.find(m => m.id === msg.cid || m.cid === msg.cid);
        if (loc) {
            Object.assign(loc, { id: msg.id, ts: msg.timestamp, heure: msg.heure, etat: msg.read ? 'read' : (msg.delivered ? 'delivered' : 'sent') });
            sauverProfil();
            afficherMessagesLocaux();
            return;
        }
    }
    if (utilisateur.messagesLocaux.some(m => m.id === msg.id)) return;

    const m = {
        id: msg.id, cid: msg.cid || null,
        expediteur: msg.fromName || msg.from, from: msg.from, texte: msg.texte, heure: msg.heure,
        fromMe, to: msg.to || null, ts: msg.timestamp,
        etat: fromMe ? (msg.read ? 'read' : (msg.delivered ? 'delivered' : 'sent')) : null
    };
    utilisateur.messagesLocaux.push(m);
    if (utilisateur.messagesLocaux.length > MAX_MESSAGES_LOCAUX) {
        utilisateur.messagesLocaux = utilisateur.messagesLocaux.slice(-MAX_MESSAGES_LOCAUX);
    }

    if (!fromMe) {
        const cle = cleConvo(m);
        const tabVisible = document.getElementById('tab-messagerie') && document.getElementById('tab-messagerie').style.display !== 'none';
        const lue = tabVisible && convoOuverte === cle && !document.hidden;
        if (lue) {
            if (cle !== 'general') socket.emit('mark_read', { peer: cle });
        } else {
            utilisateur.nonLus = utilisateur.nonLus || {};
            utilisateur.nonLus[cle] = (utilisateur.nonLus[cle] || 0) + 1;
            const apercu = `💬 ${m.expediteur} : ${msg.texte.slice(0, 40)}${msg.texte.length > 40 ? '…' : ''}`;
            montrerNotification(apercu, () => ouvrirMessagerie(cle));
        }
    }
    sauverProfil();
    majBadges();
    afficherMessagesLocaux();
});

// Accusés (reçu / lu)
socket.on('msg_status', (d) => {
    if (!utilisateur || !d || !Array.isArray(d.ids)) return;
    let change = false;
    const ids = new Set(d.ids);
    (utilisateur.messagesLocaux || []).forEach(m => {
        if (!ids.has(m.id) || !m.fromMe) return;
        if (d.status === 'read' && m.etat !== 'read') { m.etat = 'read'; change = true; }
        else if (d.status === 'delivered' && m.etat !== 'read' && m.etat !== 'delivered') { m.etat = 'delivered'; change = true; }
    });
    if (change) { sauverProfil(); afficherMessagesLocaux(); }
});

// « écrit… »
socket.on('typing', (d) => {
    if (!d || d.from !== convoOuverte) return;
    const el = document.getElementById('chatPeerStatus');
    if (!el) return;
    clearTimeout(_typingAffTimer);
    if (d.on) {
        el.textContent = 'écrit…';
        el.classList.add('typing');
        _typingAffTimer = setTimeout(majEntetePeer, 4500);
    } else {
        majEntetePeer();
    }
});

/* ---------- Envoi ---------- */
function envoyerMessage(to, texte, cidExistant) {
    const cid = cidExistant || nouvelIdMsg();
    const maintenant = Date.now();
    if (!cidExistant) {
        // affichage immédiat (comme WhatsApp) ; remplacé par la version du serveur dès l'écho
        (utilisateur.messagesLocaux = utilisateur.messagesLocaux || []).push({
            id: cid, cid, expediteur: utilisateur.nom, from: utilisateur.telephone, texte,
            heure: heureCourte(maintenant), fromMe: true, to: to || null, ts: maintenant,
            etat: to ? 'pending' : null
        });
        sauverProfil();
        afficherMessagesLocaux();
    }
    if (!socket.connected) {
        if (!_outbox.some(x => x.cid === cid)) _outbox.push({ to, texte, cid });
        return;
    }
    socket.emit('send_message', { to: to || null, texte, cid }, (res) => {
        if (res && res.ok === false) {
            const m = (utilisateur.messagesLocaux || []).find(x => x.cid === cid || x.id === cid);
            if (m) m.etat = 'failed';
            montrerNotification(res.error || 'Message non envoyé');
            afficherMessagesLocaux();
        }
    });
}

function envoyerMessageChatLocal() {
    const input = document.getElementById('chatLocalInput');
    const texte = input.value.trim();
    if (!texte || !utilisateur || !convoOuverte) return;
    envoyerMessage(convoOuverte === 'general' ? null : convoOuverte, texte);
    input.value = '';
    input.style.height = '42px';
    arreterEcriture();
    input.focus();
}

function signalerEcriture() {
    if (!convoOuverte || convoOuverte === 'general' || !socket.connected) return;
    const now = Date.now();
    if (now - _typingEnvoye > 2500) { _typingEnvoye = now; socket.emit('typing', { to: convoOuverte, on: true }); }
    clearTimeout(_typingStop);
    _typingStop = setTimeout(arreterEcriture, 3500);
}
function arreterEcriture() {
    clearTimeout(_typingStop);
    if (_typingEnvoye && convoOuverte && convoOuverte !== 'general' && socket.connected) socket.emit('typing', { to: convoOuverte, on: false });
    _typingEnvoye = 0;
}

/* ---------- Navigation conversations ---------- */
function ouvrirMessagerie(cle) {
    switchTab('messagerie');
    if (cle) ouvrirConversation(cle);
}

function ouvrirConversation(cle) {
    if (!utilisateur) return;
    convoOuverte = cle;
    utilisateur.nonLus = utilisateur.nonLus || {};
    utilisateur.nonLus[cle] = 0;
    sauverProfil();
    majBadges();
    document.getElementById('convListView').style.display = 'none';
    document.getElementById('chatView').style.display = 'flex';
    document.getElementById('chatPeerName').textContent = nomConvo(cle);
    document.getElementById('chatPeerAvatar').textContent = cle === 'general' ? '🌐' : initialesDe(nomConvo(cle));
    const prive = cle !== 'general';
    ['btnChatAudio', 'btnChatVideo'].forEach(id => { const b = document.getElementById(id); if (b) b.style.display = prive ? '' : 'none'; });
    majEntetePeer();
    majNavChat();
    rendreMessagesLocaux(true);
    if (prive) socket.emit('mark_read', { peer: cle });
    setTimeout(() => { const i = document.getElementById('chatLocalInput'); if (i && window.innerWidth > 700) i.focus(); }, 120);
}

function fermerConversation() {
    arreterEcriture();
    convoOuverte = null;
    fermerGpsMessage();
    document.getElementById('chatView').style.display = 'none';
    document.getElementById('convListView').style.display = 'block';
    majNavChat();
    rendreMessagesLocaux();
}

function majEntetePeer() {
    const el = document.getElementById('chatPeerStatus');
    if (!el || !convoOuverte) return;
    el.classList.remove('typing');
    if (convoOuverte === 'general') { el.textContent = 'Diffusion à tous les opérateurs'; return; }
    const c = (utilisateur.contacts || []).find(x => x.telephone === convoOuverte);
    if (c && c.online) { el.textContent = '● en ligne'; el.classList.add('online'); }
    else { el.textContent = c ? 'hors ligne' : convoOuverte; el.classList.remove('online'); }
}

function majNavChat() {
    const tab = document.getElementById('tab-messagerie');
    const actif = tab && tab.style.display !== 'none' && convoOuverte;
    document.body.classList.toggle('in-chat', !!actif);
}

function appelerConversation(type) {
    if (!convoOuverte || convoOuverte === 'general') return;
    lancerAppelDirectPeer(type, convoOuverte);
}

/* ---------- Rendu ---------- */
let _msgRaf = 0;
function afficherMessagesLocaux() {
    if (_msgRaf) return;
    _msgRaf = requestAnimationFrame(() => { _msgRaf = 0; rendreMessagesLocaux(); });
}

function rendreMessagesLocaux(forcerBas) {
    if (!utilisateur) return;
    if (convoOuverte) rendreFil(forcerBas); else rendreListeConversations();
}

function rendreFil(forcerBas) {
    const container = document.getElementById('listeMessagesLocaux');
    if (!container) return;
    const msgs = messagesDe(convoOuverte);
    const procheDuBas = container.scrollHeight - container.scrollTop - container.clientHeight < 120;

    if (!msgs.length) {
        container.innerHTML = `<div class="empty-state"><div class="empty-ico">💬</div><p>Aucun message.<br>Dites bonjour à ${escapeHtml(nomConvo(convoOuverte))} !</p></div>`;
        return;
    }
    let jour = '', html = '';
    msgs.forEach(m => {
        if (m.ts) {
            const j = libelleJour(m.ts);
            if (j !== jour) { jour = j; html += `<div class="day-sep"><span>${escapeHtml(j)}</span></div>`; }
        }
        const moi = !!m.fromMe;
        const auteur = (!moi && convoOuverte === 'general') ? `<div class="msg-author">${escapeHtml(m.expediteur)}</div>` : '';
        html += `<div class="msg-bubble ${moi ? 'me' : 'other'}">${auteur}<p>${escapeHtml(m.texte)}</p>` +
                `<div class="msg-meta"><span class="msg-time">${escapeHtml(m.ts ? heureCourte(m.ts) : (m.heure || ''))}</span>${coches(m)}</div></div>`;
    });
    container.innerHTML = html;
    if (forcerBas || procheDuBas) container.scrollTop = container.scrollHeight;
}

function rendreListeConversations() {
    const box = document.getElementById('convList');
    if (!box) return;
    const filtre = ((document.getElementById('convSearch') || {}).value || '').trim().toLowerCase();

    // dernier message de chaque fil
    const fils = {};
    (utilisateur.messagesLocaux || []).forEach(m => {
        const k = cleConvo(m);
        if (!fils[k] || (m.ts || 0) >= (fils[k].ts || 0)) fils[k] = m;
    });
    const nonLus = utilisateur.nonLus || {};
    if (!fils.general) fils.general = null;

    const lignes = Object.keys(fils).map(k => ({ k, m: fils[k] }))
        .filter(x => !filtre || nomConvo(x.k).toLowerCase().includes(filtre))
        .sort((a, b) => (a.k === 'general') - (b.k === 'general') || ((b.m && b.m.ts) || 0) - ((a.m && a.m.ts) || 0));

    let html = lignes.map(({ k, m }) => {
        const nom = nomConvo(k);
        const c = k !== 'general' ? (utilisateur.contacts || []).find(x => x.telephone === k) : null;
        const n = nonLus[k] || 0;
        const apercu = m ? ((m.fromMe ? 'Vous : ' : (k === 'general' ? m.expediteur + ' : ' : '')) + m.texte) : 'Aucun message';
        return `<button type="button" class="conv-item ${n ? 'unread' : ''}" data-conv="${escapeHtml(k)}">
            <span class="avatar ${k === 'general' ? 'net' : ''}">${k === 'general' ? '🌐' : escapeHtml(initialesDe(nom))}${c && c.online ? '<i class="dot-on"></i>' : ''}</span>
            <span class="conv-body"><span class="conv-top"><strong>${escapeHtml(nom)}</strong><time>${m && m.ts ? escapeHtml(heureCourte(m.ts)) : ''}</time></span>
            <span class="conv-last">${m && m.fromMe ? coches(m) + ' ' : ''}${escapeHtml(apercu.slice(0, 70))}</span></span>
            ${n ? `<b class="badge">${n > 99 ? '99+' : n}</b>` : ''}
        </button>`;
    }).join('');

    // contacts sans discussion → démarrer
    const dejaVus = new Set(Object.keys(fils));
    const libres = (utilisateur.contacts || []).filter(c => !dejaVus.has(c.telephone) && (!filtre || c.nom.toLowerCase().includes(filtre)));
    if (libres.length) {
        html += `<div class="conv-section">Démarrer une discussion</div>` + libres.map(c => `
        <button type="button" class="conv-item" data-conv="${escapeHtml(c.telephone)}">
            <span class="avatar">${escapeHtml(initialesDe(c.nom))}${c.online ? '<i class="dot-on"></i>' : ''}</span>
            <span class="conv-body"><span class="conv-top"><strong>${escapeHtml(c.nom)}</strong></span>
            <span class="conv-last">${escapeHtml(c.metier || c.telephone)}</span></span>
        </button>`).join('');
    }
    box.innerHTML = html || '<p class="empty-hint">Ajoutez des contacts pour discuter.</p>';
}

document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('#convList [data-conv]');
    if (b) ouvrirConversation(b.dataset.conv);
});

// Historique du serveur → fil local (avec accusés)
function fusionnerHistorique(msgs) {
    if (!Array.isArray(msgs) || !utilisateur) return;
    utilisateur.messagesLocaux = utilisateur.messagesLocaux || [];
    const parId = new Map(utilisateur.messagesLocaux.map(x => [x.id, x]));
    let change = false;
    msgs.forEach(m => {
        const fromMe = m.from === utilisateur.telephone;
        const etat = fromMe && m.to ? (m.read ? 'read' : (m.delivered ? 'delivered' : 'sent')) : null;
        const ex = parId.get(m.id) || (m.cid && parId.get(m.cid));
        if (ex) {
            if (fromMe && etat && ex.etat !== etat && ex.etat !== 'read') { ex.etat = etat; change = true; }
            return;
        }
        const nouveau = {
            id: m.id, cid: m.cid || null, expediteur: m.fromName || m.from, from: m.from, texte: m.texte,
            heure: m.heure, fromMe, to: m.to || null, ts: m.timestamp, etat
        };
        utilisateur.messagesLocaux.push(nouveau);
        if (!fromMe) {
            const cle = cleConvo(nouveau);
            const deja = convoOuverte === cle && !document.hidden;
            if (!deja && m.to && !m.readLocal && (Date.now() - (m.timestamp || 0)) < 7 * 86400000 && !m.read) {
                utilisateur.nonLus = utilisateur.nonLus || {};
                utilisateur.nonLus[cle] = (utilisateur.nonLus[cle] || 0) + 1;   // reçus pendant l'absence
            }
        }
        change = true;
    });
    if (change) {
        utilisateur.messagesLocaux.sort((a, b) => (a.ts || 0) - (b.ts || 0));
        utilisateur.messagesLocaux = utilisateur.messagesLocaux.slice(-MAX_MESSAGES_LOCAUX);
        sauverProfil();
        majBadges();
        afficherMessagesLocaux();
    }
}

function chargerHistorique() {
    if (!socket.connected || !utilisateur) return;
    socket.emit('get_history', 150, fusionnerHistorique);
}

// compatibilité avec l'ancien code (panneau d'appel supprimé : l'appel a son propre écran)
function toggleChoixAppel() { ouvrirMessagerie(); }
function fermerChoixAppel() {}
function preparerAppel(tel) { if (tel) lancerAppelDirectPeer('audio', tel); }

/* ---------- Notifications push (appels & messages même app fermée) ---------- */
function urlBase64ToUint8Array(b64) {
    const pad = '='.repeat((4 - b64.length % 4) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

function pushSupporte() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function majCartePush() {
    const carte = document.getElementById('pushPrompt');
    const stat = document.getElementById('statPush');
    const ok = pushSupporte() && Notification.permission === 'granted' && localStorage.getItem('evat_push_ok') === '1';
    if (carte) carte.style.display = (!pushSupporte() || ok) ? 'none' : 'flex';
    if (stat) stat.textContent = ok ? 'Activées' : (pushSupporte() ? 'À activer' : 'Non dispo');
    const txt = document.getElementById('pushPromptText');
    if (txt && pushSupporte() && Notification.permission === 'denied') {
        txt.textContent = 'Notifications bloquées : autorisez-les dans les réglages du navigateur pour recevoir les appels.';
    }
}

async function activerPush() {
    if (!pushSupporte() || !utilisateur || !socket.connected) return false;
    if (Notification.permission !== 'granted') return false;
    try {
        const { publicKey } = await new Promise(res => socket.emit('get_vapid', null, res));
        if (!publicKey) return false;                  // serveur sans web-push
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        const cle = urlBase64ToUint8Array(publicKey);
        // clé serveur changée (redémarrage sans clés fixes) → on se réabonne
        if (sub && sub.options && sub.options.applicationServerKey) {
            const actuelle = new Uint8Array(sub.options.applicationServerKey);
            if (actuelle.length !== cle.length || actuelle.some((v, i) => v !== cle[i])) { await sub.unsubscribe(); sub = null; }
        }
        if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cle });
        const res = await new Promise(r => socket.emit('push_subscribe', sub.toJSON(), r));
        if (res && res.ok) { localStorage.setItem('evat_push_ok', '1'); majCartePush(); return true; }
    } catch (e) { console.warn('Push :', e); }
    return false;
}

async function activerNotificationsPush() {
    if (!pushSupporte()) {
        alert('Ce navigateur ne gère pas les notifications. Sur iPhone : ajoutez d’abord EVAT à l’écran d’accueil (Partager → Sur l’écran d’accueil).');
        return;
    }
    try { await Notification.requestPermission(); } catch (e) {}
    if (Notification.permission === 'granted') {
        const ok = await activerPush();
        montrerNotification(ok ? '🔔 Notifications activées : vous recevrez appels et messages même app fermée.' : '⚠️ Activation impossible pour le moment (serveur sans notifications).');
    } else {
        montrerNotification('🔕 Notifications refusées. Autorisez-les dans les réglages du navigateur.');
    }
    majCartePush();
}

// Le serveur doit savoir si l'écran est visible (sinon il double l'appel avec une notification)
function signalerVisibilite() {
    if (socket.connected) socket.emit('visibility', document.hidden);
}
document.addEventListener('visibilitychange', () => {
    signalerVisibilite();
    if (!document.hidden && convoOuverte && convoOuverte !== 'general' && utilisateur) {
        utilisateur.nonLus = utilisateur.nonLus || {};
        utilisateur.nonLus[convoOuverte] = 0;
        socket.emit('mark_read', { peer: convoOuverte });
        majBadges();
    }
});

// Clic sur une notification système (app déjà ouverte)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (e) => {
        const d = e.data || {};
        if (d.type !== 'notif-click') return;
        gererOuvertureNotification(d.data || {}, d.action);
    });
}

let autoDecrocher = 0;   // horodatage : décrocher automatiquement l'appel qui arrive (bouton « Répondre »)
function gererOuvertureNotification(data, action) {
    if (data.type === 'call') {
        if (action === 'accept') autoDecrocher = Date.now();
    } else if ((data.type === 'message' || data.type === 'missed') && data.from) {
        ouvrirMessagerie(data.from);
    }
}

// Ouverture de l'app via la notification (app fermée) : lecture des paramètres d'URL
(function lireParametresOuverture() {
    try {
        const p = new URLSearchParams(location.search);
        if (!p.has('open')) return;
        const data = { type: p.get('open'), from: p.get('from') || '' };
        history.replaceState(null, '', location.pathname);
        window.addEventListener('load', () => setTimeout(() => gererOuvertureNotification(data, p.get('accept') === '1' ? 'accept' : ''), 600));
    } catch (e) {}
})();

/* ---------- Accueil : cartes de statistiques ---------- */
function majStatsAccueil() {
    majBadges();
    majCartePush();
}

function majNavActive(tabId) {
    document.querySelectorAll('#bottomNav [data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
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

});

async function demanderPermissionsEtActiverProfil() {
    // Micro (pour les appels) + notifications (appels entrants / messages). La caméra est demandée seulement pour un appel vidéo.
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
    } catch (err) {}
    try { if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission(); } catch (e) {}
    sauvegarderProfilBase();
    setTimeout(activerPush, 1500);
}
