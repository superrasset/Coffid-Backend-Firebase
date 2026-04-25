# API Key Authentication Architecture

## Vue d'ensemble

Ce système implémente une authentification unifiée supportant **Auth0 JWT** (existant) et **API Keys** (nouveau) pour simplifier l'intégration client.

## Architecture

### Composants

1. **Middleware d'authentification** (`src/auth/authMiddleware.js`)
   - Détecte automatiquement le type d'authentification (Auth0 ou API Key)
   - Normalise les métadonnées dans `req.authContext`
   - Valide les scopes/permissions

2. **APIs de gestion** (`src/apiKeys/manageApiKeys.js`)
   - `storeApiKey`: Stocke une nouvelle clé (appelée par coffid-business)
   - `revokeApiKey`: Révoque une clé existante

3. **Collection Firestore** `apiKeys`
   - Stocke les hashs SHA256 des clés (jamais en clair)
   - Index composite sur `hash` + `status` pour validation rapide

### Flow d'authentification

```
Requête entrante
    ↓
Middleware détecte X-API-Key OU Authorization Bearer
    ↓
Validation (hash dans Firestore OU JWT Auth0)
    ↓
req.authContext peuplé avec métadonnées uniformes
    ↓
Vérification des scopes
    ↓
Logique métier (generateQrCode, getProcessStatus, etc.)
```

## Utilisation

### Pour les clients (coffid-business)

#### 1. Créer une API Key

**Endpoint**: `POST https://storeApiKey-xxx.cloudfunctions.net/`

**Headers**:
```
Authorization: Bearer <INTERNAL_API_SECRET>
Content-Type: application/json
```

**Body**:
```json
{
  "api_key_hash": "sha256_of_generated_key",
  "customer_id": "cus_xxxxx",
  "subscription_id": "sub_xxxxx",
  "organization_id": "org_xxxxx",
  "organization_name": "Acme Corp",
  "display_name": "Acme - Production API",
  "scopes": ["identity:generate", "identity:status", "status:read"],
  "metadata": {
    "created_by": "user@example.com"
  }
}
```

**Response**:
```json
{
  "success": true,
  "key_id": "abc123xyz",
  "created_at": "2026-04-25T10:30:00Z"
}
```

#### 2. Révoquer une API Key

**Endpoint**: `POST https://revokeApiKey-xxx.cloudfunctions.net/`

**Headers**:
```
Authorization: Bearer <INTERNAL_API_SECRET>
Content-Type: application/json
```

**Body** (option 1 - par hash):
```json
{
  "api_key_hash": "sha256_of_key"
}
```

**Body** (option 2 - par ID):
```json
{
  "key_id": "abc123xyz"
}
```

**Response**:
```json
{
  "success": true,
  "key_id": "abc123xyz",
  "revoked_at": "2026-04-25T11:00:00Z"
}
```

### Pour les utilisateurs finaux

#### Utiliser une API Key

**Option 1: Header X-API-Key** (recommandé)
```bash
curl -H "X-API-Key: coffid_live_abc123xyz" \
  "https://generateqrcode-xxx.cloudfunctions.net/?q=majority"
```

**Option 2: Auth0 JWT** (existant, toujours supporté)
```bash
curl -H "Authorization: Bearer eyJhbGciOi..." \
  "https://generateqrcode-xxx.cloudfunctions.net/?q=majority"
```

## Scopes / Permissions

### Scopes disponibles

- `identity:generate` : Créer des requêtes de vérification (generateQrCode)
- `identity:status` : Consulter le statut des vérifications (getProcessStatus)
- `status:read` : Alias pour compatibilité Auth0 (équivalent à identity:status)

### Scopes par défaut pour les API Keys

Toutes les API Keys créées ont automatiquement tous les scopes :
```javascript
['identity:generate', 'identity:status', 'status:read']
```

## Sécurité

### Stockage des clés

- **Jamais en clair** : Seul le hash SHA256 est stocké
- **Status** : Les clés révoquées ne peuvent plus être utilisées instantanément
- **Last used** : Tracking de la dernière utilisation pour audit

### Protection des APIs internes

Les APIs `storeApiKey` et `revokeApiKey` sont protégées par un **secret partagé** :

```javascript
// Dans Secret Manager
INTERNAL_API_SECRET=<secret_fort_aléatoire>
```

Seul coffid-business doit connaître ce secret.

### Génération des clés (côté coffid-business)

```javascript
// 1. Générer une clé aléatoire
const apiKey = `coffid_live_${randomBytes(32).toString('hex')}`;

// 2. Calculer le hash
const hash = crypto.createHash('sha256').update(apiKey).digest('hex');

// 3. Afficher la clé UNE FOIS à l'utilisateur
console.log('⚠️ Save this key, it will not be shown again:', apiKey);

// 4. Stocker le hash via l'API
await storeApiKey(hash, metadata);

// 5. Ne JAMAIS stocker la clé en clair
```

## Migration depuis Auth0

