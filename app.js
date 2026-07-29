const SUPABASE_URL = "https://ooojdxmyekdghexyeeuc.supabase.co";
const SUPABASE_KEY = "sb_publishable_vdnGOAUwh38wzud2WN8fyA_vGOfPV8t";

if (!window.supabase) {
  document.body.innerHTML = "<main style='padding:24px;font-family:system-ui'>Supabase konnte nicht geladen werden. Bitte Internetverbindung prüfen und Seite neu laden.</main>";
  throw new Error("Supabase library missing");
}

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

let items = [];

const SYMBOL_RULES = [
  [["glühbirne","leuchtmittel","lampe","led","g9"],["💡","🔦","✨"]],
  [["batterie","akku"],["🔋","⚡","🔌"]],
  [["blumendraht","draht","floristik"],["🧵","🌸","🌿"]],
  [["werkzeug","schraube","hammer"],["🔧","🛠️","🔨"]],
  [["weihnacht","advent"],["🎄","⭐","🎁"]],
  [["kabel","ladegerät","stecker"],["🔌","⚡","🔋"]],
  [["pool","chlor"],["🏊","💧","🧪"]],
  [["fahrrad","rad"],["🚲","🔧","🛞"]],
  [["bastel","schere","kleber"],["✂️","🎨","🧵"]],
  [["apfel","obst"],["🍎","🍏","🧺"]],
  [["dokument","papier","unterlagen"],["📄","📁","🗂️"]],
  [["schlüssel"],["🔑","🗝️","📍"]],
  [["garten","pflanze"],["🌿","🌱","🪴"]]
];

const $ = (s) => document.querySelector(s);
const els = {
  loginScreen: $("#loginScreen"), appShell: $("#appShell"),
  loginForm: $("#loginForm"), loginEmail: $("#loginEmail"), loginPassword: $("#loginPassword"),
  loginStatus: $("#loginStatus"), syncStatus: $("#syncStatus"),
  search: $("#searchInput"), clear: $("#clearSearch"), list: $("#itemsList"),
  empty: $("#emptyState"), count: $("#countText"), listTitle: $("#listTitle"),
  filters: $("#quickFilters"), add: $("#addBtn"), dialog: $("#itemDialog"),
  form: $("#itemForm"), dialogTitle: $("#dialogTitle"), id: $("#itemId"),
  symbol: $("#symbol"), suggestSymbol: $("#suggestSymbol"), symbolChoices: $("#symbolChoices"),
  name: $("#name"), room: $("#room"), location: $("#location"),
  keywords: $("#keywords"), note: $("#note"), closeDialog: $("#closeDialog"),
  cancel: $("#cancelBtn"), delete: $("#deleteBtn"), settingsBtn: $("#settingsBtn"),
  settingsDialog: $("#settingsDialog"), closeSettings: $("#closeSettings"),
  exportBtn: $("#exportBtn"), refreshBtn: $("#refreshBtn"), logoutBtn: $("#logoutBtn"),
  template: $("#itemTemplate")
};

function normalize(value) {
  return (value ?? "").toString().toLocaleLowerCase("de-DE")
    .normalize("NFD").replace(/\p{Diacritic}/gu, "");
}
function keywordsToArray(value) {
  if (Array.isArray(value)) return value.map(String);
  return String(value || "").split(",").map(x => x.trim()).filter(Boolean);
}
function searchableText(item) {
  return normalize([item.name, item.room, item.location, item.note, ...keywordsToArray(item.keywords)].join(" "));
}
function suggestFor(text) {
  const t = normalize(text);
  for (const [words, icons] of SYMBOL_RULES) {
    if (words.some(w => t.includes(normalize(w)))) return icons;
  }
  return ["📦","🏠","📍"];
}
function setStatus(text, error=false) {
  els.syncStatus.textContent = text;
  els.syncStatus.classList.toggle("error-text", error);
}

function renderSymbolChoices() {
  const icons = suggestFor(els.name.value);
  els.symbolChoices.innerHTML = "";
  icons.forEach(icon => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "symbol-choice";
    b.textContent = icon;
    b.addEventListener("click", () => { els.symbol.value = icon; });
    els.symbolChoices.appendChild(b);
  });
}

async function loadItems() {
  setStatus("Daten werden geladen …");
  const { data, error } = await db.from("items").select("*").order("name", { ascending: true });
  if (error) {
    setStatus("Daten konnten nicht geladen werden: " + error.message, true);
    return;
  }
  items = data || [];
  setStatus("");
  render();
}

function renderFilters() {
  const rooms = [...new Set(items.map(x => x.room).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"de"));
  els.filters.innerHTML = "";
  rooms.slice(0,6).forEach(room => {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.textContent = room;
    btn.addEventListener("click", () => { els.search.value = room; render(); });
    els.filters.appendChild(btn);
  });
}

