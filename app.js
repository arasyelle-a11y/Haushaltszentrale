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
let supplyCategories = [];
let shoppingItems = [];
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
  addSupplyInCategoryBtn: $("#addSupplyInCategoryBtn"),
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
  supplyCategoryChoices: $("#supplyCategoryChoices"),
  supplyNewCategoryToggle: $("#supplyNewCategoryToggle"),
  supplyNewCategoryWrap: $("#supplyNewCategoryWrap"),
  supplyNewCategoryName: $("#supplyNewCategoryName"),
  supplyRoom: $("#supplyRoom"),
  supplyStorageLocation: $("#supplyStorageLocation"),
  supplyQuantity: $("#supplyQuantity"),
  supplyUnit: $("#supplyUnit"),
  supplyMinimumQuantity: $("#supplyMinimumQuantity"),
  supplyBestBefore: $("#supplyBestBefore"),
  supplyNote: $("#supplyNote"),
  closeSupplyDialog: $("#closeSupplyDialog"),
  cancelSupplyBtn: $("#cancelSupplyBtn"),
  deleteSupplyBtn: $("#deleteSupplyBtn"),
  suppliesHome: $("#suppliesHome"),
  suppliesCategoryView: $("#suppliesCategoryView"),
  backToSupplyCategories: $("#backToSupplyCategories"),
  supplyCategoryTitle: $("#supplyCategoryTitle"),

  shoppingList: $("#shoppingList"),
  shoppingDoneList: $("#shoppingDoneList"),
  shoppingDoneSection: $("#shoppingDoneSection"),
  shoppingEmpty: $("#shoppingEmpty"),
  shoppingCountText: $("#shoppingCountText"),
  shoppingStatus: $("#shoppingStatus"),
  quickShoppingForm: $("#quickShoppingForm"),
  quickShoppingName: $("#quickShoppingName"),
  quickShoppingQuantity: $("#quickShoppingQuantity"),
  quickShoppingUnit: $("#quickShoppingUnit"),
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


function setShoppingStatus(text, error = false) {
  if (!els.shoppingStatus) return;

  els.shoppingStatus.textContent = text;
  els.shoppingStatus.classList.toggle("error-text", error);
}

function shoppingAmountForSupply(supply) {
  const current = Number(supply.quantity ?? 0);
  const minimum = Number(supply.minimum_quantity ?? 0);

  if (!Number.isFinite(current) || !Number.isFinite(minimum)) {
    return 1;
  }

  return Math.max(1, minimum + 1 - current);
}

function openShoppingItemForSupply(supplyId) {
  return shoppingItems.find(
    (item) =>
      !item.checked &&
      String(item.supply_id) === String(supplyId)
  );
}

async function loadShoppingItems() {
  if (!els.shoppingList) return;

  try {
    const response = await authFetch(
      "/rest/v1/shopping_items?select=*&order=checked.asc,created_at.asc"
    );

    const body = await response.json().catch(() => []);

    if (!response.ok) {
      throw new Error(
        body.message ||
        body.error ||
        "Einkaufsliste konnte nicht geladen werden"
      );
    }

    shoppingItems = body || [];
    setShoppingStatus("");
    renderShoppingItems();
  } catch (error) {
    setShoppingStatus(error.message, true);
  }
}

async function createShoppingItem({
  supply = null,
  name,
  quantity = null,
  unit = null,
  automatic = false,
}) {
  if (supply && openShoppingItemForSupply(supply.id)) {
    return openShoppingItemForSupply(supply.id);
  }

  const record = {
    supply_id: supply?.id ?? null,
    name: String(name || supply?.name || "").trim(),
    quantity:
      quantity == null || quantity === ""
        ? null
        : Number(quantity),
    unit: String(unit || supply?.unit || "").trim() || null,
    checked: false,
    added_automatically: automatic,
    updated_at: new Date().toISOString(),
  };

  if (!record.name) {
    throw new Error("Bitte einen Artikelnamen eingeben.");
  }

  const response = await authFetch(
    "/rest/v1/shopping_items",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(record),
    }
  );

  const body = await response.json().catch(() => []);

  if (!response.ok) {
    throw new Error(
      body.message ||
      body.error ||
      "Artikel konnte nicht zur Einkaufsliste hinzugefügt werden"
    );
  }

  const created = Array.isArray(body) ? body[0] : body;

  if (created) {
    shoppingItems.push(created);
  }

  renderShoppingItems();
  return created;
}

