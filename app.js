
let utilisateur = JSON.parse(localStorage.getItem('evat_profil')) || null;
let iaDejaPresentee = localStorage.getItem('elaws_presentee') === 'true';
let deferredPrompt = null;

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => {});
    });
}

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

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const banner = document.getElementById('installBanner');
    if(banner) banner.style.display = 'flex';
});

function declencherInstallationApp() {
    const banner = document.getElementById('installBanner');
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                if(banner) banner.style.display = 'none';
            }
            deferredPrompt = null;
        });
    } else {
        alert("Pour installer l'application, utilisez le menu de votre navigateur (Chrome / Safari) et sélectionnez 'Ajouter à l'écran d'accueil'.");
    }
}

function fermerBanniereInstall() {
    const banner = document.getElementById('installBanner');
    if(banner) banner.style.display = 'none';
}

function mettreAJourIndicatif() {
    const select = document.getElementById('selectPays');
    const telInput = document.getElementById('inputTelProfil');
    if(!select || !telInput) return;
    const prefix = select.value;
    let currentVal = telInput.value.trim();
    ['+228', '+233', '+225', '+33', '+1'].forEach(p => {
        if(currentVal.startsWith(p)) {
            currentVal = currentVal.substring(p.length);
        }
    });
    telInput.value = prefix + currentVal;
}

const socket = io(SERVER_URL, {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    timeout: 20000
});

socket.on('connect', () => {
    const statusEl = document.getElementById('serverConnectionStatus');
    if(statusEl) {
        statusEl.innerHTML = "🟢 Connecté";
        statusEl.style.color = "var(--success)";
    }
    if(utilisateur) {
        socket.emit('register_user', { nom: utilisateur.nom, telephone: utilisateur.telephone, metier: utilisateur.metier });
    }
});

socket.on('disconnect', () => {
    const statusEl = document.getElementById('serverConnectionStatus');
    if(statusEl) {
        statusEl.innerHTML = "🔴 Déconnecté";
        statusEl.style.color = "var(--danger)";
    }
});

socket.on('contact_registered', (data) => {
    if(utilisateur && utilisateur.contacts) {
        const match = utilisateur.contacts.find(c => c.telephone === data.telephone);
        if(match) {
            match.metier = data.metier;
            localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
            afficherContacts();
            montrerNotification(`🚨 Votre contact ${match.nom} (${data.telephone}) vient de s'inscrire ! Métier : ${data.metier}`);
        }
    }
});

function montrerNotification(texte) {
    const banner = document.getElementById('notificationBanner');
    const textEl = document.getElementById('notificationText');
    if(banner && textEl) {
        textEl.innerText = texte;
        banner.style.display = 'block';
        setTimeout(() => { fermerNotification(); }, 10000);
    }
}

function fermerNotification() {
    const banner = document.getElementById('notificationBanner');
    if(banner) banner.style.display = 'none';
}

function sauvegarderProfilBase() {
    const nom = document.getElementById('inputNom').value.trim();
    const tel = document.getElementById('inputTelProfil').value.trim();
    const metier = document.getElementById('inputMetier').value.trim();
    
    if(!nom || !tel) {
        alert("Veuillez remplir votre nom et votre numéro.");
        return;
    }

    utilisateur = {
        nom: nom,
        telephone: tel,
        metier: metier || "Opérateur",
        qubits: 365,
        notes: [],
        messagesLocaux: [],
        contacts: [
            { nom: "Directeur Cabinet", telephone: "+22898231401", metier: "Cosmétiques & Management" },
            { nom: "Support Technique", telephone: "+22898231402", metier: "Ingénierie Continuum" }
        ],
        historiqueElaws: [],
        parametres: {
            sonnerieType: 'iphone',
            customRingtoneBase64: null,
            vibration: true
        }
    };

    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    const welcomeModal = document.getElementById('welcomeModal');
    if(welcomeModal) welcomeModal.style.display = 'none';
    
    socket.emit('register_user', { nom: utilisateur.nom, telephone: utilisateur.telephone, metier: utilisateur.metier });
    appliquerInfosProfil();
    verifierEtSynchroniserContacts();
}

function sauvegarderProfilBaseDesdeProfil() {
    const nom = document.getElementById('inputNomProfil').value.trim();
    const tel = document.getElementById('inputTelProfil2').value.trim();
    const metier = document.getElementById('inputMetierProfil').value.trim();
    
    if(!nom || !tel) {
        alert("Le nom et le téléphone sont obligatoires.");
        return;
    }

    if(!utilisateur) utilisateur = {};
    utilisateur.nom = nom;
    utilisateur.telephone = tel;
    utilisateur.metier = metier;

    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    socket.emit('register_user', { nom: utilisateur.nom, telephone: utilisateur.telephone, metier: utilisateur.metier });
    appliquerInfosProfil();
    alert("✅ Profil mis à jour ! Vous pouvez modifier vos réglages ici à tout moment.");
}

function sauvegarderParametresApp() {
    if(!utilisateur) return;
    if(!utilisateur.parametres) utilisateur.parametres = {};
    
    const selectSon = document.getElementById('selectSonnerieType');
    if(selectSon) {
        utilisateur.parametres.sonnerieType = selectSon.value;
    }
    
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    alert("⚙️ Paramètres enregistrés !");
}

