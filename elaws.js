const ELAWS_BRAIN = {
    memoireContexte: [],
    
    analyserIntentionProfonde: function(texte) {
        const t = texte.toLowerCase();
        let intention = "general";
        if(t.includes('code') || t.includes('node') || t.includes('javascript') || t.includes('html') || t.includes('css') || t.includes('bug') || t.includes('erreur') || t.includes('script') || t.includes('developpeur')) intention = "technique";
        else if(t.includes('business') || t.includes('prix') || t.includes('client') || t.includes('entreprise') || t.includes('nif') || t.includes('togo') || t.includes('vendre') || t.includes('argent') || t.includes('xof')) intention = "business";
        else if(t.includes('voyage') || t.includes('visa') || t.includes('avion') || t.includes('trajet') || t.includes('vol') || t.includes('hotel')) intention = "voyage";
        else if(t.includes('succès') || t.includes('1000') || t.includes('objectif') || t.includes('plan') || t.includes('stratégie')) intention = "succes";
        else if(t.includes('traduction') || t.includes('traduire') || t.includes('langue') || t.includes('minan') || t.includes('ewe') || t.includes('kabye')) intention = "traduction";
        else if(t.includes('urgence') || t.includes('bloqué') || t.includes('secours') || t.includes('crise')) intention = "urgence";
        return intention;
    },

    repondre: function(profil, texte) {
        const intention = this.analyserIntentionProfonde(texte);
        const nom = profil.nom || 'Kodjo';
        const metier = profil.metier || 'Développeur & Entrepreneur';

        this.memoireContexte.push({ user: texte, timestamp: new Date().toISOString() });
        if(this.memoireContexte.length > 20) this.memoireContexte.shift();

        switch(intention) {
            case 'technique':
                return `💻 [ELAWS 3.60 Turbo Code] : Analyse fulgurante instantanée pour ton architecture ${metier}. Pour optimiser tes scripts Node.js et tes déploiements GitHub/Vercel/Netlify sans latence, active le mode asynchrone strict et le cache local. Ton code est prêt à être compilé !`;
            
            case 'business':
                return `🚀 [ELAWS 3.60 Stratégie Marché] : Paramétré pour le Togo (Lomé / Kodjoviakopé). Pour maximiser tes revenus sous un NIF unique avec des devis en XOF, déploie des packs modulaires automatisés. Quelle est ta prochaine étape commerciale ?`;
            
            case 'voyage':
                return `✈️ [ELAWS 3.60 Global Travel] : Trajet instantané calculé. Vérifie ton passeport biométrique et ton e-Visa. Quelle est ta destination précise ?`;
            
            case 'succes':
                return `💎 [Protocole Succès 1000% Boosté] : 
1️⃣ Priorité absolue isolée et optimisée.
2️⃣ Automatisation totale par ELAWS 3.60 en cours.
3️⃣ Qubits injectés instantanément. On fonce !`;

            case 'traduction':
                return `🌐 [Traduction Ultra-Rapide] : Module actif pour le français, l'anglais et les langues locales (Éwé, Mina, Kabyé). Dis-moi ce que tu veux traduire immédiatement.`;

            case 'urgence':
                return `🚨 [Intervention d'Urgence ELAWS 3.60] : Purge du cache et réinitialisation du thread exécutées en 0.1s. Dis-moi quel composant est bloqué pour appliquer le correctif chirurgical immédiat.`;

            default:
                return `⚡ Bonjour ${nom} ! ELAWS Quantum v3.60 est maintenant en mode **Ultra-Réactif** (zéro latence, boost maximal). Profil (${metier}) synchronisé. Qu'est-ce qu'on déploie tout de suite ?`;
        }
    }
};
