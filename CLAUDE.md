# Plan d'intégration Web App React + Backend Firebase

## Contexte produit

Coffid est une application mobile KYC qui permet à des plateformes (clients B2B) de vérifier l'identité de leurs utilisateurs via appel API. Le client génère un QR code, l'utilisateur le scanne, complète un parcours de vérification (scan ID + selfie face match), et la plateforme récupère les données vérifiées via polling.

**Problème résolu ici** : Les utilisateurs qui n'ont pas l'app mobile installée ne peuvent pas compléter le parcours. On crée une web app mobile qui reproduit le même parcours KYC directement dans le navigateur.

---

## Architecture globale

```
Client (entreprise)          Backend Firebase          User (mobile browser)
      │                            │                         │
      │──GET /api/identity-check──→│                         │
      │   (génère QR + task_id)     │                         │
      │                            │                         │
      │                            │←──Scan QR code─────────│
      │                            │                         │
      │                            │   App installée:        │
      │                            │   → Universal Link      │
      │                            │   → Ouvre app native ✅  │
      │                            │                         │
      │                            │   App non installée:    │
      │                            │   → Charge React Web App│
      │                            │   → signInAnonymously() │
      │                            │   → SDK direct Firestore│
      │                            │                         │
      │                            │←──Upload Storage SDK────│
      │                            │←──Write uploadedDocument│
      │                            │   (trigger OCR + face)  │
      │                            │                         │
      │──GET /api/check-status────→│                         │
      │←──result: {data}───────────│                         │
```

---

## Stack technique

| Composant | Choix | Raison |
|-----------|-------|--------|
| Web app framework | **React (Vite)** | Bundle léger mobile (~200kb vs ~5MB Flutter Web), meilleur accès caméra natif |
| Auth web | **Firebase Anonymous Auth** | Même projet Firebase, accès direct Firestore/Storage |
| Firestore | **Firebase JS SDK direct** | Identique à l'app mobile (pas de backend intermédiaire) |
| Storage | **Firebase Storage JS SDK direct** | Upload direct depuis le browser |
| Backend | **Aucune modification V1** | Le pipeline existant est réutilisé tel quel |
| OCR | **Mindee (existant)** | Déclenché via Firestore trigger sur `uploadedDocument` |
| Face match | **AWS Rekognition (existant)** | Déclenché via Firestore trigger sur `uploadedDocument` |

---

## Principe clé : même accès Firebase que l'app mobile

L'app mobile accède à Firestore **directement via SDK**, pas via le backend :

```dart
// Ce que fait l'app mobile
FirebaseFirestore.instance
    .collection('pendingRequest')
    .doc(taskId)
    .get()
```

La web app fait exactement pareil en JS :

```javascript
// Ce que fait la web app
import { doc, getDoc } from 'firebase/firestore'
const snap = await getDoc(doc(db, 'pendingRequest', taskId))
```

Les règles Firestore autorisent tout utilisateur authentifié (y compris anonyme) à lire `pendingRequest` :

```
match /pendingRequest/{requestId} {
  allow read, write, create: if request.auth != null;
}
```

**Conséquence : aucun nouvel endpoint backend nécessaire pour la V1.**

---

## Authentification anonyme

```javascript
// Dès l'arrivée sur la web app
import { signInAnonymously } from 'firebase/auth'
const { user } = await signInAnonymously(auth)
const anonymousUid = user.uid
// Toutes les données uploadées référencent cet anonymousUid
```

