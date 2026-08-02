# ATQGAME — Registro de sesión

**Fecha:** 2026-08-02

## Mundo, movimiento y depuración

- Se definió que una unidad del mundo equivale a un metro, con cuadrícula de 1 m
  por celda y arena ampliada a 100 × 100 m.
- La velocidad base del jugador pasó a 5,5 m/s y el panel `DEV` muestra la
  velocidad efectiva, la vida, la defensa y el estado del impulso.
- Se añadió el impulso con `F`: multiplica la velocidad por ×1,8 durante 5 s y
  tiene 15 s de cooldown desde la activación.

## Combate, vida y efectos

- Se añadió la alfombra ardiente de 3 × 3 m: aplica el debuff **Ardiendo** al
  entrar, inflige 100 de daño base cada 2 s y no acumula instancias.
- La defensa porcentual reduce el daño recibido; el panel `DEV` permite ajustar
  vida máxima entre 100 y 5000 HP y defensa entre 0% y 100%.
- El HUD muestra vida, buffs, debuffs y un aviso temporal al morir. Al llegar a
  0 HP, el jugador recupera inmediatamente su vida máxima.

## Muñeco de pruebas y autoataque

- Se incorporó un muñeco de pruebas estático con 10.000 HP, daño recibido,
  daño total, DPS de ventana móvil de 1 s y reaparición tras 3 s.
- El jugador autoataca por 20 de daño de forma inmediata al estar a 1 m o menos
  del muñeco y continúa atacando una vez por segundo.
- Al seleccionar el muñeco se muestran un círculo y una línea roja hacia el
  objetivo; la persecución avanza en línea recta, sin pathfinding.
- Un clic derecho en el suelo manda al jugador a ese punto y pausa la
  persecución sin perder el objetivo. Un clic izquierdo o derecho sobre el
  muñeco reanuda la persecución y cancela la orden manual pendiente.
- La selección se elimina al alcanzar 50 m de distancia respecto al muñeco.

## Calidad

- Se añadieron pruebas para movimiento, distancia, buffs, combate, peligros y
  muñeco de pruebas.
- Última verificación de esta sesión: `npm test` (36 pruebas),
  `npm run typecheck` y `npm run build:web` completados correctamente.
- No se realizaron comprobaciones visuales ni de responsive móvil, por tratarse
  de una aplicación Electron.
