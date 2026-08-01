const SUPABASE_URL = "https://muujfgwspkoogjxtvcrp.supabase.co";
const SUPABASE_KEY = "sb_publishable_F6Q3yYsgbdiOBmo1u4Ar_Q_9SF6WrHx";

// Absichtlich derselbe Schlüssel wie in V4: bestehende Anmeldung bleibt erhalten.
const SESSION_KEY = "wo-ist-was-supabase-session-v4";
const LAST_VIEW_KEY =
  "wo-ist-was-last-view";

const LAST_SUPPLY_CATEGORY_KEY =
  "wo-ist-was-last-supply-category";

const PHOTO_BUCKET = 
  "item-photos";

let items = [];
let supplies = [];
let activeSupplyCategory = null;
let session = loadSession();
let pendingPhotoBlob = null;
let removeExistingPhoto = false;

const signedUrlCache = new Map();

const SYMBOL_RULES = [
  [["glühbirne", "leuchtmittel", "lampe", "led", "g9"], ["💡", "🔦", "✨"]],
  [["batterie", "akku"], ["🔋", "⚡", "🔌"]],
  [["blumendraht", "draht", "floristik"], ["🧵", "🌸", "🌿"]],
  [["werkzeug", "schraube", "hammer"], ["🔧", "🛠️", "🔨"]],
  [["weihnacht", "advent"], ["🎄", "⭐", "🎁"]],
  [["kabel", "ladegerät", "stecker"], ["🔌", "⚡", "🔋"]],
  [["pool", "chlor"], ["🏊", "💧", "🧪"]],
  [["fahrrad", "rad"], ["🚲", "🔧", "🛞"]],
  [["bastel", "schere", "kleber"], ["✂️", "🎨", "🧵"]],
  [["apfel", "obst"], ["🍎", "🍏", "🧺"]],
  [["dokument", "papier", "unterlagen"], ["📄", "📁", "🗂️"]],
  [["schlüssel"], ["🔑", "🗝️", "📍"]],
  [["garten", "pflanze"], ["🌿", "🌱", "🪴"]],
];

const $ = (selector) => document.querySelector(selector);

const els = {
  loginScreen: $("#loginScreen"),
  appShell: $("#appShell"),

  loginForm: $("#loginForm"),
  loginEmail: $("#loginEmail"),
  loginPassword: $("#loginPassword"),
  loginStatus: $("#loginStatus"),

  syncStatus: $("#syncStatus"),

  search: $("#searchInput"),
  clear: $("#clearSearch"),
  list: $("#itemsList"),
  empty: $("#emptyState"),
  count: $("#countText"),
  listTitle: $("#listTitle"),
  filters: $("#quickFilters"),

  add: $("#addBtn"),

  dialog: $("#itemDialog"),
  form: $("#itemForm"),
  dialogTitle: $("#dialogTitle"),
  id: $("#itemId"),

  symbol: $("#symbol"),
  suggestSymbol: $("#suggestSymbol"),
  symbolChoices: $("#symbolChoices"),

  name: $("#name"),
  roomSelect: $("#roomSelect"),
  roomCustom: $("#roomCustom"),
  location: $("#location"),
  keywords: $("#keywords"),
  note: $("#note"),

  photoInput: $("#photoInput"),
  photoPreview: $("#photoPreview"),
  photoPreviewWrap: $("#photoPreviewWrap"),
  removePhotoBtn: $("#removePhotoBtn"),

  closeDialog: $("#closeDialog"),
  cancel: $("#cancelBtn"),
  delete: $("#deleteBtn"),

  settingsBtn: $("#settingsBtn"),
  settingsDialog: $("#settingsDialog"),
  closeSettings: $("#closeSettings"),
  exportBtn: $("#exportBtn"),
  refreshBtn: $("#refreshBtn"),
  logoutBtn: $("#logoutBtn"),

  template: $("#itemTemplate"),

  suppliesList: $("#suppliesList"),
  addSupplyBtn: $("#addSupplyBtn"),
  supplySearchInput: $("#supplySearchInput"),
  clearSupplySearch: $("#clearSupplySearch"),
  supplySuggestions: $("#supplySuggestions"),
  supplyCategories: $("#supplyCategories"),
  suppliesHome: $("#suppliesHome"),
  suppliesCategoryView: $("#suppliesCategoryView"),
  backToSupplyCategories: $("#backToSupplyCategories"),
  supplyCategoryTitle: $("#supplyCategoryTitle"),
  supplyCategoryCount: $("#supplyCategoryCount"),
  
  supplyDialog: $("#supplyDialog"),
  supplyForm: $("#supplyForm"),
  supplyDialogTitle: $("#supplyDialogTitle"),
  supplyId: $("#supplyId"),
  supplyName: $("#supplyName"),
  supplySymbol: $("#supplySymbol"),
  supplyCategory: $("#supplyCategory"),
  supplyType: $("#supplyType"),
  supplyRoom: $("#supplyRoom"),
  supplyStorageLocation: $("#supplyStorageLocation"),
  supplyLocationNote: $("#supplyLocationNote"),
  supplyQuantity: $("#supplyQuantity"),
  supplyUnit: $("#supplyUnit"),
  supplyMinimumQuantity: $("#supplyMinimumQuantity"),
  supplyStockStatus: $("#supplyStockStatus"),
  supplyBestBefore: $("#supplyBestBefore"),
  supplyNote: $("#supplyNote"),
  closeSupplyDialog: $("#closeSupplyDialog"),
  cancelSupplyBtn: $("#cancelSupplyBtn"),
  deleteSupplyBtn: $("#deleteSupplyBtn"),
  suppliesHome: $("#suppliesHome"),
  suppliesCategoryView: $("#suppliesCategoryView"),
  backToSupplyCategories: $("#backToSupplyCategories"),
  supplyCategoryTitle: $("#supplyCategoryTitle"),
};

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function saveSession(value) {
  session = value;

  if (value) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(value));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

