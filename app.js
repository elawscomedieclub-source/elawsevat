
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

socket.on('private_message', (data) => { if (typeof recevoirMessagePrive === 'function') recevoirMessagePrive(data); });

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

let conversationActiveTel = null;

function assurerConversations() {
    if (!utilisateur) return;
    if (!utilisateur.conversations || Array.isArray(utilisateur.conversations)) {
        // migrate old flat messages if any
        const old = utilisateur.conversations;
        utilisateur.conversations = {};
        if (utilisateur.messagesLocaux && utilisateur.messagesLocaux.length) {
            // keep legacy list separate; conversations is object map
        }
    }
}

function telKey(tel) {
    return String(tel || '').replace(/\s+/g, '').trim();
}

function ouvrirConversation(nom, tel) {
    assurerConversations();
    const key = telKey(tel);
    if (!key) return;
    if (!utilisateur.conversations[key]) {
        utilisateur.conversations[key] = { nom: nom || key, messages: [] };
    } else if (nom) {
        utilisateur.conversations[key].nom = nom;
    }
    conversationActiveTel = key;
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    switchTab('messagerie');
    afficherMessagesLocaux();
    setTimeout(() => {
        const input = document.getElementById('chatLocalInput');
        if (input) input.focus();
    }, 200);
}

function ecrireAuContact(nom, tel) {
    ouvrirConversation(nom, tel);
}

function fermerConversationActive() {
    conversationActiveTel = null;
    afficherMessagesLocaux();
}

function listeConversationsRecentes() {
    assurerConversations();
    const entries = Object.keys(utilisateur.conversations || {}).map(k => {
        const conv = utilisateur.conversations[k];
        const msgs = conv.messages || [];
        const last = msgs[msgs.length - 1];
        return {
            tel: k,
            nom: conv.nom || k,
            lastTexte: last ? (last.texte || (last.photo ? '📷 Photo' : '')) : 'Aucun message',
            lastHeure: last ? last.heure : '',
            count: msgs.length
        };
    });
    entries.sort((a, b) => (b.lastHeure || '').localeCompare(a.lastHeure || ''));
    return entries;
}

function escChat(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
}

function afficherMessagesLocaux() {
    const container = document.getElementById('listeMessagesLocaux');
    const header = document.getElementById('chatConversationHeader');
    const emptyHint = document.getElementById('chatEmptyHint');
    if (!container || !utilisateur) return;
    assurerConversations();

    // Header conversation
    if (header) {
        if (conversationActiveTel && utilisateur.conversations[conversationActiveTel]) {
            const conv = utilisateur.conversations[conversationActiveTel];
            header.style.display = 'flex';
            header.innerHTML = `
              <button type="button" onclick="fermerConversationActive()" class="btn-action" style="width:auto;padding:6px 10px;font-size:12px;background:rgba(59,130,246,0.15);color:var(--accent);border:1px solid var(--border-color);box-shadow:none;">←</button>
              <div style="flex:1;min-width:0;">
                <div style="font-weight:700;font-size:13.5px;color:var(--text-primary);">${escChat(conv.nom)}</div>
                <div style="font-size:11px;color:var(--text-secondary);">${escChat(conversationActiveTel)} · stocké sur l'appareil</div>
              </div>
              <button type="button" onclick="preparerAppel('${escChat(conversationActiveTel)}')" class="btn-action" style="width:auto;padding:6px 10px;font-size:14px;background:var(--success);">📞</button>`;
        } else {
            header.style.display = 'none';
            header.innerHTML = '';
        }
    }

    if (!conversationActiveTel) {
        // Liste des conversations
        const list = listeConversationsRecentes();
        if (emptyHint) emptyHint.style.display = 'block';
        if (!list.length) {
            container.innerHTML = `<div style="text-align:center;padding:24px 12px;color:var(--text-secondary);font-size:12px;">
              <div style="font-size:28px;margin-bottom:8px;">💬</div>
              <p style="margin:0;">Aucune conversation. Ouvre un contact et appuie sur <b>Message</b>.</p>
            </div>`;
            return;
        }
        let html = '';
        list.forEach(c => {
            html += `<div onclick="ouvrirConversation('${escChat(c.nom).replace(/'/g, "\\'")}','${escChat(c.tel).replace(/'/g, "\\'")}')" style="display:flex;gap:10px;align-items:center;padding:10px;border:1px solid var(--border-color);border-radius:12px;margin-bottom:8px;cursor:pointer;">
              <div style="width:40px;height:40px;border-radius:12px;background:rgba(59,130,246,0.2);display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--accent);">${escChat((c.nom||'?')[0].toUpperCase())}</div>
              <div style="flex:1;min-width:0;">
                <div style="font-weight:600;font-size:13px;">${escChat(c.nom)}</div>
                <div style="font-size:11px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escChat(c.lastTexte)}</div>
              </div>
              <div style="font-size:10px;color:var(--text-secondary);">${escChat(c.lastHeure)}</div>
            </div>`;
        });
        container.innerHTML = html;
        return;
    }

    if (emptyHint) emptyHint.style.display = 'none';
    const conv = utilisateur.conversations[conversationActiveTel];
    const msgs = (conv && conv.messages) || [];
    if (!msgs.length) {
        container.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-secondary);font-size:12px;">Début de la conversation avec ${escChat(conv.nom)}. Écris un message ci-dessous.</div>`;
        return;
    }
    let html = '';
    msgs.forEach(m => {
        const mine = !!m.mine;
        html += `<div style="display:flex;justify-content:${mine ? 'flex-end' : 'flex-start'};margin-bottom:8px;">
          <div style="max-width:85%;background:${mine ? 'rgba(16,185,129,0.2)' : 'rgba(59,130,246,0.12)'};border:1px solid ${mine ? 'rgba(16,185,129,0.35)' : 'var(--border-color)'};padding:8px 12px;border-radius:14px;border-bottom-${mine ? 'right' : 'left'}-radius:4px;">
            <div style="font-size:10px;color:var(--text-secondary);margin-bottom:2px;">${mine ? 'Moi' : escChat(m.from || conv.nom)} · ${escChat(m.heure || '')}</div>
            ${m.photo ? `<img src="${m.photo}" alt="photo" style="max-width:100%;border-radius:8px;margin:4px 0;display:block;">` : ''}
            ${m.texte ? `<p style="margin:0;font-size:13px;line-height:1.4;white-space:pre-wrap;">${escChat(m.texte)}</p>` : ''}
          </div>
        </div>`;
    });
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

