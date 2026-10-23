/**
 * Mapping entre les valeurs `infoRequired` des clients B2B
 * et les element identifiers du PID France Identité (eu.europa.ec.eudi.pid.1).
 *
 * Le parcours France Identité est proposé pour tout infoRequired satisfaisable
 * via le PID — identité complète + âge calculé depuis birth_date.
 * Si un champ n'est pas satisfaisable (ex: passportNumber, id), le bouton FI
 * n'est pas affiché et l'utilisateur passe par le scan OCR.
 */

const { buildResult: buildNormalizedResult } = require('../utils/resultBuilder')

// infoRequired (Coffid B2B) → element identifier PID eu.europa.ec.eudi.pid.1
// Les booléens d'âge (age_over_18, majority, age_over_21) et age sont tous résolus
// depuis birth_date — plus fiable que les attributs booléens absents de certains credentials.
const INFOREQ_TO_PID_ELEMENT = {
  firstname:   'given_name',
  lastname:    'family_name',
  birthdate:   'birth_date',
  nationality: 'nationality',
  age:         'birth_date',
  age_over_18: 'birth_date',
  majority:    'birth_date',
  age_over_21: 'birth_date',
  sex:         'gender',
  gender:      'gender',
}

/**
 * Retourne la liste dédupliquée des attributs PID à demander
 * pour satisfaire infoRequired, ou null si impossible via FI.
 *
 * @param {string[]} infoRequired
 * @returns {string[] | null}
 */
function resolvePidAttributes(infoRequired = []) {
  if (!infoRequired.length) return null

  const pidAttrs = new Set()
  for (const key of infoRequired) {
    const attr = INFOREQ_TO_PID_ELEMENT[key]
    if (attr) {
      pidAttrs.add(attr)
      continue
    }
    // age_over_N dynamique (N quelconque) → birth_date suffit
    if (/^age_over_\d+$/.test(key)) {
      pidAttrs.add('birth_date')
      continue
    }
    return null  // champ non satisfaisable via PID → OCR requis
  }

  return [...pidAttrs]
}

/**
 * Retourne true si le parcours France Identité peut satisfaire infoRequired.
 * Utilisé côté frontend pour afficher le bouton FI.
 *
 * @param {string[]} infoRequired
 */
function isEudiEligible(infoRequired = []) {
  return resolvePidAttributes(infoRequired) !== null
}

// cbor-x decodes CBOR tagged values as { tag: <number>, value: <inner> }
// (e.g. tag 1004 = full-date string). Unwrap to plain JS value.
function resolveAttr(val) {
  if (val !== null && typeof val === 'object' && typeof val.tag === 'number' && val.value !== undefined) {
    return val.value
  }
  return val
}

/**
 * Normalise les attributs PID bruts vers la shape commune, puis délègue
 * à resultBuilder pour produire un result identique au chemin OCR.
 *
 * @param {object} pidAttributes  Attributs bruts extraits du PID
 * @param {string[]} infoRequired Liste des champs demandés par le client B2B
 * @returns {object}
 */
function buildResult(pidAttributes, infoRequired) {
  const data = {
    firstname:   pidAttributes.given_name  !== undefined ? resolveAttr(pidAttributes.given_name)  : null,
    lastname:    pidAttributes.family_name !== undefined ? resolveAttr(pidAttributes.family_name) : null,
    birthDate:   pidAttributes.birth_date  !== undefined ? resolveAttr(pidAttributes.birth_date)  : null,
    nationality: pidAttributes.nationality !== undefined ? resolveAttr(pidAttributes.nationality) : null,
    sex:         pidAttributes.gender      !== undefined ? resolveAttr(pidAttributes.gender)      : null,
  }
  return buildNormalizedResult(infoRequired, data, 'france_identite')
}

module.exports = {
  INFOREQ_TO_PID_ELEMENT,
  resolvePidAttributes,
  isEudiEligible,
  buildResult,
}
