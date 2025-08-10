// Export all OCR provider classes
const { BaseOCRService } = require('./baseOCRService');
const { MindeeOCRService } = require('./mindeeOCRService');
const { MindeeOCRServiceV2 } = require('./mindeeOCRServiceV2');
const { CustomOCRService } = require('./customOCRService');
const { MockOCRService } = require('./mockOCRService');
const { OCRResult } = require('./ocrResult');

module.exports = {
  BaseOCRService,
  MindeeOCRService,
  MindeeOCRServiceV2,
  CustomOCRService,
  MockOCRService,
  OCRResult,
  
  // Provider registry for dynamic creation
  providers: {
    'mindee': MindeeOCRService,
    'mindee-v1': MindeeOCRService,
    'mindee-v2': MindeeOCRServiceV2,
    'custom': CustomOCRService,
    'mock': MockOCRService
  }
};