function chargerSonneriePerso(event) {
    const file = event.target.files[0];
    if(!file) return;
    if(file.size > 1024 * 1024) {
        alert("Fichier trop volumineux. Choisissez un fichier MP3 de moins de 1 Mo.");
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
        if(!utilisateur.parametres) utilisateur.parametres = {};
        utilisateur.parametres.customRingtoneBase64 = e.target.result;
        utilisateur.parametres.sonnerieType = 'custom';
        localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
        alert("🎵 Sonnerie MP3 personnelle enregistrée !");
    };
    reader.readAsDataURL(file);
}

function deconnecterUtilisateur() {
    if(confirm("Voulez-vous vraiment réinitialiser et refaire l'enregistrement ?")) {
        localStorage.removeItem('evat_profil');
        localStorage.removeItem('elaws_presentee');
        iaDejaPresentee = false;
        utilisateur = null;
        fermerTousLesMenus();
        const welcomeModal = document.getElementById('welcomeModal');
        if(welcomeModal) welcomeModal.style.display = 'flex';
    }
}

function appliquerInfosProfil() {
    if(!utilisateur) return;
    if(!utilisateur.contacts) {
        utilisateur.contacts = [
            { nom: "Directeur Cabinet", telephone: "+22898231401", metier: "Cosmétiques & Management" },
            { nom: "Support Technique", telephone: "+22898231402", metier: "Ingénierie Continuum" }
        ];
    }
    if(!utilisateur.parametres) {
        utilisateur.parametres = { sonnerieType: 'iphone', customRingtoneBase64: null };
    }

    if(document.getElementById('inputNom')) document.getElementById('inputNom').value = utilisateur.nom;
    if(document.getElementById('inputNomProfil')) document.getElementById('inputNomProfil').value = utilisateur.nom;
    if(document.getElementById('inputTelProfil')) document.getElementById('inputTelProfil').value = utilisateur.telephone;
    if(document.getElementById('inputTelProfil2')) document.getElementById('inputTelProfil2').value = utilisateur.telephone;
    if(document.getElementById('inputMetier')) document.getElementById('inputMetier').value = utilisateur.metier;
    if(document.getElementById('inputMetierProfil')) document.getElementById('inputMetierProfil').value = utilisateur.metier;
    
    if(document.getElementById('sidebarUserName')) document.getElementById('sidebarUserName').innerText = utilisateur.nom;
    if(document.getElementById('sidebarUserRole')) document.getElementById('sidebarUserRole').innerText = utilisateur.metier;
    if(document.getElementById('dashUserName')) document.getElementById('dashUserName').innerText = utilisateur.nom.toUpperCase();
    if(document.getElementById('dashUserMetier')) document.getElementById('dashUserMetier').innerText = utilisateur.metier;
    if(document.getElementById('voipStatusDisplay')) document.getElementById('voipStatusDisplay').innerText = "ID : " + utilisateur.telephone;

    const selectSon = document.getElementById('selectSonnerieType');
    if(selectSon && utilisateur.parametres.sonnerieType) {
        selectSon.value = utilisateur.parametres.sonnerieType;
    }
    
    verifierEtSynchroniserContacts();
    afficherContacts();
}

function verifierEtSynchroniserContacts() {
    if(!utilisateur || !utilisateur.contacts) return;
    socket.emit('query_contacts', utilisateur.contacts.map(c => c.telephone), (reponses) => {
        if(reponses && Array.isArray(reponses)) {
            reponses.forEach(info => {
                const contact = utilisateur.contacts.find(c => c.telephone === info.telephone);
                if(contact && info.metier) contact.metier = info.metier;
            });
            localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
            afficherContacts();
        }
    });
}

function afficherContacts() {
    const container = document.getElementById('listeContactsContainer');
    if(!container || !utilisateur || !utilisateur.contacts) return;
    if(utilisateur.contacts.length === 0) {
        container.innerHTML = `<p style="color:var(--text-secondary); font-size:11.5px;">Aucun contact.</p>`;
        return;
    }
    let html = '';
    utilisateur.contacts.forEach((c, index) => {
        html += `<div style="background:var(--bg-color); border:1px solid var(--border-color); padding:10px; border-radius:10px; display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <div>
                <strong style="color:var(--accent); font-size:12.5px;">👤 ${c.nom}</strong>
                <div style="font-size:11px; color:var(--text-secondary);">📞 ${c.telephone} • <i style="color:var(--success);">${c.metier || 'Sync...'}</i></div>
            </div>
            <div style="display:flex; gap:4px; flex-wrap:wrap; justify-content:flex-end;">
                <button onclick="preparerAppel('${c.telephone}')" class="btn-action" style="background:var(--success); color:#fff; padding:5px 8px; font-size:10.5px;" title="Appeler">📞</button>
                <button onclick="ecrireAuContact('${c.nom}', '${c.telephone}')" class="btn-action" style="background:var(--accent); color:#030712; padding:5px 8px; font-size:10.5px;" title="Écrire">💬</button>
                <button onclick="modifierContact(${index})" class="btn-action" style="background:rgba(59,130,246,0.2); color:var(--accent); border:1px solid var(--accent); padding:5px 8px; font-size:10.5px;" title="Modifier">✏️</button>
                <button onclick="supprimerContact(${index})" class="btn-action" style="background:rgba(239,68,68,0.2); color:#ef4444; border:1px solid #ef4444; padding:5px 8px; font-size:10.5px;" title="Supprimer">🗑️</button>
            </div>
        </div>`;
    });
    container.innerHTML = html;
}

