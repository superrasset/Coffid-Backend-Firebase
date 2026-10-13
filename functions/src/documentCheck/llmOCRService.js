const { genkit } = require('genkit');
const { vertexAI } = require('@genkit-ai/google-genai');
const { info: logInfo, error: logError } = require("firebase-functions/logger");

const ai = genkit({
  plugins: [vertexAI({ projectId: 'coffid-2388b', location: 'us-central1' })],
});

const MODEL = vertexAI.model('gemini-2.5-flash');

// ─── Shared: Block 1 (security filter) ───────────────────────────────────────
// Same for all document types — validates the image before any extraction

const BLOCK1_SYSTEM = `You are an advanced security filter for a KYC API. Your role is to validate if the provided image is a genuine, physical identity document and qualify its origin.

Actively look for signs of screen spoofs (moiré patterns, pixel grids, device borders, screen glare) or poor quality photocopies (blur, grayscale artifacts).

Return ONLY a raw JSON object. No markdown, no code blocks, no \`\`\`json. Raw JSON only.`;

const BLOCK1_USER = `Analyze the attached image. Fill the following JSON structure exactly, no surrounding text:

{
  "is_identity_document": true or false,
  "document_type": "ID_CARD" or "PASSPORT" or "DRIVING_LICENSE" or "UNKNOWN",
  "card_side": "FRONT" or "BACK" or null,
  "issuing_country": "3-letter ISO code (e.g., FRA, USA, MAR) or null if unknown",
  "is_legible": true or false,
  "is_physical_document": true or false,
  "rejection_reason": null or one of the enum values below,
  "rejection_detail": null or free-text sentence describing the specific visual evidence observed
}

Rules:
- "document_type": "ID_CARD" for any national identity card. "PASSPORT" for any passport booklet. "DRIVING_LICENSE" for driving licenses. "UNKNOWN" if uncertain.
- "card_side": only populated when "document_type" is "ID_CARD" or "DRIVING_LICENSE".
  Use "FRONT" if the image shows a large dominant portrait photo combined with
  personal data fields and a national graphic design, with no MRZ visible.
  Use "BACK" if the image shows a MRZ strip (lines of monospaced uppercase characters
  ending with < padding at the bottom of the card), a barcode, or a predominantly
  administrative layout with no large portrait. A small secondary photo may also be
  present but is not required.
  When in doubt, the presence of a MRZ is the strongest indicator of the back side.
  Set to null for "PASSPORT" and "UNKNOWN".
- "is_physical_document": false if you detect any fraud signal listed in your instructions.
- "is_legible": false if the image is too blurry, dark, or overexposed to read key fields.
- "rejection_reason": null if the document passes all checks. Otherwise use exactly one of:
  "NOT_A_DOCUMENT" — image does not contain an identity document
  "SCREEN_SPOOF" — moiré, pixel grid, device bezel, or screen glare detected
  "PHOTOCOPY" — grayscale flattening or scanner artifacts detected
  "PRINTED_COPY" — inkjet/laser print artifacts detected
  "DIGITAL_MANIPULATION" — signs of editing or compositing detected
  "PARTIAL_DOCUMENT" — document is cropped in a way that hides security features
  "POOR_QUALITY" — too blurry, dark, or low-resolution to verify
  "NO_PHYSICAL_CUES" — no laminate, hologram, or depth cues expected for this document type
- "rejection_detail": null if the document passes all checks. Otherwise write one concise sentence describing the specific visual evidence that led to rejection. Be precise and factual, no speculation.`;

// ─── ID Card Front (recto): Block 2 prompts ──────────────────────────────────

const BLOCK2_ID_FRONT_SYSTEM = `You are a high-precision OCR extraction engine specialized in national identity cards. Extract text exactly as it appears on the document. If a field is not visible or not present on this side, return null. Return ONLY a raw JSON object. No markdown, no code blocks, no \`\`\`json. Raw JSON only.`;

