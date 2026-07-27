import {firebaseConfig} from "./firebase-config.js";
import{equipmentImageMarkup,bindEquipmentImageFallbacks,setupEquipmentPreview}from"./equipment-images.js?v=20260727-4";
import{initializeApp}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import{getAuth,signInWithEmailAndPassword,onAuthStateChanged,signOut}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import{getFirestore,collection,doc,setDoc,updateDoc,deleteDoc,onSnapshot,query,orderBy,writeBatch}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),$=id=>document.getElementById(id);
let citas=[],solicitudes=[],ultimaCita=null,mostrarTelefonos=false;
const estados=["Confirmada","Cambio de fecha propuesto","Reagendada","Cancelada","Cliente recibido"];
setupEquipmentPreview("equipo","modelo","appointmentEquipmentPreview");

$("loginBtn").onclick=async()=>{try{$("loginMsg").textContent="";await signInWithEmailAndPassword(auth,$("email").value.trim(),$("pass").value)}catch(e){$("loginMsg").textContent="No se pudo iniciar sesión: "+(e.code||e.message)}};
$("logout").onclick=()=>signOut(auth);
onAuthStateChanged(auth,u=>{$("login").classList.toggle("hidden",!!u);$("dashboard").classList.toggle("hidden",!u);if(u){escuchar();escucharSolicitudes()}});
$("toggleTelefonos").onclick=()=>{mostrarTelefonos=!mostrarTelefonos;$("toggleTelefonos").textContent=mostrarTelefonos?"OCULTAR TELÉFONOS":"MOSTRAR TELÉFONOS";$("toggleTelefonos").setAttribute("aria-pressed",String(mostrarTelefonos));render();renderSolicitudes()};
function telefonoSeguro(v){return mostrarTelefonos?esc(v||"Sin número"):"••• ••• ••••"}

function hoyISO(){const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10)}
$("fecha").min=hoyISO();

$("crearCita").onclick=async()=>{try{
 const now=Date.now(),folio=`XE-CITA-${String(now).slice(-6)}`;
 const d={cliente:$("cliente").value.trim(),telefono:$("telefono").value.trim(),equipo:$("equipo").value.trim(),modelo:$("modelo").value.trim(),falla:$("falla").value.trim(),fecha:$("fecha").value,hora:$("hora").value,estado:"Confirmada",creada:now,actualizada:now,historial:[{tipo:"Cita creada",detalle:`Programada para ${formatearFecha($("fecha").value)} a las ${formatearHora($("hora").value)}`,fecha:now}]};
 if(!d.cliente||!d.telefono||!d.equipo||!d.fecha||!d.hora)return alert("Completa cliente, WhatsApp, equipo, fecha y hora.");
 await setDoc(doc(db,"citas",folio),d);await setDoc(doc(db,"citas_publicas",folio),d);
 ultimaCita={id:folio,...d};
 $("createdCita").innerHTML=`CITA CREADA: ${folio}<br><br><button id="enviarCitaWhatsapp">ENVIAR CITA POR WHATSAPP</button>`;
 document.getElementById("enviarCitaWhatsapp").onclick=()=>enviarCita(ultimaCita);
 ["cliente","telefono","equipo","modelo","falla","fecha","hora"].forEach(id=>$(id).value="");$("equipo").dispatchEvent(new Event("change"));
}catch(e){console.error(e);alert("No se pudo crear la cita: "+(e.code||e.message))}};

