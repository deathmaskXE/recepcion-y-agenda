/*
 * CATÁLOGO ESCALABLE DE IMÁGENES XE
 * Para agregar modelos, copia la imagen a la carpeta de su categoría y añade
 * una entrada al arreglo "items". La lógica de la interfaz no necesita cambios.
 */
export const EQUIPMENT_IMAGE_CATALOG={
  consoles:{
    label:"Consola",
    default:true,
    detectTerms:["consola","playstation","ps4","ps5","xbox","nintendo switch"],
    basePath:"./assets/consolas/",
    fallback:"xbox-one.png",
    items:[
      {label:"Xbox Series X",file:"xbox-series-x.png",terms:["xbox series x","series x"]},
      {label:"Xbox Series S",file:"xbox-series-s.png",terms:["xbox series s","series s"]},
      {label:"Xbox One S",file:"xbox-one-s.png",terms:["xbox one s","one s"]},
      {label:"Xbox One",file:"xbox-one.png",terms:["xbox one"]},
      {label:"PlayStation 4 Pro",file:"ps4-pro.png",terms:["playstation 4 pro","ps4 pro"]},
      {label:"PlayStation 5",file:"ps5.png",terms:["playstation 5","ps5"]},
      {label:"PlayStation 4",file:"ps4.png",terms:["playstation 4","ps4"]},
      {label:"Nintendo Switch",file:"switch.png",terms:["nintendo switch","switch"]}
    ]
  },
  controllers:{
    label:"Control",
    detectTerms:["control","controller","mando","joystick","joy con","joycon","dualsense","dualshock"],
    basePath:"./assets/controles/",
    fallback:"xbox-one.png",
    items:[
      {label:"DualSense Edge",file:"dualsense-edge.png",terms:["dualsense edge","ps5 edge"]},
      {label:"DualSense",file:"dualsense.png",terms:["dualsense","control ps5","mando ps5"]},
      {label:"DualShock 4",file:"dualshock-4.png",terms:["dualshock 4","control ps4","mando ps4"]},
      {label:"Xbox Elite Series 2",file:"elite-series-2.png",terms:["elite series 2","xbox elite 2"]},
      {label:"Nintendo Joy-Con",file:"joycon.png",terms:["joy con","joycon"]},
      {label:"Nintendo Switch Pro Controller",file:"pro-controller.png",terms:["pro controller","control pro switch","mando pro switch"]},
      {label:"Control Xbox Series",file:"xbox-series.png",terms:["control xbox series","mando xbox series","controller xbox series"]},
      {label:"Control Xbox One",file:"xbox-one.png",terms:["control xbox one","mando xbox one","controller xbox one"]}
    ]
  }
};

function normalize(value){
  return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
}

function detectCategory(equipo,modelo){
  const value=normalize(`${equipo||""} ${modelo||""}`);
  const categories=Object.entries(EQUIPMENT_IMAGE_CATALOG);
  const specific=categories.find(([,category])=>!category.default&&(category.detectTerms||[]).some(term=>value.includes(term)));
  if(specific)return specific[0];
  const detected=categories.find(([,category])=>(category.detectTerms||[]).some(term=>value.includes(term)));
  return detected?.[0]||categories.find(([,category])=>category.default)?.[0]||categories[0][0];
}

export function resolveEquipmentImage(equipo,modelo){
  const value=normalize(`${equipo||""} ${modelo||""}`),categoryKey=detectCategory(equipo,modelo);
  const category=EQUIPMENT_IMAGE_CATALOG[categoryKey];
  const match=category.items.find(item=>item.terms.some(term=>value.includes(term)));
  if(match)return {...match,category:categoryKey,src:category.basePath+match.file,isFallback:false};
  return {label:`${category.label} genérico`,file:category.fallback,category:categoryKey,src:category.basePath+category.fallback,isFallback:true};
}

export function equipmentImageMarkup(equipo,modelo,compact=false){
  const match=resolveEquipmentImage(equipo,modelo);
  return `<div class="equipment-visual ${compact?"compact":""} ${match.isFallback?"is-fallback":""}"><img src="${match.src}" alt="${match.label}" loading="lazy">${match.isFallback?`<small class="fallback-label">${match.label.toUpperCase()}</small>`:""}</div>`;
}

export function bindEquipmentImageFallbacks(root=document){
  root.querySelectorAll(".equipment-visual img").forEach(img=>{
    img.onerror=()=>{img.closest(".equipment-visual")?.classList.add("hidden")};
  });
}

function categoryKeyFromSelect(value){
  return normalize(value)==="control"?"controllers":"consoles";
}

function fillModelSelect(categorySelect,modelSelect,selected=""){
  const categoryKey=categorySelect.value?categoryKeyFromSelect(categorySelect.value):null;
  modelSelect.innerHTML='<option value="">2. Escoge el modelo</option>';
  modelSelect.disabled=!categoryKey;
  if(!categoryKey)return;
  EQUIPMENT_IMAGE_CATALOG[categoryKey].items.forEach(item=>{
    const option=document.createElement("option");
    option.value=item.label;
    option.textContent=item.label;
    modelSelect.appendChild(option);
  });
  if(selected&&![...modelSelect.options].some(option=>option.value===selected)){
    const option=document.createElement("option");option.value=selected;option.textContent=selected;modelSelect.appendChild(option);
  }
  modelSelect.value=selected;
}

export function setEquipmentFormValues(equipoId,modeloId,equipoValue,modeloValue){
  const equipo=document.getElementById(equipoId),modelo=document.getElementById(modeloId);
  if(!equipo||!modelo)return;
  const categoryKey=detectCategory(equipoValue,modeloValue),resolved=resolveEquipmentImage(equipoValue,modeloValue);
  equipo.value=categoryKey==="controllers"?"Control":"Consola";
  fillModelSelect(equipo,modelo,resolved.isFallback?(modeloValue||""):resolved.label);
  modelo.dispatchEvent(new Event("change",{bubbles:true}));
}

export function setupEquipmentPreview(equipoId,modeloId,containerId){
  const originalEquipo=document.getElementById(equipoId),originalModelo=document.getElementById(modeloId),container=document.getElementById(containerId);
  if(!originalEquipo||!originalModelo||!container)return;
  const initialEquipo=originalEquipo.value,initialModelo=originalModelo.value;
  const equipo=document.createElement("select"),modelo=document.createElement("select");
  equipo.id=equipoId;equipo.innerHTML='<option value="">1. Escoge consola o control</option><option value="Consola">Consola</option><option value="Control">Control</option>';
  modelo.id=modeloId;
  originalEquipo.replaceWith(equipo);
  originalModelo.replaceWith(modelo);
  fillModelSelect(equipo,modelo);
  const render=()=>{if(!equipo.value||!modelo.value){container.innerHTML="";return}container.innerHTML=equipmentImageMarkup(equipo.value,modelo.value);bindEquipmentImageFallbacks(container)};
  equipo.addEventListener("change",()=>{fillModelSelect(equipo,modelo);render()});
  modelo.addEventListener("change",render);
  if(initialEquipo||initialModelo)setEquipmentFormValues(equipoId,modeloId,initialEquipo,initialModelo);else render();
}
