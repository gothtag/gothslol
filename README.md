# Goths.lol Site

Site statique + Netlify Functions pour synchroniser automatiquement les avatars Discord de `ev` et `ey` sans bot.

## Pages
- `index.html` : page d'accueil + chargement dynamique des avatars via `/.netlify/functions/discord-avatars`
- `ey.html` : redirection profil
- `ev.html` : redirection profil

## Fonctions Netlify ajoutées
- `netlify/functions/discord-auth-start.js`
  - Génère l'URL OAuth Discord (`identify`) pour lier `ev` ou `ey`
- `netlify/functions/discord-callback.js`
  - Reçoit le callback OAuth, échange le `code`, affiche le `refresh_token` à copier dans Netlify
- `netlify/functions/discord-avatars.js`
  - Utilise les refresh tokens pour récupérer les avatars Discord en live

## 1) Créer l'app Discord (Developer Portal)
1. Ouvre https://discord.com/developers/applications
2. Clique sur **New Application**
3. Nom: `goths.lol` (ou ce que tu veux)
4. Va dans **OAuth2 > General**
5. Ajoute Redirect URL:
   - `https://goths.lol/.netlify/functions/discord-callback`
   - (en local optionnel) `http://localhost:8888/.netlify/functions/discord-callback`
6. Récupère:
   - `CLIENT ID`
   - `CLIENT SECRET`

## 2) Variables d'environnement Netlify
Dans Netlify > Site settings > Environment variables, ajoute:

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI` = `https://goths.lol/.netlify/functions/discord-callback`
- `DISCORD_EV_USER_ID` (optionnel mais recommandé)
- `DISCORD_EY_USER_ID` (optionnel mais recommandé)
- `DISCORD_EV_REFRESH_TOKEN` (obtenu après liaison OAuth)
- `DISCORD_EY_REFRESH_TOKEN` (obtenu après liaison OAuth)

## 3) Lier les comptes `ev` et `ey` (sans bot)
Après déploiement:

- `https://goths.lol/.netlify/functions/discord-auth-start?slot=ev&redirect=1`
- `https://goths.lol/.netlify/functions/discord-auth-start?slot=ey&redirect=1`

Chaque lien ouvre Discord auth. Après validation, la page callback affiche les variables à copier:
- `DISCORD_EV_REFRESH_TOKEN` / `DISCORD_EY_REFRESH_TOKEN`
- `DISCORD_EV_USER_ID` / `DISCORD_EY_USER_ID`

Ensuite, mets à jour les variables Netlify puis **redeploy**.

## 4) Déploiement Netlify
`netlify.toml` est déjà prêt:
- publish: `.`
- functions dir: `netlify/functions`

## Notes importantes
- Pas de bot Discord requis.
- Si Discord invalide/rotate un refresh token, refais le lien OAuth du slot concerné et remplace la variable.
- Le site garde les images locales en fallback si l'API avatars échoue.