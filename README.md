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

## ☁️ Synchro temps réel (Firebase Firestore)

Le site est branché sur une base **Firestore** (gratuite) : les dépenses se
synchronisent en temps réel entre tous les appareils, avec cache hors-ligne
(ça marche sans réseau, ça repart tout seul à la reconnexion).

### Activation (une seule fois, dans la console Firebase)

Console Firebase → projet → **Firestore Database** → onglet **Règles** →
remplace tout par ceci → **Publier** :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /trips/canada-2026-vx4k7p {
      allow read, write: if true;
      match /expenses/{expenseId} {
        allow read, write: if true;
      }
    }
  }
}
```

> Le chemin `canada-2026-vx4k7p` doit correspondre au `tripId` de `js/config.js`.
> Ces règles n'ouvrent QUE le document du voyage (le suffixe aléatoire fait office
> de mot de passe d'accès à la base). Pour couper la synchro : `firebase: null`
> dans `js/config.js` → l'app repasse en mode 100% local, sans rien casser.

L'état de la synchro est affiché dans **Réglages → Synchronisation**.
L'export / import JSON reste disponible en secours (sauvegardes).
