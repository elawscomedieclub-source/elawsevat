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
        if(this.memoireContexte.length > 15) this.memoireContexte.shift();

        switch(intention) {
            case 'technique':
                return `💻 [Expertise Code & Système - ELAWS 3.50] : Analyse de ton architecture ${metier}. Pour optimiser ton serveur Node.js sur mobile ou structurer tes fichiers PWA sans friction, vérifie les gestionnaires de routes asynchrones et l'injection du Service Worker en cache. Veux-tu que je génère un snippet de code robuste ou un correctif spécifique ?`;
            
            case 'business':
                return `🚀 [Stratégie Business & Marché - ELAWS 3.50] : Enregistré pour ton activité au Togo (Lomé / Kodjoviakopé). Pour un positionnement optimal sous un NIF unique avec des prestations tarifées en XOF, structure tes offres en forfaits modulaires (Starter, Pro, Quantum). Quelle est ta cible principale aujourd'hui ?`;
            
            case 'voyage':
                return `✈️ [Assistant Global Voyage & Visa - ELAWS 3.50] : Calcul d'itinéraire et empreinte carbone activés. Pense à vérifier la validité de ton passeport biométrique, ton e-Visa et ta couverture sanitaire internationale. Quelle est ta destination exacte ?`;
            
            case 'succes':
                return `💎 [Protocole Garantie Succès 1000%] : Objectif pris en charge avec rigueur quantique. 
1️⃣ Étape 1 : Isolation de la priorité absolue.
2️⃣ Étape 2 : Automatisation des micro-tâches via ELAWS.
3️⃣ Étape 3 : Exécution et validation immédiate des Qubits. 
On fonce !`;

            case 'traduction':
                return `🌐 [Traduction Native & Vocale] : Module linguistique prêt. ELAWS prend en charge les langues locales (Éwé, Mina, Kabyé, etc.) ainsi que le français et l'anglais pour une communication universelle en temps réel. Quelle phrase ou quel document dois-je traduire ?`;

            case 'urgence':
                return `🚨 [Cellule de Crise ELAWS] : Situation critique détectée. 
• Action immédiate : Redémarrage propre du thread d'exécution, purge du cache local obsolète (` + '`' + `localStorage` + '`' + `) et bascule sur le protocole de secours hors-ligne. 
Dis-moi quel composant pose problème pour appliquer la correction chirurgicale.`;

            default:
                return `🤖 Bonjour ${nom} ! En tant qu'intelligence artificielle supérieure ELAWS Quantum v3.59, j'ai synchronisé ton profil (${metier}). Mes capacités d'analyse, de code, de stratégie et de traduction sont à 100% de leur potentiel. Qu'est-ce qu'on déploie maintenant ?`;
        }
    }
};
