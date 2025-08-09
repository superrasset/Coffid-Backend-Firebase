/**
 * Universal Link Utility for Coffid App
 * Handles deep linking with fallback to web pages
 */

class CoffidUniversalLink {
    constructor() {
        this.baseURL = 'https://coffid-app-firebase.web.app';
        this.appScheme = 'coffid://';
        this.iosAppId = 'YOUR_APP_ID'; // Replace with actual App Store ID
        this.androidPackage = 'com.yourcompany.coffid'; // Replace with actual package name
    }

    /**
     * Generate a Universal Link with fallback
     * @param {string} path - The deep link path (e.g., 'verify/session123')
     * @param {Object} params - Additional parameters
     * @param {string} lang - Language preference ('fr' or 'en')
     * @returns {string} The Universal Link URL
     */
    generateLink(path = '', params = {}, lang = 'fr') {
        const fallbackPage = lang === 'en' ? '/app-en' : '/app';
        const url = new URL(this.baseURL + fallbackPage);
        
        // Add the deep link path as a parameter
        if (path) {
            url.searchParams.set('path', path);
        }
        
        // Add additional parameters
        Object.keys(params).forEach(key => {
            url.searchParams.set(key, params[key]);
        });
        
        return url.toString();
    }

    /**
     * Generate a QR code friendly link for identity verification
     * @param {string} sessionId - The verification session ID
     * @param {string} lang - Language preference
     * @returns {string} The Universal Link URL
     */
    generateVerificationLink(sessionId, lang = 'fr') {
        return this.generateLink('verify', { session: sessionId }, lang);
    }

    /**
     * Generate a document check link
     * @param {string} documentId - The document check ID
     * @param {string} lang - Language preference
     * @returns {string} The Universal Link URL
     */
    generateDocumentLink(documentId, lang = 'fr') {
        return this.generateLink('document', { id: documentId }, lang);
    }

    /**
     * Open the app or fallback to store/web
     * Client-side function to attempt opening the app
     * @param {string} deepLinkUrl - The deep link URL
     * @param {Object} options - Options for fallback behavior
     */
    static openApp(deepLinkUrl, options = {}) {
        const {
            fallbackDelay = 2000,
            onAppOpened = () => {},
            onFallback = () => {}
        } = options;

        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
        const isAndroid = /android/i.test(userAgent);
        const isMobile = isIOS || isAndroid;

        if (!isMobile) {
            // Desktop - redirect to web version
            window.location.href = deepLinkUrl;
            return;
        }

        const startTime = Date.now();
        let appOpened = false;

        // Track if user leaves the page (likely opened the app)
        const handleVisibilityChange = () => {
            if (document.hidden && !appOpened) {
                appOpened = true;
                onAppOpened();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleVisibilityChange);

        // Attempt to open the app
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = deepLinkUrl.replace('https://coffid-app-firebase.web.app', 'coffid://');
        document.body.appendChild(iframe);

        // Fallback after delay
        setTimeout(() => {
            if (!appOpened) {
                onFallback();
                // Redirect to the fallback page which will show store links
                window.location.href = deepLinkUrl;
            }
            // Clean up
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleVisibilityChange);
            if (iframe.parentNode) {
                iframe.parentNode.removeChild(iframe);
            }
        }, fallbackDelay);
    }

    /**
     * Get store URLs for the app
     * @returns {Object} Object with iOS and Android store URLs
     */
    getStoreUrls() {
        return {
            ios: `https://apps.apple.com/app/coffid/id${this.iosAppId}`,
            android: `https://play.google.com/store/apps/details?id=${this.androidPackage}`
        };
    }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = CoffidUniversalLink;
} else if (typeof window !== 'undefined') {
    // Browser environment
    window.CoffidUniversalLink = CoffidUniversalLink;
}

// Example usage:
/*
const linkGenerator = new CoffidUniversalLink();

// Generate a verification link for QR code
const qrLink = linkGenerator.generateVerificationLink('session123', 'fr');
console.log('QR Code Link:', qrLink);
// Output: https://coffid-app-firebase.web.app/app?path=verify&session=session123

// Client-side: Attempt to open the app with fallback
CoffidUniversalLink.openApp(qrLink, {
    onAppOpened: () => console.log('App opened successfully'),
    onFallback: () => console.log('App not installed, showing fallback')
});
*/
