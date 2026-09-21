const $=id=>document.getElementById(id);

function loadProfessionalTheme(){
  if(document.querySelector('link[href*="professional-ui.css"]'))return;
  const link=document.createElement("link");
  link.rel="stylesheet";link.href="professional-ui.css?v=20260921-1";
  document.head.appendChild(link);
}

function addBrandLogo(){
  const header=document.querySelector("body>header");
  if(!header||header.querySelector(".xe-brand-logo"))return;
  const logo=document.createElement("img");
  logo.className="xe-brand-logo";logo.src="logo-xe.png";logo.alt="XE Servicio Electrónico";
  header.prepend(logo);
}

function markOptional(ids){
  ids.forEach(id=>{
    const field=$(id);if(!field)return;
    field.dataset.optional="true";
    if(field.placeholder&&!field.placeholder.includes("opcional"))field.placeholder+= " (opcional)";
  });
}

function createSection(title,description,ids,optional=false){
  const section=document.createElement("section");
  section.className="smart-form-section";
  section.innerHTML=`<div class="smart-form-title"><span>${optional?"OPCIONAL":"PASO"}</span><div><h3>${title}</h3><p>${description}</p></div></div><div class="smart-form-fields"></div>`;
  const fields=section.querySelector(".smart-form-fields");
  ids.forEach(id=>{const field=$(id);if(!field)return;const label=field.closest("label");fields.appendChild(label&&label.parentElement?label:field)});
  if(!fields.children.length)return null;
  return section;
}

function enhanceForm(config){
  const form=document.querySelector(config.selector);
  if(!form||form.dataset.enhanced)return;
  form.dataset.enhanced="true";form.classList.add("smart-form");
  markOptional(config.optionalIds||[]);
  const sections=config.sections.map(section=>createSection(section.title,section.description,section.ids,section.optional)).filter(Boolean);
  const nav=document.createElement("nav");nav.className="smart-form-nav";nav.setAttribute("aria-label","Secciones del formulario");
  sections.forEach((section,index)=>{
    section.dataset.step=String(index);
    const button=document.createElement("button");button.type="button";button.textContent=`${index+1}. ${section.querySelector("h3").textContent}`;
    button.onclick=()=>{section.scrollIntoView({behavior:"smooth",block:"center"});section.classList.add("highlight");setTimeout(()=>section.classList.remove("highlight"),900)};
    nav.appendChild(button);
  });
  form.prepend(nav);
  sections.forEach(section=>form.appendChild(section));
  const note=document.createElement("p");note.className="optional-note";note.textContent="Puedes dejar vacíos todos los campos marcados como opcionales y completarlos después.";
  form.appendChild(note);
}

function enhanceForms(){
  if(document.body.classList.contains("booking-page")||document.querySelector(".booking-page")){
    enhanceForm({selector:".booking-page .form",optionalIds:["modelo","falla"],sections:[
      {title:"Tus datos",description:"Solo necesitamos un nombre y WhatsApp para confirmar.",ids:["cliente","telefono"]},
      {title:"Equipo",description:"Escoge el tipo; el modelo y la falla se pueden omitir.",ids:["equipo","modelo","bookingEquipmentPreview","falla"],optional:true},
      {title:"Fecha",description:"Selecciona el día y después el horario disponible.",ids:["fechaReserva"]}
    ]});return;
  }
  if($("crear")){
    enhanceForm({selector:"#dashboard .form",optionalIds:["correo","modelo","marca","serie","color","nota","accesorios","observaciones","anticipo","costoTotal","garantiaTiempo","garantiaUnidad"],sections:[
    {title:"Cliente",description:"Nombre y WhatsApp para identificar y avisar.",ids:["cliente","telefono","correo"]},
    {title:"Equipo",description:"Selecciona el equipo; los detalles adicionales pueden agregarse después.",ids:["equipo","modelo","newEquipmentPreview","marca","serie","color","falla"]},
    {title:"Detalles opcionales",description:"Documenta solo lo que necesites en esta recepción.",ids:["nota","accesorios","observaciones"],optional:true},
    {title:"Importes y garantía",description:"Puedes omitirlos y capturarlos cuando tengas el diagnóstico.",ids:["anticipo","costoTotal","garantiaTiempo","garantiaUnidad"],optional:true}
    ]});
    const form=document.querySelector("#dashboard .form"),financial=form?.querySelector('[data-step="3"] .smart-form-fields'),policy=form?.querySelector(".return-policy");
    if(financial&&policy)financial.appendChild(policy);
    form?.querySelectorAll(".warranty-input,.date-time-grid").forEach(box=>{if(!box.querySelector("input,select,textarea"))box.remove()});
  }
  else if($("crearCita"))enhanceForm({selector:"#dashboard .form",optionalIds:["modelo","falla"],sections:[
    {title:"Cliente",description:"Datos esenciales para confirmar la cita.",ids:["cliente","telefono"]},
    {title:"Equipo",description:"El modelo y la falla son opcionales.",ids:["equipo","modelo","appointmentEquipmentPreview","falla"],optional:true},
    {title:"Programación",description:"Selecciona fecha y hora de atención.",ids:["fecha","hora"]}
  ]});
}

function init(){loadProfessionalTheme();addBrandLogo();enhanceForms()}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
