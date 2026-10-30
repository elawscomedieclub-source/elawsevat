
let utilisateur = JSON.parse(localStorage.getItem('evat_profil')) || null;
let iaDejaPresentee = localStorage.getItem('elaws_presentee') === 'true';

const socket = io(SERVER_URL);

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

// Écoute de l'alerte sentinelle : lorsqu'un numéro de nos contacts s'inscrit sur le réseau
socket.on('contact_registered', (data) => {
    // data contient { nom, telephone, metier }
    if(utilisateur && utilisateur.contacts) {
        const match = utilisateur.contacts.find(c => c.telephone === data.telephone);
        if(match) {
            // Mettre à jour son métier automatiquement
            match.metier = data.metier;
            localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
            afficherContacts();

            // Afficher la notification sentinelle
            montrerNotification(`🚨 Votre contact ${match.nom} (${data.telephone}) vient de s'inscrire sur le système ! Métier : ${data.metier}`);
        }
    }
});

function montrerNotification(texte) {
    const banner = document.getElementById('notificationBanner');
    const textEl = document.getElementById('notificationText');
    if(banner && textEl) {
        textEl.innerText = texte;
        banner.style.display = 'block';
        setTimeout(() => {
            fermerNotification();
        }, 10000);
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
        alert("Veuillez remplir votre nom et votre numéro de téléphone.");
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
        historiqueElaws: []
    };

    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    document.getElementById('welcomeModal').style.display = 'none';
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
    alert("✅ Profil mis à jour avec succès !");
}