function normalize(value) {
  return (value ?? "")
    .toString()
    .toLocaleLowerCase("de-DE")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function keywordsToArray(value) {
  if (Array.isArray(value)) {
    return value.map(String);
  }

  return String(value || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function searchableText(item) {
  return normalize(
    [
      item.name,
      item.room,
      item.location,
      item.note,
      ...keywordsToArray(item.keywords),
    ].join(" ")
  );
}

function suggestFor(text) {
  const normalized = normalize(text);

  for (const [words, icons] of SYMBOL_RULES) {
    if (words.some((word) => normalized.includes(normalize(word)))) {
      return icons;
    }
  }

  return ["📦", "🏠", "📍"];
}

function setStatus(text, error = false) {
  if (!els.syncStatus) return;

  els.syncStatus.textContent = text;
  els.syncStatus.classList.toggle("error-text", error);
}

function selectedRoom() {
  return els.roomSelect.value === "__other__"
    ? els.roomCustom.value.trim()
    : els.roomSelect.value.trim();
}

function setRoomValue(room) {
  const knownRooms = [...els.roomSelect.options].map((option) => option.value);

  if (room && knownRooms.includes(room)) {
    els.roomSelect.value = room;
    els.roomCustom.value = "";
    els.roomCustom.classList.add("hidden");
    els.roomCustom.required = false;
  } else if (room) {
    els.roomSelect.value = "__other__";
    els.roomCustom.value = room;
    els.roomCustom.classList.remove("hidden");
    els.roomCustom.required = true;
  } else {
    els.roomSelect.value = "";
    els.roomCustom.value = "";
    els.roomCustom.classList.add("hidden");
    els.roomCustom.required = false;
  }
}

function renderSymbolChoices() {
  const icons = suggestFor(els.name.value);

  els.symbolChoices.innerHTML = "";

  icons.forEach((icon) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "symbol-choice";
    button.textContent = icon;

    button.addEventListener("click", () => {
      els.symbol.value = icon;
    });

    els.symbolChoices.appendChild(button);
  });
}

function clearPhotoState() {
  pendingPhotoBlob = null;
  removeExistingPhoto = false;

  els.photoInput.value = "";
  els.photoPreview.removeAttribute("src");
  els.photoPreviewWrap.classList.add("hidden");
}

async function authFetch(path, options = {}, retry = true) {
  const headers = new Headers(options.headers || {});

  headers.set("apikey", SUPABASE_KEY);

  if (session?.access_token) {
    headers.set("Authorization", "Bearer " + session.access_token);
  }

  const response = await fetch(SUPABASE_URL + path, {
    ...options,
    headers,
  });

  if (response.status === 401 && retry && session?.refresh_token) {
    const refreshed = await refreshSession();

    if (refreshed) {
      return authFetch(path, options, false);
    }
  }

  return response;
}

async function refreshSession() {
  try {
    const response = await fetch(
      SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token",
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          refresh_token: session.refresh_token,
        }),
      }
    );

    if (!response.ok) {
      saveSession(null);
      return false;
    }

    saveSession(await response.json());
    return true;
  } catch {
    return false;
  }
}

async function signIn(email, password) {
  const response = await fetch(
    SUPABASE_URL + "/auth/v1/token?grant_type=password",
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    }
  );

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      body.msg ||
        body.error_description ||
        body.message ||
        "Anmeldung fehlgeschlagen"
    );
  }

  saveSession(body);
}

async function compressImage(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () =>
      reject(new Error("Foto konnte nicht gelesen werden."));

    reader.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("Foto konnte nicht geöffnet werden."));

    image.src = dataUrl;
  });

  const maxSide = 1400;
  const scale = Math.min(
    1,
    maxSide / Math.max(img.naturalWidth, img.naturalHeight)
  );

  const canvas = document.createElement("canvas");

  canvas.width = Math.max(
    1,
    Math.round(img.naturalWidth * scale)
  );

  canvas.height = Math.max(
    1,
    Math.round(img.naturalHeight * scale)
  );

  const ctx = canvas.getContext("2d");

  ctx.drawImage(
    img,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Foto konnte nicht verkleinert werden."));
        }
      },
      "image/jpeg",
      0.8
    );
  });
}

async function uploadPhoto(blob) {
  const path =
    `${Date.now()}-` +
    `${Math.random().toString(36).slice(2, 10)}.jpg`;

  const response = await authFetch(
    `/storage/v1/object/${PHOTO_BUCKET}/${encodeURIComponent(path)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "image/jpeg",
        "x-upsert": "false",
      },
      body: blob,
    }
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));

    throw new Error(
      body.message ||
        body.error ||
        "Foto konnte nicht hochgeladen werden."
    );
  }

  return path;
}

async function deletePhoto(path) {
  if (!path) return;

  const response = await authFetch(
    `/storage/v1/object/${PHOTO_BUCKET}/${encodeURIComponent(path)}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    console.warn(
      "Foto konnte nicht gelöscht werden",
      await response.text().catch(() => "")
    );
  }

  signedUrlCache.delete(path);
}

