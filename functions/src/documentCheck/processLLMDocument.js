const { getFirestore } = require("firebase-admin/firestore");
const { info: logInfo, error: logError } = require("firebase-functions/logger");
const { runBlock1, assertBlock1Valid, runBlock2ForIDFront, runBlock2ForIDBack, runBlock2ForPassport } = require('./llmOCRService');
const { buildVerificationResult } = require('./ocrDataMapper');
const { updateVerifiedDocumentForID } = require('./verifyIDDocument');
const { createVerifiedPassportDocument } = require('./verifyPassportDocument');

// ─── Firestore status helpers ─────────────────────────────────────────────────

function buildSecurityCheck(validation) {
  return {
    is_identity_document: validation.is_identity_document,
    is_physical_document: validation.is_physical_document,
    is_legible: validation.is_legible,
    document_type: validation.document_type,
    card_side: validation.card_side || null,
    issuing_country: validation.issuing_country || null,
    rejection_reason: validation.rejection_reason || null,
    rejection_detail: validation.rejection_detail || null,
    checkedAt: new Date(),
  };
}

async function markSecurityCheckDone(docId, validation) {
  const db = getFirestore();
  await db.collection('uploadedDocument').doc(docId).update({
    status: 'security_check_done',
    securityCheck: buildSecurityCheck(validation),
  });
}

async function markRejected(docId, reason, validation) {
  const db = getFirestore();
  await db.collection('uploadedDocument').doc(docId).update({
    status: 'rejected',
    validity: 'rejected',
    rejectedAt: new Date(),
    rejectionReason: reason,
    ...(validation ? { securityCheck: buildSecurityCheck(validation) } : {}),
  });
}

async function markVerified(docId, isValid, validation) {
  const db = getFirestore();
  await db.collection('uploadedDocument').doc(docId).update({
    verifiedAt: new Date(),
    status: isValid ? 'verified' : 'rejected',
    validity: isValid ? 'validated' : 'rejected',
    ...(isValid ? { validatedAt: new Date() } : { rejectedAt: new Date() }),
    ...(validation ? { securityCheck: buildSecurityCheck(validation) } : {}),
  });
}

async function linkVerifiedDocument(docId, verifiedDocumentId) {
  if (!verifiedDocumentId) return;
  const db = getFirestore();
  await db.collection('uploadedDocument').doc(docId).update({ verifiedDocumentId });
}

// ─── ID Card (Traditional ID / New ID / ID) ───────────────────────────────────

async function processLLMIDDocument(docId, documentData) {
  const { userId, documentType, side, imageUrl } = documentData;

  logInfo('LLM: processing ID document', { docId, userId, documentType, side });

  if (!userId || !imageUrl || !side) {
    throw new Error(`Missing required fields: userId=${!!userId}, imageUrl=${!!imageUrl}, side=${!!side}`);
  }

  // ── Block 1: security filter ──
  let validation;
  try {
    validation = await runBlock1(imageUrl);
    assertBlock1Valid(validation);
  } catch (err) {
    const reason = err.code || 'llm_validation_failed';
    logError('LLM: Block 1 rejected image', { docId, reason, errorMessage: err.message, errorStack: err.stack });
    await markRejected(docId, reason, err.validation);
    return { success: false, rejectionReason: reason };
  }

  // Intermediate write — front can show "✅ Document valide, lecture en cours..."
  await markSecurityCheckDone(docId, validation);

  // ── Block 2: OCR extraction — distinct pipeline per side ──
  const runBlock2ForID = side === 'verso' ? runBlock2ForIDBack : runBlock2ForIDFront;
  let extraction;
  try {
    extraction = await runBlock2ForID(imageUrl, validation.issuing_country);
  } catch (err) {
    logError('LLM: Block 2 (ID) failed', { docId, side, errorMessage: err.message, errorStack: err.stack });
    await markRejected(docId, 'ocr_failed', validation);
    return { success: false, rejectionReason: 'ocr_failed' };
  }

  const verificationResult = buildVerificationResult({ docId, imageUrl, side, extraction });

  logInfo('LLM: ID verificationResult built', {
    docId, isValid: verificationResult.isValid, side,
    surname: verificationResult.extractedData.surname,
    birthDate: verificationResult.extractedData.birthDate,
  });

  // Create/update verifiedDocument first, then mark uploadedDocument as verified
  const db = getFirestore();
  const verificationStatus = await updateVerifiedDocumentForID(
    userId, side, verificationResult, db, docId, documentType
  );

  await linkVerifiedDocument(docId, verificationStatus?.documentId);
  await markVerified(docId, verificationResult.isValid, validation);

  logInfo('LLM: ID document processing complete', {
    docId, isValid: verificationResult.isValid,
    isComplete: verificationStatus?.isComplete,
    documentId: verificationStatus?.documentId,
  });

  return { success: true, verificationResult, verificationStatus };
}

// ─── Passport ──────────────────────────────────────────────────────────────────

async function processLLMPassportDocument(docId, documentData) {
  const { userId, imageUrl } = documentData;

  logInfo('LLM: processing Passport document', { docId, userId });

  if (!userId || !imageUrl) {
    throw new Error(`Missing required fields: userId=${!!userId}, imageUrl=${!!imageUrl}`);
  }

  // ── Block 1: security filter ──
  let validation;
  try {
    validation = await runBlock1(imageUrl);
    assertBlock1Valid(validation);
  } catch (err) {
    const reason = err.code || 'llm_validation_failed';
    logError('LLM: Block 1 rejected passport image', { docId, reason, errorMessage: err.message, errorStack: err.stack });
    await markRejected(docId, reason, err.validation);
    return { success: false, rejectionReason: reason };
  }

  // Intermediate write — front can show "✅ Document valide, lecture en cours..."
  await markSecurityCheckDone(docId, validation);

  // ── Block 2: OCR extraction ──
  let extraction;
  try {
    extraction = await runBlock2ForPassport(imageUrl, validation.issuing_country);
  } catch (err) {
    logError('LLM: Block 2 (Passport) failed', { docId, errorMessage: err.message, errorStack: err.stack });
    await markRejected(docId, 'ocr_failed', validation);
    return { success: false, rejectionReason: 'ocr_failed' };
  }

  const verificationResult = buildVerificationResult({ docId, imageUrl, extraction });

  logInfo('LLM: Passport verificationResult built', {
    docId, isValid: verificationResult.isValid,
    surname: verificationResult.extractedData.surname,
    birthDate: verificationResult.extractedData.birthDate,
  });

  // Create verifiedDocument first, then mark uploadedDocument as verified
  const db = getFirestore();
  const passportStatus = await createVerifiedPassportDocument(userId, verificationResult, db);

  await linkVerifiedDocument(docId, passportStatus?.documentId);
  await markVerified(docId, verificationResult.isValid, validation);

  logInfo('LLM: Passport processing complete', { docId, isValid: verificationResult.isValid });

  return { success: true, verificationResult };
}

module.exports = { processLLMIDDocument, processLLMPassportDocument };
