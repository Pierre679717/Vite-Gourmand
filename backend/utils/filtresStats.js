/* ================================================================
   UTILS/FILTRESSTATS.JS
   Statistiques de l'administrateur : filtres et requête d'agrégation
   ================================================================
   GET /api/admin/statistiques?menu_id=2&debut=2026-10-01&fin=2026-10-31

   - validerFiltresStats(query) : contrôle les 3 paramètres (tous
     facultatifs ; une valeur vide = pas de filtre).
   - construirePipeline(filtres) : fabrique la requête d'agrégation
     MongoDB sur la collection commandes_stats. Fonction pure : les tests
     vérifient la requête produite sans base MongoDB.
   - totaliser(lignes) : totaux de toutes les lignes (bas du tableau).

   Les valeurs des filtres sont placées dans des objets ($eq, $gte...),
   jamais assemblées dans du texte : pas d'injection possible, et une
   valeur du type { "$ne": null } est refusée par la validation.
   ================================================================ */

const { idValide } = require('./commandeClient');

const REGEX_DATE = /^\d{4}-\d{2}-\d{2}$/;
const FUSEAU = 'Europe/Paris';

/** 'AAAA-MM-JJ' qui existe vraiment au calendrier (pas de 31 novembre) */
function dateValide(texte) {
    if (!REGEX_DATE.test(texte)) return false;
    const [annee, mois, jour] = texte.split('-').map(Number);
    const date = new Date(Date.UTC(annee, mois - 1, jour));
    return date.getUTCFullYear() === annee && date.getUTCMonth() === mois - 1 && date.getUTCDate() === jour;
}

/**
 * @returns {{ filtres: { menuId: number|null, debut: string|null, fin: string|null }, erreur: string|null }}
 */
function validerFiltresStats(query) {
    query = query || {};
    const filtres = { menuId: null, debut: null, fin: null };
    const vide = (v) => v === undefined || v === '';

    // Un paramètre répété (?menu_id=1&menu_id=2) arrive en tableau : refusé
    for (const nom of ['menu_id', 'debut', 'fin']) {
        if (!vide(query[nom]) && typeof query[nom] !== 'string') {
            return { filtres, erreur: `Le filtre ${nom} est invalide.` };
        }
    }

    if (!vide(query.menu_id)) {
        filtres.menuId = idValide(query.menu_id);
        if (filtres.menuId === null) return { filtres, erreur: 'Le menu choisi est invalide.' };
    }
    if (!vide(query.debut)) {
        if (!dateValide(query.debut)) return { filtres, erreur: 'La date de début est invalide (AAAA-MM-JJ).' };
        filtres.debut = query.debut;
    }
    if (!vide(query.fin)) {
        if (!dateValide(query.fin)) return { filtres, erreur: 'La date de fin est invalide (AAAA-MM-JJ).' };
        filtres.fin = query.fin;
    }
    // Comparer deux textes AAAA-MM-JJ revient à comparer les dates
    if (filtres.debut && filtres.fin && filtres.debut > filtres.fin) {
        return { filtres, erreur: 'La date de début doit précéder la date de fin.' };
    }
    return { filtres, erreur: null };
}

/**
 * Requête d'agrégation : une ligne par menu avec
 * - nombre_commandes : commandes NON annulées (comparées dans le graphique) ;
 * - nombre_annulees  : affichées à part, pour information ;
 * - chiffre_affaires : somme des prix_total des commandes NON annulées.
 * Le filtre de période porte sur la date de la commande, lue à l'heure
 * de Bordeaux (une commande passée le 31 à 23 h 30 compte pour le 31).
 */
function construirePipeline({ menuId = null, debut = null, fin = null } = {}) {
    const pipeline = [];

    // 1. Filtre par menu en premier : il utilise l'index sur menu_id
    if (menuId !== null) {
        pipeline.push({ $match: { menu_id: { $eq: menuId } } });
    }

    // 2. Filtre par période sur le jour de la commande (heure de Paris)
    if (debut || fin) {
        const periode = {};
        if (debut) periode.$gte = debut;
        if (fin) periode.$lte = fin;
        pipeline.push(
            { $addFields: { jour: { $dateToString: { format: '%Y-%m-%d', date: '$date_commande', timezone: FUSEAU } } } },
            { $match: { jour: periode } }
        );
    }

    const estAnnulee = { $eq: ['$statut', 'annulee'] };
    pipeline.push(
        // 3. Tri par date : $last donne ensuite le titre le plus récent du menu
        { $sort: { date_commande: 1 } },
        // 4. Regroupement par menu
        {
            $group: {
                _id: '$menu_id',
                menu_titre:       { $last: '$menu_titre' },
                nombre_commandes: { $sum: { $cond: [estAnnulee, 0, 1] } },
                nombre_annulees:  { $sum: { $cond: [estAnnulee, 1, 0] } },
                chiffre_affaires: { $sum: { $cond: [estAnnulee, 0, '$prix_total'] } }
            }
        },
        // 5. Mise en forme : arrondi au centime (les sommes de décimaux en ont besoin)
        {
            $project: {
                _id: 0,
                menu_id: '$_id',
                menu_titre: 1,
                nombre_commandes: 1,
                nombre_annulees: 1,
                chiffre_affaires: { $round: ['$chiffre_affaires', 2] }
            }
        },
        { $sort: { chiffre_affaires: -1, menu_titre: 1 } }
    );
    return pipeline;
}

/** Totaux de toutes les lignes, arrondis au centime */
function totaliser(lignes) {
    const totaux = lignes.reduce(
        (t, l) => ({
            nombre_commandes: t.nombre_commandes + l.nombre_commandes,
            nombre_annulees:  t.nombre_annulees + l.nombre_annulees,
            chiffre_affaires: t.chiffre_affaires + l.chiffre_affaires
        }),
        { nombre_commandes: 0, nombre_annulees: 0, chiffre_affaires: 0 }
    );
    totaux.chiffre_affaires = Math.round(totaux.chiffre_affaires * 100) / 100;
    return totaux;
}

module.exports = { validerFiltresStats, construirePipeline, totaliser, dateValide };