async function getSignedPhotoUrl(path) {
  if (!path) return "";

  const cached = signedUrlCache.get(path);

  if (cached && cached.expires > Date.now()) {
    return cached.url;
  }

  const response = await authFetch(
    `/storage/v1/object/sign/${PHOTO_BUCKET}/${encodeURIComponent(path)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expiresIn: 3600,
      }),
    }
  );

  if (!response.ok) return "";

  const body = await response.json().catch(() => ({}));

  let url = body.signedURL || body.signedUrl || "";

  if (!url) return "";

  if (!url.startsWith("http")) {
    url = SUPABASE_URL + "/storage/v1" + url;
  }

  signedUrlCache.set(path, {
    url,
    expires: Date.now() + 55 * 60 * 1000,
  });

  return url;
}

async function showStoredPhoto(path) {
  const url = await getSignedPhotoUrl(path);

  if (url) {
    els.photoPreview.src = url;
    els.photoPreviewWrap.classList.remove("hidden");
  }
}

async function hydrateCardPhotos() {
  const wraps = [
    ...document.querySelectorAll(
      ".card-photo-wrap[data-photo-path]"
    ),
  ];

  await Promise.all(
    wraps.map(async (wrap) => {
      const url = await getSignedPhotoUrl(
        wrap.dataset.photoPath
      );

      if (url) {
        wrap.querySelector(".card-photo").src = url;
        wrap.classList.remove("hidden");
      }
    })
  );
}

async function loadItems() {
  setStatus("Daten werden geladen …");

  try {
    const response = await authFetch(
      "/rest/v1/items?select=*&order=name.asc"
    );

    const body = await response.json().catch(() => []);

    if (!response.ok) {
      throw new Error(
        body.message ||
          body.error ||
          "Fehler beim Laden"
      );
    }

    items = body || [];

    setStatus("");
    renderItems();
  } catch (error) {
    setStatus(
      "Daten konnten nicht geladen werden: " +
        error.message,
      true
    );
  }
}

async function loadSupplies() {
  if (!els.suppliesList) return;

  els.suppliesList.innerHTML =
    "<p>Vorräte werden geladen …</p>";

  try {
    const response = await authFetch(
      "/rest/v1/supplies?select=*&order=name.asc"
    );

    const body = await response.json().catch(() => []);

    if (!response.ok) {
      throw new Error(
        body.message ||
          body.error ||
          "Fehler beim Laden der Vorräte"
      );
    }

   supplies = body || [];

renderSupplyCategories();
  } catch (error) {
    els.suppliesList.innerHTML =
      `<p class="error-text">Vorräte konnten nicht geladen werden: ${error.message}</p>`;
  }
}

function renderFilters() {
  const rooms = [
    ...new Set(
      items
        .map((item) => item.room)
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b, "de"));

  els.filters.innerHTML = "";

  rooms.slice(0, 6).forEach((room) => {
    const button = document.createElement("button");

    button.className = "chip";
    button.textContent = room;

    button.addEventListener("click", () => {
      els.search.value = room;
      renderItems();
    });

    els.filters.appendChild(button);
  });
}

function renderItems() {
  const query = normalize(
    els.search.value.trim()
  );

  const filtered = items
    .filter(
      (item) =>
        !query ||
        searchableText(item).includes(query)
    )
    .sort((a, b) =>
      (a.name || "").localeCompare(
        b.name || "",
        "de"
      )
    );

  els.list.innerHTML = "";

  els.empty.classList.toggle(
    "hidden",
    filtered.length !== 0
  );

  els.listTitle.textContent =
    query
      ? "Suchergebnisse"
      : "Alle Dinge";

  els.count.textContent =
    `${filtered.length} ` +
    `${filtered.length === 1 ? "Eintrag" : "Einträge"}`;

  filtered.forEach((item) => {
    const node =
      els.template.content.cloneNode(true);

    const photoWrap =
      node.querySelector(".card-photo-wrap");

    if (item.photo_path) {
      photoWrap.dataset.photoPath =
        item.photo_path;
    }

    node.querySelector(
      ".item-symbol"
    ).textContent =
      item.symbol ||
      suggestFor(item.name)[0];

    node.querySelector(
      ".item-name"
    ).textContent =
      item.name || "";

    node.querySelector(
      ".item-location"
    ).textContent =
      [
        item.room,
        item.location,
      ]
        .filter(Boolean)
        .join(" → ");

    const extras = [];
    const keywords =
      keywordsToArray(item.keywords);

    if (keywords.length) {
      extras.push(
        `Suchbegriffe: ${keywords.join(", ")}`
      );
    }

    if (item.note) {
      extras.push(item.note);
    }

    node.querySelector(
      ".item-meta"
    ).textContent =
      extras.join(" · ");

    node.querySelector(
      ".card-main"
    ).addEventListener(
      "click",
      () => openEditItem(item.id)
    );

    els.list.appendChild(node);
  });

  renderFilters();
  hydrateCardPhotos();
}
function getBestBeforeInfo(bestBefore) {
  if (!bestBefore) {
    return { text: "", className: "" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const date = new Date(bestBefore + "T00:00:00");

  const days = Math.round(
    (date - today) / (1000 * 60 * 60 * 24)
  );

  const formatted = date.toLocaleDateString("de-DE");

  if (days < 0) {
    const overdue = Math.abs(days);

    return {
      text: `MHD ${formatted} · seit ${overdue} ${overdue === 1 ? "Tag" : "Tagen"} abgelaufen`,
      className: "mhd-expired"
    };
  }

  if (days === 0) {
    return {
      text: `MHD ${formatted} · heute`,
      className: "mhd-expired"
    };
  }

  if (days <= 7) {
    return {
      text: `MHD ${formatted} · noch ${days} ${days === 1 ? "Tag" : "Tage"}`,
      className: "mhd-soon"
    };
  }

  if (days <= 30) {
    return {
      text: `MHD ${formatted} · noch ${days} Tage`,
      className: "mhd-warning"
    };
  }

  return {
    text: `MHD ${formatted}`,
    className: "mhd-normal"
  };
}
function automaticSupplyStatus(quantity, minimumQuantity) {
  if (quantity == null || quantity === "") return null;

  const q = Number(quantity);

  if (!Number.isFinite(q)) return null;

  if (q <= 0) return "empty";

  if (minimumQuantity != null && minimumQuantity !== "") {
    const min = Number(minimumQuantity);

    if (Number.isFinite(min) && q <= min) {
      return "low";
    }
  }

  return "enough";
}

function supplyStatusText(supply) {
  const status =
    automaticSupplyStatus(
      supply.quantity,
      supply.minimum_quantity
    ) || supply.stock_status;

  if (status === "enough") return "Genug";
  if (status === "low") return "Wenig";
  if (status === "empty") return "Leer";

  return "";
}

async function changeSupplyQuantity(id, delta) {
  const supply = supplies.find(
    (entry) => String(entry.id) === String(id)
  );

  if (!supply) return;

  const current = Number(supply.quantity ?? 0);
  const next = Math.max(0, current + delta);

  const status = automaticSupplyStatus(
    next,
    supply.minimum_quantity
  );

  try {
    const response = await authFetch(
      "/rest/v1/supplies?id=eq." +
        encodeURIComponent(id),
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          quantity: next,
          stock_status: status,
        }),
      }
    );

    if (!response.ok) {
      const body = await response
        .json()
        .catch(() => ({}));

      throw new Error(
        body.message ||
        body.error ||
        "Bestand konnte nicht geändert werden"
      );
    }

    supply.quantity = next;
    supply.stock_status = status;

    if (activeSupplyCategory) {
  const filtered = supplies.filter(
    (item) => item.category === activeSupplyCategory
  );

  renderSupplies(filtered);
} else {
  renderSupplies();
}

  } catch (error) {
    alert(
      "Bestand konnte nicht geändert werden: " +
      error.message
    );
  }
}
function getCategoryIcon(category) {
  const icons = {
    Frühstück: "🥣",
    Backen: "🧁",
    Konserven: "🥫",
    Getränke: "🥤",
    Nudeln: "🍝",
    Grundnahrungsmittel: "🍝",
    Snacks: "🍫",
    Haushalt: "🧻",
    Hygiene: "🧴",
    Sonstiges: "📦"
  };

  return icons[category] || "📦";
}

function renderSupplySuggestions(query) {
  const q = normalize(query.trim());

  els.supplySuggestions.innerHTML = "";

  if (q.length < 2) {
    els.supplySuggestions.classList.add("hidden");
    return;
  }

const matches = supplies
  .filter((supply) => {
    const name = normalize(supply.name || "");
    return name.includes(q);
  })
  .slice(0, 8);

  if (matches.length === 0) {
    els.supplySuggestions.innerHTML = `
      <div class="supply-suggestion-empty">
        Nichts gefunden
      </div>
    `;

    els.supplySuggestions.classList.remove("hidden");
    return;
  }

  matches.forEach((supply) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "supply-suggestion";

    button.innerHTML = `
      <span class="supply-suggestion-name"></span>
      <span class="supply-suggestion-place"></span>
    `;

    button.querySelector(".supply-suggestion-name").textContent =
      supply.name || "";

  const info = button.querySelector(".supply-suggestion-place");
const quantity = Number(supply.quantity ?? 0);

info.textContent =
  `${supply.category || "Vorrat"} · ${quantity} ${supply.unit || ""}`;

info.classList.toggle("out-of-stock", quantity <= 0);
    button.addEventListener("click", () => {
      els.supplySuggestions.classList.add("hidden");
      els.supplySearchInput.value = supply.name || "";

      openEditSupply(supply.id);
    });

    els.supplySuggestions.appendChild(button);
  });

  els.supplySuggestions.classList.remove("hidden");
}

function searchSupplies(query) {
  const q = normalize(query.trim());

  if (!q) {
    els.suppliesCategoryView.classList.add("hidden");
    els.suppliesHome.classList.remove("hidden");
    renderSupplyCategories();
    return;
  }

  const filtered = supplies.filter((supply) => {
    const text = normalize([
      supply.name,
      supply.category,
      supply.room,
      supply.storage_location,
      supply.location_note,
      supply.note
    ].filter(Boolean).join(" "));

    return text.includes(q);
  });

  els.suppliesHome.classList.add("hidden");
  els.suppliesCategoryView.classList.remove("hidden");

  els.supplyCategoryTitle.textContent = "Suchergebnisse";
  els.supplyCategoryCount.textContent =
    `${filtered.length} ${filtered.length === 1 ? "Artikel" : "Artikel"}`;

  renderSupplies(filtered);
}

function renderSupplyCategories() {
  if (!els.supplyCategories) return;

  const categories = [...new Set(
    supplies
      .map((supply) => supply.category)
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, "de"));

  els.supplyCategories.innerHTML = "";

  categories.forEach((category) => {
    const categorySupplies = supplies.filter(
      (supply) => supply.category === category
    );

    const box = document.createElement("button");

    box.type = "button";
    box.className = "supply-category-box";

    box.innerHTML = `
      <div class="supply-category-icon">${getCategoryIcon(category)}</div>
      <div class="supply-category-name"></div>
      <div class="supply-category-info"></div>
    `;

    box.querySelector(".supply-category-name").textContent =
      category;

    box.querySelector(".supply-category-info").textContent =
      `${categorySupplies.length} ${
        categorySupplies.length === 1 ? "Artikel" : "Artikel"
      }`;

    box.addEventListener("click", () => {
      showSupplyCategory(category);
    });

    els.supplyCategories.appendChild(box);
  });
}

function showSupplyCategory(category) {
  activeSupplyCategory = category;

  localStorage.setItem(
    LAST_VIEW_KEY,
    "supplies"
  );

  localStorage.setItem(
    LAST_SUPPLY_CATEGORY_KEY,
    category
  );

  els.suppliesHome.classList.add(
    "hidden"
  );

  els.suppliesCategoryView.classList.remove(
    "hidden"
  );

  els.supplyCategoryTitle.textContent =
    category;

  els.backToSupplyCategories.textContent =
    `← ${category}`;

  const filtered = supplies.filter(
    (supply) =>
      supply.category === category
  );

  els.supplyCategoryCount.textContent =
    `${filtered.length} Artikel`;

  renderSupplies(filtered);
}
function renderSupplies(list = supplies) {
  if (!els.suppliesList) return;

  els.suppliesList.innerHTML = "";

  if (list.length === 0) {
    els.suppliesList.innerHTML = `
      <section class="empty">
        <div class="empty-icon">📦</div>
        <h3>Noch keine Vorräte</h3>
        <p>Hier erscheinen später Milch, Haferflocken, Konserven und alles andere.</p>
      </section>
    `;

    return;
  }

  list.forEach((supply) => {
    const card =
      document.createElement("article");

    card.className = "item-card";

    const quantity =
      supply.quantity != null
        ? `${supply.quantity}${
            supply.unit
              ? " " + supply.unit
              : ""
          }`
        : "";

    const place = [
      supply.room,
      supply.storage_location,
      supply.location_note,
    ]
      .filter(Boolean)
      .join(" → ");

  const bestBefore = getBestBeforeInfo(supply.best_before);

   const statusText = supplyStatusText(supply);

const meta = [
  statusText,
  supply.note,
]
  .filter(Boolean)
  .join(" · ");

card.innerHTML = `
  <div class="card-main">

    <div class="supply-board-layout">

      <span class="item-symbol">${
        supply.symbol || "📦"
      }</span>

      <div class="supply-quantity-controls">

        <button
          type="button"
          class="supply-qty-btn supply-minus"
          aria-label="Bestand verringern"
        >
          −
        </button>

        <div class="supply-quantity-center">

          <h3 class="item-name"></h3>

          <div class="supply-status-row">
            <span class="item-meta"></span>
            <span class="supply-status-separator">•</span>
            <span class="supply-qty-value"></span>
          </div>

          <p class="item-location supply-location"></p>

          <div class="mhd-text"></div>

        </div>

        <button
          type="button"
          class="supply-qty-btn supply-plus"
          aria-label="Bestand erhöhen"
        >
          ＋
        </button>

      </div>

      <span class="chevron">›</span>

    </div>

  </div>
`;


    card.querySelector(
      ".item-name"
    ).textContent =
      supply.name || "";

    card.querySelector(
      ".item-location"
    ).textContent =
      place;


    const metaEl = card.querySelector(".item-meta");

metaEl.textContent = meta;

metaEl.classList.remove(
  "status-empty",
  "status-low",
  "status-enough"
);

if (supply.stock_status === "empty") {
  metaEl.classList.add("status-empty");
} else if (supply.stock_status === "low") {
  metaEl.classList.add("status-low");
} else if (supply.stock_status === "enough") {
  metaEl.classList.add("status-enough");
}

    const mhdEl = card.querySelector(".mhd-text");

if (bestBefore.text) {
  mhdEl.textContent = bestBefore.text;
  mhdEl.className = `mhd-text ${bestBefore.className}`;
} else {
  mhdEl.textContent = "";
  mhdEl.className = "mhd-text";
}
    const qtyValue = card.querySelector(".supply-qty-value");

qtyValue.textContent =
  supply.quantity != null
    ? `${supply.quantity}${supply.unit ? " " + supply.unit : ""}`
    : `0${supply.unit ? " " + supply.unit : ""}`;

card.querySelector(".supply-minus").addEventListener(
  "click",
  async (event) => {
    event.stopPropagation();
    await changeSupplyQuantity(supply.id, -1);
  }
);

card.querySelector(".supply-plus").addEventListener(
  "click",
  async (event) => {
    event.stopPropagation();
    await changeSupplyQuantity(supply.id, 1);
  }
);    
   card.querySelector(".item-name").addEventListener(
  "click",
  () => openEditSupply(supply.id)
);

card.querySelector(".chevron").addEventListener(
  "click",
  () => openEditSupply(supply.id)
);

    els.suppliesList.appendChild(card);
  });
}

function openNewItem() {
  els.form.reset();
  clearPhotoState();
  setRoomValue("");

  els.id.value = "";
  els.symbol.value = "";

  els.dialogTitle.textContent =
    "Neuen Gegenstand eintragen";

  els.delete.classList.add("hidden");

  renderSymbolChoices();

  els.dialog.showModal();
}

function openEditItem(id) {
  const item =
    items.find(
      (entry) =>
        String(entry.id) === String(id)
    );

  if (!item) return;

  els.form.reset();
  clearPhotoState();

  els.id.value = item.id;

  els.symbol.value =
    item.symbol ||
    suggestFor(item.name)[0];

  els.name.value =
    item.name || "";

  setRoomValue(
    item.room || ""
  );

  els.location.value =
    item.location || "";

  els.keywords.value =
    keywordsToArray(
      item.keywords
    ).join(", ");

  els.note.value =
    item.note || "";

  els.dialogTitle.textContent =
    "Eintrag bearbeiten";

  els.delete.classList.remove("hidden");

  renderSymbolChoices();

  els.dialog.showModal();

  if (item.photo_path) {
    showStoredPhoto(item.photo_path);
  }
}

function openNewSupply() {
  els.supplyForm.reset();

  els.supplyId.value = "";

  els.supplyDialogTitle.textContent =
    "Neuen Vorrat eintragen";

  els.deleteSupplyBtn.classList.add(
    "hidden"
  );

  els.supplyDialog.showModal();
}

function openEditSupply(id) {
  const supply =
    supplies.find(
      (entry) =>
        String(entry.id) === String(id)
    );

  if (!supply) return;

  els.supplyForm.reset();

  els.supplyId.value =
    supply.id;

  els.supplyName.value =
    supply.name || "";

  els.supplySymbol.value =
    supply.symbol || "";

  els.supplyCategory.value =
    supply.category || "";

  els.supplyType.value =
    supply.supply_type || "";

  els.supplyRoom.value =
    supply.room || "";

  els.supplyStorageLocation.value =
    supply.storage_location || "";

  els.supplyLocationNote.value =
    supply.location_note || "";

  els.supplyQuantity.value =
    supply.quantity ?? "";

  els.supplyUnit.value =
    supply.unit || "";

  els.supplyMinimumQuantity.value =
    supply.minimum_quantity ?? "";

  els.supplyStockStatus.value =
    supply.stock_status || "";

  els.supplyBestBefore.value =
    supply.best_before || "";

  els.supplyNote.value =
    supply.note || "";

  els.supplyDialogTitle.textContent =
    "Vorrat bearbeiten";

  els.deleteSupplyBtn.classList.remove(
    "hidden"
  );

  els.supplyDialog.showModal();
}
  
async function showSession() {
  const signedIn =
    !!session?.access_token;

  els.loginScreen.classList.toggle(
    "hidden",
    signedIn
  );

  els.appShell.classList.toggle(
    "hidden",
    !signedIn
  );

  if (signedIn) {
    await loadItems();
    await loadSupplies();

  }
}

els.loginForm.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    els.loginStatus.textContent =
      "Anmeldung läuft …";

    els.loginStatus.classList.remove(
      "error-text"
    );

    try {
      await signIn(
        els.loginEmail.value.trim(),
        els.loginPassword.value
      );

      els.loginStatus.textContent = "";

      await showSession();
    } catch (error) {
      els.loginStatus.textContent =
        "Anmeldung fehlgeschlagen: " +
        error.message;

      els.loginStatus.classList.add(
        "error-text"
      );
    }
  }
);

els.form.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    const room =
      selectedRoom();

    if (!room) {
      els.roomSelect.focus();
      return;
    }

    const oldItem =
      els.id.value
        ? items.find(
            (item) =>
              String(item.id) ===
              String(els.id.value)
          )
        : null;

    const oldPath =
      oldItem?.photo_path || null;

    let newPath = null;

    const record = {
      name:
        els.name.value.trim(),

      symbol:
        els.symbol.value.trim() ||
        suggestFor(
          els.name.value
        )[0],

      room,

      location:
        els.location.value.trim(),

      keywords:
        els.keywords.value
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
          .join(", "),

      note:
        els.note.value.trim(),
    };

    if (!record.name) return;

    setStatus("Speichern …");

    try {
      if (pendingPhotoBlob) {
        newPath =
          await uploadPhoto(
            pendingPhotoBlob
          );

        record.photo_path =
          newPath;
      } else if (
        removeExistingPhoto
      ) {
        record.photo_path =
          null;
      }

      let response;

      if (els.id.value) {
        response =
          await authFetch(
            "/rest/v1/items?id=eq." +
              encodeURIComponent(
                els.id.value
              ),
            {
              method: "PATCH",
              headers: {
                "Content-Type":
                  "application/json",
                Prefer:
                  "return=minimal",
              },
              body:
                JSON.stringify(
                  record
                ),
            }
          );
      } else {
        response =
          await authFetch(
            "/rest/v1/items",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
                Prefer:
                  "return=minimal",
              },
              body:
                JSON.stringify(
                  record
                ),
            }
          );
      }

      if (!response.ok) {
        const body =
          await response
            .json()
            .catch(() => ({}));

        throw new Error(
          body.message ||
            body.error ||
            "Speichern fehlgeschlagen"
        );
      }

      if (
        oldPath &&
        (
          pendingPhotoBlob ||
          removeExistingPhoto
        )
      ) {
        await deletePhoto(
          oldPath
        );
      }

      clearPhotoState();

      els.dialog.close();

      await loadItems();
    } catch (error) {
      if (newPath) {
        await deletePhoto(
          newPath
        );
      }

      setStatus(
        "Speichern fehlgeschlagen: " +
          error.message,
        true
      );
    }
  }
);

els.supplyForm.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    const record = {
      name:
        els.supplyName.value.trim(),

      symbol:
        els.supplySymbol.value.trim() ||
        "📦",

      category:
        els.supplyCategory.value ||
        null,

      supply_type:
        els.supplyType.value ||
        null,

      room:
        els.supplyRoom.value.trim() ||
        null,

      storage_location:
        els.supplyStorageLocation
          .value
          .trim() || null,

      location_note:
        els.supplyLocationNote
          .value
          .trim() || null,

      quantity:
        els.supplyQuantity.value === ""
          ? null
          : Number(
              els.supplyQuantity.value
            ),

      unit:
        els.supplyUnit.value ||
        null,

      minimum_quantity:
        els.supplyMinimumQuantity
          .value === ""
          ? null
          : Number(
              els
                .supplyMinimumQuantity
                .value
            ),

      stock_status:
        els.supplyStockStatus.value ||
        null,

      best_before:
        els.supplyBestBefore.value ||
        null,

      note:
        els.supplyNote.value.trim() ||
        null,
    };

    if (!record.name) {
  return;
}

record.stock_status =
  automaticSupplyStatus(
    record.quantity,
    record.minimum_quantity
  ) || record.stock_status;

try {
      let response;

      if (els.supplyId.value) {
        response =
          await authFetch(
            "/rest/v1/supplies?id=eq." +
              encodeURIComponent(
                els.supplyId.value
              ),
            {
              method: "PATCH",
              headers: {
                "Content-Type":
                  "application/json",
                Prefer:
                  "return=minimal",
              },
              body:
                JSON.stringify(
                  record
                ),
            }
          );
      } else {
        response =
          await authFetch(
            "/rest/v1/supplies",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
                Prefer:
                  "return=minimal",
              },
              body:
                JSON.stringify(
                  record
                ),
            }
          );
      }

      if (!response.ok) {
        const body =
          await response
            .json()
            .catch(() => ({}));

        throw new Error(
          body.message ||
            body.error ||
            "Speichern fehlgeschlagen"
        );
      }

      els.supplyDialog.close();

      await loadSupplies();
  
      if (activeSupplyCategory) {
        showSupplyCategory(activeSupplyCategory);
      }
    } catch (error) {
      alert(
        "Vorrat konnte nicht gespeichert werden: " +
          error.message
      );
    }
  }
);

els.delete.addEventListener(
  "click",
  async () => {
    const id =
      els.id.value;

    if (
      !id ||
      !confirm(
        "Diesen Eintrag wirklich löschen?"
      )
    ) {
      return;
    }

    try {
      const oldItem =
        items.find(
          (item) =>
            String(item.id) ===
            String(id)
        );

      const response =
        await authFetch(
          "/rest/v1/items?id=eq." +
            encodeURIComponent(id),
          {
            method: "DELETE",
          }
        );

      if (!response.ok) {
        throw new Error(
          "Löschen fehlgeschlagen"
        );
      }

      if (
        oldItem?.photo_path
      ) {
        await deletePhoto(
          oldItem.photo_path
        );
      }

      clearPhotoState();

      els.dialog.close();

      await loadItems();
    } catch (error) {
      setStatus(
        error.message,
        true
      );
    }
  }
);

els.deleteSupplyBtn.addEventListener(
  "click",
  async () => {
    const id =
      els.supplyId.value;

    if (!id) return;

    if (
      !confirm(
        "Diesen Vorrat wirklich löschen?"
      )
    ) {
      return;
    }

    try {
      const response =
        await authFetch(
          "/rest/v1/supplies?id=eq." +
            encodeURIComponent(id),
          {
            method: "DELETE",
          }
        );

      if (!response.ok) {
        throw new Error(
          "Löschen fehlgeschlagen"
        );
      }

      els.supplyDialog.close();

      await loadSupplies();
    } catch (error) {
      alert(error.message);
    }
  }
);

els.roomSelect.addEventListener(
  "change",
  () => {
    const custom =
      els.roomSelect.value ===
      "__other__";

    els.roomCustom.classList.toggle(
      "hidden",
      !custom
    );

    els.roomCustom.required =
      custom;

    if (custom) {
      setTimeout(
        () =>
          els.roomCustom.focus(),
        50
      );
    }
  }
);

els.photoInput.addEventListener(
  "change",
  async () => {
    const file =
      els.photoInput.files?.[0];

    if (!file) return;

    try {
      setStatus(
        "Foto wird vorbereitet …"
      );

      pendingPhotoBlob =
        await compressImage(
          file
        );

      removeExistingPhoto =
        false;

      els.photoPreview.src =
        URL.createObjectURL(
          pendingPhotoBlob
        );

      els.photoPreviewWrap.classList.remove(
        "hidden"
      );

      setStatus("");
    } catch (error) {
      setStatus(
        "Foto konnte nicht verarbeitet werden: " +
          error.message,
        true
      );
    }
  }
);

els.removePhotoBtn.addEventListener(
  "click",
  () => {
    pendingPhotoBlob = null;
    removeExistingPhoto = true;

    els.photoInput.value = "";

    els.photoPreview.removeAttribute(
      "src"
    );

    els.photoPreviewWrap.classList.add(
      "hidden"
    );
  }
);

els.search.addEventListener(
  "input",
  renderItems
);

els.clear.addEventListener(
  "click",
  () => {
    els.search.value = "";
    renderItems();
    els.search.focus();
  }
);

els.backToSupplyCategories.addEventListener("click", () => {
  activeSupplyCategory = null;

    localStorage.setItem(
    LAST_VIEW_KEY,
    "supplies"
  );

  localStorage.removeItem(
    LAST_SUPPLY_CATEGORY_KEY
  );
  
  els.suppliesCategoryView.classList.add("hidden");
  els.suppliesHome.classList.remove("hidden");
});

els.add.addEventListener(
  "click",
  openNewItem
);

els.addSupplyBtn.addEventListener(
  "click",
  openNewSupply
);

els.closeDialog.addEventListener(
  "click",
  () => {
    els.dialog.close();
  }
);

els.cancel.addEventListener(
  "click",
  () => {
    els.dialog.close();
  }
);

els.closeSupplyDialog.addEventListener(
  "click",
  () => {
    els.supplyDialog.close();
  }
);

els.cancelSupplyBtn.addEventListener(
  "click",
  () => {
    els.supplyDialog.close();
  }
);

els.supplySearchInput.addEventListener("input", () => {
  renderSupplySuggestions(els.supplySearchInput.value);
});

els.clearSupplySearch.addEventListener("click", () => {
  els.supplySearchInput.value = "";
  els.supplySuggestions.innerHTML = "";
  els.supplySuggestions.classList.add("hidden");
  els.supplySearchInput.focus();
});

els.settingsBtn.addEventListener(
  "click",
  () => {
    els.settingsDialog.showModal();
  }
);

els.closeSettings.addEventListener(
  "click",
  () => {
    els.settingsDialog.close();
  }
);

els.refreshBtn.addEventListener(
  "click",
  async () => {
    els.settingsDialog.close();

    await loadItems();
    await loadSupplies();
  }
);

els.logoutBtn.addEventListener(
  "click",
  () => {
    els.settingsDialog.close();

    saveSession(null);

    items = [];
    supplies = [];

    renderItems();
    renderSupplies();

    showSession();
  }
);

els.exportBtn.addEventListener(
  "click",
  () => {
    const data = {
      items,
      supplies,
    };

    const blob =
      new Blob(
        [
          JSON.stringify(
            data,
            null,
            2
          ),
        ],
        {
          type: "application/json",
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href = url;

    link.download =
      `haushaltszentrale-sicherung-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;

    link.click();

    URL.revokeObjectURL(
      url
    );
  }
);

