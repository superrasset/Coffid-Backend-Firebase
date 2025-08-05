# Mindee Passport Integration

## Overview
Successfully extended the Coffid OCR service to support passport documents using a dedicated Mindee Passport API endpoint, while maintaining the existing French ID card functionality.

## Key Changes

### 1. Multi-Endpoint Configuration
Updated the OCR service to support multiple Mindee endpoints based on document type:

- **French ID Cards**: `https://api.mindee.net/v1/products/mindee/idcard_fr/v2/predict`
  - Traditional ID
  - New ID  
  - Carte nationale d'identité
  - Carte d'identité

- **International Passports**: `https://api.mindee.net/v1/products/mindee/passport/v1/predict`
  - Passport documents

### 2. Environment Configuration
Updated `.env` and `.env.example` files with new endpoint variables:

```properties
# Mindee Endpoints for different document types
MINDEE_IDCARD_ENDPOINT=https://api.mindee.net/v1/products/mindee/idcard_fr/v2/predict
MINDEE_PASSPORT_ENDPOINT=https://api.mindee.net/v1/products/mindee/passport/v1/predict
```

### 3. Smart Document Type Routing
Added `getEndpointForDocumentType()` method that automatically selects the correct Mindee API based on document type:

```javascript
// Passport documents → Mindee Passport API
documentType: 'Passport' → passport/v1/predict

// ID card documents → Mindee ID Card FR API  
documentType: 'Traditional ID' → idcard_fr/v2/predict
documentType: 'New ID' → idcard_fr/v2/predict
documentType: 'Carte nationale d'identité' → idcard_fr/v2/predict
```

### 4. Document-Specific Parsing
Enhanced response parsing to handle different data structures:

#### Passport Response Parsing
- `parsePassportResponse()` - Handles passport-specific fields
- Extracts: `passportNumber`, `countryOfIssue`, passport MRZ format
- Maps `machine_readable_zone.line1/line2` to `mrz1/mrz2`

#### ID Card Response Parsing  
- `parseIDCardResponse()` - Handles French ID card fields
- Extracts: `cardAccessNumber`, `documentNumber`, ID card MRZ format
- Preserves existing `document_side`, `document_type` detection

### 5. Validation Logic Updates
Added passport-specific validation in `validatePassportData()`:

**Required Fields for Passport:**
- `birthDate`
- `passportNumber` 
- `givenNames` (array)
- `surname`
- `expiryDate`

**Optional Fields:**
- `countryOfIssue`
- `issueDate`
- `nationality`
- `mrz1`, `mrz2`

### 6. Backward Compatibility
- Existing French ID card processing unchanged
- Same API key works for both endpoints
- All existing validation and data structures preserved
- No breaking changes to current functionality

## Usage Examples

### Passport Document Upload
```javascript
// When a passport is uploaded with documentType: 'Passport'
// → Automatically routes to Mindee Passport API
// → Returns passport-specific fields (passportNumber, countryOfIssue)
// → Validates against passport requirements
```

### French ID Card Upload  
```javascript
// When an ID card is uploaded with documentType: 'Traditional ID'/'New ID'
// → Automatically routes to Mindee ID Card FR API (unchanged)
// → Returns ID card-specific fields (cardAccessNumber, documentSide)
// → Validates against ID card requirements (unchanged)
```

## Benefits

1. **Specialized Processing**: Each document type uses the most appropriate Mindee API
2. **Better Accuracy**: Passport API is optimized for passport documents vs ID card API
3. **Flexible**: Easy to add more document types and endpoints in the future
4. **Maintained Performance**: No impact on existing ID card processing
5. **Same API Key**: Uses single Mindee subscription for both services

## Testing

- ✅ Endpoint routing verified for all document types
- ✅ Mock service still available for development (`OCR_PROVIDER=mock`)
- ✅ Deployed to production and ready for passport uploads
- ✅ Backward compatibility confirmed for existing ID card processing

## Next Steps

You can now:
1. Upload passport documents through your mobile app with `documentType: 'Passport'`
2. The system will automatically use the Mindee Passport API
3. Extract passport-specific fields like `passportNumber`, `countryOfIssue`
4. Validate passport documents with appropriate requirements
5. Store passport verification results in the same `verifiedDocument` structure

The integration is production-ready and maintains full compatibility with your existing French ID card processing workflow.
