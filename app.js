/* ============================================================
   EVAT Continuum v4.9 — Client dynamique
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
    ['evat_profil', 'evat_ringtone', 'evat_photo', 'evat_bk_at', 'evat_bk_attente_restore'].forEach(k => localStorage.removeItem(k));
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

// ---------- Téléchargement APK (paramètres) ----------
// Placez le fichier evat.apk à côté de index.html (même dossier sur Vercel),
// ou remplacez cette adresse par un lien direct (GitHub Releases, etc.).
const APK_URL = 'evat.apk';

async function telechargerApk(ev) {
    const info = document.getElementById('infoApk');
    const montrer = (msg) => { if (info) { info.textContent = msg; info.style.display = 'block'; } };
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        if (ev) ev.preventDefault();
        montrer("L'APK est réservé à Android. Sur iPhone : Safari → Partager → « Sur l'écran d'accueil ».");
        return false;
    }
    try {
        const r = await fetch(APK_URL, { method: 'HEAD', cache: 'no-store' });
        if (!r.ok) throw new Error('absent');
    } catch (e) {
        if (ev) ev.preventDefault();
        montrer("L'APK n'est pas encore disponible sur le serveur. Utilisez « Installer depuis le navigateur » en attendant.");
        return false;
    }
    montrer('Téléchargement lancé… ouvrez ensuite le fichier EVAT.apk pour installer.');
    return true;
}

function majBoutonsInstallation() {
    const dejaInstallee = NATIF || window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const carte = document.getElementById('carteTelechargementApk');
    if (carte && dejaInstallee) carte.style.display = 'none';
    const b = document.getElementById('btnInstallerPwaParametres');
    if (b) b.style.display = deferredPrompt ? 'block' : 'none';
}
window.addEventListener('beforeinstallprompt', () => setTimeout(majBoutonsInstallation, 0));
window.addEventListener('appinstalled', majBoutonsInstallation);
window.addEventListener('load', majBoutonsInstallation);

function fermerBanniereInstall() {
    const banner = document.getElementById('installBanner');
    if (banner) banner.style.display = 'none';
}

// ---------- Pays du monde (v4.4) : indicatifs, numéros internationaux ----------
/*  Tous les pays peuvent s'inscrire : la liste vient de cette table (ISO → indicatif),
    les noms de pays sont fournis en français par le navigateur (Intl.DisplayNames).        */
const DIAL_PAYS = {
    AF:'93', AL:'355', DZ:'213', AS:'1684', AD:'376', AO:'244', AI:'1264', AG:'1268', AR:'54', AM:'374', AW:'297',
    AU:'61', AT:'43', AZ:'994', BS:'1242', BH:'973', BD:'880', BB:'1246', BY:'375', BE:'32', BZ:'501', BJ:'229',
    BM:'1441', BT:'975', BO:'591', BA:'387', BW:'267', BR:'55', IO:'246', VG:'1284', BN:'673', BG:'359', BF:'226',
    BI:'257', KH:'855', CM:'237', CA:'1', CV:'238', BQ:'599', KY:'1345', CF:'236', TD:'235', CL:'56', CN:'86',
    CX:'61', CC:'61', CO:'57', KM:'269', CG:'242', CD:'243', CK:'682', CR:'506', CI:'225', HR:'385', CU:'53',
    CW:'599', CY:'357', CZ:'420', DK:'45', DJ:'253', DM:'1767', DO:'1', EC:'593', EG:'20', SV:'503', GQ:'240',
    ER:'291', EE:'372', SZ:'268', ET:'251', FK:'500', FO:'298', FJ:'679', FI:'358', FR:'33', GF:'594', PF:'689',
    GA:'241', GM:'220', GE:'995', DE:'49', GH:'233', GI:'350', GR:'30', GL:'299', GD:'1473', GP:'590', GU:'1671',
    GT:'502', GG:'44', GN:'224', GW:'245', GY:'592', HT:'509', HN:'504', HK:'852', HU:'36', IS:'354', IN:'91',
    ID:'62', IR:'98', IQ:'964', IE:'353', IM:'44', IL:'972', IT:'39', JM:'1876', JP:'81', JE:'44', JO:'962',
    KZ:'7', KE:'254', KI:'686', XK:'383', KW:'965', KG:'996', LA:'856', LV:'371', LB:'961', LS:'266', LR:'231',
    LY:'218', LI:'423', LT:'370', LU:'352', MO:'853', MG:'261', MW:'265', MY:'60', MV:'960', ML:'223', MT:'356',
    MH:'692', MQ:'596', MR:'222', MU:'230', YT:'262', MX:'52', FM:'691', MD:'373', MC:'377', MN:'976', ME:'382',
    MS:'1664', MA:'212', MZ:'258', MM:'95', NA:'264', NR:'674', NP:'977', NL:'31', NC:'687', NZ:'64', NI:'505',
    NE:'227', NG:'234', NU:'683', NF:'672', KP:'850', MK:'389', MP:'1670', NO:'47', OM:'968', PK:'92', PW:'680',
    PS:'970', PA:'507', PG:'675', PY:'595', PE:'51', PH:'63', PL:'48', PT:'351', PR:'1', QA:'974', RE:'262',
    RO:'40', RU:'7', RW:'250', BL:'590', SH:'290', KN:'1869', LC:'1758', MF:'590', PM:'508', VC:'1784', WS:'685',
    SM:'378', ST:'239', SA:'966', SN:'221', RS:'381', SC:'248', SL:'232', SG:'65', SX:'1721', SK:'421', SI:'386',
    SB:'677', SO:'252', ZA:'27', KR:'82', SS:'211', ES:'34', LK:'94', SD:'249', SR:'597', SJ:'47', SE:'46',
    CH:'41', SY:'963', TW:'886', TJ:'992', TZ:'255', TH:'66', TL:'670', TG:'228', TK:'690', TO:'676', TT:'1868',
    TN:'216', TR:'90', TM:'993', TC:'1649', TV:'688', VI:'1340', UG:'256', UA:'380', AE:'971', GB:'44', US:'1',
    UY:'598', UZ:'998', VU:'678', VA:'379', VE:'58', VN:'84', WF:'681', EH:'212', YE:'967', ZM:'260', ZW:'263',
    AX:'358'
};
// Pays dont le « 0 » du début fait partie du numéro (on ne le retire jamais)
const GARDE_ZERO = new Set(['IT', 'SM', 'VA', 'CI', 'BJ', 'GA', 'CG']);
// Pays « principal » quand plusieurs partagent un indicatif
const PAYS_PRINCIPAL = { '1': 'US', '7': 'RU', '44': 'GB', '358': 'FI', '61': 'AU', '47': 'NO', '590': 'GP', '599': 'CW', '262': 'RE', '212': 'MA', '39': 'IT' };

const _ISO_PAR_DIAL = {};
Object.keys(DIAL_PAYS).forEach(iso => { (_ISO_PAR_DIAL[DIAL_PAYS[iso]] = _ISO_PAR_DIAL[DIAL_PAYS[iso]] || []).push(iso); });
const _DIALS_TRIES = Object.keys(_ISO_PAR_DIAL).sort((a, b) => b.length - a.length);   // le plus long d'abord

function drapeEmoji(iso) {
    try { return String.fromCodePoint(...[...iso].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)); } catch (e) { return '🌍'; }
}

let _nomsPays = null;
function nomPays(iso) {
    try {
        _nomsPays = _nomsPays || new Intl.DisplayNames(['fr'], { type: 'region' });
        return _nomsPays.of(iso) || iso;
    } catch (e) { return iso; }
}

function dialPlusLong(chiffres) {
    for (const d of _DIALS_TRIES) if (chiffres.startsWith(d)) return d;
    return null;
}

function isoDepuisTel(tel) {
    const d = String(tel || '').replace(/\D/g, '');
    const dial = dialPlusLong(d);
    return dial ? (PAYS_PRINCIPAL[dial] || _ISO_PAR_DIAL[dial][0]) : null;
}

function paysUtilisateur() {
    return (typeof utilisateur !== 'undefined' && utilisateur && (utilisateur.pays || isoDepuisTel(utilisateur.telephone))) || null;
}

function paysParDefaut() {
    try {
        const m = (navigator.language || '').match(/[-_]([A-Za-z]{2})\b/);
        if (m && DIAL_PAYS[m[1].toUpperCase()]) return m[1].toUpperCase();
    } catch (e) {}
    return 'TG';
}

/** Numéro → format international (+indicatif…). Sans « + », le numéro est national et reçoit l'indicatif du pays. */
function normaliserTel(v, isoDefaut) {
    let t = String(v || '').replace(/[\s\-.()\u00A0\u202F]/g, '');
    if (!t) return '';
    if (t.startsWith('00')) t = '+' + t.slice(2);
    if (t.startsWith('+')) {
        const chiffres = t.slice(1).replace(/\D/g, '');
        const dial = dialPlusLong(chiffres);
        if (!dial) return '+' + chiffres;
        const iso = PAYS_PRINCIPAL[dial] || _ISO_PAR_DIAL[dial][0];
        let reste = chiffres.slice(dial.length);
        if (reste.startsWith('0') && reste.length > 1 && !GARDE_ZERO.has(iso)) reste = reste.replace(/^0+/, '');   // « +233 0244… »
        return '+' + dial + reste;
    }
    const iso = (isoDefaut && DIAL_PAYS[isoDefaut]) ? isoDefaut : (paysUtilisateur() || paysParDefaut());
    let nat = t.replace(/\D/g, '');
    if (nat.startsWith('0') && !GARDE_ZERO.has(iso)) nat = nat.replace(/^0+/, '');
    return '+' + DIAL_PAYS[iso] + nat;
}

function telEstValideClient(tel) {
    const t = String(tel || '').replace(/[\s\-.()]/g, '');
    return /^\+[1-9]\d{6,14}$/.test(t);
}

/** Nom : toutes les écritures (latin, arabe, cyrillique, chinois…) ; seuls les noms d'exemple exacts sont refusés */
const NOMS_INTERDITS = ['kodjo marceline', 'test', 'admin', 'utilisateur', 'user', 'exemple', 'demo', 'opérateur', 'operateur'];
function nomEstValideClient(nom) {
    const n = String(nom || '').trim().replace(/\s+/g, ' ');
    if ([...n].length < 2 || [...n].length > 80) return false;
    const simple = n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (NOMS_INTERDITS.includes(simple)) return false;
    return /\p{L}/u.test(n);
}

/* ---------- Sélecteur de pays (inscription) ---------- */
function initialiserSelecteurPays() {
    const sel = document.getElementById('selectPays');
    if (!sel || sel.dataset.pret) return;
    sel.dataset.pret = '1';
    const liste = Object.keys(DIAL_PAYS).map(iso => ({ iso, nom: nomPays(iso) }))
        .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    sel.innerHTML = liste.map(p =>
        `<option value="+${DIAL_PAYS[p.iso]}" data-iso="${p.iso}">${drapeEmoji(p.iso)} ${escapeHtml(p.nom)} (+${DIAL_PAYS[p.iso]})</option>`).join('');
    const defaut = paysParDefaut();
    const opt = [...sel.options].find(o => o.dataset.iso === defaut);
    if (opt) opt.selected = true;
    const tel = document.getElementById('inputTelProfil');
    if (tel && !tel.value) tel.value = sel.value;
}

function isoSelectionne() {
    const sel = document.getElementById('selectPays');
    return sel && sel.selectedOptions[0] ? sel.selectedOptions[0].dataset.iso : null;
}

// Changer de pays : remplace l'indicatif au début du champ numéro
function mettreAJourIndicatif() {
    const sel = document.getElementById('selectPays');
    const telInput = document.getElementById('inputTelProfil');
    if (!sel || !telInput) return;
    let cur = telInput.value.replace(/[\s\-.()]/g, '');
    if (cur.startsWith('+')) {
        const d = dialPlusLong(cur.slice(1).replace(/\D/g, ''));
        cur = d ? cur.slice(1 + d.length) : cur.slice(1);
    }
    telInput.value = sel.value + cur;
}

// Numéro tapé en entier (+33…, +81…) : le pays s'ajuste tout seul
function synchroniserPaysDepuisTel() {
    const sel = document.getElementById('selectPays');
    const telInput = document.getElementById('inputTelProfil');
    if (!sel || !telInput || !telInput.value.trim().startsWith('+')) return;
    const iso = isoDepuisTel(telInput.value);
    if (!iso) return;
    const actuel = sel.selectedOptions[0];
    if (actuel && DIAL_PAYS[actuel.dataset.iso] === DIAL_PAYS[iso]) return;     // même indicatif : on garde le pays choisi
    const opt = [...sel.options].find(o => o.dataset.iso === iso);
    if (opt) opt.selected = true;
}

// ---------- Appli native Android (Capacitor) ----------
// Le même code tourne dans le navigateur ET dans l'appli native : NATIF vaut true seulement dans l'APK.
const NATIF = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
function plugNatif(nom) {
    try { return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[nom]) || null; } catch (e) { return null; }
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
    // IMPORTANT : on se signale au serveur même sans code de récupération (anciens comptes) : le serveur répond alors
    // « needsNew » et l'application recrée le compte toute seule. Avant, ces comptes restaient invisibles et injoignables.
    if (utilisateur && utilisateur.telephone) {
        socket.emit('register_user', {
            nom: utilisateur.nom,
            telephone: utilisateur.telephone,
            metier: utilisateur.metier,
            recoveryPin: utilisateur.recoveryPin || undefined
        }, (res) => {
            if (res && res.ok === false) {
                // Serveur redémarré qui ne connaît plus ce compte : on le recrée tout seul (nouveau code de récupération)
                if (res.needsNew && utilisateur) { reinscrireCompte(); return; }
                if (res.supprime) {                         // compte supprimé par l'administrateur : retour à l'inscription
                    effacerProfilLocal(); localStorage.removeItem('elaws_presentee');
                    alert(res.error || 'Ce compte a été supprimé par l’administrateur.');
                    location.reload();
                    return;
                }
                if (res.revoque) {                          // compte récupéré sur un autre téléphone : cet appareil est déconnecté
                    effacerProfilLocal(); localStorage.removeItem('elaws_presentee');
                    alert('Votre compte a été récupéré sur un autre téléphone. Cet appareil est déconnecté et ses données locales sont supprimées.');
                    location.reload();
                    return;
                }
                if (res.suspendu) {
                    const sp = document.getElementById('serverConnectionStatus');
                    if (sp) { sp.textContent = '🔴 Compte suspendu par l’administrateur'; sp.style.color = 'var(--danger)'; }
                    montrerNotification(res.error || 'Compte suspendu par l’administrateur.');
                    return;
                }
                // PIN invalide ou compte pris → forcer la récupération
                const st = document.getElementById('serverConnectionStatus');
                if (st) { st.textContent = '🟠 Compte non reconnu — Menu → Refaire l’enregistrement'; st.style.color = 'var(--warning, #f59e0b)'; }
                montrerNotification(res.error || 'Session non reconnue. Récupérez votre compte.');
                return;
            }
            // Les abonnements de présence sont perdus à chaque reconnexion : on les refait
            verifierEtSynchroniserContacts();
            chargerHistorique();
            signalerVisibilite();
            activerPush();
            majStatsAccueil();
            while (_outbox.length) { const m = _outbox.shift(); envoyerMessage(m.to, m.texte, m.cid, m.image, m.audio, m.audioDur); }
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
    if (data && data.reason === 'blocked') {
        try { if (typeof fermerAppelTotalLocally === 'function') fermerAppelTotalLocally(); } catch (e) {}
        const st = document.getElementById('serverConnectionStatus');
        if (st) { st.textContent = '🔴 Compte suspendu par l’administrateur'; st.style.color = 'var(--danger)'; }
        alert(data.message || 'Votre compte a été suspendu par l’administrateur.');
        return;
    }
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
            match.surEVAT = true;
            sauverProfil();
            afficherContacts();
            majCompteurContactsEnLigne();
            montrerNotification(`🚨 ${match.nom} (${data.telephone}) vient de s'inscrire ! Métier : ${data.metier}`);
        }
    }
});

// Un contact du téléphone vient de s'inscrire sur EVAT (comme WhatsApp / Telegram)
socket.on('contacts_joined', (liste) => {
    if (!utilisateur || !Array.isArray(liste) || !liste.length) return;
    const noms = [];
    (utilisateur.contacts || []).forEach(c => {
        const d = liste.find(x => x.telephone === c.telephone);
        if (!d) return;
        c.surEVAT = true;
        c.online = true;
        if (d.metier) c.metier = d.metier;
        noms.push(c.nom);
    });
    if (!noms.length) return;
    sauverProfil();
    afficherContacts();
    majCompteurContactsEnLigne();
    verifierEtSynchroniserContacts();
    montrerNotification(noms.length === 1
        ? '🎉 ' + noms[0] + ' vient de rejoindre EVAT !'
        : '🎉 ' + noms.slice(0, 3).join(', ') + (noms.length > 3 ? ' et ' + (noms.length - 3) + ' autres' : '') + ' viennent de rejoindre EVAT !');
});

// Présence temps réel : le serveur n'envoie plus que les changements des contacts suivis
socket.on('presence', (info) => {
    if (!info || !utilisateur || !utilisateur.contacts) return;
    const c = utilisateur.contacts.find(x => x.telephone === info.telephone);
    if (!c) return;
    c.online = !!info.online;
    c.surEVAT = true;
    c.statut = info.statut || (info.online ? 'disponible' : 'hors_ligne');
    c.lastSeen = info.lastSeen || c.lastSeen || 0;
    if (info.metier) c.metier = info.metier;
    sauverProfil();
    afficherContacts();
    majCompteurContactsEnLigne();
    if (convoOuverte) majEntetePeer();
    const tm = document.getElementById('tab-messagerie');
    if (!convoOuverte && tm && tm.style.display !== 'none') afficherMessagesLocaux();
});

socket.on('online_count', () => { /* no-op : pas de total réseau visible */ });

function compterContactsEnLigne() {
    if (!utilisateur || !Array.isArray(utilisateur.contacts)) return 0;
    return utilisateur.contacts.filter(c => c && c.online).length;
}

function majCompteurContactsEnLigne() {
    const n = compterContactsEnLigne();
    onlineTotal = n;
    const el = document.getElementById('onlineCount');
    if (el) el.textContent = String(n);
}

const STATUT_LABELS = {
    disponible: 'Disponible',
    occupe: 'Occupé',
    deplacement: 'En route',
    focus: 'Focus',
    invisible: 'Invisible',
    hors_ligne: 'Hors ligne'
};

function labelStatut(s) {
    return STATUT_LABELS[s] || STATUT_LABELS.hors_ligne;
}

function formaterVuLe(ts) {
    if (!ts) return '';
    const d = Date.now() - Number(ts);
    if (d < 60000 * 2) return 'vu à l’instant';
    if (d < 3600000) return 'vu il y a ' + Math.max(1, Math.round(d / 60000)) + ' min';
    if (d < 86400000) return 'vu il y a ' + Math.max(1, Math.round(d / 3600000)) + ' h';
    return 'vu le ' + new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

const STATUT_ORDRE = ['disponible', 'occupe', 'deplacement', 'focus', 'invisible'];
const STATUT_ICONES = {
    disponible: '🟢', occupe: '🟠', deplacement: '🔵', focus: '🟣', invisible: '⚫', hors_ligne: '⚪'
};

function majPresenceCycleUI(statut) {
    const s = statut || 'disponible';
    const ico = document.getElementById('presenceCycleIcon');
    const lab = document.getElementById('presenceCycleLabel');
    const btn = document.getElementById('btnPresenceCycle');
    const hint = document.getElementById('presenceHint');
    if (ico) ico.textContent = STATUT_ICONES[s] || '🟢';
    if (lab) lab.textContent = labelStatut(s);
    if (btn) {
        btn.dataset.statut = s;
        btn.className = 'presence-cycle statut-' + s;
    }
    if (hint) {
        hint.textContent = s === 'invisible'
            ? 'invisible pour vos contacts'
            : 'vos contacts seulement';
    }
}

function changerStatutPresence(statut) {
    if (!utilisateur) return;
    utilisateur.statutPresence = statut;
    sauverProfil();
    majPresenceCycleUI(statut);
    if (socket.connected) {
        socket.emit('set_statut', { statut }, (res) => {
            if (res && res.ok === false) montrerNotification(res.error || 'Statut non synchronisé');
        });
    }
    majBoostOnboarding();
}

function cyclerStatutPresence() {
    const cur = (utilisateur && utilisateur.statutPresence) || 'disponible';
    const i = STATUT_ORDRE.indexOf(cur);
    const next = STATUT_ORDRE[(i < 0 ? 0 : i + 1) % STATUT_ORDRE.length];
    changerStatutPresence(next);
}

function appliquerStatutPresenceUI() {
    const s = (utilisateur && utilisateur.statutPresence) || 'disponible';
    majPresenceCycleUI(s);
    if (socket.connected) socket.emit('set_statut', { statut: s });
}

function majBoostOnboarding() {
    const box = document.getElementById('boostOnboarding');
    const list = document.getElementById('boostList');
    if (!box || !list || !utilisateur) return;

    const notifOk = (typeof pushSupporte === 'function' && pushSupporte()
        && typeof Notification !== 'undefined' && Notification.permission === 'granted'
        && localStorage.getItem('evat_push_ok') === '1');
    const contactsOk = (utilisateur.contacts || []).length > 0;
    const profilOk = !!(utilisateur.metier && utilisateur.metier !== 'Opérateur') || !!(utilisateur.email || utilisateur.ville);
    const statutOk = !!(utilisateur.statutPresence && utilisateur.statutPresence !== 'disponible') || localStorage.getItem('evat_boost_statut') === '1';

    // Marquer statut comme « exploré » si changé une fois
    if (utilisateur.statutPresence && utilisateur.statutPresence !== 'disponible') {
        localStorage.setItem('evat_boost_statut', '1');
    }

    const steps = [
        {
            id: 'notif', ok: notifOk, label: 'Activer les notifications (appels app fermée)',
            act: 'Activer', fn: 'activerNotificationsPush()'
        },
        {
            id: 'contacts', ok: contactsOk, label: 'Ajouter ou importer au moins 1 contact',
            act: 'Contacts', fn: "switchTab('contacts')"
        },
        {
            id: 'profil', ok: profilOk, label: 'Compléter le profil (métier / e-mail / ville)',
            act: 'Profil', fn: "switchTab('profil')"
        }
    ];
    const done = steps.filter(s => s.ok).length;
    if (done >= steps.length) {
        box.style.display = 'none';
        localStorage.setItem('evat_boost_done', '1');
        return;
    }
    if (localStorage.getItem('evat_boost_done') === '1' && done >= 2) {
        box.style.display = 'none';
        return;
    }
    box.style.display = 'block';
    list.innerHTML = steps.map(s => `
        <li class="${s.ok ? 'done' : ''}">
            <span>${s.ok ? '✅' : '○'} ${s.label}</span>
            ${s.ok ? '' : `<button type="button" class="boost-act" onclick="${s.fn}">${s.act}</button>`}
        </li>`).join('');
}

socket.on('admin_message', (data) => {
    const titre = (data && data.title) || 'Message EVAT';
    const corps = (data && data.body) || '';
    const texte = corps ? (titre + '\n' + corps) : titre;
    montrerNotification('🛡️ ' + texte);
    try { alert('🛡️ ' + titre + (corps ? ('\n\n' + corps) : '')); } catch (e) {}
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
        const duree = (texte && texte.length > 80) ? 14000 : 9000;
        window._notifTimer = setTimeout(() => fermerNotification(), duree);
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
        pays: isoDepuisTel(tel),
        email: '',
        entreprise: '',
        ville: '',
        bio: '',
        qubits: 365,
        notes: [],
        messagesLocaux: [],
        contacts: [],
        historiqueElaws: [],
        parametres: {
            sonnerieType: 'telephone',
            customRingtoneBase64: null,
            vibration: true
        },
        photo: null
    };
}

function normaliserContact(raw) {
    const c = raw || {};
    const telPrincipal = normaliserTel(c.telephone || c.tel || '');
    let telephones = [];
    if (Array.isArray(c.telephones)) {
        telephones = c.telephones.map(t => normaliserTel(t)).filter(telEstValideClient);
    }
    if (telPrincipal && telEstValideClient(telPrincipal) && !telephones.includes(telPrincipal)) {
        telephones.unshift(telPrincipal);
    }
    telephones = [...new Set(telephones)].slice(0, 5);

    let emails = [];
    if (Array.isArray(c.emails)) {
        emails = c.emails.map(e => String(e || '').trim().slice(0, 120)).filter(e => e && e.includes('@'));
    }
    const emailPrincipal = String(c.email || '').trim().slice(0, 120);
    if (emailPrincipal && emailPrincipal.includes('@') && !emails.includes(emailPrincipal)) {
        emails.unshift(emailPrincipal);
    }
    emails = [...new Set(emails)].slice(0, 5);

    return {
        nom: String(c.nom || c.name || 'Sans nom').trim().slice(0, 80) || 'Sans nom',
        telephone: telephones[0] || telPrincipal,
        telephones,
        email: emails[0] || '',
        emails,
        metier: String(c.metier || c.job || '').trim().slice(0, 80),
        entreprise: String(c.entreprise || c.organization || '').trim().slice(0, 80),
        adresse: String(c.adresse || c.address || '').trim().slice(0, 160),
        notes: String(c.notes || '').trim().slice(0, 400),
        online: !!c.online,
        surEVAT: !!c.surEVAT,
        statut: c.statut || '',
        lastSeen: c.lastSeen || 0,
        source: c.source || 'manual'
    };
}

function telephonesDuContact(c) {
    if (!c) return [];
    const list = Array.isArray(c.telephones) ? c.telephones.slice() : [];
    if (c.telephone && !list.includes(c.telephone)) list.unshift(c.telephone);
    return [...new Set(list.map(t => normaliserTel(t)).filter(telEstValideClient))];
}

function emailsDuContact(c) {
    if (!c) return [];
    const list = Array.isArray(c.emails) ? c.emails.slice() : [];
    if (c.email && !list.includes(c.email)) list.unshift(c.email);
    return [...new Set(list.map(e => String(e || '').trim()).filter(e => e && e.includes('@')))];
}

function historiqueAppelsContact(c) {
    if (!c || !utilisateur) return [];
    const nums = new Set(telephonesDuContact(c));
    return journal().filter(e => e && e.peer && nums.has(normaliserTel(e.peer)));
}

function sauvegarderProfilBase() {
    const nom = document.getElementById('inputNom').value.trim();
    const paysChoisi = isoSelectionne();
    const tel = normaliserTel(document.getElementById('inputTelProfil').value, paysChoisi);
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
        afficherErreurAuth('authCreateError', 'Numéro invalide. Entrez l’indicatif du pays puis le numéro (ex : +228 90 12 34 56).');
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
        if (paysChoisi) utilisateur.pays = paysChoisi;
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
        setTimeout(() => { proposerImportContactsApresInscription(); majBoostOnboarding(); proposerRestaurationCloud(); }, 1200);
    });
}

function fermerPinModal() {
    const pinModal = document.getElementById('pinModal');
    if (pinModal) pinModal.style.display = 'none';
}

function recupererCompteExistant() {
    const tel = normaliserTel(document.getElementById('inputTelRecover').value);
    const pin = document.getElementById('inputPinRecover').value.trim();
    const metier = document.getElementById('inputMetierRecover').value.trim();

    afficherErreurAuth('authRecoverError', '');

    if (!tel || !pin) {
        afficherErreurAuth('authRecoverError', 'Numéro et code de récupération obligatoires.');
        return;
    }
    if (!telEstValideClient(tel)) {
        afficherErreurAuth('authRecoverError', 'Numéro invalide. Entrez l’indicatif du pays puis le numéro (ex : +228 90 12 34 56).');
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

        localStorage.setItem('evat_bk_attente_restore', '1');   // pas de sauvegarde tant que la restauration n'est pas faite
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
        setTimeout(() => { proposerImportContactsApresInscription(); majBoostOnboarding(); proposerRestaurationCloud(); restaurerSauvegardeComplete(true); }, 1200);
    });
}

function sauvegarderProfilBaseDesdeProfil() {
    if (!utilisateur) return;
    const nom = document.getElementById('inputNomProfil').value.trim();
    const tel = normaliserTel(document.getElementById('inputTelProfil2').value, paysUtilisateur());
    const metier = ((document.getElementById('inputMetierProfil') || {}).value || '').trim();
    const email = ((document.getElementById('inputEmailProfil') || {}).value || '').trim();
    const entreprise = ((document.getElementById('inputEntrepriseProfil') || {}).value || '').trim();
    const ville = ((document.getElementById('inputVilleProfil') || {}).value || '').trim();
    const bio = ((document.getElementById('inputBioProfil') || {}).value || '').trim();

    if (!nom || !tel) {
        alert('Le nom et le téléphone sont obligatoires.');
        return;
    }
    if (!nomEstValideClient(nom)) {
        alert('Nom invalide ou réservé. Entrez votre vrai nom.');
        return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        alert('E-mail invalide.');
        return;
    }
    if (tel !== utilisateur.telephone) {
        alert('Le numéro de compte ne peut pas être modifié ici.\nPour un nouveau numéro, créez un nouveau compte.\nPour changer d’appareil, utilisez « Récupérer mon compte » avec votre code.');
        document.getElementById('inputTelProfil2').value = utilisateur.telephone;
        return;
    }

    utilisateur.nom = nom;
    utilisateur.metier = metier;
    utilisateur.email = email.slice(0, 120);
    utilisateur.entreprise = entreprise.slice(0, 80);
    utilisateur.ville = ville.slice(0, 80);
    utilisateur.bio = bio.slice(0, 400);
    sauverProfil();

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
    if (!Array.isArray(utilisateur.contacts)) utilisateur.contacts = [];
    utilisateur.contacts = utilisateur.contacts.map(c => normaliserContact(c)).filter(c => telEstValideClient(c.telephone));
    if (!utilisateur.parametres) {
        utilisateur.parametres = { sonnerieType: 'telephone', customRingtoneBase64: null };
    }
    if (utilisateur.email == null) utilisateur.email = '';
    if (utilisateur.entreprise == null) utilisateur.entreprise = '';
    if (utilisateur.ville == null) utilisateur.ville = '';
    if (utilisateur.bio == null) utilisateur.bio = '';

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
    setVal('inputEmailProfil', utilisateur.email);
    setVal('inputEntrepriseProfil', utilisateur.entreprise);
    setVal('inputVilleProfil', utilisateur.ville);
    setVal('inputBioProfil', utilisateur.bio);

    const idTel = document.getElementById('profilIdTel');
    if (idTel) idTel.textContent = utilisateur.telephone || '—';

    if (document.getElementById('sidebarUserName')) document.getElementById('sidebarUserName').innerText = utilisateur.nom;
    if (document.getElementById('sidebarUserRole')) document.getElementById('sidebarUserRole').innerText = utilisateur.metier;
    if (document.getElementById('dashUserName')) document.getElementById('dashUserName').innerText = utilisateur.nom.toUpperCase();
    if (document.getElementById('dashUserMetier')) {
        const extra = [utilisateur.metier, utilisateur.entreprise, utilisateur.ville].filter(Boolean).join(' · ');
        document.getElementById('dashUserMetier').innerText = extra || 'Profil';
    }
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
            utilisateur.contacts.forEach(c => { c.surEVAT = false; });
            reponses.forEach(info => {
                const contact = utilisateur.contacts.find(c => c.telephone === info.telephone);
                if (contact) {
                    if (info.metier) contact.metier = info.metier;
                    contact.online = !!info.online;
                    contact.surEVAT = true;
                    contact.statut = info.statut || (info.online ? 'disponible' : 'hors_ligne');
                    contact.lastSeen = info.lastSeen || contact.lastSeen || 0;
                }
            });
            sauverProfil();
            afficherContacts();
            majCompteurContactsEnLigne();
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

    const q = ((document.getElementById('contactSearch') || {}).value || '').trim().toLowerCase();
    let liste = utilisateur.contacts.map((c, index) => ({ c, index }));
    if (q) {
        liste = liste.filter(({ c }) => {
            const blob = [c.nom, c.telephone, c.email, c.metier, c.entreprise, c.notes].join(' ').toLowerCase();
            return blob.includes(q);
        });
    }

    const countEl = document.getElementById('contactCount');
    if (countEl) {
        countEl.textContent = liste.length
            ? (liste.length + ' contact' + (liste.length > 1 ? 's' : ''))
            : '';
    }

    if (utilisateur.contacts.length === 0) {
        container.innerHTML = `<p style="color:var(--text-secondary); font-size:12px; text-align:center; padding:18px 8px;">
            Aucun contact pour l’instant.<br>
            <span style="font-size:11px;">Importez ceux de votre téléphone ou ajoutez-en manuellement.</span>
        </p>`;
        return;
    }
    if (liste.length === 0) {
        container.innerHTML = `<p style="color:var(--text-secondary); font-size:12px;">Aucun résultat pour « ${escapeHtml(q)} ».</p>`;
        return;
    }

    container.innerHTML = liste.map(({ c, index }) => {
        const st = c.online ? (c.statut || 'disponible') : 'hors_ligne';
        const statusDot = c.online
            ? `<span class="online-dot" title="${escapeHtml(labelStatut(st))}"></span>`
            : `<span class="offline-dot" title="Hors ligne"></span>`;
        const sous = c.metier || c.entreprise || '';
        return `
        <button type="button" class="contact-row" data-act="open-fiche" data-i="${index}">
            <span class="contact-row-avatar">${escapeHtml((c.nom || '?').trim().charAt(0).toUpperCase())}</span>
            <span class="contact-row-text">
                <strong class="contact-row-name">${escapeHtml(c.nom)}</strong>
                ${sous ? `<span class="contact-row-sub">${escapeHtml(sous)}</span>` : ''}
            </span>
            ${statusDot}
            <span class="contact-chevron">›</span>
        </button>`;
    }).join('');
}

