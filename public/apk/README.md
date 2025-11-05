# APK Directory

Ce dossier contient les fichiers APK de l'application Coffid pour Android.

## Structure recommandée :
- `coffid-latest.apk` - Version la plus récente (lien symbolique ou copie)
- `coffid-v1.0.0.apk` - Versions spécifiques
- `coffid-v1.0.1.apk`
- etc.

## Déploiement :
1. Placez le fichier APK dans ce dossier
2. Renommez-le ou créez un lien symbolique vers `coffid-latest.apk`
3. Déployez avec `firebase deploy --only hosting`

## Configuration du serveur :
Les fichiers APK seront servis avec le bon Content-Type (application/vnd.android.package-archive) automatiquement par Firebase Hosting.