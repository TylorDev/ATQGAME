# Arena RPG MVP

Prototipo de movimiento RPG 3D compartido entre navegador y Electron. Electron
solo aloja el renderer web y reenvía sus mensajes de consola a la terminal.

## Comandos

```bash
npm run dev       # Vite + Electron
npm run dev:web   # Solo navegador
npm run build     # Build de Electron
npm run build:web # Build web independiente
npm run typecheck
npm test
```

## Control

- Clic derecho corto: camina en línea recta hasta el punto indicado.
- Clic derecho sostenido: avanza continuamente y sigue la dirección del puntero.
- `F`: activa un impulso inmediato de velocidad ×1,8 durante 5 s; su cooldown
  comienza al activarlo y dura 15 s.
- `F10`: muestra u oculta la consola global del mapa.
- La alfombra roja incandescente aplica **Ardiendo** mientras el jugador la pisa.
  Tras 2 s dentro, inflige daño cada 2 s y se elimina inmediatamente al salir.

## Unidades y combate

- Una unidad del mundo equivale a un metro.
- La arena mide 24 × 24 m y cada celda de la cuadrícula representa un metro.
- La velocidad base del jugador es 5,5 m/s; los buffs aplican multiplicadores
  sobre ese valor.
- El daño base de Ardiendo es 100 HP. La defensa porcentual lo reduce, hasta
  anularlo completamente al 100%.

En desarrollo, el panel `DEV` permite activar la trayectoria, ajustar la cámara,
la vida máxima y la defensa. Estos ajustes son temporales. El HUD muestra la vida
actual y los buffs/debuffs activos en todos los builds.

Los logs del renderer aparecen en la terminal de desarrollo con el prefijo
`[Renderer]` cuando se ejecuta dentro de Electron.

## Consola del mapa

La consola interna registra el daño efectivo de todos los actores de la instancia
local del mapa. Puede moverse desde el encabezado, redimensionarse desde cualquier
borde o esquina y recuerda su geometría y visibilidad entre ejecuciones. El
historial permanece únicamente durante la sesión, conserva los últimos 2.000
eventos y muestra cuántos registros antiguos fueron descartados. La lista se
virtualiza y puede vaciarse con la acción `Limpiar` del encabezado.

El nombre del jugador usado por los registros se configura en
`Settings > Perfil local` y se guarda localmente.

## Rendimiento

`Settings > Calidad gráfica` ofrece los presets Bajo, Equilibrado y Alto. El
preset Equilibrado es el predeterminado y ajusta el DPR automáticamente con
histéresis; solo Alto mantiene el blur del HUD.

En desarrollo, `http://localhost:5173/?perf=1` activa el escenario determinista
de carga con 50 entidades simuladas y 100 visibles. Tras 10 s de calentamiento,
registra durante 60 s los FPS, percentiles de frame y draw calls, y publica el
resultado como `[Performance benchmark]` en la consola.

## Prueba manual web: inversión del primer movimiento sostenido

1. Ejecutar `npm run dev:web` y abrir la aplicación desde una recarga limpia.
2. Activar `Modo debug` antes de realizar cualquier movimiento con RMB.
3. Mantener RMB hacia una dirección hasta que el jugador comience a avanzar.
4. Sin soltar RMB, mover inmediatamente el puntero 180 grados al lado contrario.
5. Verificar que en el siguiente frame el jugador, su orientación y la línea de
   debug cambien al sentido contrario, manteniendo `5.50 m/s` y sin una pausa.
