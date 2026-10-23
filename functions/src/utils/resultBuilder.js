/**
 * Single source of truth for the `result` object written into pendingRequest.
 *
 * Both the OCR path and the France Identité path must normalize their raw data
 * into the common intermediate shape below, then call buildResult().
 *
 * Common intermediate shape:
 * {
 *   firstname:   string | null,
 *   lastname:    string | null,
 *   birthDate:   string | null,   // ISO date "YYYY-MM-DD"
 *   nationality: string | null,
 *   sex:         string | null,
 * }
 *
 * Output shape (subset driven by infoRequired):
 * {
 *   verificationMethod: 'ocr' | 'france_identite',
 *   firstname:    string,
 *   lastname:     string,
 *   birthDate:    string,         // infoRequired 'birthdate'
 *   age:          number,
 *   nationality:  string,
 *   sex:          string,         // covers 'sex' and 'gender' infoRequired
 *   majority:     boolean,        // infoRequired 'majority'
 *   age_over_N:   boolean,        // infoRequired 'age_over_18', 'age_over_21', etc.
 * }
 */

function computeAge(birthDateStr) {
  if (!birthDateStr) return null
  const birth = new Date(birthDateStr)
  if (isNaN(birth.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
}

function isAgeOver(birthDateStr, minAge) {
  const age = computeAge(birthDateStr)
  return age !== null ? age >= minAge : null
}

/**
 * @param {string[]} infoRequired
 * @param {{ firstname, lastname, birthDate, nationality, sex }} data
 * @param {'ocr' | 'france_identite'} verificationMethod
 * @returns {object}
 */
function buildResult(infoRequired, data, verificationMethod) {
  const result = { verificationMethod }

  for (const field of infoRequired) {
    switch (field) {
      case 'firstname':
        if (data.firstname) result.firstname = data.firstname
        break
      case 'lastname':
        if (data.lastname) result.lastname = data.lastname
        break
      case 'birthdate':
        if (data.birthDate) result.birthDate = data.birthDate
        break
      case 'age': {
        const age = computeAge(data.birthDate)
        if (age !== null) result.age = age
        break
      }
      case 'nationality':
        if (data.nationality) result.nationality = data.nationality
        break
      case 'sex':
      case 'gender':
        if (data.sex) result.sex = data.sex
        break
      case 'majority': {
        const over18 = isAgeOver(data.birthDate, 18)
        if (over18 !== null) result.majority = over18
        break
      }
      default: {
        const ageOverMatch = field.match(/^age_over_(\d+)$/)
        if (ageOverMatch) {
          const minAge = parseInt(ageOverMatch[1], 10)
          const isOver = isAgeOver(data.birthDate, minAge)
          if (isOver !== null) result[field] = isOver
        }
      }
    }
  }

  return result
}

module.exports = { buildResult, computeAge, isAgeOver }
