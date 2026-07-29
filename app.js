const SUPABASE_URL = "https://ooojdxmyekdghexyeeuc.supabase.co";
const SUPABASE_KEY = "sb_publishable_vdnGOAUwh38wzud2WN8fyA_vGOfPV8t";
const SESSION_KEY = "wo-ist-was-supabase-session-v4";

let items = [];
let session = loadSession();

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

const $ = s => document.querySelector(s);
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

function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
  catch { return null; }
}
function saveSession(value) {
  session = value;
  if (value) localStorage.setItem(SESSION_KEY, JSON.stringify(value));
  else localStorage.removeItem(SESSION_KEY);
}
function normalize(value) {
  return (value ?? "").toString().toLocaleLowerCase("de-DE")
    .normalize("NFD").replace(/\p{Diacritic}/gu, "");
}
function keywordsToArray(value) {
  if (Array.isArray(value)) return value.map(String);
  return String(value || "").split(",").map(x => x.trim()).filter(Boolean);
}
function searchableText(item) {
  return normalize([item.name,item.room,item.location,item.note,...keywordsToArray(item.keywords)].join(" "));
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
    b.addEventListener("click", () => els.symbol.value = icon);
    els.symbolChoices.appendChild(b);
  });
}

async function authFetch(path, options={}, retry=true) {
  const headers = new Headers(options.headers || {});
  headers.set("apikey", SUPABASE_KEY);
  if (session?.access_token) headers.set("Authorization", "Bearer " + session.access_token);

  const response = await fetch(SUPABASE_URL + path, {...options, headers});
  if (response.status === 401 && retry && session?.refresh_token) {
    const ok = await refreshSession();
    if (ok) return authFetch(path, options, false);
  }
  return response;
}

async function refreshSession() {
  try {
    const r = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token", {
      method:"POST",
      headers:{"apikey":SUPABASE_KEY,"Content-Type":"application/json"},
      body:JSON.stringify({refresh_token:session.refresh_token})
    });
    if (!r.ok) { saveSession(null); return false; }
    saveSession(await r.json());
    return true;
  } catch {
    return false;
  }
}

async function signIn(email, password) {
  const r = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
    method:"POST",
    headers:{"apikey":SUPABASE_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({email,password})
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.msg || body.error_description || body.message || "Anmeldung fehlgeschlagen");
  saveSession(body);
}

async function loadItems() {
  setStatus("Daten werden geladen …");
  try {
    const r = await authFetch("/rest/v1/items?select=*&order=name.asc");
    const body = await r.json().catch(() => []);
    if (!r.ok) throw new Error(body.message || body.error || "Fehler beim Laden");
    items = body || [];
    setStatus("");
    render();
  } catch (e) {
    setStatus("Daten konnten nicht geladen werden: " + e.message, true);
  }
}

function renderFilters() {
  const rooms=[...new Set(items.map(x=>x.room).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"de"));
  els.filters.innerHTML="";
  rooms.slice(0,6).forEach(room=>{
    const btn=document.createElement("button");
    btn.className="chip"; btn.textContent=room;
    btn.addEventListener("click",()=>{els.search.value=room;render();});
    els.filters.appendChild(btn);
  });
}

function render() {
  const q=normalize(els.search.value.trim());
  const filtered=items.filter(item=>!q||searchableText(item).includes(q))
    .sort((a,b)=>(a.name||"").localeCompare(b.name||"","de"));
  els.list.innerHTML="";
  els.empty.classList.toggle("hidden",filtered.length!==0);
  els.listTitle.textContent=q?"Suchergebnisse":"Alle Dinge";
  els.count.textContent=`${filtered.length} ${filtered.length===1?"Eintrag":"Einträge"}`;

  filtered.forEach(item=>{
    const node=els.template.content.cloneNode(true);
    node.querySelector(".item-symbol").textContent=item.symbol||suggestFor(item.name)[0];
    node.querySelector(".item-name").textContent=item.name||"";
    node.querySelector(".item-location").textContent=[item.room,item.location].filter(Boolean).join(" → ");
    const extras=[], kws=keywordsToArray(item.keywords);
    if(kws.length) extras.push(`Suchbegriffe: ${kws.join(", ")}`);
    if(item.note) extras.push(item.note);
    node.querySelector(".item-meta").textContent=extras.join(" · ");
    node.querySelector(".card-main").addEventListener("click",()=>openEdit(item.id));
    els.list.appendChild(node);
  });
  renderFilters();
}