function buildBlock2IDFrontUser(issuingCountry) {
  return `You are processing the FRONT side of a national identity card issued by ${issuingCountry || 'an unknown country'}.

Extract all visible information exactly as it appears. Standardize all dates to YYYY-MM-DD format. If a Machine-Readable Zone (MRZ) is visible anywhere on this image, extract it character-for-character including all < characters.

Return ONLY this JSON structure:
{
  "surname": "string or null",
  "givenNames": ["string"],
  "birthDate": "YYYY-MM-DD or null",
  "birthPlace": "string or null",
  "nationality": "string or null",
  "sex": "M or F or null",
  "documentNumber": "string or null",
  "cardAccessNumber": "string or null",
  "issuingCountry": "3-letter ISO code or null",
  "issueDate": "YYYY-MM-DD or null",
  "expiryDate": "YYYY-MM-DD or null",
  "mrz": {
    "line_1": "string or null",
    "line_2": "string or null",
    "line_3": "string or null"
  }
}

Rules:
- "documentNumber": the alphanumeric identifier printed next to "N° de document" or "Document No.". On French CNIe this is exactly 9 characters mixing uppercase letters and digits (e.g., GKLP4H9P7). Cross-check with MRZ line 1 positions 1–9 if MRZ is visible. Never substitute another number for this field.
- "cardAccessNumber": the short numeric code (typically 6 digits) printed at the bottom-right corner of French ID cards, used for chip access. This is NOT the document number — do not confuse the two.
- "givenNames": return as an array, one entry per given name.
- "sex": return "M" or "F" only, never the full word.
- "mrz": extract each line character-for-character including all < characters. Return null for lines that are not visible or do not exist for this document type.
- If a field is missing, hidden, or not present on this side, return null.`;
}

// ─── ID Card Back (verso): Block 2 prompts ───────────────────────────────────

const BLOCK2_ID_BACK_SYSTEM = `You are a high-precision OCR extraction engine specialized in national identity cards. Extract text exactly as it appears on the document. If a field is not visible or not present on this side, return null. Return ONLY a raw JSON object. No markdown, no code blocks, no \`\`\`json. Raw JSON only.`;

function buildBlock2IDBackUser(issuingCountry) {
  return `You are processing the BACK side of a national identity card issued by ${issuingCountry || 'an unknown country'}.

Extract all visible information exactly as it appears. Standardize all dates to YYYY-MM-DD format. If a Machine-Readable Zone (MRZ) is visible anywhere on this image, extract it character-for-character including all < characters.

Return ONLY this JSON structure:
{
  "surname": "string or null",
  "givenNames": ["string"],
  "birthDate": "YYYY-MM-DD or null",
  "birthPlace": "string or null",
  "nationality": "string or null",
  "sex": "M or F or null",
  "documentNumber": "string or null",
  "cardAccessNumber": "string or null",
  "issuingCountry": "3-letter ISO code or null",
  "issueDate": "YYYY-MM-DD or null",
  "expiryDate": "YYYY-MM-DD or null",
  "mrz": {
    "line_1": "string or null",
    "line_2": "string or null",
    "line_3": "string or null"
  }
}

Rules:
- "documentNumber": the alphanumeric identifier printed next to "N° de document" or "Document No.". On French CNIe this is exactly 9 characters mixing uppercase letters and digits (e.g., GKLP4H9P7). Cross-check with MRZ line 1 positions 1–9 if MRZ is visible. Never substitute another number for this field.
- "cardAccessNumber": the short numeric code (typically 6 digits) printed at the bottom-right corner of French ID cards, used for chip access. This is NOT the document number — do not confuse the two.
- "givenNames": return as an array, one entry per given name.
- "sex": return "M" or "F" only, never the full word.
- "mrz": extract each line character-for-character including all < characters. Return null for lines that are not visible or do not exist for this document type.
- If a field is missing, hidden, or not present on this side, return null.`;
}

// ─── Passport: Block 2 prompts ────────────────────────────────────────────────

const BLOCK2_PASSPORT_SYSTEM = `You are a high-precision OCR extraction engine specialized in passports. Extract text exactly as it appears on the document. If a field is not visible or not present, return null. Return ONLY a raw JSON object. No markdown, no code blocks, no \`\`\`json. Raw JSON only.`;

