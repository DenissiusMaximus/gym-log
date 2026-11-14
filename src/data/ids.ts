/** Id without dependencies: base36 timestamp + 8 random base36 characters. */
export function newId(): string {
  let random = '';
  for (let i = 0; i < 8; i++) random += Math.floor(Math.random() * 36).toString(36);
  return Date.now().toString(36) + random;
}
