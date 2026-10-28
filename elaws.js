
const ELAWS_BRAIN = {
    repondre: function(profil, texte) {
        const t = texte.toLowerCase();
        const ton = profil.iaTon || "standard";
        let prefixe = "";
        if (ton === "pedagogique") prefixe = "💡 [Mode Pédagogique] ";
        if (ton === "vocal_inclusif") prefixe = "🗣️ [Mode Vocal] ";

        if(t.includes('bonjour') || t.includes('salut')) {
            return `${prefixe}Bonjour ${profil.nom} ! ELAWS Quantum est opérationnel. Chaque effort investi avec EVAT est garanti pour aboutir à un résultat de 1000%.`;
        }
        if(t.includes('succès') || t.includes('1000') || t.includes('objectif')) {
            return `${prefixe}Rendez-vous dans le module **Garantie Succès 1000%** pour structurer votre projet et maximiser votre rendement !`;
        }
        if(t.includes('voyage') || t.includes('carbone') || t.includes('passeport')) {
            return `${prefixe}Consultez l'onglet **Guide Voyage & Carbone** pour planifier vos déplacements en toute sérénité.`;
        }
        if(t.includes('urgence') || t.includes('crise')) {
            return `${prefixe}Rendez-vous dans l'onglet **Urgences & Solutions** pour une résolution immédiate et sans faille.`;
        }
        return `${prefixe}Message bien reçu : "${texte}". EVAT v3.23 Quantum est à votre service pour vous mener au sommet !`;
    }
};