els.name.addEventListener(
  "input",
  renderSymbolChoices
);

els.suggestSymbol.addEventListener(
  "click",
  () => {
    const icons =
      suggestFor(
        els.name.value
      );

    els.symbol.value =
      icons[0];

    renderSymbolChoices();
  }
);

const navButtons =
  document.querySelectorAll(
    ".nav-btn"
  );

const appViews =
  document.querySelectorAll(
    ".app-view"
  );

navButtons.forEach(
  (button) => {
    button.addEventListener(
      "click",
      async () => {
        const targetView =
          button.dataset.view;

        navButtons.forEach(
          (btn) =>
            btn.classList.remove(
              "active"
            )
        );

        button.classList.add(
          "active"
        );

        appViews.forEach(
          (view) =>
            view.classList.add(
              "hidden"
            )
        );

        const target =
          document.getElementById(
            `${targetView}View`
          );

        if (target) {
          target.classList.remove(
            "hidden"
          );
        }

        if (
          targetView ===  "supplies"    ) {
          activeSupplyCategory = null;
          
          els.suppliesCategoryView.classList.add(
            "hidden"
          );

          els.suppliesHome.classList.remove(
            "hidden"
          );

          els.supplySearchInput.value =
            "";

          els.supplySuggestions.innerHTML =
            "";

          els.supplySuggestions.classList.add(
            "hidden"
          );

          await loadSupplies();

          renderSupplyCategories();
        }
      }
    );
  }
);
if (
  "serviceWorker" in navigator
) {
  window.addEventListener(
    "load",
    async () => {
      try {
        const registrations =
          await navigator.serviceWorker.getRegistrations();

        for (
          const registration
          of registrations
        ) {
          await registration.update();
        }

        await navigator.serviceWorker.register(
          "./sw.js?v=6"
        );
      } catch (error) {
        console.warn(error);
      }
    }
  );
}

showSession();