function openNew() {
  els.form.reset(); els.id.value=""; els.symbol.value="";
  els.dialogTitle.textContent="Neuen Gegenstand eintragen";
  els.delete.classList.add("hidden");
  renderSymbolChoices(); els.dialog.showModal();
}
function openEdit(id) {
  const item=items.find(x=>String(x.id)===String(id)); if(!item)return;
  els.id.value=item.id; els.symbol.value=item.symbol||suggestFor(item.name)[0];
  els.name.value=item.name||""; els.room.value=item.room||"";
  els.location.value=item.location||""; els.keywords.value=keywordsToArray(item.keywords).join(", ");
  els.note.value=item.note||""; els.dialogTitle.textContent="Eintrag bearbeiten";
  els.delete.classList.remove("hidden"); renderSymbolChoices(); els.dialog.showModal();
}

async function showSession() {
  const signedIn=!!session?.access_token;
  els.loginScreen.classList.toggle("hidden",signedIn);
  els.appShell.classList.toggle("hidden",!signedIn);
  if(signedIn) await loadItems();
}

els.loginForm.addEventListener("submit",async e=>{
  e.preventDefault();
  els.loginStatus.textContent="Anmeldung läuft …"; els.loginStatus.classList.remove("error-text");
  try {
    await signIn(els.loginEmail.value.trim(), els.loginPassword.value);
    els.loginStatus.textContent=""; await showSession();
  } catch(e) {
    els.loginStatus.textContent="Anmeldung fehlgeschlagen: "+e.message;
    els.loginStatus.classList.add("error-text");
  }
});

els.form.addEventListener("submit",async e=>{
  e.preventDefault();
  const record={
    name:els.name.value.trim(),
    symbol:els.symbol.value.trim()||suggestFor(els.name.value)[0],
    room:els.room.value.trim(),
    location:els.location.value.trim(),
    keywords:els.keywords.value.split(",").map(x=>x.trim()).filter(Boolean).join(", "),
    note:els.note.value.trim()
  };
  if(!record.name||!record.room)return;
  setStatus("Speichern …");

  try {
    let r;
    if(els.id.value) {
      r=await authFetch("/rest/v1/items?id=eq."+encodeURIComponent(els.id.value), {
        method:"PATCH",
        headers:{"Content-Type":"application/json","Prefer":"return=minimal"},
        body:JSON.stringify(record)
      });
    } else {
      r=await authFetch("/rest/v1/items", {
        method:"POST",
        headers:{"Content-Type":"application/json","Prefer":"return=minimal"},
        body:JSON.stringify(record)
      });
    }
    if(!r.ok) {
      const body=await r.json().catch(()=>({}));
      throw new Error(body.message||body.error||"Speichern fehlgeschlagen");
    }
    els.dialog.close(); await loadItems();
  } catch(e) {
    setStatus("Speichern fehlgeschlagen: "+e.message,true);
  }
});

els.delete.addEventListener("click",async()=>{
  const id=els.id.value;
  if(!id||!confirm("Diesen Eintrag wirklich löschen?"))return;
  try {
    const r=await authFetch("/rest/v1/items?id=eq."+encodeURIComponent(id),{method:"DELETE"});
    if(!r.ok) throw new Error("Löschen fehlgeschlagen");
    els.dialog.close(); await loadItems();
  } catch(e) {
    setStatus(e.message,true);
  }
});

els.search.addEventListener("input",render);
els.clear.addEventListener("click",()=>{els.search.value="";render();els.search.focus();});
els.add.addEventListener("click",openNew);
els.closeDialog.addEventListener("click",()=>els.dialog.close());
els.cancel.addEventListener("click",()=>els.dialog.close());
els.settingsBtn.addEventListener("click",()=>els.settingsDialog.showModal());
els.closeSettings.addEventListener("click",()=>els.settingsDialog.close());
els.refreshBtn.addEventListener("click",async()=>{els.settingsDialog.close();await loadItems();});
els.logoutBtn.addEventListener("click",()=>{els.settingsDialog.close();saveSession(null);items=[];render();showSession();});
els.exportBtn.addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify(items,null,2)],{type:"application/json"});
  const u=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=u;a.download=`wo-ist-was-sicherung-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(u);
});
els.name.addEventListener("input",renderSymbolChoices);
els.suggestSymbol.addEventListener("click",()=>{const icons=suggestFor(els.name.value);els.symbol.value=icons[0];renderSymbolChoices();});

if("serviceWorker" in navigator){
  window.addEventListener("load",async()=>{
    try {
      const regs=await navigator.serviceWorker.getRegistrations();
      for(const reg of regs) await reg.update();
      await navigator.serviceWorker.register("./sw.js?v=4");
    } catch(e) { console.warn(e); }
  });
}

showSession();