let _ficheContactIndex = -1;

function initialesContact(nom) {
    const p = String(nom || '').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '?';
    if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
    return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

let _ficheHistoFiltre = 'tous';

function ouvrirFicheContact(index) {
    if (!utilisateur || !utilisateur.contacts) return;
    const c = utilisateur.contacts[index];
    if (!c) return;
    // Normaliser en place pour emails[] / telephones[]
    utilisateur.contacts[index] = normaliserContact(c);
    const contact = utilisateur.contacts[index];
    _ficheContactIndex = index;
    _ficheHistoFiltre = 'tous';
    const fiche = document.getElementById('contactFiche');
    if (!fiche) return;

    const st = contact.online ? (contact.statut || 'disponible') : 'hors_ligne';
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || ''; };
    const showBlock = (id, on) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (on) el.removeAttribute('hidden'); else el.setAttribute('hidden', '');
    };

    set('contactFicheNom', contact.nom);
    const av = document.getElementById('contactFicheAvatar');
    if (av) av.textContent = initialesContact(contact.nom);

    const statutEl = document.getElementById('contactFicheStatut');
    if (statutEl) {
        if (contact.surEVAT || contact.online) {
            statutEl.textContent = (contact.online ? '● ' : '') + labelStatut(st) + (contact.surEVAT ? ' · EVAT' : '');
            statutEl.className = 'contact-fiche-statut ' + st;
        } else if (contact.lastSeen) {
            statutEl.textContent = formaterVuLe(contact.lastSeen);
            statutEl.className = 'contact-fiche-statut hors_ligne';
        } else {
            statutEl.textContent = 'Contact téléphone';
            statutEl.className = 'contact-fiche-statut hors_ligne';
        }
    }

    set('contactFicheMetier', [contact.metier, contact.entreprise].filter(Boolean).join(' · '));
    showBlock('contactFicheEntrepriseBlock', !!contact.entreprise);
    set('contactFicheEntreprise', contact.entreprise || '');
    showBlock('contactFicheAdresseBlock', !!contact.adresse);
    set('contactFicheAdresse', contact.adresse || '');
    showBlock('contactFicheNotesBlock', !!contact.notes);
    set('contactFicheNotes', contact.notes || '');

    rendreFicheTelephones(contact);
    rendreFicheEmails(contact);
    rendreFicheHistorique(contact);
    majInvitationFiche(contact);

    document.querySelectorAll('.cf-histo-filtres .cf-chip').forEach(ch => {
        ch.classList.toggle('active', ch.getAttribute('data-hf') === 'tous');
    });

    fiche.removeAttribute('hidden');
    fiche.setAttribute('aria-hidden', 'false');
    document.body.classList.add('fiche-contact-ouverte');
}

function rendreFicheTelephones(c) {
    const box = document.getElementById('contactFicheTels');
    if (!box) return;
    const tels = telephonesDuContact(c);
    if (!tels.length) {
        box.innerHTML = '<div class="cf-empty">Aucun numéro</div>';
        return;
    }
    box.innerHTML = tels.map((t, i) => `
        <div class="cf-line">
            <button type="button" class="cf-value-btn" data-call-tel="${escapeHtml(t)}">${escapeHtml(t)}${i === 0 ? ' <span class="cf-tag">principal</span>' : ''}</button>
            <button type="button" class="cf-ico-btn" data-copy-tel="${escapeHtml(t)}" title="Copier">📋</button>
            ${tels.length > 1 ? `<button type="button" class="cf-ico-btn" data-del-tel="${escapeHtml(t)}" title="Retirer">✕</button>` : ''}
        </div>`).join('');
}

function rendreFicheEmails(c) {
    const box = document.getElementById('contactFicheEmails');
    if (!box) return;
    const mails = emailsDuContact(c);
    if (!mails.length) {
        box.innerHTML = '<div class="cf-empty">Aucun e-mail — ajoutez-en un ci-dessous</div>';
        return;
    }
    box.innerHTML = mails.map((m, i) => `
        <div class="cf-line">
            <button type="button" class="cf-value-btn" data-mail="${escapeHtml(m)}">${escapeHtml(m)}${i === 0 ? ' <span class="cf-tag">principal</span>' : ''}</button>
            <button type="button" class="cf-ico-btn" data-del-mail="${escapeHtml(m)}" title="Retirer">✕</button>
        </div>`).join('');
}

function dureeTexteSafe(s) {
    if (typeof dureeTexte === 'function') return dureeTexte(s);
    s = Number(s) || 0;
    if (s < 60) return s + 's';
    return Math.floor(s / 60) + ' min';
}

function heureCourteSafe(ts) {
    if (typeof heureCourte === 'function') return heureCourte(ts);
    try { return new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return ''; }
}

function rendreFicheHistorique(c) {
    const box = document.getElementById('contactFicheHisto');
    if (!box) return;
    let liste = historiqueAppelsContact(c);
    const f = _ficheHistoFiltre || 'tous';
    if (f === 'in') liste = liste.filter(e => e.dir === 'in');
    else if (f === 'out') liste = liste.filter(e => e.dir === 'out');
    else if (f === 'manque') liste = liste.filter(e => e.statut === 'manque');

    if (!liste.length) {
        box.innerHTML = '<div class="cf-empty">Aucun appel avec ce contact pour le moment.</div>';
        return;
    }
    box.innerHTML = liste.slice(0, 40).map(e => {
        const manque = e.statut === 'manque';
        const fleche = e.dir === 'out' ? '↗' : '↘';
        const lib = (typeof LIBELLES_APPEL !== 'undefined' && LIBELLES_APPEL[e.statut]) ? LIBELLES_APPEL[e.statut] : (e.statut || '');
        const sous = [lib, e.type === 'video' ? 'Vidéo' : 'Audio', heureCourteSafe(e.ts), e.duree ? dureeTexteSafe(e.duree) : ''].filter(Boolean).join(' · ');
        return `<div class="cf-histo-item ${manque ? 'manque' : ''} ${e.dir}">
            <span class="cf-histo-dir">${fleche}</span>
            <div class="cf-histo-body">
                <strong>${e.dir === 'out' ? 'Sortant' : 'Reçu'}${manque ? ' · manqué' : ''}</strong>
                <span>${escapeHtml(sous)}</span>
            </div>
            <button type="button" class="cf-ico-btn" data-rappel="${escapeHtml(e.peer)}" title="Rappeler">📞</button>
        </div>`;
    }).join('');
}

function sauverContactFicheCourant(patch) {
    if (_ficheContactIndex < 0 || !utilisateur) return null;
    const cur = utilisateur.contacts[_ficheContactIndex];
    if (!cur) return null;
    utilisateur.contacts[_ficheContactIndex] = normaliserContact(Object.assign({}, cur, patch || {}));
    sauverProfil();
    return utilisateur.contacts[_ficheContactIndex];
}

function ajouterNumeroContactFiche() {
    const c = ficheContactCourant();
    if (!c) return;
    const brut = prompt('Nouveau numéro (avec indicatif, ex. +228…) :', '');
    if (brut === null) return;
    const tel = normaliserTel(brut);
    if (!telEstValideClient(tel)) { alert('Numéro invalide.'); return; }
    const tels = telephonesDuContact(c);
    if (tels.includes(tel)) { alert('Ce numéro est déjà sur la fiche.'); return; }
    tels.push(tel);
    const updated = sauverContactFicheCourant({ telephones: tels, telephone: tels[0] });
    if (updated) { rendreFicheTelephones(updated); afficherContacts(); }
}

function ajouterEmailContactFiche() {
    const c = ficheContactCourant();
    if (!c) return;
    const brut = prompt('Adresse e-mail :', '');
    if (brut === null) return;
    const mail = String(brut || '').trim();
    if (!mail || !mail.includes('@')) { alert('E-mail invalide.'); return; }
    const mails = emailsDuContact(c);
    if (mails.includes(mail)) { alert('Cet e-mail est déjà sur la fiche.'); return; }
    mails.push(mail);
    const updated = sauverContactFicheCourant({ emails: mails, email: mails[0] });
    if (updated) { rendreFicheEmails(updated); }
}

function retirerEmailContactFiche(mail) {
    const c = ficheContactCourant();
    if (!c) return;
    const mails = emailsDuContact(c).filter(m => m !== mail);
    const updated = sauverContactFicheCourant({ emails: mails, email: mails[0] || '' });
    if (updated) rendreFicheEmails(updated);
}

function retirerTelContactFiche(tel) {
    const c = ficheContactCourant();
    if (!c) return;
    const tels = telephonesDuContact(c).filter(t => t !== tel);
    if (!tels.length) { alert('Il faut garder au moins un numéro.'); return; }
    const updated = sauverContactFicheCourant({ telephones: tels, telephone: tels[0] });
    if (updated) { rendreFicheTelephones(updated); afficherContacts(); }
}

function fermerFicheContact() {
    const fiche = document.getElementById('contactFiche');
    if (fiche) {
        fiche.setAttribute('hidden', '');
        fiche.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('fiche-contact-ouverte');
    _ficheContactIndex = -1;
}

function ficheContactCourant() {
    if (_ficheContactIndex < 0 || !utilisateur || !utilisateur.contacts) return null;
    return utilisateur.contacts[_ficheContactIndex] || null;
}

function initFicheContactUI() {
    const back = document.getElementById('contactFicheBack');
    if (back) back.onclick = () => fermerFicheContact();
    const call = document.getElementById('contactFicheCall');
    if (call) call.onclick = () => { const c = ficheContactCourant(); if (c) lancerAppelDirectPeer('audio', c.telephone); };
    const vcall = document.getElementById('contactFicheVCall');
    if (vcall) vcall.onclick = () => { const c = ficheContactCourant(); if (c) lancerAppelDirectPeer('video', c.telephone); };
    const msg = document.getElementById('contactFicheMsg');
    if (msg) msg.onclick = () => { const c = ficheContactCourant(); if (c) { fermerFicheContact(); ouvrirMessagerie(c.telephone); } };
    const sms = document.getElementById('contactFicheSms');
    if (sms) sms.onclick = () => { const c = ficheContactCourant(); if (c) { try { window.location.href = 'sms:' + encodeURIComponent(c.telephone); } catch (e) {} } };
    const copy = document.getElementById('contactFicheCopy');
    if (copy) copy.onclick = () => { const c = ficheContactCourant(); if (c) copierTexteContact(c.telephone, 'Numéro copié'); };
    const addTel = document.getElementById('contactFicheAddTel');
    if (addTel) addTel.onclick = () => ajouterNumeroContactFiche();
    const addEmail = document.getElementById('contactFicheAddEmail');
    if (addEmail) addEmail.onclick = () => ajouterEmailContactFiche();
    const share = document.getElementById('contactFicheShare');
    if (share) share.onclick = () => { const c = ficheContactCourant(); if (c) partagerContact(c); };
    const edit = document.getElementById('contactFicheEdit');
    if (edit) edit.onclick = () => {
        if (_ficheContactIndex < 0) return;
        modifierContact(_ficheContactIndex);
        if (_ficheContactIndex >= 0) ouvrirFicheContact(_ficheContactIndex);
    };
    const del = document.getElementById('contactFicheDel');
    if (del) del.onclick = () => {
        if (_ficheContactIndex < 0) return;
        const i = _ficheContactIndex;
        fermerFicheContact();
        supprimerContact(i);
    };

    // Délégation : numéros, mails, historique, filtres
    const fiche = document.getElementById('contactFiche');
    if (fiche && !fiche._bound) {
        fiche._bound = true;
        fiche.addEventListener('click', (e) => {
            const t = e.target.closest('[data-call-tel],[data-copy-tel],[data-del-tel],[data-mail],[data-del-mail],[data-rappel],[data-hf]');
            if (!t) return;
            if (t.hasAttribute('data-call-tel')) {
                lancerAppelDirectPeer('audio', t.getAttribute('data-call-tel'));
            } else if (t.hasAttribute('data-copy-tel')) {
                copierTexteContact(t.getAttribute('data-copy-tel'), 'Numéro copié');
            } else if (t.hasAttribute('data-del-tel')) {
                retirerTelContactFiche(t.getAttribute('data-del-tel'));
            } else if (t.hasAttribute('data-mail')) {
                try { window.location.href = 'mailto:' + encodeURIComponent(t.getAttribute('data-mail')); } catch (err) {}
            } else if (t.hasAttribute('data-del-mail')) {
                retirerEmailContactFiche(t.getAttribute('data-del-mail'));
            } else if (t.hasAttribute('data-rappel')) {
                lancerAppelDirectPeer('audio', t.getAttribute('data-rappel'));
            } else if (t.hasAttribute('data-hf')) {
                _ficheHistoFiltre = t.getAttribute('data-hf') || 'tous';
                fiche.querySelectorAll('.cf-histo-filtres .cf-chip').forEach(ch => {
                    ch.classList.toggle('active', ch.getAttribute('data-hf') === _ficheHistoFiltre);
                });
                const c = ficheContactCourant();
                if (c) rendreFicheHistorique(c);
            }
        });
    }
}


document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('#listeContactsContainer [data-act]');
    if (!b || !utilisateur) return;
    const index = Number(b.dataset.i);
    const c = utilisateur.contacts[index];
    if (!c) return;
    if (b.dataset.act === 'open-fiche') ouvrirFicheContact(index);
});

// Init fiche + fermer avec touche Retour navigateur
document.addEventListener('DOMContentLoaded', () => {
    initFicheContactUI();
});
if (document.readyState !== 'loading') {
    try { initFicheContactUI(); } catch (e) {}
}
window.addEventListener('popstate', () => {
    if (document.body.classList.contains('fiche-contact-ouverte')) {
        fermerFicheContact();
    }
});

function copierTexteContact(texte, okMsg) {
    const t = String(texte || '');
    if (!t) return;
    const fin = () => montrerNotification(okMsg || 'Copié');
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t).then(fin).catch(() => {
            try {
                const ta = document.createElement('textarea');
                ta.value = t; document.body.appendChild(ta); ta.select();
                document.execCommand('copy'); ta.remove(); fin();
            } catch (e) { alert(t); }
        });
    } else {
        try {
            const ta = document.createElement('textarea');
            ta.value = t; document.body.appendChild(ta); ta.select();
            document.execCommand('copy'); ta.remove(); fin();
        } catch (e) { alert(t); }
    }
}

async function partagerContact(c) {
    const lignes = [c.nom, c.telephone, c.email ? 'E-mail : ' + c.email : '', c.entreprise ? 'Entreprise : ' + c.entreprise : '', c.metier ? 'Métier : ' + c.metier : ''].filter(Boolean).join('\\n');
    try {
        if (navigator.share) { await navigator.share({ title: c.nom, text: lignes }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    copierTexteContact(lignes, 'Fiche contact copiée');
}

function ajouterNouveauContact() {
    if (!utilisateur) { alert('Connectez-vous d’abord.'); return; }
    const nom = (document.getElementById('nouveauNomContact').value || '').trim();
    const tel = normaliserTel(document.getElementById('nouveauTelContact').value);
    const email = ((document.getElementById('nouveauEmailContact') || {}).value || '').trim();
    const entreprise = ((document.getElementById('nouveauEntrepriseContact') || {}).value || '').trim();
    const metier = ((document.getElementById('nouveauMetierContact') || {}).value || '').trim();
    const notes = ((document.getElementById('nouveauNotesContact') || {}).value || '').trim();
    if (!nom || !tel) { alert('Nom et numéro obligatoires.'); return; }
    if (!telEstValideClient(tel)) { alert('Numéro invalide. Entrez l’indicatif du pays puis le numéro (ex : +228 90 12 34 56).'); return; }
    if (email && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) { alert('E-mail invalide.'); return; }
    if (!utilisateur.contacts) utilisateur.contacts = [];
    if (utilisateur.contacts.some(c => c.telephone === tel)) { alert('Ce numéro est déjà dans vos contacts.'); return; }
    utilisateur.contacts.push(normaliserContact({ nom, telephone: tel, email, entreprise, metier, notes, source: 'manual' }));
    sauverProfil();
    ['nouveauNomContact', 'nouveauTelContact', 'nouveauEmailContact', 'nouveauEntrepriseContact', 'nouveauMetierContact', 'nouveauNotesContact']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    afficherContacts();
    verifierEtSynchroniserContacts();
    montrerNotification(`✅ Contact ${nom} enregistré`);
}

function modifierContact(index) {
    const c = utilisateur.contacts[index];
    if (!c) return;
    const nouveauNom = prompt('Nom :', c.nom); if (nouveauNom === null) return;
    const nouveauTelBrut = prompt('Numéro :', c.telephone); if (nouveauTelBrut === null) return;
    const nouveauTel = normaliserTel(nouveauTelBrut);
    if (!telEstValideClient(nouveauTel)) { alert('Numéro invalide.'); return; }
    const email = prompt('E-mail :', c.email || ''); if (email === null) return;
    const entreprise = prompt('Entreprise :', c.entreprise || ''); if (entreprise === null) return;
    const metier = prompt('Métier / fonction :', c.metier || ''); if (metier === null) return;
    const notes = prompt('Notes :', c.notes || ''); if (notes === null) return;
    utilisateur.contacts[index] = normaliserContact({
        ...c, nom: nouveauNom.trim() || c.nom, telephone: nouveauTel,
        email: email.trim(), entreprise: entreprise.trim(), metier: metier.trim(), notes: notes.trim(),
        source: c.source || 'manual'
    });
    sauverProfil();
    afficherContacts();
    verifierEtSynchroniserContacts();
}

function supprimerContact(index) {
    if (confirm('Supprimer ce contact ?')) {
        utilisateur.contacts.splice(index, 1);
        sauverProfil();
        afficherContacts();
        majCompteurContactsEnLigne();
    }
}

function ecrireAuContact(nom, tel) { ouvrirMessagerie(tel); }

function contactsPickerDispo() {
    return NATIF || !!(navigator.contacts && typeof navigator.contacts.select === 'function');
}

function proposerRestaurationCloud() {
    if (!utilisateur || !socket.connected) return;
    if ((utilisateur.contacts || []).length > 0) return;
    socket.emit('contacts_restore', null, (res) => {
        if (!res || !res.ok || !Array.isArray(res.contacts) || !res.contacts.length) return;
        if (confirm('Des contacts sauvegardés (' + res.contacts.length + ') existent pour ce numéro.\nLes restaurer maintenant ?')) {
            restaurerContactsCloud();
        }
    });
}

/** Appli native : lecture directe de tout le carnet d'adresses (une seule autorisation), puis mise à jour toutes les 12 h */
async function lireContactsNatifs() {
    const C = plugNatif('Contacts');
    if (!C) throw Object.assign(new Error('Module contacts absent'), { name: 'NotSupportedError' });
    let perm = await C.checkPermissions();
    if (!perm || perm.contacts !== 'granted') perm = await C.requestPermissions();
    if (!perm || perm.contacts !== 'granted') throw Object.assign(new Error('Permission refusée'), { name: 'NotAllowedError' });
    const res = await C.getContacts({ projection: { name: true, phones: true, emails: true } });
    return (res.contacts || []).map(c => ({
        name: [(c.name && (c.name.display || [c.name.given, c.name.family].filter(Boolean).join(' '))) || ''],
        tel: (c.phones || []).map(p => p.number).filter(Boolean),
        email: (c.emails || []).map(e => e.address).filter(Boolean)
    }));
}

function proposerImportContactsApresInscription() {
    if (!utilisateur) return;
    if (NATIF) {
        const dernier = parseInt(localStorage.getItem('evat_contacts_last'), 10) || 0;
        if (Date.now() - dernier < 12 * 3600 * 1000) return;
        importerContactsTelephone();
        return;
    }
    if (!contactsPickerDispo()) return;
    if (localStorage.getItem('evat_contacts_import_ok') === '1') return;
    if (Date.now() < (parseInt(localStorage.getItem('evat_contacts_import_later'), 10) || 0)) return;
    afficherInvitationImportContacts();
}

// Fenêtre propre à l'appli : le bouton déclenche directement le sélecteur de contacts
// (Chrome exige un vrai toucher de l'utilisateur ; un confirm() le faisait échouer).
function afficherInvitationImportContacts() {
    if (document.getElementById('invitImportContacts')) return;
    const fond = document.createElement('div');
    fond.id = 'invitImportContacts';
    fond.setAttribute('role', 'dialog');
    fond.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.65);padding:20px;';
    fond.innerHTML =
        '<div style="background:#fff;color:#111;border-radius:18px;padding:22px;max-width:360px;width:100%;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.4);">' +
        '<div style="font-size:42px;">📇</div>' +
        '<h3 style="margin:8px 0;color:#111;">Retrouvez vos contacts sur EVAT</h3>' +
        '<p style="font-size:14px;line-height:1.45;margin:0 0 14px;color:#333;">Importez les contacts de votre téléphone : EVAT montre tout de suite lesquels sont déjà sur l’application, pour les appeler ou leur écrire.<br><br><b>Astuce :</b> dans la liste Android, touchez « Tout sélectionner » puis « Terminé ».</p>' +
        '<button type="button" id="btnInvitImporter" style="width:100%;padding:14px;border:0;border-radius:12px;background:#16a34a;color:#fff;font-size:16px;font-weight:700;">📥 Importer mes contacts</button>' +
        '<button type="button" id="btnInvitPlusTard" style="width:100%;padding:10px;margin-top:8px;border:0;background:transparent;color:#555;font-size:14px;">Plus tard</button>' +
        '<button type="button" id="btnInvitJamais" style="width:100%;padding:6px;border:0;background:transparent;color:#999;font-size:12px;">Ne plus demander</button>' +
        '</div>';
    document.body.appendChild(fond);
    const fermer = () => fond.remove();
    document.getElementById('btnInvitImporter').onclick = () => { fermer(); importerContactsTelephone(); };
    document.getElementById('btnInvitPlusTard').onclick = () => { localStorage.setItem('evat_contacts_import_later', String(Date.now() + 3 * 86400000)); fermer(); };
    document.getElementById('btnInvitJamais').onclick = () => { localStorage.setItem('evat_contacts_import_ok', '1'); fermer(); };
}

async function importerContactsTelephone() {
    const status = document.getElementById('contactImportStatus');
    const setStatus = (t) => { if (status) status.textContent = t || ''; };
    if (!utilisateur) { alert('Connectez-vous d’abord.'); return; }
    if (!contactsPickerDispo()) {
        setStatus('Import auto non supporté sur ce navigateur. Utilisez Chrome Android, ou ajoutez manuellement.');
        alert('L’import des contacts du téléphone n’est pas disponible ici.\n\nSur Android : ouvrez EVAT dans Chrome, puis réessayez.');
        return;
    }
    try {
        setStatus('Ouverture de vos contacts…');
        const props = ['name', 'tel'];
        try {
            const supported = await navigator.contacts.getProperties();
            if (supported.includes('email')) props.push('email');
            if (supported.includes('address')) props.push('address');
        } catch (e) { props.push('email'); }
        const picked = NATIF ? await lireContactsNatifs() : await navigator.contacts.select(props, { multiple: true });
        if (!picked || !picked.length) { setStatus('Aucun contact sélectionné.'); return; }
        if (!utilisateur.contacts) utilisateur.contacts = [];
        let ajoutes = 0, ignores = 0, maj = 0;
        picked.forEach(p => {
            const noms = (p.name && (Array.isArray(p.name) ? p.name[0] : p.name)) || '';
            const tels = [].concat(p.tel || []).map(t => normaliserTel(t)).filter(telEstValideClient);
            const emails = [].concat(p.email || []).map(e => String(e || '').trim()).filter(e => e && e.includes('@'));
            const addr = [].concat(p.address || []).map(a => {
                if (typeof a === 'string') return a;
                return [a.addressLine, a.city, a.country].flat().filter(Boolean).join(', ');
            }).filter(Boolean);
            if (!tels.length) { ignores++; return; }
            tels.forEach(tel => {
                if (tel === utilisateur.telephone) { ignores++; return; }
                const exist = utilisateur.contacts.find(c => c.telephone === tel);
                const data = normaliserContact({
                    nom: String(noms).trim() || tel, telephone: tel,
                    telephones: exist ? telephonesDuContact(exist).concat([tel]) : [tel],
                    email: emails[0] || (exist && exist.email) || '',
                    emails: emails.length ? emails : (exist ? emailsDuContact(exist) : []),
                    adresse: addr[0] || (exist && exist.adresse) || '',
                    metier: (exist && exist.metier) || '', entreprise: (exist && exist.entreprise) || '',
                    notes: (exist && exist.notes) || '', source: 'phone',
                    online: exist && exist.online, surEVAT: exist && exist.surEVAT
                });
                if (exist) { Object.assign(exist, data); maj++; }
                else { utilisateur.contacts.push(data); ajoutes++; }
            });
        });
        sauverProfil();
        afficherContacts();
        verifierEtSynchroniserContacts();
        localStorage.setItem('evat_contacts_import_ok', '1');
        localStorage.setItem('evat_contacts_last', String(Date.now()));
        const resume = `✅ Import terminé : ${ajoutes} ajouté(s), ${maj} mis à jour, ${ignores} ignoré(s).`;
        setStatus(resume);
        if (!NATIF || ajoutes > 0) montrerNotification(resume);
    } catch (e) {
        if (e && e.name === 'AbortError') { setStatus('Import annulé.'); return; }
        if (NATIF) {
            localStorage.setItem('evat_contacts_last', String(Date.now()));   // pas de relance à chaque ouverture
            setStatus('Import impossible : ' + ((e && e.message) || 'erreur'));
            if (e && e.name === 'NotAllowedError') montrerNotification('📇 Autorisez l’accès aux contacts dans les réglages Android pour retrouver vos amis sur EVAT.');
            return;
        }
        setStatus('Import impossible : ' + ((e && e.message) || 'erreur'));
        alert('Impossible d’importer les contacts. Autorisez l’accès aux contacts pour Chrome/EVAT.');
    }
}

function syncContactsEVAT() {
    verifierEtSynchroniserContacts();
    montrerNotification('🔄 Statut des contacts EVAT actualisé');
}

// ---------- IA : voir module « Deux IA » plus bas ----------

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
                `Bonjour ! ${onlineCount} de vos contacts sont en ligne. Que souhaitez-vous ?`
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
                `Votre annuaire contient ${utilisateur.contacts ? utilisateur.contacts.length : 0} contacts. ${onlineCount} de vos contacts sont en ligne. Allez dans l'onglet Contacts pour les gérer.`,
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
                `Actuellement ${onlineCount} de vos contacts ${onlineCount > 1 ? 'sont' : 'est'} en ligne.`,
                `Parmi vos contacts, ${onlineCount} présence(s) active(s). Seuls vos contacts voient votre statut.`
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
    if (tabId === 'elaws-ia') rendreIA('general');
    if (tabId === 'ia-metier') rendreIA('metier');
    if (tabId === 'appels') { rendreJournalAppels(); marquerAppelsVus(); }
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
let sysRingTimer = null;

/* ---------- Utilitaires ---------- */
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

        if (type === 'telephone' && notificationsPretes()) {
            demarrerSonnerieTelephone();
        } else if (type === 'custom' && p.customRingtoneBase64) {
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

function notificationsPretes() {
    return 'Notification' in window && Notification.permission === 'granted' && 'serviceWorker' in navigator;
}

/** « Sonnerie du téléphone » : une notification d'appel est ré-affichée toutes les 4,5 s, donc le téléphone joue
    lui-même son propre son (réglable dans Réglages → Applications → EVAT → Notifications). */
async function demarrerSonnerieTelephone() {
    try {
        const reg = await navigator.serviceWorker.ready;
        const nom = nomPourTel(Call.peer);
        const video = Call.type === 'video';
        const alerter = () => reg.showNotification(video ? '📹 Appel vidéo EVAT' : '📞 Appel EVAT', {
            body: nom + ' vous appelle', tag: 'evat-call', renotify: true, requireInteraction: true,
            vibrate: [600, 250, 600, 250, 600], icon: 'icon-192.png', badge: 'icon-192.png', silent: false
        }).catch(() => {});
        alerter();
        clearInterval(sysRingTimer);
        sysRingTimer = setInterval(() => { if (Call.state === 'ringing') alerter(); else { clearInterval(sysRingTimer); sysRingTimer = null; } }, 4500);
    } catch (e) {}
}

function arreterSonSonnerie(garderTimers) {
    if (sysRingTimer) { clearInterval(sysRingTimer); sysRingTimer = null; }
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
function chargerIce(force) {
    if (!force && Call.ice && Date.now() - Call.iceAt < 15 * 60 * 1000) return Promise.resolve(Call.ice);
    return new Promise(resolve => {
        const fin = (servers, meta) => {
            Call.ice = servers && servers.length ? servers : STUN_SECOURS;
            Call.iceAt = Date.now();
            Call.iceMeta = meta || {};
            resolve(Call.ice);
        };
        const garde = setTimeout(() => fin(STUN_SECOURS, { timeout: true }), 4000);
        try {
            if (!socket.connected) { clearTimeout(garde); fin(STUN_SECOURS, { offline: true }); return; }
            socket.emit('get_ice', null, res => {
                clearTimeout(garde);
                const list = res && Array.isArray(res.iceServers) && res.iceServers.length ? res.iceServers : STUN_SECOURS;
                fin(list, { turn: res && res.turn, hasTurn: !!(res && res.hasTurn) });
            });
        } catch (e) {
            clearTimeout(garde);
            fin(STUN_SECOURS, { error: true });
        }
    });
}
// Précharge les serveurs ICE pour que l'appel démarre sans attente
socket.on('connect', () => { Call.iceAt = 0; setTimeout(() => chargerIce(), 800); });

/* ---------- Médias ---------- */
async function obtenirMedia(type) {
    // Contexte sécurisé obligatoire (HTTPS ou localhost)
    if (typeof window.isSecureContext === 'boolean' && !window.isSecureContext) {
        const err = new Error('Contexte non sécurisé');
        err.name = 'SecurityError';
        throw err;
    }
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        const err = new Error('getUserMedia indisponible');
        err.name = 'NotSupportedError';
        throw err;
    }

    // Libérer d’éventuels flux locaux bloqués (appel précédent / vocal non stoppé)
    try {
        if (Call && Call.local) {
            Call.local.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
            Call.local = null;
        }
    } catch (e) {}

    const estVideo = type === 'video';
    // Du plus simple au plus exigeant : Android Chrome refuse souvent les contraintes « avancées » en premier
    const essais = estVideo
        ? [
            { audio: true, video: true },
            { audio: true, video: { facingMode: 'user' } },
            { audio: true, video: { facingMode: { ideal: 'user' }, width: { ideal: 640 }, height: { ideal: 480 } } },
            { audio: true, video: false }
          ]
        : [
            { audio: true },
            { audio: true, video: false },
            { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } },
            { audio: { echoCancellation: true } }
          ];

    let dernier = null;
    for (let i = 0; i < essais.length; i++) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia(essais[i]);
            if (estVideo && !stream.getVideoTracks().length) {
                if (typeof Call !== 'undefined') Call.type = 'audio';
                try { setStatutAppel('🎙️ Caméra indisponible — appel vocal'); } catch (e) {}
            }
            if (!stream.getAudioTracks().length) {
                stream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
                dernier = Object.assign(new Error('Aucun micro'), { name: 'NotFoundError' });
                continue;
            }
            // S’assurer que les pistes sont actives
            stream.getTracks().forEach(t => { try { t.enabled = true; } catch (e) {} });
            return stream;
        } catch (e) {
            dernier = e;
            const n = e && e.name;
            // Permission refusée ou sécurité : arrêt immédiat
            if (n === 'NotAllowedError' || n === 'PermissionDeniedError' || n === 'SecurityError') throw e;
            // sinon on tente la contrainte suivante
        }
    }
    throw dernier || Object.assign(new Error('Micro inaccessible'), { name: 'NotReadableError' });
}

