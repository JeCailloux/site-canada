/* ============================================================
   CARIBOU — CONFIG DU VOYAGE
   C'est ICI que tu personnalises tout : noms, mots de passe,
   couleurs, nom du voyage, date de départ, taux de change.
   ============================================================ */

window.CARIBOU_CONFIG = {

  // Nom du voyage (affiché dans l'app)
  tripName: "Canada 2026",

  // Petite phrase sur l'écran de connexion
  tagline: "Le tricount du crew pour le Canada. Qui paie la poutine ?",

  // Date de départ (format AAAA-MM-JJ) — affiche un compte à rebours "J-42".
  // Mets null si tu ne veux pas de compte à rebours.
  startDate: "2026-08-01",

  // Taux par défaut : 1 EUR = X CAD (modifiable ensuite dans Réglages)
  eurToCadDefault: 1.48,

  // ---- SYNCHRO CLOUD (Firebase Firestore) ----
  // Identifiant du voyage dans la base (le suffixe aléatoire évite les curieux).
  // Ne pas le changer une fois les comptes lancés.
  tripId: "canada-2026-vx4k7p",
  // Mets `firebase: null` pour revenir au mode 100% local (sans synchro).
  firebase: {
    apiKey: "AIzaSyBHAqKSxw7DD9dhcFeZ2xkngYQlLFX0vlA",
    authDomain: "caribuo-dabda.firebaseapp.com",
    projectId: "caribuo-dabda",
    storageBucket: "caribuo-dabda.firebasestorage.app",
    messagingSenderId: "689372314202",
    appId: "1:689372314202:web:49aec0de6acd58e66db663"
  },

  // ---- LES 4 COMPTES ----
  // id      : identifiant technique (ne pas changer une fois des dépenses créées)
  // name    : prénom affiché
  // password: mot de passe de connexion
  // color   : couleur de l'avatar (n'importe quel code hex)
  accounts: [
    { id: "bastien", name: "Bastien", password: "poutine2026", color: "#F59E0B" },
    { id: "leo",     name: "Léo",     password: "sirop2026",   color: "#34D399" },
    { id: "simon",   name: "Simon",   password: "orignal2026", color: "#A78BFA" },
    { id: "axel",    name: "Axel",    password: "castor2026",  color: "#38BDF8" }
  ]
};
