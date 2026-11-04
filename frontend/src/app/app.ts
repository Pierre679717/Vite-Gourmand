import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Footer } from './layout/footer/footer';
import { Header } from './layout/header/header';

@Component({
  imports: [RouterOutlet, Header, Footer],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  /**
   * Avec le routeur, un simple href="#contenu" rechargerait l'accueil :
   * on déplace donc le focus nous-mêmes sur la zone principale.
   */
  protected allerAuContenu(evenement: Event): void {
    evenement.preventDefault();
    document.getElementById('contenu')?.focus();
  }
}