function messageErreurMedia(e) {
    const nom = (e && e.name) || '';
    const detail = (e && (e.message || e.constraint)) ? String(e.message || e.constraint).slice(0, 80) : '';
    if (nom === 'NotAllowedError' || nom === 'PermissionDeniedError') {
        return '❌ Micro refusé par le téléphone.\n\nAndroid : Réglages → Applications → Chrome (ou EVAT) → Autorisations → Microphone → Autoriser.\nPuis fermez complètement l’app et rouvrez-la.';
    }
    if (nom === 'NotFoundError' || nom === 'DevicesNotFoundError') {
        return '❌ Aucun micro détecté. Vérifiez qu’aucun casque Bluetooth déconnecté ne bloque le micro.';
    }
    if (nom === 'NotReadableError' || nom === 'TrackStartError' || nom === 'AbortError') {
        return '❌ Micro déjà utilisé (WhatsApp, Camera, enregistreur…).\nFermez les autres apps, attendez 2 secondes, réessayez.';
    }
    if (nom === 'OverconstrainedError' || nom === 'ConstraintNotSatisfiedError') {
        return '❌ Réglages micro incompatibles avec cet appareil. Réessayez (mode simple activé).';
    }
    if (nom === 'SecurityError') {
        return '❌ Accès micro bloqué : ouvrez EVAT en HTTPS (site sécurisé) ou via l’icône installée sur l’écran d’accueil.';
    }
    if (nom === 'NotSupportedError' || nom === 'TypeError') {
        return '❌ Ce navigateur ne permet pas le micro. Utilisez Chrome à jour, en HTTPS.';
    }
    return '❌ Impossible d’activer le micro' + (detail ? ' (' + detail + ')' : '') + '.\n\n1) Autorisez le Micro pour Chrome/EVAT\n2) Fermez WhatsApp et autres apps audio\n3) Rouvrez EVAT et réessayez.';
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
    if (ra) {
        ra.srcObject = Call.remote;
        ra.autoplay = true;
        ra.setAttribute('playsinline', '');
        try { ra.volume = 1; } catch (e) {}
        const p = ra.play();
        if (p && p.catch) p.catch(() => debloquerSonDistant());
        appliquerHautParleur();
    }
    if (rv) {
        rv.muted = true;   // le son passe uniquement par #remoteAudio (évite le son doublé en vidéo)
        rv.srcObject = Call.type === 'video' ? Call.remote : null;
        rv.style.display = Call.type === 'video' ? 'block' : 'none';
        if (Call.type === 'video' && rv.play) rv.play().catch(() => {});
    }
}

/* ---------- Améliorations appels (v4.12) ---------- */
// Son distant bloqué par le navigateur (autoplay) : un seul toucher le débloque
function debloquerSonDistant() {
    if (Call._debloquage) return;
    Call._debloquage = true;
    setStatutAppel('🔇 Touchez l’écran pour activer le son');
    const evts = ['pointerdown', 'touchstart', 'keydown'];
    const retry = () => {
        evts.forEach(e => document.removeEventListener(e, retry, true));
        Call._debloquage = false;
        ['remoteAudio', 'remoteVideo'].forEach(id => {
            const el = document.getElementById(id);
            if (el && el.srcObject && el.play) el.play().catch(() => {});
        });
    };
    evts.forEach(e => document.addEventListener(e, retry, true));
}

// Opus réglé pour les réseaux mobiles : correction d'erreurs, silence économe, 32 kb/s, mono
function ameliorerSdpOpus(sdp) {
    try {
        const m = sdp && sdp.match(/a=rtpmap:(\d+) opus\/48000\/2/);
        if (!m) return sdp;
        const pt = m[1];
        const voulus = ['minptime=10', 'useinbandfec=1', 'usedtx=1', 'maxaveragebitrate=32000', 'stereo=0', 'sprop-stereo=0'];
        const re = new RegExp('a=fmtp:' + pt + ' ([^\\r\\n]*)');
        if (re.test(sdp)) {
            return sdp.replace(re, (all, old) => {
                const garde = old.split(';').map(x => x.trim()).filter(x => x && !/^(minptime|useinbandfec|usedtx|maxaveragebitrate|stereo|sprop-stereo)=/.test(x));
                return 'a=fmtp:' + pt + ' ' + garde.concat(voulus).join(';');
            });
        }
        return sdp.replace(m[0], m[0] + '\r\na=fmtp:' + pt + ' ' + voulus.join(';'));
    } catch (e) { return sdp; }
}

// Qualité de la liaison (mesurée toutes les 4 s) + débit vidéo adapté
let _qualTimer = null, _qualPrev = null;
const LIBELLE_QUALITE = { bonne: '📶 Bonne', moyenne: '📶 Moyenne', faible: '⚠️ Faible' };
const DEBIT_VIDEO = { bonne: 700000, moyenne: 350000, faible: 150000 };

function arreterSurveillanceQualite() {
    if (_qualTimer) { clearInterval(_qualTimer); _qualTimer = null; }
    _qualPrev = null;
}

function adapterDebitVideo(niveau) {
    const cible = DEBIT_VIDEO[niveau];
    if (!cible || Call._debitVideo === cible || !Call.pc) return;
    Call._debitVideo = cible;
    try {
        Call.pc.getSenders().forEach(snd => {
            if (snd.track && snd.track.kind === 'video') {
                const par = snd.getParameters();
                if (!par.encodings || !par.encodings.length) par.encodings = [{}];
                par.encodings[0].maxBitrate = cible;
                snd.setParameters(par).catch(() => {});
            }
        });
    } catch (e) {}
}

function demarrerSurveillanceQualite() {
    arreterSurveillanceQualite();
    _qualTimer = setInterval(async () => {
        const pc = Call.pc;
        if (!pc || Call.state !== 'connected') return;
        try {
            const stats = await pc.getStats();
            let lost = 0, recv = 0, rtt = null;
            stats.forEach(r => {
                if (r.type === 'inbound-rtp' && !r.isRemote) { lost += Math.max(0, r.packetsLost || 0); recv += r.packetsReceived || 0; }
                if (r.type === 'candidate-pair' && r.state === 'succeeded' && (r.nominated || r.selected) && typeof r.currentRoundTripTime === 'number') rtt = r.currentRoundTripTime;
            });
            let perte = 0;
            if (_qualPrev) {
                const dl = lost - _qualPrev.lost, dr = recv - _qualPrev.recv;
                if (dl + dr > 0) perte = dl / (dl + dr);
            }
            _qualPrev = { lost, recv };
            let niveau = 'bonne';
            if (perte > 0.15 || (rtt !== null && rtt > 1)) niveau = 'faible';
            else if (perte > 0.05 || (rtt !== null && rtt > 0.4)) niveau = 'moyenne';
            Call.qualite = niveau;
            adapterDebitVideo(niveau);
        } catch (e) {}
    }, 4000);
}

// Changement de réseau (Wi-Fi ↔ 4G) pendant un appel : reconnexion immédiate côté appelant
let _netTimer = null;
let _netType = navigator.connection && navigator.connection.type;
function surChangementReseau() {
    if (Call.state !== 'connected' && Call.state !== 'connecting') return;
    clearTimeout(_netTimer);
    _netTimer = setTimeout(() => {
        if (!Call.pc) return;
        if (Call.isCaller) { Call.restarts = 0; redemarrerIce(); }
        else setStatutAppel('🔄 Changement de réseau…');
    }, 1500);
}
window.addEventListener('online', surChangementReseau);
if (navigator.connection && navigator.connection.addEventListener) {
    navigator.connection.addEventListener('change', () => {
        const t = navigator.connection.type;
        if (t !== _netType) { _netType = t; surChangementReseau(); }
    });
}

/* ---------- PeerConnection ---------- */
async function creerPeerConnection() {
    const iceServers = await chargerIce();
    const pc = new RTCPeerConnection({ iceServers, bundlePolicy: 'max-bundle', rtcpMuxPolicy: 'require', iceCandidatePoolSize: 4, iceTransportPolicy: 'all' });

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
        if (Call._debloquage) { setStatutAppel('🔇 Touchez l’écran pour activer le son'); return; }
        setStatutAppel('✅ En ligne • ' + mm + ':' + ss + (Call.qualite ? ' • ' + LIBELLE_QUALITE[Call.qualite] : ''));
    };
    maj();
    Call.timers.tick = setInterval(maj, 1000);
    demarrerSurveillanceQualite();
}

async function redemarrerIce(force) {
    if (!Call.pc || Call.state === 'idle') return;
    if (Call.restarts >= 3) {
        terminerAppel(Call.startedAt ? '❌ Connexion perdue.' : '❌ Connexion impossible entre ces deux téléphones (réseau trop fermé). Faites « Tester ma connexion d’appel » dans Paramètres.', true, 'echec');
        return;
    }
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
        terminerAppel('❌ Connexion perdue.', true, 'echec');
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
    if (!telEstValideClient(cible)) { alert('Numéro invalide. Entrez l’indicatif du pays puis le numéro (ex : +228 90 12 34 56).'); return; }
    if (cible === utilisateur.telephone) { alert('Impossible de s’appeler soi-même !'); return; }
    if (Call.state !== 'idle') { alert('Un appel est déjà en cours.'); return; }
    if (!socket.connected) { setStatutAppel('❌ Serveur hors ligne. Réessayez dans un instant.'); return; }
    if (!navigator.mediaDevices || !window.RTCPeerConnection) { alert('Votre navigateur ne supporte pas les appels.'); return; }

    demanderPermissionNotifications();
    Object.assign(Call, {
        state: 'calling', id: nouvelIdAppel(), peer: cible, type, isCaller: true,
        pendingOffer: null, pendingCandidates: [], remote: null, restarts: 0, muted: false, camOff: false, speaker: false,
        glareOffer: null, glareCandidates: []
    });
    const idLocal = Call.id;
    afficherEcranAppel(cible);
    setStatutAppel(type === 'video' ? '🔄 Activation micro/caméra…' : '🔄 Activation du micro…');

    try {
        await chargerIce(true);
        Call.local = await obtenirMedia(type);
        if (Call.id !== idLocal) { Call.local.getTracks().forEach(t => t.stop()); return; } // annulé entre-temps

        const pc = await creerPeerConnection();
        Call.pc = pc;
        Call.local.getTracks().forEach(t => pc.addTrack(t, Call.local));
        attacherLocal();

        const offer = await pc.createOffer();
        offer.sdp = ameliorerSdpOpus(offer.sdp);
        await pc.setLocalDescription(offer);
        signaler('offer', { offer: pc.localDescription });

        setStatutAppel('📞 Appel de ' + nomPourTel(cible) + '…');
        jouerSonSonnerie('sortant');
        Call.timers.ring = setTimeout(() => {
            if (Call.state === 'calling') terminerAppel('❌ Pas de réponse.', true, 'sans_reponse');
        }, 35000);
    } catch (e) {
        if (Call.id === idLocal) {
            const msg = messageErreurMedia(e);
            terminerAppel(msg, true, 'echec');
            if (e && (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError' || e.name === 'SecurityError')) {
                try { alert(msg); } catch (err) {}
            }
        }
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
        answer.sdp = ameliorerSdpOpus(answer.sdp);
        await pc.setLocalDescription(answer);
        signaler('answer', { answer: pc.localDescription });
        setStatutAppel('🔄 Connexion avec ' + nomPourTel(Call.peer) + '…');

        Call.timers.drop = setTimeout(() => {
            if (Call.state === 'connecting') terminerAppel('❌ Connexion impossible (réseau).', true, 'echec');
        }, 20000);
    } catch (e) {
        if (Call.id === idLocal) {
            const msg = messageErreurMedia(e);
            terminerAppel(msg, true, 'echec');
            if (e && (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError' || e.name === 'SecurityError')) {
                try { alert(msg); } catch (err) {}
            }
        }
    }
}

function rejeterAppelEntrant() {
    if (Call.state !== 'ringing') { cacherModalAppelEntrant(); return; }
    signaler('reject');
    terminerAppel(null, false, 'refuse');
}

function raccrocherAppel() {
    if (Call.state === 'idle') { fermerAppelTotalLocally(); return; }
    terminerAppel('📴 Appel terminé.', true);
}

/** Termine proprement l'appel. notifier=true → prévient l'autre personne */
function terminerAppel(message, notifier, cause) {
    journaliserAppel(cause);
    if (notifier && Call.peer && Call.state !== 'idle') signaler('hangup');

    arreterSonSonnerie();
    clearTimeout(Call.timers.ring);
    clearTimeout(Call.timers.drop);
    clearInterval(Call.timers.tick);
    arreterSurveillanceQualite();
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
        pendingOffer: null, pendingCandidates: [], isCaller: false, restarts: 0, startedAt: 0,
        qualite: null, _debitVideo: 0, _debloquage: false, glareOffer: null, glareCandidates: []
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

    const bs = document.getElementById('btnSpeaker');
    if (bs) {
        bs.style.display = (Call.type === 'audio') ? 'inline-block' : 'none';
        Call.speaker = Call.type === 'audio'; // haut-parleur par défaut en vocal
        appliquerHautParleur();
    }
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

function appliquerHautParleur() {
    const ra = document.getElementById('remoteAudio');
    if (!ra) return;
    const on = !!Call.speaker;
    try {
        if (typeof ra.setSinkId === 'function') {
            // Certains navigateurs exposent les sorties ; "default" = système
            ra.setSinkId(on ? 'default' : 'default').catch(() => {});
        }
    } catch (e) {}
    try { ra.volume = 1; } catch (e) {}
    // Astuce mobile : bascule "speaker" via contrainte si dispo (peu supporté)
    if (Call.remote) {
        Call.remote.getAudioTracks().forEach(t => {
            try {
                const c = t.getConstraints ? t.getConstraints() : {};
                /* no-op si non supporté */
            } catch (e) {}
        });
    }
    const btn = document.getElementById('btnSpeaker');
    if (btn) {
        btn.classList.toggle('active', on);
        btn.textContent = on ? '🔊 HP' : '🔈 Oreille';
        btn.title = on ? 'Haut-parleur activé' : 'Mode oreillette';
    }
    // Volume max + replay pour "débloquer" l'audio après geste
    try {
        ra.muted = false;
        const p = ra.play();
        if (p && p.catch) p.catch(() => {});
    } catch (e) {}
}

function basculerHautParleur() {
    Call.speaker = !Call.speaker;
    appliquerHautParleur();
    montrerNotification(Call.speaker ? '🔊 Haut-parleur' : '🔈 Mode discret');
}
function basculerCamera() {
    if (!Call.local) return;
    Call.camOff = !Call.camOff;
    Call.local.getVideoTracks().forEach(t => { t.enabled = !Call.camOff; });
    majBoutonsAppel();
}

/** Nouvelle sonnerie entrante (appelée par la signalisation, ou après une collision d'appels) */
function recevoirOffreEntrante(data) {
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
        restarts: 0, muted: false, camOff: false, speaker: false
    });
    signaler('ringing');
    afficherModalAppelEntrant(data.sender, Call.type);
    jouerSonSonnerie('entrant');
    notifierAppelEntrant(nomPourTel(data.sender), Call.type);
    if (Date.now() - autoDecrocher < 60000) { autoDecrocher = 0; setTimeout(() => accepterAppelEntrant(), 300); }
    Call.timers.ring = setTimeout(() => {
        if (Call.state === 'ringing') {
            signaler('hangup');
            terminerAppel(null, false, 'manque');
        }
    }, 35000);

}

/** Collision d'appels : on abandonne notre appel sortant et on décroche celui de l'autre personne */
function basculerVersAppelPrioritaire() {
    const g = Call.glareOffer, cands = (Call.glareCandidates || []).slice();
    Call.state = 'idle';            // pas de journal ni de « raccroché » envoyé : cet appel sortant est simplement abandonné
    terminerAppel(null, false);
    autoDecrocher = Date.now();     // les deux voulaient se parler : on décroche tout de suite
    recevoirOffreEntrante(g);
    if (Call.id === g.callId) Call.pendingCandidates = cands;
}

/* ---------- Signalisation entrante ---------- */
socket.on('p2p_signal', async (data) => {
    if (!data || !data.type) return;
    try {
        // Nouvelle sonnerie
        if (data.type === 'offer' && !data.renegotiate) {
            if (!utilisateur) return;
            if (Call.id && data.callId === Call.id) return;        // doublon (rejeu après réouverture)
            // Collision : nous appelons déjà cette personne et elle nous appelle au même moment.
            // On garde son offre de côté : si le serveur donne la priorité à son appel, on décroche automatiquement.
            if (Call.state === 'calling' && data.sender === Call.peer) {
                Call.glareOffer = data;
                Call.glareCandidates = [];
                return;
            }
            recevoirOffreEntrante(data);
            return;
        }

        // Candidats ICE de l'appel prioritaire, reçus pendant la collision
        if (data.type === 'ice_candidate' && Call.glareOffer && data.callId === Call.glareOffer.callId) {
            if (data.candidate) Call.glareCandidates.push(data.candidate);
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
                if (Call.state === 'calling' && Call.glareOffer && Call.glareOffer.sender === Call.peer) { basculerVersAppelPrioritaire(); break; }
                terminerAppel('📵 ' + nomPourTel(Call.peer) + ' est déjà en ligne.', false, 'occupe');
                break;
            case 'user_unknown':
                terminerAppel('❌ Ce numéro n’a pas de compte EVAT (ou il n’est pas encore reconnecté). Vérifiez le numéro.', false, 'echec');
                break;
            case 'user_offline':
                terminerAppel('📵 ' + nomPourTel(Call.peer) + ' est hors ligne. Il verra l’appel manqué à sa reconnexion.', false, 'hors_ligne');
                break;
            case 'reject':
                terminerAppel('❌ Appel refusé.', false, 'refuse');
                break;
            case 'hangup':
                // L'appelant a raccroché pendant la sonnerie → appel manqué (notifié par le journal)
                terminerAppel(Call.state === 'ringing' ? null : '📴 Appel terminé par ' + nomPourTel(Call.peer) + '.', false, Call.state === 'ringing' ? 'manque' : undefined);
                break;
        }
    } catch (e) {
        console.warn('Signal appel :', e);
    }
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
    if (m.groupId) return 'group:' + m.groupId;
    if (m.to && String(m.to).startsWith('group:')) return m.to;
    if (!m.to) return 'general';
    if (m.fromMe) return m.to;
    if (m.from) return m.from;
    const c = (utilisateur.contacts || []).find(x => x.nom === m.expediteur);
    return c ? c.telephone : 'general';
}

function estCleGroupe(k) { return typeof k === 'string' && k.startsWith('group:'); }
function idGroupeDeCle(k) { return estCleGroupe(k) ? k.slice(6) : null; }

function groupesLocaux() {
    if (!utilisateur) return [];
    if (!Array.isArray(utilisateur.groupes)) utilisateur.groupes = [];
    return utilisateur.groupes;
}

const estCleService = (k) => String(k || '').startsWith('svc-');
function nomConvo(k) {
    if (k === 'general') return 'Réseau EVAT';
    if (estCleService(k)) {
        const m = (utilisateur && utilisateur.messagesLocaux || []).filter(x => x.from === k && x.expediteur).pop();
        return (m && m.expediteur) || ('🔔 ' + String(k).slice(4).charAt(0).toUpperCase() + String(k).slice(5));
    }
    if (estCleGroupe(k)) {
        const id = idGroupeDeCle(k);
        const g = groupesLocaux().find(x => x.id === id);
        return (g && g.nom) || 'Groupe';
    }
    return nomPourTel(k);
}

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
    const ba = document.getElementById('badgeAppels');
    if (ba) { const n = appelsManquesNonVus(); ba.textContent = n > 99 ? '99+' : String(n); ba.hidden = n === 0; }
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
        expediteur: msg.fromName || msg.from, from: msg.from, texte: msg.texte, image: msg.image || null, audio: msg.audio || null, audioDur: msg.audioDur || 0, groupId: msg.groupId || null, groupName: msg.groupName || null, heure: msg.heure,
        fromMe, to: msg.groupId ? ('group:' + msg.groupId) : (msg.to || null), ts: msg.timestamp,
        etat: fromMe ? (msg.read ? 'read' : (msg.delivered ? 'delivered' : 'sent')) : null
    };
    if (msg.groupId) {
        const gl = groupesLocaux();
        if (!gl.some(g => g.id === msg.groupId)) {
            gl.unshift({ id: msg.groupId, nom: msg.groupName || 'Groupe', membres: [] });
            sauverGroupesLocaux(gl);
        }
    }
    utilisateur.messagesLocaux.push(m);
    if (utilisateur.messagesLocaux.length > MAX_MESSAGES_LOCAUX) {
        utilisateur.messagesLocaux = utilisateur.messagesLocaux.slice(-MAX_MESSAGES_LOCAUX);
    }

    if (!fromMe) {
        const cle = cleConvo(m);
        const tabVisible = document.getElementById('tab-messagerie') && document.getElementById('tab-messagerie').style.display !== 'none';
        const lue = tabVisible && convoOuverte === cle && !document.hidden;
        if (lue) {
            if (cle !== 'general' && !estCleGroupe(cle)) socket.emit('mark_read', { peer: cle });
        } else {
            utilisateur.nonLus = utilisateur.nonLus || {};
            utilisateur.nonLus[cle] = (utilisateur.nonLus[cle] || 0) + 1;
            const apercuTxt = msg.audio ? '🎤 Message vocal' : (msg.image ? '📷 Photo' : (msg.texte || ''));
            const apercu = `💬 ${m.expediteur} : ${apercuTxt.slice(0, 40)}${apercuTxt.length > 40 ? '…' : ''}`;
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
function envoyerMessage(to, texte, cidExistant, imageData, audioData, audioDur) {
    if (!utilisateur) return;
    const cid = cidExistant || nouvelIdMsg();
    const isGroup = estCleGroupe(to);
    const groupId = isGroup ? idGroupeDeCle(to) : null;
    const peer = (!isGroup && to && to !== 'general') ? to : null;
    const texteFinal = (texte || '').trim() || (audioData ? '🎤 Message vocal' : (imageData ? '📷 Photo' : ''));
    if (!texteFinal && !imageData && !audioData) return;

    (utilisateur.messagesLocaux = utilisateur.messagesLocaux || []).push({
        id: cid, cid,
        expediteur: utilisateur.nom,
        from: utilisateur.telephone,
        texte: texteFinal,
        image: imageData || null,
        audio: audioData || null,
        audioDur: audioData ? (audioDur || 0) : 0,
        groupId: groupId || null,
        heure: heureCourte(Date.now()),
        ts: Date.now(),
        fromMe: true,
        to: isGroup ? ('group:' + groupId) : (peer || null),
        etat: 'pending'
    });
    if (utilisateur.messagesLocaux.length > MAX_MESSAGES_LOCAUX) {
        utilisateur.messagesLocaux = utilisateur.messagesLocaux.slice(-MAX_MESSAGES_LOCAUX);
    }
    sauverProfil();
    afficherMessagesLocaux(true);

    if (!socket.connected) {
        if (!_outbox.some(x => x.cid === cid)) _outbox.push({ to, texte: texteFinal, cid, image: imageData || null, audio: audioData || null, audioDur: audioDur || 0 });
        return;
    }
    const payload = { to: peer, texte: texteFinal, cid };
    if (groupId) payload.groupId = groupId;
    if (imageData) payload.image = imageData;
    if (audioData) { payload.audio = audioData; payload.audioDur = audioDur || 0; }
    socket.emit('send_message', payload, (res) => {
        const m = (utilisateur.messagesLocaux || []).find(x => x.cid === cid || x.id === cid);
        if (!m) return;
        if (res && res.ok) {
            m.id = res.id || m.id;
            m.etat = res.delivered ? 'delivered' : 'sent';
        } else {
            m.etat = 'failed';
            if (res && res.error) montrerNotification(res.error);
        }
        sauverProfil();
        afficherMessagesLocaux();
    });
}

function envoyerMessageChatLocal() {
    const input = document.getElementById('chatLocalInput');
    const texte = input ? input.value.trim() : '';
    const img = window._chatImageData || null;
    if (!texte && !img) return;
    if (!convoOuverte) return;
    if (input) { input.value = ''; autoResize(input); }
    annulerImageChat();
    const to = convoOuverte === 'general' ? null : convoOuverte;
    envoyerMessage(to, texte, null, img);
    arreterEcriture();
}

/* ---------- Photos compressées dans le chat ---------- */
window._chatImageData = null;

function annulerImageChat() {
    window._chatImageData = null;
    const box = document.getElementById('chatImagePreview');
    const img = document.getElementById('chatImagePreviewImg');
    const input = document.getElementById('chatImageInput');
    if (box) box.setAttribute('hidden', '');
    if (img) img.removeAttribute('src');
    if (input) input.value = '';
}

function onChatImageChoisie(ev) {
    const file = ev.target && ev.target.files && ev.target.files[0];
    if (!file) return;
    compresserImageChat(file).then(dataUrl => {
        if (!dataUrl) { alert('Impossible de préparer cette image.'); return; }
        window._chatImageData = dataUrl;
        const box = document.getElementById('chatImagePreview');
        const img = document.getElementById('chatImagePreviewImg');
        if (img) img.src = dataUrl;
        if (box) box.removeAttribute('hidden');
    }).catch(() => alert('Image trop lourde ou format non supporté.'));
}

function compresserImageChat(file) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type || !file.type.startsWith('image/')) return reject(new Error('type'));
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('read'));
        reader.onload = () => {
            const im = new Image();
            im.onload = () => {
                const maxW = 1280, maxH = 1280;
                let w = im.width, h = im.height;
                const ratio = Math.min(1, maxW / w, maxH / h);
                w = Math.round(w * ratio); h = Math.round(h * ratio);
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(im, 0, 0, w, h);
                let quality = 0.72;
                let dataUrl = canvas.toDataURL('image/jpeg', quality);
                // viser < ~220 Ko base64
                while (dataUrl.length > 220000 && quality > 0.4) {
                    quality -= 0.08;
                    dataUrl = canvas.toDataURL('image/jpeg', quality);
                }
                if (dataUrl.length > 280000) {
                    // second pass plus petit
                    canvas.width = Math.round(w * 0.7); canvas.height = Math.round(h * 0.7);
                    ctx.drawImage(im, 0, 0, canvas.width, canvas.height);
                    dataUrl = canvas.toDataURL('image/jpeg', 0.55);
                }
                resolve(dataUrl.length > 280000 ? null : dataUrl);
            };
            im.onerror = () => reject(new Error('img'));
            im.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

function ouvrirLightboxImage(src) {
    if (!src) return;
    let lb = document.getElementById('imageLightbox');
    if (!lb) {
        lb = document.createElement('div');
        lb.id = 'imageLightbox';
        lb.className = 'image-lightbox';
        lb.innerHTML = '<button type="button" class="image-lightbox-close" aria-label="Fermer">✕</button><img alt="Photo">';
        lb.addEventListener('click', (e) => {
            if (e.target === lb || e.target.classList.contains('image-lightbox-close')) lb.setAttribute('hidden', '');
        });
        document.body.appendChild(lb);
    }
    const im = lb.querySelector('img');
    if (im) im.src = src;
    lb.removeAttribute('hidden');
}


/* ---------- Messages vocaux ---------- */
function fmtDureeVocal(s) {
    s = Math.max(0, Math.round(Number(s) || 0));
    const m = Math.floor(s / 60), r = s % 60;
    return m + ':' + String(r).padStart(2, '0');
}

const _vocal = {
    rec: null, stream: null, chunks: [], start: 0, timer: null, maxMs: 60000, stopped: false
};

function vocalMime() {
    const cands = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4'
    ];
    for (const t of cands) {
        try { if (window.MediaRecorder && MediaRecorder.isTypeSupported(t)) return t; } catch (e) {}
    }
    return '';
}


function toggleVocalChat(ev) {
    if (ev) { try { ev.preventDefault(); ev.stopPropagation(); } catch (e) {} }
    if (_vocal.rec && !_vocal.stopped) {
        arreterVocalChat();
        return;
    }
    demarrerVocalChat();
}

async function demarrerVocalChat(ev) {
    if (ev) { try { ev.preventDefault(); } catch (e) {} }
    if (_vocal.rec) return;
    if (!convoOuverte) return;
    if (!window.MediaRecorder) {
        alert('Enregistrement vocal non supporté sur ce navigateur. Utilisez Chrome.');
        return;
    }
    // Ne pas démarrer si un appel utilise déjà le micro
    if (typeof Call !== 'undefined' && Call.state && Call.state !== 'idle') {
        alert('Terminez l’appel en cours avant d’envoyer un message vocal.');
        return;
    }
    const mime = vocalMime();
    const bar = document.getElementById('chatVoiceBar');
    const toolbar = document.querySelector('#chatView .chat-toolbar');
    const timerEl = document.getElementById('chatVoiceTimer');
    if (timerEl) timerEl.textContent = 'Micro…';
    if (bar) bar.removeAttribute('hidden');
    if (toolbar) toolbar.style.display = 'none';

    try {
        // Contrainte minimale = meilleur taux de succès sur Android
        _vocal.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e1) {
        try {
            _vocal.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } catch (e2) {
            restaurerToolbarChat();
            const msg = messageErreurMedia(e2 || e1);
            alert(msg);
            montrerNotification(msg.split('\n')[0]);
            return;
        }
    }
    _vocal.chunks = [];
    _vocal.stopped = false;
    try {
        const opts = mime ? { mimeType: mime, audioBitsPerSecond: 24000 } : undefined;
        _vocal.rec = opts ? new MediaRecorder(_vocal.stream, opts) : new MediaRecorder(_vocal.stream);
    } catch (e) {
        try { _vocal.rec = new MediaRecorder(_vocal.stream); } catch (e2) {
            try { _vocal.stream.getTracks().forEach(t => t.stop()); } catch (x) {}
            _vocal.stream = null;
            restaurerToolbarChat();
            alert('Impossible de démarrer l’enregistrement vocal sur cet appareil.');
            return;
        }
    }
    _vocal.rec.ondataavailable = (e) => { if (e.data && e.data.size) _vocal.chunks.push(e.data); };
    try { _vocal.rec.start(250); } catch (e) {
        try { _vocal.stream.getTracks().forEach(t => t.stop()); } catch (x) {}
        _vocal.stream = null; _vocal.rec = null;
        restaurerToolbarChat();
        alert('Enregistrement interrompu. Réessayez.');
        return;
    }
    _vocal.start = Date.now();
    const btn = document.getElementById('btnChatVocal');
    if (btn) btn.classList.add('recording');
    const tick = () => {
        const sec = Math.floor((Date.now() - _vocal.start) / 1000);
        if (timerEl) timerEl.textContent = fmtDureeVocal(sec) + ' · appuyez 🎙️ pour envoyer';
        if (sec >= 60) arreterVocalChat();
    };
    tick();
    _vocal.timer = setInterval(tick, 250);
}

function _stopVocalStream() {
    if (_vocal.timer) { clearInterval(_vocal.timer); _vocal.timer = null; }
    if (_vocal.stream) {
        try { _vocal.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
        _vocal.stream = null;
    }
    const btn = document.getElementById('btnChatVocal');
    if (btn) btn.classList.remove('recording');
}

function arreterVocalChat(ev) {
    if (ev) { try { ev.preventDefault(); } catch (e) {} }
    if (!_vocal.rec || _vocal.stopped) return;
    _vocal.stopped = true;
    const rec = _vocal.rec;
    _vocal.rec = null;
    const duree = Math.round((Date.now() - _vocal.start) / 1000);
    rec.onstop = async () => {
        _stopVocalStream();
        const type = rec.mimeType || 'audio/webm';
        const blob = new Blob(_vocal.chunks, { type });
        _vocal.chunks = [];
        if (duree < 1 || blob.size < 200) {
            restaurerToolbarChat();
            montrerNotification('Vocal trop court');
            return;
        }
        try {
            const dataUrl = await blobToDataUrl(blob);
            if (!dataUrl || dataUrl.length > 350000) {
                restaurerToolbarChat();
                alert('Message vocal trop long. Réessayez en parlant moins longtemps.');
                return;
            }
            window._chatVocalData = dataUrl;
            window._chatVocalDur = duree;
            // Envoi direct au relâchement (style WhatsApp)
            envoyerVocalChat();
        } catch (e) {
            restaurerToolbarChat();
            alert('Échec de préparation du vocal.');
        }
    };
    try { rec.stop(); } catch (e) { _stopVocalStream(); restaurerToolbarChat(); }
}

function annulerVocalChat() {
    if (_vocal.rec && !_vocal.stopped) {
        _vocal.stopped = true;
        try { _vocal.rec.onstop = null; _vocal.rec.stop(); } catch (e) {}
        _vocal.rec = null;
    }
    _vocal.chunks = [];
    _stopVocalStream();
    window._chatVocalData = null;
    window._chatVocalDur = 0;
    restaurerToolbarChat();
}

function restaurerToolbarChat() {
    const bar = document.getElementById('chatVoiceBar');
    const toolbar = document.querySelector('#chatView .chat-toolbar');
    if (bar) bar.setAttribute('hidden', '');
    if (toolbar) toolbar.style.display = '';
}

function envoyerVocalChat() {
    const data = window._chatVocalData;
    const dur = window._chatVocalDur || 0;
    window._chatVocalData = null;
    window._chatVocalDur = 0;
    restaurerToolbarChat();
    if (!data || !convoOuverte) return;
    const to = convoOuverte === 'general' ? null : convoOuverte;
    envoyerMessage(to, '', null, null, data, dur);
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
    });
}