function ajouterNouveauContact() {
    const nom = document.getElementById('nouveauNomContact').value.trim();
    const tel = document.getElementById('nouveauTelContact').value.trim();
    if(!nom || !tel) {
        alert("Nom et numéro obligatoires.");
        return;
    }
    if(!utilisateur.contacts) utilisateur.contacts = [];
    utilisateur.contacts.push({ nom, telephone: tel, metier: "Recherche..." });
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    document.getElementById('nouveauNomContact').value = '';
    document.getElementById('nouveauTelContact').value = '';
    afficherContacts();
    verifierEtSynchroniserContacts();
    alert("✅ Contact enregistré !");
}

function modifierContact(index) {
    const c = utilisateur.contacts[index];
    const nouveauNom = prompt("Modifier le nom :", c.nom);
    if(nouveauNom === null) return;
    const nouveauTel = prompt("Modifier le numéro :", c.telephone);
    if(nouveauTel === null) return;
    utilisateur.contacts[index].nom = nouveauNom.trim();
    utilisateur.contacts[index].telephone = nouveauTel.trim();
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    afficherContacts();
    verifierEtSynchroniserContacts();
}

function supprimerContact(index) {
    if(confirm("Supprimer ce contact ?")) {
        utilisateur.contacts.splice(index, 1);
        localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
        afficherContacts();
    }
}

function ecrireAuContact(nom, tel) {
    const message = prompt(`Message à ${nom} (${tel}) :`);
    if(!message) return;
    if(!utilisateur.messagesLocaux) utilisateur.messagesLocaux = [];
    utilisateur.messagesLocaux.push({ expediteur: utilisateur.nom || "Moi", texte: `À ${nom} : ${message}`, heure: new Date().toLocaleTimeString() });
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    switchTab('messagerie');
    alert("✅ Message enregistré !");
}

function preparerAppel(tel) {
    switchTab('communications');
    document.getElementById('appelCibleNum').value = tel;
}

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
    if(statusEl) statusEl.innerText = "🎙️ Écoute...";
    
    recognition.onresult = (event) => {
        inputEl.value = event.results[0][0].transcript;
        if(statusEl) statusEl.innerText = "";
        // Réponse instantanée dès la fin de la parole
        poserQuestionElaws();
    };
    recognition.onerror = () => { if(statusEl) statusEl.innerText = ""; };
    recognition.onend = () => { if(statusEl) statusEl.innerText = ""; };
    
    recognition.start();
}

// ========== ELAWS E1 + E2 + E4 ==========
let elawsBusy = false;
let elawsHistory = [];
let elawsMode = localStorage.getItem('evat_elaws_mode') || 'general';
let elawsVoixActive = localStorage.getItem('evat_voix') !== 'off';
let derniereReponseElaws = '';
let dernieresActionsElaws = [];

const ELAWS_MODES = {
    general: {
        label: 'Général',
        icon: '🤖',
        system: 'Tu es ELAWS, assistant EVAT. Réponds utilement, directement, sans répéter la question. 3 à 8 phrases. Langage simple.'
    },
    briefing: {
        label: 'Briefing',
        icon: '🌅',
        system: 'Tu es ELAWS en mode Briefing. Donne un plan de journée clair: priorités, ordre, 1 conseil par axe, ce qu\'il faut éviter. Court, motivant, concret. Ne répète pas la question.'
    },
    redaction: {
        label: 'Rédaction',
        icon: '✍️',
        system: 'Tu es ELAWS en mode Rédaction. Produis un texte prêt à envoyer (SMS, message pro, mail court, devis texte). Pas de blabla autour: le message d\'abord, puis une variante courte si utile. Ne répète pas la demande.'
    },
    terrain: {
        label: 'Terrain',
        icon: '📍',
        system: 'Tu es ELAWS en mode Terrain. Réponses ultra-courtes, orales, 2 à 5 phrases max, phrases simples, action immédiate. Pas de jargon. Ne répète pas la question.'
    },
    negociation: {
        label: 'Négociation',
        icon: '🤝',
        system: 'Tu es ELAWS en mode Négociation. Aide à vendre ou négocier: script oral, réponses aux objections, reformulations. Concret, respectueux, orienté closing. Ne répète pas la question.'
    }
};

function assurerElawsData() {
    if (!utilisateur) return;
    if (!utilisateur.tableauJour) utilisateur.tableauJour = { date: '', pro: '', perso: '', formation: '' };
    if (!utilisateur.clients) utilisateur.clients = [];
    if (!utilisateur.groupes) utilisateur.groupes = [];
    if (!utilisateur.elawsMeta) utilisateur.elawsMeta = { streak: 0, lastBriefingDate: '', totalBriefings: 0 };
}
function saveElawsData() {
    if (utilisateur) localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }

function setElawsMode(mode) {
    if (!ELAWS_MODES[mode]) mode = 'general';
    elawsMode = mode;
    localStorage.setItem('evat_elaws_mode', mode);
    document.querySelectorAll('.elaws-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
    });
    const label = document.getElementById('elawsModeLabel');
    if (label) label.textContent = ELAWS_MODES[mode].icon + ' ' + ELAWS_MODES[mode].label;
    const input = document.getElementById('elawsInput');
    if (input) {
        const ph = {
            general: 'Pose ta question…',
            briefing: 'Ex: aide-moi à prioriser ma journée…',
            redaction: 'Ex: SMS pour relancer un client poli et ferme…',
            terrain: 'Ex: client hésite sur le prix, je dis quoi ?',
            negociation: 'Ex: objection c\'est trop cher, réponds…'
        };
        input.placeholder = ph[mode] || ph.general;
    }
}

