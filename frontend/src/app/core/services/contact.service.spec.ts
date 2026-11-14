import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MessageContact } from '../models/contact';
import { ContactService } from './contact.service';

const MESSAGE: MessageContact = {
  titre: 'Mariage le 20 juin',
  description: 'Pouvez-vous nous proposer un menu pour 80 personnes ?',
  email: 'camille@example.com',
};

describe('ContactService', () => {
  let service: ContactService;
  let controleur: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ContactService);
    controleur = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controleur.verify());

  it('envoie titre, description et e-mail par POST /api/contact', () => {
    let recu = '';

    service.envoyer(MESSAGE).subscribe((reponse) => (recu = reponse.message));
    const requete = controleur.expectOne('/api/contact');
    expect(requete.request.method).toBe('POST');
    expect(requete.request.body).toEqual(MESSAGE);
    requete.flush({ message: 'Message envoyé.' }, { status: 201, statusText: 'Created' });

    expect(recu).toBe('Message envoyé.');
  });

  it('transmet le 503 quand le mail n’a pas pu partir', () => {
    let statut = 0;

    service.envoyer(MESSAGE).subscribe({ error: (e: HttpErrorResponse) => (statut = e.status) });
    controleur
      .expectOne('/api/contact')
      .flush(
        { error: 'Votre message n’a pas pu être envoyé.' },
        { status: 503, statusText: 'Service Unavailable' },
      );

    expect(statut).toBe(503);
  });
});
