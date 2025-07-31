# OCR Service Architecture

## Overview

The OCR service is designed with a modular architecture that allows easy switching between different OCR providers. This design supports the migration path from temporary solutions (like Mindee) to your own custom OCR implementation.

## Architecture

```
documentProcessor.js
    ↓
verifyIDDocument.js
    ↓
ocrService.js (Abstraction Layer)
    ↓
[MindeeOCRService | CustomOCRService | MockOCRService]
```

## OCR Providers

### 1. Mock OCR Service (Development/Testing)
- **Provider**: `mock`
- **Purpose**: Testing and development without external API calls
- **Usage**: Default for development, always returns valid results
- **Config**: `OCR_PROVIDER=mock`

### 2. Mindee OCR Service (Production-Ready Temporary Solution)
- **Provider**: `mindee`
- **Purpose**: Production-ready OCR for French ID documents (temporary solution)
- **API**: Mindee French ID Card API v2
- **Features**: Full French ID parsing (recto/verso), high confidence scores, comprehensive data extraction
- **Status**: ✅ **READY FOR PRODUCTION** - Complete implementation with real API integration
- **Config**: 
  ```
  OCR_PROVIDER=mindee
  MINDEE_API_KEY=your_api_key
  MINDEE_ENDPOINT=https://api.mindee.net/v1/products/mindee/idcard_fr/v2/predict
  ```

#### Mindee Data Extraction
The Mindee service extracts comprehensive data from French ID documents:

**Recto Side:**
- Personal information: surname, given names, birth date, birth place
- Document details: document number, issue date, expiry date
- Identity data: gender, nationality, alternative name

**Verso Side:**
- Authority information: issuing authority
- Security data: card access number
- MRZ (Machine Readable Zone): mrz1, mrz2, mrz3

**Validation Features:**
- Confidence scoring for each field
- Overall confidence calculation
- Side-specific validation rules
- Error reporting and fallback handling

### 3. Custom OCR Service (Future Production)
- **Provider**: `custom`
- **Purpose**: Your own OCR implementation
- **API**: Your custom OCR endpoint
- **Config**: 
  ```
  OCR_PROVIDER=custom
  CUSTOM_OCR_ENDPOINT=https://your-ocr-api.com/analyze
  CUSTOM_OCR_API_KEY=your_api_key
  ```

## Migration Path

### Phase 1: Current State (Mock/Development)
```javascript
// .env
OCR_PROVIDER=mock
```
- Development and testing with simulated OCR results
- No external API dependencies

### Phase 2: Temporary Production (Mindee)
```javascript
// .env
OCR_PROVIDER=mindee
MINDEE_API_KEY=your_mindee_key
```
- Production-ready OCR using Mindee API
- Real French ID document processing
- Quick deployment for MVP

### Phase 3: Custom Production (Your OCR)
```javascript
// .env
OCR_PROVIDER=custom
CUSTOM_OCR_ENDPOINT=https://your-ocr-api.com
CUSTOM_OCR_API_KEY=your_key
```
- Full control over OCR processing
- Custom algorithms and optimizations
- No third-party dependencies

## Implementation Details

### Standard OCR Result Interface
All OCR providers return consistent data structure:
```javascript
{
  isValid: boolean,
  confidence: number,
  extractedData: object,
  errors: string[],
  provider: string,
  processedAt: string,
  rawResponse: object // For debugging
}
```

### Easy Provider Switching
Change provider in environment variables:
```bash
# Switch to Mindee
export OCR_PROVIDER=mindee

# Switch to Custom
export OCR_PROVIDER=custom

# Switch to Mock (testing)
export OCR_PROVIDER=mock
```

### Adding New OCR Providers
1. Create new class extending `BaseOCRService`
2. Implement `processDocument()` method
3. Add provider to factory in `createOCRService()`
4. Update configuration

## File Structure

```
functions/src/documentCheck/
├── ocrService.js           # OCR abstraction layer
├── verifyIDDocument.js     # Document verification logic
├── verifyPassportDocument.js
└── documentProcessor.js    # Main routing logic
```

## Benefits

1. **Easy Migration**: Switch providers with configuration change
2. **Consistent Interface**: All OCR providers use same data format
3. **Isolated Dependencies**: Mindee-specific code is contained
4. **Testing Friendly**: Mock service for development
5. **Future Proof**: Ready for custom OCR implementation

## Next Steps

1. **Immediate**: Use mock service for development
2. **Short-term**: Implement Mindee integration for production
3. **Long-term**: Replace with custom OCR service

## Configuration Files

- `functions/.env.example` - Environment variable examples
- `functions/src/documentCheck/ocrService.js` - Service implementations
- This README for documentation and migration guide