async function addSupplyToShoppingList(supply, automatic = false) {
  const existing = openShoppingItemForSupply(supply.id);

  if (existing) {
    if (!automatic) {
      setShoppingStatus(`${supply.name} steht bereits auf der Liste.`);
    }
    return existing;
  }

  const item = await createShoppingItem({
    supply,
    name: supply.name,
    quantity: shoppingAmountForSupply(supply),
    unit: supply.unit,
    automatic,
  });

  if (!automatic) {
    setShoppingStatus(`${supply.name} wurde hinzugefügt.`);
  }

  return item;
}

async function removeAutomaticShoppingItemForSupply(supplyId) {
  const automaticItem = shoppingItems.find(
    (item) =>
      !item.checked &&
      item.added_automatically &&
      String(item.supply_id) === String(supplyId)
  );

  if (!automaticItem) return;

  const response = await authFetch(
    "/rest/v1/shopping_items?id=eq." +
      encodeURIComponent(automaticItem.id),
    { method: "DELETE" }
  );

  if (!response.ok) return;

  shoppingItems = shoppingItems.filter(
    (item) => String(item.id) !== String(automaticItem.id)
  );

  renderShoppingItems();
}

async function syncSupplyShoppingState(supply) {
  const status = automaticSupplyStatus(
    supply.quantity,
    supply.minimum_quantity
  );

  if (status === "low" || status === "empty") {
    await addSupplyToShoppingList(supply, true);
  } else {
    await removeAutomaticShoppingItemForSupply(supply.id);
  }
}

async function syncAutomaticShoppingItems() {
  if (!shoppingItems.length) {
    await loadShoppingItems();
  }

  for (const supply of supplies) {
    await syncSupplyShoppingState(supply);
  }
}

async function updateShoppingItem(id, changes) {
  const response = await authFetch(
    "/rest/v1/shopping_items?id=eq." +
      encodeURIComponent(id),
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        ...changes,
        updated_at: new Date().toISOString(),
      }),
    }
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));

    throw new Error(
      body.message ||
      body.error ||
      "Einkaufsartikel konnte nicht geändert werden"
    );
  }

  const item = shoppingItems.find(
    (entry) => String(entry.id) === String(id)
  );

  if (item) {
    Object.assign(item, changes);
  }

  renderShoppingItems();
}

async function deleteShoppingItem(id) {
  const response = await authFetch(
    "/rest/v1/shopping_items?id=eq." +
      encodeURIComponent(id),
    { method: "DELETE" }
  );

  if (!response.ok) {
    throw new Error("Einkaufsartikel konnte nicht gelöscht werden.");
  }

  shoppingItems = shoppingItems.filter(
    (item) => String(item.id) !== String(id)
  );

  renderShoppingItems();
}

async function addPurchasedAmountToSupply(item) {
  if (!item.supply_id) return;

  const supply = supplies.find(
    (entry) =>
      String(entry.id) === String(item.supply_id)
  );

  if (!supply) return;

  const amount = Number(item.quantity ?? 1);
  const current = Number(supply.quantity ?? 0);
  const next =
    current + (Number.isFinite(amount) ? amount : 1);

  const status = automaticSupplyStatus(
    next,
    supply.minimum_quantity
  );

  const response = await authFetch(
    "/rest/v1/supplies?id=eq." +
      encodeURIComponent(supply.id),
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
    throw new Error("Vorratsbestand konnte nicht erhöht werden.");
  }

  supply.quantity = next;
  supply.stock_status = status;

  if (activeSupplyCategory) {
    renderSupplies(
      supplies.filter((entry) =>
        supplyCategoriesFor(entry).includes(activeSupplyCategory)
      )
    );
  }

  setShoppingStatus(
    `${supply.name}: Bestand wurde auf ${formatQuantityWithUnit(next, supply.unit)} erhöht.`
  );
}