Le linking anonymous → compte mobile (après téléchargement de l'app) est prévu en **V2**.

---

## Flow utilisateur complet

### Étape 1 : Arrivée sur le lien
```
User scanne QR → https://api.coffid.com/identity-check/{taskId}
                          ↓
                 L'OS vérifie Universal Links
                          ↓
        App installée? ──YES──→ Ouvre app native ✅
              │
             NO
              ↓
        app.html redirige vers /web-app/?task_id={taskId}
        React app charge → signInAnonymously() → lit pendingRequest/{taskId}
```

### Étape 2 : Écran d'accueil
```
┌─────────────────────────────────────┐
│ Télécharger Coffid                 │ ← Bandeau persistant
│   [App Store]  [Google Play]   [X] │
├─────────────────────────────────────┤
│       [Logo Coffid]                 │
│                                     │
│  "Acme Corp" demande votre :        │
│  • Nom de famille                   │
│  • Prénom                           │
│                                     │
│  [Scanner ma carte d'identité]      │ ← Primary button
│  [Scanner mon passeport]            │ ← Secondary button
│                                     │
└─────────────────────────────────────┘
```

### Étape 3 : Capture documents (caméra)
```
getUserMedia({ video: { facingMode: 'environment' } })
→ Preview temps réel
→ Capture recto → upload Firebase Storage
→ Capture verso (si ID) → upload Firebase Storage
→ Write doc dans uploadedDocument → trigger OCR automatique
```

### Étape 4 : Capture selfie
```
getUserMedia({ video: { facingMode: 'user' } })
→ Preview caméra frontale
→ Capture → upload Firebase Storage
→ Write doc dans uploadedDocument (side: 'selfie') → trigger face match automatique
```

### Étape 5 : Confirmation
```
┌─────────────────────────────────────┐
│  ✅ Vérification envoyée            │
│                                     │
│  Vos documents ont été transmis     │
│  à "Acme Corp"                      │
│                                     │
│  [Télécharger l'app Coffid]         │
└─────────────────────────────────────┘
```

---

## Données écrites par la web app

### `uploadedDocument` (déclenche le pipeline existant)
```javascript
{
  userId: anonymousUid,           // Firebase anonymous UID
  taskId: taskId,                 // ID du pendingRequest
  documentType: "id" | "passport",
  side: "recto" | "verso" | "selfie",
  imageUrl: "gs://coffid-2388b.firebasestorage.app/identity-documents/{taskId}/{side}.jpg",
  status: "pending",
  createdAt: serverTimestamp()
}
```

### `pendingRequest` (mise à jour userId)
```javascript
// Une fois que l'user démarre le parcours
await updateDoc(doc(db, 'pendingRequest', taskId), {
  userId: anonymousUid,
  status: 'in_progress'
})
```

---

## Charte graphique (issue de coffid-app)

Repo de référence : `/Users/alexandrerassetm1/Coffid/coffid-app/lib/design_system/`

### Couleurs
```css
--color-primary: #1F5ECC;
--color-secondary: #26304F;
--color-primary-light: #D1DEED;
--color-bg-app: #F8FAFE;
--color-surface: #FFFFFF;
--color-surface-secondary: #F5F7FA;
--color-text-primary: #26304F;
--color-text-secondary: #6B7280;
--color-text-disabled: #9CA3AF;
--color-success: #10B981;
--color-warning: #F59E0B;
--color-error: #EF4444;
--color-border: #E5E7EB;
```

### Typographie (system font)
- h1 : 32px / 700 | h2 : 24px / 600 | h3 : 20px / 600
- body : 16px / 400 | small : 14px / 400 | caption : 12px / 400

### Spacing (base 4px)
```
xs:4 | sm:8 | md:12 | lg:16 | xl:20 | xxl:24 | xxxl:32 | page:20px
```

### Border radius
```
input: 8px | button: 16px | card: 24px
```

### Boutons
- **Primary** : bg `#1F5ECC`, texte blanc, radius 16px, hauteur 56px
- **Secondary** : bg `#26304F`, texte blanc
- **Outline** : border `#1F5ECC` 20% opacity, texte primary

### Assets à copier depuis coffid-app
```
/assets/images/logo.png
/assets/images/id_upload_illustrations/photo-recto.png (@2x @3x)
/assets/images/id_upload_illustrations/photo-verso.png (@2x @3x)
/assets/images/id_upload_illustrations/selfie.png (@2x @3x)
/assets/images/passport_upload_illustrations/passport_upload.png (@2x @3x)
/assets/images/passport_upload_illustrations/selfie.png (@2x @3x)
```

---

## Structure projet React

```
coffid-web/
├── src/
│   ├── main.jsx
│   ├── firebase.js                 # Config Firebase projet coffid-2388b
│   ├── screens/
│   │   ├── WelcomeScreen.jsx       # Accueil + choix document
│   │   ├── CaptureScreen.jsx       # Capture caméra (recto/verso/passeport)
│   │   ├── SelfieScreen.jsx        # Capture selfie
│   │   ├── ProcessingScreen.jsx    # Loading pendant OCR
│   │   └── ConfirmationScreen.jsx  # Fin + download CTA
│   ├── components/
│   │   ├── DownloadBanner.jsx      # Bandeau persistant App Store / Play Store
│   │   ├── StepIndicator.jsx       # Indicateur de progression
│   │   ├── CameraPreview.jsx       # Preview + capture getUserMedia
│   │   └── AppButton.jsx           # Bouton avec variants (primary/secondary/outline)
│   ├── services/
│   │   ├── firestoreService.js     # Lecture pendingRequest, écriture uploadedDocument
│   │   └── storageService.js       # Upload Firebase Storage
│   └── styles/
│       └── tokens.css              # CSS custom properties (design tokens)
├── public/
│   └── assets/                     # Illustrations copiées depuis coffid-app
├── index.html
├── vite.config.js
└── package.json
```

---

## Déploiement

### Build et intégration
```bash
# Dans coffid-web/
npm run build

# Copier le build dans Firebase Hosting
cp -r dist/* ../BackEnd-Firebase/public/web-app/

# Déployer
cd ../BackEnd-Firebase
firebase deploy --only hosting
```

### Modification app.html (à faire côté backend)
`app.html` doit détecter si l'app est installée (Universal Links) et sinon rediriger vers `/web-app/?task_id={taskId}`.

### Structure Firebase Hosting
```
public/
├── .well-known/          # Universal Links (existant, inchangé)
├── app.html              # Redirect iOS/Android → à modifier
├── web-app/              # Build React (à créer)
│   └── index.html
└── apk/                  # APK Android (existant, inchangé)
```

---

## Backend : aucune modification V1

Le backend **n'a pas besoin d'être modifié** pour la V1 de la web app. La plateforme cliente continue de poll `/api/check-status` sans aucun changement.

---

## Roadmap

### V1 (en cours)
- [x] Auth API Key + QR generation
- [x] OCR pipeline (Mindee)
- [x] Face match (AWS Rekognition)
- [ ] Modifier `app.html` pour redirect vers web app
- [ ] React web app (parcours KYC complet)

### V2 (futur)
- [ ] Linking anonymous → compte mobile (Android Play Install Referrer, iOS à définir)
- [ ] Webhooks au lieu de polling
- [ ] PWA installable

---

*Dernière mise à jour : 26 avril 2026*
