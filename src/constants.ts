import { Subject } from './types';

export const SUBJECTS: Subject[] = [
  'Droit patrimonial de la famille',
  'Procédure civile',
  'Droit pénal et procédure pénale',
  'Voies d\'exécution',
  'Droit social',
  'Droit administratif'
];

export const METHODOLOGIES = [
  {
    title: 'Cas Pratique',
    steps: [
      '❶ Résumé des faits : Présenter brièvement les faits pertinents.',
      '❷ Problème de droit : Formuler la question juridique sous forme interrogative.',
      '❸ Règle de droit : Citer les articles de loi et la jurisprudence applicable.',
      '❹ Application aux faits : Analyser les faits à la lumière de la règle.',
      '❺ Conclusion : Donner la solution finale claire.'
    ]
  },
  {
    title: 'Commentaire d\'Arrêt',
    steps: [
      '❶ Fiche d\'arrêt : Faits, procédure, prétentions, problème juridique, solution.',
      '❷ Introduction : Contexte, annonce du plan.',
      '❸ Plan binaire : I. Sens et valeur, II. Portée.',
      '❹ Analyse critique : Discuter la solution de la Cour.'
    ]
  },
  {
    title: 'Dissertation Juridique',
    steps: [
      '❶ Introduction : Accroche, définition, intérêt, délimitation, problématique, plan.',
      '❷ Corps du devoir : Deux parties (I et II) avec deux sous-parties (A et B).',
      '❸ Transitions : Assurer la fluidité entre les idées.',
      '❹ Conclusion : Synthèse et ouverture (facultatif).'
    ]
  }
];
