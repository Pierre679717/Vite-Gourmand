/* ================================================================
   UTILS/STATUTSCOMMANDE.JS
   Parcours d'une commande et règles de changement de statut
   ================================================================
   Fonctions pures (sans base de données), donc faciles à tester.
   Le parcours du sujet (page 8) :

     en_attente -> accepte -> en_preparation -> en_cours_livraison
       -> livre -> [attente_retour_materiel] -> terminee

   Règles appliquées :
   - on avance d'UNE étape à la fois : chaque statut est inscrit
     dans suivi_commande, la frise du client n'a pas de trou ;
   - pas de retour en arrière ;
   - si du matériel a été prêté (pret_materiel = 1), « livre » mène
     obligatoirement à « attente_retour_materiel » (mail des 600 €),
     puis « terminee » quand le matériel est restitué ;
   - sans prêt de matériel, « livre » mène directement à « terminee » ;
   - annulation possible tant que la commande n'est pas partie en
     livraison (en_attente, accepte, en_preparation) ;
   - « terminee » et « annulee » sont définitifs.
   ================================================================ */

const LIBELLES = {
    en_attente:              'En attente',
    accepte:                 'Acceptée',
    en_preparation:          'En préparation',
    en_cours_livraison:      'En cours de livraison',
    livre:                   'Livrée',
    attente_retour_materiel: 'En attente du retour de matériel',
    terminee:                'Terminée',
    annulee:                 'Annulée'
};

/** Tous les statuts connus (mêmes valeurs que l'ENUM MySQL) */
const STATUTS = Object.keys(LIBELLES);

/** Statuts depuis lesquels l'employé peut encore annuler */
const STATUTS_ANNULABLES = ['en_attente', 'accepte', 'en_preparation'];

/** Statuts définitifs : plus aucun changement possible */
const STATUTS_CLOTURES = ['terminee', 'annulee'];

/**
 * Étape suivante du parcours (hors annulation), ou null si aucune.
 * Seul « livre » dépend du prêt de matériel.
 */
function etapeSuivante(statut, pretMateriel) {
    switch (statut) {
        case 'en_attente':              return 'accepte';
        case 'accepte':                 return 'en_preparation';
        case 'en_preparation':          return 'en_cours_livraison';
        case 'en_cours_livraison':      return 'livre';
        case 'livre':                   return pretMateriel ? 'attente_retour_materiel' : 'terminee';
        case 'attente_retour_materiel': return 'terminee';
        default:                        return null; // terminee, annulee ou inconnu
    }
}

/**
 * Statuts que l'employé peut appliquer maintenant (boutons affichés).
 * Ex. statutsSuivants('accepte', false) -> ['en_preparation', 'annulee']
 */
function statutsSuivants(statut, pretMateriel) {
    const suivants = [];
    const suivant = etapeSuivante(statut, pretMateriel);
    if (suivant) suivants.push(suivant);
    if (STATUTS_ANNULABLES.includes(statut)) suivants.push('annulee');
    return suivants;
}

/**
 * Vérifie un changement de statut demandé par un employé.
 * Renvoie null s'il est permis, sinon le message d'erreur (409).
 */
function verifierTransition(ancien, nouveau, pretMateriel) {
    if (STATUTS_CLOTURES.includes(ancien)) {
        return 'Cette commande est clôturée : son statut ne peut plus changer.';
    }
    if (statutsSuivants(ancien, pretMateriel).includes(nouveau)) {
        return null;
    }
    if (nouveau === 'annulee') {
        return 'La commande est déjà partie en livraison : elle ne peut plus être annulée.';
    }
    if (ancien === 'livre' && nouveau === 'terminee' && pretMateriel) {
        return 'Du matériel a été prêté : passez d\'abord par « En attente du retour de matériel ».';
    }
    const attendu = etapeSuivante(ancien, pretMateriel);
    return `Passage de « ${LIBELLES[ancien]} » à « ${LIBELLES[nouveau] || nouveau} » impossible : `
         + `l'étape suivante est « ${LIBELLES[attendu]} ».`;
}

module.exports = {
    LIBELLES,
    STATUTS,
    STATUTS_ANNULABLES,
    etapeSuivante,
    statutsSuivants,
    verifierTransition
};
