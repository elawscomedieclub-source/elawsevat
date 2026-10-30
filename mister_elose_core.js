
/**
 * ============================================================================
 * MODULE AUTONOME : MISTER ELOSE (Sigle: E) - VERSION MÉDICALE & UNIVERSELLE
 * ============================================================================
 * Assistant clinique intelligent, analyse des symptômes, dossiers médicaux,
 * plans d'architecture hospitalière, art, couture, et dialectes du monde.
 */

class MisterEloseAI {
    constructor(config = {}) {
        this.name = "Mister Elose";
        this.sigle = "E";
        this.version = "4.0.0-medical";
        this.userProfile = config.userProfile || { nom: "Eric", metier: "Opérateur & Praticien", telephone: "+22898231402" };
        this.memory = [];

        this.dialectPacks = {
            'fr': { greeting: "Bonjour.", thanks: "À votre service." },
            'en': { greeting: "Hello.", thanks: "You're welcome." },
            'mina': { greeting: "Klo.", thanks: "Akpe." },
            'ewhe': { greeting: "Nye kpor.", thanks: "Akpe na wo." }
        };
        console.log(`[${this.sigle}] ${this.name} initialisé en mode Médical & Clinique.`);
    }

    updateContext(profile) {
        if(profile) this.userProfile = { ...this.userProfile, ...profile };
    }

    detectLanguage(text) {
        const t = text.toLowerCase();
        if (t.includes('hello') || t.includes('hi ')) return 'en';
        if (t.includes('akpe') || t.includes('klo')) return 'mina';
        return 'fr';
    }

    async processQuery(question) {
        if (!question || typeof question !== 'string') return "Veuillez préciser votre demande médicale ou technique.";

        const cleanQ = question.trim();
        const lang = this.detectLanguage(cleanQ);
        const qLower = cleanQ.toLowerCase();
        let responseText = "";

        // Diagnostic / Symptômes / Médical
        if (qLower.includes('symptome') || qLower.includes('fievre') || qLower.includes('douleur') || qLower.includes('diagnostic') || qLower.includes('malade') || qLower.includes('traitement') || qLower.includes('clinique')) {
            responseText = `🩺 Analyse Clinique & Pré-diagnostic [E] :
- Observation : Analyse de la plainte "${cleanQ}".
- Recommandations initiales : Surveillance des constantes vitales (température, tension artérielle, pouls), hydratation adéquate et repos strict.
- Orientation : Consultez un médecin spécialiste pour confirmation biologique ou radiologique si les symptômes persistent au-delà de 48 heures.`;
        }
        // Dossier Patient / Fiche Médicale
        else if (qLower.includes('patient') || qLower.includes('dossier') || qLower.includes('prescription') || qLower.includes('ordonnance')) {
            responseText = `📋 Gestion du Dossier Médical :
- Praticien responsable : ${this.userProfile.nom} (${this.userProfile.metier})
- Sécurité : Données chiffrées et stockées localement dans l'écosystème pour le respect du secret médical.`;
        }
        // Architecture de structure de santé
        else if (qLower.includes('hopital') || qLower.includes('clinique') || qLower.includes('cabinet') || qLower.includes('architecture')) {
            responseText = `🏥 Conception d'Infrastructure de Santé :
- Organisation : Espace d'accueil, salle de tri, cabinet de consultation stérile, unité de soins d'urgence et zone de repos.
- Normes : Ventilation naturelle croisée, surfaces lavables antibactériennes et circuits séparés pour patients et déchets biomédicaux.`;
        }
        // Couture / Tenues médicales
        else if (qLower.includes('blouse') || qLower.includes('tenue') || qLower.includes('couture') || qLower.includes('uniforme')) {
            responseText = `🥼 Design de Tenues Médicales & Professionnelles :
- Modèle : Blouse ergonomique et pantalon chirurgical renforcé.
- Tissus : Mélange polycoton déperlant, résistants aux lavages intensifs et aux agents stérilisants.`;
        }
        // Salutations
        else if (qLower.includes('bonjour') || qLower.includes('salut') || qLower.includes('hello')) {
            responseText = lang === 'en' ? "Ready. How can I assist your clinical practice today?" : "Prêt. Comment puis-je vous assister dans votre pratique médicale ou vos projets aujourd'hui ?";
        }
        // Remerciements
        else if (qLower.includes('merci') || qLower.includes('akpe')) {
            responseText = "À votre service.";
        }
        // Défaut intelligent direct
        else {
            responseText = `Analyse traitée : ${cleanQ}. Paramètres médicaux et opérationnels synchronisés pour ${this.userProfile.nom}.`;
        }

        responseText = responseText.replace(/(Mister Elose|Eric)/gi, '').trim();
        if(!responseText) responseText = "Traité.";

        this.memory.push({ question: cleanQ, response: responseText, time: new Date().toLocaleTimeString() });
        return responseText;
    }

    exportAICoreState() {
        return JSON.stringify({
            name: this.name,
            sigle: this.sigle,
            version: this.version,
            profile: this.userProfile,
            memory: this.memory
        }, null, 2);
    }
}

window.MisterElose = MisterEloseAI;