function basculerVoixElaws() {
    elawsVoixActive = !elawsVoixActive;
    localStorage.setItem('evat_voix', elawsVoixActive ? 'on' : 'off');
    const btn = document.getElementById('btnSpeakElaws');
    if (btn) {
        btn.textContent = elawsVoixActive ? '🔊' : '🔇';
        btn.title = elawsVoixActive ? 'Voix activée' : 'Voix désactivée';
    }
    if (!elawsVoixActive && window.speechSynthesis) speechSynthesis.cancel();
    else parlerElaws(elawsVoixActive ? 'Voix activée.' : 'Voix désactivée.');
}

function parlerElaws(texte) {
    if (!elawsVoixActive || !texte || !window.speechSynthesis) return;
    try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(texte);
        u.lang = 'fr-FR';
        u.rate = 1.02;
        const vs = speechSynthesis.getVoices();
        const fr = vs.find(v => /fr/i.test(v.lang)) || null;
        if (fr) u.voice = fr;
        speechSynthesis.speak(u);
    } catch (e) {}
}
if (typeof speechSynthesis !== 'undefined') {
    speechSynthesis.getVoices();
    speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
}

function nettoyerReponseIA(t) {
    if (!t) return t;
    let x = String(t).trim();
    x = x.replace(/^(ELAWS\s*(AI)?\s*[:\-–—]\s*)/i, '');
    x = x.replace(/^(Réponse\s*[:\-–—]\s*)/i, '');
    [/^j'ai bien (reçu|compris|noté)[^.!]*[.!]?\s*/i, /^concernant (ta|votre|la) question[^.!]*[.!]?\s*/i].forEach(re => { x = x.replace(re, ''); });
    return x.trim() || String(t).trim();
}

function reponseLocaleElaws(question) {
    const q = (question || '').toLowerCase();
    if (elawsMode === 'redaction') return 'Bonjour, je me permets de vous relancer concernant notre échange. Seriez-vous disponible pour en discuter cette semaine ? Cordialement.';
    if (elawsMode === 'negociation') return 'Je comprends le budget. Voici ce que je peux faire: garder la qualité sur l\'essentiel et ajuster le superflu. On fixe quel montant cible ?';
    if (elawsMode === 'terrain') return 'Écoute le besoin. Propose une option claire. Demande la décision. Note la relance.';
    if (elawsMode === 'briefing') return 'Commence par l\'action pro la plus urgente. Bloque 25 minutes sans distraction. Garde l\'action perso pour le créneau plus calme. 15 minutes de formation en fin de journée.';
    if (/bonjour|salut/.test(q)) return 'Salut. Choisis un mode en haut si besoin, puis dis-moi ce que tu veux avancer.';
    return 'Réseau limité. Réessaie dans un instant, ou précise ton besoin en une phrase.';
}

async function appelerIAMondiale(question) {
    assurerElawsData();
    const prenom = utilisateur?.nom ? utilisateur.nom.split(' ')[0] : 'toi';
    const metier = utilisateur?.metier || '';
    const tj = utilisateur?.tableauJour || {};
    const mode = ELAWS_MODES[elawsMode] || ELAWS_MODES.general;
    let system = mode.system + ` Utilisateur: ${prenom}${metier ? ', activité: ' + metier : ''}.`;
    if (elawsMode === 'briefing' || /journée|prioris|briefing/i.test(question)) {
        system += ` Actions du jour — pro: ${tj.pro || 'n/a'}, perso: ${tj.perso || 'n/a'}, formation: ${tj.formation || 'n/a'}.`;
    }
    system += ' Santé: prévention seulement, pas de diagnostic. Juridique: reste général.';

    const messages = [{ role: 'system', content: system }];
    elawsHistory.slice(-6).forEach(m => messages.push(m));
    messages.push({ role: 'user', content: question });

    try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 28000);
        const res = await fetch('https://text.pollinations.ai/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages, model: 'openai', seed: Math.floor(Math.random() * 99999) }),
            signal: ctrl.signal
        });
        clearTimeout(t);
        if (res.ok) {
            const text = nettoyerReponseIA(await res.text());
            if (text.length > 3) return text;
        }
    } catch (e) {}
    try {
        const prompt = encodeURIComponent(system + '\n\nUtilisateur: ' + question + '\nELAWS:');
        const ctrl2 = new AbortController();
        const t2 = setTimeout(() => ctrl2.abort(), 20000);
        const res2 = await fetch('https://text.pollinations.ai/' + prompt + '?model=openai', { signal: ctrl2.signal });
        clearTimeout(t2);
        if (res2.ok) {
            const text2 = nettoyerReponseIA(await res2.text());
            if (text2.length > 3) return text2;
        }
    } catch (e) {}
    return reponseLocaleElaws(question);
}

/** E2: détecter actions exécutables depuis la question utilisateur */
function detecterActionsElaws(question, reponse) {
    const actions = [];
    const q = (question || '') + ' ' + (reponse || '');
    const qLow = q.toLowerCase();

    // Relance client
    if (/relance|rappeler|recontacter|suivi client/i.test(qLow)) {
        actions.push({ type: 'relance', label: '➕ Créer une relance client' });
    }
    // Nouveau client
    if (/nouveau client|ajouter client|fiche client|prospect/i.test(qLow)) {
        actions.push({ type: 'client', label: '🤝 Ajouter un client' });
    }
    // Tâche
    if (/tâche|tache|todo|à faire|action du jour|rappelle-moi de/i.test(qLow)) {
        actions.push({ type: 'tache_jour', label: '🎯 Mettre dans ma journée' });
    }
    // Groupe tâche
    if (/tâche d'équipe|tache d'equipe|tâche groupe|pour l'équipe|pour le groupe/i.test(qLow)) {
        actions.push({ type: 'tache_groupe', label: '👥 Tâche de groupe' });
    }
    // Toujours proposer au moins rédaction → copier si mode redaction
    if (elawsMode === 'redaction') {
        actions.push({ type: 'copier', label: '📋 Copier le texte' });
    }
    // Dédupliquer
    const seen = new Set();
    return actions.filter(a => (seen.has(a.type) ? false : (seen.add(a.type), true)));
}

