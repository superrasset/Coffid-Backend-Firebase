/**
 * ARCHIVE — Parcours EU Age Verification (eu.europa.ec.av.1)
 *
 * Ce fichier conserve la logique du parcours AV (Age Verification) basé sur
 * le credential eu.europa.ec.av.1, qui ne transmet que des booléens d'âge
 * sans aucune donnée nominative.
 *
 * NON IMPORTÉ — désactivé au profit du parcours PID (eudiMapping.js).
 * Réactiver en remplaçant les imports de eudiMapping.js par ce fichier
 * dans initVP.js, getVPRequestObject.js, handleVPResponse.js, verifyVP.js.
 *
 * Avantage AV vs PID :
 *   - Privacy maximale : zéro donnée nominative, seulement age_over_18/21
 *   - Protocole plus simple (pas de gestion d'attributs multiples)
 * Limitation :
 *   - iOS pas encore supporté dans l'app Partenaires (🚧 oct. 2026)
 *   - Uniquement majority / age_over_18 / age_over_21 satisfaisables
 */

const AV_DOCTYPE = 'eu.europa.ec.av.1'

// infoRequired → element identifier AV
const INFOREQ_TO_AV_ELEMENT = {
  majority:    'age_over_18',
  age_over_18: 'age_over_18',
  age_over_21: 'age_over_21',
  // 'age' intentionnellement absent : AV ne transmet pas l'âge exact
}

/**
 * Retourne l'element identifier AV à demander ('age_over_18' | 'age_over_21')
 * ou null si le parcours AV ne peut pas satisfaire infoRequired.
 */
function resolveEudiThreshold(infoRequired = []) {
  if (!infoRequired.length) return null
  if (!infoRequired.every(key => key in INFOREQ_TO_AV_ELEMENT)) return null
  const elements = infoRequired.map(key => INFOREQ_TO_AV_ELEMENT[key])
  return elements.includes('age_over_21') ? 'age_over_21' : 'age_over_18'
}

function isEudiEligible(infoRequired = []) {
  return resolveEudiThreshold(infoRequired) !== null
}

/**
 * Construit le résultat Firestore depuis un threshold AV vérifié.
 * À utiliser dans handleVPResponse.js / verifyVP.js à la place de buildResult().
 */
function buildAVResult(threshold) {
  return {
    ageVerified: true,
    ageOver18: true,
    ...(threshold === 'age_over_21' ? { ageOver21: true } : {}),
    verificationMethod: 'france_identite',
  }
}

/**
 * DCQL query pour AV — à utiliser dans getVPRequestObject.js buildDcqlQuery()
 */
function buildAvDcqlQuery(threshold) {
  return {
    credentials: [{
      id: threshold,
      format: 'mso_mdoc',
      meta: { doctype_value: AV_DOCTYPE },
      claims: [{ path: [AV_DOCTYPE, threshold], intent_to_retain: false }],
      multiple: false,
      require_cryptographic_holder_binding: true,
    }],
  }
}

/**
 * DeviceRequest nameSpaces pour AV — à utiliser dans initVP.js (DC API)
 */
function buildAvNameSpaces(threshold) {
  return { [AV_DOCTYPE]: { [threshold]: false } }
}

module.exports = {
  AV_DOCTYPE,
  INFOREQ_TO_AV_ELEMENT,
  resolveEudiThreshold,
  isEudiEligible,
  buildAVResult,
  buildAvDcqlQuery,
  buildAvNameSpaces,
}