### Phase 1 : Déploiement (✅ Fait)
- Middleware déployé avec support des deux méthodes
- APIs storeApiKey/revokeApiKey disponibles
- Aucun impact sur les clients Auth0 existants

### Phase 2 : Onboarding (En cours)
- coffid-business UI pour générer des API Keys
- Nouveaux clients utilisent API Keys
- Anciens clients continuent avec Auth0

### Phase 3 : Migration (Optionnel)
- Proposer aux clients Auth0 de migrer vers API Keys
- Simplification du workflow (plus besoin de M2M apps)

## Structure des données

### Collection `apiKeys`

```javascript
{
  hash: "sha256_abc123...",
  customer_id: "cus_xxxxx",
  subscription_id: "sub_xxxxx", 
  organization_id: "org_xxxxx",
  organization_name: "Acme Corp",
  display_name: "Acme - Production API",
  scopes: ["identity:generate", "identity:status", "status:read"],
  status: "active", // ou "revoked"
  created_at: Timestamp,
  last_used_at: Timestamp,
  revoked_at: Timestamp | null,
  metadata: {}
}
```

### Index Firestore

```json
{
  "collectionGroup": "apiKeys",
  "fields": [
    { "fieldPath": "hash", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" }
  ]
}
```

## req.authContext (format unifié)

```javascript
{
  method: 'auth0' | 'apikey',
  customer_id: 'cus_xxxxx',
  subscription_id: 'sub_xxxxx',
  organization_id: 'org_xxxxx',
  organization_name: 'Acme Corp',
  display_name: 'Acme Corp',
  client_id: 'abc123', // Pour le logging
  scopes: ['identity:generate', 'identity:status', 'status:read'],
  metadata: {},
  key_id: 'abc123' // Uniquement pour les API Keys
}
```

## Endpoints modifiés

Les endpoints suivants supportent maintenant les deux méthodes d'authentification :

- ✅ `generateQrCode` (POST /generateQrCode)
- ✅ `getProcessStatus` (GET /getProcessStatus)

## Déploiement

### Prérequis

1. Créer le secret `INTERNAL_API_SECRET` :
```bash
firebase functions:secrets:set INTERNAL_API_SECRET
```

2. Déployer les index Firestore :
```bash
firebase deploy --only firestore:indexes
```

3. Déployer les fonctions :
```bash
firebase deploy --only functions
```

### Variables d'environnement

- `INTERNAL_API_SECRET` : Secret partagé pour les APIs internes (Secret Manager)

## Monitoring & Logs

### Logs clés

- `🔑 Validating API key` : Validation d'une API Key
- `✅ API key validated` : Clé valide trouvée
- `❌ API key not found or revoked` : Clé invalide/révoquée
- `📝 Updated last_used_at` : Mise à jour du dernier usage
- `📝 Storing API key` : Création d'une nouvelle clé
- `🔒 Revoking API key` : Révocation d'une clé

### Métriques à surveiller

- Taux d'erreur 401 (clés invalides)
- Latence de validation des API Keys
- Nombre de clés actives vs révoquées
- Fréquence d'utilisation par clé (via `last_used_at`)

## Troubleshooting

### Erreur 401 "Invalid API key"

- Vérifier que la clé n'est pas révoquée (status = 'active')
- Vérifier le hash SHA256
- Vérifier l'index Firestore sur (hash, status)

### Erreur 403 "Forbidden: Invalid internal secret"

- Le secret `INTERNAL_API_SECRET` ne correspond pas
- Vérifier que le secret est bien déployé dans Secret Manager

### Erreur 403 "Insufficient permissions"

- Vérifier que le scope requis est dans `authContext.scopes`
- Pour Auth0 : vérifier les scopes du token JWT
- Pour API Key : vérifier les scopes stockés dans Firestore

## Tests

### Tester avec une API Key

```bash
# 1. Créer une clé de test
KEY="coffid_test_$(openssl rand -hex 16)"
HASH=$(echo -n "$KEY" | shasum -a 256 | awk '{print $1}')

# 2. Stocker via l'API (avec INTERNAL_API_SECRET)
curl -X POST https://storeApiKey-xxx.cloudfunctions.net/ \
  -H "Authorization: Bearer $INTERNAL_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "api_key_hash": "'$HASH'",
    "customer_id": "cus_test",
    "organization_id": "org_test",
    "organization_name": "Test Org",
    "display_name": "Test Org - Development"
  }'

# 3. Tester generateQrCode
curl -H "X-API-Key: $KEY" \
  "https://generateqrcode-xxx.cloudfunctions.net/?q=majority"

# 4. Tester getProcessStatus
curl -H "X-API-Key: $KEY" \
  "https://getprocessstatus-xxx.cloudfunctions.net/?task_id=<task_id>"
```

## Ressources

- Code source : `/functions/src/auth/authMiddleware.js`
- APIs internes : `/functions/src/apiKeys/manageApiKeys.js`
- Endpoints modifiés :
  - `/functions/src/qr/generateQrCodeAuth0.js`
  - `/functions/src/status/getProcessStatusAuth0.js`
