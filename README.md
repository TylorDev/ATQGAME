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