function rendreBoutonsActions(actions) {
    if (!actions || !actions.length) return '';
    return `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;">` +
        actions.map((a, i) =>
            `<button onclick="executerActionElaws(${i})" class="btn-action" style="width:auto;padding:6px 10px;font-size:11px;background:rgba(16,185,129,0.2);color:var(--success);border:1px solid rgba(16,185,129,0.4);">${esc(a.label)}</button>`
        ).join('') + `</div>`;
}

function executerActionElaws(index) {
    const a = dernieresActionsElaws[index];
    if (!a) return;
    assurerElawsData();
    if (a.type === 'copier') {
        if (navigator.clipboard && derniereReponseElaws) {
            navigator.clipboard.writeText(derniereReponseElaws).then(() => alert('Texte copié.')).catch(() => prompt('Copiez :', derniereReponseElaws));
        } else {
            prompt('Copiez :', derniereReponseElaws);
        }
        return;
    }
    if (a.type === 'client' || a.type === 'relance') {
        const nom = prompt('Nom du client :');
        if (!nom) return;
        const tel = prompt('Téléphone :', '') || '';
        const note = prompt('Note :', elawsMode === 'negociation' ? 'Suite négo' : 'Relance ELAWS') || '';
        const relance = prompt('Date relance (AAAA-MM-JJ) :', todayISO()) || todayISO();
        utilisateur.clients.push({
            id: 'cl' + Date.now(),
            nom: nom.trim(),
            tel: tel.replace(/\s+/g, '').trim(),
            note: note.trim(),
            relance: relance.trim(),
            statut: 'prospect'
        });
        saveElawsData();
        alert('Client enregistré. Voir onglet Clients & Relances.');
        return;
    }
    if (a.type === 'tache_jour') {
        const titre = prompt('Action à mettre dans ta journée :', '') || '';
        if (!titre) return;
        const slot = prompt('Où ? pro / perso / formation', 'pro') || 'pro';
        const s = slot.toLowerCase();
        if (!utilisateur.tableauJour) utilisateur.tableauJour = { date: todayISO(), pro: '', perso: '', formation: '' };
        utilisateur.tableauJour.date = todayISO();
        if (s.startsWith('pers')) utilisateur.tableauJour.perso = titre.trim();
        else if (s.startsWith('form')) utilisateur.tableauJour.formation = titre.trim();
        else utilisateur.tableauJour.pro = titre.trim();
        saveElawsData();
        if (typeof majBanniereJour === 'function') majBanniereJour();
        alert('Ajouté à ta journée.');
        return;
    }
    if (a.type === 'tache_groupe') {
        if (!utilisateur.groupes || !utilisateur.groupes.length) {
            const nomG = prompt('Aucun groupe. Nom du nouveau groupe :', 'Mon équipe');
            if (!nomG) return;
            utilisateur.groupes = [{
                id: 'gr' + Date.now(),
                nom: nomG.trim(),
                membres: [{ nom: utilisateur.nom, tel: utilisateur.telephone }],
                taches: []
            }];
        }
        const g = utilisateur.groupes[0];
        const titre = prompt('Titre de la tâche :');
        if (!titre) return;
        g.taches = g.taches || [];
        g.taches.unshift({ id: 'gt' + Date.now(), titre: titre.trim(), assigne: utilisateur.nom, fait: false });
        saveElawsData();
        alert('Tâche ajoutée au groupe « ' + g.nom + ' ».');
    }
}

function enregistrerStreakBriefing() {
    assurerElawsData();
    const meta = utilisateur.elawsMeta;
    const today = todayISO();
    if (meta.lastBriefingDate === today) return; // déjà compté
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const y = yesterday.toISOString().slice(0, 10);
    if (meta.lastBriefingDate === y) meta.streak = (meta.streak || 0) + 1;
    else meta.streak = 1;
    meta.lastBriefingDate = today;
    meta.totalBriefings = (meta.totalBriefings || 0) + 1;
    saveElawsData();
    majElawsStreakUI();
}

function majElawsStreakUI() {
    const el = document.getElementById('elawsStreakBox');
    if (!el || !utilisateur) return;
    assurerElawsData();
    const m = utilisateur.elawsMeta || {};
    const streak = m.streak || 0;
    const total = m.totalBriefings || 0;
    el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
      <span style="font-size:12px;color:var(--text-secondary);">🔥 Série briefing : <strong style="color:var(--success);">${streak} j</strong> · Total : ${total}</span>
      <button onclick="lancerResumeVocalJour()" class="btn-action" style="width:auto;padding:6px 10px;font-size:11px;background:rgba(59,130,246,0.2);color:var(--accent);border:1px solid var(--accent);">🎧 Résumé vocal du jour</button>
    </div>`;
}

function lancerResumeVocalJour() {
    assurerElawsData();
    setElawsMode('briefing');
    const tj = utilisateur.tableauJour || {};
    const m = utilisateur.elawsMeta || {};
    const prompt = `Fais mon résumé vocal du jour (à lire à voix haute, style oral, 40 à 70 secondes max). Actions: pro «${tj.pro||'non définie'}», perso «${tj.perso||'non définie'}», formation «${tj.formation||'non définie'}». Série briefing: ${m.streak||0} jours. Motive brièvement et dis la prochaine micro-action.`;
    const input = document.getElementById('elawsInput');
    if (input) { input.value = prompt; poserQuestionElaws(true); }
}

function lancerBriefingMatinElaws() {
    assurerElawsData();
    setElawsMode('briefing');
    const tj = utilisateur.tableauJour || {};
    const prompt = `Briefing du matin. Actions — pro: «${tj.pro||'vide'}», perso: «${tj.perso||'vide'}», formation: «${tj.formation||'vide'}». Priorise, 1 conseil par axe, ce qu'éviter. Court et concret.`;
    switchTab('elaws-ia');
    const input = document.getElementById('elawsInput');
    if (input) { input.value = prompt; poserQuestionElaws(true); }
}