let _audioPlaying = null;
document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.msg-audio-play');
    if (!b) return;
    const src = b.getAttribute('data-audio-src');
    if (!src) return;
    if (_audioPlaying) {
        try { _audioPlaying.pause(); } catch (err) {}
        document.querySelectorAll('.msg-audio-play.playing').forEach(x => { x.classList.remove('playing'); x.textContent = '▶'; });
        if (_audioPlaying._btn === b) { _audioPlaying = null; return; }
    }
    const a = new Audio(src);
    a._btn = b;
    _audioPlaying = a;
    b.classList.add('playing');
    b.textContent = '⏸';
    a.onended = a.onpause = () => {
        b.classList.remove('playing');
        b.textContent = '▶';
        if (_audioPlaying === a) _audioPlaying = null;
    };
    a.play().catch(() => {
        b.classList.remove('playing');
        b.textContent = '▶';
        montrerNotification('Lecture audio impossible');
    });
});

/* ---------- Groupes légers ---------- */
function sauverGroupesLocaux(list) {
    if (!utilisateur) return;
    utilisateur.groupes = list || [];
    sauverProfil();
}

function ouvrirCreationGroupe() {
    if (!utilisateur) return;
    const box = document.getElementById('groupeMembresList');
    const modal = document.getElementById('modalGroupe');
    if (!box || !modal) return;
    const contacts = (utilisateur.contacts || []).filter(c => c.surEVAT || c.online);
    const all = (utilisateur.contacts || []);
    const liste = contacts.length ? contacts : all;
    box.innerHTML = liste.length ? liste.map(c => `
        <label class="groupe-membre-row">
            <input type="checkbox" value="${escapeHtml(c.telephone)}">
            <span>${escapeHtml(c.nom)}</span>
            <small>${escapeHtml(c.telephone)}${c.surEVAT ? ' · EVAT' : ''}</small>
        </label>`).join('') : '<p class="subtitle">Ajoutez d’abord des contacts EVAT.</p>';
    const nom = document.getElementById('groupeNom');
    if (nom) nom.value = '';
    modal.removeAttribute('hidden');
}

function fermerCreationGroupe() {
    const modal = document.getElementById('modalGroupe');
    if (modal) modal.setAttribute('hidden', '');
}

function creerGroupeEVAT() {
    if (!socket.connected) { alert('Serveur injoignable.'); return; }
    const nom = ((document.getElementById('groupeNom') || {}).value || '').trim();
    if (!nom) { alert('Donnez un nom au groupe.'); return; }
    const membres = [...document.querySelectorAll('#groupeMembresList input:checked')].map(i => i.value);
    if (!membres.length) { alert('Cochez au moins un contact.'); return; }
    socket.emit('group_create', { nom, membres }, (res) => {
        if (!res || !res.ok) { alert((res && res.error) || 'Création impossible'); return; }
        const g = res.group;
        const list = groupesLocaux().filter(x => x.id !== g.id);
        list.unshift(g);
        sauverGroupesLocaux(list);
        fermerCreationGroupe();
        montrerNotification('👥 Groupe « ' + g.nom + ' » créé');
        ouvrirConversation('group:' + g.id);
    });
}


function quitterGroupeEVAT() {
    if (!convoOuverte || !estCleGroupe(convoOuverte)) return;
    const id = idGroupeDeCle(convoOuverte);
    const nom = nomConvo(convoOuverte);
    if (!confirm('Quitter le groupe « ' + nom + ' » ?')) return;
    if (!socket.connected) { alert('Serveur injoignable.'); return; }
    socket.emit('group_leave', { id }, (res) => {
        if (!res || !res.ok) { alert((res && res.error) || 'Impossible de quitter'); return; }
        sauverGroupesLocaux(groupesLocaux().filter(g => g.id !== id));
        fermerConversation();
        montrerNotification('Vous avez quitté « ' + nom + ' »');
        afficherMessagesLocaux();
    });
}

function chargerGroupesServeur() {
    if (!socket.connected || !utilisateur) return;
    socket.emit('group_list', null, (res) => {
        if (!res || !res.ok || !Array.isArray(res.groups)) return;
        sauverGroupesLocaux(res.groups);
        if (!convoOuverte) afficherMessagesLocaux();
    });
}

socket.on('group_update', (data) => {
    if (!utilisateur || !data || !data.group) return;
    let list = groupesLocaux();
    if (data.action === 'leave' && data.who === utilisateur.telephone) {
        list = list.filter(g => g.id !== data.group.id);
    } else {
        list = list.filter(g => g.id !== data.group.id);
        if (data.group.membres && data.group.membres.includes(utilisateur.telephone)) {
            list.unshift(data.group);
        }
    }
    sauverGroupesLocaux(list);
    if (!convoOuverte) afficherMessagesLocaux();
});

// Intégrer les groupes dans la liste des conversations


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
    document.getElementById('chatPeerAvatar').textContent = cle === 'general' ? '🌐' : (estCleGroupe(cle) ? '👥' : (estCleService(cle) ? '🔔' : initialesDe(nomConvo(cle))));
    const service = estCleService(cle);
    document.getElementById('chatView').classList.toggle('convo-service', service);
    const prive = cle !== 'general' && !estCleGroupe(cle) && !service;
    ['btnChatAudio', 'btnChatVideo'].forEach(id => { const b = document.getElementById(id); if (b) b.style.display = prive ? '' : 'none'; });
    const br = document.getElementById('btnChatResume');
    if (br) br.style.display = (cle === 'general' || service) ? 'none' : '';
    let btnLeave = document.getElementById('btnChatLeaveGroup');
    if (!btnLeave) {
        const top = document.querySelector('#chatView .chat-top');
        if (top) {
            btnLeave = document.createElement('button');
            btnLeave.type = 'button';
            btnLeave.id = 'btnChatLeaveGroup';
            btnLeave.className = 'btn-icon';
            btnLeave.title = 'Quitter le groupe';
            btnLeave.setAttribute('aria-label', 'Quitter le groupe');
            btnLeave.textContent = '🚪';
            btnLeave.onclick = () => quitterGroupeEVAT();
            top.appendChild(btnLeave);
        }
    }
    if (btnLeave) btnLeave.style.display = estCleGroupe(cle) ? '' : 'none';
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
    if (estCleService(convoOuverte)) { el.textContent = 'Messages automatiques · lecture seule'; return; }
    const c = (utilisateur.contacts || []).find(x => x.telephone === convoOuverte);
    if (c && c.online) {
        const st = c.statut || 'disponible';
        el.textContent = '● ' + labelStatut(st);
        el.classList.add('online');
    } else {
        el.textContent = c ? (c.lastSeen ? formaterVuLe(c.lastSeen) : 'hors ligne') : convoOuverte;
        el.classList.remove('online');
    }
}

function majNavChat() {
    const tab = document.getElementById('tab-messagerie');
    const actif = tab && tab.style.display !== 'none' && convoOuverte;
    document.body.classList.toggle('in-chat', !!actif);
}