function deconnecterUtilisateur() {
    if(confirm("Voulez-vous vraiment vous déconnecter ?")) {
        localStorage.removeItem('evat_profil');
        localStorage.removeItem('elaws_presentee');
        iaDejaPresentee = false;
        utilisateur = null;
        fermerTousLesMenus();
        document.getElementById('welcomeModal').style.display = 'flex';
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
    
    verifierEtSynchroniserContacts();
    afficherContacts();
}

function verifierEtSynchroniserContacts() {
    if(!utilisateur || !utilisateur.contacts) return;
    
    socket.emit('query_contacts', utilisateur.contacts.map(c => c.telephone), (reponses) => {
        if(reponses && Array.isArray(reponses)) {
            reponses.forEach(info => {
                const contact = utilisateur.contacts.find(c => c.telephone === info.telephone);
                if(contact && info.metier) {
                    contact.metier = info.metier;
                }
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
        container.innerHTML = `<p style="color:var(--text-secondary); font-size:11.5px;">Aucun contact enregistré.</p>`;
        return;
    }

    let html = '';
    utilisateur.contacts.forEach((c, index) => {
        html += `<div style="background:var(--bg-color); border:1px solid var(--border-color); padding:10px; border-radius:10px; display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <div>
                <strong style="color:var(--accent); font-size:12.5px;">👤 ${c.nom}</strong>
                <div style="font-size:11px; color:var(--text-secondary);">📞 ${c.telephone} • <i style="color:var(--success);">${c.metier || 'Synchronisation...'}</i></div>
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
        alert("Veuillez indiquer le nom et le numéro du contact.");
        return;
    }

    if(!utilisateur.contacts) utilisateur.contacts = [];
    // Vérifier si le contact existe déjà
    const existing = utilisateur.contacts.find(c => c.telephone === tel);
    if(existing) {
        alert("Ce numéro est déjà dans vos contacts !");
        return;
    }

    utilisateur.contacts.push({ nom, telephone: tel, metier: "Recherche..." });
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));

    document.getElementById('nouveauNomContact').value = '';
    document.getElementById('nouveauTelContact').value = '';

    // Affichage immédiat et synchronisation
    afficherContacts();
    verifierEtSynchroniserContacts();
    alert("✅ Contact enregistré et affiché !");
}

function modifierContact(index) {
    const c = utilisateur.contacts[index];
    const nouveauNom = prompt("Modifier le nom du contact :", c.nom);
    if(nouveauNom === null) return;
    const nouveauTel = prompt("Modifier le numéro de téléphone :", c.telephone);
    if(nouveauTel === null) return;

    if(!nouveauNom.trim() || !nouveauTel.trim()) {
        alert("Le nom et le numéro ne peuvent pas être vides.");
        return;
    }

    utilisateur.contacts[index].nom = nouveauNom.trim();
    utilisateur.contacts[index].telephone = nouveauTel.trim();

    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    afficherContacts();
    verifierEtSynchroniserContacts();
    alert("✅ Contact modifié !");
}

function supprimerContact(index) {
    const c = utilisateur.contacts[index];
    if(confirm(`Voulez-vous vraiment supprimer ${c.nom} ?`)) {
        utilisateur.contacts.splice(index, 1);
        localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
        afficherContacts();
        alert("🗑️ Contact supprimé.");
    }
}

function ecrireAuContact(nom, tel) {
    const message = prompt(`Envoyer un message à ${nom} (${tel}) :`);
    if(!message) return;

    if(!utilisateur.messagesLocaux) utilisateur.messagesLocaux = [];
    utilisateur.messagesLocaux.push({ 
        expediteur: utilisateur.nom || "Moi", 
        texte: `À ${nom} (${tel}) : ${message}`, 
        heure: new Date().toLocaleTimeString() 
    });
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    switchTab('messagerie');
    alert(`✅ Message transmis à ${nom} !`);
}

function preparerAppel(tel) {
    switchTab('communications');
    document.getElementById('appelCibleNum').value = tel;
}

// Fonction pour dicter par la voix dans l'Assistant IA
function basculerEcouteVocaleIA() {
    const statusEl = document.getElementById('micStatusElaws');
    const inputEl = document.getElementById('elawsInput');

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert("La reconnaissance vocale n'est pas supportée par votre navigateur actuel. Utilisez Chrome ou Edge.");
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    if(statusEl) statusEl.innerText = "🎙️ Écoute en cours... Parlez maintenant.";

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        inputEl.value = transcript;
        if(statusEl) statusEl.innerText = "✅ Texte transcrit !";
        setTimeout(() => {
            if(statusEl) statusEl.innerText = "";
        }, 3000);
    };

    recognition.onerror = (event) => {
        if(statusEl) statusEl.innerText = "❌ Erreur de micro.";
    };

    recognition.start();
}

// Module Assistant IA ELAWS (Réponses directes et sans répétition de présentation)
function poserQuestionElaws() {
    const input = document.getElementById('elawsInput');
    const question = input.value.trim();
    if(!question || !utilisateur) return;

    const chatBox = document.getElementById('elawsChatBox');
    
    chatBox.innerHTML += `<div style="background:rgba(255,255,255,0.05); border:1px solid var(--border-color); padding:8px; border-radius:8px; text-align:right;">
        <strong style="color:var(--success); font-size:11.5px;">👤 ${utilisateur.nom} :</strong>
        <p style="font-size:12px; margin:3px 0 0 0;">${question}</p>
    </div>`;
    
    input.value = '';
    chatBox.scrollTop = chatBox.scrollHeight;

    setTimeout(() => {
        let reponse = "";
        
        if(!iaDejaPresentee) {
            reponse = `Bonjour, je m'appelle ELAWS, votre intelligence artificielle. Concernant votre demande "${question}" : Voici l'analyse technique et opérationnelle pour ${utilisateur.nom} (${utilisateur.metier}) : exécution validée et sécurisée.`;
            localStorage.setItem('elaws_presentee', 'true');
            iaDejaPresentee = true;
        } else {
            const qLower = question.toLowerCase();
            if(qLower.includes('visa') || qLower.includes('voyage')) {
                reponse = `Pour votre voyage depuis Lomé, vérifiez la validité de votre passeport biométrique et préparez les justificatifs requis pour votre destination.`;
            } else if(qLower.includes('entreprise') || qLower.includes('business') || qLower.includes('NIF')) {
                reponse = `Pour votre structure indépendante, centralisez vos déclarations fiscales avec un identifiant unique conforme aux normes en vigueur.`;
            } else if(qLower.includes('bonjour') || qLower.includes('salut')) {
                reponse = `Bonjour ! Que puis-je faire pour vous ?`;
            } else {
                reponse = `Voici les éléments de réponse pour "${question}" : traitement effectué avec succès pour votre profil.`;
            }
        }

        chatBox.innerHTML += `<div style="background:rgba(59,130,246,0.1); border:1px solid var(--accent); padding:8px; border-radius:8px;">
            <strong style="color:var(--accent); font-size:11.5px;">🤖 ELAWS AI :</strong>
            <p style="font-size:12px; margin:3px 0 0 0;">${reponse}</p>
        </div>`;
        chatBox.scrollTop = chatBox.scrollHeight;
    }, 400);
}

function toggleMenu(e) {
    if(e) {
        e.stopPropagation();
        e.preventDefault();
    }
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

    if(tabId === 'contacts') {
        afficherContacts();
    }

    if(tabId === 'map') {
        setTimeout(() => {
            if(!mapInstance) {
                mapInstance = L.map('mapContainer').setView([6.1375, 1.2123], 13);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '© OpenStreetMap'
                }).addTo(mapInstance);
            } else {
                mapInstance.invalidateSize();
            }
        }, 200);
    }
}

function centrerSurMoi() {
    const logEl = document.getElementById('gpsStatusLog');
    if (navigator.geolocation) {
        if(logEl) logEl.innerText = "Recherche GPS...";
        navigator.geolocation.getCurrentPosition(position => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            if(mapInstance) {
                mapInstance.setView([lat, lng], 15);
                if(userMarker) mapInstance.removeLayer(userMarker);
                userMarker = L.marker([lat, lng]).addTo(mapInstance)
                    .bindPopup("<b>📍 Vous êtes ici</b>").openPopup();
            }
            if(logEl) logEl.innerText = "✅ Position localisée";
        }, error => {
            if(logEl) logEl.innerText = "Erreur GPS";
        }, { enableHighAccuracy: true });
    }
}

function partagerMaPositionGPS() {
    if (navigator.geolocation && utilisateur) {
        navigator.geolocation.getCurrentPosition(position => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const msg = `📍 Position GPS : https://maps.google.com/?q=${lat},${lng}`;
            
            socket.emit('signal', { type: 'location', sender: utilisateur.nom, lat, lng });
            
            if(!utilisateur.messagesLocaux) utilisateur.messagesLocaux = [];
            utilisateur.messagesLocaux.push({ expediteur: utilisateur.nom || "Moi", texte: msg, heure: new Date().toLocaleTimeString() });
            localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
            
            alert("Position partagée !");
        }, error => {
            alert("Erreur GPS.");
        }, { enableHighAccuracy: true });
    }
}

socket.on('signal', (data) => {
    if (data.type === 'location' && mapInstance) {
        const { sender, lat, lng } = data;
        L.marker([lat, lng]).addTo(mapInstance).bindPopup(`<b>📍 ${sender}</b>`);
        if(!utilisateur) utilisateur = { messagesLocaux: [] };
        if(!utilisateur.messagesLocaux) utilisateur.messagesLocaux = [];
        utilisateur.messagesLocaux.push({ expediteur: sender, texte: `📍 Position reçue`, heure: new Date().toLocaleTimeString() });
        localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    }
});

function selectionnerDossierStockageTelephone() {
    if ('showDirectoryPicker' in window) {
        window.showDirectoryPicker().then(dirHandle => {
            document.getElementById('fileAccessStatus').innerHTML = `<span style="color:var(--success);">✅ Lié</span>`;
        }).catch(err => {});
    }
}

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
    if(!container || !utilisateur) return;
    if(!utilisateur.messagesLocaux || utilisateur.messagesLocaux.length === 0) {
        container.innerHTML = `<p style="color:var(--text-secondary); font-size:11.5px;">Aucun message.</p>`;
        return;
    }
    let html = '';
    utilisateur.messagesLocaux.forEach(m => {
        html += `<div style="background:var(--bg-color); border:1px solid var(--border-color); padding:8px; border-radius:8px; margin-bottom:6px;">
            <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--accent);">
                <span>👤 ${m.expediteur}</span>
                <span>${m.heure}</span>
            </div>
            <p style="font-size:12px; margin:3px 0 0 0;">${m.texte}</p>
        </div>`;
    });
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
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
    if(!container || !utilisateur) return;
    if(!utilisateur.notes || utilisateur.notes.length === 0) {
        container.innerHTML = `<p style="color:var(--text-secondary); font-size:11.5px;">Aucune note.</p>`;
        return;
    }
    let html = '';
    utilisateur.notes.forEach(n => {
        html += `<div style="background:var(--bg-color); border:1px solid var(--border-color); padding:10px; border-radius:10px; margin-bottom:8px;">
            <strong style="color:var(--accent); font-size:12.5px;">📌 ${n.titre}</strong>
            <p style="font-size:12px; margin:3px 0;">${n.contenu}</p>
        </div>`;
    });
    container.innerHTML = html;
}

function genererPlanSucces1000() {
    const obj = document.getElementById('inputObjectif1000').value.trim();
    const container = document.getElementById('resultatPlan1000');
    if(!obj) return;
    container.style.display = 'block';
    container.innerHTML = `<div style="background:var(--bg-color); padding:12px; border-radius:12px; border:1px solid var(--success);"><h4 style="color:var(--success); font-size:13px;">🚀 Objectif : ${obj}</h4><p style="font-size:12px;">Plan stratégique en cours d'exécution.</p></div>`;
}

function lancerAnalyseVoyageAvance() {
    const dest = document.getElementById('voyageDestination').value.trim();
    const container = document.getElementById('resultatAssistantVoyage');
    if(!dest) return;
    container.style.display = 'block';
    container.innerHTML = `<div style="background:var(--bg-color); padding:12px; border-radius:12px; border:1px solid var(--accent);"><h4 style="color:var(--accent); font-size:13px;">✈️ ${dest}</h4><p style="font-size:12px;">Analyse des documents et formalités validée.</p></div>`;
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

// Système d'appel direct P2P
let localStream;
let peerConnection;
const servers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

async function lancerAppelDirectPeer(type) {
    const cibleTel = document.getElementById('appelCibleNum').value.trim();
    const logEl = document.getElementById('callStatusLog');
    const container = document.getElementById('callContainer');

    if(!cibleTel) {
        alert("Veuillez entrer ou sélectionner le numéro du contact à appeler.");
        return;
    }

    try {
        if(logEl) logEl.innerText = "Appel en cours vers " + cibleTel + " (sonnerie)...";
        container.style.display = 'block';

        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
        peerConnection = new RTCPeerConnection(servers);
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.ontrack = event => {
            if (event.streams && event.streams[0]) {
                document.getElementById('remoteAudio').srcObject = event.streams[0];
                document.getElementById('remoteVideo').srcObject = event.streams[0];
            }
        };

        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                socket.emit('p2p_signal', { target: cibleTel, sender: utilisateur.telephone, type: 'ice_candidate', candidate: event.candidate });
            }
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('p2p_signal', { target: cibleTel, sender: utilisateur.telephone, type: 'offer', offer: offer });
        if(logEl) logEl.innerText = "📞 Sonnerie active chez " + cibleTel + "...";

    } catch (error) {
        if(logEl) logEl.innerText = "Erreur d'accès au micro/caméra ou réseau.";
        alert("Impossible d'initialiser l'appel direct.");
    }
}

socket.on('p2p_signal', async (data) => {
    const logEl = document.getElementById('callStatusLog');
    const container = document.getElementById('callContainer');

    if (!peerConnection) {
        peerConnection = new RTCPeerConnection(servers);
        peerConnection.ontrack = event => {
            if (event.streams && event.streams[0]) {
                document.getElementById('remoteAudio').srcObject = event.streams[0];
                document.getElementById('remoteVideo').srcObject = event.streams[0];
            }
        };
        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                socket.emit('p2p_signal', { target: data.sender, sender: utilisateur.telephone, type: 'ice_candidate', candidate: event.candidate });
            }
        };
    }

    if (data.type === 'offer') {
        if(confirm(`📞 Appel entrant de ${data.sender}. Voulez-vous décrocher ?`)) {
            container.style.display = 'block';
            if(logEl) logEl.innerText = "📞 Appel connecté avec " + data.sender;
            
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            socket.emit('p2p_signal', { target: data.sender, sender: utilisateur.telephone, type: 'answer', answer: answer });
        }
    } else if (data.type === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        if(logEl) logEl.innerText = "✅ Appel établi !";
    } else if (data.type === 'ice_candidate' && data.candidate) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch(e) {}
    }
});

function raccrocherAppel() {
    if(peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if(localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    document.getElementById('callContainer').style.display = 'none';
    document.getElementById('callStatusLog').innerText = "Appel terminé.";
}

document.addEventListener('DOMContentLoaded', () => {
    if(!utilisateur || !utilisateur.nom) {
        document.getElementById('welcomeModal').style.display = 'flex';
    } else {
        appliquerInfosProfil();
        afficherContacts();
    }
    afficherNotesBlocNotes();
    afficherMessagesLocaux();
});
