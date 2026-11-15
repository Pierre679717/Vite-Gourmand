/* ================================================================
   UTILS/COMMANDEEMPLOYE.JS
   Ce que l'employé voit des commandes (espace employé)
   ================================================================
   Fonctions pures (sans base de données), donc faciles à tester :
   - validerFiltresCommandes(query) : lit ?statut=…&client=… ;
   - clauseFiltres(filtres) : construit le WHERE avec des « ? »
     (requête paramétrée : la saisie n'est jamais collée dans le SQL) ;
   - versResumeEmploye / versCommandeEmploye : lignes SQL mises en
     forme champ par champ (liste blanche), avec les statuts suivants
     possibles pour afficher les bons boutons.

   Le sujet (page 8) : « Un filtre sur les commandes doit être disponible
   afin de vite retrouver les commandes à effectuer (par statut) ou
   d'un client en particulier. »
   ================================================================ */

const { STATUTS, statutsSuivants } = require('./statutsCommande');
const { versCommandeClient } = require('./commandeClient');

const CLIENT_MAX = 100;
const MOTS_MAX = 5;

/** Colonnes où l'on cherche le client : son compte, le contact de la commande, le numéro */
const COLONNES_CLIENT = [
    'u.nom', 'u.prenom', 'u.email',
    'c.contact_nom', 'c.contact_prenom', 'c.contact_email',
    'c.numero_commande'
];

/**
 * Lit les filtres de GET /api/employe/commandes.
 * Paramètre vide = absent. Un paramètre répété (?statut=a&statut=b)
 * arrive comme un tableau : il est refusé.
 * Renvoie { filtres: { statut?, mots? }, erreurs }.
 */
function validerFiltresCommandes(query = {}) {
    query = query || {};
    const filtres = {};
    const erreurs = [];

    if (query.statut !== undefined && query.statut !== '') {
        if (typeof query.statut === 'string' && STATUTS.includes(query.statut)) {
            filtres.statut = query.statut;
        } else {
            erreurs.push('Statut de filtre inconnu.');
        }
    }

    if (query.client !== undefined) {
        if (typeof query.client !== 'string' || query.client.length > CLIENT_MAX) {
            erreurs.push(`La recherche client fait au plus ${CLIENT_MAX} caractères.`);
        } else {
            // « camille martin » -> ['camille', 'martin'] : chaque mot doit se retrouver quelque part
            const mots = query.client.trim().split(/\s+/).filter(Boolean).slice(0, MOTS_MAX);
            if (mots.length > 0) filtres.mots = mots;
        }
    }

    return { filtres, erreurs };
}

/** Les caractères spéciaux de LIKE (%, _ et \) sont cherchés tels quels */
function echapperLike(texte) {
    return texte.replace(/[\\%_]/g, (c) => '\\' + c);
}

/**
 * WHERE de la liste. Ex. { statut: 'livre', mots: ['martin'] } ->
 *   where : "WHERE c.statut = ? AND (u.nom LIKE ? OR u.prenom LIKE ? OR …)"
 *   valeurs : ['livre', '%martin%', '%martin%', …]
 */
function clauseFiltres(filtres = {}) {
    const conditions = [];
    const valeurs = [];

    if (filtres.statut) {
        conditions.push('c.statut = ?');
        valeurs.push(filtres.statut);
    }
    for (const mot of filtres.mots || []) {
        conditions.push('(' + COLONNES_CLIENT.map((col) => `${col} LIKE ?`).join(' OR ') + ')');
        valeurs.push(...COLONNES_CLIENT.map(() => `%${echapperLike(mot)}%`));
    }

    return {
        where: conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '',
        valeurs
    };
}

/** '12:30:00' -> '12:30' */
function heureCourte(heure) {
    return typeof heure === 'string' ? heure.slice(0, 5) : heure;
}

/** Ligne de la liste -> résumé (une ligne du tableau de l'employé) */
function versResumeEmploye(ligne) {
    const pret = Boolean(ligne.pret_materiel);
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
        pret_materiel:    pret,
        client: {
            nom:    ligne.client_nom,
            prenom: ligne.client_prenom,
            email:  ligne.client_email
        },
        statuts_suivants: statutsSuivants(ligne.statut, pret)
    };
}

/**
 * Détail pour l'employé : tout ce que voit le client, plus le compte
 * du client (pour le contacter avant une annulation), le mode de
 * contact et le motif d'une annulation, et les statuts suivants.
 */
function versCommandeEmploye(ligne, suivi = []) {
    // Les drapeaux du client (modifier, donner un avis) n'ont pas de sens ici
    const { peut_modifier, peut_donner_avis, ...commande } = versCommandeClient(ligne, suivi);
    return {
        ...commande,
        client: {
            utilisateur_id: ligne.utilisateur_id,
            nom:            ligne.client_nom,
            prenom:         ligne.client_prenom,
            email:          ligne.client_email,
            telephone:      ligne.client_telephone
        },
        mode_contact:     ligne.mode_contact,
        motif:            ligne.motif,
        statuts_suivants: statutsSuivants(ligne.statut, Boolean(ligne.pret_materiel))
    };
}

module.exports = {
    COLONNES_CLIENT,
    validerFiltresCommandes,
    echapperLike,
    clauseFiltres,
    versResumeEmploye,
    versCommandeEmploye
};