function appelerConversation(type) {
    if (!convoOuverte || convoOuverte === 'general' || estCleGroupe(convoOuverte)) {
        montrerNotification('Choisissez un contact pour un appel vocal.');
        return;
    }
    lancerAppelDirectPeer(type || 'audio', convoOuverte);
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
        const showAuthor = !moi && (convoOuverte === 'general' || estCleGroupe(convoOuverte));
        const auteur = showAuthor ? `<div class="msg-author">${escapeHtml(m.expediteur)}</div>` : '';
        const imgHtml = m.image
            ? `<div class="msg-image"><img src="${m.image.replace(/"/g, '')}" alt="Photo" loading="lazy" onclick="ouvrirLightboxImage(this.src)"></div>`
            : '';
        const audioHtml = m.audio
            ? `<div class="msg-audio"><button type="button" class="msg-audio-play" data-audio-src="${String(m.audio).replace(/"/g, '')}" aria-label="Lire">▶</button>
                <div class="msg-audio-wave"></div>
                <span class="msg-audio-dur">${fmtDureeVocal(m.audioDur)}</span></div>`
            : '';
        const txtHtml = (m.texte && m.texte !== '📷 Photo' && m.texte !== '🎤 Message vocal')
            ? texteMsgHtml(m.texte)
            : ((m.image || m.audio) ? '' : texteMsgHtml(m.texte || ''));
        html += `<div class="msg-bubble ${moi ? 'me' : 'other'}" data-mid="${escapeHtml(String(m.id || m.cid || ''))}">${auteur}${imgHtml}${audioHtml}${txtHtml}` +
                `${tradHtml(m)}${reactionsHtml(m)}<div class="msg-meta"><span class="msg-time">${escapeHtml(m.ts ? heureCourte(m.ts) : (m.heure || ''))}</span>${coches(m)}</div></div>`;
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
    // Groupes connus même sans message
    groupesLocaux().forEach(g => {
        const k = 'group:' + g.id;
        if (!fils[k]) fils[k] = null;
    });

    const lignes = Object.keys(fils).map(k => ({ k, m: fils[k] }))
        .filter(x => !filtre || nomConvo(x.k).toLowerCase().includes(filtre))
        .sort((a, b) => (a.k === 'general') - (b.k === 'general') || ((b.m && b.m.ts) || 0) - ((a.m && a.m.ts) || 0));

    let html = lignes.map(({ k, m }) => {
        const nom = nomConvo(k);
        const c = k !== 'general' ? (utilisateur.contacts || []).find(x => x.telephone === k) : null;
        const n = nonLus[k] || 0;
        const apercu = m ? ((m.fromMe ? 'Vous : ' : ((k === 'general' || estCleGroupe(k)) ? m.expediteur + ' : ' : '')) + (m.audio ? '🎤 Message vocal' : (m.image && (!m.texte || m.texte === '📷 Photo') ? '📷 Photo' : texteApercu(m.texte || '')))) : 'Aucun message';
        const avatar = k === 'general' ? '🌐' : (estCleGroupe(k) ? '👥' : (estCleService(k) ? '🔔' : escapeHtml(initialesDe(nom))));
        return `<button type="button" class="conv-item ${n ? 'unread' : ''}" data-conv="${escapeHtml(k)}">
            <span class="avatar ${k === 'general' ? 'net' : ''} ${estCleGroupe(k) ? 'grp' : ''}">${avatar}${c && c.online ? '<i class="dot-on"></i>' : ''}</span>
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
    const supprimes = new Set(utilisateur.messagesSupprimes || []);
    msgs.forEach(m => {
        if (supprimes.has(m.id)) return;
        const fromMe = m.from === utilisateur.telephone;
        const etat = fromMe && m.to ? (m.read ? 'read' : (m.delivered ? 'delivered' : 'sent')) : null;
        const ex = parId.get(m.id) || (m.cid && parId.get(m.cid));
        if (ex) {
            if (fromMe && etat && ex.etat !== etat && ex.etat !== 'read') { ex.etat = etat; change = true; }
            if (JSON.stringify(ex.reactions || null) !== JSON.stringify(m.reactions || null)) { ex.reactions = m.reactions || null; change = true; }
            return;
        }
        const nouveau = {
            id: m.id, cid: m.cid || null, expediteur: m.fromName || m.from, from: m.from, texte: m.texte,
            heure: m.heure, fromMe, to: m.to || null, ts: m.timestamp, etat, reactions: m.reactions || null
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
    return NATIF || 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function majCartePush() {
    const carte = document.getElementById('pushPrompt');
    const stat = document.getElementById('statPush');
    const ok = pushSupporte() && (NATIF || Notification.permission === 'granted') && localStorage.getItem('evat_push_ok') === '1';
    if (carte) carte.style.display = (!pushSupporte() || ok) ? 'none' : 'flex';
    if (stat) stat.textContent = ok ? 'Activées' : (pushSupporte() ? 'À activer' : 'Non dispo');
    const txt = document.getElementById('pushPromptText');
    if (txt && !NATIF && pushSupporte() && Notification.permission === 'denied') {
        txt.textContent = 'Notifications bloquées : autorisez-les dans les réglages du navigateur pour recevoir les appels.';
    }
}

async function activerPush() {
    window.__pushErreur = '';
    if (!pushSupporte()) { window.__pushErreur = 'Ce navigateur ne gère pas les notifications push.'; return false; }
    if (!utilisateur) return false;
    if (!socket.connected) { window.__pushErreur = 'Serveur injoignable.'; return false; }
    if (NATIF) return activerPushNatif();
    if (Notification.permission !== 'granted') { window.__pushErreur = 'Notifications non autorisées.'; return false; }
    try {
        const { publicKey } = await new Promise(res => socket.emit('get_vapid', null, r => res(r || {})));
        if (!publicKey) { window.__pushErreur = 'Le serveur n’a pas de clé de notification (VAPID).'; return false; }
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
        window.__pushErreur = 'Le serveur n’a pas enregistré ce téléphone (compte non reconnu ?).';
    } catch (e) {
        const n = (e && e.name) || 'Erreur';
        window.__pushErreur = (n === 'AbortError' || /push service/i.test(e.message || ''))
            ? 'Le service de notifications du navigateur est inaccessible (réseau, VPN, économiseur de données, ou navigateur sans services Google). Essayez avec Chrome.'
            : n + ' : ' + (e && e.message ? e.message : '');
        console.warn('Push :', e);
    }
    localStorage.removeItem('evat_push_ok');
    return false;
}

/* ---------- Notifications natives (Firebase) : appels et messages même appli fermée ---------- */
let _fcmToken = null, _pushNatifInit = false;

async function envoyerTokenFcm() {
    if (!_fcmToken || !socket.connected || !utilisateur) return false;
    const res = await new Promise(r => socket.emit('fcm_register', { token: _fcmToken }, r));
    if (res && res.ok) { localStorage.setItem('evat_push_ok', '1'); majCartePush(); return true; }
    return false;
}

async function activerPushNatif() {
    window.__pushErreur = '';
    const PN = plugNatif('PushNotifications');
    if (!PN) { window.__pushErreur = 'Notifications natives indisponibles dans cette version.'; return false; }
    try {
        let perm = await PN.checkPermissions();
        if (perm.receive !== 'granted') perm = await PN.requestPermissions();
        if (perm.receive !== 'granted') { window.__pushErreur = 'Notifications refusées : autorisez-les dans les réglages Android.'; return false; }
        try {
            await PN.createChannel({ id: 'appels', name: 'Appels', description: 'Appels entrants EVAT', importance: 5, visibility: 1, vibration: true, lights: true });
            await PN.createChannel({ id: 'messages', name: 'Messages', description: 'Messages EVAT', importance: 4, vibration: true });
        } catch (e) {}
        if (!_pushNatifInit) {
            _pushNatifInit = true;
            PN.addListener('registration', t => { _fcmToken = t && t.value; envoyerTokenFcm(); });
            PN.addListener('registrationError', () => { window.__pushErreur = 'Firebase n’est pas configuré dans cette version de l’appli.'; });
            PN.addListener('pushNotificationActionPerformed', a => {
                const d = (a && a.notification && a.notification.data) || {};
                gererOuvertureNotification(d, a && a.actionId && a.actionId !== 'tap' ? a.actionId : '');
            });
        }
        await PN.register();
        for (let i = 0; i < 24 && !_fcmToken; i++) await new Promise(r => setTimeout(r, 250));
        if (!_fcmToken) { window.__pushErreur = window.__pushErreur || 'Jeton de notification non reçu (Firebase absent ou pas de services Google).'; return false; }
        return await envoyerTokenFcm();
    } catch (e) {
        window.__pushErreur = 'Notifications natives : ' + ((e && e.message) || 'erreur');
        return false;
    }
}

async function activerNotificationsPush() {
    if (NATIF) {
        const ok = await activerPushNatif();
        montrerNotification(ok ? '🔔 Notifications activées : appels et messages même appli fermée.' : '⚠️ ' + (window.__pushErreur || 'Activation impossible pour le moment.'));
        return;
    }
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
    if (typeof majBoostOnboarding === 'function') majBoostOnboarding();
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
    } else if (data.type === 'missed') {
        switchTab('appels');
    } else if ((data.type === 'message' || data.type === 'joined') && data.from) {
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

/* ---------- Continuum 2300 : badge, données faibles, résumé, cloud contacts ---------- */
function profilContinuumComplet() {
    if (!utilisateur) return false;
    const okMetier = !!(utilisateur.metier && utilisateur.metier !== 'Opérateur');
    const okContact = (utilisateur.contacts || []).length > 0;
    const okNotif = typeof Notification !== 'undefined' && Notification.permission === 'granted' && localStorage.getItem('evat_push_ok') === '1';
    const okIdentite = !!(utilisateur.email || utilisateur.ville || utilisateur.entreprise || utilisateur.bio);
    return okMetier && okContact && (okNotif || okIdentite);
}

function majBadgeContinuum() {
    const el = document.getElementById('badgeContinuum');
    if (!el) return;
    const ok = profilContinuumComplet();
    if (ok) el.removeAttribute('hidden'); else el.setAttribute('hidden', '');
}

function basculerModeDonneesFaibles(on) {
    const actif = !!on;
    localStorage.setItem('evat_low_data', actif ? '1' : '0');
    document.body.classList.toggle('low-data', actif);
    if (utilisateur) {
        utilisateur.parametres = utilisateur.parametres || {};
        utilisateur.parametres.lowData = actif;
        sauverProfil();
    }
    montrerNotification(actif ? 'Mode données faibles activé' : 'Mode données faibles désactivé');
}

function appliquerModeDonneesFaibles() {
    const on = localStorage.getItem('evat_low_data') === '1'
        || (utilisateur && utilisateur.parametres && utilisateur.parametres.lowData);
    document.body.classList.toggle('low-data', !!on);
    const cb = document.getElementById('modeDonneesFaibles');
    if (cb) cb.checked = !!on;
}

function resumerConversationIA() {
    if (!convoOuverte || convoOuverte === 'general') {
        montrerNotification('Ouvrez une conversation privée pour la résumer.');
        return;
    }
    const msgs = messagesDe(convoOuverte).slice(-40);
    if (!msgs.length) {
        montrerNotification('Aucun message à résumer.');
        return;
    }
    const nom = nomConvo(convoOuverte);
    const lignes = msgs.map(m => {
        const qui = m.from === (utilisateur && utilisateur.telephone) ? 'Moi' : (m.fromName || nom);
        return qui + ' : ' + String(m.texte || '').slice(0, 200);
    }).join('\n');
    const prompt = 'Résume cette conversation EVAT de façon claire et actionnable (décisions, prochaines étapes, ton). Conversation avec ' + nom + ' :\n\n' + lignes;
    // Ouvre Mister ELAWS et envoie
    if (typeof ouvrirIA === 'function') ouvrirIA('general');
    setTimeout(() => {
        const input = document.getElementById('elawsInput');
        if (input) {
            input.value = prompt;
            if (typeof actionEnvoiIA === 'function') actionEnvoiIA('general');
            else if (typeof envoyerQuestionIA === 'function') envoyerQuestionIA('general');
        }
    }, 200);
}

function payloadContactsCloud() {
    return (utilisateur.contacts || []).map(c => ({
        nom: c.nom,
        telephone: c.telephone,
        telephones: telephonesDuContact(c),
        email: c.email,
        emails: emailsDuContact(c),
        metier: c.metier,
        entreprise: c.entreprise,
        adresse: c.adresse,
        notes: c.notes
    }));
}

function sauvegarderContactsCloud() {
    if (!utilisateur) return;
    if (!socket.connected) { alert('Serveur injoignable.'); return; }
    const status = document.getElementById('contactImportStatus');
    if (status) status.textContent = 'Sauvegarde cloud…';
    socket.emit('contacts_backup', payloadContactsCloud(), (res) => {
        if (res && res.ok) {
            const msg = '☁️ ' + (res.n || 0) + ' contact(s) sauvegardé(s) sur votre compte';
            if (status) status.textContent = msg;
            montrerNotification(msg);
        } else {
            const err = (res && res.error) || 'Échec de sauvegarde';
            if (status) status.textContent = err;
            alert(err);
        }
    });
}

function restaurerContactsCloud() {
    if (!utilisateur) return;
    if (!socket.connected) { alert('Serveur injoignable.'); return; }
    const status = document.getElementById('contactImportStatus');
    if (status) status.textContent = 'Restauration cloud…';
    socket.emit('contacts_restore', null, (res) => {
        if (!res || !res.ok) {
            const err = (res && res.error) || 'Échec de restauration';
            if (status) status.textContent = err;
            alert(err);
            return;
        }
        const venus = Array.isArray(res.contacts) ? res.contacts : [];
        if (!venus.length) {
            if (status) status.textContent = 'Aucune sauvegarde cloud trouvée.';
            montrerNotification('Aucune sauvegarde cloud pour ce compte.');
            return;
        }
        if (!confirm('Fusionner ' + venus.length + ' contact(s) depuis le cloud avec votre annuaire local ?')) {
            if (status) status.textContent = '';
            return;
        }
        if (!utilisateur.contacts) utilisateur.contacts = [];
        let ajoutes = 0, maj = 0;
        venus.forEach(raw => {
            const data = normaliserContact(raw);
            if (!data.telephone) return;
            const exist = utilisateur.contacts.find(c => c.telephone === data.telephone);
            if (exist) {
                Object.assign(exist, normaliserContact({ ...exist, ...data, online: exist.online, surEVAT: exist.surEVAT }));
                maj++;
            } else {
                utilisateur.contacts.push(data);
                ajoutes++;
            }
        });
        sauverProfil();
        afficherContacts();
        verifierEtSynchroniserContacts();
        const msg = '☁️ Restauré : ' + ajoutes + ' ajouté(s), ' + maj + ' mis à jour';
        if (status) status.textContent = msg;
        montrerNotification(msg);
    });
}

function autoBackupContactsCloud() {
    if (!utilisateur || !socket.connected) return;
    if ((utilisateur.contacts || []).length === 0) return;
    const last = Number(localStorage.getItem('evat_contacts_cloud_ts') || 0);
    if (Date.now() - last < 12 * 60 * 60 * 1000) return; // max 1x / 12h auto
    socket.emit('contacts_backup', payloadContactsCloud(), (res) => {
        if (res && res.ok) localStorage.setItem('evat_contacts_cloud_ts', String(Date.now()));
    });
}

function majStatsAccueil() {
    majTitresIA();
    if (typeof rendreOutilsMetier === 'function') rendreOutilsMetier();
    majBadges();
    majCartePush();
    majCompteurContactsEnLigne();
    appliquerStatutPresenceUI();
    majBoostOnboarding();
    majBadgeContinuum();
    appliquerModeDonneesFaibles();
    autoBackupContactsCloud();
    chargerGroupesServeur();
}

/** Bouton « Tester » : le serveur envoie 3 notifications d'appel dans 8 s ; il faut fermer l'app ou verrouiller l'écran. */
function testerNotificationsAppel() {
    if (!socket.connected) { alert('Connexion au serveur en cours. Réessayez dans un instant.'); return; }
    socket.emit('push_test', null, (res) => {
        if (res && res.ok) alert('Test lancé ✅\n\nFermez maintenant EVAT (ou verrouillez le téléphone). Dans 8 secondes, une notification d’appel va sonner.');
        else alert((res && res.error) || 'Test impossible. Activez d’abord les notifications.');
    });
}

let _reinscription = false;
/** Le serveur a oublié ce compte (Render gratuit redémarre) : on le recrée avec les mêmes nom / numéro / métier. */
function reinscrireCompte() {
    if (_reinscription || !utilisateur || !socket.connected) return;
    _reinscription = true;
    socket.emit('register_new', { nom: utilisateur.nom, telephone: utilisateur.telephone, metier: utilisateur.metier }, (res) => {
        _reinscription = false;
        const st = document.getElementById('serverConnectionStatus');
        if (res && res.ok) {
            utilisateur.recoveryPin = res.recoveryPin;
            sauverProfil();
            if (st) { st.textContent = '🟢 Connexion active'; st.style.color = ''; }
            verifierEtSynchroniserContacts(); chargerHistorique(); activerPush(); if (NATIF) setTimeout(proposerImportContactsApresInscription, 2500);
            alert('Votre compte a été reconnecté au serveur ✅\n\nNouveau code de récupération : ' + res.recoveryPin + '\n\nNotez-le : il remplace l’ancien.');
        } else {
            if (st) { st.textContent = '🟠 Compte non reconnu — Menu → Refaire l’enregistrement'; st.style.color = 'var(--warning, #f59e0b)'; }
            montrerNotification((res && res.error) || 'Impossible de reconnecter le compte. Menu → Refaire l’enregistrement.');
        }
    });
}

/** « Tester ma connexion d'appel » : serveur, notifications, micro, puis essai réel des serveurs de relais (STUN/TURN). */
function sonderIce(iceServers) {
    return new Promise(resolve => {
        let pc = null;
        const compte = { host: 0, srflx: 0, relay: 0, erreurs: [] };
        const fin = () => {
            try { if (pc) pc.close(); } catch (e) {}
            resolve(compte);
        };
        const garde = setTimeout(fin, 15000); // 15 s : certains mobiles sont lents sur TURN TCP/TLS
        try {
            pc = new RTCPeerConnection({ iceServers, iceTransportPolicy: 'all', iceCandidatePoolSize: 4 });
            pc.onicecandidateerror = (ev) => {
                try {
                    compte.erreurs.push({
                        url: String(ev.url || ''),
                        code: ev.errorCode || 0,
                        text: String(ev.errorText || '').slice(0, 80)
                    });
                } catch (e) {}
            };
            pc.onicecandidate = (ev) => {
                if (!ev.candidate) {
                    clearTimeout(garde);
                    fin();
                    return;
                }
                const c = ev.candidate.candidate || '';
                if (/ typ relay /.test(c)) compte.relay++;
                else if (/ typ srflx /.test(c)) compte.srflx++;
                else if (/ typ host /.test(c)) compte.host++;
            };
            pc.createDataChannel('evat-probe');
            pc.createOffer().then(o => pc.setLocalDescription(o)).catch(() => { clearTimeout(garde); fin(); });
        } catch (e) {
            clearTimeout(garde);
            fin();
        }
    });
}

async function testerConnexionAppel() {
    const box = document.getElementById('resultatTestAppel');
    if (!box) return;
    const lignes = [];
    const afficher = () => { box.style.display = 'block'; box.innerHTML = lignes.map(l => '<div style="margin:5px 0">' + l + '</div>').join(''); };
    const ok = t => { lignes.push('✅ ' + escapeHtml(t)); afficher(); };
    const ko = t => { lignes.push('❌ ' + escapeHtml(t)); afficher(); };
    const av = t => { lignes.push('⚠️ ' + escapeHtml(t)); afficher(); };
    lignes.push('⏳ Test en cours (10 secondes)…'); afficher(); lignes.length = 0; lignes.push('⏳ Test en cours (10 secondes)…'); afficher();
    let n = 0;

    // 1) serveur
    if (socket.connected) ok('Serveur EVAT joint.');
    else { ko('Serveur injoignable. Il dort peut-être : patientez 1 minute et réessayez.'); n++; }

    // 2) notifications (appels application fermée)
    if (!pushSupporte()) av('Ce navigateur ne gère pas les notifications : sur iPhone, ajoutez EVAT à l’écran d’accueil.');
    else if (Notification.permission !== 'granted') { ko('Notifications refusées ou non demandées : les appels ne sonneront pas app fermée. Touchez « Activer » sur l’accueil.'); n++; }
    else if (!socket.connected) av('Notifications autorisées (état serveur inconnu : serveur injoignable).');
    else {
        const st = await new Promise(r => { socket.emit('push_status', null, r); setTimeout(() => r(null), 4000); });
        if (!st) av('Le serveur ne répond pas sur l’état des notifications.');
        else if (!st.liee) {
            ko('Votre compte n’est pas reconnu par le serveur (il a été réinitialisé) : ni appels ni notifications. Reconnexion automatique lancée : refaites le test dans 10 secondes.');
            n++; reinscrireCompte();
        }
        else if (!st.serveurPush) { ko('Le serveur n’a pas les notifications activées (clé VAPID).'); n++; }
        else if (!st.abonne) {
            const enregistre = await activerPush();
            if (enregistre) ok('Notifications : ce téléphone vient d’être enregistré, les appels app fermée sont possibles.');
            else { ko('Impossible d’enregistrer ce téléphone pour les appels app fermée. Cause : ' + (window.__pushErreur || 'inconnue')); n++; }
        }
        else ok('Notifications : ce téléphone est enregistré, les appels app fermée sont possibles.');
        if (st && st.sauvegarde === false) { av('Le serveur ne sauvegarde pas les comptes (Upstash mal configuré) : après un redémarrage de Render, il faudra se reconnecter.'); }
    }

    // 3) micro
    try {
        const flux = await navigator.mediaDevices.getUserMedia({ audio: true });
        flux.getTracks().forEach(t => t.stop());
        ok('Micro accessible.');
    } catch (e) { ko('Micro refusé ou absent : autorisez le micro pour EVAT dans les réglages du navigateur.'); n++; }

    // 4) réseau d'appel : STUN (connexion directe) et TURN (relais pour la 3G/4G)
    if (!window.RTCPeerConnection) { ko('Les appels ne sont pas gérés par ce navigateur.'); n++; }
    else {
        const ice = await chargerIce();
        const urls = ice.flatMap(x => [].concat(x.urls || []));
        const turnConfigure = urls.some(u => /^turns?:/.test(u));
        const r = await sonderIce(ice);
        if (r.relay > 0) ok('Relais TURN opérationnel : les appels marcheront aussi en 3G/4G et sur les réseaux fermés.');
        else if (turnConfigure) {
            const turnErr = r.erreurs.filter(x => /^turns?:/.test(x.url));
            const refus = turnErr.find(x => x.code === 401 || x.code === 403 || x.code === 438);
            const exemple = turnErr[0] ? ' (' + turnErr[0].url.replace(/^turns?:/, '') + ' : code ' + turnErr[0].code + ')' : '';
            if (refus) ko('Le relais REFUSE vos identifiants (code ' + refus.code + '). Vérifiez TURN_USERNAME et TURN_CREDENTIAL sur le serveur.');
            else if (turnErr.length) ko('Le relais est INJOIGNABLE depuis ce téléphone' + exemple + ' : ce réseau mobile le bloque. Réessayez en Wi-Fi ; sur ce réseau, les appels vers un autre réseau mobile échoueront.');
            else ko('Aucun relais TURN obtenu en 15 s. Causes fréquentes : variables TURN absentes/incorrectes sur Render, ou opérateur qui bloque le relais. Configurez TURN (Metered ou Cloudflare) puis redéployez le serveur.');
            n++;
        }
        else { av('Aucun relais TURN configuré sur le serveur : les appels entre deux réseaux mobiles échoueront souvent.'); n++; }
        if (r.srflx > 0) ok('Votre réseau permet la connexion directe (STUN).');
        else av('Connexion directe non confirmée (STUN sans réponse) : l’appel dépendra du relais TURN.');
    }

    lignes.shift();
    lignes.push(n === 0 ? '<strong>Tout est prêt pour les appels 👍</strong>' : '<strong>' + n + ' problème' + (n > 1 ? 's' : '') + ' à corriger (en rouge).</strong>');
    lignes.push('<span style="opacity:.7">Application v4.24 · test ICE 15 s</span>');
    afficher();
}

function majNavActive(tabId) {
    document.querySelectorAll('#bottomNav [data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
}

// ---------- Deux IA (v4.3) : Mister ELAWS (général) + Mister I (métier) ----------
/*  - Mister ELAWS (la sphère en haut) : répond à toutes les questions
    - Mister I : répond uniquement aux questions du métier de la personne, avec une boîte à outils
    - Les deux peuvent chercher sur Internet (sources affichées). La clé d'API et l'historique restent sur le serveur. */

const IA_CFG = {
    general: { box: 'elawsChatBox', input: 'elawsInput', send: 'elawsSend', nom: 'Mister ELAWS' },
    metier:  { box: 'metierChatBox', input: 'metierInput', send: 'metierSend', nom: 'Mister I' }
};
const IA_MAX_HIST = 60;      // messages gardés sur le téléphone, par IA (affichage)
const iaEtat = { actif: null, reqId: null, buf: '', el: null, raf: 0, question: '', sources: null };

// Outils génériques Mister I (tous métiers)
const IA_OUTILS_BASE = [
    { ico: '🧾', nom: 'Devis', q: 'Aide-moi à préparer un devis pour un client de mon métier. Pose-moi une par une les questions nécessaires (prestation, quantités, prix, délai), puis écris le devis prêt à envoyer, dans la monnaie locale de mon pays.' },
    { ico: '💰', nom: 'Prix & marge', q: 'Aide-moi à calculer mon prix de vente et ma marge pour une prestation ou un produit de mon métier. Demande-moi mes coûts (matériel, temps, déplacement), puis propose un prix juste et rentable.' },
    { ico: '✅', nom: 'Checklist', q: 'Prépare-moi une checklist complète pour ma journée de travail type dans mon métier (avant, pendant, après), avec les contrôles de sécurité.' },
    { ico: '💬', nom: 'Message client', q: 'Rédige-moi un message court et professionnel (WhatsApp) pour un client de mon métier. Demande-moi d’abord la situation : relance de devis, retard, remerciement, réclamation…' },
    { ico: '🛠️', nom: 'Matériel', q: 'Quel matériel et quels outils sont indispensables dans mon métier, du débutant au professionnel ? Donne des prix indicatifs dans la monnaie locale de mon pays.' },
    { ico: '📣', nom: 'Plus de clients', q: 'Donne-moi un plan concret et réaliste pour trouver plus de clients dans mon métier cette semaine.' },
    { ico: '📅', nom: 'Plan de journée', q: 'Organise ma journée de travail dans mon métier : priorités, créneaux, pauses, et 3 actions qui rapportent vraiment.' },
    { ico: '🤝', nom: 'Négociation', q: 'Aide-moi à négocier un prix ou un délai avec un client de mon métier. Donne-moi des phrases prêtes à dire, fermes et respectueuses.' },
    { ico: '🧾', nom: 'Facture', q: 'Rédige le texte d’une facture simple pour mon métier (mentions utiles, formulation claire), adapté à mon pays.' },
    { ico: '🔎', nom: 'Prix du marché', web: true, q: 'Cherche sur Internet les prix et tarifs actuels pratiqués dans mon métier dans mon pays (matériel et prestations) et fais-m’en un résumé clair avec les sources.' },
    { ico: '⚖️', nom: 'Règles à connaître', web: true, q: 'Cherche sur Internet les règles, autorisations et obligations à connaître pour exercer mon métier dans mon pays, et résume-les avec les sources.' },
    { ico: '📰', nom: 'Nouveautés', web: true, q: 'Cherche sur Internet les nouveautés, techniques et outils récents qui comptent dans mon métier, et dis-moi ce qui vaut vraiment le coup.' }
];

/* ---------- Kit métier adaptatif : outils / logiciels / méthodes selon le secteur ---------- */
const KITS_METIER = [
    {
        id: 'architecture',
        titre: 'Architecture & conception',
        mots: ['architect', 'architecture', 'urbanist', 'dessinateur batiment', 'concepteur batiment', 'bim', 'maître d’œuvre', 'maitre d\'oeuvre', 'architecte'],
        logiciels: ['AutoCAD', 'Revit (BIM)', 'Archicad', 'SketchUp', 'Lumion / Enscape', 'Bluebeam'],
        outils: [
            { ico: '📐', nom: 'Brief client', q: 'En tant qu’expert architecture, aide-moi à structurer un brief projet (programme, surface, budget, contraintes terrain, normes) sous forme de questions à poser au client, une par une.' },
            { ico: '🏗️', nom: 'Phases projet', q: 'Rappelle-moi les phases typiques d’un projet d’architecture (esquisse, APS, APD, permis, EXE, chantier) et ce que je dois livrer à chaque étape dans mon pays.' },
            { ico: '📋', nom: 'Permis & normes', web: true, q: 'Cherche les démarches de permis de construire et normes essentielles pour un projet de bâtiment dans mon pays, résume clairement avec sources.' },
            { ico: '🖥️', nom: 'Logiciels plans', q: 'Quels logiciels utiliser pour les plans et la 3D en architecture (débutant → pro) ? Avantages, alternatives gratuites ou abordables, et par quoi commencer selon mon niveau.' },
            { ico: '🧱', nom: 'CCTP / descriptif', q: 'Aide-moi à rédiger un descriptif technique simple (type CCTP abrégé) pour un lot de mon projet. Demande-moi le type d’ouvrage et le lot.' }
        ]
    },
    {
        id: 'batiment',
        titre: 'Bâtiment & chantier',
        mots: ['maçon', 'macon', 'plombier', 'électricien', 'electricien', 'carreleur', 'peintre', 'menuisier', 'charpentier', 'ferrailleur', 'coffreur', 'manœuvre', 'manoeuvre', 'bts bâtiment', 'genie civil', 'génie civil', 'conducteur de travaux', 'chef de chantier'],
        logiciels: ['Excel / feuilles de métrés', 'Autodesk Construction', 'WhatsApp pro', 'plans PDF annotés'],
        outils: [
            { ico: '📏', nom: 'Métré / quantités', q: 'Aide-moi à estimer quantités et métré pour un ouvrage de mon métier. Demande dimensions et type de travaux, puis donne un tableau clair.' },
            { ico: '🦺', nom: 'Sécurité chantier', q: 'Checklist sécurité chantier pour mon métier (EPI, risques, bons gestes) adaptée à un petit chantier.' },
            { ico: '📦', nom: 'Liste matériaux', q: 'Établis une liste de matériaux et consommables pour mon intervention. Demande le type de chantier, puis organise par priorité d’achat.' },
            { ico: '📸', nom: 'Compte-rendu', q: 'Rédige un compte-rendu de chantier court (avancement, problèmes, besoins) prêt à envoyer au client ou au chef de projet.' }
        ]
    },
    {
        id: 'sante',
        titre: 'Santé & soin',
        mots: ['infirmier', 'infirmière', 'medecin', 'médecin', 'pharmacien', 'sage-femme', 'kine', 'kiné', 'dentiste', 'aide-soignant', 'aide soignant', 'laborantin', 'veterinaire', 'vétérinaire'],
        logiciels: ['Dossier patient', 'agenda pro', 'référentiels nationaux'],
        outils: [
            { ico: '📅', nom: 'Planning soins', q: 'Aide-moi à organiser une journée type dans mon métier de santé (priorités, hygiène, transmission).' },
            { ico: '📝', nom: 'Transmission', q: 'Rédige un modèle de transmission claire et professionnelle pour mon métier de santé (faits, actions, surveillance).' },
            { ico: '📚', nom: 'Bonnes pratiques', web: true, q: 'Cherche les bonnes pratiques et recommandations actuelles pour mon métier de santé dans mon pays, résumé fiable avec sources.' }
        ]
    },
    {
        id: 'commerce',
        titre: 'Commerce & vente',
        mots: ['commerçant', 'commercant', 'vendeur', 'vendeuse', 'boutique', 'supermarché', 'negociant', 'négociant', 'caissier', 'retail', 'magasin'],
        logiciels: ['caisse / POS', 'Excel stocks', 'WhatsApp Business', 'Instagram Shopping'],
        outils: [
            { ico: '📦', nom: 'Stock', q: 'Aide-moi à gérer mon stock (seuils de réassort, produits qui dorment, rotation) pour mon commerce.' },
            { ico: '🏷️', nom: 'Prix de vente', q: 'Calcule un prix de vente rentable à partir de mon prix d’achat, charges et marge cible. Demande les chiffres un par un.' },
            { ico: '📣', nom: 'Promo semaine', q: 'Propose un plan promo simple pour cette semaine (offre, message client, affichage) adapté à mon commerce.' }
        ]
    },
    {
        id: 'agriculture',
        titre: 'Agriculture & élevage',
        mots: ['agriculteur', 'cultivateur', 'éleveur', 'eleveur', 'fermier', 'maraîcher', 'maraicher', 'pêcheur', 'pecheur', 'aviculteur', 'pisciculteur'],
        logiciels: ['carnet de culture', 'météo', 'WhatsApp coopérative'],
        outils: [
            { ico: '🌱', nom: 'Calendrier culture', q: 'Propose un calendrier de culture / élevage réaliste pour mon activité et mon climat (saison, actions clés).' },
            { ico: '💧', nom: 'Intrants', q: 'Liste les intrants et matériels essentiels pour mon type d’exploitation, avec priorités si le budget est limité.' },
            { ico: '📈', nom: 'Rentabilité', q: 'Aide-moi à estimer la rentabilité d’une campagne ou d’un lot (coûts, rendement, prix de vente).' }
        ]
    },
    {
        id: 'transport',
        titre: 'Transport & logistique',
        mots: ['chauffeur', 'taxi', 'camionneur', 'transporteur', 'logistique', 'coursier', 'livreur', 'moto-taxi', 'mototaxi'],
        logiciels: ['GPS', 'apps de course', 'suivi carburant'],
        outils: [
            { ico: '⛽', nom: 'Coût trajet', q: 'Calcule le coût réel d’un trajet (carburant, usure, temps) et un prix client juste. Demande distance et type de véhicule.' },
            { ico: '🗺️', nom: 'Tournée', q: 'Optimise une tournée de livraisons / courses pour la journée (ordre, pauses, points critiques).' },
            { ico: '🛠️', nom: 'Entretien véhicule', q: 'Checklist entretien véhicule pour mon activité de transport (quotidien, hebdo, mensuel).' }
        ]
    },
    {
        id: 'informatique',
        titre: 'Informatique & digital',
        mots: ['développeur', 'developpeur', 'programmeur', 'informaticien', 'webmaster', 'graphiste', 'designer', 'community manager', 'data', 'technicien informatique', 'réparateur téléphone', 'reparateur telephone'],
        logiciels: ['VS Code', 'Figma', 'GitHub', 'Canva', 'Notion'],
        outils: [
            { ico: '🧩', nom: 'Cahier des charges', q: 'Aide-moi à rédiger un mini cahier des charges pour un projet digital de mon métier (objectif, livrables, délais).' },
            { ico: '🧪', nom: 'Recette / tests', q: 'Propose une checklist de tests avant livraison client pour mon type de projet informatique ou digital.' },
            { ico: '💡', nom: 'Stack conseillée', q: 'Quelles technologies ou logiciels recommander pour mon besoin digital, selon mon niveau et mon budget ?' }
        ]
    },
    {
        id: 'education',
        titre: 'Éducation & formation',
        mots: ['enseignant', 'professeur', 'instituteur', 'formateur', 'tuteur', 'éducateur', 'educateur', 'coach scolaire'],
        logiciels: ['Google Classroom', 'Canva', 'WhatsApp classe', 'PDF annotés'],
        outils: [
            { ico: '📖', nom: 'Fiche de cours', q: 'Structure une fiche de cours claire (objectifs, déroulé, exercices) pour mon niveau et ma matière. Demande le thème.' },
            { ico: '📝', nom: 'Évaluation', q: 'Propose une petite évaluation (5–10 questions) avec barème pour le sujet que je vais indiquer.' },
            { ico: '👨‍👩‍👧', nom: 'Message parents', q: 'Rédige un message professionnel aux parents ou apprenants (rappel, résultat, encouragement).' }
        ]
    },
    {
        id: 'beaute',
        titre: 'Beauté & bien-être',
        mots: ['coiffeur', 'coiffeuse', 'esthétique', 'estheticienne', 'estheticienne', 'barbier', 'onglerie', 'spa', 'maquilleur', 'maquilleuse'],
        logiciels: ['agenda RDV', 'Instagram', 'WhatsApp Business'],
        outils: [
            { ico: '📅', nom: 'Agenda salon', q: 'Aide-moi à organiser mon planning de rendez-vous (créneaux rentables, no-show, relances).' },
            { ico: '💅', nom: 'Fiche prestation', q: 'Rédige une fiche prestation claire (durée, prix, produits, contre-indications) pour mon service.' },
            { ico: '✨', nom: 'Post réseaux', q: 'Écris un post Instagram / WhatsApp attractif pour promouvoir une offre de mon salon cette semaine.' }
        ]
    },
    {
        id: 'restauration',
        titre: 'Restauration & cuisine',
        mots: ['cuisinier', 'chef', 'restaurateur', 'traiteur', 'boulanger', 'pâtissier', 'patissier', 'serveur', 'hotelier', 'hôtelier'],
        logiciels: ['fiches techniques', 'caisse', 'stocks cuisine'],
        outils: [
            { ico: '🍽️', nom: 'Fiche technique', q: 'Crée une fiche technique de plat (ingrédients, quantités, coût, prix de vente) — demande-moi le plat.' },
            { ico: '📋', nom: 'Mise en place', q: 'Checklist mise en place avant service pour mon type d’établissement.' },
            { ico: '📉', nom: 'Food cost', q: 'Aide-moi à calculer le food cost et le prix de vente d’un plat pour viser une marge saine.' }
        ]
    },
    {
        id: 'droit',
        titre: 'Droit & administration',
        mots: ['avocat', 'juriste', 'notaire', 'huissier', 'comptable', 'expert-comptable', 'greffier', 'assistant juridique'],
        logiciels: ['traitement de texte', 'agenda audiences', 'archivage dossiers'],
        outils: [
            { ico: '📁', nom: 'Trame dossier', q: 'Propose une structure de dossier client pour mon métier juridique / admin (pièces, chronologie, points clés).' },
            { ico: '✍️', nom: 'Courrier type', q: 'Rédige un courrier professionnel type (relance, mise en demeure simple, demande de pièces) — demande le contexte.' },
            { ico: '⏱️', nom: 'Délais', web: true, q: 'Cherche les délais procéduraux ou obligations courantes liés à mon métier dans mon pays (résumé + sources).' }
        ]
    },
    {
        id: 'securite',
        titre: 'Sécurité & défense',
        mots: ['agent de sécurité', 'vigil', 'vigile', 'gendarme', 'policier', 'militaire', 'gardiennage'],
        logiciels: ['main courante', 'rapports', 'radio'],
        outils: [
            { ico: '📝', nom: 'Main courante', q: 'Modèle de main courante / rapport d’incident clair (faits, heure, personnes, actions).' },
            { ico: '🚨', nom: 'Consignes poste', q: 'Checklist consignes de poste pour une vacation type dans mon métier de sécurité.' }
        ]
    },
    {
        id: 'artisanat',
        titre: 'Artisanat & production',
        mots: ['couturier', 'couturière', 'couturiere', 'cordonnier', 'forgeron', 'artisan', 'soudeur', 'mécanicien', 'mecanicien', 'garagiste'],
        logiciels: ['photos avant/après', 'devis mobile', 'catalogue modèles'],
        outils: [
            { ico: '🔧', nom: 'Diagnostic', q: 'Guide de diagnostic étape par étape pour un problème client typique de mon métier artisanal.' },
            { ico: '📸', nom: 'Avant / après', q: 'Comment présenter mon travail (photos, témoignages) pour convaincre de nouveaux clients dans mon métier.' }
        ]
    }
];

function normaliserMotMetier(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ' ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function detecterKitMetier(metier) {
    const n = normaliserMotMetier(metier);
    if (!n || n === 'operateur' || n === 'utilisateur') return null;
    let best = null, score = 0;
    for (const kit of KITS_METIER) {
        let sc = 0;
        for (const m of kit.mots) {
            const mm = normaliserMotMetier(m);
            if (n.includes(mm) || mm.includes(n)) sc += mm.length;
        }
        if (sc > score) { score = sc; best = kit; }
    }
    return score > 0 ? best : null;
}

function outilsMetierActifs() {
    const metier = (utilisateur && utilisateur.metier) || '';
    const kit = detecterKitMetier(metier);
    const speciaux = kit ? (kit.outils || []) : [];
    // outils secteur en premier, puis base (sans doublons de nom)
    const noms = new Set(speciaux.map(o => o.nom));
    const base = IA_OUTILS_BASE.filter(o => !noms.has(o.nom));
    const liste = speciaux.concat(base);
    // Ajoute un outil « logiciels du métier » dynamique
    if (kit && kit.logiciels && kit.logiciels.length) {
        liste.unshift({
            ico: '💻',
            nom: 'Logiciels métier',
            q: 'Je suis ' + metier + '. Voici des outils souvent utilisés dans mon secteur : ' + kit.logiciels.join(', ') +
               '. Explique à quoi sert chacun, lesquels prioriser selon mon niveau (débutant / intermédiaire / pro), et des alternatives gratuites ou peu chères. Adapte à mon pays.'
        });
    } else if (metier && metier !== 'Opérateur') {
        liste.unshift({
            ico: '💻',
            nom: 'Logiciels métier',
            q: 'Je suis « ' + metier + ' ». Quels logiciels, applications et outils numériques sont réellement utilisés dans mon métier au quotidien ? Classe-les par priorité (essentiel / utile / avancé) et indique des options abordables.'
        });
    }
    return { kit, liste };
}

// Rétrocompatibilité
const IA_OUTILS = IA_OUTILS_BASE;


function iaHist(mode) {
    utilisateur.iaHistorique = utilisateur.iaHistorique || {};
    return (utilisateur.iaHistorique[mode] = utilisateur.iaHistorique[mode] || []);
}

function prenomUtilisateur() {
    return String((utilisateur && utilisateur.nom) || '').trim().split(/\s+/)[0] || '';
}

/* ---------- Mini-rendu Markdown sûr (le texte est échappé AVANT toute mise en forme) ---------- */
function mdVersHtml(src) {
    let t = String(src || '');
    if ((t.match(/```/g) || []).length % 2 === 1) t += '\n```';          // bloc de code pas encore fermé (streaming)
    t = escapeHtml(t);
    const blocs = [];
    t = t.replace(/```[a-zA-Z0-9_-]*\n?([\s\S]*?)```/g, (_, c) => { blocs.push(c.replace(/\n$/, '')); return '\u0000B' + (blocs.length - 1) + '\u0000'; });

    const inline = s => s
        .replace(/`([^`\n]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*\w])\*([^*\s][^*\n]*?)\*(?!\w)/g, '$1<em>$2</em>');

    let out = '', liste = null;
    const fermer = () => { if (liste) { out += '</' + liste + '>'; liste = null; } };
    for (const l of t.split('\n')) {
        let m;
        if (/^\u0000B\d+\u0000$/.test(l.trim())) { fermer(); out += l.trim(); }
        else if ((m = /^\s*[-*•]\s+(.*)$/.exec(l))) { if (liste !== 'ul') { fermer(); out += '<ul>'; liste = 'ul'; } out += '<li>' + inline(m[1]) + '</li>'; }
        else if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(l))) { if (liste !== 'ol') { fermer(); out += '<ol>'; liste = 'ol'; } out += '<li>' + inline(m[1]) + '</li>'; }
        else if ((m = /^#{1,4}\s+(.*)$/.exec(l))) { fermer(); out += '<p class="md-h">' + inline(m[1]) + '</p>'; }
        else if (!l.trim()) { fermer(); }
        else { fermer(); out += '<p>' + inline(l) + '</p>'; }
    }
    fermer();
    return out.replace(/\u0000B(\d+)\u0000/g, (_, i) => '<pre><code>' + blocs[i] + '</code></pre>');
}

