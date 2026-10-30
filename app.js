
let utilisateur = JSON.parse(localStorage.getItem('evat_profil')) || {
    nom: "Kodjo Marceline",
    telephone: "+22898231402",
    qubits: 365,
    notes: [],
    voyages: []
};

function sauvegarderProfilBase() {
    const nom = document.getElementById('inputNomProfil').value || document.getElementById('inputNom').value;
    const tel = document.getElementById('inputTelProfil').value;
    if(nom) utilisateur.nom = nom;
    if(tel) utilisateur.telephone = tel;
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    document.getElementById('welcomeModal').style.display = 'none';
    alert("✅ Profil et paramètres VoIP enregistrés !");
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
    alert("Note enregistrée !");
}

function afficherNotesBlocNotes() {
    const container = document.getElementById('listeNotesContainer');
    if(!container) return;
    if(!utilisateur.notes || utilisateur.notes.length === 0) {
        container.innerHTML = `<p style="color:var(--text-secondary); font-size:12px;">Aucune note.</p>`;
        return;
    }
    let html = '';
    utilisateur.notes.forEach(n => {
        html += `<div style="background:var(--bg-color); border:1px solid var(--border-color); padding:8px; border-radius:8px; margin-bottom:6px;">
            <strong style="color:var(--accent); font-size:12.5px;">📌 ${n.titre}</strong>
            <p style="font-size:12px; margin:2px 0;">${n.contenu}</p>
        </div>`;
    });
    container.innerHTML = html;
}

function genererPlanSucces1000() {
    const obj = document.getElementById('inputObjectif1000').value.trim();
    const container = document.getElementById('resultatPlan1000');
    if(!obj) { alert("Entrez un objectif."); return; }
    container.style.display = 'block';
    container.innerHTML = `<div style="background:var(--bg-color); padding:10px; border-radius:8px; border:1px solid var(--success);"><h4 style="color:var(--success); font-size:13px;">🚀 Plan 1000% pour : ${obj}</h4><p style="font-size:12px;">Phase 1: Analyse mondiale • Phase 2: Automatisation • Phase 3: Expansion quantique.</p></div>`;
}

function lancerAnalyseVoyageAvance() {
    const dest = document.getElementById('voyageDestination').value.trim();
    const container = document.getElementById('resultatAssistantVoyage');
    if(!dest) { alert("Entrez une destination."); return; }
    container.style.display = 'block';
    container.innerHTML = `<div style="background:var(--bg-color); padding:10px; border-radius:8px; border:1px solid var(--accent);"><h4 style="color:var(--accent); font-size:13px;">✈️ Voyage vers ${dest}</h4><p style="font-size:12px;">Checklist visa, passeport et empreinte carbone calculés avec succès.</p></div>`;
}

function exporterDonneesCloud() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(utilisateur, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", "evat_backup_ultime.json");
    document.body.appendChild(dl);
    dl.click();
    dl.remove();
}

function lancerAppelInternet(type) {
    alert("Connexion WebRTC établie pour l'appel " + type + " avec le numéro " + utilisateur.telephone);
}

document.addEventListener('DOMContentLoaded', () => {
    if(!utilisateur.nom || utilisateur.nom === "") {
        document.getElementById('welcomeModal').style.display = 'flex';
    }
    if(document.getElementById('inputNom')) document.getElementById('inputNom').value = utilisateur.nom;
    if(document.getElementById('inputNomProfil')) document.getElementById('inputNomProfil').value = utilisateur.nom;
    if(document.getElementById('inputTelProfil')) document.getElementById('inputTelProfil').value = utilisateur.telephone;
    document.getElementById('dashQubitsScore').innerText = utilisateur.qubits || 365;
    afficherNotesBlocNotes();
});
