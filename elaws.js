
const ELAWS_BRAIN = {
    repondre: function(profil, texte) {
        const t = texte.toLowerCase();
        const ton = profil.iaTon || "standard";
        let prefixe = "";
        if (ton === "pedagogique") prefixe = "💡 ";
        if (ton === "vocal_inclusif") prefixe = "🗣️ ";

        if(t.includes('bonjour') || t.includes('salut') || t.includes('coucou')) {
            return `${prefixe}Bonjour ${profil.nom} ! Comment puis-je t'aider dans tes projets aujourd'hui ?`;
        }
        if(t.includes('succès') || t.includes('1000') || t.includes('objectif')) {
            return `${prefixe}Pour maximiser tes résultats, je te conseille d'ouvrir le module **Garantie Succès 1000%** afin que l'on structure ton plan d'action ensemble.`;
        }
        if(t.includes('voyage') || t.includes('carbone') || t.includes('trajet') || t.includes('avion')) {
            return `${prefixe}Je peux calculer ton empreinte carbone et vérifier ta check-list de voyage. Renseigne simplement ta destination dans le module dédié !`;
        }
        if(t.includes('urgence') || t.includes('problème') || t.includes('bloqué')) {
            return `${prefixe}Ne t'inquiète pas, restons concentrés. Dis-moi précisément ce qui bloque pour que je te génère une solution immédiate.`;
        }
        if(t.includes('merci') || t.includes('super') || t.includes('parfait')) {
            return `${prefixe}Avec plaisir ! Je suis là pour ça. On continue ?`;
        }

        return `${prefixe}C'est bien pris en compte. Je m'en occupe et j'intègre cette instruction dans l'écosystème EVAT pour optimiser ton flux de travail de manière fluide.`;
    }
};
