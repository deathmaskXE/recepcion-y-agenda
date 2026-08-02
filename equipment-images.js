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
      {label:"Xbox One X",file:"xbox-one-x.png",terms:["xbox one x","one x"]},
      {label:"PC Gamer",file:"pc-gamer.png",terms:["pc gamer","computadora gamer","ordenador gamer"]},
      {label:"Xbox One S",file:"xbox-one-s.png",terms:["xbox one s","one s"]},
      {label:"Xbox One",file:"xbox-one.png",terms:["xbox one"]},
      {label:"PlayStation 4 Pro",file:"ps4-pro.png",terms:["playstation 4 pro","ps4 pro"]},
      {label:"PlayStation 4 Slim",file:"ps4-slim.png",terms:["playstation 4 slim","ps4 slim"]},
      {label:"PlayStation 5",file:"ps5.png",terms:["playstation 5","ps5"]},
      {label:"PlayStation 4",file:"ps4.png",terms:["playstation 4","ps4"]},
      {label:"Nintendo Switch 2",file:"nintendo-switch-2.png",terms:["nintendo switch 2","switch 2"]},
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
      {label:"Nintendo Joy-Con 2",file:"joycon-2.png",terms:["joy con 2","joycon 2","joy-con 2","nintendo joy con 2","nintendo joycon 2"]},
      {label:"Nintendo Joy-Con",file:"joycon.png",terms:["joy con","joycon"]},
      {label:"Nintendo Switch Pro Controller",file:"pro-controller.png",terms:["pro controller","control pro switch","mando pro switch"]},
      {label:"Control Xbox Series",file:"xbox-series.png",terms:["control xbox series","mando xbox series","controller xbox series"]},
      {label:"Control Xbox One",file:"xbox-one.png",terms:["control xbox one","mando xbox one","controller xbox one"]}
    ]
  },
  screens:{
    label:"Pantalla",
    detectTerms:["pantalla","televisor","television","tv","smart tv"],
    basePath:"./assets/pantallas/",
    fallback:"pantalla.png",
    freeModel:true,
    items:[
      {label:"Pantalla / TV",file:"pantalla.png",terms:["pantalla","televisor","television","tv","smart tv"]}
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

export async function addEquipmentReferenceInline(pdf,equipo,modelo,x,y,w,h,dark=true){
  const match=resolveEquipmentImage(equipo,modelo);
  const image=await new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=()=>resolve(null);
    img.src=match.src;
  });
  pdf.setFillColor(...(dark?[7,27,31]:[246,253,252]));
  pdf.setDrawColor(0,206,196);pdf.setLineWidth(.45);pdf.roundedRect(x,y,w,h,2,2,"FD");
  const labelHeight=8,imageHeight=h-labelHeight-3;
  if(image){
    const maxW=w-4,maxH=imageHeight,ratio=Math.min(maxW/image.naturalWidth,maxH/image.naturalHeight);
    const width=image.naturalWidth*ratio,height=image.naturalHeight*ratio;
    pdf.addImage(image,"PNG",x+(w-width)/2,y+1.5+(maxH-height)/2,width,height,undefined,"FAST");
  }else{
    pdf.setTextColor(...(dark?[210,235,234]:[55,83,86]));pdf.setFontSize(5.5);pdf.text("IMAGEN NO DISPONIBLE",x+w/2,y+imageHeight/2,{align:"center"});
  }
  pdf.setTextColor(...(dark?[148,247,235]:[0,105,96]));pdf.setFont("helvetica","bold");pdf.setFontSize(4.4);
  const aviso=pdf.splitTextToSize("IMAGEN ILUSTRATIVA · NO CORRESPONDE NI IDENTIFICA EL EQUIPO FÍSICO",w-4).slice(0,2);
  pdf.text(aviso,x+w/2,y+h-5.2,{align:"center"});
}

function categoryKeyFromSelect(value){
  const selected=normalize(value);
  return Object.entries(EQUIPMENT_IMAGE_CATALOG).find(([,category])=>normalize(category.label)===selected)?.[0]
    ||Object.entries(EQUIPMENT_IMAGE_CATALOG).find(([,category])=>category.default)?.[0]
    ||Object.keys(EQUIPMENT_IMAGE_CATALOG)[0];
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
  const equipo=document.getElementById(equipoId);
  if(!equipo||!document.getElementById(modeloId))return;
  const categoryKey=detectCategory(equipoValue,modeloValue),resolved=resolveEquipmentImage(equipoValue,modeloValue);
  equipo.value=EQUIPMENT_IMAGE_CATALOG[categoryKey].label;
  equipo.dispatchEvent(new Event("change",{bubbles:true}));
  const modelo=document.getElementById(modeloId);
  if(!modelo)return;
  if(EQUIPMENT_IMAGE_CATALOG[categoryKey].freeModel){
    modelo.value=modeloValue||"";
  }else{
    fillModelSelect(equipo,modelo,resolved.isFallback?(modeloValue||""):resolved.label);
  }
  modelo.dispatchEvent(new Event("change",{bubbles:true}));
}

export function setupEquipmentPreview(equipoId,modeloId,containerId){
  const originalEquipo=document.getElementById(equipoId),originalModelo=document.getElementById(modeloId),container=document.getElementById(containerId);
  if(!originalEquipo||!originalModelo||!container)return;
  const initialEquipo=originalEquipo.value,initialModelo=originalModelo.value;
  const equipo=document.createElement("select");
  let modelo=document.createElement("select");
  equipo.id=equipoId;
  equipo.innerHTML='<option value="">1. Escoge el tipo de equipo</option>';
  Object.values(EQUIPMENT_IMAGE_CATALOG).forEach(category=>{
    const option=document.createElement("option");option.value=category.label;option.textContent=category.label;equipo.appendChild(option);
  });
  modelo.id=modeloId;
  originalEquipo.replaceWith(equipo);
  originalModelo.replaceWith(modelo);
  const render=()=>{if(!equipo.value||!modelo.value){container.innerHTML="";return}container.innerHTML=equipmentImageMarkup(equipo.value,modelo.value);bindEquipmentImageFallbacks(container)};
  const configureModel=(selected="")=>{
    const categoryKey=equipo.value?categoryKeyFromSelect(equipo.value):null;
    const category=categoryKey?EQUIPMENT_IMAGE_CATALOG[categoryKey]:null;
    const next=document.createElement(category?.freeModel?"input":"select");
    next.id=modeloId;
    if(category?.freeModel){
      next.type="text";next.placeholder="2. Escribe la marca y modelo (LG, Sony, etc.)";next.value=selected;
      next.addEventListener("input",render);
    }else{
      fillModelSelect(equipo,next,selected);
    }
    next.addEventListener("change",render);
    modelo.replaceWith(next);modelo=next;
  };
  equipo.addEventListener("change",()=>{configureModel();render()});
  configureModel();
  if(initialEquipo||initialModelo)setEquipmentFormValues(equipoId,modeloId,initialEquipo,initialModelo);else render();
}
