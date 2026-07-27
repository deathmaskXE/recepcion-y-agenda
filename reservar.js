import {firebaseConfig} from "./firebase-config.js";
import{setupEquipmentPreview}from"./equipment-images.js?v=20260727-9";
import{initializeApp}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import{getFirestore,collection,doc,getDocs,query,where,writeBatch}from"https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const app=initializeApp(firebaseConfig),db=getFirestore(app),$=id=>document.getElementById(id);
const HORARIOS=["10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00"];
let horaElegida="";
setupEquipmentPreview("equipo","modelo","bookingEquipmentPreview");

function hoyISO(){const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10)}
$("fechaReserva").min=hoyISO();
function horaBonita(v){const[h,m]=v.split(":");return new Date(2000,0,1,+h,+m).toLocaleTimeString("es-MX",{hour:"numeric",minute:"2-digit"})}
function fechaBonita(v){return new Date(v+"T12:00:00").toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"long"})}

async function horariosOcupados(fecha){
  const [confirmadas,pendientes]=await Promise.all([
    getDocs(query(collection(db,"citas_publicas"),where("fecha","==",fecha))),
    getDocs(query(collection(db,"disponibilidad_citas"),where("fecha","==",fecha)))
  ]);
  const ocupados=new Set();
  confirmadas.forEach(d=>{const x=d.data();if(x.estado!=="Cancelada"&&x.estado!=="Cliente recibido")ocupados.add(x.hora)});
  pendientes.forEach(d=>ocupados.add(d.data().hora));
  return ocupados;
}

async function cargarHorarios(){
  const fecha=$("fechaReserva").value;
  horaElegida="";$("solicitarCita").disabled=true;
  if(!fecha){$("slots").innerHTML='<p class="empty-group">Primero selecciona una fecha.</p>';return}
  $("availabilityTitle").textContent=fechaBonita(fecha);
  $("slots").innerHTML='<p class="empty-group">Consultando disponibilidad...</p>';
  try{
    const ocupados=await horariosOcupados(fecha),libres=HORARIOS.filter(h=>!ocupados.has(h));
    $("slots").innerHTML=libres.length?libres.map(h=>`<button type="button" class="slot" data-slot="${h}"><span>${horaBonita(h)}</span><small>hasta ${horaBonita(String(Number(h.slice(0,2))+1).padStart(2,"0")+":00")}</small></button>`).join(""):'<p class="empty-group">No quedan horarios disponibles para este día.</p>';
    document.querySelectorAll("[data-slot]").forEach(b=>b.onclick=()=>{
      document.querySelectorAll("[data-slot]").forEach(x=>x.classList.remove("selected"));
      b.classList.add("selected");horaElegida=b.dataset.slot;$("solicitarCita").disabled=false;
    });
  }catch(e){console.error(e);$("slots").innerHTML='<p class="booking-error">No fue posible consultar los horarios. Intenta de nuevo.</p>'}
}

$("fechaReserva").onchange=cargarHorarios;
$("refreshSlots").onclick=cargarHorarios;
$("solicitarCita").onclick=async()=>{
  const now=Date.now(),fecha=$("fechaReserva").value,hora=horaElegida;
  const d={cliente:$("cliente").value.trim(),telefono:$("telefono").value.trim(),equipo:$("equipo").value.trim(),modelo:$("modelo").value.trim(),falla:$("falla").value.trim(),fecha,hora,estado:"Pendiente de confirmación",creada:now,actualizada:now};
  if(!d.cliente||!d.telefono||!d.equipo||!fecha||!hora)return alert("Completa nombre, WhatsApp, equipo, fecha y horario.");
  if(d.telefono.replace(/\D/g,"").length<10)return alert("Escribe un WhatsApp válido de al menos 10 dígitos.");
  $("solicitarCita").disabled=true;$("bookingMsg").textContent="Enviando solicitud...";
  try{
    const ocupados=await horariosOcupados(fecha);
    if(ocupados.has(hora)){$("bookingMsg").textContent="Ese horario acaba de ocuparse. Selecciona otro.";await cargarHorarios();return}
    const folio=`XE-SOL-${String(now).slice(-8)}`;
    const batch=writeBatch(db);
    batch.set(doc(db,"solicitudes_citas",folio),d);
    batch.set(doc(db,"disponibilidad_citas",`${fecha}_${hora.replace(":","-")}`),{fecha,hora,solicitud:folio});
    await batch.commit();
    $("bookingMsg").innerHTML=`<strong>SOLICITUD RECIBIDA</strong><br>Folio ${folio}. El taller confirmará contigo por WhatsApp.`;
    ["cliente","telefono","equipo","modelo","falla"].forEach(id=>$(id).value="");$("equipo").dispatchEvent(new Event("change"));
    await cargarHorarios();
  }catch(e){console.error(e);$("bookingMsg").textContent="No se pudo enviar la solicitud. Revisa los datos e intenta nuevamente."}
};
