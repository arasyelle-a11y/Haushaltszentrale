
const STORAGE_KEY = "wo-ist-was-items-v1";

const sampleItems = [
  {
    id: crypto.randomUUID(),
    name: "Glühbirnen / Leuchtmittel",
    room: "Schaukelzimmer",
    location: "Kiste mit Glühbirnen",
    keywords: ["Glühbirne","Birne","Leuchtmittel","LED","G9","Ersatzbirne"],
    note: "Reserve-Leuchtmittel hier sammeln."
  },
  {
    id: crypto.randomUUID(),
    name: "Blumendraht",
    room: "Noch festlegen",
    location: "Beim nächsten Fund hier eintragen 😄",
    keywords: ["Draht","Basteldraht","Mittsommer","Blumenkranz","Floristik"],
    note: "Wird selten gebraucht – besonders wichtig für die Liste."
  }
];

function loadItems(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw){
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleItems));
      return structuredClone(sampleItems);
    }
    return JSON.parse(raw);
  }catch(e){
    console.error(e);
    return structuredClone(sampleItems);
  }
}
function saveItems(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}
let items = loadItems();

const els = {
  search: document.querySelector("#searchInput"),
  clear: document.querySelector("#clearSearch"),
  list: document.querySelector("#itemsList"),
  empty: document.querySelector("#emptyState"),
  count: document.querySelector("#countText"),
  listTitle: document.querySelector("#listTitle"),
  filters: document.querySelector("#quickFilters"),
  add: document.querySelector("#addBtn"),
  dialog: document.querySelector("#itemDialog"),
  form: document.querySelector("#itemForm"),
  dialogTitle: document.querySelector("#dialogTitle"),
  id: document.querySelector("#itemId"),
  name: document.querySelector("#name"),
  room: document.querySelector("#room"),
  location: document.querySelector("#location"),
  keywords: document.querySelector("#keywords"),
  note: document.querySelector("#note"),
  closeDialog: document.querySelector("#closeDialog"),
  cancel: document.querySelector("#cancelBtn"),
  delete: document.querySelector("#deleteBtn"),
  settingsBtn: document.querySelector("#settingsBtn"),
  settingsDialog: document.querySelector("#settingsDialog"),
  closeSettings: document.querySelector("#closeSettings"),
  exportBtn: document.querySelector("#exportBtn"),
  importInput: document.querySelector("#importInput"),
  resetBtn: document.querySelector("#resetBtn"),
  template: document.querySelector("#itemTemplate")
};

function normalize(value){
  return (value ?? "").toString().toLocaleLowerCase("de-DE").normalize("NFD").replace(/\p{Diacritic}/gu,"");
}
function searchableText(item){
  return normalize([
    item.name, item.room, item.location, item.note, ...(item.keywords || [])
  ].join(" "));
}

function renderFilters(){
  const rooms = [...new Set(items.map(x => x.room).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"de"));
  els.filters.innerHTML = "";
  rooms.slice(0,6).forEach(room => {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.textContent = room;
    btn.addEventListener("click", () => {
      els.search.value = room;
      render();
    });
    els.filters.appendChild(btn);
  });
}

function render(){
  const q = normalize(els.search.value.trim());
  const filtered = items
    .filter(item => !q || searchableText(item).includes(q))
    .sort((a,b)=>a.name.localeCompare(b.name,"de"));

  els.list.innerHTML = "";
  els.empty.classList.toggle("hidden", filtered.length !== 0);
  els.listTitle.textContent = q ? "Suchergebnisse" : "Alle Dinge";
  els.count.textContent = `${filtered.length} ${filtered.length === 1 ? "Eintrag" : "Einträge"}`;

  filtered.forEach(item => {
    const node = els.template.content.cloneNode(true);
    node.querySelector(".item-name").textContent = item.name;
    node.querySelector(".item-location").textContent =
      [item.room, item.location].filter(Boolean).join(" → ");
    const extras = [];
    if(item.keywords?.length) extras.push(`Suchbegriffe: ${item.keywords.join(", ")}`);
    if(item.note) extras.push(item.note);
    node.querySelector(".item-meta").textContent = extras.join(" · ");
    node.querySelector(".card-main").addEventListener("click", ()=>openEdit(item.id));
    els.list.appendChild(node);
  });
  renderFilters();
}

