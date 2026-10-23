/**
 * Mapping entre les valeurs `infoRequired` des clients B2B
 * et les element identifiers du PID France Identité (eu.europa.ec.eudi.pid.1).
 *
 * Le parcours France Identité est proposé pour tout infoRequired satisfaisable
 * via le PID — identité complète + âge calculé depuis birth_date.
 * Si un champ n'est pas satisfaisable (ex: passportNumber, id), le bouton FI
 * n'est pas affiché et l'utilisateur passe par le scan OCR.
 */

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
    if (!attr) return null  // champ non satisfaisable via PID → OCR requis
    pidAttrs.add(attr)
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

/**
 * Calcule les champs dérivés à partir des attributs PID extraits.
 * Les booléens d'âge et age sont tous calculés depuis birth_date.
 *
 * @param {object} pidAttributes  Attributs bruts extraits du PID
 * @param {string[]} infoRequired Liste des champs demandés par le client B2B
 * @returns {object}  Résultat final à écrire dans Firestore
 */
// cbor-x decodes CBOR tagged values as { tag: <number>, value: <inner> }
// (e.g. tag 1004 = full-date string). Unwrap to plain JS value.
function resolveAttr(val) {
  if (val !== null && typeof val === 'object' && typeof val.tag === 'number' && val.value !== undefined) {
    return val.value
  }
  return val
}

function buildResult(pidAttributes, infoRequired) {
  const result = {
    verificationMethod: 'france_identite',
  }

  for (const key of infoRequired) {
    switch (key) {
      case 'firstname':
        if (pidAttributes.given_name !== undefined)
          result.firstname = resolveAttr(pidAttributes.given_name)
        break
      case 'lastname':
        if (pidAttributes.family_name !== undefined)
          result.lastname = resolveAttr(pidAttributes.family_name)
        break
      case 'birthdate':
        if (pidAttributes.birth_date !== undefined)
          result.birthdate = resolveAttr(pidAttributes.birth_date)
        break
      case 'nationality':
        if (pidAttributes.nationality !== undefined)
          result.nationality = resolveAttr(pidAttributes.nationality)
        break
      case 'sex':
      case 'gender':
        if (pidAttributes.gender !== undefined)
          result.gender = resolveAttr(pidAttributes.gender)
        break
      case 'age':
        if (pidAttributes.birth_date) {
          result.age = computeAge(resolveAttr(pidAttributes.birth_date))
        }
        break
      case 'age_over_18':
      case 'majority':
        if (pidAttributes.birth_date) {
          result.ageOver18 = computeAge(resolveAttr(pidAttributes.birth_date)) >= 18
          result.ageVerified = result.ageOver18
        }
        break
      case 'age_over_21':
        if (pidAttributes.birth_date) {
          result.ageOver21 = computeAge(resolveAttr(pidAttributes.birth_date)) >= 21
          result.ageVerified = result.ageOver21
        }
        break
    }
  }

  return result
}

function computeAge(birthDateStr) {
  const birth = new Date(birthDateStr)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
}

module.exports = {
  INFOREQ_TO_PID_ELEMENT,
  resolvePidAttributes,
  isEudiEligible,
  buildResult,
}
