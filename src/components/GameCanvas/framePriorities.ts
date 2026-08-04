export const GAME_FRAME_PRIORITY = {
  input: -500,
  runtime: -400,
  presentation: -300,
  camera: -200,
  events: -150,
  ui: -140,
  debug: -120,
  overhead: -100,
  performance: -50,
} as const;
