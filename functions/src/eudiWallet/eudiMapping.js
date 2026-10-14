/**
 * Mapping entre les valeurs `infoRequired` des clients B2B
 * et les element identifiers du credential France Identité (eu.europa.ec.av.1).
 *
 * France Identité ne transmet JAMAIS de données nominatives — uniquement des booléens d'âge.
 * Si infoRequired contient autre chose (name, date_of_birth, age…), le parcours FI n'est
 * pas proposé et le client doit passer par le scan OCR.
 *
 * Source de vérité unique — importé par initVP.js, getVPRequestObject.js et WelcomeScreen.jsx.
 */

// Valeurs infoRequired qui peuvent être satisfaites par France Identité
// + leur element identifier dans eu.europa.ec.av.1
const INFOREQ_TO_FI_ELEMENT = {
  majority:    'age_over_18', // alias "majorité" → booléen 18+
  age_over_18: 'age_over_18', // direct
  age_over_21: 'age_over_21', // direct
  // 'age' intentionnellement absent : FI ne transmet pas l'âge exact, seulement le booléen.
  // Si un client demande 'age', il doit passer par le parcours OCR.
}

/**
 * Retourne l'element identifier FI à demander pour une liste infoRequired donnée,
 * ou null si le parcours France Identité ne peut pas satisfaire la demande.
 *
 * Règle : TOUS les champs infoRequired doivent être satisfaisables par FI.
 * En cas de plusieurs seuils, on prend le plus restrictif (age_over_21 > age_over_18).
 *
 * @param {string[]} infoRequired
 * @returns {'age_over_18' | 'age_over_21' | null}
 */
function resolveEudiThreshold(infoRequired = []) {
  if (!infoRequired.length) return null
  if (!infoRequired.every(key => key in INFOREQ_TO_FI_ELEMENT)) return null

  const fiElements = infoRequired.map(key => INFOREQ_TO_FI_ELEMENT[key])
  if (fiElements.includes('age_over_21')) return 'age_over_21'
  return 'age_over_18'
}

/**
 * Retourne true si le parcours France Identité peut satisfaire infoRequired.
 * Utilisé côté frontend pour décider d'afficher le bouton FI.
 *
 * @param {string[]} infoRequired
 */
function isEudiEligible(infoRequired = []) {
  return resolveEudiThreshold(infoRequired) !== null
}

module.exports = { resolveEudiThreshold, isEudiEligible, INFOREQ_TO_FI_ELEMENT }
