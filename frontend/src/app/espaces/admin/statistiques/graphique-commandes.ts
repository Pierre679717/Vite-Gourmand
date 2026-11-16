import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  LinearScale,
  Plugin,
  Tooltip,
} from 'chart.js';
import { StatMenu } from '../../../core/models/admin';
import { couperLibelle, descriptionGraphique, donneesGraphique } from '../admin-logique';

// Seules les pièces utilisées sont enregistrées : le reste de Chart.js
// n'est pas inclus dans le fichier JavaScript de la page (tree shaking).
Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

/** Couleurs du thème (src/styles/_variables.scss) */
const VERT = '#1f482e';
const TEXTE = '#1f1d1a';
const TEXTE_DOUX = '#5c5750';
const BORDURE = '#e6dfd4';
const POLICE = "'DM Sans Variable', system-ui, sans-serif";

/** Hauteur réservée à chaque menu (barre de 24 px + espace) */
const HAUTEUR_PAR_MENU = 56;

/**
 * Petite extension : écrit le nombre au bout de chaque barre, pour lire la
 * valeur sans survoler la barre (au clavier, il n'y a pas de survol).
 */
const valeurAuBout: Plugin<'bar'> = {
  id: 'valeurAuBout',
  afterDatasetsDraw(graphique) {
    const { ctx, scales } = graphique;
    const valeurs = graphique.data.datasets[0].data as number[];
    ctx.save();
    ctx.fillStyle = TEXTE;
    ctx.font = `600 13px ${POLICE}`;
    ctx.textBaseline = 'middle';
    // Position FINALE de chaque barre (et non sa position pendant l'animation)
    valeurs.forEach((valeur, i) =>
      ctx.fillText(
        String(valeur),
        scales['x'].getPixelForValue(valeur) + 8,
        scales['y'].getPixelForValue(i),
      ),
    );
    ctx.restore();
  },
};

/**
 * Graphique en barres horizontales : nombre de commandes par menu.
 * Barres horizontales : les titres de menus, parfois longs, restent
 * lisibles même à 390 px de large.
 *
 * Un <canvas> est une image : pour les lecteurs d'écran, il porte
 * role="img" et une description complète (aria-label), et les mêmes
 * chiffres sont dans le tableau de la page.
 */
@Component({
  selector: 'app-graphique-commandes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="graphique" [style.height.px]="hauteur()">
      <canvas #canvas role="img" [attr.aria-label]="description()"></canvas>
    </div>
  `,
  styles: `
    .graphique {
      position: relative; // exigé par Chart.js pour s'adapter à la largeur
      width: 100%;
    }
  `,
})
export class GraphiqueCommandes {
  readonly menus = input.required<StatMenu[]>();

  protected readonly description = computed(() => descriptionGraphique(this.menus()));
  protected readonly hauteur = computed(() => 40 + this.menus().length * HAUTEUR_PAR_MENU);

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private graphique: Chart<'bar'> | null = null;

  constructor() {
    // Après chaque affichage où les données ont changé : on crée le
    // graphique la première fois, puis on le met seulement à jour.
    afterRenderEffect(() => {
      const { libelles, valeurs } = donneesGraphique(this.menus());
      // Titres longs sur plusieurs lignes : rien n'est coupé à 390 px
      const lignes = libelles.map((l) => couperLibelle(l, 18));
      if (this.graphique) {
        this.graphique.data.labels = lignes;
        this.graphique.data.datasets[0].data = valeurs;
        this.graphique.update();
      } else {
        this.graphique = this.creer(lignes, valeurs);
      }
    });
    inject(DestroyRef).onDestroy(() => this.graphique?.destroy());
  }

  private creer(libelles: string[][], valeurs: number[]): Chart<'bar'> | null {
    const contexte = this.canvas().nativeElement.getContext('2d');
    if (!contexte) return null; // navigateur sans canvas (ou tests) : le tableau reste
    const mouvementReduit = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    return new Chart(contexte, {
      type: 'bar',
      data: {
        labels: libelles,
        datasets: [
          {
            label: 'Commandes',
            data: valeurs,
            backgroundColor: VERT,
            maxBarThickness: 24,
            borderRadius: 4,
            borderSkipped: 'start', // coins arrondis au bout, droits contre l'axe
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: mouvementReduit ? false : { duration: 400 },
        layout: { padding: { right: 32 } }, // place pour le nombre au bout
        // Pas d'animation au redimensionnement (rotation du téléphone, fenêtre)
        transitions: { resize: { animation: { duration: 0 } } },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { precision: 0, color: TEXTE_DOUX, font: { family: POLICE } },
            grid: { color: BORDURE },
            border: { display: false },
            title: {
              display: true,
              text: 'Nombre de commandes (hors annulées)',
              color: TEXTE_DOUX,
              font: { family: POLICE },
            },
          },
          y: {
            ticks: { color: TEXTE, font: { family: POLICE, size: 13 } },
            grid: { display: false },
          },
        },
        plugins: {
          legend: { display: false }, // une seule série : le titre de la section la nomme
          tooltip: {
            callbacks: {
              label: (c) => {
                const n = c.parsed.x ?? 0;
                return `${n} commande${n > 1 ? 's' : ''}`;
              },
            },
          },
        },
      },
      plugins: [valeurAuBout],
    });
  }
}