function openNew(){
  els.form.reset();
  els.id.value = "";
  els.dialogTitle.textContent = "Neuen Gegenstand eintragen";
  els.delete.classList.add("hidden");
  els.dialog.showModal();
  setTimeout(()=>els.name.focus(), 50);
}

function openEdit(id){
  const item = items.find(x=>x.id===id);
  if(!item) return;
  els.id.value = item.id;
  els.name.value = item.name || "";
  els.room.value = item.room || "";
  els.location.value = item.location || "";
  els.keywords.value = (item.keywords || []).join(", ");
  els.note.value = item.note || "";
  els.dialogTitle.textContent = "Eintrag bearbeiten";
  els.delete.classList.remove("hidden");
  els.dialog.showModal();
}

els.form.addEventListener("submit", (e)=>{
  e.preventDefault();
  const record = {
    id: els.id.value || crypto.randomUUID(),
    name: els.name.value.trim(),
    room: els.room.value.trim(),
    location: els.location.value.trim(),
    keywords: els.keywords.value.split(",").map(x=>x.trim()).filter(Boolean),
    note: els.note.value.trim()
  };
  if(!record.name || !record.room) return;

  const idx = items.findIndex(x=>x.id===record.id);
  if(idx >= 0) items[idx] = record;
  else items.push(record);
  saveItems();
  els.dialog.close();
  render();
});

els.delete.addEventListener("click", ()=>{
  const id = els.id.value;
  if(!id) return;
  if(confirm("Diesen Eintrag wirklich löschen?")){
    items = items.filter(x=>x.id!==id);
    saveItems();
    els.dialog.close();
    render();
  }
});

els.search.addEventListener("input", render);
els.clear.addEventListener("click", ()=>{ els.search.value=""; render(); els.search.focus(); });
els.add.addEventListener("click", openNew);
els.closeDialog.addEventListener("click", ()=>els.dialog.close());
els.cancel.addEventListener("click", ()=>els.dialog.close());

els.settingsBtn.addEventListener("click", ()=>els.settingsDialog.showModal());
els.closeSettings.addEventListener("click", ()=>els.settingsDialog.close());

els.exportBtn.addEventListener("click", ()=>{
  const blob = new Blob([JSON.stringify(items,null,2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0,10);
  a.href = url;
  a.download = `wo-ist-was-sicherung-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

els.importInput.addEventListener("change", async (e)=>{
  const file = e.target.files?.[0];
  if(!file) return;
  try{
    const parsed = JSON.parse(await file.text());
    if(!Array.isArray(parsed)) throw new Error("Ungültiges Format");
    items = parsed.map(x=>({
      id: x.id || crypto.randomUUID(),
      name: String(x.name || ""),
      room: String(x.room || ""),
      location: String(x.location || ""),
      keywords: Array.isArray(x.keywords) ? x.keywords.map(String) : [],
      note: String(x.note || "")
    })).filter(x=>x.name && x.room);
    saveItems();
    render();
    els.settingsDialog.close();
    alert("Sicherung wurde importiert.");
  }catch(err){
    alert("Die Datei konnte nicht importiert werden.");
  }finally{
    e.target.value = "";
  }
});

els.resetBtn.addEventListener("click", ()=>{
  if(confirm("Alle aktuellen Einträge durch die Beispieldaten ersetzen?")){
    items = structuredClone(sampleItems).map(x=>({...x,id:crypto.randomUUID()}));
    saveItems();
    render();
    els.settingsDialog.close();
  }
});

if("serviceWorker" in navigator){
  window.addEventListener("load", ()=>navigator.serviceWorker.register("./sw.js").catch(console.error));
}

render();
