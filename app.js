
let utilisateur = JSON.parse(localStorage.getItem('evat_profil')) || {
    nom: "Kodjo Marceline",
    telephone: "+22898231402",
    qubits: 365
};

function sauvegarderProfilBase() {
    const nom = document.getElementById('inputNomProfil').value || document.getElementById('inputNom').value;
    if(nom) utilisateur.nom = nom;
    localStorage.setItem('evat_profil', JSON.stringify(utilisateur));
    document.getElementById('welcomeModal').style.display = 'none';
    alert("✅ Profil enregistré !");
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

function lancerAppelInternet(type) {
    alert("Connexion WebRTC établie via le serveur de signalisation distant pour appel " + type);
}

document.addEventListener('DOMContentLoaded', () => {
    if(!utilisateur.nom || utilisateur.nom === "") {
        document.getElementById('welcomeModal').style.display = 'flex';
    }
    if(document.getElementById('inputNom')) document.getElementById('inputNom').value = utilisateur.nom;
    if(document.getElementById('inputNomProfil')) document.getElementById('inputNomProfil').value = utilisateur.nom;
    document.getElementById('dashQubitsScore').innerText = utilisateur.qubits;
});
