
let utilisateur = JSON.parse(localStorage.getItem('evat_profil')) || {
    nom: "Kodjo Marceline",
    telephone: "+22898231402",
    qubits: 365,
    notes: [],
    messagesLocaux: []
};

const socket = io(SERVER_URL);

socket.on('connect', () => {
    const statusEl = document.getElementById('serverConnectionStatus');
    if(statusEl) {
        statusEl.innerHTML = "🟢 Connecté";
        statusEl.style.color = "var(--success)";
    }
});

socket.on('disconnect', () => {
    const statusEl = document.getElementById('serverConnectionStatus');
    if(statusEl) {
        statusEl.innerHTML = "🔴 Déconnecté";
        statusEl.style.color = "var(--danger)";
    }
});

function sauvegarderProfilBase() {
    const nom = document.getElementById('inputNomProfil').value || document.getElementById('inputNom').value;
    const tel = document.getElementById('inputTelProfil').value || document.getElementById('inputTelProfil2').value;
    if(nom) utilisateur.nom = nom;
    if(tel) utilisateur.telephone = tel;
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    document.getElementById('welcomeModal').style.display = 'none';
}

function toggleMenu(e) {
    if(e) e.stopPropagation();
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('appOverlay');
    const isOpen = sidebar.classList.toggle('open');
    if(isOpen) overlay.classList.add('active');
    else overlay.classList.remove('active');
}

function fermerTousLesMenus() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('appOverlay').classList.remove('active');
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
    if (navigator.geolocation) {
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
        if(!utilisateur.messagesLocaux) utilisateur.messagesLocaux = [];
        utilisateur.messagesLocaux.push({ expediteur: sender, texte: `📍 Position reçue`, heure: new Date().toLocaleTimeString() });
        localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    }
});

function ouvrirModeClavierDirect(e) {
    if(e) e.stopPropagation();
    alert("💬 Assistant ELAWS actif.");
}

function basculerEcouteVocaleLiveDirect(e) {
    if(e) e.stopPropagation();
    alert("🎙️ Écoute vocale active.");
}

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
    if(!texte) return;
    if(!utilisateur.messagesLocaux) utilisateur.messagesLocaux = [];
    utilisateur.messagesLocaux.push({ expediteur: utilisateur.nom || "Moi", texte, heure: new Date().toLocaleTimeString() });
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    input.value = '';
    afficherMessagesLocaux();
}

function afficherMessagesLocaux() {
    const container = document.getElementById('listeMessagesLocaux');
    if(!container) return;
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
    if(!titre || !contenu) return;
    if(!utilisateur.notes) utilisateur.notes = [];
    utilisateur.notes.unshift({ titre, contenu });
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    document.getElementById('noteTitre').value = '';
    document.getElementById('noteContenu').value = '';
    afficherNotesBlocNotes();
}

function afficherNotesBlocNotes() {
    const container = document.getElementById('listeNotesContainer');
    if(!container) return;
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
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(utilisateur, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", "evat_backup.json");
    document.body.appendChild(dl);
    dl.click();
    dl.remove();
}

let localStream;
let peerConnection;
const servers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

async function lancerAppelInternet(type) {
    const logEl = document.getElementById('callStatusLog');
    try {
        if(logEl) logEl.innerText = "Connexion appel...";
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
        
        peerConnection = new RTCPeerConnection(servers);
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                socket.emit('signal', { type: 'ice_candidate', candidate: event.candidate });
            }
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('signal', { type: 'offer', offer: offer });

        if(logEl) logEl.innerText = "🎙️ Appel actif";
        alert("Appel initialisé avec succès !");
    } catch (error) {
        if(logEl) logEl.innerText = "Erreur réseau ou micro";
        alert("Impossible d'accéder au micro/caméra.");
    }
}

socket.on('signal', async (data) => {
    if (!peerConnection) {
        peerConnection = new RTCPeerConnection(servers);
        peerConnection.onicecandidate = event => {
            if (event.candidate) socket.emit('signal', { type: 'ice_candidate', candidate: event.candidate });
        };
    }

    if (data.type === 'offer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('signal', { type: 'answer', answer: answer });
    } else if (data.type === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    } else if (data.type === 'ice_candidate' && data.candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
});

document.addEventListener('DOMContentLoaded', () => {
    if(!utilisateur.nom || utilisateur.nom === "") {
        document.getElementById('welcomeModal').style.display = 'flex';
    }
    if(document.getElementById('inputNom')) document.getElementById('inputNom'].value = utilisateur.nom;
    if(document.getElementById('inputNomProfil')) document.getElementById('inputNomProfil'].value = utilisateur.nom;
    if(document.getElementById('inputTelProfil')) document.getElementById('inputTelProfil'].value = utilisateur.telephone;
    if(document.getElementById('inputTelProfil2')) document.getElementById('inputTelProfil2'].value = utilisateur.telephone;
    afficherNotesBlocNotes();
    afficherMessagesLocaux();
});