function envoyerMessageChatLocal() {
    const input = document.getElementById('chatLocalInput');
    const texte = (input?.value || '').trim();
    if (!utilisateur) return;
    if (!conversationActiveTel) {
        alert('Choisis d\'abord un contact (Message) pour ouvrir une conversation.');
        return;
    }
    if (!texte && !window._chatPhotoEnCours) return;
    assurerConversations();
    const conv = utilisateur.conversations[conversationActiveTel];
    if (!conv) return;

    const msg = {
        id: 'm' + Date.now() + Math.random().toString(36).slice(2, 6),
        from: utilisateur.nom || 'Moi',
        fromTel: utilisateur.telephone,
        texte: texte || '',
        photo: window._chatPhotoEnCours || null,
        heure: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mine: true
    };
    conv.messages.push(msg);
    // limiter taille locale (garder 200 derniers messages / conversation)
    if (conv.messages.length > 200) conv.messages = conv.messages.slice(-200);
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    if (input) input.value = '';
    window._chatPhotoEnCours = null;
    const preview = document.getElementById('chatPhotoPreview');
    if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }

    afficherMessagesLocaux();

    // Envoi temps réel si serveur dispo (relais uniquement, pas de stockage serveur)
    try {
        if (typeof socket !== 'undefined' && socket && socket.connected) {
            socket.emit('private_message', {
                to: conversationActiveTel,
                from: utilisateur.telephone,
                fromNom: utilisateur.nom,
                texte: msg.texte,
                photo: msg.photo,
                id: msg.id,
                heure: msg.heure
            });
        }
    } catch (e) {}
}

function choisirPhotoChat() {
    const input = document.getElementById('chatPhotoInput');
    if (input) input.click();
}

function onChatPhotoSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (file.size > 900000) {
        alert('Photo trop lourde (max ~900 Ko). Compresse-la un peu.');
        event.target.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        window._chatPhotoEnCours = e.target.result;
        const preview = document.getElementById('chatPhotoPreview');
        if (preview) {
            preview.style.display = 'block';
            preview.innerHTML = `<img src="${e.target.result}" style="max-height:80px;border-radius:8px;"> <button type="button" onclick="window._chatPhotoEnCours=null;document.getElementById('chatPhotoPreview').style.display='none';" style="background:none;border:none;color:#f87171;cursor:pointer;">✕</button>`;
        }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
}

function recevoirMessagePrive(data) {
    if (!utilisateur || !data) return;
    assurerConversations();
    const fromTel = telKey(data.from);
    if (!fromTel) return;
    if (!utilisateur.conversations[fromTel]) {
        utilisateur.conversations[fromTel] = { nom: data.fromNom || fromTel, messages: [] };
    }
    const conv = utilisateur.conversations[fromTel];
    if (data.fromNom) conv.nom = data.fromNom;
    // éviter doublons
    if (data.id && conv.messages.some(m => m.id === data.id)) return;
    conv.messages.push({
        id: data.id || ('r' + Date.now()),
        from: data.fromNom || fromTel,
        fromTel: fromTel,
        texte: data.texte || '',
        photo: data.photo || null,
        heure: data.heure || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mine: false
    });
    if (conv.messages.length > 200) conv.messages = conv.messages.slice(-200);
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    if (conversationActiveTel === fromTel || !conversationActiveTel) {
        if (document.getElementById('tab-messagerie')?.style.display !== 'none') {
            afficherMessagesLocaux();
        }
    }
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
