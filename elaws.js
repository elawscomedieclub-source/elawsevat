const ELAWS_BRAIN = {
    repondre: function(profil, texte) {
        const t = texte.toLowerCase();

        if(t.includes('bonjour') || t.includes('salut') || t.includes('coucou')) {
            return `Bonjour ${profil.nom || 'ami(e)'} ! Qu'est-ce qu'on fait maintenant ?`;
        }
        if(t.includes('succès') || t.includes('1000') || t.includes('objectif')) {
            return `Pour atteindre cet objectif, active la Garantie Succès 1000% afin de structurer tes étapes clés immédiatement.`;
        }
        if(t.includes('voyage') || t.includes('carbone') || t.includes('trajet') || t.includes('avion')) {
            return `Renseigne ta destination dans le module Voyage pour obtenir instantanément le calcul carbone, le prix estimé et la checklist des formalités.`;
        }
        if(t.includes('urgence') || t.includes('problème') || t.includes('bloqué')) {
            return `Explique-moi précisément le blocage technique pour que l'on isole la solution et applique le protocole correctif sans perdre une seconde.`;
        }
        if(t.includes('merci') || t.includes('super') || t.includes('parfait')) {
            return `Avec plaisir ! On passe à la suite ?`;
        }

        return `C'est noté. J'analyse ta demande et je m'en charge tout de suite.`;
    }
};
