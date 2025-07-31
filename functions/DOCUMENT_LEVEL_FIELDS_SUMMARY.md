# Document-Level Fields Implementation Summary

## Overview
Added document-level aggregated fields to the `verifiedDocument` collection to provide easy access to key document information without having to dig into the side-specific extracted data.

## Implemented Fields

The following document-level fields are now stored at the top level of each `verifiedDocument`:

- **cardNumber**: The document number (from `documentNumber` in extractedData)
- **firstname**: The first given name (from `givenNames[0]` in extractedData)
- **lastname**: The surname (from `surname` in extractedData)
- **birthDate**: Date of birth (from `birthDate` in extractedData)
- **issueDate**: Document issue date (from `issueDate` in extractedData)
- **expiryDate**: Document expiry date (from `expiryDate` in extractedData)
- **MRZ1**: Machine Readable Zone line 1 (from `mrz1` in extractedData)
- **MRZ2**: Machine Readable Zone line 2 (from `mrz2` in extractedData)

## Implementation Details

### New Helper Functions
Added two utility functions in `verifyIDDocument.js`:

1. **`extractDocumentLevelFields(extractedData)`**
   - Extracts document-level fields from OCR extracted data
   - Returns an object with all 8 document-level fields
   - Handles null/undefined values gracefully

2. **`createDocumentLevelUpdateFields(extractedData, existingData)`**
   - Creates update fields for document-level data
   - Only includes fields that have values and are missing in existing data
   - Prevents overwriting existing values

### Processing Logic

#### Recto Processing (First Side)
- Extracts all available document-level fields from recto OCR data
- Populates the `verifiedDocument` with these fields at creation
- Status: `partial 1/3`

#### Verso Processing (Second Side)
- Extracts document-level fields from verso OCR data
- Only updates fields that are missing from the existing document
- Preserves existing values from recto processing
- Status: `partial 2/3`

#### Video Processing (Final Step)
- Document-level fields remain unchanged
- Only updates status to `completed` or `rejected`
- Preserves all existing document-level data

## Document Structure Example

```json
{
  "userId": "user123",
  "documentType": "Traditional ID",
  "status": "partial 2/3",
  
  // Document-level aggregated fields (NEW)
  "cardNumber": "D2H6862M2",
  "firstname": "Marie",
  "lastname": "MARTIN",
  "birthDate": "1990-07-13",
  "issueDate": "2020-02-12",
  "expiryDate": "2030-02-11",
  "MRZ1": "IDFRAX4RTBPFW46<<<<<<<<<<<<<<",
  "MRZ2": "9007138F3002119FRA<<<<<<<<<<<6",
  
  // Existing structure (preserved)
  "uploadedDocuments": {
    "recto": {
      "isValid": true,
      "extractedData": { /* full recto OCR data */ }
    },
    "verso": {
      "isValid": true,
      "extractedData": { /* full verso OCR data */ }
    },
    "overallValid": true
  },
  "createdAt": "2025-07-31T10:00:00Z",
  "updatedAt": "2025-07-31T10:05:00Z"
}
```

## Data Flow

1. **Recto Upload** → Extract document fields → Create `verifiedDocument` with aggregated fields
2. **Verso Upload** → Extract document fields → Update only missing aggregated fields
3. **Video Validation** → Final status update → Aggregated fields preserved

## Benefits

### For Frontend Applications
- **Easy Access**: All key document data available at the document root level
- **No Deep Navigation**: No need to navigate into `uploadedDocuments.recto.extractedData`
- **Consistent Structure**: Same field names regardless of which side provided the data
- **Query Efficiency**: Can query and filter documents by these top-level fields

### For Database Queries
```javascript
// Find documents by name
db.collection('verifiedDocument')
  .where('firstname', '==', 'Marie')
  .where('lastname', '==', 'MARTIN')
  .get()

// Find documents expiring soon
db.collection('verifiedDocument')
  .where('expiryDate', '<', '2025-12-31')
  .get()

// Find documents by card number
db.collection('verifiedDocument')
  .where('cardNumber', '==', 'D2H6862M2')
  .get()
```

## Backward Compatibility
- All existing `uploadedDocuments` structure is preserved
- No breaking changes to existing API
- Full OCR data remains available in side-specific `extractedData`

## Field Mapping Reference
| Document Field | OCR Source Field | Notes |
|---------------|------------------|-------|
| `cardNumber` | `documentNumber` | Document ID number |
| `firstname` | `givenNames[0]` | First given name only |
| `lastname` | `surname` | Family name |
| `birthDate` | `birthDate` | ISO date format |
| `issueDate` | `issueDate` | ISO date format |
| `expiryDate` | `expiryDate` | ISO date format |
| `MRZ1` | `mrz1` | Machine readable zone line 1 |
| `MRZ2` | `mrz2` | Machine readable zone line 2 |

## Testing
- Created comprehensive test scripts to verify field extraction
- Tested both recto-first and verso-first scenarios
- Verified that missing fields are handled gracefully
- Confirmed that existing data is not overwritten

## Deployment
- ✅ Functions deployed to Firebase
- ✅ Document-level fields implementation active
- ✅ Backward compatibility maintained

The implementation provides a clean, efficient way to access key document information while preserving the detailed OCR data for advanced use cases.
