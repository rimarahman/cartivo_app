/* CartKit storefront: slide cart drawer, cart goals & free gifts, upsells, sticky add-to-cart,
   floating cart, announcements & timers. Configuration comes from the app embed (cartkit-embed.liquid). */
(function () {
  "use strict";
  if (window.CartKit && window.CartKit.__loaded) return;

  // ---------------------------------------------------------------- bootstrap
  function readJSON(id) {
    try {
      return JSON.parse(document.getElementById(id).textContent);
    } catch (e) {
      return null;
    }
  }
  var CONFIG = readJSON("cartkit-config");
  var CTX = readJSON("cartkit-context");
  if (!CONFIG || !CONFIG.settings || !CTX) return;

  var S = CONFIG.settings;
  var SHOPIFY = window.Shopify || {};
  var ROOT = ((SHOPIFY.routes && SHOPIFY.routes.root) || CTX.rootUrl || "/").replace(/\/?$/, "/");
  var PROXY = "/apps/cartkit";
  var RATE = parseFloat((SHOPIFY.currency && SHOPIFY.currency.rate) || 1) || 1;
  var nativeFetch = window.fetch.bind(window);

  var disabledPaths = String(S.advanced.disableOnPaths || "")
    .split(",")
    .map(function (p) { return p.trim(); })
    .filter(Boolean);
  if (disabledPaths.some(function (p) { return location.pathname.indexOf(p) === 0; })) return;

  var NOW = Date.now();
  // Markets: campaigns can be limited to countries (Liquid localization.country).
  var COUNTRY = CTX.country || "";
  var CAMPAIGNS = (CONFIG.campaigns || []).filter(function (c) {
    var countries = (c.config && c.config.countries) || [];
    return (!c.startsAt || Date.parse(c.startsAt) <= NOW) && (!c.endsAt || Date.parse(c.endsAt) > NOW) &&
      (!countries.length || !COUNTRY || countries.indexOf(COUNTRY) > -1);
  });
  function campaignsOf(type) {
    return CAMPAIGNS.filter(function (c) { return c.type === type; });
  }

  // ---------------------------------------------------------------- helpers
  var locale = String(CTX.locale || "").toLowerCase();
  var translations = S.translations || {};
  var TR = translations[locale] || translations[locale.split("-")[0]] || {};
  function t(key) {
    if (TR[key]) return TR[key];
    var parts = key.split(".");
    var section = S[parts[0]] || {};
    return section[parts[1]] == null ? "" : String(section[parts[1]]);
  }
  function fill(tpl, vars) {
    return String(tpl || "").replace(/\{\{\s*(\w+)\s*\}\}/g, function (_, k) {
      return vars[k] == null ? "" : vars[k];
    });
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function url(path) {
    return ROOT + String(path).replace(/^\//, "");
  }
  function img(src, width) {
    if (!src) return "";
    src = String(src);
    if (src.indexOf("//") === 0) src = "https:" + src;
    return src + (src.indexOf("?") > -1 ? "&" : "?") + "width=" + width;
  }
  function money(cents) {
    var format = String(CTX.moneyFormat || "${{amount}}").replace(/<[^>]*>/g, "");
    var match = format.match(/\{\{\s*(\w+)\s*\}\}/);
    cents = Math.round(Number(cents) || 0);
    function delim(precision, thousands, decimal) {
      var parts = (cents / 100).toFixed(precision).split(".");
      return parts[0].replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1" + thousands) + (parts[1] ? decimal + parts[1] : "");
    }
    var value;
    switch (match ? match[1] : "amount") {
      case "amount_no_decimals": value = delim(0, ",", "."); break;
      case "amount_with_comma_separator": value = delim(2, ".", ","); break;
      case "amount_no_decimals_with_comma_separator": value = delim(0, ".", ","); break;
      case "amount_with_apostrophe_separator": value = delim(2, "'", "."); break;
      case "amount_no_decimals_with_space_separator": value = delim(0, " ", ""); break;
      case "amount_with_space_separator": value = delim(2, " ", ","); break;
      case "amount_with_period_and_space_separator": value = delim(2, " ", "."); break;
      default: value = delim(2, ",", ".");
    }
    return match ? format.replace(match[0], value) : value;
  }
  function store(kind) {
    try {
      return window[kind];
    } catch (e) {
      return null;
    }
  }
  function sessionSet(key) {
    var s = store("sessionStorage");
    var set = new Set();
    try {
      JSON.parse((s && s.getItem(key)) || "[]").forEach(function (v) { set.add(v); });
    } catch (e) { /* ignore */ }
    return {
      has: function (v) { return set.has(v); },
      add: function (v) {
        set.add(v);
        try { s && s.setItem(key, JSON.stringify(Array.from(set))); } catch (e) { /* ignore */ }
      },
      delete: function (v) {
        set.delete(v);
        try { s && s.setItem(key, JSON.stringify(Array.from(set))); } catch (e) { /* ignore */ }
      },
    };
  }
  var declined = sessionSet("cartkit_declined");
  var failedAdds = new Set();

  var listeners = {};
  function emit(name, detail) {
    (listeners[name] || []).forEach(function (fn) {
      try { fn(detail); } catch (e) { console.error(e); }
    });
    document.dispatchEvent(new CustomEvent("cartkit:" + name, { detail: detail }));
  }

  // Analytics (app proxy) + Google Analytics
  var queue = [];
  var flushTimer = null;
  function track(type, value, campaignId) {
    queue.push({ type: type, value: value, campaignId: campaignId });
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 1500);
  }
  function flush() {
    if (!queue.length || CTX.designMode) return;
    var body = JSON.stringify({ events: queue.splice(0, 20) });
    try {
      if (navigator.sendBeacon) navigator.sendBeacon(PROXY + "/track", new Blob([body], { type: "text/plain" }));
      else nativeFetch(PROXY + "/track", { method: "POST", body: body, keepalive: true });
    } catch (e) { /* ignore */ }
  }
  window.addEventListener("pagehide", flush);
  function ga(name, params) {
    if (S.advanced.googleAnalytics && typeof window.gtag === "function") {
      try { window.gtag("event", name, params || {}); } catch (e) { /* ignore */ }
    }
  }

  // ---------------------------------------------------------------- cart API
  function api(path, body) {
    var opts = { headers: { Accept: "application/json" }, credentials: "same-origin" };
    if (body !== undefined) {
      opts.method = "POST";
      if (body instanceof FormData) opts.body = body;
      else {
        opts.headers["Content-Type"] = "application/json";
        opts.body = JSON.stringify(body);
      }
    }
    return nativeFetch(url(path), opts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var err = new Error(data.description || data.message || "Something went wrong");
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }
  var cart = CTX.cart || { items: [], item_count: 0, total_price: 0 };
  function getCart() {
    return api("cart.js").then(function (c) { cart = c; return c; });
  }
  function addItems(items) {
    return api("cart/add.js", { items: items });
  }
  function changeLine(key, quantity) {
    return api("cart/change.js", { id: key, quantity: quantity });
  }
  function updateCart(body) {
    return api("cart/update.js", body);
  }

  function prop(item, key) {
    return item.properties && item.properties[key];
  }
  function isGift(item) { return !!prop(item, "_cartkit_gift"); }
  function isAddon(item) { return !!prop(item, "_cartkit_addon"); }
  function isRealItem(item) { return !isGift(item) && !isAddon(item); }
  function productId(item) { return String(item.product_id); }

  // ---------------------------------------------------------------- campaign logic
  function rewardsProgress(campaign) {
    var subtotal = 0;
    var qty = 0;
    cart.items.forEach(function (item) {
      if (isGift(item)) return;
      subtotal += item.original_line_price;
      qty += item.quantity;
    });
    // thresholds are in shop currency, cart is in presentment currency (cents)
    return campaign.config.basis === "quantity" ? qty : subtotal / 100 / RATE;
  }
  // Campaign text in the shopper's language ("fr", "pt-br" ...), falling back to the default text.
  function ct(c, key) {
    var tr = c.config.translations || {};
    var own = tr[locale] || tr[locale.split("-")[0]] || {};
    if (own[key]) return own[key];
    var parts = key.split(".");
    if (parts[0] === "tier") {
      var tier = (c.config.tiers || []).filter(function (x) { return x.id === parts[1]; })[0];
      return tier ? tier.label || "" : "";
    }
    if (parts[0] === "messages") return (c.config.messages || [])[Number(parts[1])] || "";
    return c.config[key] == null ? "" : String(c.config[key]);
  }
  function tierLabel(c, tier) { return ct(c, "tier." + tier.id + ".label"); }
  // Goal in shop currency. A fixed amount for the cart currency (Markets, e.g. EUR 45) wins over conversion.
  function tierTarget(c, tier) {
    var fixed = c.config.basis !== "quantity" && tier.thresholds && cart.currency ? tier.thresholds[cart.currency] : undefined;
    return fixed != null ? Number(fixed) / RATE : Number(tier.threshold || 0);
  }
  function tierUnlocked(campaign, tier, value) {
    return value + 1e-9 >= tierTarget(campaign, tier);
  }
  function bxgyState(c) {
    var cfg = c.config;
    var buyIds = (cfg.buyProducts || []).map(function (p) { return String(p.productId); });
    var getIds = (cfg.getProducts || []).map(function (p) { return String(p.productId); });
    var buyUnits = 0;
    var hasBuy = false;
    cart.items.forEach(function (item) {
      if (isGift(item) || prop(item, "_cartkit_bxgy")) return;
      if (buyIds.indexOf(productId(item)) > -1) {
        buyUnits += item.quantity;
        hasBuy = true;
      }
    });
    var overlap = getIds.some(function (id) { return buyIds.indexOf(id) > -1; });
    var buyQ = Math.max(1, Number(cfg.buyQuantity) || 1);
    var getQ = Math.max(1, Number(cfg.getQuantity) || 1);
    var sets = overlap ? Math.floor(buyUnits / (buyQ + getQ)) : Math.floor(buyUnits / buyQ);
    return { overlap: overlap, hasBuy: hasBuy, want: sets * getQ, unlocked: sets > 0 };
  }
  // Only free (100% off) "get" items are added for the shopper. A partly discounted item would raise the
  // cart total, so the shopper adds it themselves (App Store requirement 1.1.9: explicit buyer consent).
  function bxgyAutoAdd(c) {
    return !!c.config.autoAdd && Number(c.config.percent) >= 100;
  }

  // Works out which automatic lines (gifts, auto-added BXGY items, add-ons) must change.
  function planAutoLines() {
    var updates = {};
    var adds = [];
    var events = [];
    var hasReal = cart.items.some(function (i) { return isRealItem(i) && !prop(i, "_cartkit_bxgy"); });
    var validGiftKeys = {};

    campaignsOf("rewards").forEach(function (c) {
      var value = rewardsProgress(c);
      (c.config.tiers || []).forEach(function (tier) {
        if (tier.type !== "free_gift") return;
        var key = c.id + ":" + tier.id;
        validGiftKeys[key] = true;
        var lines = cart.items.filter(function (i) { return prop(i, "_cartkit_gift") === key; });
        var unlocked = hasReal && tierUnlocked(c, tier, value);
        if (!unlocked) {
          lines.forEach(function (l) { updates[l.key] = 0; });
          return;
        }
        lines.forEach(function (l, idx) {
          if (idx > 0) updates[l.key] = 0;
          else if (l.quantity !== 1) updates[l.key] = 1;
        });
        var gifts = tier.gifts || [];
        if (!lines.length && gifts.length === 1 && gifts[0].variantId && !declined.has(key) && !failedAdds.has(key)) {
          adds.push({ id: Number(gifts[0].variantId), quantity: 1, properties: { _cartkit_gift: key }, _key: key });
          events.push(["gift_added", null, c.id]);
        }
      });
    });
    cart.items.forEach(function (i) {
      var key = prop(i, "_cartkit_gift");
      if (key && !validGiftKeys[key]) updates[i.key] = 0;
    });

    campaignsOf("bxgy").forEach(function (c) {
      var cfg = c.config;
      var target = (cfg.getProducts || [])[0];
      var lines = cart.items.filter(function (i) { return prop(i, "_cartkit_bxgy") === c.id; });
      var have = lines.reduce(function (s, l) { return s + l.quantity; }, 0);
      var state = bxgyState(c);
      var want = bxgyAutoAdd(c) && !state.overlap ? state.want : 0;
      if (have > want) {
        lines.forEach(function (l, idx) { updates[l.key] = idx === 0 ? want : 0; });
      } else if (want > have && target && target.variantId && !declined.has("bxgy:" + c.id) && !failedAdds.has("bxgy:" + c.id)) {
        if (lines.length) updates[lines[0].key] = lines[0].quantity + (want - have);
        else {
          adds.push({ id: Number(target.variantId), quantity: want, properties: { _cartkit_bxgy: c.id }, _key: "bxgy:" + c.id });
          events.push(["bxgy_added", null, c.id]);
        }
      }
    });

    var addonIds = {};
    campaignsOf("addon").forEach(function (c) {
      addonIds[c.id] = true;
      var lines = cart.items.filter(function (i) { return prop(i, "_cartkit_addon") === c.id; });
      // Add-ons are paid, so they're never added or pre-selected for the shopper: only ticking the box adds one
      // (App Store requirement 1.1.9). Older configs may still carry defaultChecked; it's ignored.
      if (!hasReal) lines.forEach(function (l) { updates[l.key] = 0; });
    });
    cart.items.forEach(function (i) {
      var id = prop(i, "_cartkit_addon");
      if (id && !addonIds[id]) updates[i.key] = 0;
    });

    return { updates: updates, adds: adds, events: events };
  }

  var reconciling = false;
  function reconcile() {
    if (reconciling) return Promise.resolve();
    reconciling = true;
    var rounds = 0;
    function step() {
      var plan = planAutoLines();
      var hasUpdates = Object.keys(plan.updates).length > 0;
      if ((!hasUpdates && !plan.adds.length) || rounds++ >= 3) return Promise.resolve();
      var p = Promise.resolve();
      if (hasUpdates) p = p.then(function () { return updateCart({ updates: plan.updates }); });
      plan.adds.forEach(function (add) {
        var key = add._key;
        delete add._key;
        p = p.then(function () {
          return addItems([add]).catch(function () { failedAdds.add(key); });
        });
      });
      return p
        .then(function () {
          plan.events.forEach(function (e) { track(e[0], e[1], e[2]); });
          return getCart();
        })
        .then(step);
    }
    return step()
      .catch(function (e) { console.warn("CartKit:", e); })
      .then(function () { reconciling = false; });
  }

  // ---------------------------------------------------------------- DOM
  var root, drawer, els = {};
  var GLASS = S.design.glass ? " ck-glass" : "";
  var state = { open: false, busy: false, error: "", noteOpen: false, termsChecked: false, discountError: "", upsells: [], upsellKey: "" };

  function cssVars() {
    var d = S.design, st = S.sticky, f = S.floating;
    // Configs published before gradients existed have no checkoutStyle: use the gradient default.
    var gradient = d.checkoutStyle !== "solid";
    var vars = {
      "--ck-grad-from": gradient ? d.gradientFrom || "#4f46e5" : d.accentColor,
      "--ck-grad-to": gradient ? d.gradientTo || "#db2777" : d.accentColor,
      "--ck-checkout-text": gradient ? d.checkoutTextColor || "#ffffff" : d.accentTextColor,
      "--ck-accent": d.accentColor,
      "--ck-accent-text": d.accentTextColor,
      "--ck-bg": d.backgroundColor,
      "--ck-text": d.textColor,
      "--ck-muted": d.mutedColor,
      "--ck-border": d.borderColor,
      "--ck-progress": d.progressColor,
      "--ck-progress-bg": d.progressBackground,
      "--ck-badge": d.badgeColor,
      "--ck-radius": (Number(d.borderRadius) || 0) + "px",
      "--ck-font-size": (Number(d.fontSize) || 14) + "px",
      "--ck-overlay": (Number(d.overlayOpacity) || 0) / 100,
      "--ck-width": (Number(S.drawer.width) || 420) + "px",
      "--ck-sticky-bg": st.backgroundColor,
      "--ck-sticky-text": st.textColor,
      "--ck-sticky-btn": st.buttonColor,
      "--ck-sticky-btn-text": st.buttonTextColor,
      "--ck-float-size": (Number(f.size) || 56) + "px",
      "--ck-float-bg": f.backgroundColor,
      "--ck-float-icon": f.iconColor,
      "--ck-float-badge": f.badgeColor,
      "--ck-float-badge-text": f.badgeTextColor,
    };
    return Object.keys(vars).map(function (k) { return k + ":" + vars[k]; }).join(";");
  }

  var ICONS = {
    close: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    bag: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 016 0v2"/></svg>',
    trash: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    truck: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h11v9H3zM14 9h4l3 3v3h-7"/><circle cx="7" cy="17" r="1.6"/><circle cx="17" cy="17" r="1.6"/></svg>',
    gift: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0"/></svg>',
    percent: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 5L5 19"/><circle cx="7" cy="7" r="2"/><circle cx="17" cy="17" r="2"/></svg>',
    prev: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 6l-6 6 6 6"/></svg>',
    next: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>',
    lock: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path class="ck-arrow-shaft" d="M4 12h14"/><path class="ck-arrow-head" d="M12 6l6 6-6 6"/></svg>',
  };

  function buildRoot() {
    root = document.createElement("div");
    root.className = "ck-root ck-pos-" + (S.drawer.position === "left" ? "left" : "right") + GLASS;
    root.setAttribute("style", cssVars());
    root.innerHTML =
      '<div class="ck-overlay" data-ck="close"></div>' +
      '<aside class="ck-drawer" role="dialog" aria-modal="true" aria-label="' + esc(t("drawer.title")) + '" tabindex="-1">' +
      '<header class="ck-header"><h2 class="ck-title"></h2><button type="button" class="ck-close" data-ck="close" aria-label="Close">' + ICONS.close + "</button></header>" +
      '<div class="ck-announcement" hidden></div>' +
      '<div class="ck-goals"></div>' +
      '<div class="ck-body"><div class="ck-custom-top"></div><div class="ck-items"></div><div class="ck-promos"></div><div class="ck-upsells"></div></div>' +
      '<footer class="ck-footer"></footer>' +
      '<div class="ck-loading" aria-hidden="true"></div>' +
      "</aside>";
    document.body.appendChild(root);
    drawer = root.querySelector(".ck-drawer");
    ["title", "announcement", "goals", "body", "items", "promos", "upsells", "footer"].forEach(function (k) {
      els[k] = root.querySelector(".ck-" + k);
    });
    root.querySelector(".ck-custom-top").innerHTML = S.advanced.customHtmlTop || "";

    root.addEventListener("click", onDrawerClick);
    root.addEventListener("change", onDrawerChange);
    root.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && e.target.classList.contains("ck-discount-input")) {
        e.preventDefault();
        applyDiscount();
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && state.open) close();
    });

    if (S.advanced.customCss) {
      var style = document.createElement("style");
      style.textContent = S.advanced.customCss;
      document.head.appendChild(style);
    }
  }

  function render() {
    if (!root) return;
    var count = cart.items.filter(function (i) { return !isAddon(i); }).reduce(function (s, i) { return s + i.quantity; }, 0);
    els.title.innerHTML = esc(t("drawer.title")) + (count ? ' <span class="ck-count">' + count + "</span>" : "");
    root.classList.toggle("ck-busy", state.busy);
    renderAnnouncement();
    renderGoals();
    renderItems();
    renderPromos();
    renderUpsells();
    renderFooter();
    updateCounts(count);
  }

  function renderAnnouncement() {
    var c = campaignsOf("announcement")[0];
    if (!c) { els.announcement.hidden = true; return; }
    var cfg = c.config;
    var messages = (cfg.messages || []).map(function (m, i) { return ct(c, "messages." + i); }).filter(Boolean);
    var timer = cfg.timerEnabled && timerEnd(c) ? '<div class="ck-timer" data-ck-timer="' + esc(c.id) + '"></div>' : "";
    els.announcement.hidden = !messages.length && !timer;
    els.announcement.style.background = cfg.backgroundColor;
    els.announcement.style.color = cfg.textColor;
    els.announcement.innerHTML =
      '<div class="ck-announcement-messages">' +
      messages.map(function (m, i) { return '<div class="ck-announcement-msg' + (i === 0 ? " ck-active" : "") + '">' + m + "</div>"; }).join("") +
      "</div>" + timer;
    updateTimers();
  }

  // The countdown only shows a real deadline: the timer's end date, else the campaign's end date.
  // Per-visitor ("evergreen") timers restarted for every shopper, which is fake urgency (App Store
  // requirement 1.1.4), so old configs that still use them show no timer. 0 = no timer.
  function timerEnd(c) {
    var cfg = c.config;
    if (cfg.timerType === "evergreen") return 0;
    return Date.parse(cfg.timerEnd) || Date.parse(c.endsAt) || 0;
  }
  function updateTimers() {
    document.querySelectorAll("[data-ck-timer]").forEach(function (el) {
      var c = CAMPAIGNS.filter(function (x) { return x.id === el.getAttribute("data-ck-timer"); })[0];
      if (!c) return;
      var left = Math.max(0, timerEnd(c) - Date.now());
      if (!left && c.config.hideWhenExpired) { el.hidden = true; return; }
      var h = Math.floor(left / 3600000), m = Math.floor((left % 3600000) / 60000), s = Math.floor((left % 60000) / 1000);
      var pad = function (n) { return (n < 10 ? "0" : "") + n; };
      var time = (h >= 24 ? Math.floor(h / 24) + "d " + pad(h % 24) : pad(h)) + ":" + pad(m) + ":" + pad(s);
      el.innerHTML = fill(esc(ct(c, "timerText")), { timer: '<span class="ck-timer-value">' + time + "</span>" });
    });
  }
  var rotateIndex = 0;
  function rotateAnnouncements() {
    var msgs = els.announcement ? els.announcement.querySelectorAll(".ck-announcement-msg") : [];
    if (msgs.length < 2) return;
    msgs[rotateIndex % msgs.length].classList.remove("ck-active");
    rotateIndex++;
    msgs[rotateIndex % msgs.length].classList.add("ck-active");
  }

  function rewardIcon(type) {
    return type === "free_shipping" ? ICONS.truck : type === "free_gift" ? ICONS.gift : ICONS.percent;
  }
  function renderGoals() {
    var c = campaignsOf("rewards")[0];
    var tiers = c ? (c.config.tiers || []).slice().sort(function (a, b) { return tierTarget(c, a) - tierTarget(c, b); }) : [];
    if (!c || !tiers.length) { els.goals.innerHTML = ""; return; }
    var value = rewardsProgress(c);
    var max = tierTarget(c, tiers[tiers.length - 1]) || 1;
    var pct = Math.min(100, (value / max) * 100);
    var next = tiers.filter(function (tier) { return !tierUnlocked(c, tier, value); })[0];
    var message;
    if (next) {
      var remaining = tierTarget(c, next) - value;
      var remainingText = c.config.basis === "quantity"
        ? Math.ceil(remaining) + (Math.ceil(remaining) === 1 ? " item" : " items")
        : money(Math.ceil(remaining * RATE * 100));
      message = fill(esc(ct(c, "progressText")), { remaining: "<strong>" + esc(remainingText) + "</strong>", reward: "<strong>" + esc(tierLabel(c, next)) + "</strong>" });
    } else {
      message = esc(ct(c, "completeText"));
    }
    // Start the fill at the previous width so it animates, and pop milestones that were just unlocked.
    var from = goalState.pct == null ? pct : goalState.pct;
    var doneNow = {};
    els.goals.innerHTML =
      '<div class="ck-goal-message">' + message + "</div>" +
      '<div class="ck-progress"><div class="ck-progress-fill" style="width:' + from + '%"></div>' +
      tiers.map(function (tier) {
        var left = Math.min(100, (tierTarget(c, tier) / max) * 100);
        var done = tierUnlocked(c, tier, value);
        if (done) doneNow[tier.id] = true;
        var fresh = done && goalState.pct != null && !goalState.done[tier.id];
        return '<span class="ck-milestone' + (done ? " ck-done" : "") + (fresh ? " ck-just-done" : "") + '" style="left:' + left + '%" title="' + esc(tierLabel(c, tier)) + '">' + rewardIcon(tier.type) + "</span>";
      }).join("") +
      "</div>" +
      (tiers.length > 1
        ? '<div class="ck-milestone-labels">' + tiers.map(function (tier) {
            var left = Math.min(100, (tierTarget(c, tier) / max) * 100);
            return '<span style="left:' + left + '%">' + esc(tierLabel(c, tier)) + "</span>";
          }).join("") + "</div>"
        : "");
    goalState = { pct: pct, done: doneNow };
    if (from !== pct) {
      var bar = els.goals.querySelector(".ck-progress-fill");
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { bar.style.width = pct + "%"; });
      });
    }
  }
  var goalState = { pct: null, done: {} };

  function volumeHint(item) {
    var hints = [];
    campaignsOf("volume").forEach(function (c) {
      var cfg = c.config;
      var ids = (cfg.products || []).map(function (p) { return String(p.productId); });
      if (ids.length && ids.indexOf(productId(item)) < 0) return;
      var qty = cart.items.filter(function (i) {
        return isRealItem(i) && (cfg.combineProducts ? !ids.length || ids.indexOf(productId(i)) > -1 : productId(i) === productId(item));
      }).reduce(function (s, i) { return s + i.quantity; }, 0);
      var next = (cfg.tiers || []).slice().sort(function (a, b) { return a.minQuantity - b.minQuantity; })
        .filter(function (tier) { return tier.minQuantity > qty; })[0];
      if (next) hints.push(fill(esc(ct(c, "nextTierText")), { quantity: next.minQuantity - qty, percent: next.percent }));
    });
    return hints[0] || "";
  }

  function renderItems() {
    var items = cart.items.filter(function (i) { return !isAddon(i); });
    if (!items.length) {
      els.items.innerHTML =
        '<div class="ck-empty"><div class="ck-empty-icon">' + ICONS.bag + "</div><p>" + esc(t("drawer.emptyText")) + "</p>" +
        '<a class="ck-btn" href="' + esc(S.drawer.emptyButtonUrl || url("collections/all")) + '">' + esc(t("drawer.emptyButtonText")) + "</a></div>";
      return;
    }
    els.items.innerHTML = items.map(function (item) {
      var gift = isGift(item);
      var props = Object.keys(item.properties || {}).filter(function (k) {
        var v = item.properties[k];
        return k.charAt(0) !== "_" && v !== "" && v != null;
      }).map(function (k) { return "<div>" + esc(k) + ": " + esc(item.properties[k]) + "</div>"; }).join("");
      var discounts = (item.line_level_discount_allocations || []).map(function (d) {
        return '<span class="ck-badge">' + esc(d.discount_application.title) + " (-" + money(d.amount) + ")</span>";
      }).join("");
      var original = item.original_line_price > item.final_line_price && S.drawer.showCompareAt
        ? '<s class="ck-compare">' + money(item.original_line_price) + "</s>" : "";
      var hint = gift ? "" : volumeHint(item);
      return (
        '<div class="ck-item' + (gift ? " ck-item-gift" : "") + '" data-key="' + esc(item.key) + '">' +
        '<a class="ck-item-image" href="' + esc(item.url) + '">' + (item.image ? '<img src="' + esc(img(item.image, 160)) + '" alt="' + esc(item.product_title) + '" loading="lazy">' : "") + "</a>" +
        '<div class="ck-item-info">' +
        (S.drawer.showVendor && item.vendor ? '<div class="ck-vendor">' + esc(item.vendor) + "</div>" : "") +
        '<a class="ck-item-title" href="' + esc(item.url) + '">' + esc(item.product_title) + "</a>" +
        (!item.product_has_only_default_variant && item.variant_title ? '<div class="ck-variant">' + esc(item.variant_title) + "</div>" : "") +
        (item.selling_plan_allocation ? '<div class="ck-variant">' + esc(item.selling_plan_allocation.selling_plan.name) + "</div>" : "") +
        (props ? '<div class="ck-props">' + props + "</div>" : "") +
        (gift ? '<span class="ck-badge ck-badge-gift">' + ICONS.gift + " " + esc(giftLabel(item)) + "</span>" : discounts) +
        (hint ? '<div class="ck-hint">' + hint + "</div>" : "") +
        '<div class="ck-item-row">' +
        (gift
          ? "<span></span>"
          : '<div class="ck-qty"><button type="button" data-ck="dec" aria-label="Decrease quantity">−</button><span>' + item.quantity + '</span><button type="button" data-ck="inc" aria-label="Increase quantity">+</button></div>') +
        '<div class="ck-price">' + original + (gift && item.final_line_price === 0 ? '<span class="ck-price-free">FREE</span>' : "<span>" + money(item.final_line_price) + "</span>") + "</div>" +
        "</div></div>" +
        '<button type="button" class="ck-remove" data-ck="remove" aria-label="Remove">' + ICONS.trash + "</button>" +
        "</div>"
      );
    }).join("");
  }

  function giftLabel(item) {
    var key = prop(item, "_cartkit_gift");
    var label = "Free gift";
    campaignsOf("rewards").forEach(function (c) {
      (c.config.tiers || []).forEach(function (tier) {
        if (c.id + ":" + tier.id === key && tierLabel(c, tier)) label = tierLabel(c, tier);
      });
    });
    return label;
  }

  function renderPromos() {
    var html = "";
    var hasReal = cart.items.some(isRealItem);
    // Gift picker for tiers that offer several gifts.
    campaignsOf("rewards").forEach(function (c) {
      var value = rewardsProgress(c);
      (c.config.tiers || []).forEach(function (tier) {
        var key = c.id + ":" + tier.id;
        var gifts = tier.gifts || [];
        if (tier.type !== "free_gift" || gifts.length < 2 || !hasReal || !tierUnlocked(c, tier, value)) return;
        if (cart.items.some(function (i) { return prop(i, "_cartkit_gift") === key; })) return;
        html +=
          '<div class="ck-gift-picker"><div class="ck-section-title">' + ICONS.gift + " " + esc(ct(c, "giftPickerTitle")) + "</div>" +
          '<div class="ck-gift-options">' + gifts.map(function (g) {
            return '<button type="button" class="ck-gift-option" data-ck="pick-gift" data-gift-key="' + esc(key) + '" data-variant="' + esc(g.variantId) + '">' +
              (g.image ? '<img src="' + esc(img(g.image, 120)) + '" alt="" loading="lazy">' : "") + "<span>" + esc(giftTitle(g)) + "</span></button>";
          }).join("") + "</div></div>";
      });
    });
    campaignsOf("bxgy").forEach(function (c) {
      var st = bxgyState(c);
      var pct = Number(c.config.percent) || 0;
      var vars = { buyQuantity: c.config.buyQuantity, getQuantity: c.config.getQuantity, discount: pct >= 100 ? "free" : pct + "% off" };
      if (st.unlocked && bxgyAutoAdd(c) && !st.overlap) html += '<div class="ck-promo ck-promo-success">' + esc(fill(ct(c, "unlockedMessage"), vars)) + "</div>";
      else if (st.hasBuy) html += '<div class="ck-promo">' + esc(fill(ct(c, "message"), vars)) + "</div>";
    });
    els.promos.innerHTML = html;
  }

  // ---------------------------------------------------------------- upsells
  var productCache = {};
  // Gift names in the shopper's language: product JSON is fetched through the locale root (/fr/...).
  var giftTitles = {};
  function giftTitle(g) {
    var key = g.handle + ":" + g.variantId;
    if (giftTitles[key] === undefined && g.handle) {
      giftTitles[key] = null;
      fetchProduct(g.handle).then(function (p) {
        if (!p) return;
        var v = (p.variants || []).filter(function (x) { return String(x.id) === String(g.variantId); })[0];
        giftTitles[key] = p.title + (v && !p.has_only_default_variant && v.title !== "Default Title" ? " – " + v.title : "");
        renderPromos();
      });
    }
    return giftTitles[key] || g.title;
  }
  function fetchProduct(handle) {
    if (!productCache[handle]) {
      productCache[handle] = nativeFetch(url("products/" + encodeURIComponent(handle) + ".js"))
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    }
    return productCache[handle];
  }
  function loadUpsells() {
    var cfg = S.upsells;
    if (!cfg.enabled) return;
    var real = cart.items.filter(isRealItem);
    var inCart = real.map(productId);
    var key = inCart.join(",");
    if (key === state.upsellKey) return;
    state.upsellKey = key;
    if (!real.length) { state.upsells = []; renderUpsells(); return; }

    var limit = Math.max(1, Number(cfg.limit) || 3);
    var manual = Promise.resolve([]);
    var title = t("upsells.title");
    if (cfg.mode !== "auto") {
      var refs = [];
      campaignsOf("upsell").forEach(function (c) {
        var triggers = (c.config.triggerProducts || []).map(function (p) { return String(p.productId); });
        if (triggers.length && !triggers.some(function (id) { return inCart.indexOf(id) > -1; })) return;
        if (!refs.length && ct(c, "title")) title = ct(c, "title");
        refs = refs.concat(c.config.upsellProducts || []);
      });
      manual = Promise.all(refs.map(function (r) { return fetchProduct(r.handle); }));
    }
    var auto = cfg.mode === "manual"
      ? Promise.resolve([])
      : nativeFetch(url("recommendations/products.json?product_id=" + real[0].product_id + "&limit=" + (limit + inCart.length) + "&intent=" + (cfg.intent === "complementary" ? "complementary" : "related")))
          .then(function (r) { return r.ok ? r.json() : { products: [] }; })
          .then(function (d) { return d.products || []; })
          .catch(function () { return []; });

    Promise.all([manual, auto]).then(function (res) {
      var seen = {};
      var list = res[0].concat(res[1]).filter(function (p) {
        if (!p || seen[p.id] || inCart.indexOf(String(p.id)) > -1) return false;
        seen[p.id] = true;
        return (p.variants || []).some(function (v) { return v.available; });
      }).slice(0, limit);
      if (state.upsellKey !== key) return;
      state.upsells = list;
      state.upsellTitle = title;
      renderUpsells();
    });
  }
  function renderUpsells() {
    var list = state.upsells || [];
    if (!S.upsells.enabled || !list.length || !cart.items.some(isRealItem)) { els.upsells.innerHTML = ""; return; }
    var carousel = S.upsells.layout !== "list";
    els.upsells.innerHTML =
      '<div class="ck-section-head"><div class="ck-section-title">' + esc(state.upsellTitle || t("upsells.title")) + "</div>" +
      (carousel && list.length > 1 ? '<div class="ck-arrows"><button type="button" data-ck="up-prev" aria-label="Previous">' + ICONS.prev + '</button><button type="button" data-ck="up-next" aria-label="Next">' + ICONS.next + "</button></div>" : "") +
      "</div>" +
      '<div class="ck-upsell-list ' + (carousel ? "ck-carousel" : "ck-list") + '">' +
      list.map(function (p) {
        var variants = (p.variants || []).filter(function (v) { return v.available; });
        var v = variants[0];
        var image = p.featured_image || (p.images && p.images[0]) || "";
        var select = variants.length > 1
          ? '<select class="ck-upsell-variant" aria-label="Variant">' + variants.map(function (x) {
              return '<option value="' + x.id + '" data-price="' + x.price + '">' + esc(x.title) + "</option>";
            }).join("") + "</select>"
          : '<input type="hidden" class="ck-upsell-variant" value="' + v.id + '">';
        return '<div class="ck-upsell">' +
          '<a href="' + esc(url("products/" + p.handle)) + '" class="ck-upsell-image">' + (image ? '<img src="' + esc(img(image, 200)) + '" alt="" loading="lazy">' : "") + "</a>" +
          '<div class="ck-upsell-info"><a href="' + esc(url("products/" + p.handle)) + '" class="ck-upsell-title">' + esc(p.title) + "</a>" +
          '<div class="ck-upsell-price">' + money(v.price) + "</div>" + select +
          '<button type="button" class="ck-btn ck-btn-small" data-ck="upsell-add">' + esc(t("upsells.buttonText")) + "</button></div></div>";
      }).join("") + "</div>";
  }

  // ---------------------------------------------------------------- footer
  function renderFooter() {
    var d = S.drawer;
    var hasItems = cart.items.length > 0;
    var html = "";
    if (hasItems) {
      campaignsOf("addon").forEach(function (c) {
        var product = c.config.product;
        if (!product || !product.variantId) return;
        var line = cart.items.filter(function (i) { return prop(i, "_cartkit_addon") === c.id; })[0];
        var price = addonPrices[c.id];
        if (price == null && !addonLoading[c.id]) loadAddonPrice(c);
        html += '<label class="ck-addon"><input type="checkbox" data-ck-addon="' + esc(c.id) + '"' + (line ? " checked" : "") + ">" +
          (product.image ? '<img src="' + esc(img(product.image, 80)) + '" alt="">' : "") +
          "<span><strong>" + esc(fill(ct(c, "label"), { price: price == null ? "" : money(price) })) + "</strong>" +
          (ct(c, "description") ? "<small>" + esc(ct(c, "description")) + "</small>" : "") + "</span></label>";
      });

      if (d.showNote) {
        html += '<div class="ck-note"><button type="button" class="ck-link" data-ck="toggle-note">' + esc(t("drawer.noteLabel")) + "</button>" +
          (state.noteOpen || cart.note ? '<textarea class="ck-note-input" rows="2" placeholder="' + esc(t("drawer.notePlaceholder")) + '">' + esc(cart.note || "") + "</textarea>" : "") + "</div>";
      }
      if (d.showDiscountField) {
        var codes = (cart.discount_codes || []).filter(function (c) { return c.applicable; });
        var pending = pendingDiscount();
        html += '<div class="ck-discount"><div class="ck-discount-row"><input type="text" class="ck-discount-input" placeholder="' + esc(t("drawer.discountPlaceholder")) + '" autocomplete="off">' +
          '<button type="button" class="ck-btn ck-btn-outline" data-ck="apply-discount">' + esc(t("drawer.discountApplyText")) + "</button></div>" +
          (state.discountError ? '<div class="ck-error-text">' + esc(state.discountError) + "</div>" : "") +
          '<div class="ck-codes">' + codes.map(function (c) {
            return '<span class="ck-code">' + esc(c.code) + ' <button type="button" data-ck="remove-discount" data-code="' + esc(c.code) + '" aria-label="Remove">×</button></span>';
          }).join("") +
          (pending && !codes.length ? '<span class="ck-code">' + esc(pending) + ' <button type="button" data-ck="remove-discount" data-code="' + esc(pending) + '" aria-label="Remove">×</button></span>' : "") +
          "</div></div>";
      }
      html += '<div class="ck-custom-bottom">' + (S.advanced.customHtmlBottom || "") + "</div>";

      html += '<div class="ck-totals">';
      (cart.cart_level_discount_applications || []).forEach(function (a) {
        html += '<div class="ck-total-row ck-muted"><span>' + esc(a.title) + "</span><span>-" + money(a.total_allocated_amount) + "</span></div>";
      });
      if (d.showSavings && cart.total_discount > 0) {
        html += '<div class="ck-total-row ck-savings"><span>' + esc(t("drawer.savingsText")) + "</span><span>" + money(cart.total_discount) + "</span></div>";
      }
      if (d.showSubtotal) {
        html += '<div class="ck-total-row ck-subtotal"><span>' + esc(t("drawer.subtotalText")) + "</span><span>" + money(cart.total_price) + "</span></div>";
      }
      if (d.showTaxesText) html += '<div class="ck-taxes">' + esc(t("drawer.taxesText")) + "</div>";
      html += "</div>";

      if (d.showTerms) {
        html += '<label class="ck-terms"><input type="checkbox" class="ck-terms-input"' + (state.termsChecked ? " checked" : "") + "><span>" + t("drawer.termsText") + "</span></label>";
      }
      if (state.error) html += '<div class="ck-error-text">' + esc(state.error) + "</div>";
      html += '<button type="button" class="ck-btn ck-checkout" data-ck="checkout">' +
        '<span class="ck-checkout-label"><span class="ck-checkout-lock">' + ICONS.lock + "</span>" +
        esc(t("drawer.checkoutText")) + (d.showSubtotal ? "" : " · " + money(cart.total_price)) + "</span>" +
        '<span class="ck-checkout-arrow">' + ICONS.arrow + "</span></button>";
    }
    var links = [];
    if (d.showContinueShopping) links.push('<button type="button" class="ck-link" data-ck="close">' + esc(t("drawer.continueShoppingText")) + "</button>");
    if (d.showViewCart && hasItems) links.push('<a class="ck-link" href="' + esc(url("cart")) + '">' + esc(t("drawer.viewCartText")) + "</a>");
    if (links.length) html += '<div class="ck-links">' + links.join("") + "</div>";
    els.footer.innerHTML = html;
    els.footer.hidden = !html;
  }

  var addonPrices = {};
  var addonLoading = {};
  function loadAddonPrice(c) {
    addonLoading[c.id] = true;
    fetchProduct(c.config.product.handle).then(function (p) {
      if (!p) return;
      var v = (p.variants || []).filter(function (x) { return String(x.id) === String(c.config.product.variantId); })[0];
      addonPrices[c.id] = v ? v.price : p.price;
      renderFooter();
    });
  }

  function pendingDiscount() {
    var s = store("sessionStorage");
    return (s && s.getItem("cartkit_discount")) || "";
  }
  function setPendingDiscount(code) {
    var s = store("sessionStorage");
    try {
      if (!s) return;
      if (code) s.setItem("cartkit_discount", code);
      else s.removeItem("cartkit_discount");
    } catch (e) { /* ignore */ }
  }
  function applyDiscount() {
    var input = root.querySelector(".ck-discount-input");
    var code = input && input.value.trim();
    if (!code) return;
    state.discountError = "";
    var existing = (cart.discount_codes || []).filter(function (c) { return c.applicable; }).map(function (c) { return c.code; });
    withBusy(
      updateCart({ discount: existing.concat(code).join(",") })
        .then(getCart)
        .then(function () {
          var found = (cart.discount_codes || []).filter(function (c) { return c.code.toLowerCase() === code.toLowerCase(); })[0];
          if (!cart.discount_codes) {
            // Older cart API without discount support: apply at checkout instead.
            setPendingDiscount(code);
          } else if (!found || !found.applicable) {
            state.discountError = t("drawer.discountInvalidText");
            return updateCart({ discount: existing.join(",") }).then(getCart);
          } else {
            track("discount_applied");
          }
        }),
    );
  }
  function removeDiscount(code) {
    if (code === pendingDiscount()) setPendingDiscount("");
    var remaining = (cart.discount_codes || []).filter(function (c) { return c.applicable && c.code !== code; }).map(function (c) { return c.code; });
    withBusy(updateCart({ discount: remaining.join(",") }).then(getCart));
  }

  // ---------------------------------------------------------------- interactions
  function withBusy(promise) {
    state.busy = true;
    state.error = "";
    render();
    return promise
      .catch(function (e) { state.error = e.message; })
      .then(function () { return getCart().catch(function () {}); })
      .then(reconcile)
      .then(function () {
        state.busy = false;
        render();
        loadUpsells();
        emit("cart:updated", cart);
      });
  }

  function onDrawerClick(e) {
    var btn = e.target.closest("[data-ck]");
    if (!btn || !root.contains(btn)) return;
    var action = btn.getAttribute("data-ck");
    var itemEl = btn.closest(".ck-item");
    var item = itemEl && cart.items.filter(function (i) { return i.key === itemEl.getAttribute("data-key"); })[0];

    switch (action) {
      case "close": close(); break;
      case "inc": withBusy(changeLine(item.key, item.quantity + 1)); break;
      case "dec": withBusy(changeLine(item.key, item.quantity - 1)); break;
      case "remove":
        if (isGift(item)) declined.add(prop(item, "_cartkit_gift"));
        if (prop(item, "_cartkit_bxgy")) declined.add("bxgy:" + prop(item, "_cartkit_bxgy"));
        withBusy(changeLine(item.key, 0));
        break;
      case "pick-gift": {
        var key = btn.getAttribute("data-gift-key");
        declined.delete(key);
        withBusy(addItems([{ id: Number(btn.getAttribute("data-variant")), quantity: 1, properties: { _cartkit_gift: key } }]).then(function () {
          track("gift_added", null, key.split(":")[0]);
        }));
        break;
      }
      case "upsell-add": {
        var card = btn.closest(".ck-upsell");
        var sel = card.querySelector(".ck-upsell-variant");
        var opt = sel.options ? sel.options[sel.selectedIndex] : null;
        var price = opt ? Number(opt.getAttribute("data-price")) : null;
        withBusy(addItems([{ id: Number(sel.value), quantity: 1 }]).then(function () {
          track("upsell_add", price);
          ga("add_to_cart", { source: "cartkit_upsell" });
        }));
        break;
      }
      case "up-prev":
      case "up-next": {
        var list = root.querySelector(".ck-carousel");
        if (list) list.scrollBy({ left: (action === "up-next" ? 1 : -1) * list.clientWidth * 0.8, behavior: "smooth" });
        break;
      }
      case "toggle-note":
        state.noteOpen = !state.noteOpen;
        renderFooter();
        var ta = root.querySelector(".ck-note-input");
        if (ta) ta.focus();
        break;
      case "apply-discount": applyDiscount(); break;
      case "remove-discount": removeDiscount(btn.getAttribute("data-code")); break;
      case "checkout": checkout(); break;
    }
  }

  function onDrawerChange(e) {
    var el = e.target;
    if (el.classList.contains("ck-note-input")) {
      updateCart({ note: el.value }).then(function (c) { cart.note = c.note; });
    } else if (el.classList.contains("ck-terms-input")) {
      state.termsChecked = el.checked;
      state.error = "";
    } else if (el.hasAttribute("data-ck-addon")) {
      var id = el.getAttribute("data-ck-addon");
      var c = campaignsOf("addon").filter(function (x) { return x.id === id; })[0];
      if (!c) return;
      if (el.checked) {
        declined.delete("addon:" + id);
        failedAdds.delete("addon:" + id);
        withBusy(addItems([{ id: Number(c.config.product.variantId), quantity: 1, properties: { _cartkit_addon: id } }]).then(function () {
          track("addon_add", addonPrices[id], id);
        }));
      } else {
        declined.add("addon:" + id);
        var line = cart.items.filter(function (i) { return prop(i, "_cartkit_addon") === id; })[0];
        if (line) withBusy(changeLine(line.key, 0));
      }
    } else if (el.classList.contains("ck-upsell-variant")) {
      var opt = el.options[el.selectedIndex];
      var priceEl = el.closest(".ck-upsell").querySelector(".ck-upsell-price");
      if (opt && priceEl) priceEl.textContent = money(opt.getAttribute("data-price"));
    }
  }

  function checkout() {
    if (S.drawer.showTerms && !state.termsChecked) {
      state.error = t("drawer.termsError");
      renderFooter();
      return;
    }
    var note = root.querySelector(".ck-note-input");
    var saveNote = note && note.value !== (cart.note || "") ? updateCart({ note: note.value }) : Promise.resolve();
    track("checkout_click", cart.total_price);
    ga("begin_checkout", { currency: cart.currency, value: cart.total_price / 100 });
    flush();
    var code = pendingDiscount();
    saveNote.catch(function () {}).then(function () {
      window.location.href = url("checkout") + (code ? "?discount=" + encodeURIComponent(code) : "");
    });
  }

  function open() {
    if (!S.drawer.enabled) return;
    if (!root) buildRoot();
    if (!state.open) {
      state.open = true;
      root.classList.add("ck-open");
      document.documentElement.classList.add("ck-locked");
      setTimeout(function () { drawer.focus(); }, 50);
      track("drawer_open");
      ga("view_cart", { currency: cart.currency, value: cart.total_price / 100 });
      emit("open", cart);
    }
    render();
    loadUpsells();
  }
  function close() {
    if (!state.open) return;
    state.open = false;
    root.classList.remove("ck-open");
    document.documentElement.classList.remove("ck-locked");
    emit("close", cart);
  }

  var refreshing = null;
  function refresh() {
    if (refreshing) return refreshing;
    refreshing = getCart()
      .then(reconcile)
      .then(function () {
        render();
        updateCounts();
        if (state.open) loadUpsells();
        updateFloating();
        emit("cart:updated", cart);
        return cart;
      })
      .catch(function (e) { console.warn("CartKit:", e); })
      .then(function (c) { refreshing = null; return c; });
    return refreshing;
  }

  function afterAdd() {
    return refresh().then(function () {
      emit("item:added", cart);
      if (S.drawer.openOnAdd) open();
    });
  }

  // ---------------------------------------------------------------- theme integration
  var COUNT_SELECTORS = ["[data-cart-count]", ".cart-count", "#CartCount", ".cart-count-bubble span[aria-hidden='true']", ".cart-link__bubble-num"];
  function updateCounts(count) {
    if (count == null) count = cart.items.filter(function (i) { return !isAddon(i); }).reduce(function (s, i) { return s + i.quantity; }, 0);
    var selectors = COUNT_SELECTORS.concat(String(S.advanced.cartCountSelector || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean));
    selectors.forEach(function (sel) {
      try {
        document.querySelectorAll(sel).forEach(function (el) {
          if (!el.closest(".ck-root, .ck-float")) el.textContent = count;
        });
      } catch (e) { /* invalid selector */ }
    });
    updateFloating(count);
    refreshThemeCartIcon(count);
  }

  // Dawn-based themes only render the header count bubble when the cart has items: re-render the
  // theme's cart icon section (Section Rendering API) when the count changes.
  var themeIconCount = null;
  function refreshThemeCartIcon(count) {
    var icon = document.getElementById("cart-icon-bubble");
    if (!icon || count === themeIconCount) return;
    var first = themeIconCount === null;
    themeIconCount = count;
    if (first) return; // the page was rendered with the current cart
    nativeFetch(url("?sections=cart-icon-bubble"))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        var html = data && data["cart-icon-bubble"];
        if (!html) return;
        var section = new DOMParser().parseFromString(html, "text/html").querySelector(".shopify-section");
        if (section && themeIconCount === count) icon.innerHTML = section.innerHTML;
      })
      .catch(function () {});
  }

  function interceptForms() {
    document.addEventListener(
      "submit",
      function (e) {
        var form = e.target;
        if (!(form instanceof HTMLFormElement) || !S.drawer.enabled) return;
        var action = form.getAttribute("action") || "";
        if (!/\/cart\/add/.test(action) || form.closest(".ck-root")) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        var submit = form.querySelector('[type="submit"]');
        if (submit) submit.setAttribute("aria-busy", "true");
        api("cart/add.js", new FormData(form))
          .then(function () {
            track("item_add");
            ga("add_to_cart", { source: "cartkit" });
            return afterAdd();
          })
          .catch(function (err) {
            open();
            state.error = err.message;
            render();
          })
          .then(function () {
            if (submit) submit.removeAttribute("aria-busy");
          });
      },
      true,
    );
  }

  // Themes and other apps that add to cart with fetch/XHR: refresh (and open) the drawer afterwards.
  var CART_URL = /\/cart\/(add|change|update|clear)(\.js|\.json)?(\?|$)/;
  function watchNetwork() {
    window.fetch = function (input, init) {
      var reqUrl = typeof input === "string" ? input : input && input.url;
      return nativeFetch(input, init).then(function (res) {
        if (reqUrl && CART_URL.test(reqUrl) && res.ok) onExternalCartChange(/\/cart\/add/.test(reqUrl));
        return res;
      });
    };
    var origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, reqUrl) {
      this.__ckUrl = reqUrl;
      return origOpen.apply(this, arguments);
    };
    var origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function () {
      var xhr = this;
      if (xhr.__ckUrl && CART_URL.test(String(xhr.__ckUrl))) {
        xhr.addEventListener("load", function () {
          if (xhr.status >= 200 && xhr.status < 300) onExternalCartChange(/\/cart\/add/.test(String(xhr.__ckUrl)));
        });
      }
      return origSend.apply(this, arguments);
    };
  }
  var externalTimer = null;
  var externalAdd = false;
  function onExternalCartChange(isAdd) {
    externalAdd = externalAdd || isAdd;
    clearTimeout(externalTimer);
    externalTimer = setTimeout(function () {
      var wasAdd = externalAdd;
      externalAdd = false;
      if (wasAdd) afterAdd();
      else refresh();
    }, 80);
  }

  function interceptCartLinks() {
    if (!S.drawer.enabled || !S.drawer.interceptCartLinks) return;
    document.documentElement.classList.add("ck-hide-theme-cart");
    var selector = ['a[href$="/cart"]', 'a[href*="/cart?"]', "#cart-icon-bubble", "[data-cart-drawer-toggle]", ".js-cart-drawer-toggle"]
      .concat(String(S.advanced.cartIconSelector || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean))
      .join(",");
    document.addEventListener(
      "click",
      function (e) {
        var target;
        try { target = e.target.closest(selector); } catch (err) { return; }
        if (!target || target.closest(".ck-root") || e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        open();
      },
      true,
    );
  }

  // ---------------------------------------------------------------- floating cart
  var floatEl = null;
  function buildFloating() {
    var f = S.floating;
    if (!f.enabled || !S.drawer.enabled) return;
    floatEl = document.createElement("button");
    floatEl.type = "button";
    floatEl.className = "ck-float ck-float-" + (f.position || "bottom-right") + (f.showOnMobile ? "" : " ck-hide-mobile") + (f.showOnDesktop ? "" : " ck-hide-desktop") + GLASS;
    floatEl.setAttribute("aria-label", t("drawer.title"));
    floatEl.setAttribute("style", cssVars());
    floatEl.innerHTML = ICONS.bag + '<span class="ck-float-count"></span>';
    floatEl.addEventListener("click", open);
    document.body.appendChild(floatEl);
    updateFloating();
  }
  function updateFloating(count) {
    if (!floatEl) return;
    if (count == null) count = cart.items.filter(function (i) { return !isAddon(i); }).reduce(function (s, i) { return s + i.quantity; }, 0);
    var badge = floatEl.querySelector(".ck-float-count");
    if (badge.textContent !== "" && badge.textContent !== String(count)) {
      badge.classList.remove("ck-bump");
      void badge.offsetWidth; // restart the animation
      badge.classList.add("ck-bump");
    }
    badge.textContent = count;
    floatEl.classList.toggle("ck-empty-cart", !count);
    floatEl.hidden = S.floating.hideWhenEmpty && !count;
  }

  // ---------------------------------------------------------------- sticky add to cart
  function buildSticky() {
    var st = S.sticky;
    var product = CTX.product;
    if (!st.enabled || !product || CTX.template !== "product") return;
    var forms = Array.prototype.filter.call(document.querySelectorAll('form[action*="/cart/add"]'), function (f) {
      return f.querySelector('[name="id"]') && !f.closest(".ck-root, [id*='quick'], [class*='quick'], dialog, modal-dialog");
    });
    // Themes like Dawn render a hidden Shop Pay installments form first: use the form with a buy button.
    var form = forms.filter(function (f) { return f.querySelector('[type="submit"], button:not([type])'); })[0] || forms[0];
    var anchor = form && (form.querySelector('[type="submit"]') || form);
    if (!anchor) return;

    var variants = product.variants || [];
    var idInput = form.querySelector('[name="id"]');
    var selected = function () {
      var id = String(idInput && idInput.value);
      return variants.filter(function (v) { return String(v.id) === id; })[0] || variants.filter(function (v) { return v.available; })[0] || variants[0];
    };

    var bar = document.createElement("div");
    bar.className = "ck-sticky ck-sticky-" + (st.position === "top" ? "top" : "bottom") + (st.showOnMobile ? "" : " ck-hide-mobile") + (st.showOnDesktop ? "" : " ck-hide-desktop") + GLASS;
    bar.setAttribute("style", cssVars());
    var single = variants.length < 2 || product.has_only_default_variant;
    bar.innerHTML =
      '<div class="ck-sticky-inner">' +
      (st.showImage ? '<img class="ck-sticky-image" alt="">' : "") +
      '<div class="ck-sticky-info"><div class="ck-sticky-title">' + esc(product.title) + "</div>" +
      (st.showPrice ? '<div class="ck-sticky-price"></div>' : "") + "</div>" +
      (st.showVariantPicker && !single
        ? '<select class="ck-sticky-variant" aria-label="Variant">' + variants.map(function (v) {
            return '<option value="' + v.id + '"' + (v.available ? "" : " disabled") + ">" + esc(v.title) + (v.available ? "" : " – " + esc(t("sticky.soldOutText"))) + "</option>";
          }).join("") + "</select>"
        : "") +
      (st.showQuantity ? '<input class="ck-sticky-qty" type="number" min="1" value="1" aria-label="Quantity">' : "") +
      '<button type="button" class="ck-sticky-btn"></button>' +
      "</div>";
    document.body.appendChild(bar);

    var select = bar.querySelector(".ck-sticky-variant");
    var current = selected();
    function sync() {
      if (!current) return;
      if (select) select.value = String(current.id);
      var image = (current.featured_image && current.featured_image.src) || product.featured_image;
      var imgEl = bar.querySelector(".ck-sticky-image");
      if (imgEl && image) imgEl.src = img(image, 120);
      var priceEl = bar.querySelector(".ck-sticky-price");
      if (priceEl) {
        priceEl.innerHTML = (current.compare_at_price > current.price ? "<s>" + money(current.compare_at_price) + "</s> " : "") + money(current.price);
      }
      var btn = bar.querySelector(".ck-sticky-btn");
      btn.disabled = !current.available;
      btn.textContent = current.available ? t("sticky.buttonText") : t("sticky.soldOutText");
    }
    sync();
    if (select) {
      select.addEventListener("change", function () {
        current = variants.filter(function (v) { return String(v.id) === select.value; })[0] || current;
        sync();
      });
    }
    // Follow variant changes made in the theme's product form.
    form.addEventListener("change", function () {
      setTimeout(function () { current = selected(); sync(); }, 50);
    });
    bar.querySelector(".ck-sticky-btn").addEventListener("click", function () {
      var qtyEl = bar.querySelector(".ck-sticky-qty");
      var qty = Math.max(1, parseInt(qtyEl ? qtyEl.value : "1", 10) || 1);
      var btn = this;
      btn.disabled = true;
      addItems([{ id: current.id, quantity: qty }])
        .then(function () {
          track("sticky_add", current.price * qty);
          ga("add_to_cart", { source: "cartkit_sticky" });
          return afterAdd();
        })
        .catch(function (err) {
          open();
          state.error = err.message;
          render();
        })
        .then(function () { btn.disabled = false; });
    });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        var entry = entries[0];
        var show = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        bar.classList.toggle("ck-visible", show);
        document.documentElement.classList.toggle("ck-sticky-visible", show && st.position !== "top");
      }).observe(anchor);
    }
  }

  // ---------------------------------------------------------------- volume table block
  function renderVolumeTables() {
    document.querySelectorAll(".ck-volume-table[data-product-id]").forEach(function (el) {
      var pid = el.getAttribute("data-product-id");
      var price = Number(el.getAttribute("data-price")) || 0;
      var c = campaignsOf("volume").filter(function (x) {
        var ids = (x.config.products || []).map(function (p) { return String(p.productId); });
        return !ids.length || ids.indexOf(pid) > -1;
      })[0];
      if (!c) { el.innerHTML = ""; return; }
      var showEach = el.getAttribute("data-show-each") !== "false";
      var bestLabel = el.hasAttribute("data-best-label") ? el.getAttribute("data-best-label") : "Best value";
      var tiers = (c.config.tiers || []).slice().sort(function (a, b) { return a.minQuantity - b.minQuantity; });
      el.innerHTML = '<div class="ck-vt-title">' + esc(ct(c, "tableTitle")) + "</div>" +
        '<div class="ck-vt-rows">' + tiers.map(function (tier, i) {
          var best = bestLabel && tiers.length > 1 && i === tiers.length - 1;
          return '<div class="ck-vt-row' + (best ? " ck-vt-best" : "") + '">' +
            (best ? '<span class="ck-vt-tag">' + esc(bestLabel) + "</span>" : "") +
            '<span class="ck-vt-qty">Buy ' + tier.minQuantity + '+</span><span class="ck-vt-save">Save ' + tier.percent + "%</span>" +
            (price && showEach ? '<span class="ck-vt-each">' + money(price * (1 - tier.percent / 100)) + " each</span>" : "") + "</div>";
        }).join("") + "</div>";
    });
  }

  // ---------------------------------------------------------------- init
  function init() {
    if (S.drawer.enabled) {
      buildRoot();
      interceptForms();
      interceptCartLinks();
      watchNetwork();
    }
    buildFloating();
    buildSticky();
    renderVolumeTables();
    render();
    setInterval(updateTimers, 1000);
    setInterval(rotateAnnouncements, Math.max(2, Number((campaignsOf("announcement")[0] || { config: {} }).config.rotateSeconds) || 4) * 1000);
    refresh();
    window.addEventListener("pageshow", function (e) { if (e.persisted) refresh(); });
    // Theme editor: "Preview the cart drawer" setting of the app embed.
    if (CTX.designMode && CTX.previewDrawer) open();

    if (S.advanced.customJs) {
      try {
        new Function("CartKit", S.advanced.customJs)(window.CartKit);
      } catch (e) {
        console.error("CartKit custom JS error:", e);
      }
    }
    emit("ready", cart);
  }

  window.CartKit = {
    __loaded: true,
    open: open,
    close: close,
    refresh: refresh,
    getCart: function () { return cart; },
    addItems: function (items) { return addItems(items).then(afterAdd); },
    on: function (name, fn) { (listeners[name] = listeners[name] || []).push(fn); },
    off: function (name, fn) { listeners[name] = (listeners[name] || []).filter(function (f) { return f !== fn; }); },
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
