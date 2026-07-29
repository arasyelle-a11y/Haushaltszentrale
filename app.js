const K="wo-ist-was-v2";const rules=[[["glühbirne","leuchtmittel","lampe","led","g9"],["💡","🔦","✨"]],[["batterie","akku"],["🔋","⚡","🔌"]],[["blumendraht","draht","floristik"],["🧵","🌸","🌿"]],[["werkzeug","schraube","hammer"],["🔧","🛠️","🔨"]],[["weihnacht","advent"],["🎄","⭐","🎁"]],[["kabel","ladegerät","stecker"],["🔌","⚡","🔋"]],[["pool","chlor"],["🏊","💧","🧪"]],[["fahrrad","rad"],["🚲","🔧","🛞"]],[["bastel","schere","kleber"],["✂️","🎨","🧵"]],[["apfel","obst"],["🍎","🍏","🧺"]],[["dokument","papier"],["📄","📁","🗂️"]],[["schlüssel"],["🔑","🗝️","📍"]],[["garten","pflanze"],["🌿","🌱","🪴"]]];
const seed=[{id:"1",name:"Glühbirnen / Leuchtmittel",symbol:"💡",room:"Schaukelzimmer",loc:"Kiste mit Glühbirnen",keys:["Glühbirne","Birne","Leuchtmittel","LED","G9","Ersatzbirne"],note:"Reserve-Leuchtmittel hier sammeln."},{id:"2",name:"Blumendraht",symbol:"🧵",room:"Noch festlegen",loc:"Beim nächsten Fund hier eintragen 😄",keys:["Draht","Basteldraht","Mittsommer","Blumenkranz","Floristik"],note:"Wird selten gebraucht – besonders wichtig für die Liste."}];
let items;
const current = JSON.parse(localStorage.getItem(K) || "null");
if (current) {
  items = current;
} else {
  const oldV1 = JSON.parse(localStorage.getItem("wo-ist-was-items-v1") || "null");
  if (oldV1) {
    items = oldV1.map(x => ({
      id: x.id || crypto.randomUUID(),
      name: x.name || "",
      symbol: x.symbol || suggest(x.name || "")[0] || "📦",
      room: x.room || "",
      loc: x.location || x.loc || "",
      keys: Array.isArray(x.keywords) ? x.keywords : (Array.isArray(x.keys) ? x.keys : []),
      note: x.note || ""
    })).filter(x => x.name && x.room);
    localStorage.setItem(K, JSON.stringify(items));
  } else {
    items = seed;
  }
}
const $=s=>document.querySelector(s),norm=s=>(s||"").toLowerCase(),suggest=n=>{let t=norm(n);for(let [w,i] of rules)if(w.some(x=>t.includes(x)))return i;return["📦","🏠","📍"]};
function save(){localStorage.setItem(K,JSON.stringify(items))}
function render(){let q=norm($("#q").value);let a=items.filter(x=>norm([x.name,x.room,x.loc,x.note,...(x.keys||[])].join(" ")).includes(q));$("#count").textContent=a.length+" Einträge";$("#list").innerHTML=a.map(x=>`<div class="card" data-id="${x.id}"><div class="row"><span class="symbol">${x.symbol||suggest(x.name)[0]}</span><h3>${x.name}</h3></div><div class="place">${x.room}${x.loc?" → "+x.loc:""}</div><div class="meta">${x.keys?.length?"Suchbegriffe: "+x.keys.join(", "):""}${x.note?" · "+x.note:""}</div></div>`).join("");document.querySelectorAll(".card").forEach(c=>c.onclick=()=>edit(c.dataset.id))}
function choices(){let a=suggest($("#name").value);$("#choices").innerHTML=a.map(x=>`<button type="button">${x}</button>`).join("");$("#choices").querySelectorAll("button").forEach(b=>b.onclick=()=>$("#symbol").value=b.textContent)}
function edit(id){let x=items.find(y=>y.id==id);$("#id").value=x.id;$("#name").value=x.name;$("#symbol").value=x.symbol||suggest(x.name)[0];$("#room").value=x.room;$("#loc").value=x.loc||"";$("#keys").value=(x.keys||[]).join(", ");$("#note").value=x.note||"";choices();$("#del").style.display="inline-block";$("#dlg").showModal()}
$("#add").onclick=()=>{$("#form").reset();$("#id").value="";$("#del").style.display="none";choices();$("#dlg").showModal()};$("#cancel").onclick=()=>$("#dlg").close();$("#q").oninput=render;$("#name").oninput=choices;$("#suggest").onclick=()=>{$("#symbol").value=suggest($("#name").value)[0];choices()};
$("#form").onsubmit=e=>{e.preventDefault();let x={id:$("#id").value||crypto.randomUUID(),name:$("#name").value.trim(),symbol:$("#symbol").value.trim()||suggest($("#name").value)[0],room:$("#room").value.trim(),loc:$("#loc").value.trim(),keys:$("#keys").value.split(",").map(x=>x.trim()).filter(Boolean),note:$("#note").value.trim()};let i=items.findIndex(y=>y.id==x.id);i<0?items.push(x):items[i]=x;save();$("#dlg").close();render()};
$("#del").onclick=()=>{if(confirm("Eintrag löschen?")){items=items.filter(x=>x.id!=$("#id").value);save();$("#dlg").close();render()}};render();
if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));}
