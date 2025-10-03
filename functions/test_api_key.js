const { defineString } = require('firebase-functions/params');

// Test de la variable d'environnement
const BUSINESS_API_KEY = defineString('BUSINESS_API_KEY');

console.log('BUSINESS_API_KEY value:', BUSINESS_API_KEY.value());
console.log('Expected value: coffid-internal-logging-key-2025');

// Test simple
if (BUSINESS_API_KEY.value() === 'coffid-internal-logging-key-2025') {
    console.log('✅ BUSINESS_API_KEY is correctly configured!');
} else {
    console.log('❌ BUSINESS_API_KEY has wrong value:', BUSINESS_API_KEY.value());
}