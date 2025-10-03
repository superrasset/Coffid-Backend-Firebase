const jwt = require('jsonwebtoken');

// Token utilisé dans le test (sans la signature pour décoder)
const token = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IncxVEVHZU0xMDRLaDBNeWtGRXZYeCJ9.eyJpc3MiOiJodHRwczovL2JsdWVsb2NrZXIuZXUuYXV0aDAuY29tLyIsInN1YiI6IjY3TThJZHVYZFNZUVpPeXNWMHhodmVodERqUjk3Zm9BQGNsaWVudHMiLCJhdWQiOiJodHRwczovL2NvZmZpZC5jb20vYXBpIiwiaWF0IjoxNzU5NDk3NDY1LCJleHAiOjE3NTk1ODM4NjUsInNjb3BlIjoiaWRlbnRpdHk6Z2VuZXJhdGUgc3RhdHVzOnJlYWQiLCJndHkiOiJjbGllbnQtY3JlZGVudGlhbHMiLCJhenAiOiI2N004SWR1WGRTWVFaT3lzVjB4aHZlaHREalI5N2ZvQSJ9.B2rcUlmEdN2UM_5aYGhPzPWTdoCmreFq5jL7xZ2KIDYfKaVwNGOOSn3S78TO6LprDztE_slQDxc5YDbalOxrysefyDI5yecBQygXiok_A6aqcmbhPDEz0xqgGCnKhSIof56VsNDMYHvGMK9a_eOMR5ar6eHXu1MFocbbS05U9eiiA8AUVwGissNifzgN3TbdlJ27ydAif9BtJifE-apEappVinRelzEY27qxyHjtfMQQfOciurgTD2rze1yAtoxsyd419g0Wge0fDD6krvyMYTEOGx5EvrUxCLfrvLjjWR8ttNTuE72mdRE74hgvXpp3YMjx1ndZbF6GFTduf4IiiQ";

try {
    // Décoder le token sans vérifier la signature (pour debug)
    const decoded = jwt.decode(token, { complete: true });
    
    console.log("=== HEADER ===");
    console.log(JSON.stringify(decoded.header, null, 2));
    
    console.log("\n=== PAYLOAD ===");
    console.log(JSON.stringify(decoded.payload, null, 2));
    
    console.log("\n=== ANALYSE POUR LOGGING ===");
    const payload = decoded.payload;
    
    // Vérifier client_id
    console.log("azp (client_id):", payload.azp);
    console.log("aud:", payload.aud);
    console.log("sub:", payload.sub);
    
    // Vérifier metadata
    console.log("\nMetadata disponibles:");
    Object.keys(payload).forEach(key => {
        if (key.includes('metadata') || key.includes('coffid') || key.includes('stripe')) {
            console.log(`${key}:`, payload[key]);
        }
    });
    
} catch (error) {
    console.error("Erreur lors du décodage:", error);
}