function escuchar(){onSnapshot(query(collection(db,"citas"),orderBy("creada","desc")),s=>{citas=s.docs.map(x=>({id:x.id,...x.data()}));render()})}
function escucharSolicitudes(){onSnapshot(query(collection(db,"solicitudes_citas"),orderBy("creada","desc")),s=>{solicitudes=s.docs.map(x=>({id:x.id,...x.data()}));renderSolicitudes()})}
$("filterCitas").oninput=render;
function render(){const f=$("filterCitas").value.toLowerCase(),arr=citas.filter(x=>(x.id+" "+x.cliente+" "+x.equipo).toLowerCase().includes(f));renderResumen(arr);$("citasList").innerHTML=arr.map(x=>`<div class="item appointment-item"><div class="itemtop"><div><h3>${x.id} · ${esc(x.equipo)}</h3><p>${esc(x.cliente)} · <span class="phone-value">${telefonoSeguro(x.telefono)}</span></p><p><b>${formatearFecha(x.fecha)} · ${formatearHora(x.hora)}</b></p></div><b>${esc(x.estado)}</b></div><div class="reschedule-box"><label>NUEVA FECHA<input type="date" data-fecha="${x.id}" min="${hoyISO()}" value="${x.fecha||""}"></label><label>NUEVA HORA<input type="time" data-hora="${x.id}" value="${x.hora||""}"></label><button data-reagenda="${x.id}">GUARDAR Y ENVIAR NUEVA FECHA</button></div><div class="appointment-admin-actions"><button data-pdf="${x.id}">PDF CONFIRMACIÓN DE CITA</button><button data-whatsapp="${x.id}">ENVIAR CITA</button><button data-convertir="${x.id}">CONVERTIR EN RECEPCIÓN</button><select data-estado="${x.id}">${estados.map(e=>`<option ${e===x.estado?"selected":""}>${e}</option>`).join("")}</select><button data-guardar-estado="${x.id}">ACTUALIZAR ESTADO</button></div><details class="admin-history"><summary>HISTORIAL (${(x.historial||[]).length})</summary>${(x.historial||[]).slice().reverse().map(h=>`<div class="history-entry"><small>${new Date(h.fecha).toLocaleString("es-MX")}</small><b>${esc(h.tipo)}</b><span>${esc(h.detalle||"")}</span></div>`).join("")}</details></div>`).join("");
function render(){const f=$("filterCitas").value.toLowerCase(),arr=citas.filter(x=>(x.id+" "+x.cliente+" "+x.equipo).toLowerCase().includes(f));renderResumen(arr);$("citasList").innerHTML=arr.map(x=>`<div class="item appointment-item">${equipmentImageMarkup(x.equipo,x.modelo,true)}<div class="itemtop"><div><h3>${x.id} · ${esc(x.equipo)}</h3><p>${esc(x.cliente)} · <span class="phone-value">${telefonoSeguro(x.telefono)}</span></p><p><b>${formatearFecha(x.fecha)} · ${formatearHora(x.hora)}</b></p></div><b>${esc(x.estado)}</b></div><div class="reschedule-box"><label>NUEVA FECHA<input type="date" data-fecha="${x.id}" min="${hoyISO()}" value="${x.fecha||""}"></label><label>NUEVA HORA<input type="time" data-hora="${x.id}" value="${x.hora||""}"></label><button data-reagenda="${x.id}">GUARDAR Y ENVIAR NUEVA FECHA</button></div><div class="appointment-admin-actions"><button data-pdf="${x.id}">PDF CONFIRMACIÓN DE CITA</button><button data-whatsapp="${x.id}">ENVIAR CITA</button><button data-convertir="${x.id}">CONVERTIR EN RECEPCIÓN</button><select data-estado="${x.id}">${estados.map(e=>`<option ${e===x.estado?"selected":""}>${e}</option>`).join("")}</select><button data-guardar-estado="${x.id}">ACTUALIZAR ESTADO</button></div><details class="admin-history"><summary>HISTORIAL (${(x.historial||[]).length})</summary>${(x.historial||[]).slice().reverse().map(h=>`<div class="history-entry"><small>${new Date(h.fecha).toLocaleString("es-MX")}</small><b>${esc(h.tipo)}</b><span>${esc(h.detalle||"")}</span></div>`).join("")}</details></div>`).join("");
 bindEquipmentImageFallbacks($("citasList"));
 document.querySelectorAll("[data-reagenda]").forEach(b=>b.onclick=()=>reagendar(b.dataset.reagenda));
 document.querySelectorAll("[data-whatsapp]").forEach(b=>b.onclick=()=>enviarCita(citas.find(x=>x.id===b.dataset.whatsapp)));
 document.querySelectorAll("[data-pdf]").forEach(b=>b.onclick=()=>generarPDF(citas.find(x=>x.id===b.dataset.pdf)));
 document.querySelectorAll("[data-convertir]").forEach(b=>b.onclick=()=>convertir(citas.find(x=>x.id===b.dataset.convertir)));
 document.querySelectorAll("[data-guardar-estado]").forEach(b=>b.onclick=()=>actualizarEstado(b.dataset.guardarEstado));
}
function renderSolicitudes(){
 $("solicitudesList").innerHTML=solicitudes.length?solicitudes.map(x=>`<div class="item request-item">${equipmentImageMarkup(x.equipo,x.modelo,true)}<div class="itemtop"><div><h3>${esc(x.cliente)} · ${esc(x.equipo)}</h3><p>WhatsApp: <span class="phone-value">${telefonoSeguro(x.telefono)}</span></p><p><b>${formatearFecha(x.fecha)} · ${formatearHora(x.hora)} a ${formatearHora(String(Number(x.hora.slice(0,2))+1).padStart(2,"0")+":00")}</b></p><p>${esc(x.falla||"Sin falla reportada")}</p></div><b>PENDIENTE</b></div><div class="appointment-admin-actions"><button data-aprobar="${x.id}">CONFIRMAR CITA</button><button class="danger-action" data-rechazar="${x.id}">RECHAZAR SOLICITUD</button></div></div>`).join(""):'<p class="empty-group">No hay solicitudes pendientes.</p>';
 bindEquipmentImageFallbacks($("solicitudesList"));
 document.querySelectorAll("[data-aprobar]").forEach(b=>b.onclick=()=>aprobarSolicitud(b.dataset.aprobar));
 document.querySelectorAll("[data-rechazar]").forEach(b=>b.onclick=()=>rechazarSolicitud(b.dataset.rechazar));
}
async function aprobarSolicitud(id){
 const x=solicitudes.find(s=>s.id===id);if(!x)return;
 if(citas.some(c=>c.fecha===x.fecha&&c.hora===x.hora&&c.estado!=="Cancelada"&&c.estado!=="Cliente recibido"))return alert("Ese horario ya está ocupado. Rechaza la solicitud o propón otro horario.");
 const now=Date.now(),folio=`XE-CITA-${String(now).slice(-6)}`,d={cliente:x.cliente,telefono:x.telefono,equipo:x.equipo,modelo:x.modelo||"",falla:x.falla||"",fecha:x.fecha,hora:x.hora,estado:"Confirmada",creada:now,actualizada:now,historial:[{tipo:"Cita confirmada por el taller",detalle:`Programada para ${formatearFecha(x.fecha)} a las ${formatearHora(x.hora)}`,fecha:now}]};
 const batch=writeBatch(db);batch.set(doc(db,"citas",folio),d);batch.set(doc(db,"citas_publicas",folio),d);batch.delete(doc(db,"solicitudes_citas",id));batch.delete(doc(db,"disponibilidad_citas",`${x.fecha}_${x.hora.replace(":","-")}`));
 await batch.commit();enviarCita({id:folio,...d});
}
async function rechazarSolicitud(id){
 const x=solicitudes.find(s=>s.id===id);if(!x||!confirm("¿Rechazar esta solicitud y liberar el horario?"))return;
 await Promise.all([deleteDoc(doc(db,"solicitudes_citas",id)),deleteDoc(doc(db,"disponibilidad_citas",`${x.fecha}_${x.hora.replace(":","-")}`))]);
}
function renderResumen(arr){const futuras=arr.filter(x=>x.estado!=="Cancelada"&&x.estado!=="Cliente recibido").sort((a,b)=>(a.fecha+a.hora).localeCompare(b.fecha+b.hora)).slice(0,5);$("calendarSummary").innerHTML=futuras.length?`<h3>PRÓXIMAS CITAS</h3>${futuras.map(x=>`<div><b>${formatearFecha(x.fecha)} ${formatearHora(x.hora)}</b><span>${esc(x.cliente)} · ${esc(x.equipo)}</span></div>`).join("")}`:"<p>No hay citas próximas.</p>"}
async function reagendar(id){const x=citas.find(c=>c.id===id),fecha=document.querySelector(`[data-fecha="${id}"]`).value,hora=document.querySelector(`[data-hora="${id}"]`).value;if(!fecha||!hora)return alert("Selecciona nueva fecha y hora.");const now=Date.now(),historial=[...(x.historial||[]),{tipo:"Nueva fecha propuesta",detalle:`${formatearFecha(fecha)} a las ${formatearHora(hora)}`,fecha:now}],upd={fecha,hora,estado:"Cambio de fecha propuesto",actualizada:now,historial};await updateDoc(doc(db,"citas",id),upd);await updateDoc(doc(db,"citas_publicas",id),upd);enviarPropuesta({...x,...upd,id})}
async function actualizarEstado(id){const x=citas.find(c=>c.id===id),estado=document.querySelector(`[data-estado="${id}"]`).value,now=Date.now(),historial=[...(x.historial||[]),{tipo:"Estado actualizado",detalle:estado,fecha:now}],upd={estado,actualizada:now,historial};await updateDoc(doc(db,"citas",id),upd);await updateDoc(doc(db,"citas_publicas",id),upd)}
function convertir(x){localStorage.setItem("xe_cita_recepcion",JSON.stringify(x));window.location.href="admin.html?desdeCita=1"}
function normalizar(v){let n=String(v||"").replace(/\D/g,"");if(n.startsWith("521")&&n.length===13)n=n.slice(3);else if(n.startsWith("52")&&n.length===12)n=n.slice(2);return n.length===10?"52"+n:null}
function linkCita(id){return `${location.origin}${location.pathname.replace(/agenda\.html$/,"cita.html")}?folio=${encodeURIComponent(id)}`}
function enviarCita(x){const n=normalizar(x.telefono);if(!n)return alert("WhatsApp inválido.");const m=`📅 *CITA CONFIRMADA - XE SERVICIO ELECTRÓNICO*\n\nHola ${x.cliente}.\n\n*Folio:* ${x.id}\n*Equipo:* ${x.equipo}\n*Fecha:* ${formatearFecha(x.fecha)}\n*Hora:* ${formatearHora(x.hora)}\n\nConsulta o descarga tu comprobante aquí:\n${linkCita(x.id)}\n\n*XE Servicio Electrónico*\nExpertos en Tecnología`;window.open(`https://wa.me/${n}?text=${encodeURIComponent(m)}`,"_blank")}
function enviarPropuesta(x){const n=normalizar(x.telefono);if(!n)return alert("La cita se actualizó, pero el WhatsApp no es válido.");const m=`Hola, ${x.cliente}.\n\nTe proponemos reagendar tu cita con *XE Servicio Electrónico*.\n\n*Folio:* ${x.id}\n*Nueva fecha:* ${formatearFecha(x.fecha)}\n*Nueva hora:* ${formatearHora(x.hora)}\n\nPuedes consultar la cita actualizada aquí:\n${linkCita(x.id)}\n\nResponde este mensaje para confirmar o solicitar otra fecha.`;window.open(`https://wa.me/${n}?text=${encodeURIComponent(m)}`,"_blank")}
function generarPDF(x){
 if(!x||!window.jspdf)return alert("No se pudo cargar el generador PDF.");
 const{jsPDF}=window.jspdf,p=new jsPDF(),azul=[14,67,116],plata=[137,151,166];
 p.setFillColor(247,249,251);p.rect(0,0,210,297,"F");p.setDrawColor(...azul);p.setLineWidth(1.2);p.roundedRect(8,8,194,281,3,3,"S");p.setDrawColor(...plata);p.setLineWidth(.35);p.roundedRect(11,11,188,275,2,2,"S");
 p.setFillColor(...azul);p.roundedRect(13,13,184,39,3,3,"F");p.setFillColor(232,237,242);p.roundedRect(19,19,27,27,4,4,"F");p.setTextColor(...azul);p.setFont("helvetica","bold");p.setFontSize(19);p.text("XE",32.5,37,{align:"center"});
 p.setTextColor(255,255,255);p.setFontSize(17);p.text("CONFIRMACIÓN DE CITA",55,30);p.setFont("helvetica","normal");p.setFontSize(8);p.text("XE SERVICIO ELECTRÓNICO · ATENCIÓN PROGRAMADA",55,40);
 p.setFillColor(229,236,243);p.setDrawColor(...plata);p.roundedRect(18,59,174,27,3,3,"FD");p.setTextColor(...azul);p.setFont("helvetica","bold");p.setFontSize(8);p.text("FOLIO DE CITA",26,69);p.setFontSize(17);p.text(x.id,184,77,{align:"right"});
 const campo=(et,val,xp,yp,w)=>{p.setFillColor(255,255,255);p.setDrawColor(220,225,230);p.roundedRect(xp,yp,w,22,2,2,"FD");p.setTextColor(...azul);p.setFont("helvetica","bold");p.setFontSize(7);p.text(et.toUpperCase(),xp+5,yp+7);p.setTextColor(45,48,52);p.setFont("helvetica","normal");p.setFontSize(9);p.text(p.splitTextToSize(String(val||"No especificado"),w-10).slice(0,2),xp+5,yp+14)};
 campo("Cliente",x.cliente,18,93,85);campo("WhatsApp",x.telefono||"No especificado",107,93,85);campo("Equipo",x.equipo,18,119,85);campo("Modelo",x.modelo||"No especificado",107,119,85);
 campo("Fecha",formatearFecha(x.fecha),18,145,85);campo("Hora",formatearHora(x.hora),107,145,85);
 p.setFillColor(255,255,255);p.setDrawColor(220,225,230);p.roundedRect(18,171,174,37,2,2,"FD");p.setTextColor(...azul);p.setFont("helvetica","bold");p.setFontSize(7);p.text("FALLA REPORTADA",23,179);p.setTextColor(45,48,52);p.setFont("helvetica","normal");p.setFontSize(9);p.text(p.splitTextToSize(String(x.falla||"No especificada"),164).slice(0,4),23,187);
 p.setFillColor(...azul);p.roundedRect(18,216,174,24,3,3,"F");p.setTextColor(255,255,255);p.setFont("helvetica","bold");p.setFontSize(8);p.text("ESTADO DE LA CITA",26,226);p.setFontSize(13);p.text(String(x.estado||"Confirmada").toUpperCase(),184,231,{align:"right"});
 p.setDrawColor(...plata);p.line(18,270,192,270);p.setTextColor(38,42,46);p.setFont("helvetica","bold");p.setFontSize(9);p.text("XE SERVICIO ELECTRÓNICO",105,278,{align:"center"});p.setFont("helvetica","normal");p.setFontSize(8);p.text("EXPERTOS EN TECNOLOGÍA",105,284,{align:"center"});p.save(`Cita-${x.id}.pdf`)
}
function formatearFecha(v){if(!v)return"Sin fecha";return new Date(v+"T12:00:00").toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
function formatearHora(v){if(!v)return"Sin hora";const[h,m]=v.split(":");return new Date(2000,0,1,+h,+m).toLocaleTimeString("es-MX",{hour:"numeric",minute:"2-digit"})}
function esc(s){return String(s||"").replace(/[&<>\"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]))}
