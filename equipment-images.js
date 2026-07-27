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
  return `<div class="equipment-visual ${compact?"compact":""} ${match.isFallback?"is-fallback":""}"><img src="${match.src}" alt="${match.label}" loading="lazy"><div class="equipment-placeholder" hidden role="img" aria-label="Imagen no disponible"><b>XE</b><span>IMAGEN NO DISPONIBLE</span></div>${match.isFallback?`<small class="fallback-label">${match.label.toUpperCase()}</small>`:""}</div>`;
}

export function bindEquipmentImageFallbacks(root=document){
  root.querySelectorAll(".equipment-visual img").forEach(img=>{
    img.onerror=()=>{img.hidden=true;const placeholder=img.nextElementSibling;if(placeholder)placeholder.hidden=false};
  });
}

function populateEquipmentDatalists(equipo,modelo){
  const equipoList=equipo.list,modeloList=modelo.list;
  const add=(list,value)=>{if(list&&![...list.options].some(option=>option.value===value)){const option=document.createElement("option");option.value=value;list.appendChild(option)}};
  add(equipoList,"Consola");
  add(equipoList,"Control");
  Object.values(EQUIPMENT_IMAGE_CATALOG).forEach(category=>category.items.forEach(item=>add(modeloList,item.label)));
}

export function setupEquipmentPreview(equipoId,modeloId,containerId){
  const equipo=document.getElementById(equipoId),modelo=document.getElementById(modeloId),container=document.getElementById(containerId);
  if(!equipo||!modelo||!container)return;
  populateEquipmentDatalists(equipo,modelo);
  const render=()=>{container.innerHTML=equipmentImageMarkup(equipo.value,modelo.value);bindEquipmentImageFallbacks(container)};
  equipo.addEventListener("input",render);
  equipo.addEventListener("change",render);
  modelo.addEventListener("input",render);
  modelo.addEventListener("change",render);
  render();
}
