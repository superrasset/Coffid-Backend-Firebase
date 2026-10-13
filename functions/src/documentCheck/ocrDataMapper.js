/**
 * Maps LLM OCR extraction output to internal Firestore-ready formats.
 * No LLM calls here — pure deterministic mapping.
 * The LLM only extracts; this code decides what goes into Firestore.
 */

/**
 * Maps Block 2 extraction JSON to the extractedData format
 * expected by updateVerifiedDocumentForID and createVerifiedPassportDocument.
 */
function mapToExtractedData(extraction) {
  if (!extraction) return {};

  const mrz = extraction.mrz || {};

  return {
    surname:          extraction.surname          || null,
    givenNames:       Array.isArray(extraction.givenNames) ? extraction.givenNames : [],
    birthDate:        extraction.birthDate        || null,
    birthPlace:       extraction.birthPlace       || null,
    nationality:      extraction.nationality      || null,
    sex:              extraction.sex              || null,
    documentNumber:   extraction.documentNumber   || null,
    cardAccessNumber: extraction.cardAccessNumber || null,
    issuingCountry:   extraction.issuingCountry   || null,
    issueDate:        extraction.issueDate        || null,
    expiryDate:       extraction.expiryDate       || null,
    mrz1:             mrz.line_1                  || null,
    mrz2:             mrz.line_2                  || null,
    mrz3:             mrz.line_3                  || null,
  };
}

/**
 * Considers an extraction valid if at least one key identity field is present.
 */
function isExtractionValid(extraction) {
  if (!extraction) return false;
  return !!(
    extraction.surname ||
    extraction.birthDate ||
    (Array.isArray(extraction.givenNames) && extraction.givenNames.length > 0)
  );
}

/**
 * Builds a verificationResult object (the shape expected by verifyIDDocument
 * and verifyPassportDocument Firestore logic) from LLM outputs.
 */
function buildVerificationResult({ docId, imageUrl, side, extraction }) {
  const extractedData = mapToExtractedData(extraction);
  const isValid = isExtractionValid(extraction);

  return {
    isValid,
    processedAt: new Date().toISOString(),
    side: side || null,
    uploadedDocumentId: docId,
    imageUrl,
    extractedData,
    ocrData: {
      provider: 'gemini',
      confidence: isValid ? 0.9 : 0.0,
      errors: isValid ? [] : ['Insufficient data extracted from document'],
    },
  };
}

module.exports = { mapToExtractedData, isExtractionValid, buildVerificationResult };
