
const ELAWS_BRAIN = {
    repondre: function(profil, texte) {
        const t = texte.toLowerCase();
        const ton = profil.iaTon || "standard";
        let prefixe = "";
        if (ton === "pedagogique") prefixe = "💡 [Mode Pédagogique] ";
        if (ton === "vocal_inclusif") prefixe = "🗣️ [Mode Vocal] ";

        if(t.includes('bonjour') || t.includes('salut')) {
            return `${prefixe}Bonjour ${profil.nom} ! Je suis ELAWS, prêt à répondre à toutes vos questions.`;
        }
        if(t.includes('voyage') || t.includes('démarche') || t.includes('passeport') || t.includes('visa')) {
            return `${prefixe}Rendez-vous dans l'onglet **Guide Voyage & Démarches** pour lancer votre check-list interactive pas à pas !`;
        }
        if(t.includes('urgence') || t.includes('crise')) {
            return `${prefixe}Rendez-vous dans l'onglet **Urgences & Solutions** pour obtenir un plan d'action immédiat.`;
        }
        return `${prefixe}J'ai bien reçu votre question : "${texte}". ELAWS est entièrement disposé à vous accompagner jusqu'à la réussite de ce projet !`;
    }
};
