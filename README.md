# Goths.lol Site

Site statique pour goths.lol avec pages de redirection.

## Pages
- `index.html` : Page d'accueil avec liens vers @ey et @ev
- `ey.html` : Redirection vers https://guns.lol/purrw
- `me.html` : Redirection vers https://guns.lol/iev

## Déploiement sur Netlify

1. Crée un nouveau repo GitHub pour ce site.
2. Pousse tous les fichiers de ce dossier vers le repo.
3. Connecte le repo à Netlify :
   - Va sur https://app.netlify.com/
   - "New site from Git"
   - Choisis ton repo
   - Build command : laisse vide ou `echo 'No build'`
   - Publish directory : `.`
4. Configure le domaine :
   - Dans Netlify, va dans Site settings > Domain management
   - Ajoute goths.lol comme domaine personnalisé
   - Suis les instructions pour configurer les DNS (probablement chez OVH où tu as acheté le domaine)

## Assets
Les assets sont dans `attached_assets/` : favicon, images, etc.

## Notes
- Les redirections utilisent des URLs externes (guns.lol)
- Le site est statique, pas de build nécessaire