/** Sources trouvées sur Internet : seulement des liens https, ouverts hors de l'application */
function sourcesVersHtml(sources) {
    if (!Array.isArray(sources) || !sources.length) return '';
    const liens = sources
        .filter(s => s && typeof s.url === 'string' && /^https:\/\//i.test(s.url))
        .slice(0, 6)
        .map(s => `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(String(s.titre || s.url).slice(0, 70))}</a>`);
    return liens.length ? `<div class="ia-sources"><span>🔎 Sources</span>${liens.join('')}</div>` : '';
}

/* ---------- Affichage ---------- */
function bulleIA(mode, role, html, extraClass) {
    if (role === 'user') return `<div class="ia-msg me"><div class="ia-body">${html}</div></div>`;
    return `<div class="ia-msg ai ${extraClass || ''}"><span class="orb orb-xs ${mode === 'metier' ? 'metier' : 'terre'}"></span><div class="ia-body">${html}</div></div>`;
}

function bienvenueIA(mode) {
    const p = prenomUtilisateur();
    const metier = (utilisateur && utilisateur.metier) || '';
    const chips = mode === 'general'
        ? ['Explique-moi simplement comment fonctionne l’inflation',
           'Aide-moi à écrire un message poli pour réclamer un remboursement',
           'Que cuisiner ce soir avec du riz, des œufs et des tomates ?',
           'Quels sont les jours fériés dans mon pays cette année ?']
        : (function() {
            const kit = detecterKitMetier((utilisateur && utilisateur.metier) || '');
            if (kit && kit.id === 'architecture') return [
                'Quels logiciels pour débuter les plans d’architecture ?',
                'Comment structurer un devis d’architecte ?',
                'Quelles étapes avant un dépôt de permis ?'
            ];
            if (kit && kit.id === 'batiment') return [
                'Comment estimer un métré rapidement ?',
                'Checklist sécurité avant de démarrer un chantier',
                'Comment rédiger un devis maçonnerie clair ?'
            ];
            return [
                'Quelles erreurs courantes éviter dans mon métier ?',
                'Comment fixer mes prix et rester rentable ?',
                'Quels outils numériques utiliser dans mon métier ?'
            ];
        })();
    const intro = mode === 'general'
        ? `Bonjour${p ? ' ' + escapeHtml(p) : ''} ! Je suis <strong>Mister ELAWS</strong>. Posez-moi n’importe quelle question : je réfléchis avec vous, je peux même chercher sur Internet.`
        : `Je suis <strong>Mister I</strong>, votre assistant ${escapeHtml(metier || 'métier')}. Je réponds uniquement aux questions de votre métier, avec des outils prêts à l’emploi ci-dessous. Pour tout le reste, demandez à <strong>Mister ELAWS</strong> : touchez la sphère <span class="orb orb-xs inline terre"></span> en haut.`;
    return `<div class="ia-welcome">
        ${mode === 'general' ? '<canvas class="globe globe-halo" data-size="92" aria-label="Terre"></canvas>' : '<span class="orb orb-lg metier"></span>'}
        <p>${intro}</p>
        <div class="ia-chips">${chips.map(c => `<button type="button" class="ia-chip" data-ia="${mode}" data-q="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('')}</div>
    </div>`;
}

function rendreOutilsMetier() {
    const box = document.getElementById('metierTools');
    if (!box) return;
    const { kit, liste } = outilsMetierActifs();
    window._iaOutilsCourants = liste;
    let head = '';
    if (kit) {
        head = `<div class="kit-metier-banner"><strong>🧰 Kit ${escapeHtml(kit.titre)}</strong>` +
            (kit.logiciels && kit.logiciels.length
                ? `<span class="kit-metier-soft">Logiciels : ${escapeHtml(kit.logiciels.slice(0, 5).join(' · '))}</span>`
                : '') +
            `</div>`;
    } else if (utilisateur && utilisateur.metier && utilisateur.metier !== 'Opérateur') {
        head = `<div class="kit-metier-banner"><strong>🧰 Espace « ${escapeHtml(utilisateur.metier)} »</strong>` +
            `<span class="kit-metier-soft">Outils adaptés + assistants génériques</span></div>`;
    } else {
        head = `<div class="kit-metier-banner"><strong>🧰 Indiquez votre métier</strong>` +
            `<span class="kit-metier-soft">Profil → métier pour débloquer le kit sectoriel</span></div>`;
    }
    box.innerHTML = head + liste.map((o, i) =>
        `<button type="button" class="ia-tool${o.web ? ' web' : ''}" data-tool="${i}" title="${o.web ? 'Utilise Internet' : ''}"><span>${o.ico}</span>${escapeHtml(o.nom)}</button>`).join('');
}

function rendreIA(mode) {
    if (!utilisateur) return;
    const cfg = IA_CFG[mode];
    const box = document.getElementById(cfg.box);
    if (!box) return;
    if (mode === 'metier') rendreOutilsMetier();
    const hist = iaHist(mode);
    if (!hist.length) { box.innerHTML = bienvenueIA(mode); majTitresIA(); if (typeof initialiserGlobes === 'function') initialiserGlobes(); return; }
    box.innerHTML = hist.map(m => m.role === 'user'
        ? bulleIA(mode, 'user', escapeHtml(m.content).replace(/\n/g, '<br>'))
        : bulleIA(mode, 'ai', mdVersHtml(m.content) + sourcesVersHtml(m.sources))).join('');
    box.scrollTop = box.scrollHeight;
    majTitresIA();
}

function majTitresIA() {
    if (!utilisateur) return;
    const metier = (utilisateur.metier || '').trim();
    const kit = detecterKitMetier(metier);
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('iaMetierTitre', 'Mister I');
    set('iaMetierTop', 'Mister I');
    set('iaMetierSous', metier ? ('Expert ' + metier) : 'Votre expert métier');
    set('iaMetierSousTop', metier
        ? (kit ? (kit.titre + ' · ' + metier) : ('Uniquement : ' + metier))
        : 'Spécialiste de votre activité');
}

function iaDefiler(box) {
    if (box.scrollHeight - box.scrollTop - box.clientHeight < 160) box.scrollTop = box.scrollHeight;
}

function iaBasculerBouton(mode, enCours) {
    const b = document.getElementById(IA_CFG[mode].send);
    if (!b) return;
    b.textContent = enCours ? '■' : '➤';
    b.classList.toggle('stop', enCours);
    b.setAttribute('aria-label', enCours ? 'Arrêter' : 'Envoyer');
}

/* ---------- Envoi / réception ---------- */
function actionEnvoiIA(mode) {
    if (iaEtat.actif === mode) arreterIA(mode);
    else envoyerQuestionIA(mode);
}

function envoyerQuestionIA(mode, texteForce) {
    if (!utilisateur) return;
    const cfg = IA_CFG[mode];
    const input = document.getElementById(cfg.input);
    const question = String(texteForce != null ? texteForce : (input ? input.value : '')).trim().slice(0, 2000);
    if (!question) return;
    if (iaEtat.actif) { montrerNotification('⏳ Une réponse est déjà en cours.'); return; }

    const box = document.getElementById(cfg.box);
    const hist = iaHist(mode);
    if (!hist.length) box.innerHTML = '';

    if (input && texteForce == null) { input.value = ''; input.style.height = '42px'; }
    hist.push({ role: 'user', content: question, t: Date.now() });
    box.insertAdjacentHTML('beforeend', bulleIA(mode, 'user', escapeHtml(question).replace(/\n/g, '<br>')));
    box.insertAdjacentHTML('beforeend', bulleIA(mode, 'ai', '<span class="ia-dots"><i></i><i></i><i></i></span>', 'pending'));
    const el = box.lastElementChild;
    box.scrollTop = box.scrollHeight;

    const reqId = 'ia' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    Object.assign(iaEtat, { actif: mode, reqId, buf: '', el, question, sources: null });
    iaBasculerBouton(mode, true);

    if (!socket.connected) { iaEchec(mode, 'Vous êtes hors ligne. Reconnectez-vous pour interroger l’IA.', true); return; }

    // Le serveur garde lui-même le fil de la conversation : on n'envoie que la question
    const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; } })();
    socket.emit('ai_ask', { mode, reqId, texte: question, tz, pays: paysUtilisateur() }, (res) => {
        if (res && res.ok) return;
        iaEchec(mode, (res && res.error) || 'IA indisponible.', true, res && res.code === 'no_key');
    });
}

socket.on('ai_phase', (d) => {
    if (!d || d.reqId !== iaEtat.reqId || !iaEtat.el || d.phase !== 'search') return;
    if (iaEtat.buf) return;                       // du texte est déjà affiché : inutile
    const body = iaEtat.el.querySelector('.ia-body');
    body.innerHTML = '<span class="ia-phase">🔎 Recherche sur Internet…</span> <span class="ia-dots"><i></i><i></i><i></i></span>';
});

socket.on('ai_sources', (d) => {
    if (d && d.reqId === iaEtat.reqId && Array.isArray(d.sources)) iaEtat.sources = d.sources;
});

socket.on('ai_chunk', (d) => {
    if (!d || d.reqId !== iaEtat.reqId || !iaEtat.actif) return;
    iaEtat.buf += d.text;
    if (iaEtat.raf) return;
    iaEtat.raf = requestAnimationFrame(() => {
        iaEtat.raf = 0;
        if (!iaEtat.el) return;
        iaEtat.el.classList.remove('pending');
        iaEtat.el.querySelector('.ia-body').innerHTML = mdVersHtml(iaEtat.buf);
        iaDefiler(iaEtat.el.parentElement);
    });
});

socket.on('ai_done', (d) => {
    if (!d || d.reqId !== iaEtat.reqId || !iaEtat.actif) return;
    const mode = iaEtat.actif;
    if (iaEtat.raf) { cancelAnimationFrame(iaEtat.raf); iaEtat.raf = 0; }
    const texte = iaEtat.buf.trim();
    const sources = iaEtat.sources;
    if (iaEtat.el) {
        iaEtat.el.classList.remove('pending');
        iaEtat.el.querySelector('.ia-body').innerHTML = texte ? mdVersHtml(texte) + sourcesVersHtml(sources) : '<em>Réponse interrompue.</em>';
        iaDefiler(iaEtat.el.parentElement);
    }
    if (texte) {
        const msg = { role: 'assistant', content: texte, t: Date.now() };
        if (sources && sources.length) msg.sources = sources.slice(0, 6);
        iaHist(mode).push(msg);
        utilisateur.iaHistorique[mode] = iaHist(mode).slice(-IA_MAX_HIST);
    } else {
        iaHist(mode).pop();                      // question sans réponse : on la retire
    }
    sauverProfil();
    iaFin(mode);
});

socket.on('ai_error', (d) => {
    if (!d || d.reqId !== iaEtat.reqId || !iaEtat.actif) return;
    iaEchec(iaEtat.actif, d.error || 'L’IA est momentanément indisponible.', iaEtat.buf.trim() === '');
});

socket.on('disconnect', () => {
    if (iaEtat.actif) iaEchec(iaEtat.actif, 'Connexion perdue pendant la réponse.', iaEtat.buf.trim() === '');
});

function iaFin(mode) {
    Object.assign(iaEtat, { actif: null, reqId: null, buf: '', el: null, sources: null });
    iaBasculerBouton(mode, false);
}

/** Échec : on retire la question de l'historique (si rien n'a été reçu) et on la remet dans la zone de saisie. */
function iaEchec(mode, message, retirerQuestion, sansCle) {
    const question = iaEtat.question;
    const el = iaEtat.el;
    if (iaEtat.raf) { cancelAnimationFrame(iaEtat.raf); iaEtat.raf = 0; }
    const partiel = iaEtat.buf.trim();

    // Mister ELAWS sans clé serveur : on garde l'ancienne réponse locale, limitée mais utile hors ligne
    if (sansCle && mode === 'general' && typeof genererReponseElaws === 'function' && question) {
        const rep = genererReponseElaws(question);
        if (el) { el.classList.remove('pending'); el.querySelector('.ia-body').innerHTML = mdVersHtml(rep) + '<p class="ia-note">Mode limité : l’IA complète n’est pas encore activée sur le serveur.</p>'; }
        iaHist(mode).push({ role: 'assistant', content: rep, t: Date.now() });
        sauverProfil();
        iaFin(mode);
        return;
    }

    if (el) {
        el.classList.remove('pending');
        el.classList.add('error');
        el.querySelector('.ia-body').innerHTML = (partiel ? mdVersHtml(partiel) : '') + `<p class="ia-note err">⚠️ ${escapeHtml(message)}</p>`;
    }
    if (partiel) {
        iaHist(mode).push({ role: 'assistant', content: partiel, t: Date.now() });
    } else if (retirerQuestion) {
        iaHist(mode).pop();
        const input = document.getElementById(IA_CFG[mode].input);
        if (input && !input.value) input.value = question;
    }
    sauverProfil();
    iaFin(mode);
}

function arreterIA(mode) {
    if (iaEtat.actif === mode) socket.emit('ai_cancel');
}

function nouvelleDiscussionIA(mode) {
    if (iaEtat.actif === mode) arreterIA(mode);
    if (!iaHist(mode).length) return;
    if (!confirm('Effacer cette discussion ?')) return;
    utilisateur.iaHistorique[mode] = [];
    socket.emit('ai_reset', { mode });             // le serveur oublie aussi le fil
    sauverProfil();
    rendreIA(mode);
}

function ouvrirIA(mode) {
    switchTab(mode === 'metier' ? 'ia-metier' : 'elaws-ia');
}

// Suggestions et outils cliquables
document.addEventListener('click', (e) => {
    const c = e.target.closest && e.target.closest('.ia-chip');
    if (c) { envoyerQuestionIA(c.dataset.ia, c.dataset.q); return; }
    const t = e.target.closest && e.target.closest('.ia-tool');
    if (t) { const arr = window._iaOutilsCourants || IA_OUTILS_BASE; const o = arr[Number(t.dataset.tool)]; if (o) envoyerQuestionIA('metier', o.q); }
});

// Compatibilité avec l'ancien code
function poserQuestionElaws() { envoyerQuestionIA('general'); }
function poserQuestionMetier() { envoyerQuestionIA('metier'); }

function basculerEcouteVocaleIA(mode) {
    mode = mode === 'metier' ? 'metier' : 'general';
    const statusEl = document.getElementById(mode === 'metier' ? 'micStatusMetier' : 'micStatusElaws');
    const inputEl = document.getElementById(IA_CFG[mode].input);
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert('Reconnaissance vocale non supportée sur ce navigateur.'); return; }
    const rec = new SR();
    rec.lang = 'fr-FR';
    if (statusEl) statusEl.textContent = '🎙️ Je vous écoute…';
    rec.onresult = (ev) => {
        inputEl.value = ev.results[0][0].transcript;
        if (statusEl) statusEl.textContent = '';
        envoyerQuestionIA(mode);
    };
    rec.onerror = rec.onend = () => { if (statusEl) statusEl.textContent = ''; };
    rec.start();
}

// ---------- Historique des appels & appels manqués (v4.5) ----------
const JOURNAL_MAX = 200;
let filtreAppels = 'tous';

const LIBELLES_APPEL = {
    manque: 'Appel manqué', repondu: 'Répondu', refuse: 'Refusé', occupe: 'Occupé',
    hors_ligne: 'Hors ligne', sans_reponse: 'Sans réponse', annule: 'Annulé', echec: 'Échec'
};

function journal() {
    utilisateur.journalAppels = utilisateur.journalAppels || [];
    return utilisateur.journalAppels;
}

function appelsManquesNonVus() {
    return utilisateur ? journal().filter(e => e.statut === 'manque' && !e.vu).length : 0;
}

function ajouterAuJournal(e) {
    if (!utilisateur) return;
    const j = journal();
    j.unshift(e);
    if (j.length > JOURNAL_MAX) j.length = JOURNAL_MAX;
    // si on est déjà sur l'écran des appels, un appel manqué est « vu » tout de suite
    const tab = document.getElementById('tab-appels');
    if (tab && tab.style.display !== 'none' && !document.hidden) e.vu = true;
    sauverProfil();
    majBadges();
    if (tab && tab.style.display !== 'none') rendreJournalAppels();
    if (document.body.classList.contains('fiche-contact-ouverte')) {
        const c = typeof ficheContactCourant === 'function' ? ficheContactCourant() : null;
        if (c && typeof rendreFicheHistorique === 'function') rendreFicheHistorique(c);
    }
}

/** Enregistre l'appel qui se termine (à appeler AVANT de remettre Call à zéro). */
function journaliserAppel(cause) {
    if (!utilisateur || !Call.peer || Call.state === 'idle') return;
    const sortant = !!Call.isCaller;
    let statut;
    if (Call.state === 'connected') statut = 'repondu';
    else if (sortant) statut = cause || 'annule';
    else statut = cause || (Call.state === 'ringing' ? 'manque' : 'echec');
    const duree = (statut === 'repondu' && Call.startedAt) ? Math.round((Date.now() - Call.startedAt) / 1000) : 0;
    ajouterAuJournal({
        id: Call.id || ('l' + Date.now()), peer: Call.peer, nom: nomPourTel(Call.peer),
        dir: sortant ? 'out' : 'in', type: Call.type || 'audio', statut, ts: Date.now(), duree,
        vu: statut !== 'manque'
    });
    if (!sortant && statut === 'manque') notifierAppelManque(Call.peer);
}

/** Appel manqué : bandeau dans l'app et, si l'app est cachée, notification du téléphone */
async function notifierAppelManque(tel) {
    const nom = nomPourTel(tel);
    montrerNotification('📵 Appel manqué de ' + nom, () => switchTab('appels'));
    try {
        if (document.hidden && notificationsPretes()) {
            const reg = await navigator.serviceWorker.ready;
            reg.showNotification('📵 Appel manqué', {
                body: nom + ' a essayé de vous joindre', tag: 'evat-missed', renotify: true,
                icon: 'icon-192.png', badge: 'icon-192.png', vibrate: [200, 100, 200],
                data: { type: 'missed', from: tel }
            }).catch(() => {});
        }
    } catch (e) {}
}

// Appels manqués pendant que le téléphone était éteint / l'app fermée (envoyés par le serveur à la reconnexion)
socket.on('missed_calls', (liste) => {
    if (!Array.isArray(liste) || !utilisateur) return;
    let ajoutes = 0;
    liste.forEach(c => {
        const id = c.callId || ('srv' + c.at);
        if (journal().some(e => e.id === id)) return;
        ajouterAuJournal({
            id, peer: c.from, nom: c.fromName || nomPourTel(c.from), dir: 'in',
            type: c.callType === 'video' ? 'video' : 'audio', statut: 'manque', ts: c.at || Date.now(), duree: 0, vu: false
        });
        ajoutes++;
    });
    if (ajoutes) montrerNotification('📵 ' + ajoutes + ' appel' + (ajoutes > 1 ? 's' : '') + ' manqué' + (ajoutes > 1 ? 's' : ''), () => switchTab('appels'));
});

function marquerAppelsVus() {
    if (!utilisateur) return;
    let change = false;
    journal().forEach(e => { if (!e.vu) { e.vu = true; change = true; } });
    if (change) { sauverProfil(); majBadges(); }
    fermerNotificationsManquees();
}

async function fermerNotificationsManquees() {
    try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) (await reg.getNotifications({ tag: 'evat-missed' })).forEach(n => n.close());
    } catch (e) {}
}

function dureeTexte(s) {
    if (!s) return '';
    if (s < 60) return s + ' s';
    return Math.floor(s / 60) + ' min ' + String(s % 60).padStart(2, '0') + ' s';
}

function filtrerAppels(f) {
    filtreAppels = f;
    document.querySelectorAll('.appels-filtres [data-filtre]').forEach(b => b.classList.toggle('active', b.dataset.filtre === f));
    rendreJournalAppels();
}

function rendreJournalAppels() {
    const box = document.getElementById('listeAppels');
    if (!box || !utilisateur) return;
    let liste = journal();
    if (filtreAppels === 'manques') liste = liste.filter(e => e.statut === 'manque');
    if (!liste.length) {
        box.innerHTML = `<div class="empty-state"><div class="empty-ico">📞</div><p>${filtreAppels === 'manques' ? 'Aucun appel manqué.' : 'Aucun appel pour le moment.<br>Appelez un contact depuis l’onglet Contacts.'}</p></div>`;
        return;
    }
    let jour = '', html = '';
    liste.forEach(e => {
        const j = libelleJour(e.ts);
        if (j !== jour) { jour = j; html += `<div class="conv-section">${escapeHtml(j)}</div>`; }
        const manque = e.statut === 'manque';
        const nom = (utilisateur.contacts || []).find(c => c.telephone === e.peer);
        const affiche = nom ? nom.nom : (e.nom || e.peer);
        const fleche = e.dir === 'in' ? '↙' : '↗';
        const sous = [LIBELLES_APPEL[e.statut] || '', e.type === 'video' ? '📹 Vidéo' : '', heureCourte(e.ts), dureeTexte(e.duree)].filter(Boolean).join(' · ');
        html += `<div class="appel-item ${manque ? 'manque' : ''}">
            <span class="avatar sm">${escapeHtml(initialesDe(affiche))}</span>
            <div class="appel-body"><strong>${escapeHtml(affiche)}</strong>
              <span class="appel-sub"><i class="dir">${fleche}</i> ${escapeHtml(sous)}</span></div>
            <div class="appel-actions">
              <button type="button" class="btn-icon" data-rappel="audio" data-tel="${escapeHtml(e.peer)}" aria-label="Rappeler">📞</button>
              <button type="button" class="btn-icon" data-rappel="video" data-tel="${escapeHtml(e.peer)}" aria-label="Appel vidéo">📹</button>
            </div></div>`;
    });
    box.innerHTML = html;
}

function viderJournalAppels() {
    if (!utilisateur || !journal().length) return;
    if (!confirm('Effacer tout l’historique des appels ?')) return;
    utilisateur.journalAppels = [];
    sauverProfil();
    majBadges();
    rendreJournalAppels();
}

document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('#listeAppels [data-rappel]');
    if (b) lancerAppelDirectPeer(b.dataset.rappel === 'video' ? 'video' : 'audio', b.dataset.tel);
});


// ---------- Globe terrestre réel (v4.5) ----------
/*  La sphère de Mister ELAWS est la Terre : vraie image satellite (NASA Blue Marble, domaine public) chargée une fois
    depuis un CDN public puis gardée en cache. Pendant le chargement (ou hors ligne), un globe dessiné localement
    prend le relais. Rendu en canvas 2D : rotation, éclairage du soleil, relief des océans, atmosphère bleue.
    Une seule boucle d'animation pour tous les globes, en pause quand l'application est cachée.                  */

const GLOBE_URLS = [
    'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg',
    'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg'
];
const GLOBE = {
    TW: 1024, TH: 512, tex: null, eau: null, reel: false,
    instances: [], raf: 0, dernier: 0, spin: 0.62, statique: false
};

/* ---------- Texture de secours : continents simplifiés [lon, lat] ---------- */
const TERRES = [
    // Amérique du Nord
    [[-168,66],[-162,70],[-156,71.5],[-141,70],[-128,70],[-115,68],[-95,72],[-86,70],[-82,67],[-88,64],[-94,60],[-93,57],[-85,55],[-80,52],[-78,57],[-77,62],[-70,60],[-65,60],[-62,57],[-56,52],[-60,47],[-66,45],[-70,43],[-70,41.5],[-74,40],[-76,37],[-76,35],[-81,31],[-80,26],[-82,26],[-83,29.5],[-89,30],[-94,29.5],[-97,26],[-97.5,22],[-95,18.5],[-91,18.5],[-90,21],[-87,21.5],[-88,16],[-84,15.5],[-83,11],[-81,9],[-77.5,8.5],[-78,7],[-80,7.5],[-83.5,8.5],[-86,11],[-87.5,13],[-92,14.5],[-95,16],[-98,16],[-103,18.5],[-105.5,20.5],[-105,23],[-109,25.5],[-112,29.5],[-115,29.5],[-114,31.5],[-112,28],[-110,23],[-112,24.5],[-115,28],[-117,32.5],[-120.5,34.5],[-122.5,37.5],[-124,40.5],[-124.5,46],[-123,48.5],[-125,50],[-130,54.5],[-135,58.5],[-140,60],[-148,60.5],[-152,58.5],[-158,56.5],[-164,54.5],[-160,58.5],[-165,61],[-165,64.5]],
    // Groenland, grandes îles arctiques
    [[-73,78.5],[-60,82],[-30,83.5],[-18,81.5],[-20,75],[-22,70],[-30,68],[-40,65],[-43,60],[-48,61],[-53,66],[-55,70],[-60,76]],
    [[-80,73],[-68,70],[-62,66.5],[-65,63],[-72,64.5],[-78,64],[-73,68]],
    [[-118,72],[-105,73],[-102,69.5],[-114,69]],
    [[-90,77],[-75,79],[-62,82],[-80,83],[-92,81]],
    // Amérique du Sud
    [[-77.5,8.5],[-72,12],[-64,10.5],[-60,8.5],[-52,5],[-50,0],[-44,-2.5],[-35,-5.5],[-35,-9],[-39,-14],[-39,-18],[-41,-22],[-48,-25.5],[-48.5,-28.5],[-53,-34],[-58,-34.5],[-57,-38],[-62,-39],[-65,-41],[-64.5,-45],[-67.5,-46.5],[-66,-48.5],[-69,-51],[-68.5,-52.5],[-72,-53.5],[-75,-50],[-73.5,-42],[-73.5,-37],[-71.5,-30],[-70.5,-20],[-70.3,-18],[-76,-14],[-79,-8],[-81,-5],[-80,-1],[-80,1.5],[-78.5,2.5],[-77.5,7]],
    // Afrique + Madagascar
    [[-17,21],[-16.5,24],[-13,27.5],[-9.5,30],[-9.5,32.5],[-6,35.8],[-2,35.2],[3,36.8],[10,37.2],[11,33.5],[15,32.3],[19.5,30.5],[20,32.5],[25,32],[32,31.2],[34,27.5],[36,22],[37.5,18],[39.5,15.5],[43,12.5],[45,10.5],[51.2,11.8],[50.5,9],[48,5],[44,1.5],[41,-2],[39.5,-6],[40.5,-10.5],[40.5,-15],[35,-20],[35.5,-24.5],[32.8,-26],[31,-30],[27,-33.5],[22,-34],[18.5,-34.2],[17.5,-30.5],[14.5,-23],[11.8,-17],[13.5,-10],[12,-5],[9.5,-1],[9.5,3.5],[6,4.5],[2,6],[-4,5],[-8,4.4],[-12,7.5],[-15,10.5],[-17,14.5]],
    [[49.5,-12],[50.5,-15.5],[47.5,-25],[44.5,-25],[43.5,-21],[44.5,-16]],
    // Eurasie
    [[-9,37],[-9.5,43],[-1.8,43.5],[-1.2,46],[-4.5,48.3],[-1.5,48.8],[1.5,50.5],[4.5,52.5],[8.5,54],[8.5,57.2],[10.5,57.6],[10.5,54.8],[14,54],[19,54.5],[21,56.5],[24,57.5],[24,59.5],[29,60],[22,60.2],[21.5,63],[25,65.2],[22,65.7],[17.5,62.5],[19,60.5],[16.5,56.5],[12.8,55.8],[11,59],[8,58],[5.5,59.5],[5,62],[10,64.5],[14,67.5],[19,70],[26,71],[31,70],[40,67.5],[41,66],[33,66.3],[34.5,64.5],[40.5,64.5],[44,66.5],[48,68],[54,68.5],[60,69.5],[68,69],[69,72],[72,73],[80,73.5],[87,75],[100,77],[106,77.5],[113,74],[125,73.5],[130,71],[140,72.5],[150,71.5],[160,70],[170,69.8],[180,68.8],[180,64.8],[177,62.5],[170,60],[163,59.5],[163,57],[156,51],[155.5,57],[150,59.2],[142,59],[136,54.5],[140.5,53],[141,48.5],[137,45],[132,43],[129.5,41],[129,37],[126.5,34.8],[126.5,37.5],[124.5,39.5],[121.5,39],[122,37.5],[119,37],[120.5,35],[122,31.5],[121,28],[119,25],[115,22.5],[110.5,21],[108,21.5],[106,19],[108.5,15.5],[109,11.5],[105,8.7],[104.5,10.5],[100.5,13.2],[99.5,9.5],[100.5,6.5],[103.5,1.5],[101.2,2.8],[98.5,8.5],[98.5,13.5],[97.5,16.5],[94.5,16],[94,19],[92,21.5],[89,22],[86.5,20.5],[82,16.5],[80.2,14],[79.8,10.2],[77.5,8],[76,10.5],[73.5,16.5],[72.8,21],[70,21],[68.5,23.5],[66.5,25.2],[61.5,25.2],[57,25.8],[56.2,27],[51.5,28],[50,30],[48.5,30],[48,29],[50.5,26.5],[51.5,24.5],[54,24],[56,25.5],[56.8,24.2],[59.5,22.5],[57.5,19],[55,17],[52,16],[48.5,14],[44,12.7],[43.2,13.5],[42.5,16.5],[39,21.5],[35.5,28],[34.8,29.5],[34.3,31],[35,33.5],[36,36],[32,36.3],[28,36.6],[26.5,38.5],[26.5,40],[29,41],[31,41.2],[36,41.7],[41,41],[41.5,42.5],[38,44.5],[36.5,45.5],[33,45.5],[33.5,46.2],[31,46.5],[29.8,45.3],[28.5,43.5],[28,41.8],[26,40.8],[23,40.5],[24,38],[22.8,36.5],[21.5,37.5],[19.5,40],[19.5,42],[16,43.5],[13.5,45.2],[12.3,44.5],[14,42],[16.5,41],[18.5,40],[16.5,38.2],[15.8,38],[16,40],[12.5,41.5],[10.5,43.5],[8.5,44.4],[6.5,43.2],[3.2,43.2],[3,41.8],[0.5,40.5],[-0.5,38.5],[-1,37],[-2,36.7],[-5,36.2],[-5.8,36],[-6.5,37],[-8.8,37]],
    // Îles : Royaume-Uni, Irlande, Islande, Japon, Hokkaido, Sri Lanka, Cuba, Hispaniola
    [[-5.5,50],[1.5,51],[1.7,53],[-0.5,54.5],[-2,56],[-2,57.7],[-3,58.6],[-5,58.5],[-6,57],[-5,55],[-3,54.8],[-3,53.4],[-4.5,52],[-5,51.7]],
    [[-10,51.8],[-6,52],[-6,54.5],[-8,55.2],[-10,54]],
    [[-24,65.5],[-18,66.5],[-14,65],[-18,63.5],[-22,63.8]],
    [[130,31],[132,33.5],[135,34],[137,34.5],[140,35],[141,38],[142,40],[141.5,41.5],[140,41],[139.5,40],[139,38],[137,36.8],[135,35.5],[132,35.5],[130,34]],
    [[140,42],[143,42],[145.5,43.5],[142,45.5],[140,43]],
    [[79.8,9.5],[81.8,7.5],[80.5,6],[79.8,7.5]],
    [[-85,22],[-80,23],[-74,20],[-77.5,19.8],[-82,22.5]],
    [[-74.5,19.8],[-69,19.5],[-68.5,18.3],[-72,18]],
    [[52,71],[57,70.7],[69,76.5],[60,76.3]],
    // Asie du Sud-Est
    [[95.5,5.5],[98,4],[104,-1],[106,-3.5],[104,-5.5],[101,-3],[97,2]],
    [[109,1.5],[111,2],[114,4.5],[117,7],[119,5],[118,1],[116,-4],[112,-3.5],[110,-3],[109,0]],
    [[105.5,-6.5],[108,-6.5],[114,-7.5],[114.5,-8.5],[106,-7.5]],
    [[119,-5],[120,-1],[121,1],[125,1.5],[123,-1],[122,-4],[121,-5],[119,-5.5]],
    [[131,-1],[134,-3],[138,-1.5],[141,-2.5],[145,-4.5],[148,-6],[150.5,-10.5],[147,-10],[143,-9],[141,-9],[138,-8.5],[137,-5.5],[133,-4]],
    [[120,18.5],[122,18.5],[122,14.5],[124,13],[121,13.5],[120,16]],
    [[122,8],[125,9.5],[126.5,7],[125.5,5.8],[123,7.5]],
    // Océanie
    [[114,-22],[114,-26],[115,-34],[119,-35],[124,-33.5],[131,-31.5],[135,-35],[138,-35.5],[140,-38],[144,-38.5],[147,-39],[150,-37],[153,-31],[153,-26],[149,-20],[146,-18.5],[145.5,-14.5],[142.5,-10.8],[141,-16.5],[136.5,-15.5],[137,-12],[132,-11.5],[129,-14.8],[126,-14],[122,-17.5],[119,-20]],
    [[145,-41],[148,-41],[147.5,-43.5],[146,-43.5]],
    [[173,-35],[176,-37.5],[178,-37.8],[175,-41.5],[174.5,-39.5]],
    [[172.5,-40.5],[174,-41.5],[171,-44.5],[169,-46.5],[166.5,-46],[168,-44],[171,-41.5]],
    // Antarctique
    [[-180,-78],[-150,-77],[-120,-74],[-100,-73],[-75,-72.5],[-65,-68],[-62,-65],[-57,-64.2],[-62,-68],[-65,-75],[-45,-78],[-30,-76],[-15,-71],[0,-70],[30,-69],[50,-67],[70,-68],[90,-66],[110,-66.5],[140,-66.5],[150,-70.5],[165,-72],[170,-77],[180,-78],[180,-90],[-180,-90]]
];
const DESERTS = [
    [[-16,17],[-10,26],[0,30],[10,31],[25,30],[34,27],[33,17],[24,15],[15,13],[0,15]],
    [[37,28],[48,30],[56,25],[52,17],[44,16],[40,21]],
    [[124,-20],[134,-23],[142,-26],[140,-30],[128,-31],[122,-26]],
    [[95,41],[110,44],[117,41],[105,38],[96,38]],
    [[14,-18],[20,-27],[16,-30],[12,-22]]
];
const FORETS = [
    [[-75,5],[-50,5],[-48,-8],[-60,-12],[-74,-8]],           // Amazonie
    [[8,6],[28,5],[30,-6],[14,-5],[9,0]],                    // Afrique centrale
    [[95,22],[108,22],[108,8],[100,2],[95,15]],              // Asie du Sud-Est
    [[95,-2],[118,5],[118,-4],[100,-4]]                      // Insulinde
];
const GLACES = [
    [[-60,60],[-18,60],[-18,84],[-73,84],[-73,76]],          // Groenland
    [[-180,72],[180,72],[180,90],[-180,90]]                  // Arctique
];

function polygone(ctx, pts, W, H, continuer) {
    if (!continuer) ctx.beginPath();
    pts.forEach(([lon, lat], i) => {
        const x = (lon + 180) / 360 * W, y = (90 - lat) / 180 * H;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath();
}

function construireTextureSecours() {
    const W = GLOBE.TW, H = GLOBE.TH;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2a5f9a'); g.addColorStop(0.2, '#14508f'); g.addColorStop(0.5, '#0d4a8e'); g.addColorStop(0.8, '#14508f'); g.addColorStop(1, '#2a5f9a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // eaux peu profondes autour des côtes
    ctx.save(); ctx.shadowColor = 'rgba(90,190,230,0.9)'; ctx.shadowBlur = 9; ctx.fillStyle = '#3f8f4a';
    TERRES.forEach(p => { polygone(ctx, p, W, H); ctx.fill(); });
    ctx.restore();
    // terres : vert, puis déserts, forêts, glaces
    ctx.fillStyle = '#4b9a4e'; TERRES.forEach(p => { polygone(ctx, p, W, H); ctx.fill(); });
    ctx.save();
    ctx.beginPath(); TERRES.forEach(p => polygone(ctx, p, W, H, true)); ctx.clip();      // un seul chemin = union des continents
    ctx.fillStyle = '#7fa656';
    ctx.fillRect(0, H * (90 - 62) / 180, W, H * 14 / 180);                // taïga / toundra
    ctx.fillStyle = '#d2bf8a'; DESERTS.forEach(p => { polygone(ctx, p, W, H); ctx.fill(); });
    ctx.fillStyle = '#2c7a3d'; FORETS.forEach(p => { polygone(ctx, p, W, H); ctx.fill(); });
    ctx.fillStyle = '#eef3f8'; GLACES.forEach(p => { polygone(ctx, p, W, H); ctx.fill(); });
    ctx.fillRect(0, H * (90 - 72) / 180, W, H * 0.001);
    ctx.fillRect(0, H * 156.5 / 180, W, H);                                // banquise antarctique
    ctx.restore();
    const img = ctx.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < d.length; i += 4) {                               // grain naturel
        const n = (Math.random() - 0.5) * 12;
        d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    definirTexture(d);
}

function definirTexture(rgba) {
    const W = GLOBE.TW, H = GLOBE.TH, eau = new Uint8Array(W * H);
    for (let i = 0, k = 0; i < rgba.length; i += 4, k++) {
        const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
        eau[k] = (b > r + 22 && b >= g - 4) ? 1 : 0;                      // océans et lacs → reflet du soleil
    }
    GLOBE.tex = rgba;
    GLOBE.eau = eau;
}

/* ---------- Vraie image satellite (NASA Blue Marble) ---------- */
function chargerImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.decoding = 'async';
        const t = setTimeout(() => { img.src = ''; reject(new Error('délai dépassé')); }, 25000);
        img.onload = () => { clearTimeout(t); resolve(img); };
        img.onerror = () => { clearTimeout(t); reject(new Error('échec')); };
        img.src = url;
    });
}

async function chargerTextureTerre() {
    try {
        const c = navigator.connection;
        if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) return;   // économise les données
    } catch (e) {}
    for (const url of GLOBE_URLS) {
        try {
            const img = await chargerImage(url);
            const cv = document.createElement('canvas'); cv.width = GLOBE.TW; cv.height = GLOBE.TH;
            const ctx = cv.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(img, 0, 0, GLOBE.TW, GLOBE.TH);
            definirTexture(ctx.getImageData(0, 0, GLOBE.TW, GLOBE.TH).data);   // lève une erreur si l'image est « tainted »
            GLOBE.reel = true;
            fabriquerVignette();
            return;
        } catch (e) { /* source suivante */ }
    }
}

/* ---------- Un globe dessiné sur un <canvas> ---------- */
const LUMIERE = (() => { const l = [-0.55, 0.5, 0.68], n = Math.hypot(...l); return l.map(v => v / n); })();

function preparerGlobe(canvas) {
    const taille = parseInt(canvas.dataset.size, 10) || canvas.clientWidth || 44;
    const dpr = Math.min(window.devicePixelRatio || 1, taille > 120 ? 1.25 : 2);
    const n = Math.max(24, Math.round(taille * dpr));
    canvas.width = canvas.height = n;
    canvas.style.width = canvas.style.height = taille + 'px';
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(n, n);
    const incl = 0.4, cT = Math.cos(incl), sT = Math.sin(incl);
    const pix = [], rowv = [], u0 = [], lum = [], rim = [], spec = [], alpha = [];
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            const nx = (x + 0.5) / n * 2 - 1, ny = 1 - (y + 0.5) / n * 2, r2 = nx * nx + ny * ny;
            if (r2 >= 1.0) continue;
            const nz = Math.sqrt(1 - r2);
            const y1 = ny * cT + nz * sT, z1 = -ny * sT + nz * cT;           // inclinaison de l'axe
            const lat = Math.asin(Math.max(-1, Math.min(1, y1)));
            const lon = Math.atan2(nx, z1);
            rowv.push(Math.min(GLOBE.TH - 1, Math.max(0, ((0.5 - lat / Math.PI) * GLOBE.TH) | 0)));
            u0.push(lon / (2 * Math.PI) + 0.5);
            const dif = nx * LUMIERE[0] + ny * LUMIERE[1] + nz * LUMIERE[2];
            lum.push(0.2 + 0.95 * Math.max(0, dif));
            // reflet du soleil sur l'eau
            const rx = 2 * dif * nx - LUMIERE[0], ry = 2 * dif * ny - LUMIERE[1], rz = 2 * dif * nz - LUMIERE[2];
            spec.push(Math.pow(Math.max(0, rz), 22) * 0.55 * (dif > 0 ? 1 : 0));
            rim.push(Math.pow(1 - nz, 2.6) * (0.35 + 0.65 * Math.max(0, dif + 0.3)));
            alpha.push(Math.max(0, Math.min(1, (1 - Math.sqrt(r2)) * n * 0.55)));
            pix.push((y * n + x) * 4);
        }
    }
    canvas.__g = { ctx, img, n, pix: Int32Array.from(pix), rowv: Uint16Array.from(rowv), u0: Float32Array.from(u0),
                   lum: Float32Array.from(lum), rim: Float32Array.from(rim), spec: Float32Array.from(spec), alpha: Float32Array.from(alpha) };
}

function dessinerGlobe(canvas, rotation) {
    const G = canvas.__g, T = GLOBE.tex, E = GLOBE.eau;
    if (!G || !T) return;
    const d = G.img.data, TW = GLOBE.TW, m = G.pix.length;
    for (let k = 0; k < m; k++) {
        let xi = ((G.u0[k] - rotation) * TW) | 0;
        xi = ((xi % TW) + TW) % TW;
        const ti = G.rowv[k] * TW + xi, t = ti * 4;
        const l = G.lum[k], rm = G.rim[k], sp = E[ti] ? G.spec[k] * 255 : 0;
        let r = T[t] * l + sp + rm * 90, g = T[t + 1] * l + sp + rm * 165, b = T[t + 2] * l + sp + rm * 255;
        const p = G.pix[k];
        d[p] = r > 255 ? 255 : r; d[p + 1] = g > 255 ? 255 : g; d[p + 2] = b > 255 ? 255 : b;
        d[p + 3] = G.alpha[k] * 255;
    }
    G.ctx.putImageData(G.img, 0, 0);
}

/** Petite image fixe du globe : sert d'icône dans les bulles de discussion */
function fabriquerVignette() {
    try {
        const c = document.createElement('canvas'); c.dataset.size = '72';
        preparerGlobe(c); dessinerGlobe(c, 0.52);
        document.documentElement.style.setProperty('--globe-img', 'url(' + c.toDataURL('image/png') + ')');
    } catch (e) {}
}

function initialiserGlobes() {
    document.querySelectorAll('canvas.globe').forEach(c => {
        if (c.__g) return;
        if (!GLOBE.tex) construireTextureSecours();
        preparerGlobe(c);
        GLOBE.instances.push(c);
        dessinerGlobe(c, GLOBE.spin);
    });
    GLOBE.instances = GLOBE.instances.filter(c => c.isConnected);
    if (!GLOBE.raf && !GLOBE.statique && GLOBE.instances.length) GLOBE.raf = requestAnimationFrame(boucleGlobes);
}

function boucleGlobes(t) {
    GLOBE.raf = requestAnimationFrame(boucleGlobes);
    if (document.hidden) return;
    if (t - GLOBE.dernier < 55) return;                                    // ~18 images/s : fluide et économe
    GLOBE.dernier = t;
    GLOBE.spin = (t / 1000) * 0.012;                                       // un tour en ~83 s
    GLOBE.instances = GLOBE.instances.filter(c => c.isConnected);
    GLOBE.instances.forEach(c => { if (c.offsetParent !== null) dessinerGlobe(c, GLOBE.spin); });
}

(function demarrerGlobes() {
    try { GLOBE.statique = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    const go = () => {
        initialiserGlobes();
        fabriquerVignette();
        // la vraie image est chargée un peu plus tard, sans gêner le démarrage
        (window.requestIdleCallback || (f => setTimeout(f, 2500)))(() => setTimeout(chargerTextureTerre, 1200));
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();


// ---------- Initialisation ----------
document.addEventListener('DOMContentLoaded', initialiserSelecteurPays);   // après le chargement complet du script
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

/* Studio ELAWS EVAT */
let studioTypeActif = 'storyboard', studioEnCours = false, studioDernierTexte = '';
function studioChoisirType(btn) {
    document.querySelectorAll('#studioTypes .studio-chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    studioTypeActif = btn.getAttribute('data-type') || 'storyboard';
}
function studioCopier() {
    const el = document.getElementById('studioResultContent');
    if (!el) return;
    navigator.clipboard.writeText(el.innerText || '').then(() => montrerNotification('Copié')).catch(() => {});
}
function studioLireAudio() {
    if (!studioDernierTexte || !window.speechSynthesis) return;
    if (speechSynthesis.speaking) { speechSynthesis.cancel(); return; }
    const u = new SpeechSynthesisUtterance(studioDernierTexte.replace(/#{1,6}\s*/g, '').slice(0, 3500));
    u.lang = 'fr-FR';
    speechSynthesis.speak(u);
}
function studioGenerer() {
    if (!utilisateur) return montrerNotification('Connectez-vous d’abord');
    if (studioEnCours) return;
    const texte = ((document.getElementById('studioPrompt') || {}).value || '').trim();
    if (!texte) return montrerNotification('Écrivez ce que vous voulez créer');
    const consignes = {
        storyboard: `Produis un STORYBOARD professionnel prêt à tourner.

Pour CHAQUE plan, utilise exactement ce format :
### Plan N — Xs
- **Cadre :** plan large / moyen / serré + angle
- **Image :** décor, personnages, lumière, mouvement
- **Action :** ce qui se passe
- **Voix-off / dialogue :** texte exact (ou silence)
- **Son :** musique / ambiance / effet
- **Texte à l'écran :** si utile

À la fin :
## Résumé timing (total)
## Prompt visuel global (1 paragraphe pour génération vidéo IA)
## Conseils de tournage (3 points max)

Sois concret et utilisable tout de suite.`,
        spot: `Produis un SPOT publicitaire 15–30 secondes.
1) Voix-off complète
2) Version ultra-courte (8 s)
3) 3 accroches alternatives
4) Storyboard plan par plan (cadre, image, action, voix, durée)
5) Prompt visuel global pour IA vidéo
Contenu prêt à l'emploi.`,
        podcast: `Produis un script de PODCAST oral (4–7 min).
Structure : intro accrocheuse, 2–3 parties, conclusion + appel à l'action.
Indique le ton (chaleureux, pro, énergique…).
Termine par une section ## TEXTE À LIRE (script propre pour synthèse vocale, sans indications techniques).`,
        reseaux: `Produis 3 posts réseaux prêts à publier (variantes de ton).
Pour chaque post : texte + 5–10 hashtags + idée de visuel en une ligne.`
    };
    const prompt = (consignes[studioTypeActif] || consignes.storyboard) + '\n\nDemande :\n' + texte + '\n\nRéponds en français, avec des titres ##.';
    const status = document.getElementById('studioStatus');
    const box = document.getElementById('studioResultats');
    const content = document.getElementById('studioResultContent');
    const btn = document.getElementById('studioGenerateBtn');
    if (status) { status.style.display = 'block'; status.textContent = 'Génération…'; }
    if (box) box.style.display = 'none';
    if (btn) btn.disabled = true;
    studioEnCours = true;
    const reqId = 'studio' + Date.now().toString(36);
    let buf = '';
    const off = () => { socket.off('ai_chunk', onChunk); socket.off('ai_done', onDone); socket.off('ai_error', onErr); studioEnCours = false; if (btn) btn.disabled = false; };
    const onChunk = d => { if (!d || d.reqId !== reqId) return; buf += d.text || ''; if (content) content.innerHTML = typeof mdVersHtml === 'function' ? mdVersHtml(buf) : buf.replace(/</g,'<'); if (box) box.style.display = 'block'; };
    const onDone = d => { if (!d || d.reqId !== reqId) return; off(); if (status) status.style.display = 'none'; studioDernierTexte = (d.text || buf || '').trim(); if (content) content.innerHTML = typeof mdVersHtml === 'function' ? mdVersHtml(studioDernierTexte) : studioDernierTexte.replace(/</g,'<'); if (box) box.style.display = 'block'; };
    const onErr = d => { if (!d || d.reqId !== reqId) return; off(); if (status) { status.style.display = 'block'; status.textContent = d.error || 'Erreur'; } };
    socket.on('ai_chunk', onChunk); socket.on('ai_done', onDone); socket.on('ai_error', onErr);
    socket.emit('ai_ask', { mode: 'general', reqId, texte: prompt, studio: true }, res => { if (!res || !res.ok) onErr({ reqId, error: (res && res.error) || 'IA indisponible' }); });
}

