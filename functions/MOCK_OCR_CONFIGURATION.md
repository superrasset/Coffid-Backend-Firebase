# Mock OCR Service Configuration for Debugging

## Overview
The Coffid backend has been successfully configured to use a mock OCR service for testing and debugging document upload processes instead of the live Mindee API.

## Changes Made

### 1. Environment Configuration
- **File**: `/functions/.env`
- **Change**: Set `OCR_PROVIDER=mock` instead of `OCR_PROVIDER=mindee`
- **Purpose**: Switch from real Mindee API calls to predictable mock data

### 2. Enhanced Mock OCR Service
- **File**: `/functions/src/documentCheck/ocrService.js`
- **Enhancement**: Improved `MockOCRService` to return realistic test data
- **Features**:
  - Simulates 1-second processing delay
  - Returns document-type-specific test data
  - Provides different data for recto/verso sides
  - High confidence scores (0.95-0.96)
  - Realistic French ID card and passport data

### 3. Mock Data Structure

#### Traditional ID / New ID - Recto Side:
```json
{
  "firstname": "Jean",
  "lastname": "DUPONT", 
  "birthDate": "1990-05-15",
  "cardAccessNumber": "FR12345678901",
  "expiryDate": "2030-05-15",
  "issueDate": "2020-05-15",
  "nationality": "Française",
  "gender": "M"
}
```

#### Traditional ID / New ID - Verso Side:
```json
{
  "MRZ1": "IDFRAFR1234567890123456789012345",
  "MRZ2": "9005155M3005155FRA<<<<<<<<<<<<<<08",
  "address": "123 RUE DE LA PAIX, 75001 PARIS",
  "issueLocation": "PREFECTURE DE PARIS"
}
```

#### Passport - Recto Side:
```json
{
  "firstname": "Marie",
  "lastname": "MARTIN",
  "birthDate": "1985-12-20", 
  "passportNumber": "20AB12345",
  "expiryDate": "2028-12-20",
  "issueDate": "2018-12-20",
  "nationality": "Française",
  "gender": "F",
  "placeOfBirth": "Lyon, France",
  "MRZ1": "P<FRAMARIE<<MARTIN<<<<<<<<<<<<<<<<<<<<<<",
  "MRZ2": "20AB12345<FRA8512204F2812205<<<<<<<<<<<<<08"
}
```

## Testing

### Local Testing
- **Script**: `test_mock_ocr_service.js`
- **Usage**: `node test_mock_ocr_service.js`
- **Results**: All document types and sides return valid test data

### Deployed Functions
- All Firebase Cloud Functions now use the mock OCR service
- Document uploads will process with predictable test data
- No external API calls to Mindee (saves costs and avoids rate limits)

## Benefits for Debugging

1. **Predictable Results**: Always returns the same test data for consistent debugging
2. **Fast Processing**: No network calls to external APIs
3. **Cost Savings**: No API usage charges during development
4. **Offline Development**: Works without internet connectivity
5. **Complete Coverage**: Test data for all supported document types and sides

## Switching Back to Production

When ready to use the real Mindee API again:

1. Edit `/functions/.env`
2. Change `OCR_PROVIDER=mock` to `OCR_PROVIDER=mindee`
3. Deploy functions: `firebase deploy --only functions`

## Next Steps

You can now:
- Upload documents through your mobile app
- Debug the document processing workflow with consistent test data
- Test status progression from recto → verso → video validation
- Verify user data updates in the `users` collection
- Test the complete verification flow without external dependencies

The mock service provides all the same data structures and validation results as the real Mindee API, making it perfect for development and debugging.