function renderShoppingItems() {
  if (!els.shoppingList) return;

  const openItems = shoppingItems.filter((item) => !item.checked);
  const doneItems = shoppingItems.filter((item) => item.checked);

  els.shoppingList.innerHTML = "";
  els.shoppingDoneList.innerHTML = "";

  els.shoppingEmpty.classList.toggle(
    "hidden",
    openItems.length !== 0
  );

  els.shoppingCountText.textContent =
    openItems.length === 0
      ? "Noch nichts einzukaufen."
      : `${openItems.length} ${
          openItems.length === 1 ? "Artikel" : "Artikel"
        } offen`;

  const buildCard = (item, done = false) => {
    const card = document.createElement("article");
    card.className =
      "shopping-card" + (done ? " shopping-card-done" : "");

    const amount =
      item.quantity !== null &&
      item.quantity !== undefined &&
      item.quantity !== ""
        ? formatQuantityWithUnit(
            item.quantity,
            item.unit
          )
        : "";

    card.innerHTML = `
      <div class="shopping-card-main">
        <button
          type="button"
          class="shopping-check"
          aria-label="${done ? "Wieder öffnen" : "Als erledigt markieren"}"
        >${done ? "↶" : "✓"}</button>

        <div class="shopping-card-copy">
          <h3 class="shopping-name"></h3>
          <p class="shopping-amount"></p>
          <p class="shopping-origin"></p>
        </div>

        <button
          type="button"
          class="shopping-delete"
          aria-label="Löschen"
        >✕</button>
      </div>

      ${
        done && item.supply_id
          ? `<button type="button" class="shopping-stock-btn">
              Bestand um Einkaufsmenge erhöhen
            </button>`
          : ""
      }
    `;

    card.querySelector(".shopping-name").textContent =
      item.name || "";

    card.querySelector(".shopping-amount").textContent =
      amount ? `Kaufen: ${amount}` : "";

    card.querySelector(".shopping-origin").textContent =
      item.added_automatically
        ? "Automatisch wegen niedrigem Bestand"
        : item.supply_id
          ? "Aus den Vorräten"
          : "Manuell hinzugefügt";

    card.querySelector(".shopping-check").addEventListener(
      "click",
      async () => {
        try {
          await updateShoppingItem(item.id, {
            checked: !done,
          });
        } catch (error) {
          setShoppingStatus(error.message, true);
        }
      }
    );

    card.querySelector(".shopping-delete").addEventListener(
      "click",
      async () => {
        try {
          await deleteShoppingItem(item.id);
        } catch (error) {
          setShoppingStatus(error.message, true);
        }
      }
    );

    card.querySelector(".shopping-stock-btn")?.addEventListener(
      "click",
      async () => {
        try {
          await addPurchasedAmountToSupply(item);
          await deleteShoppingItem(item.id);
        } catch (error) {
          setShoppingStatus(error.message, true);
        }
      }
    );

    return card;
  };

  openItems.forEach((item) =>
    els.shoppingList.appendChild(buildCard(item))
  );

  doneItems.forEach((item) =>
    els.shoppingDoneList.appendChild(buildCard(item, true))
  );

  els.shoppingDoneSection.classList.toggle(
    "hidden",
    doneItems.length === 0
  );
}

async function loadSupplyCategories() {
  try {
    const response = await authFetch(
      "/rest/v1/supply_categories?select=id,name,created_at&order=name.asc"
    );

    const body = await response.json().catch(() => []);

    if (!response.ok) {
      throw new Error(
        body.message ||
        body.error ||
        "Kategorien konnten nicht geladen werden"
      );
    }

    supplyCategories = (body || [])
      .filter((entry) => entry?.name)
      .sort((a, b) =>
        a.name.localeCompare(b.name, "de")
      );

    renderSupplyCategoryChoices();
  } catch (error) {
    console.warn(error);

    // Die Vorräte bleiben nutzbar, selbst wenn die neue Tabelle
    // vorübergehend nicht gelesen werden kann.
    supplyCategories = [];
    renderSupplyCategoryChoices();
  }
}

async function ensureSupplyCategory(rawName) {
  const name = String(rawName || "").trim();

  if (!name) {
    throw new Error("Bitte einen Namen für die neue Kategorie eingeben.");
  }

  const existing = supplyCategories.find(
    (entry) => normalize(entry.name) === normalize(name)
  );

  if (existing) {
    return existing.name;
  }

  const response = await authFetch(
    "/rest/v1/supply_categories",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ name }),
    }
  );

  const body = await response.json().catch(() => []);

  if (!response.ok) {
    throw new Error(
      body.message ||
      body.error ||
      "Neue Kategorie konnte nicht gespeichert werden"
    );
  }

  const saved = Array.isArray(body) ? body[0] : body;
  const savedName = saved?.name || name;

  supplyCategories.push({
    id: saved?.id ?? null,
    name: savedName,
    created_at: saved?.created_at ?? null,
  });

  supplyCategories.sort((a, b) =>
    a.name.localeCompare(b.name, "de")
  );

  return savedName;
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

   await syncAutomaticShoppingItems();
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

