import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MessageContact } from '../models/contact';

/** Formulaire de contact (page publique, pas besoin d'être connecté) */
@Injectable({ providedIn: 'root' })
export class ContactService {
  private readonly http = inject(HttpClient);

  /** Le serveur envoie le message par mail à l'entreprise ; 503 si l'envoi échoue */
  envoyer(message: MessageContact): Observable<{ message: string }> {
    return this.http.post<{ message: string }>('/api/contact', message);
  }
}
