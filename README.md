# XE Recepción Taller · Fase 1 Beta

Esta versión conserva el sistema de recepción e historial y agrega un módulo independiente de agenda de citas.

## Nuevas páginas
- `agenda.html`: panel privado para crear, consultar, reagendar, cancelar y convertir citas en recepción.
- `cita.html`: consulta pública de citas mediante folio.

## Funciones de la agenda
- Crear folios `XE-CITA-xxxxxx`.
- Enviar la confirmación por WhatsApp.
- Cambiar solamente fecha y hora conservando el resto de los datos.
- Enviar por WhatsApp la nueva propuesta.
- Historial de movimientos de la cita.
- PDF premium azul metálico y plata.
- Solicitar reagendar por WhatsApp.
- Solicitar llamada por WhatsApp.
- Convertir una cita en recepción mediante precarga de datos.

## Firebase
Publica las reglas incluidas en `firestore.rules.txt`. Se agregan las colecciones:
- `citas`: información privada para el administrador.
- `citas_publicas`: información visible al consultar un folio.

Las colecciones existentes `equipos` y `estados_publicos` no se eliminan ni se modifican.

## Fases 2 y 3 añadidas
- Historial cronológico y avisos de WhatsApp al actualizar.
- Campos de accesorios, observaciones físicas, anticipo y costo total.
- PDF premium de recepción rojo metálico, sin QR ni firma.
- Captura posterior de reparación realizada e importes.
- PDF premium de entrega negro y dorado, con historial resumido y garantía, sin QR ni firma.
- Botón del cliente para solicitar llamada por WhatsApp.
- Mensaje de confianza al final del seguimiento.

## Nota de entrega premium
La Nota de Entrega utiliza el logotipo original de XE y contiene los datos del taller:
- Mártires 30 de Diciembre, Col. Guerrero, Chilpancingo, Guerrero
- Tel. 747 173 1852
- Responsable: Ing. I. Daniel S.
- Facebook: Daniel Sanchez Nava
- TikTok / YouTube / Google Maps: XE Servicio Electrónico

El documento no es una factura ni un comprobante fiscal. No incluye QR ni el apartado "Resumen del servicio".
# XE Recepción de Equipos

## Cambios de esta versión

- Diseño premium en blanco, cyan y verde aqua metálico.
- Nueva página pública `reservar.html` con bloques disponibles de una hora.
- Las solicitudes públicas quedan pendientes hasta que el taller las confirme en `agenda.html`.
- Al convertir una cita y crear la recepción, la cita se elimina de la agenda y permanece únicamente como recepción.
- Ingresos y teléfonos permanecen ocultos por defecto en los paneles privados.
- La captura de equipos usa dos selectores separados: primero Consola/Control y después el modelo correspondiente.
- Los PDF de cita, recepción y entrega integran la imagen dentro de la misma hoja, acompañada por un aviso antifraude que aclara que es ilustrativa y no identifica el equipo físico.

## Importante al publicar

Además de subir los archivos del sitio, publica el contenido actualizado de `firestore.rules.txt` en Firebase Firestore. Las nuevas reglas habilitan las solicitudes públicas sin exponer los datos personales de los clientes.

El horario público está configurado de 10:00 a 18:00, en bloques de una hora. Para cambiarlo, edita la constante `HORARIOS` de `reservar.js` y conserva la misma lista permitida en `firestore.rules.txt`.

## Imágenes de equipos

Las imágenes se sirven desde el mismo repositorio con rutas relativas:

- Consolas: `./assets/consolas/`
- Controles: `./assets/controles/`

Modelos adicionales registrados:

- Xbox One X → `./assets/consolas/xbox-one-x.png`
- PC Gamer → `./assets/consolas/pc-gamer.png`
- PlayStation 4 Slim → `./assets/consolas/ps4-slim.png`
- Nintendo Switch 2 → `./assets/consolas/nintendo-switch-2.png`

La correspondencia central y los fallbacks están en `equipment-images.js`, dentro de `EQUIPMENT_IMAGE_CATALOG`. Un modelo desconocido usa la imagen genérica de su categoría. Si incluso esa imagen no puede cargarse, el área visual se oculta sin mostrar el antiguo placeholder XE.

### Agregar imágenes en el futuro

1. Copia la imagen, respetando mayúsculas y minúsculas, a `assets/consolas/` o `assets/controles/`.
2. Abre `equipment-images.js`.
3. Añade un objeto al arreglo `items` de la categoría correspondiente:

```js
{label:"Nombre visible",file:"archivo.png",terms:["nombre", "alias del modelo"]}
```

No es necesario modificar las pantallas, la agenda ni la lógica de recepción. Para incorporar otra categoría o repositorio, agrega una categoría al mismo catálogo con `detectTerms`, `basePath`, `fallback` e `items`. La detección de categorías también se genera desde ese mapa.

Los dos proyectos fuente incluían un `logo.png` idéntico. No se importó porque no es necesario para identificar equipos y así se evita conservar recursos duplicados.