async function poserQuestionElaws(isBriefing) {
    const input = document.getElementById('elawsInput');
    const question = (input?.value || '').trim();
    if (!question || !utilisateur || elawsBusy) return;
    const chatBox = document.getElementById('elawsChatBox');
    if (!chatBox) return;

    elawsBusy = true;
    chatBox.innerHTML += `<div style="background:rgba(255,255,255,0.05);padding:10px;border-radius:10px;text-align:right;"><strong style="color:var(--success);font-size:12px;">👤 ${esc(utilisateur.nom)}</strong><p style="margin:4px 0 0;font-size:12.5px;">${esc(question)}</p></div>`;
    input.value = '';
    chatBox.scrollTop = chatBox.scrollHeight;

    const loadingId = 'elaws-load-' + Date.now();
    const modeInfo = ELAWS_MODES[elawsMode] || ELAWS_MODES.general;
    chatBox.innerHTML += `<div id="${loadingId}" style="background:rgba(59,130,246,0.1);border:1px solid var(--accent);padding:10px;border-radius:10px;"><strong style="color:var(--accent);font-size:12px;">🤖 ELAWS · ${modeInfo.label}</strong><p style="font-size:12px;margin:6px 0 0;color:var(--text-secondary);">Réflexion…</p></div>`;

    let reponse = '';
    try { reponse = await appelerIAMondiale(question); }
    catch (e) { reponse = reponseLocaleElaws(question); }

    if (isBriefing || elawsMode === 'briefing') enregistrerStreakBriefing();

    elawsHistory.push({ role: 'user', content: question });
    elawsHistory.push({ role: 'assistant', content: reponse });
    if (elawsHistory.length > 20) elawsHistory = elawsHistory.slice(-16);

    derniereReponseElaws = reponse;
    dernieresActionsElaws = detecterActionsElaws(question, reponse);

    const html = `<div style="background:rgba(59,130,246,0.1);border:1px solid var(--accent);padding:10px;border-radius:10px;">
      <strong style="color:var(--accent);font-size:12px;">🤖 ELAWS · ${esc(modeInfo.label)}</strong>
      <p style="margin:4px 0 0;font-size:12.5px;line-height:1.5;white-space:pre-wrap;">${esc(reponse)}</p>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">
        <button onclick="parlerElaws(derniereReponseElaws)" class="btn-action" style="width:auto;padding:5px 10px;font-size:10px;background:rgba(16,185,129,0.2);color:var(--success);border:1px solid rgba(16,185,129,0.4);">🔊 Écouter</button>
      </div>
      ${rendreBoutonsActions(dernieresActionsElaws)}
    </div>`;
    const el = document.getElementById(loadingId);
    if (el) el.outerHTML = html; else chatBox.innerHTML += html;
    chatBox.scrollTop = chatBox.scrollHeight;
    elawsBusy = false;
    parlerElaws(reponse);
}

function initElawsUI() {
    setElawsMode(elawsMode);
    const btn = document.getElementById('btnSpeakElaws');
    if (btn) {
        btn.textContent = elawsVoixActive ? '🔊' : '🔇';
    }
    majElawsStreakUI();
}

function toggleMenu(e) {
    if(e) { e.stopPropagation(); e.preventDefault(); }
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('appOverlay');
    if(sidebar && overlay) {
        const isOpen = sidebar.classList.toggle('open');
        if(isOpen) overlay.classList.add('active');
        else overlay.classList.remove('active');
    }
}

function fermerTousLesMenus() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('appOverlay');
    if(sidebar) sidebar.classList.remove('open');
    if(overlay) overlay.classList.remove('active');
}

let mapInstance = null;
let userMarker = null;

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    const target = document.getElementById('tab-' + tabId);
    if(target) target.style.display = 'block';
    const link = document.getElementById('link-' + tabId);
    if(link) link.classList.add('active');
    fermerTousLesMenus();

    if(tabId === 'contacts') afficherContacts();
    if(tabId === 'elaws-ia') { initElawsUI(); }
    if(tabId === 'map') {
        setTimeout(() => {
            if(!mapInstance) {
                mapInstance = L.map('mapContainer').setView([6.1375, 1.2123], 13);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(mapInstance);
            } else {
                mapInstance.invalidateSize();
            }
        }, 200);
    }
}

function centrerSurMoi() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            if(mapInstance) {
                mapInstance.setView([lat, lng], 15);
                if(userMarker) mapInstance.removeLayer(userMarker);
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
            alert("Position partagée !");
        });
    }
}

socket.on('signal', (data) => {
    if (data.type === 'location' && mapInstance) {
        L.marker([data.lat, data.lng]).addTo(mapInstance).bindPopup(`<b>📍 ${data.sender}</b>`);
    }
});

