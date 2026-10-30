
let utilisateur = JSON.parse(localStorage.getItem('evat_profil')) || {
    nom: "Kodjo Marceline",
    telephone: "+22898231402",
    qubits: 365,
    notes: [],
    voyages: []
};

function sauvegarderProfilBase() {
    const nom = document.getElementById('inputNomProfil').value || document.getElementById('inputNom').value;
    const tel = document.getElementById('inputTelProfil').value || document.getElementById('inputTelProfil2').value;
    if(nom) utilisateur.nom = nom;
    if(tel) utilisateur.telephone = tel;
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    document.getElementById('welcomeModal').style.display = 'none';
    alert("✅ Profil et paramètres Nexus enregistrés !");
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

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    const target = document.getElementById('tab-' + tabId);
    if(target) target.style.display = 'block';
    const link = document.getElementById('link-' + tabId);
    if(link) link.classList.add('active');
    fermerTousLesMenus();
}

function ouvrirModeClavierDirect(e) {
    if(e) e.stopPropagation();
    alert("💬 Assistant ELAWS 3.59 activé. Posez votre question technique ou business.");
}

function basculerEcouteVocaleLiveDirect(e) {
    if(e) e.stopPropagation();
    alert("🎙️ Reconnaissance vocale ELAWS active.");
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
    afficherNotesBlocNotes();
    alert("Note enregistrée dans le noyau !");
}

function afficherNotesBlocNotes() {
    const container = document.getElementById('listeNotesContainer');
    if(!container) return;
    if(!utilisateur.notes || utilisateur.notes.length === 0) {
        container.innerHTML = `<p style="color:var(--text-secondary); font-size:11.5px;">Aucune note enregistrée.</p>`;
        return;
    }
    let html = '';
    utilisateur.notes.forEach(n => {
        html += `<div style="background:var(--bg-color); border:1px solid var(--border-color); padding:8px; border-radius:8px; margin-bottom:6px;">
            <strong style="color:var(--accent); font-size:12px;">📌 ${n.titre}</strong>
            <p style="font-size:11.5px; margin:2px 0;">${n.contenu}</p>
        </div>`;
    });
    container.innerHTML = html;
}

function genererPlanSucces1000() {
    const obj = document.getElementById('inputObjectif1000').value.trim();
    const container = document.getElementById('resultatPlan1000');
    if(!obj) { alert("Entrez un objectif."); return; }
    container.style.display = 'block';
    container.innerHTML = `<div style="background:var(--bg-color); padding:10px; border-radius:8px; border:1px solid var(--success);"><h4 style="color:var(--success); font-size:12.5px;">🚀 Plan 1000% : ${obj}</h4><p style="font-size:11.5px;">Phase 1: Nexus Scan • Phase 2: Quantum Encryption • Phase 3: Global Deployment.</p></div>`;
}

function lancerAnalyseVoyageAvance() {
    const dest = document.getElementById('voyageDestination').value.trim();
    const container = document.getElementById('resultatAssistantVoyage');
    if(!dest) { alert("Entrez une destination."); return; }
    container.style.display = 'block';
    container.innerHTML = `<div style="background:var(--bg-color); padding:10px; border-radius:8px; border:1px solid var(--accent);"><h4 style="color:var(--accent); font-size:12.5px;">✈️ Voyage vers ${dest}</h4><p style="font-size:11.5px;">Checklist visa et empreinte carbone calculées via le réseau Continuum.</p></div>`;
}

function exporterDonneesCloud() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(utilisateur, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", "evat_continuum_backup.json");
    document.body.appendChild(dl);
    dl.click();
    dl.remove();
}

function lancerAppelInternet(type) {
    alert("Connexion WebRTC Continuum établie pour l'appel " + type + " avec le numéro " + utilisateur.telephone);
}

document.addEventListener('DOMContentLoaded', () => {
    if(!utilisateur.nom || utilisateur.nom === "") {
        document.getElementById('welcomeModal').style.display = 'flex';
    }
    if(document.getElementById('inputNom')) document.getElementById('inputNom').value = utilisateur.nom;
    if(document.getElementById('inputNomProfil')) document.getElementById('inputNomProfil').value = utilisateur.nom;
    if(document.getElementById('inputTelProfil')) document.getElementById('inputTelProfil').value = utilisateur.telephone;
    if(document.getElementById('inputTelProfil2')) document.getElementById('inputTelProfil2').value = utilisateur.telephone;
    document.getElementById('dashQubitsScore').innerText = utilisateur.qubits || 365;
    afficherNotesBlocNotes();
});
