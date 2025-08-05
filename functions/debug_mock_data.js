// Quick test to debug mock data generation
const { MockOCRService } = require('./src/documentCheck/ocrService');

function debugMockData() {
  console.log('=== Debugging Mock Data Generation ===');
  
  const mockService = new MockOCRService();
  
  console.log('\n--- ID Card Recto ---');
  const idCardData = mockService.generateMockData('Traditional ID', 'recto');
  console.log('Fields:', Object.keys(idCardData));
  console.log('surname:', idCardData.surname);
  console.log('givenNames:', idCardData.givenNames);
  console.log('birthDate:', idCardData.birthDate);
  
  console.log('\n--- Passport Recto ---');
  const passportData = mockService.generateMockData('Passport', 'recto');
  console.log('Fields:', Object.keys(passportData));
  console.log('surname:', passportData.surname);
  console.log('givenNames:', passportData.givenNames);
  console.log('birthDate:', passportData.birthDate);
  console.log('passportNumber:', passportData.passportNumber);
  console.log('nationality:', passportData.nationality);
  
  console.log('\n--- Passport with different case ---');
  const passportData2 = mockService.generateMockData('passport', 'recto');
  console.log('Fields:', Object.keys(passportData2));
  console.log('Data:', passportData2);
}

debugMockData();