function buildBlock2PassportUser(issuingCountry) {
  return `You are processing the data page of a passport issued by ${issuingCountry || 'an unknown country'}.

Extract all visible information exactly as it appears. Standardize all dates to YYYY-MM-DD format. The MRZ on a passport has 2 lines of 44 characters each — extract them character-for-character including all < characters.

Return ONLY this JSON structure:
{
  "surname": "string or null",
  "givenNames": ["string"],
  "birthDate": "YYYY-MM-DD or null",
  "birthPlace": "string or null",
  "nationality": "string or null",
  "sex": "M or F or null",
  "cardAccessNumber": "passport number as string or null",
  "issuingCountry": "3-letter ISO code or null",
  "issueDate": "YYYY-MM-DD or null",
  "expiryDate": "YYYY-MM-DD or null",
  "mrz": {
    "line_1": "string or null",
    "line_2": "string or null",
    "line_3": null
  }
}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseJsonResponse(raw, blockName) {
  if (!raw || !raw.trim()) {
    logError(`${blockName}: empty response from model`, { raw });
    throw new Error(`${blockName}: empty response from model (possible safety block or API error)`);
  }
  const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    logError(`${blockName}: failed to parse JSON`, { parseError: e.message, rawPreview: raw.slice(0, 500) });
    throw new Error(`${blockName} returned invalid JSON: ${raw.slice(0, 200)}`);
  }
}

function getContentType(url) {
  if (url.match(/\.png$/i)) return 'image/png';
  if (url.match(/\.webp$/i)) return 'image/webp';
  return 'image/jpeg';
}

async function runBlock1(imageUrl) {
  logInfo('LLM Block 1: validating image', { imageUrl });

  const response = await ai.generate({
    model: MODEL,
    system: BLOCK1_SYSTEM,
    prompt: [
      { text: BLOCK1_USER },
      { media: { url: imageUrl, contentType: getContentType(imageUrl) } },
    ],
    config: { temperature: 0 },
  });

  const result = parseJsonResponse(response.text, 'Block 1');
  logInfo('LLM Block 1 result', result);
  return result;
}

function assertBlock1Valid(validation) {
  if (!validation.is_identity_document || !validation.is_physical_document || !validation.is_legible) {
    const reason = validation.rejection_reason || (
      !validation.is_identity_document ? 'NOT_A_DOCUMENT' :
      !validation.is_physical_document ? 'NOT_PHYSICAL_DOCUMENT' :
      'POOR_QUALITY'
    );
    const err = new Error(validation.rejection_detail || reason);
    err.code = reason;
    err.validation = validation;
    throw err;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────
// Block 1 and Block 2 are exposed separately so the orchestrator
// (processLLMDocument.js) can write intermediate Firestore state between them.

async function runBlock2ForIDFront(imageUrl, issuingCountry) {
  logInfo('LLM Block 2 (ID Front): extracting OCR data', { imageUrl, issuingCountry });

  const response = await ai.generate({
    model: MODEL,
    system: BLOCK2_ID_FRONT_SYSTEM,
    prompt: [
      { text: buildBlock2IDFrontUser(issuingCountry) },
      { media: { url: imageUrl, contentType: getContentType(imageUrl) } },
    ],
    config: { temperature: 0 },
  });

  const extraction = parseJsonResponse(response.text, 'Block 2 (ID Front)');
  logInfo('LLM Block 2 (ID Front) result', {
    surname: extraction.surname,
    givenNames: extraction.givenNames,
    birthDate: extraction.birthDate,
    hasMRZ: !!(extraction.mrz?.line_1),
  });

  return extraction;
}

async function runBlock2ForIDBack(imageUrl, issuingCountry) {
  logInfo('LLM Block 2 (ID Back): extracting OCR data', { imageUrl, issuingCountry });

  const response = await ai.generate({
    model: MODEL,
    system: BLOCK2_ID_BACK_SYSTEM,
    prompt: [
      { text: buildBlock2IDBackUser(issuingCountry) },
      { media: { url: imageUrl, contentType: getContentType(imageUrl) } },
    ],
    config: { temperature: 0 },
  });

  const extraction = parseJsonResponse(response.text, 'Block 2 (ID Back)');
  logInfo('LLM Block 2 (ID Back) result', {
    surname: extraction.surname,
    givenNames: extraction.givenNames,
    birthDate: extraction.birthDate,
    hasMRZ: !!(extraction.mrz?.line_1),
  });

  return extraction;
}

async function runBlock2ForPassport(imageUrl, issuingCountry) {
  logInfo('LLM Block 2 (Passport): extracting OCR data', { imageUrl, issuingCountry });

  const response = await ai.generate({
    model: MODEL,
    system: BLOCK2_PASSPORT_SYSTEM,
    prompt: [
      { text: buildBlock2PassportUser(issuingCountry) },
      { media: { url: imageUrl, contentType: getContentType(imageUrl) } },
    ],
    config: { temperature: 0 },
  });

  const extraction = parseJsonResponse(response.text, 'Block 2 (Passport)');
  logInfo('LLM Block 2 (Passport) result', {
    surname: extraction.surname,
    givenNames: extraction.givenNames,
    birthDate: extraction.birthDate,
    hasMRZ: !!(extraction.mrz?.line_1),
  });

  return extraction;
}

module.exports = { runBlock1, assertBlock1Valid, runBlock2ForIDFront, runBlock2ForIDBack, runBlock2ForPassport };
