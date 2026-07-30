const SUPABASE_URL = "https://muujfgwspkoogjxtvcrp.supabase.co";
const SUPABASE_KEY = "sb_publishable_F6Q3yYsgbdiOBmo1u4Ar_Q_9SF6WrHx";
// Absichtlich derselbe Schlüssel wie in V4: bestehende Anmeldung bleibt erhalten.
const SESSION_KEY = "wo-ist-was-supabase-session-v4";
const PHOTO_BUCKET = "item-photos";

let items = [];
let session = loadSession();
let pendingPhotoBlob = null;
let removeExistingPhoto = false;
const signedUrlCache = new Map();

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
  name: $("#name"), roomSelect: $("#roomSelect"), roomCustom: $("#roomCustom"),
  location: $("#location"), keywords: $("#keywords"), note: $("#note"),
  photoInput: $("#photoInput"), photoPreview: $("#photoPreview"), photoPreviewWrap: $("#photoPreviewWrap"),
  removePhotoBtn: $("#removePhotoBtn"), closeDialog: $("#closeDialog"), cancel: $("#cancelBtn"),
  delete: $("#deleteBtn"), settingsBtn: $("#settingsBtn"), settingsDialog: $("#settingsDialog"),
  closeSettings: $("#closeSettings"), exportBtn: $("#exportBtn"), refreshBtn: $("#refreshBtn"),
  logoutBtn: $("#logoutBtn"), template: $("#itemTemplate")
};

function loadSession(){ try{return JSON.parse(localStorage.getItem(SESSION_KEY)||"null");}catch{return null;} }
function saveSession(value){ session=value; if(value)localStorage.setItem(SESSION_KEY,JSON.stringify(value)); else localStorage.removeItem(SESSION_KEY); }
function normalize(value){return (value??"").toString().toLocaleLowerCase("de-DE").normalize("NFD").replace(/\p{Diacritic}/gu,"");}
function keywordsToArray(value){if(Array.isArray(value))return value.map(String);return String(value||"").split(",").map(x=>x.trim()).filter(Boolean);}
function searchableText(item){return normalize([item.name,item.room,item.location,item.note,...keywordsToArray(item.keywords)].join(" "));}
function suggestFor(text){const t=normalize(text);for(const [words,icons] of SYMBOL_RULES){if(words.some(w=>t.includes(normalize(w))))return icons;}return["📦","🏠","📍"];}
function setStatus(text,error=false){els.syncStatus.textContent=text;els.syncStatus.classList.toggle("error-text",error);}

function selectedRoom(){return els.roomSelect.value==="__other__"?els.roomCustom.value.trim():els.roomSelect.value.trim();}
function setRoomValue(room){
  const known=[...els.roomSelect.options].map(o=>o.value);
  if(room&&known.includes(room)){els.roomSelect.value=room;els.roomCustom.value="";els.roomCustom.classList.add("hidden");els.roomCustom.required=false;}
  else if(room){els.roomSelect.value="__other__";els.roomCustom.value=room;els.roomCustom.classList.remove("hidden");els.roomCustom.required=true;}
  else{els.roomSelect.value="";els.roomCustom.value="";els.roomCustom.classList.add("hidden");els.roomCustom.required=false;}
}
function renderSymbolChoices(){const icons=suggestFor(els.name.value);els.symbolChoices.innerHTML="";icons.forEach(icon=>{const b=document.createElement("button");b.type="button";b.className="symbol-choice";b.textContent=icon;b.addEventListener("click",()=>els.symbol.value=icon);els.symbolChoices.appendChild(b);});}
function clearPhotoState(){pendingPhotoBlob=null;removeExistingPhoto=false;els.photoInput.value="";els.photoPreview.removeAttribute("src");els.photoPreviewWrap.classList.add("hidden");}

