// Export all OCR provider classes
const { BaseOCRService } = require('./baseOCRService');
const { MindeeOCRService } = require('./mindeeOCRService');
const { CustomOCRService } = require('./customOCRService');
const { MockOCRService } = require('./mockOCRService');
const { OCRResult } = require('./ocrResult');

module.exports = {
  BaseOCRService,
  MindeeOCRService,
  CustomOCRService,
  MockOCRService,
  OCRResult
};