/* ============================================================
   Améliorations v4.11 : actions sur les messages (répondre / copier / supprimer),
   bandeau de connexion, alerte « nouvelle version »
   ============================================================ */
const APP_BUILD = '4.11.0';

// Aperçu d'une conversation : on saute la citation d'une réponse
function texteApercu(t) {
    t = String(t || '');
    return (t.startsWith('↩️ ') && t.indexOf('\n') > 0) ? t.slice(t.indexOf('\n') + 1) : t;
}

// Message de réponse : la 1re ligne « ↩️ Nom : « extrait » » est affichée comme une citation
function texteMsgHtml(t) {
    t = String(t || '');
    if (t.startsWith('↩️ ') && t.indexOf('\n') > 0) {
        const i = t.indexOf('\n');
        const reste = t.slice(i + 1);
        return '<blockquote class="msg-quote">' + escapeHtml(t.slice(3, i)) + '</blockquote>' + (reste ? '<p>' + lierUrls(escapeHtml(reste)) + '</p>' : '');
    }
    return '<p>' + lierUrls(escapeHtml(t)) + '</p>';
}

// Liens http(s) cliquables (le texte est déjà échappé : aucun HTML venant de l'expéditeur ne passe)
function lierUrls(htmlEchappe) {
    return htmlEchappe.replace(/\bhttps?:\/\/[^\s<]+/g, (u) => {
        const fin = (u.match(/[).,;!?]+$/) || [''])[0];
        const lien = fin ? u.slice(0, -fin.length) : u;
        return '<a href="' + lien + '" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline;word-break:break-all">' + lien + '</a>' + fin;
    });
}

(function () {
    const st = document.createElement('style');
    st.textContent =
        '.msg-bubble{-webkit-touch-callout:none}' +
        '.evat-msg-menu{position:fixed;z-index:10050;background:#16213e;color:#fff;border:1px solid rgba(120,160,255,.35);border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.45);padding:6px;min-width:200px}' +
        '.evat-msg-menu button{display:block;width:100%;text-align:left;background:none;border:0;color:inherit;padding:12px;border-radius:8px;font-size:15px;font-family:inherit}' +
        '.evat-msg-menu button:hover,.evat-msg-menu button:active{background:rgba(120,160,255,.2)}' +
        '.msg-quote{margin:0 0 6px;padding:6px 9px;border-left:3px solid #5aa0ff;background:rgba(255,255,255,.1);border-radius:6px;font-size:.85em;opacity:.92;white-space:pre-wrap;word-break:break-word}' +
        '#evatNetBar{display:none;position:fixed;left:0;right:0;top:0;z-index:9000;padding:calc(6px + env(safe-area-inset-top,0px)) 12px 6px;text-align:center;font-size:13px;background:#b45309;color:#fff}' +
        '#evatMajBar{position:fixed;left:12px;right:12px;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:10040;display:flex;gap:10px;align-items:center;justify-content:space-between;padding:12px 14px;border-radius:14px;background:#16a34a;color:#fff;font-size:14px;box-shadow:0 8px 30px rgba(0,0,0,.4)}' +
        '#evatMajBar button{border:0;border-radius:10px;padding:9px 14px;background:#fff;color:#166534;font-weight:700;font-size:14px}';
    document.head.appendChild(st);

    /* ----- Menu d'un message : appui long (téléphone) ou clic droit (ordinateur) ----- */
    let menu = null, minuteur = null, depart = null;
    const fermerMenu = () => { if (menu) { menu.remove(); menu = null; } };
    const msgDe = (bulle) => {
        const id = bulle && bulle.dataset.mid;
        return id ? (utilisateur.messagesLocaux || []).find(z => String(z.id) === id || z.cid === id) : null;
    };
    const copier = (t) => {
        const ok = () => montrerNotification('📋 Message copié');
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok).catch(() => {});
        else { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); ok(); } catch (e) {} a.remove(); }
    };
    const repondre = (m) => {
        const input = document.getElementById('chatLocalInput');
        if (!input) return;
        const brut = (m.texte && m.texte !== '📷 Photo' && m.texte !== '🎤 Message vocal') ? m.texte.replace(/^↩️ [^\n]*\n/, '') : (m.image ? '📷 Photo' : '🎤 Message vocal');
        const extrait = brut.replace(/\s+/g, ' ').slice(0, 70) + (brut.length > 70 ? '…' : '');
        const qui = m.fromMe ? 'Vous' : (m.expediteur || 'Contact');
        input.value = '↩️ ' + qui + ' : « ' + extrait + ' »\n';
        if (typeof autoResize === 'function') autoResize(input);
        input.focus();
    };
    const supprimer = (m) => {
        utilisateur.messagesLocaux = (utilisateur.messagesLocaux || []).filter(z => z !== m);
        const sup = utilisateur.messagesSupprimes = utilisateur.messagesSupprimes || [];
        if (m.id) sup.push(m.id);
        if (m.cid && m.cid !== m.id) sup.push(m.cid);
        if (sup.length > 500) utilisateur.messagesSupprimes = sup.slice(-500);
        sauverProfil();
        rendreMessagesLocaux();
        montrerNotification('🗑️ Message supprimé de cet appareil');
    };
    function ouvrirMenu(bulle, x, y) {
        const m = utilisateur && msgDe(bulle);
        if (!m) return;
        fermerMenu();
        menu = document.createElement('div');
        menu.className = 'evat-msg-menu';
        const rangee = document.createElement('div');
        rangee.className = 'evat-msg-reacts';
        REACTIONS.forEach(em => { const b = document.createElement('button'); b.type = 'button'; b.textContent = em; b.onclick = () => { fermerMenu(); reagirAuMessage(m, em); }; rangee.appendChild(b); });
        menu.appendChild(rangee);
        const actions = [['↩️ Répondre', () => repondre(m)]];
        if (m.texte && m.texte !== '📷 Photo' && m.texte !== '🎤 Message vocal') actions.push(['📋 Copier le texte', () => copier(m.texte.replace(/^↩️ [^\n]*\n/, ''))]);
        if (m.texte && m.texte !== '📷 Photo' && m.texte !== '🎤 Message vocal') actions.push([m.trad && !m.tradMasquee ? '🌐 Masquer la traduction' : '🌐 Traduire', () => (m.trad && !m.tradMasquee) ? masquerTraduction(m) : traduireMessage(m, true)]);
        actions.push(['🗑️ Supprimer pour moi', () => supprimer(m)]);
        actions.forEach(([libelle, fn]) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = libelle;
            b.onclick = () => { fermerMenu(); fn(); };
            menu.appendChild(b);
        });
        document.body.appendChild(menu);
        const r = menu.getBoundingClientRect();
        menu.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
        menu.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + 'px';
    }
    const bulleSous = (e) => e.target.closest && e.target.closest('#listeMessagesLocaux .msg-bubble');
    document.addEventListener('contextmenu', (e) => {
        const b = bulleSous(e);
        if (!b) return;
        e.preventDefault();
        if (!menu) ouvrirMenu(b, e.clientX, e.clientY);
    });
    document.addEventListener('touchstart', (e) => {
        const b = bulleSous(e);
        if (!b || e.target.closest('.msg-audio-play, img')) return;
        const t = e.touches[0];
        depart = { x: t.clientX, y: t.clientY };
        clearTimeout(minuteur);
        minuteur = setTimeout(() => { if (!menu) ouvrirMenu(b, depart.x, depart.y); }, 500);
    }, { passive: true });
    const annuler = () => clearTimeout(minuteur);
    document.addEventListener('touchmove', (e) => {
        if (!depart) return;
        const t = e.touches[0];
        if (Math.abs(t.clientX - depart.x) > 10 || Math.abs(t.clientY - depart.y) > 10) annuler();
    }, { passive: true });
    document.addEventListener('touchend', annuler, { passive: true });
    document.addEventListener('touchcancel', annuler, { passive: true });
    document.addEventListener('pointerdown', (e) => { if (menu && !e.target.closest('.evat-msg-menu')) fermerMenu(); }, true);
    document.addEventListener('scroll', fermerMenu, true);

    /* ----- Bandeau de connexion (le serveur gratuit met jusqu'à 30-50 s à se réveiller) ----- */
    const barre = document.createElement('div');
    barre.id = 'evatNetBar';
    document.body.appendChild(barre);
    let coupeDepuis = 0;
    function majBarre() {
        let t = '';
        if (!navigator.onLine) t = '📡 Hors ligne — vos messages partiront dès le retour du réseau';
        else if (utilisateur && !socket.connected) {
            if (!coupeDepuis) coupeDepuis = Date.now();
            if (Date.now() - coupeDepuis > 4000) t = '🔄 Connexion au serveur… (au réveil, cela peut prendre jusqu’à 30 secondes)';
        }
        if (socket.connected) coupeDepuis = 0;
        barre.textContent = t;
        barre.style.display = t ? 'block' : 'none';
    }
    window.addEventListener('online', majBarre);
    window.addEventListener('offline', majBarre);
    socket.on('connect', majBarre);
    socket.on('disconnect', majBarre);
    setInterval(majBarre, 2000);

    /* ----- « Nouvelle version disponible » : s'affiche quand le service worker a été mis à jour ----- */
    if ('serviceWorker' in navigator) {
        const avaitUnControleur = !!navigator.serviceWorker.controller;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!avaitUnControleur || document.getElementById('evatMajBar')) return;
            const b = document.createElement('div');
            b.id = 'evatMajBar';
            b.innerHTML = '<span>✨ Nouvelle version d’EVAT prête</span><button type="button">Mettre à jour</button>';
            b.querySelector('button').onclick = () => location.reload();
            document.body.appendChild(b);
        });
    }
})();

/* ============================================================
   v4.12 : réactions aux messages, une interface dédiée par grand titre, thème clair/sombre
   ============================================================ */
const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

function reactionsHtml(m) {
    const r = m && m.reactions;
    if (!r) return '';
    const moi = utilisateur && utilisateur.telephone;
    const puces = Object.keys(r).filter(e => r[e] && r[e].length).map(e =>
        '<button type="button" class="msg-react' + (r[e].includes(moi) ? ' mine' : '') + '" data-react="' + escapeHtml(e) + '" data-mid="' + escapeHtml(String(m.id || m.cid || '')) + '">' + e + (r[e].length > 1 ? ' <i>' + r[e].length + '</i>' : '') + '</button>');
    return puces.length ? '<div class="msg-reacts">' + puces.join('') + '</div>' : '';
}

function reagirAuMessage(m, emoji) {
    if (!m || !utilisateur || !m.id || m.etat === 'pending' || m.etat === 'failed') { montrerNotification('⏳ Attendez que le message soit envoyé.'); return; }
    const moi = utilisateur.telephone;
    const r = m.reactions = m.reactions || {};
    const avait = (r[emoji] || []).includes(moi);
    Object.keys(r).forEach(e => { r[e] = r[e].filter(t => t !== moi); if (!r[e].length) delete r[e]; });
    if (!avait) (r[emoji] = r[emoji] || []).push(moi);
    if (!Object.keys(r).length) m.reactions = null;
    sauverProfil();
    rendreMessagesLocaux();
    socket.emit('react_message', { id: m.id, emoji }, (res) => { if (!res || !res.ok) montrerNotification('⚠️ Réaction non envoyée.'); });
}

socket.on('message_reaction', (d) => {
    if (!utilisateur || !d || !d.id) return;
    const m = (utilisateur.messagesLocaux || []).find(x => x.id === d.id);
    if (!m) return;
    m.reactions = (d.reactions && Object.keys(d.reactions).length) ? d.reactions : null;
    sauverProfil();
    rendreMessagesLocaux();
});

document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.msg-react');
    if (!b || !utilisateur) return;
    const id = b.dataset.mid;
    const m = (utilisateur.messagesLocaux || []).find(z => String(z.id) === id || z.cid === id);
    if (m) reagirAuMessage(m, b.dataset.react);
});

(function () {
    const st = document.createElement('style');
    st.textContent =
        '.msg-reacts{display:flex;flex-wrap:wrap;gap:4px;margin:4px 0 0}' +
        '.msg-react{border:1px solid rgba(120,160,255,.35);background:rgba(120,160,255,.14);color:inherit;border-radius:999px;padding:1px 8px;font-size:14px;line-height:22px;cursor:pointer;font-family:inherit}' +
        '.msg-react.mine{background:rgba(59,156,255,.35);border-color:#3b9cff}.msg-react i{font-style:normal;font-size:12px;opacity:.85}' +
        '.evat-msg-reacts{display:flex;gap:2px;padding:4px 4px 6px;border-bottom:1px solid rgba(120,160,255,.2);margin-bottom:4px}' +
        '.evat-msg-reacts button{flex:1;text-align:center;padding:6px 0;font-size:22px}';
    document.head.appendChild(st);
})();

/* ---------- Thème clair / sombre / automatique ---------- */
function themeChoisi() { try { return localStorage.getItem('evat_theme') || 'sombre'; } catch (e) { return 'sombre'; } }
function appliquerTheme() {
    const t = themeChoisi();
    const clair = t === 'clair' || (t === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches);
    if (clair) document.documentElement.setAttribute('data-theme', 'light'); else document.documentElement.removeAttribute('data-theme');
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', clair ? '#f3f6fb' : '#030712');
    document.querySelectorAll('[data-theme-choix]').forEach(b => b.classList.toggle('active', b.dataset.themeChoix === t));
}
function choisirTheme(t) {
    try { localStorage.setItem('evat_theme', t); } catch (e) {}
    appliquerTheme();
}
if (window.matchMedia) {
    try { matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (themeChoisi() === 'auto') appliquerTheme(); }); } catch (e) {}
}
appliquerTheme();

/* ============================================================
   v4.14 : visio de groupe (Jitsi), invitations, messages de partenaires
   ============================================================ */
// Visio gratuite via Jitsi Meet : une salle au nom imprévisible, le lien est envoyé dans la discussion (1 à 1 ou groupe)
function lancerVisioGroupe() {
    if (!utilisateur || !convoOuverte || estCleService(convoOuverte)) return;
    const alea = Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 12);
    const url = 'https://meet.jit.si/EVAT-' + alea;
    const input = document.getElementById('chatLocalInput');
    if (!input) return;
    input.value = '🎥 Rejoins la visio EVAT : ' + url;
    envoyerMessageChatLocal();
    window.open(url, '_blank', 'noopener');
}

// Invitation d'un contact qui n'est pas encore sur EVAT : WhatsApp ou SMS depuis le téléphone de l'utilisateur (gratuit côté EVAT)
function majInvitationFiche(contact) {
    const statut = document.getElementById('contactFicheStatut');
    if (!statut) return;
    let box = document.getElementById('ficheInviter');
    if (!box) {
        box = document.createElement('div');
        box.id = 'ficheInviter';
        box.style.cssText = 'display:flex;gap:8px;justify-content:center;margin:10px 0 0;flex-wrap:wrap';
        statut.insertAdjacentElement('afterend', box);
    }
    const tel = contact && contact.telephone;
    if (!tel || contact.surEVAT) { box.style.display = 'none'; box.innerHTML = ''; return; }
    const texte = 'Salut ! Je suis sur EVAT : messages, appels et visio gratuits. Rejoins-moi : ' + location.origin;
    const num = String(tel).replace(/[^\d]/g, '');
    box.style.display = 'flex';
    box.innerHTML = '<span style="width:100%;text-align:center;font-size:12px;opacity:.8">Pas encore sur EVAT — invitez-le :</span>' +
        '<a class="btn-mini success" style="text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/' + num + '?text=' + encodeURIComponent(texte) + '">💬 WhatsApp</a>' +
        '<a class="btn-mini" style="text-decoration:none;color:#fff;background:rgba(120,160,255,.25);border-radius:999px;padding:6px 12px" href="sms:' + escapeHtml(tel) + '?&body=' + encodeURIComponent(texte) + '">✉️ SMS</a>';
}

(function () {
    const st = document.createElement('style');
    st.textContent = '#chatView.convo-service .chat-toolbar{display:none!important}#chatView.convo-service #btnChatVisio{display:none}';
    document.head.appendChild(st);
})();

/* ============================================================
   v4.15 : Statuts de 24 heures (texte sur fond coloré ou photo), visibles par vos contacts
   ============================================================ */
let statutsCache = [];
const _statutImages = new Map();
const STATUT_COULEURS = ['#0e7490', '#16a34a', '#7c3aed', '#db2777', '#ea580c', '#1d4ed8', '#374151'];

function ilYaStatut(ts) {
    const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if (m < 1) return 'à l’instant';
    if (m < 60) return 'il y a ' + m + ' min';
    return 'il y a ' + Math.round(m / 60) + ' h';
}
function nomPosteurStatut(tel, nomServeur) {
    if (utilisateur && tel === utilisateur.telephone) return 'Mon statut';
    const c = (utilisateur && utilisateur.contacts || []).find(x => x.telephone === tel);
    return (c && c.nom) || nomServeur || tel;
}

function chargerStatuts() {
    if (!utilisateur || !socket.connected) return;
    socket.emit('statuts_lister', { telephones: (utilisateur.contacts || []).map(c => c.telephone).filter(Boolean) }, (res) => {
        if (!res || !res.ok) return;
        statutsCache = res.statuts || [];
        rendreBandeStatuts();
    });
}

function groupesStatuts() {
    const g = new Map();
    statutsCache.forEach(s => { if (!g.has(s.from)) g.set(s.from, []); g.get(s.from).push(s); });
    g.forEach(l => l.sort((a, b) => a.ts - b.ts));
    return g;
}

function rendreBandeStatuts() {
    const bande = document.getElementById('statutBande');
    if (!bande || !utilisateur) return;
    const g = groupesStatuts();
    const moi = utilisateur.telephone;
    const miens = g.get(moi) || [];
    const autres = [...g.entries()].filter(([t]) => t !== moi).map(([t, l]) => ({
        tel: t, nom: nomPosteurStatut(t, l[0].nom), nonVu: l.some(x => !x.vu), dernier: l[l.length - 1].ts
    })).sort((a, b) => (b.nonVu - a.nonVu) || (b.dernier - a.dernier));
    const item = (tel, nom, etat, plus) =>
        '<div class="statut-item" data-tel="' + escapeHtml(tel) + '"><span class="statut-anneau ' + etat + '"><span class="statut-avatar">' + escapeHtml(initialesDe(nom === 'Mon statut' ? (utilisateur.nom || 'Moi') : nom)) + '</span>' +
        (plus ? '<button type="button" class="statut-plus" data-act="nouveau" aria-label="Ajouter un statut">+</button>' : '') + '</span><span class="statut-nom">' + escapeHtml(nom) + '</span></div>';
    bande.innerHTML = item(moi, 'Mon statut', miens.length ? 'vu' : 'aucun', true) + autres.map(a => item(a.tel, a.nom, a.nonVu ? 'nonvu' : 'vu', false)).join('');
}

document.addEventListener('click', (e) => {
    const bande = e.target.closest && e.target.closest('#statutBande');
    if (!bande) return;
    if (e.target.closest('[data-act="nouveau"]')) { ouvrirComposerStatut(); return; }
    const it = e.target.closest('.statut-item');
    if (!it) return;
    const tel = it.dataset.tel;
    const liste = groupesStatuts().get(tel);
    if (liste && liste.length) {
        let depart = liste.findIndex(x => !x.vu);
        ouvrirVisionneuseStatut(tel, depart < 0 ? 0 : depart);
    } else if (tel === utilisateur.telephone) ouvrirComposerStatut();
});

/* ----- Création d'un statut ----- */
let _statutPhoto = null, _statutBg = STATUT_COULEURS[0];
function ouvrirComposerStatut() {
    fermerComposerStatut();
    _statutPhoto = null; _statutBg = STATUT_COULEURS[0];
    const o = document.createElement('div');
    o.id = 'statutComposer';
    o.className = 'statut-overlay';
    o.innerHTML =
        '<div class="statut-ecran" id="statutEcran">' +
        '<div class="statut-haut"><button type="button" class="statut-btn" id="stCancel" aria-label="Annuler">✕</button><span>Nouveau statut · 24 h</span><span></span></div>' +
        '<textarea id="statutTexte" maxlength="700" placeholder="Écrivez votre statut…" aria-label="Texte du statut"></textarea>' +
        '<div class="statut-bas"><div class="statut-palette" id="statutPalette"></div>' +
        '<div class="statut-actions"><label class="statut-btn" for="statutFichier" title="Ajouter une photo">📷 Photo</label><input type="file" id="statutFichier" accept="image/*" hidden>' +
        '<button type="button" class="statut-publier" id="stPublier">Publier ➤</button></div>' +
        '<small class="statut-info">Visible 24 h par les personnes qui ont votre numéro dans leurs contacts.</small></div></div>';
    document.body.appendChild(o);
    const ecran = document.getElementById('statutEcran');
    const appliquerFond = () => {
        ecran.style.background = _statutPhoto ? '#000 center/contain no-repeat url(' + _statutPhoto + ')' : _statutBg;
        document.getElementById('statutTexte').placeholder = _statutPhoto ? 'Ajouter une légende…' : 'Écrivez votre statut…';
        ecran.classList.toggle('avec-photo', !!_statutPhoto);
    };
    document.getElementById('statutPalette').innerHTML = STATUT_COULEURS.map(c => '<button type="button" class="statut-couleur" data-c="' + c + '" style="background:' + c + '" aria-label="Couleur"></button>').join('');
    document.getElementById('statutPalette').onclick = (e) => { const b = e.target.closest('[data-c]'); if (b) { _statutBg = b.dataset.c; _statutPhoto = null; appliquerFond(); } };
    document.getElementById('stCancel').onclick = fermerComposerStatut;
    document.getElementById('statutFichier').onchange = async (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        try {
            const url = await compresserImageChat(f);
            if (!url) { montrerNotification('⚠️ Photo trop lourde, choisissez-en une autre.'); return; }
            _statutPhoto = url; appliquerFond();
        } catch (err) { montrerNotification('⚠️ Photo illisible.'); }
    };
    document.getElementById('stPublier').onclick = () => {
        const texte = document.getElementById('statutTexte').value.trim();
        if (!texte && !_statutPhoto) { montrerNotification('✍️ Écrivez un texte ou ajoutez une photo.'); return; }
        const btn = document.getElementById('stPublier');
        btn.disabled = true; btn.textContent = 'Envoi…';
        socket.emit('statut_publier', { texte, bg: _statutBg, image: _statutPhoto }, (res) => {
            if (res && res.ok) { fermerComposerStatut(); montrerNotification('✅ Statut publié pour 24 h'); chargerStatuts(); }
            else { btn.disabled = false; btn.textContent = 'Publier ➤'; montrerNotification('⚠️ ' + ((res && res.error) || 'Publication impossible, réessayez.')); }
        });
    };
    appliquerFond();
    setTimeout(() => { const t = document.getElementById('statutTexte'); if (t) t.focus(); }, 100);
}
function fermerComposerStatut() { const o = document.getElementById('statutComposer'); if (o) o.remove(); }