async function authFetch(path,options={},retry=true){
  const headers=new Headers(options.headers||{});headers.set("apikey",SUPABASE_KEY);if(session?.access_token)headers.set("Authorization","Bearer "+session.access_token);
  const response=await fetch(SUPABASE_URL+path,{...options,headers});
  if(response.status===401&&retry&&session?.refresh_token){const ok=await refreshSession();if(ok)return authFetch(path,options,false);}
  return response;
}
async function refreshSession(){try{const r=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:{"apikey":SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({refresh_token:session.refresh_token})});if(!r.ok){saveSession(null);return false;}saveSession(await r.json());return true;}catch{return false;}}
async function signIn(email,password){const r=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=password",{method:"POST",headers:{"apikey":SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({email,password})});const body=await r.json().catch(()=>({}));if(!r.ok)throw new Error(body.msg||body.error_description||body.message||"Anmeldung fehlgeschlagen");saveSession(body);}

async function compressImage(file){
  const dataUrl=await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=()=>reject(new Error("Foto konnte nicht gelesen werden."));fr.readAsDataURL(file);});
  const img=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error("Foto konnte nicht geöffnet werden."));im.src=dataUrl;});
  const maxSide=1400, scale=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight));
  const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
  const ctx=canvas.getContext("2d");ctx.drawImage(img,0,0,canvas.width,canvas.height);
  return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Foto konnte nicht verkleinert werden.")),"image/jpeg",0.8));
}
async function uploadPhoto(blob){
  const path=`${Date.now()}-${Math.random().toString(36).slice(2,10)}.jpg`;
  const r=await authFetch(`/storage/v1/object/${PHOTO_BUCKET}/${encodeURIComponent(path)}`,{method:"POST",headers:{"Content-Type":"image/jpeg","x-upsert":"false"},body:blob});
  if(!r.ok){const body=await r.json().catch(()=>({}));throw new Error(body.message||body.error||"Foto konnte nicht hochgeladen werden.");}
  return path;
}
async function deletePhoto(path){if(!path)return;const r=await authFetch(`/storage/v1/object/${PHOTO_BUCKET}/${encodeURIComponent(path)}`,{method:"DELETE"});if(!r.ok)console.warn("Foto konnte nicht gelöscht werden",await r.text().catch(()=>""));signedUrlCache.delete(path);}
async function getSignedPhotoUrl(path){
  if(!path)return"";
  const cached=signedUrlCache.get(path);if(cached&&cached.expires>Date.now())return cached.url;
  const r=await authFetch(`/storage/v1/object/sign/${PHOTO_BUCKET}/${encodeURIComponent(path)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({expiresIn:3600})});
  if(!r.ok)return"";const body=await r.json().catch(()=>({}));let url=body.signedURL||body.signedUrl||"";if(!url)return"";
  if(!url.startsWith("http"))url=SUPABASE_URL+"/storage/v1"+url;
  signedUrlCache.set(path,{url,expires:Date.now()+55*60*1000});return url;
}
async function showStoredPhoto(path){const url=await getSignedPhotoUrl(path);if(url){els.photoPreview.src=url;els.photoPreviewWrap.classList.remove("hidden");}}
async function hydrateCardPhotos(){
  const wraps=[...document.querySelectorAll(".card-photo-wrap[data-photo-path]")];
  await Promise.all(wraps.map(async wrap=>{const url=await getSignedPhotoUrl(wrap.dataset.photoPath);if(url){wrap.querySelector(".card-photo").src=url;wrap.classList.remove("hidden");}}));
}

async function loadItems(){setStatus("Daten werden geladen …");try{const r=await authFetch("/rest/v1/items?select=*&order=name.asc");const body=await r.json().catch(()=>[]);if(!r.ok)throw new Error(body.message||body.error||"Fehler beim Laden");items=body||[];setStatus("");render();}catch(e){setStatus("Daten konnten nicht geladen werden: "+e.message,true);}}
function renderFilters(){const rooms=[...new Set(items.map(x=>x.room).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"de"));els.filters.innerHTML="";rooms.slice(0,6).forEach(room=>{const btn=document.createElement("button");btn.className="chip";btn.textContent=room;btn.addEventListener("click",()=>{els.search.value=room;render();});els.filters.appendChild(btn);});}
function render(){
  const q=normalize(els.search.value.trim());const filtered=items.filter(item=>!q||searchableText(item).includes(q)).sort((a,b)=>(a.name||"").localeCompare(b.name||"","de"));
  els.list.innerHTML="";els.empty.classList.toggle("hidden",filtered.length!==0);els.listTitle.textContent=q?"Suchergebnisse":"Alle Dinge";els.count.textContent=`${filtered.length} ${filtered.length===1?"Eintrag":"Einträge"}`;
  filtered.forEach(item=>{const node=els.template.content.cloneNode(true);const photoWrap=node.querySelector(".card-photo-wrap");if(item.photo_path)photoWrap.dataset.photoPath=item.photo_path;node.querySelector(".item-symbol").textContent=item.symbol||suggestFor(item.name)[0];node.querySelector(".item-name").textContent=item.name||"";node.querySelector(".item-location").textContent=[item.room,item.location].filter(Boolean).join(" → ");const extras=[],kws=keywordsToArray(item.keywords);if(kws.length)extras.push(`Suchbegriffe: ${kws.join(", ")}`);if(item.note)extras.push(item.note);node.querySelector(".item-meta").textContent=extras.join(" · ");node.querySelector(".card-main").addEventListener("click",()=>openEdit(item.id));els.list.appendChild(node);});
  renderFilters();hydrateCardPhotos();
}
function openNew(){els.form.reset();clearPhotoState();setRoomValue("");els.id.value="";els.symbol.value="";els.dialogTitle.textContent="Neuen Gegenstand eintragen";els.delete.classList.add("hidden");renderSymbolChoices();els.dialog.showModal();}
function openEdit(id){const item=items.find(x=>String(x.id)===String(id));if(!item)return;els.form.reset();clearPhotoState();els.id.value=item.id;els.symbol.value=item.symbol||suggestFor(item.name)[0];els.name.value=item.name||"";setRoomValue(item.room||"");els.location.value=item.location||"";els.keywords.value=keywordsToArray(item.keywords).join(", ");els.note.value=item.note||"";els.dialogTitle.textContent="Eintrag bearbeiten";els.delete.classList.remove("hidden");renderSymbolChoices();els.dialog.showModal();if(item.photo_path)showStoredPhoto(item.photo_path);}
async function showSession(){const signedIn=!!session?.access_token;els.loginScreen.classList.toggle("hidden",signedIn);els.appShell.classList.toggle("hidden",!signedIn);if(signedIn)await loadItems();}

els.loginForm.addEventListener("submit",async e=>{e.preventDefault();els.loginStatus.textContent="Anmeldung läuft …";els.loginStatus.classList.remove("error-text");try{await signIn(els.loginEmail.value.trim(),els.loginPassword.value);els.loginStatus.textContent="";await showSession();}catch(e){els.loginStatus.textContent="Anmeldung fehlgeschlagen: "+e.message;els.loginStatus.classList.add("error-text");}});
els.form.addEventListener("submit",async e=>{
  e.preventDefault();const room=selectedRoom();if(!room){els.roomSelect.focus();return;}
  const oldItem=els.id.value?items.find(x=>String(x.id)===String(els.id.value)):null;const oldPath=oldItem?.photo_path||null;let newPath=null;
  const record={name:els.name.value.trim(),symbol:els.symbol.value.trim()||suggestFor(els.name.value)[0],room,location:els.location.value.trim(),keywords:els.keywords.value.split(",").map(x=>x.trim()).filter(Boolean).join(", "),note:els.note.value.trim()};
  if(!record.name)return;setStatus("Speichern …");
  try{
    if(pendingPhotoBlob){newPath=await uploadPhoto(pendingPhotoBlob);record.photo_path=newPath;}else if(removeExistingPhoto){record.photo_path=null;}
    let r;if(els.id.value){r=await authFetch("/rest/v1/items?id=eq."+encodeURIComponent(els.id.value),{method:"PATCH",headers:{"Content-Type":"application/json","Prefer":"return=minimal"},body:JSON.stringify(record)});}else{r=await authFetch("/rest/v1/items",{method:"POST",headers:{"Content-Type":"application/json","Prefer":"return=minimal"},body:JSON.stringify(record)});}
    if(!r.ok){const body=await r.json().catch(()=>({}));throw new Error(body.message||body.error||"Speichern fehlgeschlagen");}
    if(oldPath&&(pendingPhotoBlob||removeExistingPhoto))await deletePhoto(oldPath);clearPhotoState();els.dialog.close();await loadItems();
  }catch(e){if(newPath)await deletePhoto(newPath);setStatus("Speichern fehlgeschlagen: "+e.message,true);}
});
els.delete.addEventListener("click",async()=>{const id=els.id.value;if(!id||!confirm("Diesen Eintrag wirklich löschen?"))return;try{const oldItem=items.find(x=>String(x.id)===String(id));const r=await authFetch("/rest/v1/items?id=eq."+encodeURIComponent(id),{method:"DELETE"});if(!r.ok)throw new Error("Löschen fehlgeschlagen");if(oldItem?.photo_path)await deletePhoto(oldItem.photo_path);clearPhotoState();els.dialog.close();await loadItems();}catch(e){setStatus(e.message,true);}});

els.roomSelect.addEventListener("change",()=>{const custom=els.roomSelect.value==="__other__";els.roomCustom.classList.toggle("hidden",!custom);els.roomCustom.required=custom;if(custom)setTimeout(()=>els.roomCustom.focus(),50);});
els.photoInput.addEventListener("change",async()=>{const file=els.photoInput.files?.[0];if(!file)return;try{setStatus("Foto wird vorbereitet …");pendingPhotoBlob=await compressImage(file);removeExistingPhoto=false;els.photoPreview.src=URL.createObjectURL(pendingPhotoBlob);els.photoPreviewWrap.classList.remove("hidden");setStatus("");}catch(e){setStatus("Foto konnte nicht verarbeitet werden: "+e.message,true);}});
els.removePhotoBtn.addEventListener("click",()=>{pendingPhotoBlob=null;removeExistingPhoto=true;els.photoInput.value="";els.photoPreview.removeAttribute("src");els.photoPreviewWrap.classList.add("hidden");});
els.search.addEventListener("input",render);els.clear.addEventListener("click",()=>{els.search.value="";render();els.search.focus();});els.add.addEventListener("click",openNew);els.closeDialog.addEventListener("click",()=>els.dialog.close());els.cancel.addEventListener("click",()=>els.dialog.close());els.settingsBtn.addEventListener("click",()=>els.settingsDialog.showModal());els.closeSettings.addEventListener("click",()=>els.settingsDialog.close());els.refreshBtn.addEventListener("click",async()=>{els.settingsDialog.close();await loadItems();});els.logoutBtn.addEventListener("click",()=>{els.settingsDialog.close();saveSession(null);items=[];render();showSession();});
els.exportBtn.addEventListener("click",()=>{const blob=new Blob([JSON.stringify(items,null,2)],{type:"application/json"});const u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=`wo-ist-was-sicherung-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(u);});
els.name.addEventListener("input",renderSymbolChoices);els.suggestSymbol.addEventListener("click",()=>{const icons=suggestFor(els.name.value);els.symbol.value=icons[0];renderSymbolChoices();});

if("serviceWorker" in navigator){window.addEventListener("load",async()=>{try{const regs=await navigator.serviceWorker.getRegistrations();for(const reg of regs)await reg.update();await navigator.serviceWorker.register("./sw.js?v=5");}catch(e){console.warn(e);}});}
showSession();
