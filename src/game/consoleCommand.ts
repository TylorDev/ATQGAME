export type ParsedGameConsoleCommand =
  | { type: "empty" }
  | { type: "toggle-fps" }
  | { type: "unknown"; input: string };

export function parseGameConsoleCommand(
  value: string,
): ParsedGameConsoleCommand {
  const input = value.trim();

  if (input.length === 0) {
    return { type: "empty" };
  }

  if (input.toLocaleLowerCase("en-US") === "/fps") {
    return { type: "toggle-fps" };
  }

  return { type: "unknown", input };
}
