export type Subject = 
  | 'Droit patrimonial de la famille'
  | 'Procédure civile'
  | 'Droit pénal et procédure pénale'
  | "Voies d'exécution"
  | 'Droit social'
  | 'Droit administratif'
  | 'Méthodologie juridique';

export interface Message {
  role: 'user' | 'model';
  text: string;
}

export type Tab = 'revisions' | 'methodologie';
