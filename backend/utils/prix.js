/* ================================================================
   UTILS/PRIX.JS
   Calcul du prix d'une commande (règles métier du sujet)
   ================================================================
   - Prix du menu      = prix par personne x nombre de personnes
   - Réduction de 10 % si nombre de personnes >= minimum du menu + 5
   - Livraison gratuite à Bordeaux, sinon 5 EUR + 0,59 EUR par km
   - Total             = prix du menu (réduction déduite) + livraison

   Tous les calculs se font en CENTIMES (nombres entiers) :
   en JavaScript, 0.1 + 0.2 donne 0.30000000000000004. Avec des
   entiers, pas d'erreur d'arrondi, et le total respecte toujours
   la contrainte CHECK (prix_total = prix_menu + prix_livraison).
   ================================================================ */

const TAUX_REDUCTION        = 0.10;
const PERSONNES_EN_PLUS     = 5;
const FORFAIT_LIVRAISON_CTS = 500;  // 5,00 EUR
const PRIX_KM_CTS           = 59;   // 0,59 EUR par km
const VILLE_SANS_FRAIS      = 'bordeaux';

/**
 * "Bordeaux", " bordeaux " ou "BORDEAUX" -> true
 */
function estBordeaux(ville) {
    return String(ville || '').trim().toLowerCase() === VILLE_SANS_FRAIS;
}

/**
 * Calcule le détail du prix. Renvoie des montants en euros (nombres à 2 décimales).
 * @param {number} prixParPersonne  prix du menu par personne (en euros)
 * @param {number} nombrePersonneMin minimum de personnes du menu
 * @param {number} nombrePersonne    nombre de personnes commandé
 * @param {string} ville             ville de la prestation
 * @param {number} distanceKm        distance depuis Bordeaux (ignorée à Bordeaux)
 */
function calculerPrixCommande({ prixParPersonne, nombrePersonneMin, nombrePersonne, ville, distanceKm }) {
    const prixParPersonneCts = Math.round(Number(prixParPersonne) * 100);
    const brutCts = prixParPersonneCts * nombrePersonne;

    const reductionCts = nombrePersonne >= nombrePersonneMin + PERSONNES_EN_PLUS
        ? Math.round(brutCts * TAUX_REDUCTION)
        : 0;

    const distance = estBordeaux(ville) ? 0 : Number(distanceKm);
    const livraisonCts = estBordeaux(ville)
        ? 0
        : FORFAIT_LIVRAISON_CTS + Math.round(PRIX_KM_CTS * distance);

    const prixMenuCts = brutCts - reductionCts;

    return {
        distance_km:       distance,
        prix_par_personne: prixParPersonneCts / 100,
        reduction:         reductionCts / 100,
        prix_menu:         prixMenuCts / 100,
        prix_livraison:    livraisonCts / 100,
        prix_total:        (prixMenuCts + livraisonCts) / 100
    };
}

module.exports = { calculerPrixCommande, estBordeaux };
