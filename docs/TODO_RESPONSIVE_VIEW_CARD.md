# TODO - Hacer responsive la vista pública (view-card.html)

- [x] Revisar CSS actual de `view-card.html` (body overflow/height y max-width/max-height del wrapper).
- [x] Ajustar `body` para permitir scroll/ajuste: `min-height: 100vh` + `overflow: auto`.
- [x] Ajustar `.view-card-wrapper`: ancho por altura de pantalla
      `min(100vw, 460px, calc((100dvh - 40px) * 9 / 16))` + `aspect-ratio: 9/16`.
- [x] Cambiar posiciones absolutas del overlay para que escalen:
  - [x] `.vertical-icons` usar `left` y `bottom` con `clamp()`/porcentajes.
  - [x] `.qr-placeholder` usar `right`, `bottom`, `width/height` con `clamp()`.
- [x] Validar en:
  - [x] móvil 360x640
  - [x] móvil grande 414x896
  - [x] tablet 768x1024
  - [x] laptop 1366x768

- [x] Aplicar el cambio y confirmar visualmente.

## Bugs encontrados y corregidos en esta revisión

- **La hoja de estilos no cargaba en `/card/:id`**: el HTML usaba `css/styles.css` (relativa) y al
  servirse en `/card/<id>` resolvía a `/card/css/styles.css` → el catch-all devolvía el HTML de
  `index.html` con `Content-Type: text/html` y el navegador rechazaba el CSS. La tarjeta pública
  salía sin fuentes, sin tokens de color y con fondo transparente.
  **Regla: todos los assets y enlaces internos van con ruta absoluta (`/css/styles.css`).**
- **La tarjeta se cortaba en pantallas bajas** (1366x768 cortaba el QR): el ancho fijo de 460px
  generaba 818px de alto. Ahora el ancho se deriva de la altura disponible.
- **La vista previa del editor no se renderizaba** (0x0 px): `.preview-stage` era un ítem flex
  con ancho indefinido, así que el `width: min(78%, 340px)` de `.card-9-16` colapsaba a 0.
  `.preview-stage` ahora tiene `width: 100%` y `display: flex; justify-content: center`.

## Otros arreglos de la misma revisión

- **Hero de la landing**: la imagen `img/hero_preview.png` (render 3D neón de una tarjeta horizontal)
  quedó reemplazada por una **tarjeta vertical real** construida en el DOM con el mismo lenguaje
  visual que `/card/:id` (logo, nombre, cargo, iconos de contacto, redes y QR), alimentada por
  `/api/showcase`. La imagen vieja se conserva como *fallback* si la API no responde.
  - `/api/showcase` ahora devuelve además `phone`, `address`, `logo_path` y las redes sociales.
  - El hero elige la tarjeta más completa del lote, no una al azar, para que no cambie entre recargas.
- **Panel**: la vista por defecto mostraba solo dos cifras y escondía las tarjetas detrás de un clic.
  Ahora es una sola vista con anclas: saludo + cifras + lista de tarjetas siempre visible.
  - `showSection()` (ocultaba secciones) → `goToSection()` (desplaza a la sección y marca el enlace activo).
- **Editor**: el botón flotante "Guardar y copiar enlace" tapaba el último campo en móvil
  (`padding-bottom` del panel de edición subido a 96px) y la vista previa ya no lleva el velo
  degradado que usa la tarjeta pública (ahora sí, para que los iconos se lean igual).
