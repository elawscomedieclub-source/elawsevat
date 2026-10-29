const ELAWS_BRAIN = {
    repondre: function(profil, texte) {
        const t = texte.toLowerCase();
        const ton = profil.iaTon || "standard";
        let prefixe = "";
        
        if (ton === "pedagogique") prefixe = "💡 [Mode Tuteur / Pédagogique] ";
        else if (ton === "business") prefixe = "🚀 [Mode Stratège Business] ";
        else if (ton === "technique") prefixe = "💻 [Mode Expert Technique/Code] ";
        else prefixe = "🤖 [Mode Standard Quantum] ";

        if(t.includes('bonjour') || t.includes('salut') || t.includes('coucou')) {
            return `${prefixe}Bonjour ${profil.nom || 'ami(e)'} ! ELAWS 2.0 est pleinement actif et synchronisé. Comment optimisons-nous ton projet aujourd'hui ?`;
        }
        if(t.includes('succès') || t.includes('1000') || t.includes('objectif')) {
            return `${prefixe}Pour atteindre un rendement de 1000%, active la Garantie Succès 1000% dans le menu pour structurer tes étapes clés !`;
        }
        if(t.includes('voyage') || t.includes('carbone') || t.includes('trajet') || t.includes('avion')) {
            return `${prefixe}Analysons l'impact et les formalités de ton déplacement. Renseigne ta destination dans le module Voyage & Carbone.`;
        }
        if(t.includes('urgence') || t.includes('problème') || t.includes('bloqué')) {
            return `${prefixe}Situation critique détectée. Accède au module Urgences & Solutions pour isoler le problème et appliquer le protocole correctif.`;
        }
        if(t.includes('merci') || t.includes('super') || t.includes('parfait')) {
            return `${prefixe}Avec plaisir ! L'écosystème EVAT reste synchronisé pour garantir ton succès absolu.`;
        }

        return `${prefixe}Instruction reçue et intégrée dans le flux quantique de l'écosystème EVAT. Je veille sur ton espace de travail pour assurer une exécution parfaite.`;
    }
};
