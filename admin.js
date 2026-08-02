import {firebaseConfig} from "./firebase-config.js";
import{equipmentImageMarkup,bindEquipmentImageFallbacks,setupEquipmentPreview,setEquipmentFormValues,addEquipmentReferenceInline}from"./equipment-images.js?v=20260801-2";
import{initializeApp}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import{getAuth,signInWithEmailAndPassword,onAuthStateChanged,signOut}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import{getFirestore,collection,doc,setDoc,updateDoc,deleteDoc,onSnapshot,query,orderBy,getDocs}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const $=id=>document.getElementById(id);
const RECEPCION_PUBLIC_URL="https://deathmaskxe.github.io/recepcion-y-agenda/";
const states=["Recibido","En diagnóstico","Esperando autorización","En reparación","Esperando refacción","En pruebas","Terminado","Entregado","Devolución"];
let all=[],ultimaRecepcion=null,mostrarIngresos=false,mostrarTelefonos=false;
let citaOrigen=null;
try{citaOrigen=JSON.parse(localStorage.getItem("xe_cita_recepcion")||"null")}catch(e){console.warn("No se pudo leer la cita de origen",e)}
setupEquipmentPreview("equipo","modelo","newEquipmentPreview");

$("loginBtn").onclick=async()=>{
  try{
    $("loginMsg").textContent="";
    await signInWithEmailAndPassword(auth,$("email").value.trim(),$("pass").value);
  }catch(e){
    console.error("Firebase Auth error:",e);
    const errores={
      "auth/invalid-credential":"Correo o contraseña incorrectos.",
      "auth/invalid-email":"El correo electrónico no es válido.",
      "auth/user-disabled":"Este usuario está deshabilitado.",
      "auth/too-many-requests":"Demasiados intentos. Espera un momento.",
      "auth/network-request-failed":"Error de red. Revisa tu conexión.",
      "auth/operation-not-allowed":"El acceso por correo y contraseña no está habilitado."
    };
    $("loginMsg").textContent=errores[e.code]||`Error Firebase: ${e.code||e.message}`;
  }
};

$("logout").onclick=()=>signOut(auth);
$("toggleIngresos").onclick=()=>{mostrarIngresos=!mostrarIngresos;$("toggleIngresos").textContent=mostrarIngresos?"OCULTAR INGRESOS":"MOSTRAR INGRESOS";$("toggleIngresos").setAttribute("aria-pressed",String(mostrarIngresos));renderStats();render()};
$("toggleTelefonos").onclick=()=>{mostrarTelefonos=!mostrarTelefonos;$("toggleTelefonos").textContent=mostrarTelefonos?"OCULTAR TELÉFONOS":"MOSTRAR TELÉFONOS";$("toggleTelefonos").setAttribute("aria-pressed",String(mostrarTelefonos));render()};
onAuthStateChanged(auth,u=>{
  $("login").classList.toggle("hidden",!!u);
  $("dashboard").classList.toggle("hidden",!u);
  if(u)listen();
});

$("crear").onclick=async()=>{
  try{
    const now=Date.now();
    const folio=`XE-${new Date().getFullYear()}-${String(now).slice(-6)}`;
    const d={
      cliente:$("cliente").value.trim(),
      telefono:$("telefono").value.trim(),
      correo:$("correo").value.trim(),
      equipo:$("equipo").value.trim(),
      modelo:$("modelo").value.trim(),
      marca:$("marca").value.trim(),
      serie:$("serie").value.trim(),
      color:$("color").value.trim(),
      falla:$("falla").value.trim(),
      nota:$("nota").value.trim(),
      accesorios:$("accesorios").value.trim(),
      observaciones:$("observaciones").value.trim(),
      anticipo:Math.max(0,Number($("anticipo").value)||0),
      costoTotal:Math.max(0,Number($("costoTotal").value)||0),
      reparacionRealizada:"",
      estado:"Recibido",recibido:now,actualizado:now,entregado:null,
      garantiaTiempo:Math.max(0,Number($("garantiaTiempo").value)||0),
      garantiaUnidad:$("garantiaUnidad").value,
      garantiaHasta:null,
      historial:[{estado:"Recibido",nota:$("nota").value.trim()||"Equipo recibido en taller.",fecha:now}]
    };
    if(!d.cliente||!d.equipo)return alert("Escribe cliente y equipo");
    if(!d.telefono)return alert("Escribe el WhatsApp del cliente");

    await setDoc(doc(db,"equipos",folio),d);
    const pub={cliente:d.cliente,equipo:d.equipo,modelo:d.modelo,nota:d.nota,estado:d.estado,recibido:d.recibido,actualizado:d.actualizado,entregado:d.entregado,garantiaTiempo:d.garantiaTiempo,garantiaUnidad:d.garantiaUnidad,garantiaHasta:d.garantiaHasta,historial:d.historial};
    await setDoc(doc(db,"estados_publicos",folio),pub);
    if(citaOrigen?.id){
      await Promise.all([
        deleteDoc(doc(db,"citas",citaOrigen.id)),
        deleteDoc(doc(db,"citas_publicas",citaOrigen.id))
      ]);
      localStorage.removeItem("xe_cita_recepcion");
      citaOrigen=null;
      history.replaceState(null,"","admin.html");
    }

    ultimaRecepcion={folio,...d};
    $("created").innerHTML=`FOLIO CREADO: ${folio}<br><br><button type="button" id="pdfRecepcionNueva">PDF RECEPCIÓN / ANTICIPO</button> <button type="button" id="enviarWhatsapp">ENVIAR FOLIO POR WHATSAPP</button>`;
    document.getElementById("pdfRecepcionNueva").addEventListener("click",()=>generarPDFRecepcion(ultimaRecepcion));
    document.getElementById("enviarWhatsapp").addEventListener("click",()=>enviarFolioWhatsApp(ultimaRecepcion));

    ["cliente","telefono","correo","equipo","modelo","marca","serie","color","falla","nota","accesorios","observaciones","anticipo","costoTotal"].forEach(x=>$(x).value="");$("equipo").dispatchEvent(new Event("change"));$("garantiaTiempo").value="30";$("garantiaUnidad").value="dias";
  }catch(e){
    console.error(e);
    alert("No se pudo crear la recepción: "+(e.code||e.message));
  }
};

function normalizarWhatsApp(valor){
  let numero=String(valor||"").replace(/\D/g,"");
  if(numero.startsWith("521")&&numero.length===13)numero=numero.slice(3);
  else if(numero.startsWith("52")&&numero.length===12)numero=numero.slice(2);
  if(numero.length!==10)return null;
  return "52"+numero;
}