function envoyerMessageChatLocal() {
    const input = document.getElementById('chatLocalInput');
    const texte = input.value.trim();
    if(!texte || !utilisateur) return;
    if(!utilisateur.messagesLocaux) utilisateur.messagesLocaux = [];
    utilisateur.messagesLocaux.push({ expediteur: utilisateur.nom || "Moi", texte, heure: new Date().toLocaleTimeString() });
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    input.value = '';
    afficherMessagesLocaux();
}

function afficherMessagesLocaux() {
    const container = document.getElementById('listeMessagesLocaux');
    if(!container || !utilisateur || !utilisateur.messagesLocaux) return;
    let html = '';
    utilisateur.messagesLocaux.forEach(m => {
        html += `<div style="background:var(--bg-color); border:1px solid var(--border-color); padding:8px; border-radius:8px; margin-bottom:6px;"><div style="font-size:10px; color:var(--accent);">👤 ${m.expediteur} • ${m.heure}</div><p style="margin:3px 0 0 0; font-size:12px;">${m.texte}</p></div>`;
    });
    container.innerHTML = html;
}

function ajouterNoteBlocNotes() {
    const titre = document.getElementById('noteTitre').value.trim();
    const contenu = document.getElementById('noteContenu').value.trim();
    if(!titre || !contenu || !utilisateur) return;
    if(!utilisateur.notes) utilisateur.notes = [];
    utilisateur.notes.unshift({ titre, contenu });
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    document.getElementById('noteTitre').value = '';
    document.getElementById('noteContenu').value = '';
    afficherNotesBlocNotes();
}

function afficherNotesBlocNotes() {
    const container = document.getElementById('listeNotesContainer');
    if(!container || !utilisateur || !utilisateur.notes) return;
    let html = '';
    utilisateur.notes.forEach(n => {
        html += `<div style="background:var(--bg-color); border:1px solid var(--border-color); padding:10px; border-radius:10px; margin-bottom:8px;"><strong style="color:var(--accent);">📌 ${n.titre}</strong><p style="margin:3px 0; font-size:12px;">${n.contenu}</p></div>`;
    });
    container.innerHTML = html;
}

function genererPlanSucces1000() {
    const obj = document.getElementById('inputObjectif1000').value.trim();
    const container = document.getElementById('resultatPlan1000');
    if(!obj) return;
    container.style.display = 'block';
    container.innerHTML = `<div style="background:var(--bg-color); padding:12px; border-radius:12px; border:1px solid var(--success);"><h4 style="color:var(--success);">🚀 ${obj}</h4><p style="font-size:12px;">Plan en cours d'exécution.</p></div>`;
}

function lancerAnalyseVoyageAvance() {
    const dest = document.getElementById('voyageDestination').value.trim();
    const container = document.getElementById('resultatAssistantVoyage');
    if(!dest) return;
    container.style.display = 'block';
    container.innerHTML = `<div style="background:var(--bg-color); padding:12px; border-radius:12px; border:1px solid var(--accent);"><h4 style="color:var(--accent);">✈️ ${dest}</h4><p style="font-size:12px;">Formalités validées.</p></div>`;
}

function exporterDonneesCloud() {
    if(!utilisateur) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(utilisateur, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", "evat_backup.json");
    document.body.appendChild(dl);
    dl.click();
    dl.remove();
}

// VoIP P2P & Sonneries
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
            if(customAudioRing) return;
            customAudioRing = new Audio(utilisateur.parametres.customRingtoneBase64);
            customAudioRing.loop = true;
            customAudioRing.play().catch(e => {});
            return;
        }

        if(audioRingContext) return;
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
            if(!audioRingContext) return;
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
    } catch(e) {}
}

function arreterSonSonnerie() {
    if(ringInterval) { clearInterval(ringInterval); ringInterval = null; }
    if(audioRingContext) { audioRingContext.close().catch(() => {}); audioRingContext = null; }
    if(customAudioRing) { customAudioRing.pause(); customAudioRing.currentTime = 0; customAudioRing = null; }
    if(appelTimeoutTimer) { clearTimeout(appelTimeoutTimer); appelTimeoutTimer = null; }
    if(incomingTimeout) { clearTimeout(incomingTimeout); incomingTimeout = null; }
}

function afficherModalAppelEntrant(senderTel, typeAppel) {
    let modal = document.getElementById('incomingCallModal');
    let typeTxt = typeAppel === 'video' ? '📹 Appel Vidéo Entrant' : '📞 Appel Audio Entrant';
    if(!modal) {
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
    if(modal) modal.style.display = 'none';
}

async function lancerAppelDirectPeer(type) {
    const cibleTel = document.getElementById('appelCibleNum').value.trim();
    const logEl = document.getElementById('callStatusLog');
    const container = document.getElementById('callContainer');
    activeCallType = type;

    if(!cibleTel) {
        alert("Entrez le numéro du contact à appeler.");
        return;
    }
    if(cibleTel === utilisateur.telephone) {
        alert("Impossible de s'appeler soi-même !");
        return;
    }

    try {
        if(logEl) logEl.innerText = "🔄 Activation micro/caméra...";
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
                if(remoteAudio) remoteAudio.srcObject = event.streams[0];
                if(remoteVideo && type === 'video') remoteVideo.srcObject = event.streams[0];
                if(logEl) logEl.innerText = "✅ Connexion active !";
                arreterSonSonnerie();
            }
        };

        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                socket.emit('p2p_signal', { target: cibleTel, sender: utilisateur.telephone, type: 'ice_candidate', candidate: event.candidate, callType: type });
            }
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        socket.emit('p2p_signal', { target: cibleTel, sender: utilisateur.telephone, type: 'offer', offer: offer, callType: type });

        jouerSonSonnerie();
        if(logEl) logEl.innerText = "📞 Sonnerie active...";

        appelTimeoutTimer = setTimeout(() => {
            if(peerConnection && peerConnection.connectionState !== 'connected') {
                raccrocherAppel(true);
                if(logEl) logEl.innerText = "❌ Pas de réponse.";
            }
        }, 30000);

    } catch (error) {
        if(logEl) logEl.innerText = "❌ Erreur micro/caméra.";
    }
}

