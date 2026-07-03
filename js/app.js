/* ============================================================
   CARIBOU — Logique de l'app
   Auth (session persistante), dépenses, soldes, remboursements.
   Données 100% locales (localStorage) + export/import JSON.
   ============================================================ */

(function () {
  "use strict";

  var CFG = window.CARIBOU_CONFIG;
  var LS_DATA = "caribou_data_v1";
  var LS_SESSION = "caribou_session";
  var COOKIE_NAME = "caribou_user";
  var COOKIE_MAX_AGE = 60 * 60 * 24 * 400; // 400 jours = maximum autorisé par les navigateurs

  var CATEGORIES = [
    { id: "food",      name: "Restos",    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>' },
    { id: "grocery",   name: "Courses",   icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>' },
    { id: "transport", name: "Transport", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>' },
    { id: "lodging",   name: "Logement",  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>' },
    { id: "activity",  name: "Activités", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>' },
    { id: "party",     name: "Soirée",    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22h8"/><path d="M12 11v11"/><path d="m19 3-7 8-7-8Z"/></svg>' },
    { id: "shopping",  name: "Shopping",  icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>' },
    { id: "other",     name: "Autre",     icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>' }
  ];

  var CAT_COLORS = {
    food: "#F59E0B",
    grocery: "#34D399",
    transport: "#38BDF8",
    lodging: "#A78BFA",
    activity: "#FB7185",
    party: "#FB923C",
    shopping: "#F472B6",
    other: "#94A3B8"
  };

  var fmtCAD = new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" });
  var fmtCAD0 = new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
  var fmtEUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
  var fmtDate = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  var state = {
    user: null,          // compte connecté
    data: null,          // { expenses: [], eurToCad: n }
    editingId: null,     // dépense en cours d'édition
    modalCurrency: "CAD",
    modalPayer: null,
    modalParts: [],
    modalCat: "food",
    selectedLoginId: null
  };

  var cloud = null; // synchro Firestore (null = mode 100% local)

  /* ================= Utilitaires ================= */

  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function uid() {
    return (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : "id-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
  }

  function initials(name) {
    return name.trim().split(/\s+/).map(function (w) { return w[0]; }).join("").slice(0, 2).toUpperCase();
  }

  function member(id) {
    for (var i = 0; i < CFG.accounts.length; i++) {
      if (CFG.accounts[i].id === id) return CFG.accounts[i];
    }
    return { id: id, name: "?", color: "#64748B" };
  }

  function category(id) {
    for (var i = 0; i < CATEGORIES.length; i++) {
      if (CATEGORIES[i].id === id) return CATEGORIES[i];
    }
    return CATEGORIES[CATEGORIES.length - 1];
  }

  function toCad(exp) {
    return exp.currency === "EUR" ? exp.amount * state.data.eurToCad : exp.amount;
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  /* ---------- Confirmation stylée (remplace window.confirm) ---------- */
  var confirmResolve = null;

  function askConfirm(opts) {
    return new Promise(function (resolve) {
      $("#confirm-title").textContent = opts.title || "Confirmer ?";
      $("#confirm-message").textContent = opts.message || "";
      var ok = $("#confirm-ok");
      ok.textContent = opts.confirmLabel || "Confirmer";
      ok.className = opts.danger === false ? "btn-primary" : "btn-danger";
      document.querySelector("#confirm-modal .modal-confirm").classList.toggle("is-safe", opts.danger === false);
      $("#confirm-modal").hidden = false;
      document.body.style.overflow = "hidden";
      confirmResolve = resolve;
      setTimeout(function () { $("#confirm-cancel").focus(); }, 60);
    });
  }

  function closeConfirm(result) {
    if (!confirmResolve) return;
    $("#confirm-modal").hidden = true;
    // ne pas rendre le scroll si la modale de dépense est encore ouverte dessous
    document.body.style.overflow = $("#expense-modal").hidden ? "" : "hidden";
    var r = confirmResolve;
    confirmResolve = null;
    r(result);
  }

  function toast(msg, isError) {
    var box = $("#toasts");
    var el = document.createElement("div");
    el.className = "toast" + (isError ? " error" : "");
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(function () {
      el.classList.add("out");
      setTimeout(function () { el.remove(); }, 300);
    }, 3200);
  }

  function avatarDot(m, cls) {
    return '<span class="' + (cls || "avatar-dot") + '" style="background:' + m.color + '">' + esc(initials(m.name)) + "</span>";
  }

  /* ================= Stockage ================= */

  function loadData() {
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(LS_DATA)); } catch (e) { /* corrompu */ }
    if (!raw || !Array.isArray(raw.expenses)) {
      raw = { expenses: [], eurToCad: CFG.eurToCadDefault };
    }
    if (typeof raw.eurToCad !== "number" || !(raw.eurToCad > 0)) raw.eurToCad = CFG.eurToCadDefault;
    state.data = raw;
  }

  function saveData() {
    localStorage.setItem(LS_DATA, JSON.stringify(state.data));
  }

  /* ================= Synchro cloud (Firestore) ================= */

  function updateSyncBadge(ok, code) {
    var el = $("#sync-status");
    if (!el) return;
    el.classList.toggle("on", !!ok);
    if (ok) {
      el.textContent = "Synchro temps réel active : tout le crew voit les mêmes comptes.";
    } else if (code === "permission-denied") {
      el.textContent = "Synchro refusée : les règles de sécurité Firestore ne sont pas en place (voir README).";
    } else {
      el.textContent = "Hors ligne : tes modifications partiront à la reconnexion.";
    }
  }

  function initCloud() {
    if (!CFG.firebase || typeof firebase === "undefined") return;
    var db;
    try {
      firebase.initializeApp(CFG.firebase);
      db = firebase.firestore();
      // cache hors-ligne : l'app marche sans réseau, ça repart tout seul
      db.enablePersistence({ synchronizeTabs: true }).catch(function () {});
    } catch (e) {
      cloud = null;
      return;
    }
    var tripRef = db.collection("trips").doc(CFG.tripId || "canada");
    cloud = { db: db, tripRef: tripRef, expRef: tripRef.collection("expenses") };

    var firstSnap = true;
    cloud.expRef.onSnapshot(function (snap) {
      // premier contact : si le cloud est vide mais que cet appareil a déjà
      // des dépenses, on les envoie (migration en douceur)
      if (firstSnap && snap.empty && state.data.expenses.length) {
        firstSnap = false;
        var batch = db.batch();
        state.data.expenses.forEach(function (x) { batch.set(cloud.expRef.doc(x.id), x); });
        batch.commit().catch(function () {});
        updateSyncBadge(true);
        return; // le snapshot suivant contiendra tout
      }
      firstSnap = false;
      var list = [];
      snap.forEach(function (d) { list.push(d.data()); });
      state.data.expenses = list;
      saveData();
      updateSyncBadge(true);
      if (state.user) renderAll();
    }, function (err) {
      updateSyncBadge(false, err && err.code);
      if (err && err.code === "permission-denied") {
        toast("Synchro refusée : règles Firestore à configurer", true);
      }
    });

    cloud.tripRef.onSnapshot(function (doc) {
      var d = doc.data();
      if (d && typeof d.eurToCad === "number" && d.eurToCad > 0 && d.eurToCad !== state.data.eurToCad) {
        state.data.eurToCad = d.eurToCad;
        saveData();
        var ri = $("#rate-input");
        if (ri) ri.value = d.eurToCad;
        if (state.user) renderAll();
      }
    });
  }

  /* ================= Auth / session ================= */

  function setCookie(value) {
    document.cookie = COOKIE_NAME + "=" + encodeURIComponent(value) +
      "; max-age=" + COOKIE_MAX_AGE + "; path=/; SameSite=Lax";
  }

  function getCookie() {
    var m = document.cookie.match(new RegExp("(?:^|;\\s*)" + COOKIE_NAME + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }

  function clearCookie() {
    document.cookie = COOKIE_NAME + "=; max-age=0; path=/";
  }

  function currentSessionUser() {
    var id = localStorage.getItem(LS_SESSION) || getCookie();
    if (!id) return null;
    var m = member(id);
    return m.name !== "?" ? m : null;
  }

  function login(account) {
    state.user = account;
    localStorage.setItem(LS_SESSION, account.id);
    setCookie(account.id); // cookie longue durée : connecté une fois, connecté pour de bon
    showApp();
  }

  function logout() {
    localStorage.removeItem(LS_SESSION);
    clearCookie();
    state.user = null;
    location.reload();
  }

  /* ================= Écran de login ================= */

  function buildLogin() {
    $("#trip-tagline").textContent = CFG.tagline;

    var grid = $("#avatar-grid");
    grid.innerHTML = "";
    CFG.accounts.forEach(function (acc) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "avatar-btn";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", "false");
      b.style.setProperty("--av-color", acc.color);
      b.innerHTML = '<span class="avatar-dot" style="background:' + acc.color + '">' + esc(initials(acc.name)) + "</span><span>" + esc(acc.name) + "</span>";
      b.addEventListener("click", function () {
        state.selectedLoginId = acc.id;
        $all(".avatar-btn").forEach(function (x) {
          x.classList.remove("selected");
          x.setAttribute("aria-checked", "false");
        });
        b.classList.add("selected");
        b.setAttribute("aria-checked", "true");
        $("#login-error").hidden = true;
        $("#login-password").focus();
      });
      grid.appendChild(b);
    });

    $("#toggle-pass").addEventListener("click", function () {
      var inp = $("#login-password");
      inp.type = inp.type === "password" ? "text" : "password";
    });

    $("#login-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var err = $("#login-error");
      if (!state.selectedLoginId) {
        err.textContent = "Choisis d'abord ton avatar !";
        err.hidden = false;
        return;
      }
      var acc = member(state.selectedLoginId);
      var pass = $("#login-password").value;
      if (pass !== acc.password) {
        err.textContent = "Mauvais mot de passe. Demande au groupe !";
        err.hidden = false;
        return;
      }
      err.hidden = true;
      login(acc);
      toast("Bienvenue à bord, " + acc.name + " !");
    });

    // Animations d'entrée
    if (window.gsap && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.to(".reveal", { opacity: 1, y: 0, duration: 0.8, stagger: 0.12, ease: "power3.out", delay: 0.15 });

      // Tilt 3D de la carte de login
      var card = $(".login-card");
      var rx = gsap.quickTo(card, "rotationX", { duration: 0.5, ease: "power3.out" });
      var ry = gsap.quickTo(card, "rotationY", { duration: 0.5, ease: "power3.out" });
      gsap.set(card, { transformPerspective: 900 });
      window.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect();
        var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        ry(Math.max(-1, Math.min(1, (e.clientX - cx) / 500)) * 4);
        rx(Math.max(-1, Math.min(1, (e.clientY - cy) / 500)) * -4);
      }, { passive: true });
    } else {
      $all(".reveal").forEach(function (el) { el.classList.add("shown"); });
    }
  }

  /* ================= Calculs ================= */

  // Soldes : positif = doit recevoir, négatif = doit rembourser
  function computeBalances() {
    var map = {};
    CFG.accounts.forEach(function (a) { map[a.id] = { paid: 0, share: 0 }; });

    state.data.expenses.forEach(function (exp) {
      var cad = toCad(exp);
      if (map[exp.payerId]) map[exp.payerId].paid += cad;
      var parts = exp.participants.filter(function (p) { return map[p]; });
      if (!parts.length) return;
      var each = cad / parts.length;
      parts.forEach(function (p) { map[p].share += each; });
    });

    return CFG.accounts.map(function (a) {
      var e = map[a.id];
      return { id: a.id, paid: e.paid, share: e.share, balance: e.paid - e.share };
    });
  }

  // Minimum de virements pour tout équilibrer (algorithme glouton)
  function computeSettlements(balances) {
    var debtors = [], creditors = [];
    balances.forEach(function (b) {
      if (b.balance < -0.005) debtors.push({ id: b.id, amt: -b.balance });
      else if (b.balance > 0.005) creditors.push({ id: b.id, amt: b.balance });
    });
    debtors.sort(function (a, b) { return b.amt - a.amt; });
    creditors.sort(function (a, b) { return b.amt - a.amt; });

    var out = [], i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      var x = Math.min(debtors[i].amt, creditors[j].amt);
      out.push({ from: debtors[i].id, to: creditors[j].id, amount: x });
      debtors[i].amt -= x;
      creditors[j].amt -= x;
      if (debtors[i].amt < 0.005) i++;
      if (creditors[j].amt < 0.005) j++;
    }
    return out;
  }

  /* ================= Rendus ================= */

  function renderAll() {
    renderStats();
    renderBalanceBars();
    renderCategoryBars();
    renderRecent();
    renderExpenseGroups();
    renderEquilibre();
    renderStatsTab();
  }

  function renderStats() {
    var total = state.data.expenses.reduce(function (s, e) { return s + toCad(e); }, 0);
    $("#stat-total").textContent = fmtCAD.format(total);
    $("#stat-total-eur").textContent = "≈ " + fmtEUR.format(total / state.data.eurToCad);
    $("#stat-count").textContent = String(state.data.expenses.length);

    var balances = computeBalances();
    var mine = balances.filter(function (b) { return b.id === state.user.id; })[0];
    var el = $("#stat-balance");
    var hint = $("#stat-balance-hint");
    el.classList.remove("pos", "neg");
    if (!mine || Math.abs(mine.balance) < 0.005) {
      el.textContent = fmtCAD.format(0);
      hint.textContent = "Tu es à jour";
    } else if (mine.balance > 0) {
      el.textContent = "+" + fmtCAD.format(mine.balance);
      el.classList.add("pos");
      hint.textContent = "On te doit de l'argent";
    } else {
      el.textContent = fmtCAD.format(mine.balance);
      el.classList.add("neg");
      hint.textContent = "Tu dois rembourser";
    }

    // Compte à rebours
    var days = $("#stat-days");
    if (CFG.startDate) {
      var diff = Math.ceil((new Date(CFG.startDate + "T00:00:00") - new Date()) / 86400000);
      days.textContent = diff > 0 ? "Départ dans J-" + diff : "Vous y êtes !";
    } else {
      days.textContent = "";
    }
  }

  function renderBalanceBars() {
    var box = $("#balance-bars");
    var balances = computeBalances();
    var max = Math.max.apply(null, balances.map(function (b) { return Math.abs(b.balance); }).concat([1]));

    box.innerHTML = balances.map(function (b) {
      var m = member(b.id);
      var pct = Math.min(Math.abs(b.balance) / max * 50, 50);
      var cls = Math.abs(b.balance) < 0.005 ? "zero" : (b.balance > 0 ? "pos" : "neg");
      var fill = "";
      if (cls === "pos") fill = '<span class="bbar-fill pos" style="left:50%;width:' + pct + '%"></span>';
      else if (cls === "neg") fill = '<span class="bbar-fill neg" style="left:' + (50 - pct) + '%;width:' + pct + '%"></span>';
      var amount = (b.balance > 0.005 ? "+" : "") + fmtCAD.format(b.balance);
      return '<div class="bbar">' + avatarDot(m) +
        '<span class="bbar-track">' + fill + "</span>" +
        '<span class="bbar-amount ' + cls + '">' + amount + "</span></div>";
    }).join("");
  }

  function renderCategoryBars() {
    var box = $("#category-bars");
    var totals = {};
    state.data.expenses.forEach(function (e) {
      totals[e.category] = (totals[e.category] || 0) + toCad(e);
    });
    var entries = Object.keys(totals).map(function (k) { return { cat: category(k), total: totals[k] }; });
    entries.sort(function (a, b) { return b.total - a.total; });

    if (!entries.length) {
      box.innerHTML = '<p class="empty-state">Aucune dépense pour l\'instant.</p>';
      return;
    }
    var max = entries[0].total;
    box.innerHTML = entries.map(function (e) {
      var color = CAT_COLORS[e.cat.id] || "#94A3B8";
      return '<div class="cbar">' + e.cat.icon +
        '<span class="cbar-name">' + esc(e.cat.name) + "</span>" +
        '<span class="cbar-amount">' + fmtCAD.format(e.total) + "</span>" +
        '<span class="cbar-track"><span class="cbar-fill" style="width:' + (e.total / max * 100) + '%;background:' + color + '"></span></span>' +
        "</div>";
    }).join("");
  }

  /* ================= Onglet Stats ================= */

  function categoryTotals() {
    var totals = {};
    state.data.expenses.forEach(function (e) {
      totals[e.category] = (totals[e.category] || 0) + toCad(e);
    });
    return Object.keys(totals)
      .map(function (k) { return { cat: category(k), total: totals[k] }; })
      .sort(function (a, b) { return b.total - a.total; });
  }

  function arcPath(cx, cy, r, a0, a1) {
    var large = (a1 - a0) > Math.PI ? 1 : 0;
    return "M " + (cx + r * Math.cos(a0)).toFixed(2) + " " + (cy + r * Math.sin(a0)).toFixed(2) +
      " A " + r + " " + r + " 0 " + large + " 1 " +
      (cx + r * Math.cos(a1)).toFixed(2) + " " + (cy + r * Math.sin(a1)).toFixed(2);
  }

  function renderStatsTab() {
    var expenses = state.data.expenses;
    var total = expenses.reduce(function (s, e) { return s + toCad(e); }, 0);
    var perHead = total / CFG.accounts.length;

    // --- Héro ---
    $("#stats-hero-total").textContent = fmtCAD.format(total);
    $("#stats-hero-foot").textContent = expenses.length
      ? "≈ " + fmtEUR.format(total / state.data.eurToCad) + " · soit " + fmtCAD.format(perHead) + " par tête. Ces dollars sont partis vivre leur vie."
      : "Rien de perdu pour l'instant. Ça viendra.";

    // --- Donut par catégorie ---
    var donut = $("#stats-donut");
    var legend = $("#stats-legend");
    var entries = categoryTotals();
    if (!entries.length) {
      donut.innerHTML = "";
      legend.innerHTML = '<li class="empty-state" style="padding:10px 0">Ajoute des dépenses pour voir où part l\'argent.</li>';
    } else {
      var cx = 90, cy = 90, r = 68, gapA = 0.04;
      var svg = "";
      if (entries.length === 1) {
        var only = entries[0];
        svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + (CAT_COLORS[only.cat.id] || "#94A3B8") + '" stroke-width="24"><title>' + esc(only.cat.name) + " — " + fmtCAD.format(only.total) + " (100%)</title></circle>";
      } else {
        var angle = -Math.PI / 2;
        entries.forEach(function (e) {
          var frac = e.total / total;
          var span = frac * Math.PI * 2;
          var a0 = angle + gapA / 2;
          var a1 = angle + span - gapA / 2;
          if (a1 <= a0) a1 = a0 + 0.01;
          var color = CAT_COLORS[e.cat.id] || "#94A3B8";
          svg += '<path d="' + arcPath(cx, cy, r, a0, a1) + '" fill="none" stroke="' + color + '" stroke-width="24" stroke-linecap="butt"><title>' +
            esc(e.cat.name) + " — " + fmtCAD.format(e.total) + " (" + Math.round(frac * 100) + "%)</title></path>";
          angle += span;
        });
      }
      svg += '<text x="' + cx + '" y="' + (cy - 2) + '" text-anchor="middle" class="donut-center-value">' + esc(fmtCAD0.format(total)) + "</text>";
      svg += '<text x="' + cx + '" y="' + (cy + 18) + '" text-anchor="middle" class="donut-center-label">envolés</text>';
      donut.innerHTML = svg;

      legend.innerHTML = entries.map(function (e) {
        var color = CAT_COLORS[e.cat.id] || "#94A3B8";
        return '<li><span class="swatch" style="background:' + color + '"></span>' +
          "<span>" + esc(e.cat.name) + "</span>" +
          '<span class="pct">' + Math.round(e.total / total * 100) + "%</span>" +
          '<span class="amt">' + fmtCAD.format(e.total) + "</span></li>";
      }).join("");
    }

    // --- Courbe cumulée ---
    var tl = $("#stats-timeline");
    if (!expenses.length) {
      tl.innerHTML = "";
      $("#tl-start").textContent = "";
      $("#tl-end").textContent = "";
    } else {
      var byDay = {};
      expenses.forEach(function (e) { byDay[e.date] = (byDay[e.date] || 0) + toCad(e); });
      var days = Object.keys(byDay).sort();
      var cum = 0;
      var points = days.map(function (d) { cum += byDay[d]; return { date: d, value: cum }; });
      if (points.length === 1) points.unshift({ date: points[0].date, value: 0 });

      var W = 320, H = 160, padT = 16, padB = 10, padX = 6;
      var maxV = points[points.length - 1].value;
      function px(i) { return padX + i / (points.length - 1) * (W - padX * 2); }
      function py(v) { return padT + (1 - v / maxV) * (H - padT - padB); }

      var line = points.map(function (p, i) { return (i ? "L " : "M ") + px(i).toFixed(1) + " " + py(p.value).toFixed(1); }).join(" ");
      var area = line + " L " + px(points.length - 1).toFixed(1) + " " + (H - padB) + " L " + px(0).toFixed(1) + " " + (H - padB) + " Z";

      var grid = "";
      [0.25, 0.5, 0.75].forEach(function (f) {
        var y = (padT + (1 - f) * (H - padT - padB)).toFixed(1);
        grid += '<line x1="' + padX + '" y1="' + y + '" x2="' + (W - padX) + '" y2="' + y + '" stroke="rgba(148,163,184,0.12)" stroke-width="1"/>';
      });

      var dots = points.map(function (p, i) {
        var fmtDay = new Date(p.date + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
        return '<circle cx="' + px(i).toFixed(1) + '" cy="' + py(p.value).toFixed(1) + '" r="3.4" fill="#F59E0B" stroke="#0B1120" stroke-width="1.5"><title>' +
          fmtDay + " — " + fmtCAD.format(p.value) + " au total</title></circle>";
      }).join("");

      tl.innerHTML =
        '<defs><linearGradient id="tl-grad" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#F59E0B" stop-opacity="0.35"/>' +
        '<stop offset="100%" stop-color="#F59E0B" stop-opacity="0"/></linearGradient></defs>' +
        grid +
        '<path d="' + area + '" fill="url(#tl-grad)"/>' +
        '<path d="' + line + '" fill="none" stroke="#F59E0B" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' +
        dots +
        '<text x="' + padX + '" y="11" fill="#94A3B8" font-size="10" font-weight="600">' + esc(fmtCAD0.format(maxV)) + "</text>";

      var optsDate = { day: "numeric", month: "short" };
      $("#tl-start").textContent = new Date(days[0] + "T00:00:00").toLocaleDateString("fr-FR", optsDate);
      $("#tl-end").textContent = days.length > 1 ? new Date(days[days.length - 1] + "T00:00:00").toLocaleDateString("fr-FR", optsDate) : "";
    }

    // --- Podium des flambeurs ---
    var paid = {};
    CFG.accounts.forEach(function (a) { paid[a.id] = 0; });
    expenses.forEach(function (e) { if (paid[e.payerId] !== undefined) paid[e.payerId] += toCad(e); });
    var ranking = CFG.accounts
      .map(function (a) { return { m: a, paid: paid[a.id] }; })
      .sort(function (a, b) { return b.paid - a.paid; });
    var maxPaid = Math.max(ranking[0].paid, 1);
    $("#stats-podium").innerHTML = ranking.map(function (r, i) {
      return '<div class="podium-row"><span class="podium-rank">' + (i + 1) + "</span>" +
        avatarDot(r.m) +
        '<span class="podium-track"><span class="podium-fill" style="width:' + (r.paid / maxPaid * 100) + "%;background:" + r.m.color + '"></span></span>' +
        '<span class="podium-amt">' + fmtCAD.format(r.paid) + "</span></div>";
    }).join("");

    // --- Records ---
    var records = $("#stats-records");
    if (!expenses.length) {
      records.innerHTML = "";
      return;
    }
    var biggest = expenses.reduce(function (a, b) { return toCad(b) > toCad(a) ? b : a; });
    var byDay2 = {};
    expenses.forEach(function (e) { byDay2[e.date] = (byDay2[e.date] || 0) + toCad(e); });
    var worstDay = Object.keys(byDay2).reduce(function (a, b) { return byDay2[b] > byDay2[a] ? b : a; });
    var topPayer = ranking[0];
    var nbDays = Object.keys(byDay2).length;

    function recordCard(color, icon, label, value, sub) {
      return '<div class="record-card"><span class="record-icon" style="background:' + color + '22;color:' + color + '">' + icon + "</span>" +
        '<div><p class="stat-label">' + label + '</p><p class="record-value">' + value + '</p><p class="record-sub">' + sub + "</p></div></div>";
    }
    var icoBolt = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>';
    var icoCal = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></svg>';
    var icoCrown = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 8 4 10h12L22 8l-5 4-5-7-5 7-5-4Z"/></svg>';
    var icoAvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 6v2"/><path d="M12 16v2"/></svg>';

    var worstDayLabel = new Date(worstDay + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
    records.innerHTML =
      recordCard("#FB7185", icoBolt, "Plus grosse dépense", esc(fmtCAD.format(toCad(biggest))), esc(biggest.title) + " · payé par " + esc(member(biggest.payerId).name)) +
      recordCard("#38BDF8", icoCal, "Journée la plus chère", esc(fmtCAD.format(byDay2[worstDay])), esc(worstDayLabel)) +
      recordCard("#F59E0B", icoCrown, "Flambeur n°1", esc(topPayer.m.name), "a avancé " + esc(fmtCAD.format(topPayer.paid))) +
      recordCard("#34D399", icoAvg, "Rythme de perte", esc(fmtCAD.format(total / nbDays)) + " / jour", "sur " + nbDays + " jour" + (nbDays > 1 ? "s" : "") + " de dépenses");
  }

  function expenseRow(exp) {
    var m = member(exp.payerId);
    var cat = category(exp.category);
    var cad = toCad(exp);
    var eurNote = exp.currency === "EUR"
      ? fmtEUR.format(exp.amount) + " saisis"
      : "≈ " + fmtEUR.format(cad / state.data.eurToCad);
    var nParts = exp.participants.length;
    return '<li class="expense-item" data-id="' + exp.id + '" tabindex="0" role="button" aria-label="Modifier ' + esc(exp.title) + '">' +
      '<span class="exp-icon">' + cat.icon + "</span>" +
      '<span class="exp-main"><p class="exp-title">' + esc(exp.title) + "</p>" +
      '<p class="exp-meta">' + avatarDot(m, "mini-dot") + " " + esc(m.name) + " a payé · pour " + nParts + (nParts > 1 ? " personnes" : " personne") + "</p></span>" +
      '<span class="exp-amount"><span class="cad">' + fmtCAD.format(cad) + '</span><span class="eur">' + eurNote + "</span></span></li>";
  }

  function renderRecent() {
    var list = $("#recent-list");
    var sorted = state.data.expenses.slice().sort(function (a, b) {
      return (b.date + (b.createdAt || "")).localeCompare(a.date + (a.createdAt || ""));
    });
    if (!sorted.length) {
      list.innerHTML = '<li class="empty-state"><strong>Rien pour l\'instant</strong>Ajoute la première dépense du voyage !</li>';
      return;
    }
    list.innerHTML = sorted.slice(0, 5).map(expenseRow).join("");
  }

  function renderExpenseGroups() {
    var box = $("#expense-groups");
    var sorted = state.data.expenses.slice().sort(function (a, b) {
      return (b.date + (b.createdAt || "")).localeCompare(a.date + (a.createdAt || ""));
    });
    if (!sorted.length) {
      box.innerHTML = '<div class="card"><p class="empty-state"><strong>Aucune dépense</strong>Clique sur « Ajouter » pour lancer les comptes.</p></div>';
      return;
    }
    var groups = {};
    var order = [];
    sorted.forEach(function (e) {
      if (!groups[e.date]) { groups[e.date] = []; order.push(e.date); }
      groups[e.date].push(e);
    });
    box.innerHTML = order.map(function (date) {
      var d = new Date(date + "T00:00:00");
      var label = isNaN(d) ? date : fmtDate.format(d);
      return '<div class="date-group"><p class="date-label">' + esc(label) + '</p><div class="card" style="padding:8px 12px"><ul class="expense-list">' +
        groups[date].map(expenseRow).join("") + "</ul></div></div>";
    }).join("");
  }

  function renderEquilibre() {
    var balances = computeBalances();
    var cards = $("#balance-cards");
    cards.innerHTML = balances.map(function (b) {
      var m = member(b.id);
      var cls = Math.abs(b.balance) < 0.005 ? "zero" : (b.balance > 0 ? "pos" : "neg");
      var val = (b.balance > 0.005 ? "+" : "") + fmtCAD.format(b.balance);
      return '<div class="balance-card">' + avatarDot(m) +
        '<div><p class="who">' + esc(m.name) + '</p><p class="how ' + cls + '">' + val + "</p>" +
        '<p class="sub">a payé ' + fmtCAD.format(b.paid) + "</p></div></div>";
    }).join("");

    var list = $("#settlement-list");
    var settlements = computeSettlements(balances);
    if (!settlements.length) {
      list.innerHTML = '<li class="empty-state"><strong>Tout le monde est à jour</strong>Aucun remboursement nécessaire. Beau travail d\'équipe.</li>';
      return;
    }
    var arrow = '<span class="arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg></span>';
    list.innerHTML = settlements.map(function (s) {
      var from = member(s.from), to = member(s.to);
      return '<li class="settlement-item">' + avatarDot(from) + "<span>" + esc(from.name) + "</span>" +
        arrow + avatarDot(to) + "<span>" + esc(to.name) + "</span>" +
        '<span class="amount">' + fmtCAD.format(s.amount) + "</span></li>";
    }).join("");
  }

  /* ================= Modale dépense ================= */

  function buildModalChoices() {
    var payerBox = $("#exp-payer");
    var partBox = $("#exp-participants");
    payerBox.innerHTML = "";
    partBox.innerHTML = "";

    CFG.accounts.forEach(function (acc) {
      var pb = document.createElement("button");
      pb.type = "button";
      pb.className = "chip-btn";
      pb.dataset.id = acc.id;
      pb.style.setProperty("--av-color", acc.color);
      pb.innerHTML = '<span class="mini-dot" style="background:' + acc.color + '">' + esc(initials(acc.name)) + "</span>" + esc(acc.name);
      pb.addEventListener("click", function () {
        state.modalPayer = acc.id;
        syncModalChoices();
      });
      payerBox.appendChild(pb);

      var cb = pb.cloneNode(true);
      cb.addEventListener("click", function () {
        var idx = state.modalParts.indexOf(acc.id);
        if (idx >= 0) state.modalParts.splice(idx, 1);
        else state.modalParts.push(acc.id);
        syncModalChoices();
      });
      partBox.appendChild(cb);
    });

    var catBox = $("#exp-category");
    catBox.innerHTML = "";
    CATEGORIES.forEach(function (cat) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cat-btn";
      b.dataset.id = cat.id;
      b.innerHTML = cat.icon + "<span>" + esc(cat.name) + "</span>";
      b.addEventListener("click", function () {
        state.modalCat = cat.id;
        syncModalChoices();
      });
      catBox.appendChild(b);
    });

    $all("#exp-currency .seg-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        state.modalCurrency = b.dataset.cur;
        syncModalChoices();
      });
    });
  }

  function syncModalChoices() {
    $all("#exp-payer .chip-btn").forEach(function (b) {
      b.classList.toggle("selected", b.dataset.id === state.modalPayer);
    });
    $all("#exp-participants .chip-btn").forEach(function (b) {
      b.classList.toggle("selected", state.modalParts.indexOf(b.dataset.id) >= 0);
    });
    $all("#exp-category .cat-btn").forEach(function (b) {
      b.classList.toggle("selected", b.dataset.id === state.modalCat);
    });
    $all("#exp-currency .seg-btn").forEach(function (b) {
      b.classList.toggle("active", b.dataset.cur === state.modalCurrency);
    });
  }

  function openModal(expense) {
    state.editingId = expense ? expense.id : null;
    $("#modal-title").textContent = expense ? "Modifier la dépense" : "Nouvelle dépense";
    $("#exp-delete").hidden = !expense;
    $("#exp-error").hidden = true;

    $("#exp-title").value = expense ? expense.title : "";
    $("#exp-amount").value = expense ? expense.amount : "";
    $("#exp-date").value = expense ? expense.date : todayISO();
    state.modalCurrency = expense ? expense.currency : "CAD";
    state.modalPayer = expense ? expense.payerId : state.user.id;
    state.modalParts = expense ? expense.participants.slice() : CFG.accounts.map(function (a) { return a.id; });
    state.modalCat = expense ? expense.category : "food";
    syncModalChoices();

    $("#expense-modal").hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(function () { $("#exp-title").focus(); }, 60);
  }

  function closeModal() {
    $("#expense-modal").hidden = true;
    document.body.style.overflow = "";
    state.editingId = null;
  }

  function submitExpense(e) {
    e.preventDefault();
    var err = $("#exp-error");
    var title = $("#exp-title").value.trim();
    var amount = parseFloat($("#exp-amount").value);
    var date = $("#exp-date").value;

    if (!title) { err.textContent = "Donne un titre à la dépense."; err.hidden = false; return; }
    if (!(amount > 0)) { err.textContent = "Le montant doit être supérieur à 0."; err.hidden = false; return; }
    if (!state.modalPayer) { err.textContent = "Choisis qui a payé."; err.hidden = false; return; }
    if (!state.modalParts.length) { err.textContent = "Sélectionne au moins un participant."; err.hidden = false; return; }
    if (!date) { err.textContent = "Choisis une date."; err.hidden = false; return; }
    err.hidden = true;

    var editing = !!state.editingId;
    var existing = editing
      ? state.data.expenses.filter(function (x) { return x.id === state.editingId; })[0]
      : null;
    var payload = {
      id: editing ? state.editingId : uid(),
      title: title,
      amount: Math.round(amount * 100) / 100,
      currency: state.modalCurrency,
      payerId: state.modalPayer,
      participants: state.modalParts.slice(),
      category: state.modalCat,
      date: date,
      createdBy: existing ? existing.createdBy : state.user.id,
      createdAt: existing ? existing.createdAt : new Date().toISOString()
    };

    if (cloud) {
      cloud.expRef.doc(payload.id).set(payload); // le snapshot met l'UI à jour
    } else {
      if (editing) {
        state.data.expenses = state.data.expenses.map(function (x) { return x.id === payload.id ? payload : x; });
      } else {
        state.data.expenses.push(payload);
      }
      saveData();
      renderAll();
    }
    toast(editing ? "Dépense modifiée" : "Dépense ajoutée");
    closeModal();
  }

  function deleteExpense() {
    if (!state.editingId) return;
    var id = state.editingId;
    askConfirm({
      title: "Supprimer la dépense ?",
      message: cloud
        ? "Elle disparaîtra pour tout le monde. C'est définitif."
        : "Elle sera supprimée de cet appareil. C'est définitif.",
      confirmLabel: "Supprimer"
    }).then(function (yes) {
      if (!yes) return;
      if (cloud) {
        cloud.expRef.doc(id).delete();
      } else {
        state.data.expenses = state.data.expenses.filter(function (x) { return x.id !== id; });
        saveData();
        renderAll();
      }
      closeModal();
      toast("Dépense supprimée");
    });
  }

  /* ================= App ================= */

  function showApp() {
    $("#view-login").hidden = true;
    $("#view-login").style.display = "none";
    $("#view-app").hidden = false;
    document.body.classList.add("in-app"); // affiche le décor 3D

    // La vidéo du caribou n'accompagne que l'écran d'accueil
    var vb = $("#video-bg");
    if (vb) {
      vb.classList.add("gone");
      $all("#video-bg video").forEach(function (v) { v.pause(); });
    }

    $("#trip-chip").textContent = CFG.tripName;
    $("#user-chip").innerHTML = avatarDot(state.user) + "<span>" + esc(state.user.name) + "</span>";
    $("#rate-input").value = state.data.eurToCad;

    renderAll();

    if (window.gsap && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.from(".view-app .card, .view-app .stat-card", {
        opacity: 0, y: 16, duration: 0.55, stagger: 0.05, ease: "power3.out", clearProps: "all"
      });
    }
  }

  function bindApp() {
    // Onglets
    $all(".tab").forEach(function (t) {
      t.addEventListener("click", function () { gotoTab(t.dataset.tab); });
    });
    $all("[data-goto]").forEach(function (b) {
      b.addEventListener("click", function () { gotoTab(b.dataset.goto); });
    });

    $("#logout-btn").addEventListener("click", function () {
      askConfirm({
        title: "Se déconnecter ?",
        message: "Tu devras retaper ton mot de passe la prochaine fois.",
        confirmLabel: "Se déconnecter",
        danger: false
      }).then(function (yes) { if (yes) logout(); });
    });

    // Modale de confirmation
    $("#confirm-cancel").addEventListener("click", function () { closeConfirm(false); });
    $("#confirm-ok").addEventListener("click", function () { closeConfirm(true); });
    $("#confirm-modal").addEventListener("click", function (e) {
      if (e.target === $("#confirm-modal")) closeConfirm(false);
    });

    $("#add-expense-btn").addEventListener("click", function () { openModal(null); });
    $("#fab-add").addEventListener("click", function () { openModal(null); });
    $("#modal-close").addEventListener("click", closeModal);
    $("#expense-modal").addEventListener("click", function (e) {
      if (e.target === $("#expense-modal")) closeModal();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (!$("#confirm-modal").hidden) closeConfirm(false);
      else if (!$("#expense-modal").hidden) closeModal();
    });
    $("#expense-form").addEventListener("submit", submitExpense);
    $("#exp-delete").addEventListener("click", deleteExpense);

    // Clic sur une dépense = édition
    document.addEventListener("click", function (e) {
      var item = e.target.closest ? e.target.closest(".expense-item") : null;
      if (!item || !item.dataset.id) return;
      var exp = state.data.expenses.filter(function (x) { return x.id === item.dataset.id; })[0];
      if (exp) openModal(exp);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      var item = e.target && e.target.classList && e.target.classList.contains("expense-item") ? e.target : null;
      if (!item) return;
      var exp = state.data.expenses.filter(function (x) { return x.id === item.dataset.id; })[0];
      if (exp) openModal(exp);
    });

    // Réglages
    $("#rate-input").addEventListener("change", function () {
      var v = parseFloat(this.value);
      if (v > 0) {
        state.data.eurToCad = v;
        saveData();
        if (cloud) cloud.tripRef.set({ eurToCad: v }, { merge: true });
        renderAll();
        toast("Taux mis à jour : 1 € = " + v + " $ CAD");
      }
    });
    $("#reset-btn").addEventListener("click", function () {
      askConfirm({
        title: "Tout effacer ?",
        message: cloud
          ? "Toutes les dépenses du voyage seront supprimées, pour tout le monde. Irréversible."
          : "Toutes les dépenses de cet appareil seront supprimées. Irréversible.",
        confirmLabel: "Tout effacer"
      }).then(function (yes) {
        if (!yes) return;
        if (cloud) {
          var batch = cloud.db.batch();
          state.data.expenses.forEach(function (x) { batch.delete(cloud.expRef.doc(x.id)); });
          batch.commit().catch(function () { toast("Effacement cloud échoué, réessaie", true); });
        } else {
          state.data.expenses = [];
          saveData();
          renderAll();
        }
        toast("Tout est effacé");
      });
    });
  }

  function gotoTab(name) {
    $all(".tab").forEach(function (t) { t.classList.toggle("active", t.dataset.tab === name); });
    $all(".tab-panel").forEach(function (p) { p.classList.toggle("active", p.id === "tab-" + name); });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ================= Démarrage ================= */

  function boot() {
    if (!CFG || !CFG.accounts || !CFG.accounts.length) {
      document.body.innerHTML = "<p style='padding:40px;font-family:sans-serif'>Config manquante : vérifie js/config.js</p>";
      return;
    }
    loadData();
    initCloud();
    buildLogin();
    buildModalChoices();
    bindApp();

    var existing = currentSessionUser();
    if (existing) {
      state.user = existing;
      showApp();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