function normalizarTextoEquipo(valor){
  return String(valor||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
}

function equipoCompleto(d){
  const equipo=String(d?.equipo||"").trim(),modelo=String(d?.modelo||"").trim();
  if(!equipo)return modelo||"No especificado";
  if(!modelo)return equipo;
  const equipoNormal=normalizarTextoEquipo(equipo),modeloNormal=normalizarTextoEquipo(modelo);
  if(equipoNormal===modeloNormal)return equipo;
  if(!["consola","control","pantalla"].includes(equipoNormal)&&(equipoNormal.includes(modeloNormal)||modeloNormal.includes(equipoNormal)))return equipo;
  return `${equipo} ${modelo}`;
}

function linkRecepcionPublica(folio){
  return `${RECEPCION_PUBLIC_URL}?folio=${encodeURIComponent(folio)}`;
}

function enviarFolioWhatsApp(d){
  const numeroCliente=normalizarWhatsApp(d.telefono);
  if(!numeroCliente){
    alert(`WhatsApp inválido.\nNúmero capturado: ${d.telefono}`);
    return;
  }

  const equipoTexto=equipoCompleto(d);
  const link=linkRecepcionPublica(d.folio);
  const mensaje=`🎮 *XE SERVICIO ELECTRÓNICO*

Hola ${d.cliente} 👋

Tu equipo *${equipoTexto}* ha sido recibido correctamente en nuestro taller.

🔹 *Folio:* ${d.folio}
🔹 *Equipo:* ${equipoTexto}
🔹 *Estado actual:* Recibido

Puedes consultar en tiempo real el estado de tu equipo y el tiempo que lleva en nuestro taller aquí:

*${link}*

Guarda tu folio para futuras consultas.

⚡ *XE Servicio Electrónico*
Diagnóstico y reparación profesional.`;

  if(!confirm(`ENVIAR FOLIO POR WHATSAPP\n\nCliente: ${d.cliente}\nWhatsApp: +${numeroCliente}\n\n¿Abrir este número?`))return;

  const url=`https://wa.me/${numeroCliente}?text=${encodeURIComponent(mensaje)}`;
  const nueva=window.open(url,"_blank");
  if(!nueva)window.location.href=url;
}

function calcularGarantiaHasta(entregado,tiempo,unidad){
  const n=Math.max(0,Number(tiempo)||0);
  if(!entregado||!n)return null;
  const fecha=new Date(entregado);
  if(unidad==="meses")fecha.setMonth(fecha.getMonth()+n);
  else fecha.setDate(fecha.getDate()+n);
  return fecha.getTime();
}

function garantiaInfo(x){
  if(x.estado==="Devolución")return {clase:"sin",texto:"DEVOLUCIÓN SIN GARANTÍA",detalle:"Equipo devuelto sin reparación o sin autorización de presupuesto"};
  if(!x.entregado)return {clase:"pendiente",texto:"GARANTÍA AÚN NO INICIA",detalle:`${x.garantiaTiempo||0} ${x.garantiaUnidad||"días"} después de entrega`};
  if(!x.garantiaHasta)return {clase:"sin",texto:"SIN GARANTÍA",detalle:"Sin periodo de garantía asignado"};
  const restante=x.garantiaHasta-Date.now();
  if(restante>0){
    const dias=Math.ceil(restante/864e5);
    return {clase:"vigente",texto:"EN GARANTÍA",detalle:`${dias} día${dias===1?"":"s"} restante${dias===1?"":"s"} · vence ${new Date(x.garantiaHasta).toLocaleString("es-MX")}`};
  }
  return {clase:"vencida",texto:"FUERA DE GARANTÍA",detalle:`Venció ${new Date(x.garantiaHasta).toLocaleString("es-MX")}`};
}

function listen(){
  onSnapshot(query(collection(db,"equipos"),orderBy("recibido","desc")),s=>{
    all=s.docs.map(x=>({id:x.id,...x.data()}));
    renderStats();
    render();
  });
}
$("filter").oninput=render;

function valorFecha(v){
  if(!v)return null;
  if(typeof v.toDate==="function")return v.toDate();
  const fecha=v instanceof Date?v:new Date(v);
  return Number.isNaN(fecha.getTime())?null:fecha;
}

function esMesActual(v){
  const fecha=valorFecha(v),hoy=new Date();
  return !!fecha&&fecha.getFullYear()===hoy.getFullYear()&&fecha.getMonth()===hoy.getMonth();
}

function claveMesEquipo(x){
  const fecha=valorFecha(x.recibido)||valorFecha(x.creada);
  if(!fecha)return"sin-fecha";
  return `${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,"0")}`;
}

function nombreMesEquipo(x){
  const fecha=valorFecha(x.recibido)||valorFecha(x.creada);
  return fecha?fecha.toLocaleDateString("es-MX",{month:"long",year:"numeric"}):"Sin fecha de recepción";
}

function renderStats(){
  const entregadosMes=all.filter(x=>x.estado==="Entregado"&&esMesActual(x.entregado));
  $("statTaller").textContent=all.filter(x=>x.estado!=="Entregado"&&x.estado!=="Devolución").length;
  $("statEntregados").textContent=entregadosMes.length;
  $("statDevueltos").textContent=all.filter(x=>x.estado==="Devolución").length;
  $("statAutorizacion").textContent=all.filter(x=>x.estado==="Esperando autorización").length;
  $("statTotal").textContent=all.length;
  const ingresos=moneda(entregadosMes.reduce((suma,x)=>suma+(Number(x.costoTotal)||0),0));
  $("statIngresos").textContent=mostrarIngresos?ingresos:"••••••";
  $("statIngresos").classList.toggle("revealed",mostrarIngresos);
}

function serializarFirestore(valor){
  if(valor===null||valor===undefined)return valor??null;
  if(typeof valor.toDate==="function")return valor.toDate().toISOString();
  if(valor instanceof Date)return valor.toISOString();
  if(Array.isArray(valor))return valor.map(serializarFirestore);
  if(typeof valor==="object")return Object.fromEntries(Object.entries(valor).map(([clave,dato])=>[clave,serializarFirestore(dato)]));
  return valor;
}

function descargarArchivo(contenido,nombre,tipo){
  const url=URL.createObjectURL(new Blob([contenido],{type:tipo}));
  const enlace=document.createElement("a");
  enlace.href=url;
  enlace.download=nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function selloArchivo(prefijo,extension){
  const d=new Date(),dos=n=>String(n).padStart(2,"0");
  return `${prefijo}-${d.getFullYear()}-${dos(d.getMonth()+1)}-${dos(d.getDate())}-${dos(d.getHours())}${dos(d.getMinutes())}.${extension}`;
}

$("downloadBackup").onclick=async()=>{
  const boton=$("downloadBackup"),msg=$("backupMsg"),nombres=["equipos","estados_publicos","citas","citas_publicas"];
  boton.disabled=true;
  msg.textContent="Leyendo colecciones de Firestore...";
  const colecciones={},vacias=[],errores=[];
  for(const nombre of nombres){
    try{
      const snapshot=await getDocs(collection(db,nombre));
      colecciones[nombre]=Object.fromEntries(snapshot.docs.map(documento=>[documento.id,serializarFirestore(documento.data())]));
      if(snapshot.empty)vacias.push(nombre);
    }catch(e){
      console.error(`Error al respaldar ${nombre}:`,e);
      errores.push(`${nombre}: ${e.code||e.message}`);
    }
  }
  const respaldo={version:"1.0",fechaRespaldo:new Date().toISOString(),colecciones};
  if(errores.length)respaldo.errores=errores;
  descargarArchivo(JSON.stringify(respaldo,null,2),selloArchivo("XE-Respaldo","json"),"application/json;charset=utf-8");
  const avisos=[];
  if(vacias.length)avisos.push(`Sin documentos: ${vacias.join(", ")}.`);
  if(errores.length)avisos.push(`Fallaron: ${errores.join(" | ")}.`);
  msg.textContent=avisos.length?`Respaldo descargado. ${avisos.join(" ")}`:"Respaldo completo descargado correctamente.";
  boton.disabled=false;
};

function celdaCsv(valor){
  return `"${String(valor??"").replace(/"/g,'""')}"`;
}

function fechaCsv(valor){
  const fecha=valorFecha(valor);
  return fecha?fecha.toLocaleString("es-MX"):"";
}

$("exportCsv").onclick=()=>{
  const encabezados=["Folio","Cliente","Teléfono","Correo","Equipo","Modelo","Marca","Serie","Color","Falla reportada","Estado","Fecha de recepción","Fecha de entrega","Anticipo","Costo total","Reparación realizada","Garantía hasta"];
  const filas=all.map(x=>[x.id,x.cliente,x.telefono,x.correo,x.equipo,x.modelo,x.marca,x.serie,x.color,x.falla,x.estado,fechaCsv(x.recibido),fechaCsv(x.entregado),Number(x.anticipo)||0,Number(x.costoTotal)||0,x.reparacionRealizada,fechaCsv(x.garantiaHasta)]);
  const csv="\uFEFF"+[encabezados,...filas].map(fila=>fila.map(celdaCsv).join(",")).join("\r\n");
  descargarArchivo(csv,selloArchivo("XE-Equipos","csv"),"text/csv;charset=utf-8");
  $("backupMsg").textContent=`CSV exportado correctamente: ${filas.length} expediente${filas.length===1?"":"s"}.`;
};

function render(){
  const f=$("filter").value.toLowerCase();
  const arr=all.filter(x=>(x.id+" "+x.cliente+" "+x.equipo).toLowerCase().includes(f));
  const inputImporte=(tipo,id,valor,placeholder)=>mostrarIngresos
    ?`<input type="number" min="0" step="0.01" data-${tipo}="${id}" value="${Number(valor||0)}" placeholder="${placeholder}">`
    :`<input type="password" class="private-money" data-${tipo}="${id}" value="••••••" placeholder="${placeholder}" readonly aria-label="${placeholder} oculto">`;

  const tarjeta=x=>{const g=garantiaInfo(x);const historial=(x.historial||[]).slice().reverse();const clase=x.estado==="Entregado"?"item-entregado":x.estado==="Devolución"?"item-devolucion":"item-taller";const telefono=mostrarTelefonos?esc(x.telefono||"Sin número"):"••• ••• ••••";return `<div class="item ${clase}">${equipmentImageMarkup(x.equipo,x.modelo,true)}<div class="itemtop"><div><h3>${x.id} · ${esc(x.equipo)}</h3><p>${esc(x.cliente)} · ${esc(x.falla||"Sin falla reportada")}</p><p>WhatsApp: <span class="phone-value">${telefono}</span></p><div class="warranty-badge ${g.clase}"><b>${g.texto}</b><span>${g.detalle}</span></div></div><b>${x.estado}</b></div><div class="controls"><select data-state="${x.id}">${states.map(s=>`<option ${s===x.estado?"selected":""}>${s}</option>`).join("")}</select><textarea data-note="${x.id}" placeholder="Nueva actualización visible para el cliente">${esc(x.nota||"")}</textarea><button data-save="${x.id}">GUARDAR Y AVISAR</button></div><div class="financial-edit">${inputImporte("anticipo",x.id,x.anticipo,"Anticipo")}${inputImporte("total",x.id,x.costoTotal,"Costo total")}<textarea data-reparacion="${x.id}" placeholder="Reparación realizada para el PDF de entrega">${esc(x.reparacionRealizada||"")}</textarea><button data-finanzas="${x.id}">GUARDAR IMPORTES</button></div><div class="pdf-actions"><button data-pdf-recepcion="${x.id}">PDF RECEPCIÓN Y ANTICIPO</button><button data-pdf-entrega="${x.id}">NOTA DE ENTREGA Y PAGO</button></div><label class="notify-check"><input type="checkbox" data-notify="${x.id}" checked> Abrir WhatsApp con el aviso después de guardar</label><details class="admin-history"><summary>HISTORIAL (${historial.length})</summary><div>${historial.map(h=>`<div class="history-entry"><small>${new Date(h.fecha).toLocaleString("es-MX")}</small><b>${esc(h.estado||"")}</b><span>${esc(h.nota||"Sin nota")}</span></div>`).join("")||"<p>Sin historial.</p>"}</div></details></div>`};

  const bloque=(titulo,clase,datos,vacio)=>`<section class="equipment-group ${clase}"><div class="equipment-group-title"><h3>${titulo}</h3><span>${datos.length}</span></div>${datos.length?datos.map(tarjeta).join(""):`<p class="empty-group">${vacio}</p>`}</section>`;
  const secciones=datos=>{
    const taller=datos.filter(x=>x.estado!=="Entregado"&&x.estado!=="Devolución");
    const entregados=datos.filter(x=>x.estado==="Entregado");
    const devoluciones=datos.filter(x=>x.estado==="Devolución");
    return bloque("EQUIPOS EN TALLER","group-taller",taller,"No hay equipos activos en el taller.")+
      bloque("EQUIPOS ENTREGADOS","group-entregados",entregados,"No hay equipos entregados en este mes.")+
      bloque("DEVOLUCIONES","group-devoluciones",devoluciones,"No hay devoluciones en este mes.");
  };
  const hoy=new Date(),mesActual=`${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,"0")}`;
  const actuales=arr.filter(x=>claveMesEquipo(x)===mesActual);
  const mesesAnteriores=new Map();
  arr.filter(x=>claveMesEquipo(x)!==mesActual).forEach(x=>{
    const clave=claveMesEquipo(x);
    if(!mesesAnteriores.has(clave))mesesAnteriores.set(clave,[]);
    mesesAnteriores.get(clave).push(x);
  });
  const archivos=[...mesesAnteriores.entries()].sort(([a],[b])=>b.localeCompare(a)).map(([clave,datos])=>`<details class="month-archive"${f?" open":""}><summary><span>${nombreMesEquipo(datos[0]).toUpperCase()}</span><b>${datos.length} EQUIPO${datos.length===1?"":"S"}</b></summary><div class="month-archive-content">${secciones(datos)}</div></details>`).join("");
  $("list").innerHTML=`<section class="current-month"><div class="monthly-heading"><div><small>MES ACTUAL</small><h3>${hoy.toLocaleDateString("es-MX",{month:"long",year:"numeric"}).toUpperCase()}</h3></div><b>${actuales.length} EQUIPO${actuales.length===1?"":"S"}</b></div>${secciones(actuales)}</section>${archivos?`<div class="archive-heading"><small>ARCHIVO POR FECHA DE RECEPCIÓN</small><h3>MESES ANTERIORES</h3></div>${archivos}`:""}`;
  bindEquipmentImageFallbacks($("list"));

  document.querySelectorAll("[data-finanzas]").forEach(b=>b.onclick=async()=>{
    const id=b.dataset.finanzas;
    const old=all.find(x=>x.id===id)||{};
    const anticipo=mostrarIngresos?Math.max(0,Number(document.querySelector(`[data-anticipo="${id}"]`).value)||0):Number(old.anticipo)||0;
    const costoTotal=mostrarIngresos?Math.max(0,Number(document.querySelector(`[data-total="${id}"]`).value)||0):Number(old.costoTotal)||0;
    const reparacionRealizada=document.querySelector(`[data-reparacion="${id}"]`).value.trim();
    try{await updateDoc(doc(db,"equipos",id),{anticipo,costoTotal,reparacionRealizada});alert("Importes y reparación guardados.")}catch(e){alert("No se pudieron guardar: "+(e.code||e.message))}
  });
  document.querySelectorAll("[data-pdf-recepcion]").forEach(b=>b.onclick=()=>generarPDFRecepcion(all.find(x=>x.id===b.dataset.pdfRecepcion)));
  document.querySelectorAll("[data-pdf-entrega]").forEach(b=>b.onclick=()=>{const x=all.find(x=>x.id===b.dataset.pdfEntrega);if(x.estado!=="Entregado")return alert("El PDF de entrega solo se genera cuando el estado es Entregado.");generarPDFEntrega(x)});

  document.querySelectorAll("[data-save]").forEach(b=>b.onclick=async()=>{
    const id=b.dataset.save;
    const old=all.find(x=>x.id===id);
    const estado=document.querySelector(`[data-state="${id}"]`).value;
    const nota=document.querySelector(`[data-note="${id}"]`).value.trim();
    const avisar=document.querySelector(`[data-notify="${id}"]`).checked;
    const ahora=Date.now();
    const cambio=estado!==old.estado||nota!==(old.nota||"");
    if(!cambio)return alert("No hay cambios nuevos para guardar.");

    const historial=[...(old.historial||[]),{estado,nota:nota||"Sin nota adicional.",fecha:ahora}];
    const upd={estado,nota,actualizado:ahora,historial};
    if(estado==="Entregado"){
      upd.entregado=old.entregado||ahora;
      upd.devolucion=null;
      upd.garantiaHasta=old.garantiaHasta||calcularGarantiaHasta(upd.entregado,old.garantiaTiempo,old.garantiaUnidad);
    }else if(estado==="Devolución"){
      upd.devolucion=old.devolucion||ahora;
      upd.entregado=null;
      upd.garantiaHasta=null;
    }else if(old.estado==="Entregado"||old.estado==="Devolución"){
      upd.entregado=null;
      upd.devolucion=null;
      upd.garantiaHasta=null;
    }

    let ventana=null;
    if(avisar)ventana=window.open("about:blank","_blank");
    try{
      b.disabled=true;
      b.textContent="GUARDANDO...";
      await updateDoc(doc(db,"equipos",id),upd);
      await updateDoc(doc(db,"estados_publicos",id),upd);
      if(avisar)abrirAvisoWhatsApp({...old,...upd,id},ventana);
    }catch(e){
      if(ventana)ventana.close();
      console.error(e);
      alert("No se pudo guardar la actualización: "+(e.code||e.message));
    }finally{
      b.disabled=false;
      b.textContent="GUARDAR Y AVISAR";
    }
  });
}

function abrirAvisoWhatsApp(d,ventana){
  const numeroCliente=normalizarWhatsApp(d.telefono);
  if(!numeroCliente){
    if(ventana)ventana.close();
    alert(`La actualización se guardó, pero el WhatsApp no es válido.\nNúmero capturado: ${d.telefono||"Sin número"}`);
    return;
  }
  const equipoTexto=equipoCompleto(d);
  const link=linkRecepcionPublica(d.id);
  const mensaje=`🎮 *ACTUALIZACIÓN DE REPARACIÓN XE*

Hola ${d.cliente} 👋

Tenemos una nueva actualización de tu equipo *${equipoTexto}*.

🔹 *Folio:* ${d.id}
🔹 *Equipo:* ${equipoTexto}
🔹 *Nuevo estado:* ${d.estado}
🔹 *Detalle:* ${d.nota||"Sin nota adicional"}
🔹 *Fecha:* ${new Date(d.actualizado).toLocaleString("es-MX")}

Consulta el historial completo aquí:
*${link}*

⚡ *XE Servicio Electrónico*`;
  const url=`https://wa.me/${numeroCliente}?text=${encodeURIComponent(mensaje)}`;
  if(ventana)ventana.location.href=url;
  else window.open(url,"_blank");
}

function esc(s){
  return String(s).replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
}


// Precarga una cita al convertirla en recepción.
const paramsAdmin=new URLSearchParams(location.search);
if(paramsAdmin.get("desdeCita")==="1"){
  try{
    const cita=citaOrigen;
    if(cita){
      const cargar=()=>{
        $("cliente").value=cita.cliente||"";
        $("telefono").value=cita.telefono||"";
        setEquipmentFormValues("equipo","modelo",cita.equipo||"",cita.modelo||"");
        $("falla").value=cita.falla||"";
        $("nota").value=`Cita ${cita.id} convertida en recepción.`;
      };
      if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",cargar);else cargar();
    }
  }catch(e){console.warn("No se pudo precargar la cita",e)}
}


function moneda(v){return new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(Number(v)||0)}
function fechaLarga(v){return v?new Date(v).toLocaleString("es-MX",{dateStyle:"long",timeStyle:"short"}):"No especificada"}
function fechaMilisegundos(v){
  if(!v)return null;
  if(typeof v.toMillis==="function")return v.toMillis();
  const n=typeof v==="number"?v:new Date(v).getTime();
  return Number.isFinite(n)?n:null;
}
function primeraFechaCaptura(x){
  const fechas=[fechaMilisegundos(x.recibido),...(x.historial||[]).map(h=>fechaMilisegundos(h.fecha))].filter(Boolean);
  return fechas.length?Math.min(...fechas):null;
}
function ultimaFechaEntrega(x){
  const entregas=[
    fechaMilisegundos(x.entregado),
    ...(x.historial||[])
      .filter(h=>String(h.estado||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()==="entregado")
      .map(h=>fechaMilisegundos(h.fecha))
  ].filter(Boolean);
  return entregas.length?Math.max(...entregas):null;
}
function pdfMarco(p,primario,secundario){
  p.setFillColor(248,248,248);p.rect(0,0,210,297,"F");
  p.setDrawColor(...primario);p.setLineWidth(1.2);p.roundedRect(8,8,194,281,3,3,"S");
  p.setDrawColor(...secundario);p.setLineWidth(.35);p.roundedRect(11,11,188,275,2,2,"S");
}
function pdfLogo(p,x,y,primario,oscuro=false){
  p.setFillColor(...primario);p.roundedRect(x,y,27,27,4,4,"F");
  p.setTextColor(oscuro?20:255,oscuro?20:255,oscuro?20:255);p.setFont("helvetica","bold");p.setFontSize(19);p.text("XE",x+13.5,y+18,{align:"center"});
}
function pdfPie(p,primario){
  p.setDrawColor(...primario);p.setLineWidth(.45);p.line(18,270,192,270);
  p.setTextColor(38,38,38);p.setFont("helvetica","bold");p.setFontSize(9);p.text("XE SERVICIO ELECTRÓNICO",105,278,{align:"center"});
  p.setFont("helvetica","normal");p.setFontSize(8);p.text("EXPERTOS EN TECNOLOGÍA",105,284,{align:"center"});
}
function pdfTitulo(p,titulo,subtitulo,primario,oscuro=false){
  p.setFillColor(...(oscuro?[14,14,16]:primario));p.roundedRect(13,13,184,37,3,3,"F");
  pdfLogo(p,19,18,oscuro?primario:[235,238,242],!oscuro);
  p.setTextColor(...(oscuro?primario:[255,255,255]));p.setFont("helvetica","bold");p.setFontSize(17);p.text(titulo,55,29);
  p.setFont("helvetica","normal");p.setFontSize(8);p.text(subtitulo.toUpperCase(),55,38);
}
function pdfEtiqueta(p,texto,x,y,w,primario,oscuro=false){
  p.setFillColor(...(oscuro?[20,20,22]:primario));p.roundedRect(x,y,w,9,2,2,"F");
  p.setTextColor(...(oscuro?primario:[255,255,255]));p.setFont("helvetica","bold");p.setFontSize(7.5);p.text(texto.toUpperCase(),x+w/2,y+6,{align:"center"});
}
function pdfCampo(p,etiqueta,valor,x,y,w,primario){
  p.setFillColor(255,255,255);p.setDrawColor(220,223,228);p.roundedRect(x,y,w,20,2,2,"FD");
  p.setTextColor(...primario);p.setFont("helvetica","bold");p.setFontSize(7);p.text(etiqueta.toUpperCase(),x+5,y+6);
  p.setTextColor(45,45,48);p.setFont("helvetica","normal");p.setFontSize(9);const lines=p.splitTextToSize(String(valor??"No especificado"),w-10);p.text(lines.slice(0,2),x+5,y+12);
}
function pdfTextoLargo(p,etiqueta,valor,x,y,w,h,primario){
  p.setFillColor(255,255,255);p.setDrawColor(220,223,228);p.roundedRect(x,y,w,h,2,2,"FD");
  p.setTextColor(...primario);p.setFont("helvetica","bold");p.setFontSize(7);p.text(etiqueta.toUpperCase(),x+5,y+6);
  p.setTextColor(45,45,48);p.setFont("helvetica","normal");p.setFontSize(8.5);const lines=p.splitTextToSize(String(valor??"No especificado"),w-10);p.text(lines.slice(0,Math.max(1,Math.floor((h-10)/4.5))),x+5,y+12);
}

const NOTA_CYAN=[0,188,225],NOTA_DARK=[3,8,10],NOTA_LINE=[135,145,150];
function folioPDF(x){return x.folio||x.id||"SIN-FOLIO"}
function fechaPartes(v){
  const fecha=valorFecha(v)||new Date();
  return {
    fecha:fecha.toLocaleDateString("es-MX",{day:"2-digit",month:"2-digit",year:"numeric"}),
    hora:fecha.toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"})
  };
}
function textoCampo(v,placeholder="No especificado"){return String(v||"").trim()||placeholder}
function marcaEquipo(x){
  if(String(x?.marca||"").trim())return x.marca;
  const valor=normalizarTextoEquipo(equipoCompleto(x));
  if(valor.includes("xbox"))return"Xbox";
  if(valor.includes("playstation")||valor.includes("ps4")||valor.includes("ps5")||valor.includes("dualsense")||valor.includes("dualshock"))return"PlayStation";
  if(valor.includes("nintendo")||valor.includes("switch")||valor.includes("joy"))return"Nintendo";
  if(valor.includes("pantalla"))return"Pantalla";
  if(valor.includes("pc"))return"PC Gamer";
  return"";
}
function coincideEquipo(x,terminos){
  const valor=normalizarTextoEquipo(`${x.equipo||""} ${x.modelo||""} ${equipoCompleto(x)}`);
  return terminos.some(t=>valor.includes(normalizarTextoEquipo(t)));
}
function opcionesEquipoNota(x){
  const opciones=[
    {label:"Xbox Series X",terms:["xbox series x"]},
    {label:"Xbox Series S",terms:["xbox series s"]},
    {label:"Xbox One",terms:["xbox one"]},
    {label:"PS5",terms:["ps5","playstation 5"]},
    {label:"PS4",terms:["ps4","playstation 4"]},
    {label:"Nintendo Switch",terms:["nintendo switch","switch"]}
  ];
  const marcadas=opciones.map(o=>({...o,checked:coincideEquipo(x,o.terms)}));
  return {opciones:marcadas,otro:!marcadas.some(o=>o.checked)};
}
function pdfNotaBase(p){
  p.setFillColor(...NOTA_DARK);p.rect(0,0,210,297,"F");
  p.setDrawColor(...NOTA_CYAN);p.setLineWidth(.55);p.roundedRect(2,2,206,293,4,4,"S");
  p.setFillColor(249,250,250);p.roundedRect(2.5,48,205,233,1,1,"F");
}
function pdfLogoFallback(p,x,y){
  p.setTextColor(...NOTA_CYAN);p.setFont("helvetica","bold");p.setFontSize(24);p.text("XE",x,y+15);
  p.setTextColor(255,255,255);p.setFontSize(6);p.text("SERVICIO ELECTRONICO",x,y+23);
}
async function pdfNotaHeader(p,titulo,folio,fechaValor,fechaLabel="FECHA"){
  pdfNotaBase(p);
  const partes=fechaPartes(fechaValor);
  const logo=await cargarLogoXE().catch(()=>null);
  if(logo)p.addImage(logo,"PNG",10,12,43,24,undefined,"FAST");else pdfLogoFallback(p,10,12);
  p.setDrawColor(...NOTA_CYAN);p.setLineWidth(.55);p.line(59,12,151,12);p.line(59,42,151,42);
  p.setTextColor(250,250,250);p.setFont("helvetica","bolditalic");p.setFontSize(18);p.text(titulo,105,28,{align:"center"});
  p.setTextColor(...NOTA_CYAN);p.setFont("helvetica","bold");p.setFontSize(6.5);p.text("CONFIANZA  -  CALIDAD  -  TECNOLOGIA",105,37,{align:"center"});
  p.setDrawColor(...NOTA_CYAN);p.roundedRect(162,8,36,36,2,2,"S");p.line(162,22,198,22);
  p.setTextColor(250,250,250);p.setFont("helvetica","bold");p.setFontSize(5.5);p.text("FOLIO",180,14,{align:"center"});
  p.setTextColor(...NOTA_CYAN);p.setFontSize(10);p.text(String(folio),180,20,{align:"center"});
  p.setFontSize(5.5);p.text(fechaLabel.toUpperCase(),180,27,{align:"center"});
  p.setTextColor(255,255,255);p.setFontSize(6.4);p.text(partes.fecha,180,33,{align:"center"});
  p.setTextColor(...NOTA_CYAN);p.setFontSize(5.2);p.text("HORA:",169,40);
  p.setTextColor(255,255,255);p.text(partes.hora,183,40);
}
function pdfNotaFooter(p){
  p.setFillColor(...NOTA_DARK);p.rect(2.5,281,205,12,"F");
  p.setTextColor(255,255,255);p.setFont("helvetica","normal");p.setFontSize(7);
  p.text(DATOS_TALLER.telefono,20,289);
  p.text("Chilpancingo, Guerrero, Mexico",84,289,{align:"center"});
  p.text("XE Servicio Electronico",170,289,{align:"center"});
}
function pdfNotaSection(p,n,titulo,x,y,w,h){
  p.setFillColor(252,253,253);p.setDrawColor(...NOTA_LINE);p.setLineWidth(.25);p.rect(x,y,w,h,"FD");
  p.setTextColor(0,135,190);p.setFont("helvetica","bold");p.setFontSize(8.5);p.text(`${n}. ${titulo}`,x+5,y+9);
}
function pdfLineField(p,label,value,x,y,endX,options={}){
  const {size=7.2,bold=false}=options;
  p.setTextColor(12,15,18);p.setFont("helvetica","bold");p.setFontSize(6.8);p.text(label,x,y);
  const start=x+p.getTextWidth(label)+3;
  p.setDrawColor(120,125,130);p.setLineWidth(.22);p.line(start,y+1,endX,y+1);
  const texto=String(value||"").trim();
  if(texto){
    p.setFont("helvetica",bold?"bold":"normal");p.setFontSize(size);p.setTextColor(20,24,28);
    p.text(p.splitTextToSize(texto,endX-start-2).slice(0,1),start+1,y);
  }
}
function pdfCheckbox(p,x,y,label,checked=false){
  p.setDrawColor(50,55,60);p.setLineWidth(.25);p.rect(x,y-3.2,3.4,3.4,"S");
  if(checked){p.setDrawColor(0,135,190);p.setLineWidth(.45);p.line(x+.55,y-1.5,x+1.45,y-.4);p.line(x+1.45,y-.4,x+3,y-2.75)}
  p.setTextColor(10,12,14);p.setFont("helvetica","normal");p.setFontSize(6.8);p.text(label,x+5.5,y);
}
function pdfEquipoChecklist(p,x,y,data,endX){
  const {opciones,otro}=opcionesEquipoNota(data);
  const compacto=endX-x<120;
  const row1=compacto?[0,34,67]:[0,39,78];
  const row2=compacto?[0,22,43,72]:[0,26,52,91];
  opciones.slice(0,3).forEach((o,i)=>pdfCheckbox(p,x+row1[i],y,o.label,o.checked));
  opciones.slice(3,6).forEach((o,i)=>pdfCheckbox(p,x+row2[i],y+8,o.label,o.checked));
  pdfCheckbox(p,Math.min(x+row2[3],endX-24),y+8,"Otro:",otro);
}
function pdfLongText(p,text,x,y,w,maxLines,size=7.2){
  p.setTextColor(25,28,31);p.setFont("helvetica","normal");p.setFontSize(size);
  const lines=p.splitTextToSize(String(text||"").trim()||"No especificado",w);
  p.text(lines.slice(0,maxLines),x,y);
}
function pdfBullets(p,items,x,y,w,lineHeight=4.6){
  p.setFont("helvetica","normal");p.setFontSize(6.5);p.setTextColor(20,25,30);
  let yy=y;
  items.forEach(item=>{
    p.setFillColor(...NOTA_CYAN);p.circle(x,yy-1.2,.55,"F");
    const lines=p.splitTextToSize(item,w);
    p.text(lines,x+4,yy);
    yy+=Math.max(1,lines.length)*lineHeight;
  });
  return yy;
}
function pdfMarcadorFisico(texto,termino){
  return normalizarTextoEquipo(texto).includes(normalizarTextoEquipo(termino));
}
async function generarPDFRecepcion(x){
  if(!x||!window.jspdf)return alert("No se pudo cargar el generador PDF.");
  try{
    const {jsPDF}=window.jspdf,p=new jsPDF({unit:"mm",format:"a4",compress:true});
    const folio=folioPDF(x),obs=String(x.observaciones||"");
    await pdfNotaHeader(p,"NOTA DE RECEPCIÓN",folio,x.recibido||Date.now(),"FECHA");

    pdfNotaSection(p,1,"DATOS DEL CLIENTE",8,50,91,44);
    pdfLineField(p,"Nombre:",x.cliente,14,66,94);
    pdfLineField(p,"Teléfono / WhatsApp:",x.telefono,14,78,94);
    pdfLineField(p,"Correo electrónico:",x.correo,14,90,94);

    pdfNotaSection(p,2,"DATOS DEL EQUIPO",99,50,103,72);
    p.setTextColor(12,15,18);p.setFont("helvetica","bold");p.setFontSize(6.8);p.text("Tipo de equipo:",104,64);
    pdfEquipoChecklist(p,104,73,x,197);
    pdfLineField(p,"Marca:",marcaEquipo(x),104,90,197);
    pdfLineField(p,"Modelo:",x.modelo||equipoCompleto(x),104,101,197);
    pdfLineField(p,"Número de serie:",x.serie,104,112,197);
    pdfLineField(p,"Color:",x.color,104,120,197);

    pdfNotaSection(p,3,"ESTADO FÍSICO DEL EQUIPO",8,94,91,104);
    await addEquipmentReferenceInline(p,x.equipo,x.modelo,14,111,38,43,false);
    const checks=[["Rayones","rayon"],["Golpes","golpe"],["Sellos rotos","sello"],["Tornillos faltantes","tornillo"],["Suciedad","suciedad"],["Humedad","humedad"],["Equipo abierto anteriormente","abierto"]];
    checks.forEach((c,i)=>pdfCheckbox(p,57,114+i*8,c[0],pdfMarcadorFisico(obs,c[1])));
    pdfLineField(p,"Notas:",x.observaciones||x.accesorios,14,187,94,{size:6.5});

    pdfNotaSection(p,4,"FALLA REPORTADA POR EL CLIENTE",99,122,103,45);
    pdfLongText(p,x.falla||"No especificada",104,139,91,5,7.1);

    pdfNotaSection(p,5,"NOTAS",99,167,103,31);
    pdfLongText(p,[x.nota,x.accesorios?`Accesorios: ${x.accesorios}`:""].filter(Boolean).join("\n"),104,183,91,3,7);

    pdfNotaSection(p,6,"CONDICIONES DEL SERVICIO",8,198,194,83);
    pdfBullets(p,[
      "El diagnóstico puede cambiar el presupuesto inicial.",
      "El cliente autoriza pruebas y procedimientos necesarios para el diagnóstico y/o reparación.",
      "Equipos con humedad, manipulación previa o daños eléctricos pueden presentar fallas adicionales.",
      "El taller no se hace responsable por información o datos almacenados en el equipo.",
      "El cliente debe recoger su equipo en un plazo máximo de 60 días naturales contados a partir del aviso de entrega."
    ],15,214,176,4.5);
    p.setTextColor(0,135,190);p.setFont("helvetica","bolditalic");p.setFontSize(6.5);
    p.text(p.splitTextToSize("Transcurrido dicho plazo sin ser recogido, el equipo podrá ser vendido o el taller podrá disponer de él de la manera que convenga, sin excepción.",174).slice(0,2),15,240);

    pdfNotaFooter(p);
    p.save(`Nota-Recepcion-${folio}.pdf`);
  }catch(e){console.error(e);alert("No se pudo crear la Nota de Recepción: "+e.message)}
}
const DATOS_TALLER={
  nombre:"XE Servicio Electrónico",
  slogan:"Expertos en Tecnología",
  responsable:"Ing. I. Daniel S.",
  direccion:"Mártires 30 de Diciembre, Col. Guerrero, Chilpancingo, Guerrero",
  telefono:"747 173 1852",
  facebook:"Daniel Sanchez Nava",
  tiktok:"XE Servicio Electrónico",
  youtube:"XE Servicio Electrónico",
  maps:"XE Servicio Electrónico"
};
let logoXeCache=null;
function cargarLogoXE(){
  if(logoXeCache)return Promise.resolve(logoXeCache);
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>{logoXeCache=img;resolve(img)};
    img.onerror=()=>reject(new Error("No se pudo cargar el logotipo XE"));
    img.src="logo-xe.png";
  });
}
function metalLine(p,x1,y1,x2,y2,c1=[17,168,221],c2=[210,164,60]){
  const steps=14;
  for(let i=0;i<steps;i++){
    const t=i/(steps-1),r=Math.round(c1[0]*(1-t)+c2[0]*t),g=Math.round(c1[1]*(1-t)+c2[1]*t),b=Math.round(c1[2]*(1-t)+c2[2]*t);
    p.setDrawColor(r,g,b);p.setLineWidth(.25);const yy=y1+(y2-y1)*t;p.line(x1,yy,x2,yy);
  }
}
function premiumPanel(p,x,y,w,h,title,accent=[19,150,205],dark=false){
  p.setFillColor(...(dark?[15,19,25]:[247,249,252]));p.setDrawColor(...accent);p.setLineWidth(.35);p.roundedRect(x,y,w,h,3,3,"FD");
  p.setFillColor(...(dark?[26,33,43]:[229,236,244]));p.roundedRect(x,y,w,12,3,3,"F");p.rect(x,y+8,w,4,"F");
  p.setTextColor(...(dark?[236,239,244]:accent));p.setFont("helvetica","bold");p.setFontSize(8);p.text(title.toUpperCase(),x+6,y+8);
}
function premiumField(p,label,value,x,y,w,accent=[19,150,205],options={}){
  const {align="left",big=false}=options;
  p.setTextColor(...accent);p.setFont("helvetica","bold");p.setFontSize(6.4);p.text(label.toUpperCase(),x,y);
  p.setTextColor(32,37,45);p.setFont("helvetica",big?"bold":"normal");p.setFontSize(big?11:8.2);
  const txt=p.splitTextToSize(String(value??"No especificado"),w);
  p.text(txt.slice(0,big?1:2),align==="right"?x+w:x,y+6,{align});
}
async function generarPDFEntregaAnterior(x){
  if(!x||!window.jspdf)return alert("No se pudo cargar el generador PDF.");
  try{
    const logo=await cargarLogoXE();
    const {jsPDF}=window.jspdf,p=new jsPDF({unit:"mm",format:"a4",compress:true});
    const azul=[16,151,211],azulOscuro=[7,53,88],oro=[207,161,55],plata=[168,178,189],negro=[8,12,18];
    const total=Number(x.costoTotal)||0,anticipo=Number(x.anticipo)||0,pagoFinal=Math.max(0,total-anticipo);
    const fechaCaptura=primeraFechaCaptura(x)||fechaMilisegundos(x.recibido);
    const fechaEntrega=ultimaFechaEntrega(x)||fechaMilisegundos(x.entregado)||Date.now();

    // Fondo y marco metálico.
    p.setFillColor(5,9,15);p.rect(0,0,210,297,"F");
    p.setDrawColor(...plata);p.setLineWidth(1);p.roundedRect(5,5,200,287,3,3,"S");
    p.setDrawColor(...azul);p.setLineWidth(.45);p.roundedRect(8,8,194,281,2,2,"S");
    metalLine(p,9,9,201,12,azul,oro);metalLine(p,9,285,201,288,oro,azul);

    // Encabezado premium.
    p.setFillColor(...negro);p.roundedRect(10,11,190,58,3,3,"F");
    p.setDrawColor(...azulOscuro);p.setLineWidth(.35);p.roundedRect(11,12,188,56,3,3,"S");
    p.addImage(logo,"PNG",16,16,55,39,undefined,"FAST");
    p.setTextColor(238,241,246);p.setFont("helvetica","bold");p.setFontSize(22);p.text("NOTA DE ENTREGA",194,29,{align:"right"});
    p.setTextColor(...oro);p.setFontSize(8.5);p.text("COMPROBANTE DE SERVICIO Y PAGO",194,38,{align:"right"});
    p.setTextColor(...plata);p.setFont("helvetica","normal");p.setFontSize(7.2);
    p.text(`FOLIO  ${x.id}`,194,49,{align:"right"});
    p.text(`CAPTURA  ${fechaLarga(fechaCaptura)}`,194,55,{align:"right"});
    p.text(`ENTREGA  ${fechaLarga(fechaEntrega)}`,194,61,{align:"right"});
    p.setTextColor(...azul);p.setFont("helvetica","bold");p.setFontSize(7.3);p.text("SERVICIO FINALIZADO",194,64,{align:"right"});

    // Datos cliente / taller.
    premiumPanel(p,12,75,90,54,"Datos del cliente",azul,false);
    premiumField(p,"Nombre",x.cliente,18,94,76,azul);
    premiumField(p,"WhatsApp",x.telefono||"No especificado",18,110,76,azul);
    premiumField(p,"Folio de servicio",x.id,18,123,76,azul);

    premiumPanel(p,108,75,90,54,"Datos del taller",oro,false);
    premiumField(p,"Responsable",DATOS_TALLER.responsable,114,94,76,oro);
    premiumField(p,"Dirección",DATOS_TALLER.direccion,114,108,76,oro);
    premiumField(p,"Teléfono / WhatsApp",DATOS_TALLER.telefono,114,123,76,oro);

    // Equipo y fechas.
    premiumPanel(p,12,135,186,36,"Información del servicio",azul,false);
    premiumField(p,"Equipo",x.equipo,18,154,38,azul);
    premiumField(p,"Modelo / versión",x.modelo||"No especificado",61,154,38,azul);
    premiumField(p,"Primera captura",fechaLarga(fechaCaptura),104,154,40,azul);
    premiumField(p,"Última entrega",fechaLarga(fechaEntrega),149,154,41,azul);

    // Reparación realizada, sin resumen de servicio.
    premiumPanel(p,12,177,186,43,"Reparación realizada",oro,false);
    p.setTextColor(29,34,42);p.setFont("helvetica","normal");p.setFontSize(9);
    const rep=p.splitTextToSize(String(x.reparacionRealizada||x.nota||"No especificada"),174);
    p.text(rep.slice(0,7),18,197);

    // Panel financiero.
    premiumPanel(p,12,226,120,42,"Detalle de pago",azulOscuro,true);
    p.setTextColor(...plata);p.setFont("helvetica","normal");p.setFontSize(7);p.text("COSTO TOTAL",20,247);p.text("ANTICIPO",57,247);p.text("PAGO FINAL",94,247);
    p.setTextColor(245,247,250);p.setFont("helvetica","bold");p.setFontSize(11);p.text(moneda(total),20,259);p.text(moneda(anticipo),57,259);
    p.setTextColor(...oro);p.text(moneda(pagoFinal),94,259);

    // Garantía.
    premiumPanel(p,138,226,60,42,"Garantía",oro,true);
    const garantia=x.garantiaHasta?`${x.garantiaTiempo||0} ${x.garantiaUnidad||"días"}`:"Sin garantía";
    p.setTextColor(...oro);p.setFont("helvetica","bold");p.setFontSize(13);p.text(garantia.toUpperCase(),168,248,{align:"center"});
    p.setTextColor(...plata);p.setFont("helvetica","normal");p.setFontSize(6.6);
    p.text(x.garantiaHasta?`Vence: ${new Date(x.garantiaHasta).toLocaleDateString("es-MX",{day:"2-digit",month:"long",year:"numeric"})}`:"No registrada",168,259,{align:"center"});

    // Redes y pie.
    p.setTextColor(...plata);p.setFont("helvetica","normal");p.setFontSize(6.3);
    p.text(`Facebook: ${DATOS_TALLER.facebook}   |   TikTok: ${DATOS_TALLER.tiktok}`,105,276,{align:"center"});
    p.text(`YouTube: ${DATOS_TALLER.youtube}   |   Google Maps: ${DATOS_TALLER.maps}`,105,282,{align:"center"});
    p.setTextColor(...oro);p.setFont("helvetica","bold");p.setFontSize(7.5);p.text(`${DATOS_TALLER.nombre.toUpperCase()}  •  ${DATOS_TALLER.slogan.toUpperCase()}`,105,289,{align:"center"});

    await addEquipmentReferenceInline(p,x.equipo,x.modelo,76,16,38,44,true);
    p.save(`Nota-Entrega-Pagada-${x.id}.pdf`);
  }catch(e){console.error(e);alert("No se pudo crear la Nota de Entrega: "+e.message)}
}

async function generarPDFEntrega(x){
  if(!x||!window.jspdf)return alert("No se pudo cargar el generador PDF.");
  try{
    const {jsPDF}=window.jspdf,p=new jsPDF({unit:"mm",format:"a4",compress:true});
    const total=Number(x.costoTotal)||0,anticipo=Number(x.anticipo)||0,pagoFinal=Math.max(0,total-anticipo);
    const fechaCaptura=primeraFechaCaptura(x)||fechaMilisegundos(x.recibido);
    const fechaEntrega=ultimaFechaEntrega(x)||fechaMilisegundos(x.entregado)||Date.now();
    await pdfNotaHeader(p,"NOTA DE ENTREGA",folioPDF(x),fechaEntrega,"FECHA DE ENTREGA");

    pdfNotaSection(p,1,"DATOS DEL CLIENTE",8,50,194,38);
    pdfLineField(p,"Nombre:",x.cliente,14,66,197);
    pdfLineField(p,"Teléfono / WhatsApp:",x.telefono,14,79,197);

    pdfNotaSection(p,2,"DATOS DEL EQUIPO",8,88,194,74);
    p.setTextColor(12,15,18);p.setFont("helvetica","bold");p.setFontSize(6.8);p.text("Tipo de equipo:",14,103);
    pdfEquipoChecklist(p,14,113,x,150);
    pdfLineField(p,"Marca:",marcaEquipo(x),14,130,153);
    pdfLineField(p,"Modelo:",x.modelo||equipoCompleto(x),14,141,153);
    pdfLineField(p,"Número de serie:",x.serie,14,152,153);
    pdfLineField(p,"Color:",x.color,14,160,153);
    await addEquipmentReferenceInline(p,x.equipo,x.modelo,160,106,35,39,false);

    pdfNotaSection(p,3,"NOTAS",8,162,194,45);
    const reparacion=String(x.reparacionRealizada||x.nota||"Equipo entregado conforme a pruebas realizadas.").trim();
    pdfLongText(p,reparacion,14,178,180,4,7.2);
    p.setTextColor(0,135,190);p.setFont("helvetica","bold");p.setFontSize(7);
    p.text(`Ingreso: ${fechaLarga(fechaCaptura)}     Entrega: ${fechaLarga(fechaEntrega)}`,14,194);
    p.text(`Total: ${moneda(total)}     Anticipo: ${moneda(anticipo)}     Pago final: ${moneda(pagoFinal)}`,14,202);

    pdfNotaSection(p,4,"GARANTÍA",8,207,194,74);
    const garantiaTexto=x.garantiaHasta?`${x.garantiaTiempo||0} ${x.garantiaUnidad||"días"}`:"Sin garantía registrada";
    const vence=x.garantiaHasta?new Date(x.garantiaHasta).toLocaleDateString("es-MX",{day:"2-digit",month:"long",year:"numeric"}):"No registrada";
    pdfBullets(p,[
      `Garantía de ${garantiaTexto} sobre el trabajo realizado y las piezas instaladas.`,
      "No aplica en casos de golpes o caídas, humedad o líquidos, manipulación por terceros, daños eléctricos o uso inadecuado.",
      `Vencimiento de garantía: ${vence}.`,
      "El cliente debe revisar el equipo al momento de la entrega y reportar cualquier inconformidad de inmediato."
    ],14,223,177,4.4);

    pdfNotaFooter(p);
    p.save(`Nota-Entrega-${folioPDF(x)}.pdf`);
  }catch(e){console.error(e);alert("No se pudo crear la Nota de Entrega: "+e.message)}
}