function render() {
  const q = normalize(els.search.value.trim());
  const filtered = items
    .filter(item => !q || searchableText(item).includes(q))
    .sort((a,b) => (a.name || "").localeCompare(b.name || "", "de"));

  els.list.innerHTML = "";
  els.empty.classList.toggle("hidden", filtered.length !== 0);
  els.listTitle.textContent = q ? "Suchergebnisse" : "Alle Dinge";
  els.count.textContent = `${filtered.length} ${filtered.length === 1 ? "Eintrag" : "Einträge"}`;

  filtered.forEach(item => {
    const node = els.template.content.cloneNode(true);
    node.querySelector(".item-symbol").textContent = item.symbol || suggestFor(item.name)[0];
    node.querySelector(".item-name").textContent = item.name || "";
    node.querySelector(".item-location").textContent = [item.room, item.location].filter(Boolean).join(" → ");
    const extras = [];
    const kws = keywordsToArray(item.keywords);
    if (kws.length) extras.push(`Suchbegriffe: ${kws.join(", ")}`);
    if (item.note) extras.push(item.note);
    node.querySelector(".item-meta").textContent = extras.join(" · ");
    node.querySelector(".card-main").addEventListener("click", () => openEdit(item.id));
    els.list.appendChild(node);
  });
  renderFilters();
}

function openNew() {
  els.form.reset();
  els.id.value = "";
  els.symbol.value = "";
  els.dialogTitle.textContent = "Neuen Gegenstand eintragen";
  els.delete.classList.add("hidden");
  renderSymbolChoices();
  els.dialog.showModal();
  setTimeout(() => els.name.focus(), 50);
}

function openEdit(id) {
  const item = items.find(x => String(x.id) === String(id));
  if (!item) return;
  els.id.value = item.id;
  els.symbol.value = item.symbol || suggestFor(item.name)[0];
  els.name.value = item.name || "";
  els.room.value = item.room || "";
  els.location.value = item.location || "";
  els.keywords.value = keywordsToArray(item.keywords).join(", ");
  els.note.value = item.note || "";
  els.dialogTitle.textContent = "Eintrag bearbeiten";
  els.delete.classList.remove("hidden");
  renderSymbolChoices();
  els.dialog.showModal();
}

async function showSession() {
  const { data, error } = await db.auth.getSession();
  if (error) {
    els.loginStatus.textContent = "Sitzung konnte nicht geprüft werden: " + error.message;
    els.loginStatus.classList.add("error-text");
  }
  const signedIn = !!data?.session;
  els.loginScreen.classList.toggle("hidden", signedIn);
  els.appShell.classList.toggle("hidden", !signedIn);
  if (signedIn) await loadItems();
}

els.loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  els.loginStatus.textContent = "Anmeldung läuft …";
  els.loginStatus.classList.remove("error-text");
  const { error } = await db.auth.signInWithPassword({
    email: els.loginEmail.value.trim(),
    password: els.loginPassword.value
  });
  if (error) {
    els.loginStatus.textContent = "Anmeldung fehlgeschlagen: " + error.message;
    els.loginStatus.classList.add("error-text");
    return;
  }
  els.loginStatus.textContent = "";
  await showSession();
});

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const record = {
    name: els.name.value.trim(),
    symbol: els.symbol.value.trim() || suggestFor(els.name.value)[0],
    room: els.room.value.trim(),
    location: els.location.value.trim(),
    keywords: els.keywords.value.split(",").map(x => x.trim()).filter(Boolean).join(", "),
    note: els.note.value.trim()
  };
  if (!record.name || !record.room) return;

  setStatus("Speichern …");
  let result;
  if (els.id.value) {
    result = await db.from("items").update(record).eq("id", els.id.value);
  } else {
    result = await db.from("items").insert(record);
  }

  if (result.error) {
    setStatus("Speichern fehlgeschlagen: " + result.error.message, true);
    return;
  }
  els.dialog.close();
  await loadItems();
});

els.delete.addEventListener("click", async () => {
  const id = els.id.value;
  if (!id || !confirm("Diesen Eintrag wirklich löschen?")) return;
  const { error } = await db.from("items").delete().eq("id", id);
  if (error) {
    setStatus("Löschen fehlgeschlagen: " + error.message, true);
    return;
  }
  els.dialog.close();
  await loadItems();
});

els.search.addEventListener("input", render);
els.clear.addEventListener("click", () => { els.search.value = ""; render(); els.search.focus(); });
els.add.addEventListener("click", openNew);
els.closeDialog.addEventListener("click", () => els.dialog.close());
els.cancel.addEventListener("click", () => els.dialog.close());
els.settingsBtn.addEventListener("click", () => els.settingsDialog.showModal());
els.closeSettings.addEventListener("click", () => els.settingsDialog.close());
els.refreshBtn.addEventListener("click", async () => { els.settingsDialog.close(); await loadItems(); });

els.logoutBtn.addEventListener("click", async () => {
  els.settingsDialog.close();
  await db.auth.signOut();
  items = [];
  render();
  await showSession();
});

els.exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `wo-ist-was-sicherung-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

els.name.addEventListener("input", renderSymbolChoices);
els.suggestSymbol.addEventListener("click", () => {
  const icons = suggestFor(els.name.value);
  els.symbol.value = icons[0];
  renderSymbolChoices();
});

db.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    els.appShell.classList.add("hidden");
    els.loginScreen.classList.remove("hidden");
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.update()));
      await navigator.serviceWorker.register("./sw.js?v=3");
    } catch (e) {
      console.warn("Service Worker:", e);
    }
  });
}

showSession();