/* ----- Lecture des statuts ----- */
let _sv = null;
function fermerVisionneuseStatut() {
    if (_sv && _sv.timer) clearTimeout(_sv.timer);
    const o = document.getElementById('statutViewer'); if (o) o.remove();
    document.removeEventListener('keydown', _svTouches);
    _sv = null;
    rendreBandeStatuts();
}
function _svTouches(e) {
    if (!_sv) return;
    if (e.key === 'Escape') fermerVisionneuseStatut();
    else if (e.key === 'ArrowRight') statutSuivant();
    else if (e.key === 'ArrowLeft') statutPrecedent();
}
function ouvrirVisionneuseStatut(tel, depart) {
    const liste = groupesStatuts().get(tel);
    if (!liste || !liste.length) return;
    if (document.getElementById('statutViewer')) fermerVisionneuseStatut();
    _sv = { tel, liste: liste.slice(), i: Math.min(depart || 0, liste.length - 1), timer: null, proprio: tel === utilisateur.telephone };
    const o = document.createElement('div');
    o.id = 'statutViewer';
    o.className = 'statut-overlay';
    o.innerHTML =
        '<div class="statut-ecran" id="svEcran">' +
        '<div class="sv-barres" id="svBarres"></div>' +
        '<div class="sv-entete"><span class="statut-avatar petit" id="svAvatar"></span><div class="sv-qui"><strong id="svNom"></strong><small id="svHeure"></small></div><button type="button" class="statut-btn" id="svFermer" aria-label="Fermer">✕</button></div>' +
        '<div class="sv-zone" id="svZone"><div class="sv-texte" id="svTexte"></div></div>' +
        '<div class="sv-pied" id="svPied"></div>' +
        '<div class="sv-vues" id="svVues" hidden></div></div>';
    document.body.appendChild(o);
    document.addEventListener('keydown', _svTouches);
    document.getElementById('svFermer').onclick = fermerVisionneuseStatut;
    document.getElementById('svZone').onclick = (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        (e.clientX - r.left < r.width * 0.3) ? statutPrecedent() : statutSuivant();
    };
    afficherStatutCourant();
}
function statutSuivant() { if (!_sv) return; if (_sv.i + 1 >= _sv.liste.length) fermerVisionneuseStatut(); else { _sv.i++; afficherStatutCourant(); } }
function statutPrecedent() { if (!_sv) return; if (_sv.i > 0) _sv.i--; afficherStatutCourant(); }

function afficherStatutCourant() {
    if (!_sv) return;
    clearTimeout(_sv.timer);
    const s = _sv.liste[_sv.i];
    const ecran = document.getElementById('svEcran');
    const barres = document.getElementById('svBarres');
    barres.innerHTML = _sv.liste.map((x, k) => '<span class="sv-barre"><i class="' + (k < _sv.i ? 'plein' : '') + '"></i></span>').join('');
    document.getElementById('svNom').textContent = nomPosteurStatut(s.from, s.nom);
    document.getElementById('svHeure').textContent = ilYaStatut(s.ts);
    document.getElementById('svAvatar').textContent = initialesDe(nomPosteurStatut(s.from, s.nom) === 'Mon statut' ? (utilisateur.nom || 'Moi') : nomPosteurStatut(s.from, s.nom));
    const texteEl = document.getElementById('svTexte');
    texteEl.textContent = s.texte || '';
    texteEl.className = 'sv-texte' + (s.hasImage ? ' legende' : '') + ((s.texte || '').length > 120 ? ' long' : '');
    ecran.style.background = s.hasImage ? '#000' : s.bg;
    document.getElementById('svVues').hidden = true;
    const pied = document.getElementById('svPied');
    pied.innerHTML = _sv.proprio ? '<button type="button" class="statut-btn" id="svVoirVues">👁 ' + (s.nbVues || 0) + ' vue' + ((s.nbVues || 0) > 1 ? 's' : '') + '</button><button type="button" class="statut-btn" id="svSuppr">🗑️ Supprimer</button>' : '';
    if (_sv.proprio) {
        document.getElementById('svSuppr').onclick = () => {
            if (!confirm('Supprimer ce statut ?')) return;
            socket.emit('statut_supprimer', { id: s.id }, (res) => {
                if (!res || !res.ok) { montrerNotification('⚠️ Suppression impossible.'); return; }
                statutsCache = statutsCache.filter(x => x.id !== s.id);
                _sv.liste.splice(_sv.i, 1);
                if (!_sv.liste.length) fermerVisionneuseStatut(); else { _sv.i = Math.min(_sv.i, _sv.liste.length - 1); afficherStatutCourant(); }
            });
        };
        document.getElementById('svVoirVues').onclick = () => {
            clearTimeout(_sv.timer);
            const box = document.getElementById('svVues');
            box.hidden = false; box.textContent = 'Chargement…';
            socket.emit('statut_vues', { id: s.id }, (res) => {
                box.textContent = (res && res.ok && res.vues && res.vues.length) ? 'Vu par : ' + res.vues.map(v => nomPosteurStatut(v.telephone, v.nom)).join(', ') : 'Personne n’a encore vu ce statut.';
            });
        };
    }
    // lecture : marque comme vu, puis défilement automatique
    if (!_sv.proprio && !s.vu) { s.vu = true; socket.emit('statut_vu', { id: s.id }); }
    const demarrer = (duree) => {
        const barre = barres.children[_sv.i] && barres.children[_sv.i].firstChild;
        if (barre) { barre.style.transition = 'none'; barre.style.width = '0%'; void barre.offsetWidth; barre.style.transition = 'width ' + duree + 'ms linear'; barre.style.width = '100%'; }
        _sv.timer = setTimeout(statutSuivant, duree);
    };
    const nbCar = (s.texte || '').length;
    if (!s.hasImage) { ecran.style.backgroundImage = 'none'; demarrer(Math.min(10000, 5000 + Math.floor(nbCar / 80) * 1000)); return; }
    const poser = (img) => { ecran.style.background = '#000 center/contain no-repeat url(' + img + ')'; demarrer(7000); };
    if (_statutImages.has(s.id)) poser(_statutImages.get(s.id));
    else socket.emit('statut_image', { id: s.id }, (res) => {
        if (!_sv || _sv.liste[_sv.i] !== s) return;
        if (res && res.ok) { _statutImages.set(s.id, res.image); if (_statutImages.size > 20) _statutImages.delete(_statutImages.keys().next().value); poser(res.image); }
        else { texteEl.textContent = s.texte || 'Photo indisponible'; demarrer(4000); }
    });
}

socket.on('statut_nouveau', () => chargerStatuts());
socket.on('statut_retire', () => chargerStatuts());
socket.on('connect', () => setTimeout(chargerStatuts, 1800));
setInterval(() => { if (!document.hidden) chargerStatuts(); }, 120000);

(function () {
    const st = document.createElement('style');
    st.textContent =
        '.statut-bande{display:flex;gap:14px;overflow-x:auto;padding:4px 2px 12px;scrollbar-width:none}.statut-bande::-webkit-scrollbar{display:none}' +
        '.statut-item{flex:0 0 auto;width:66px;text-align:center;cursor:pointer}' +
        '.statut-anneau{position:relative;display:flex;align-items:center;justify-content:center;width:62px;height:62px;border-radius:50%;padding:3px;border:2px solid var(--border-color)}' +
        '.statut-anneau.nonvu{border:3px solid transparent;background:linear-gradient(var(--bg-color),var(--bg-color)) padding-box,linear-gradient(135deg,#22d3ee,#16a34a) border-box;padding:2px}' +
        '.statut-anneau.vu{border-color:rgba(130,150,180,.55)}.statut-anneau.aucun{border-style:dashed}' +
        '.statut-avatar{display:flex;align-items:center;justify-content:center;width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#3b9cff,#22d3ee);color:#fff;font-weight:700;font-size:17px}' +
        '.statut-avatar.petit{width:38px;height:38px;flex:0 0 38px;font-size:14px}' +
        '.statut-plus{position:absolute;right:-4px;bottom:-4px;width:24px;height:24px;border-radius:50%;border:2px solid var(--bg-color);background:#16a34a;color:#fff;font-size:17px;line-height:18px;padding:0;cursor:pointer}' +
        '.statut-nom{display:block;margin-top:5px;font-size:11.5px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
        '.statut-overlay{position:fixed;inset:0;z-index:10060;background:#000;display:flex;align-items:center;justify-content:center}' +
        '.statut-ecran{position:relative;width:100%;max-width:520px;height:100%;display:flex;flex-direction:column;color:#fff;overflow:hidden}' +
        '.statut-haut{display:flex;align-items:center;justify-content:space-between;padding:calc(12px + env(safe-area-inset-top,0px)) 14px 8px;font-weight:600;z-index:2}' +
        '.statut-btn{border:0;background:rgba(0,0,0,.35);color:#fff;border-radius:999px;padding:9px 14px;font-size:14px;font-family:inherit;cursor:pointer}' +
        '#statutTexte{flex:1;width:100%;background:transparent;border:0;outline:0;color:#fff;text-align:center;font-size:26px;font-weight:600;padding:18px;resize:none;font-family:inherit;display:block}' +
        '#statutTexte::placeholder{color:rgba(255,255,255,.7)}.avec-photo #statutTexte{flex:0 0 90px;font-size:17px;background:rgba(0,0,0,.45);margin-top:auto}' +
        '.statut-bas{padding:10px 14px calc(14px + env(safe-area-inset-bottom,0px));background:rgba(0,0,0,.25)}' +
        '.statut-palette{display:flex;gap:10px;justify-content:center;margin-bottom:10px}' +
        '.statut-couleur{width:30px;height:30px;border-radius:50%;border:2px solid rgba(255,255,255,.8);cursor:pointer;padding:0}' +
        '.statut-actions{display:flex;justify-content:space-between;align-items:center;gap:10px}' +
        '.statut-publier{border:0;border-radius:999px;padding:12px 22px;background:#16a34a;color:#fff;font-weight:700;font-size:16px;font-family:inherit;cursor:pointer}.statut-publier:disabled{opacity:.6}' +
        '.statut-info{display:block;text-align:center;margin-top:8px;font-size:11.5px;opacity:.85}' +
        '.sv-barres{display:flex;gap:4px;padding:calc(10px + env(safe-area-inset-top,0px)) 10px 0;z-index:3}' +
        '.sv-barre{flex:1;height:3px;border-radius:3px;background:rgba(255,255,255,.35);overflow:hidden}.sv-barre i{display:block;height:100%;width:0;background:#fff}.sv-barre i.plein{width:100%}' +
        '.sv-entete{display:flex;align-items:center;gap:10px;padding:10px 12px;z-index:3}.sv-qui{flex:1;display:flex;flex-direction:column;line-height:1.25}.sv-qui small{opacity:.85;font-size:12px}' +
        '.sv-zone{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:90px 22px 90px;z-index:1}' +
        '.sv-texte{font-size:26px;font-weight:600;text-align:center;white-space:pre-wrap;word-break:break-word;text-shadow:0 1px 6px rgba(0,0,0,.35)}.sv-texte.long{font-size:19px}' +
        '.sv-texte.legende{position:absolute;left:0;right:0;bottom:0;padding:16px 18px calc(18px + env(safe-area-inset-bottom,0px));font-size:17px;background:linear-gradient(transparent,rgba(0,0,0,.7))}' +
        '.sv-pied{position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:space-between;padding:12px 14px calc(14px + env(safe-area-inset-bottom,0px));z-index:3}' +
        '.sv-vues{position:absolute;left:12px;right:12px;bottom:70px;z-index:4;background:rgba(0,0,0,.8);border-radius:12px;padding:12px 14px;font-size:14px}';
    document.head.appendChild(st);
    const tete = document.querySelector('#convListView .conv-head');
    if (tete && !document.getElementById('statutBande')) {
        const b = document.createElement('div');
        b.id = 'statutBande';
        b.className = 'statut-bande';
        tete.insertAdjacentElement('afterend', b);
    }
    const aml = afficherMessagesLocaux;
    afficherMessagesLocaux = function () { aml.apply(this, arguments); rendreBandeStatuts(); };
    if (utilisateur) { rendreBandeStatuts(); setTimeout(chargerStatuts, 1500); }
})();

/* ============================================================
   v4.16 : sauvegarde complète du compte dans le cloud + récupération par code (SMS / e-mail)
   ============================================================ */
const BK_TAILLE = 300000;
let _bkSale = false, _bkMinuteur = null, _bkEnCours = false;

function emettre(evt, data, ms) {
    return new Promise((resolve) => {
        let fini = false;
        const t = setTimeout(() => { if (!fini) { fini = true; resolve(null); } }, ms || 20000);
        socket.emit(evt, data, (r) => { if (!fini) { fini = true; clearTimeout(t); resolve(r); } });
    });
}
const dureeDepuis = (ts) => {
    const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
    return m < 1 ? 'à l’instant' : m < 60 ? 'il y a ' + m + ' min' : m < 1440 ? 'il y a ' + Math.round(m / 60) + ' h' : 'il y a ' + Math.round(m / 1440) + ' j';
};

/* ----- Sauvegarde ----- */
function construireSauvegarde() {
    const u = utilisateur;
    const nettoyer = (m) => {
        const { image, audio, audioDur, ...r } = m;                 // photos et vocaux : trop lourds, non sauvegardés
        if (image && !r.texte) r.texte = '📷 Photo';
        if (audio && !r.texte) r.texte = '🎤 Message vocal';
        return r;
    };
    const data = {
        v: 1, at: Date.now(),
        profil: { email: u.email || '', entreprise: u.entreprise || '', ville: u.ville || '', bio: u.bio || '', qubits: u.qubits || 0, pays: u.pays || '' },
        parametres: Object.assign({}, u.parametres || {}, { customRingtoneBase64: null }),
        notes: u.notes || [], contacts: u.contacts || [], historiqueElaws: (u.historiqueElaws || []).slice(-200),
        messagesSupprimes: u.messagesSupprimes || [], messages: (u.messagesLocaux || []).map(nettoyer)
    };
    let json = JSON.stringify(data);
    while (json.length > 3000000 && data.messages.length > 50) {    // trop gros : on retire les plus anciens messages
        data.messages = data.messages.slice(Math.ceil(data.messages.length * 0.2));
        json = JSON.stringify(data);
    }
    return json;
}

async function envoyerSauvegarde() {
    if (!utilisateur || !socket.connected || _bkEnCours) return false;
    if (localStorage.getItem('evat_bk_attente_restore') === '1') return false;   // restauration pas encore faite : on n'écrase rien
    _bkEnCours = true;
    try {
        const json = construireSauvegarde();
        const total = Math.max(1, Math.ceil(json.length / BK_TAILLE));
        let dernier = null;
        for (let i = 0; i < total; i++) {
            dernier = await emettre('backup_envoyer', { part: i, total, data: json.slice(i * BK_TAILLE, (i + 1) * BK_TAILLE) }, 30000);
            if (!dernier || !dernier.ok) throw new Error((dernier && dernier.error) || 'serveur injoignable');
        }
        localStorage.setItem('evat_bk_at', String(dernier.at || Date.now()));
        _bkSale = false;
        majEtatSauvegardeAuto();
        return true;
    } catch (e) {
        majEtatSauvegardeAuto('⚠️ Sauvegarde impossible : ' + e.message);
        return false;
    } finally { _bkEnCours = false; }
}

function planifierSauvegarde(delai) {
    if (_bkMinuteur) return;
    _bkMinuteur = setTimeout(async () => { _bkMinuteur = null; if (_bkSale) await envoyerSauvegarde(); }, delai || 90000);
}
const _sauverProfilOrigine = sauverProfil;
sauverProfil = function () { _bkSale = true; planifierSauvegarde(); return _sauverProfilOrigine.apply(this, arguments); };
document.addEventListener('visibilitychange', () => { if (document.hidden && _bkSale) envoyerSauvegarde(); });
socket.on('connect', () => setTimeout(() => {
    if (!utilisateur) return;
    const at = parseInt(localStorage.getItem('evat_bk_at'), 10) || 0;
    if (Date.now() - at > 24 * 3600 * 1000) { _bkSale = true; planifierSauvegarde(15000); }   // au moins une sauvegarde par jour
}, 8000));

/* ----- Restauration ----- */
async function lireSauvegardeCloud() {
    let texte = '', total = 1;
    for (let p = 0; p < total; p++) {
        const r = await emettre('backup_restaurer', { part: p }, 30000);
        if (!r || !r.ok) return false;
        if (r.aucune) return null;
        total = r.total; texte += r.data;
    }
    return JSON.parse(texte);
}

function fusionnerSauvegarde(d) {
    const u = utilisateur;
    const ids = new Set((u.messagesLocaux || []).map(m => String(m.id || m.cid)));
    const supprimes = new Set([...(u.messagesSupprimes || []), ...(d.messagesSupprimes || [])]);
    let nbMsg = 0;
    (d.messages || []).forEach(m => {
        const cle = String(m.id || m.cid);
        if (!cle || ids.has(cle) || supprimes.has(m.id)) return;
        u.messagesLocaux.push(m); ids.add(cle); nbMsg++;
    });
    u.messagesLocaux.sort((a, b) => (a.ts || 0) - (b.ts || 0));
    u.messagesSupprimes = [...supprimes].slice(-500);
    let nbContacts = 0;
    const tels = new Set((u.contacts || []).map(c => c.telephone));
    (d.contacts || []).forEach(c => {
        const nc = normaliserContact(c);
        if (nc && nc.telephone && !tels.has(nc.telephone)) { u.contacts.push(nc); tels.add(nc.telephone); nbContacts++; }
    });
    if (!(u.notes || []).length && Array.isArray(d.notes)) u.notes = d.notes;
    if (!(u.historiqueElaws || []).length && Array.isArray(d.historiqueElaws)) u.historiqueElaws = d.historiqueElaws;
    const p = d.profil || {};
    ['email', 'entreprise', 'ville', 'bio', 'pays'].forEach(k => { if (!u[k] && p[k]) u[k] = p[k]; });
    u.qubits = Math.max(u.qubits || 0, p.qubits || 0);
    const ring = u.parametres && u.parametres.customRingtoneBase64;
    u.parametres = Object.assign({}, u.parametres, d.parametres || {}, { customRingtoneBase64: ring || null });
    return { nbMsg, nbContacts };
}

async function restaurerSauvegardeComplete(silencieux) {
    if (!utilisateur || !socket.connected) return false;
    try {
        const d = await lireSauvegardeCloud();
        if (d === false) throw new Error('serveur injoignable');
        if (d === null) {                                           // aucune sauvegarde : on peut recommencer à sauvegarder
            localStorage.removeItem('evat_bk_attente_restore');
            if (!silencieux) montrerNotification('ℹ️ Aucune sauvegarde trouvée pour ce compte.');
            return true;
        }
        const r = fusionnerSauvegarde(d);
        localStorage.removeItem('evat_bk_attente_restore');
        sauverProfilMaintenant();
        appliquerInfosProfil(); afficherContacts(); afficherMessagesLocaux(); majStatsAccueil();
        verifierEtSynchroniserContacts();
        montrerNotification('✅ Sauvegarde restaurée : ' + r.nbMsg + ' message(s), ' + r.nbContacts + ' contact(s) retrouvé(s).');
        return true;
    } catch (e) {
        montrerNotification('⚠️ Restauration impossible (' + (e.message || 'erreur') + '). Réessayez dans Menu → Sauvegarde.');
        return false;
    }
}

async function restaurerSauvegardeManuelle() {
    if (!confirm('Restaurer la dernière sauvegarde du cloud ?\nLes messages et contacts manquants seront ajoutés ; rien n’est supprimé.')) return;
    montrerNotification('⏳ Restauration en cours…');
    await restaurerSauvegardeComplete(false);
    majEtatSauvegardeAuto();
}
async function sauvegarderMaintenant() {
    if (localStorage.getItem('evat_bk_attente_restore') === '1') { montrerNotification('⚠️ Restaurez d’abord votre sauvegarde (bouton « Restaurer »).'); return; }
    montrerNotification('⏳ Sauvegarde en cours…');
    const ok = await envoyerSauvegarde();
    if (ok) montrerNotification('✅ Sauvegarde envoyée sur le serveur.');
}

async function majEtatSauvegardeAuto(erreur) {
    const el = document.getElementById('etatSauvegardeAuto');
    if (!el) return;
    if (erreur) { el.textContent = erreur; return; }
    const at = parseInt(localStorage.getItem('evat_bk_at'), 10) || 0;
    const info = socket.connected ? await emettre('backup_info', null, 8000) : null;
    let t = at ? '✅ Dernière sauvegarde de cet appareil : ' + dureeDepuis(at) + '.' : 'Aucune sauvegarde envoyée depuis cet appareil pour le moment.';
    if (info && info.ok) {
        if (!info.existe && !at) t = 'Aucune sauvegarde sur le serveur pour le moment.';
        t += info.chiffre ? ' 🔒 Chiffrée sur le serveur.' : '';
        if (!info.persistant) t += '\n⚠️ Le serveur n’a pas de base de données durable (Upstash) : une sauvegarde peut être perdue si le serveur redémarre.';
    } else if (!socket.connected) t += ' (Serveur hors ligne)';
    el.style.whiteSpace = 'pre-line';
    el.textContent = t;
}

/* ----- E-mail de récupération ----- */
async function majEtatEmailRecup() {
    const el = document.getElementById('etatEmailRecup');
    if (!el) return;
    const r = socket.connected ? await emettre('recup_canaux', null, 8000) : null;
    if (!r || !r.ok) { el.textContent = 'Serveur hors ligne : état indisponible.'; return; }
    let t = r.email ? '✅ E-mail de récupération confirmé : ' + r.email : (r.emailDispo ? '⚠️ Aucun e-mail confirmé : ajoutez-en un pour pouvoir récupérer votre compte par e-mail.' : 'ℹ️ L’envoi d’e-mails n’est pas encore activé sur le serveur.');
    t += r.smsDispo ? '\n📱 Récupération par SMS : disponible sur votre numéro.' : '\n📱 Récupération par SMS : pas encore activée sur le serveur.';
    el.style.whiteSpace = 'pre-line';
    el.textContent = t;
}
async function envoyerCodeEmailRecup() {
    const email = (document.getElementById('inputEmailRecup').value || '').trim();
    if (!email.includes('@')) { montrerNotification('⚠️ Entrez une adresse e-mail valide.'); return; }
    const r = await emettre('email_recup_envoyer', { email }, 25000);
    if (!r || !r.ok) { montrerNotification('⚠️ ' + ((r && r.error) || 'Envoi impossible.')); return; }
    document.getElementById('blocCodeEmailRecup').style.display = 'block';
    montrerNotification('📧 Code envoyé à ' + r.destinataire);
}
async function confirmerEmailRecup() {
    const code = (document.getElementById('inputCodeEmailRecup').value || '').trim();
    const r = await emettre('email_recup_confirmer', { code }, 15000);
    if (!r || !r.ok) { montrerNotification('⚠️ ' + ((r && r.error) || 'Confirmation impossible.')); return; }
    document.getElementById('blocCodeEmailRecup').style.display = 'none';
    document.getElementById('inputCodeEmailRecup').value = '';
    montrerNotification('✅ E-mail de récupération confirmé : ' + r.email);
    majEtatEmailRecup();
}

/* ----- Récupération par code (écran « Récupérer mon compte ») ----- */
function infoRecupOtp(t) { const e = document.getElementById('recupOtpInfo'); if (e) e.textContent = t || ''; }
function demanderCodeRecuperation(canal) {
    const tel = normaliserTel((document.getElementById('inputTelRecover') || {}).value || '');
    afficherErreurAuth('authRecoverError', '');
    if (!tel || !telEstValideClient(tel)) { afficherErreurAuth('authRecoverError', 'Entrez d’abord le numéro du compte, avec l’indicatif du pays.'); return; }
    if (!socket.connected) { afficherErreurAuth('authRecoverError', 'Serveur hors ligne. Réessayez dans un instant.'); return; }
    infoRecupOtp('⏳ Envoi du code…');
    socket.emit('recup_code_demander', { telephone: tel, canal }, (res) => {
        if (!res || !res.ok) { infoRecupOtp(''); afficherErreurAuth('authRecoverError', (res && res.error) || 'Envoi impossible.'); return; }
        document.getElementById('recupOtpSaisie').style.display = 'block';
        infoRecupOtp('📨 Code envoyé à ' + res.destinataire + ' (valable 10 minutes).');
        const c = document.getElementById('inputCodeOtp'); if (c) c.focus();
    });
}
function validerCodeRecuperation() {
    const tel = normaliserTel((document.getElementById('inputTelRecover') || {}).value || '');
    const code = ((document.getElementById('inputCodeOtp') || {}).value || '').trim();
    const metier = ((document.getElementById('inputMetierRecover') || {}).value || '').trim();
    afficherErreurAuth('authRecoverError', '');
    if (!/^\d{6}$/.test(code)) { afficherErreurAuth('authRecoverError', 'Entrez le code à 6 chiffres reçu.'); return; }
    socket.emit('recup_code_verifier', { telephone: tel, code }, (res) => {
        if (!res || !res.ok) { afficherErreurAuth('authRecoverError', (res && res.error) || 'Code incorrect ou expiré.'); return; }
        localStorage.setItem('evat_bk_attente_restore', '1');
        const p = res.profil;
        utilisateur = creerProfilLocal(p.nom, p.telephone, p.metier || metier, res.recoveryPin);
        sauverProfilMaintenant();
        const welcomeModal = document.getElementById('welcomeModal');
        if (welcomeModal) welcomeModal.style.display = 'none';
        const pinModal = document.getElementById('pinModal'), pinDisplay = document.getElementById('pinDisplay');
        if (pinDisplay) pinDisplay.textContent = res.recoveryPin;
        if (pinModal) pinModal.style.display = 'flex';
        appliquerInfosProfil();
        verifierEtSynchroniserContacts();
        montrerNotification('Compte récupéré : ' + utilisateur.nom + ' — notez le nouveau code secret');
        setTimeout(() => { proposerImportContactsApresInscription(); majBoostOnboarding(); restaurerSauvegardeComplete(true); }, 1200);
    });
}

/* ----- Rafraîchit les états quand on ouvre l'onglet Sauvegarde ----- */
(function () {
    const swOrigine = switchTab;
    switchTab = function (tabId) {
        swOrigine.apply(this, arguments);
        if (tabId === 'sync') { majEtatSauvegardeAuto(); majEtatEmailRecup(); }
    };
})();

/* ============================================================
   v4.17 : traduction automatique des messages
   ============================================================ */
const LANGUES_NOMS = { fr: 'français', en: 'anglais', es: 'espagnol', pt: 'portugais', de: 'allemand', it: 'italien', ar: 'arabe', zh: 'chinois',
    sw: 'swahili', ha: 'haoussa', yo: 'yoruba', ee: 'éwé', tw: 'twi' };
const LANGUES_LIBELLES = { fr: 'Français', en: 'English', es: 'Español', pt: 'Português', de: 'Deutsch', it: 'Italiano', ar: 'العربية', zh: '中文',
    sw: 'Kiswahili', ha: 'Hausa', yo: 'Yorùbá', ee: 'Eʋegbe (éwé) — qualité variable', tw: 'Twi — qualité variable' };

function langueCible() {
    const c = utilisateur && utilisateur.parametres && utilisateur.parametres.langueCible;
    if (c && LANGUES_NOMS[c]) return c;
    const nav = String(navigator.language || 'fr').slice(0, 2).toLowerCase();
    return LANGUES_NOMS[nav] ? nav : 'fr';
}
const traductionAuto = () => !!(utilisateur && utilisateur.parametres && utilisateur.parametres.traductionAuto);

function tradHtml(m) {
    if (!m || !m.trad || m.tradMasquee) return '';
    const de = m.trad.langue && LANGUES_NOMS[m.trad.langue] ? ' · de ' + LANGUES_NOMS[m.trad.langue] : '';
    return '<div class="msg-trad"><p>🌐 ' + lierUrls(escapeHtml(m.trad.texte)) + '</p><small>Traduction automatique' + de +
        ' · <button type="button" class="msg-trad-masquer" data-mid="' + escapeHtml(String(m.id || m.cid || '')) + '">masquer</button></small></div>';
}
function masquerTraduction(m) { m.tradMasquee = true; sauverProfil(); rendreMessagesLocaux(); }

async function traduireMessage(m, manuel) {
    if (!m || !utilisateur || !m.texte || m.texte === '📷 Photo' || m.texte === '🎤 Message vocal') return;
    if (m.trad) { if (manuel) { m.tradMasquee = false; sauverProfil(); rendreMessagesLocaux(); } return; }
    if (m.tradVu && !manuel) return;
    const brut = m.texte.replace(/^↩️ [^\n]*\n/, '').trim();
    if (brut.length < 2) return;
    if (!socket.connected) { if (manuel) montrerNotification('⚠️ Connexion au serveur nécessaire pour traduire.'); return; }
    const cible = langueCible();
    if (manuel) montrerNotification('🌐 Traduction en cours…');
    const r = await emettre('traduire', { texte: brut, cible }, 25000);
    if (!r || !r.ok) { if (manuel) montrerNotification('⚠️ ' + ((r && r.error) || 'Traduction impossible.')); return; }
    m.tradVu = true;
    if (r.identique) { if (manuel) montrerNotification('ℹ️ Ce message est déjà en ' + LANGUES_NOMS[cible] + '.'); sauverProfil(); return; }
    m.trad = { texte: r.texte, langue: r.langue || '', cible };
    m.tradMasquee = false;
    sauverProfil();
    rendreMessagesLocaux();
}

document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.msg-trad-masquer');
    if (!b || !utilisateur) return;
    const m = (utilisateur.messagesLocaux || []).find(z => String(z.id) === b.dataset.mid || z.cid === b.dataset.mid);
    if (m) masquerTraduction(m);
});

// Traduction automatique des messages reçus (si activée)
socket.on('new_message', (msg) => {
    if (!utilisateur || !traductionAuto() || !msg || msg.from === utilisateur.telephone || !msg.texte) return;
    setTimeout(() => {
        const m = (utilisateur.messagesLocaux || []).find(x => x.id === msg.id);
        if (m) traduireMessage(m, false);
    }, 400);
});

/* ----- Réglages ----- */
function remplirReglagesTraduction() {
    const sel = document.getElementById('selLangueCible');
    if (!sel || !utilisateur) return;
    if (!sel.options.length) sel.innerHTML = Object.keys(LANGUES_NOMS).map(k => '<option value="' + k + '">' + LANGUES_LIBELLES[k] + '</option>').join('');
    sel.value = langueCible();
    const chk = document.getElementById('chkTradAuto');
    if (chk) chk.checked = traductionAuto();
}
function changerLangueCible(v) {
    if (!utilisateur || !LANGUES_NOMS[v]) return;
    if (!utilisateur.parametres) utilisateur.parametres = {};
    utilisateur.parametres.langueCible = v;
    sauverProfil();
    montrerNotification('🌐 Langue de traduction : ' + LANGUES_NOMS[v]);
}
function changerTraductionAuto(actif) {
    if (!utilisateur) return;
    if (!utilisateur.parametres) utilisateur.parametres = {};
    utilisateur.parametres.traductionAuto = !!actif;
    sauverProfil();
    montrerNotification(actif ? '🌐 Les messages reçus dans une autre langue seront traduits en ' + LANGUES_NOMS[langueCible()] + '.' : '🌐 Traduction automatique désactivée.');
}

(function () {
    const st = document.createElement('style');
    st.textContent = '.msg-trad{margin:6px 0 2px;padding-top:6px;border-top:1px dashed rgba(255,255,255,.3)}[data-theme="light"] .msg-bubble.other .msg-trad{border-top-color:rgba(15,23,42,.25)}' +
        '.msg-trad p{margin:0;font-style:italic;opacity:.95}.msg-trad small{display:block;margin-top:2px;opacity:.75;font-size:11px}' +
        '.msg-trad-masquer{border:0;background:none;color:inherit;text-decoration:underline;font-size:11px;padding:0;cursor:pointer;font-family:inherit}';
    document.head.appendChild(st);
    const swOrigine2 = switchTab;
    switchTab = function (tabId) { swOrigine2.apply(this, arguments); if (tabId === 'parametres') remplirReglagesTraduction(); };
})();
