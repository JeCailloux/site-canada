# 🍁 Caribou — le tricount du crew pour le Canada

Site 100% statique (HTML / CSS / JS, zéro serveur, zéro base de données) :
il s'héberge **gratuitement** partout, en 2 minutes.

## Lancer en local

Double-clique sur `index.html`, ou pour éviter tout souci de navigateur :

```
cd caribou
python -m http.server 8000
```

puis ouvre http://localhost:8000

## Héberger gratuitement (au choix)

| Option | Comment | Durée |
|---|---|---|
| **Netlify Drop** (le plus simple) | Va sur https://app.netlify.com/drop et glisse-dépose le dossier `caribou` | ~1 min |
| **GitHub Pages** | Push le dossier dans un repo → Settings → Pages → branche `main` | ~3 min |
| **Vercel** | https://vercel.com/new → importe le repo ou le dossier | ~2 min |

Aucune configuration nécessaire : c'est du statique pur.

## Comptes par défaut

| Compte | Mot de passe |
|---|---|
| Bastien | poutine2026 |
| Léo | sirop2026 |
| Simon | orignal2026 |
| Axel | castor2026 |

👉 **Tout se personnalise dans [`js/config.js`](js/config.js)** : prénoms, mots de passe,
couleurs, nom du voyage, date de départ (compte à rebours), taux EUR→CAD.
⚠️ Ne change pas les `id` une fois que des dépenses existent.

## Connexion "une fois pour toutes"

À la première connexion, une session est enregistrée en `localStorage` **et** dans un
cookie de 400 jours (le maximum autorisé par les navigateurs). Tant que tu ne cliques
pas sur "Se déconnecter" et que tu ne vides pas les données du navigateur, tu restes
connecté.

## Fonctionnalités

- 🔐 Login à 4 comptes, session persistante
- 💸 Dépenses en $ CAD ou € EUR (conversion automatique, taux réglable)
- 👥 Payeur + participants au choix (partage égal entre participants)
- 🏷️ 8 catégories avec stats
- ⚖️ Soldes en temps réel + **remboursements optimisés** (minimum de virements)
- 📊 Onglet **Stats** : camembert par catégorie, courbe du total cumulé, podium des
  payeurs, records (plus grosse dépense, journée la plus chère, rythme de perte…)
- 📤 Export / 📥 import JSON pour synchroniser les comptes entre potes
- 🌌 Fond 3D animé : aurores boréales, montagnes low-poly, neige (Three.js)
- 🦌 Vidéo du caribou qui court (générée avec VEO) en fond de l'écran d'accueil,
  fondue dans la scène 3D avec une boucle invisible (`assets/caribou.mp4`)

## ⚠️ Limite à connaître (et comment la contourner)

Le site étant statique, **les données restent dans le navigateur de chacun** :
si Bastien ajoute une dépense sur son téléphone, Léo ne la voit pas automatiquement.

Deux solutions :

1. **Simple** : une seule personne tient les comptes (le "trésorier" du voyage), et
   partage l'écran / exporte le fichier de temps en temps.
2. **Export / import** : Réglages → Exporter → envoie le fichier `.json` sur le groupe
   WhatsApp → chacun fait Réglages → Importer. L'import **fusionne** sans doublons,
   donc chacun peut ajouter ses dépenses et on peut croiser les fichiers.

Si un jour vous voulez une vraie synchro temps réel, il suffira de brancher un backend
gratuit (Supabase ou Firebase) — la structure des données est déjà prête pour ça.
