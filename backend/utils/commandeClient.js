/* ================================================================
   UTILS/COMMANDECLIENT.JS
   Ce que le client voit de ses commandes (espace utilisateur)
   ================================================================
   Fonctions pures (sans base de données), donc faciles à tester :
   - idValide(texte) : l'id lu dans l'URL (/api/commandes/12) ;
   - peutEtreModifiee(statut) : règle du sujet, le client peut
     modifier ou annuler tant qu'un employé n'a pas « accepté » ;
   - versCommandeClient(ligne, suivi) : la ligne SQL mise en forme,
     champ par champ (liste blanche), avec les actions possibles.

   Les drapeaux peut_modifier / peut_donner_avis servent seulement à
   l'affichage des boutons. Le serveur revérifie toujours la règle
   au moment de modifier, d'annuler ou d'enregistrer un avis.
   ================================================================ */

/** Seul statut où le client peut encore modifier ou annuler */
const STATUT_MODIFIABLE = 'en_attente';

/** Statut à partir duquel le client peut donner son avis */
const STATUT_AVIS = 'terminee';

/**
 * Id d'URL valide : uniquement des chiffres, sans zéro en tête.
 * Renvoie le nombre, ou null (« 12abc », « -1 », « 1e3 » sont refusés).
 */
function idValide(texte) {
    if (typeof texte !== 'string' || !/^[1-9]\d{0,9}$/.test(texte)) return null;
    const id = Number(texte);
    return id <= 2147483647 ? id : null; // plafond d'un INT MySQL
}

function peutEtreModifiee(statut) {
    return statut === STATUT_MODIFIABLE;
}

/** '12:30:00' (TIME MySQL) -> '12:30' (format du formulaire) */
function heureCourte(heure) {
    return typeof heure === 'string' ? heure.slice(0, 5) : heure;
}

/** Ligne de la liste « Mes commandes » -> résumé renvoyé au client */
function versResumeCommande(ligne) {
    return {
        commande_id:      ligne.commande_id,
        numero_commande:  ligne.numero_commande,
        date_commande:    ligne.date_commande,
        statut:           ligne.statut,
        menu_titre:       ligne.menu_titre,
        nombre_personne:  ligne.nombre_personne,
        date_prestation:  ligne.date_prestation,
        heure_livraison:  heureCourte(ligne.heure_livraison),
        ville_prestation: ligne.ville_prestation,
        prix_total:       ligne.prix_total,
        avis_donne:       Boolean(ligne.avis_donne)
    };
}

/**
 * Ligne de la requête de détail -> objet renvoyé au client.
 * `suivi` : historique des statuts, du plus ancien au plus récent.
 */
function versCommandeClient(ligne, suivi = []) {
    const avis = ligne.avis_note == null
        ? null
        : { note: ligne.avis_note, commentaire: ligne.avis_commentaire, statut: ligne.avis_statut };

    return {
        commande_id:        ligne.commande_id,
        numero_commande:    ligne.numero_commande,
        date_commande:      ligne.date_commande,
        statut:             ligne.statut,
        menu: {
            menu_id:             ligne.menu_id,
            titre:               ligne.menu_titre,
            nombre_personne_min: ligne.nombre_personne_min,
            delai_minimum_jours: ligne.delai_minimum_jours
        },
        nombre_personne:    ligne.nombre_personne,
        date_prestation:    ligne.date_prestation,
        heure_livraison:    heureCourte(ligne.heure_livraison),
        adresse_prestation: ligne.adresse_prestation,
        ville_prestation:   ligne.ville_prestation,
        pret_materiel:      Boolean(ligne.pret_materiel),
        materiel_restitue:  Boolean(ligne.materiel_restitue),
        contact_nom:        ligne.contact_nom,
        contact_prenom:     ligne.contact_prenom,
        contact_email:      ligne.contact_email,
        contact_telephone:  ligne.contact_telephone,
        distance_km:        ligne.distance_km,
        prix_par_personne:  ligne.prix_par_personne,
        reduction:          ligne.reduction,
        prix_menu:          ligne.prix_menu,
        prix_livraison:     ligne.prix_livraison,
        prix_total:         ligne.prix_total,
        avis,
        suivi: suivi.map((etape) => ({ statut: etape.statut, date: etape.date_changement })),
        peut_modifier:      peutEtreModifiee(ligne.statut),
        peut_donner_avis:   ligne.statut === STATUT_AVIS && avis === null
    };
}

module.exports = {
    STATUT_MODIFIABLE,
    STATUT_AVIS,
    idValide,
    peutEtreModifiee,
    versResumeCommande,
    versCommandeClient
};