socket.on('p2p_signal', async (data) => {
    const logEl = document.getElementById('callStatusLog');
    if(data.callType) activeCallType = data.callType;

    if (!peerConnection && data.type !== 'hangup' && data.type !== 'reject') {
        peerConnection = new RTCPeerConnection(servers);
        peerConnection.ontrack = event => {
            if (event.streams && event.streams[0]) {
                const remoteAudio = document.getElementById('remoteAudio');
                const remoteVideo = document.getElementById('remoteVideo');
                if(remoteAudio) remoteAudio.srcObject = event.streams[0];
                if(remoteVideo && activeCallType === 'video') remoteVideo.srcObject = event.streams[0];
                if(logEl) logEl.innerText = "✅ Connexion active !";
                arreterSonSonnerie();
            }
        };
        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                socket.emit('p2p_signal', { target: data.sender, sender: utilisateur.telephone, type: 'ice_candidate', candidate: event.candidate, callType: activeCallType });
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
            if(logEl) logEl.innerText = "✅ Appel décroché !";
        } catch(e) {}
    } else if (data.type === 'ice_candidate' && data.candidate && peerConnection) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch(e) {}
    } else if (data.type === 'hangup' || data.type === 'reject') {
        fermerAppelTotalLocally();
        if(logEl) logEl.innerText = "❌ Appel terminé.";
    }
});

async function accepterAppelEntrant() {
    arreterSonSonnerie();
    cacherModalAppelEntrant();
    if(incomingTimeout) clearTimeout(incomingTimeout);

    const logEl = document.getElementById('callStatusLog');
    const container = document.getElementById('callContainer');
    container.style.display = 'block';

    if(!pendingOfferData) return;
    const data = pendingOfferData;
    activeCallType = data.callType || 'audio';

    try {
        if(logEl) logEl.innerText = "📞 Décrochage...";
        localStream = await navigator.mediaDevices.getUserMedia({ 
            audio: true, 
            video: activeCallType === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false 
        });

        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        const remoteVideo = document.getElementById('remoteVideo');
        if(remoteVideo && activeCallType === 'video') {
            remoteVideo.srcObject = localStream;
        }

        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        socket.emit('p2p_signal', { target: data.sender, sender: utilisateur.telephone, type: 'answer', answer: answer, callType: activeCallType });
        if(logEl) logEl.innerText = "✅ Établi avec " + data.sender;
    } catch(err) {
        if(logEl) logEl.innerText = "❌ Erreur micro/caméra.";
    }
}

function rejeterAppelEntrant() {
    arreterSonSonnerie();
    cacherModalAppelEntrant();
    if(incomingTimeout) clearTimeout(incomingTimeout);

    if(pendingOfferData) {
        socket.emit('p2p_signal', { target: pendingOfferData.sender, sender: utilisateur.telephone, type: 'reject' });
        pendingOfferData = null;
    }
    fermerAppelTotalLocally();
}

function raccrocherAppel(isTimeout = false) {
    let targetTel = document.getElementById('appelCibleNum').value.trim();
    if(pendingOfferData && pendingOfferData.sender) {
        targetTel = pendingOfferData.sender;
    }
    if(targetTel) {
        socket.emit('p2p_signal', { target: targetTel, sender: utilisateur.telephone, type: 'hangup' });
    }
    fermerAppelTotalLocally();
}

function fermerAppelTotalLocally() {
    arreterSonSonnerie();
    cacherModalAppelEntrant();
    
    if(peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if(localStream) {
        localStream.getTracks().forEach(track => {
            track.stop();
        });
        localStream = null;
    }
    
    const remoteAudio = document.getElementById('remoteAudio');
    const remoteVideo = document.getElementById('remoteVideo');
    if(remoteAudio) remoteAudio.srcObject = null;
    if(remoteVideo) remoteVideo.srcObject = null;

    const container = document.getElementById('callContainer');
    if(container) container.style.display = 'none';
    
    pendingOfferData = null;
}

// LOGIQUE CRITIQUE DE GESTION DE LA PAGE D'ACCUEIL ET DE L'ENREGISTREMENT UNIQUE
document.addEventListener('DOMContentLoaded', () => {
    const welcomeModal = document.getElementById('welcomeModal');
    if (!utilisateur || !utilisateur.nom || !utilisateur.telephone) {
        // Premier accès : on affiche la modal d'enregistrement
        if(welcomeModal) welcomeModal.style.display = 'flex';
    } else {
        // Déjà enregistré : on masque définitivement la modal d'enregistrement
        if(welcomeModal) welcomeModal.style.display = 'none';
        appliquerInfosProfil();
        afficherContacts();
    }
    afficherNotesBlocNotes();
    afficherMessagesLocaux();
});

async function demanderPermissionsEtActiverProfil() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        stream.getTracks().forEach(track => track.stop());
    } catch (err) {}

    sauvegarderProfilBase();
}
