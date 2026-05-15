# TODO - Hacer responsive la vista pública (view-card.html)

- [ ] Revisar CSS actual de `view-card.html` (body overflow/height y max-width/max-height del wrapper).
- [ ] Ajustar `body` para permitir scroll/ajuste: quitar `overflow: hidden` y usar `min-height: 100vh`.
- [ ] Ajustar `.view-card-wrapper`: remover `max-height` rígido y usar `width: min(100vw, 500px)`; mantener `aspect-ratio: 9/16`.
- [ ] Cambiar posiciones absolutas del overlay para que escalen:
  - [ ] `.vertical-icons` usar `left` y `bottom` con `clamp()`/porcentajes.
  - [ ] `.qr-placeholder` usar `right`, `bottom`, `width/height` con `clamp()`.
- [ ] Validar en:
  - [ ] móvil 360x640
  - [ ] móvil grande 414x896
  - [ ] tablet 768x1024
  - [ ] laptop 1366x768

- [ ] Aplicar el cambio y confirmar visualmente.