function displayUnit(quantity, unit) {
  const value = Number(quantity);
  const rawUnit = String(unit || "").trim();

  if (!rawUnit || value !== 1) {
    return rawUnit;
  }

  const singularUnits = {
    "Packungen": "Packung",
    "Flaschen": "Flasche",
    "Dosen": "Dose",
    "Gläser": "Glas",
    "Beutel": "Beutel",
    "Tüten": "Tüte",
    "Kartons": "Karton",
    "Kisten": "Kiste",
    "Rollen": "Rolle",
    "Stück": "Stück",
    "kg": "kg",
    "g": "g",
    "Liter": "Liter",
    "ml": "ml"
  };

  return singularUnits[rawUnit] || rawUnit;
}

function formatQuantityWithUnit(quantity, unit) {
  const shownQuantity =
    quantity == null || quantity === ""
      ? 0
      : quantity;

  const shownUnit = displayUnit(shownQuantity, unit);

  return `${shownQuantity}${shownUnit ? " " + shownUnit : ""}`;
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

    await syncSupplyShoppingState(supply);

    if (activeSupplyCategory) {
  const filtered = supplies.filter(
    (item) =>
      supplyCategoriesFor(item).includes(activeSupplyCategory)
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
  const typedName = String(query || "").trim();
  const q = normalize(typedName);

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

  const exactMatch = supplies.some(
    (supply) =>
      normalize(supply.name || "") === q
  );

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

    const info = button.querySelector(
      ".supply-suggestion-place"
    );

    const quantity = Number(supply.quantity ?? 0);

    const categoryText =
      supplyCategoriesFor(supply).join(", ") || "Vorrat";

    info.textContent =
      `${categoryText} · ${formatQuantityWithUnit(
        quantity,
        supply.unit
      )}`;

    info.classList.toggle(
      "out-of-stock",
      quantity <= 0
    );

    button.addEventListener("click", () => {
      els.supplySuggestions.classList.add("hidden");
      els.supplySearchInput.value = supply.name || "";
      openEditSupply(supply.id);
    });

    els.supplySuggestions.appendChild(button);
  });

  if (!exactMatch) {
    const createButton = document.createElement("button");

    createButton.type = "button";
    createButton.className =
      "supply-suggestion supply-suggestion-create";

    createButton.innerHTML = `
      <span class="supply-suggestion-name"></span>
      <span class="supply-suggestion-place">
        Als neuen Vorrat anlegen
      </span>
    `;

    createButton.querySelector(
      ".supply-suggestion-name"
    ).textContent = `＋ ${typedName}`;

    createButton.addEventListener("click", () => {
      els.supplySuggestions.classList.add("hidden");
      openNewSupply(typedName);
    });

    els.supplySuggestions.appendChild(createButton);
  }

  els.supplySuggestions.classList.toggle(
    "hidden",
    matches.length === 0 && exactMatch
  );
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
      ...supplyCategoriesFor(supply),
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

  const categories = allKnownSupplyCategoryNames();

  els.supplyCategories.innerHTML = "";

  categories.forEach((category) => {
    const categorySupplies = supplies.filter(
      (supply) =>
        supplyCategoriesFor(supply).includes(category)
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
      supplyCategoriesFor(supply).includes(category)
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
        ? formatQuantityWithUnit(
            supply.quantity,
            supply.unit
          )
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

    <button
      type="button"
      class="supply-shopping-btn"
    >
      🛒 Auf Einkaufsliste
    </button>

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

qtyValue.textContent = formatQuantityWithUnit(
  supply.quantity,
  supply.unit
);

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

card.querySelector(".supply-shopping-btn").addEventListener(
  "click",
  async (event) => {
    event.stopPropagation();

    try {
      await addSupplyToShoppingList(supply, false);
    } catch (error) {
      setShoppingStatus(error.message, true);
      alert(error.message);
    }
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

function supplyCategoriesFor(supply) {
  if (Array.isArray(supply?.categories) && supply.categories.length) {
    return supply.categories.filter(Boolean);
  }

  return supply?.category ? [supply.category] : [];
}

function allKnownSupplyCategoryNames() {
  return [...new Set([
    ...supplyCategories.map((entry) => entry.name),
    ...supplies.flatMap((supply) => supplyCategoriesFor(supply)),
  ].filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "de"));
}

function renderSupplyCategoryChoices(selectedCategories = null) {
  if (!els.supplyCategoryChoices) return;

  const selected = new Set(
    selectedCategories ??
    getSelectedSupplyCategories()
  );

  els.supplyCategoryChoices.innerHTML = "";

  allKnownSupplyCategoryNames().forEach((category) => {
    const label = document.createElement("label");
    const input = document.createElement("input");

    input.type = "checkbox";
    input.name = "supplyCategory";
    input.value = category;
    input.checked = selected.has(category);

    label.appendChild(input);
    label.appendChild(
      document.createTextNode(" " + category)
    );

    els.supplyCategoryChoices.appendChild(label);
  });
}

function getSelectedSupplyCategories() {
  return Array.from(
    els.supplyCategoryChoices.querySelectorAll(
      'input[name="supplyCategory"]:checked'
    )
  ).map((input) => input.value);
}

function setSelectedSupplyCategories(categories = []) {
  renderSupplyCategoryChoices(categories);
}

function resetNewSupplyCategoryFields() {
  els.supplyNewCategoryToggle.checked = false;
  els.supplyNewCategoryName.value = "";
  els.supplyNewCategoryWrap.classList.add("hidden");
  els.supplyNewCategoryName.required = false;
}

function openNewSupply(prefillName = "") {
  els.supplyForm.reset();

  els.supplyId.value = "";
  els.supplyName.value = String(prefillName || "").trim();
  els.supplyRoom.value = "Vorratsraum";
  els.supplyQuantity.value = "0";
  els.supplyMinimumQuantity.value = "1";
  resetNewSupplyCategoryFields();

  setSelectedSupplyCategories(
    activeSupplyCategory ? [activeSupplyCategory] : []
  );

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
  resetNewSupplyCategoryFields();

  els.supplyId.value =
    supply.id;

  els.supplyName.value =
    supply.name || "";

  setSelectedSupplyCategories(
    supplyCategoriesFor(supply)
  );

  els.supplyRoom.value =
    supply.room || "";

  els.supplyStorageLocation.value =
    supply.storage_location || "";

  els.supplyQuantity.value =
    supply.quantity ?? "";

  els.supplyUnit.value =
    supply.unit || "";

  els.supplyMinimumQuantity.value =
    supply.minimum_quantity ?? "";

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
    await loadSupplyCategories();
    await loadShoppingItems();
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

els.supplyNewCategoryToggle.addEventListener(
  "change",
  () => {
    const active = els.supplyNewCategoryToggle.checked;

    els.supplyNewCategoryWrap.classList.toggle(
      "hidden",
      !active
    );

    els.supplyNewCategoryName.required = active;

    if (active) {
      els.supplyNewCategoryName.focus();
    } else {
      els.supplyNewCategoryName.value = "";
    }
  }
);


els.quickShoppingForm.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    try {
      await createShoppingItem({
        name: els.quickShoppingName.value,
        quantity: els.quickShoppingQuantity.value,
        unit: els.quickShoppingUnit.value,
        automatic: false,
      });

      els.quickShoppingForm.reset();
      setShoppingStatus("Artikel wurde hinzugefügt.");
      els.quickShoppingName.focus();
    } catch (error) {
      setShoppingStatus(error.message, true);
    }
  }
);

els.supplyForm.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    const selectedCategories =
      getSelectedSupplyCategories();

    try {
      if (els.supplyNewCategoryToggle.checked) {
        const newCategory = await ensureSupplyCategory(
          els.supplyNewCategoryName.value
        );

        if (!selectedCategories.includes(newCategory)) {
          selectedCategories.push(newCategory);
        }

        renderSupplyCategoryChoices(selectedCategories);
      }
    } catch (error) {
      alert(error.message);
      els.supplyNewCategoryName.focus();
      return;
    }

    if (selectedCategories.length === 0) {
      alert("Bitte mindestens eine Kategorie auswählen.");
      els.supplyCategoryChoices
        .querySelector('input[name="supplyCategory"]')
        ?.focus();
      return;
    }

    const record = {
      name:
        els.supplyName.value.trim(),

      categories:
        selectedCategories,

      // Bleibt vorerst für ältere App-Versionen erhalten.
      category:
        selectedCategories[0] || null,

      room:
        els.supplyRoom.value.trim() ||
        "Vorratsraum",

      storage_location:
        els.supplyStorageLocation
          .value
          .trim() || null,

      quantity:
        els.supplyQuantity.value === ""
          ? 0
          : Number(
              els.supplyQuantity.value
            ),

      unit:
        els.supplyUnit.value ||
        null,

      minimum_quantity:
        els.supplyMinimumQuantity
          .value === ""
          ? 1
          : Number(
              els
                .supplyMinimumQuantity
                .value
            ),

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
  );

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

els.addSupplyInCategoryBtn?.addEventListener(
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
    await loadSupplyCategories();
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

        if (targetView === "shopping") {
          await loadShoppingItems();
        }
      }
    );
  }
);
// Alte zwischengespeicherte App-Versionen entfernen.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));

      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }
    } catch (error) {
      console.warn("Cache konnte nicht vollständig geleert werden:", error);
    }
  });
}

showSession();