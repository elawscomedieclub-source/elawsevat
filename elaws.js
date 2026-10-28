
const ELAWS_BRAIN = {
    repondre: function(profil, texte) {
        const t = texte.toLowerCase();
        const ton = profil.iaTon || "standard";
        let prefixe = "";
        if (ton === "pedagogique") prefixe = "💡 [Mode Pédagogique] ";
        if (ton === "vocal_inclusif") prefixe = "🗣️ [Mode Vocal] ";

        if(t.includes('bonjour') || t.includes('salut')) {
            return `${prefixe}Bonjour ${profil.nom} ! Je suis ELAWS, votre assistant universel. Comment puis-je vous aider aujourd'hui ?`;
        }
        if(t.includes('voyage') || t.includes('démarche') || t.includes('passeport') || t.includes('visa')) {
            return `${prefixe}Pour votre voyage, rendez-vous dans l'onglet **Guide Voyage & Démarches** pour lancer votre check-list interactive pas à pas !`;
        }
        if(t.includes('urgence') || t.includes('crise') || t.includes('problème')) {
            return `${prefixe}Je suis là ! Rendez-vous dans l'onglet **Urgences & Solutions** pour obtenir un plan d'action immédiat.`;
        }
        return `${prefixe}J'ai bien reçu votre question : "${texte}". En tant qu'intelligence artificielle ELAWS, je suis entièrement disposé à vous accompagner jusqu'à la réussite totale de ce projet !`;
    }
};
