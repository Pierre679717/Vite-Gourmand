/** Corps de POST /api/contact : les trois champs imposés par le sujet */
export interface MessageContact {
  titre: string;
  description: string;
  email: string;
}
