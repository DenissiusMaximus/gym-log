/** Simple English plural: `plural(1, 'set', 'sets')` -> "set". */
export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** "1 set", "3 sets". */
export function countLabel(n: number, one: string, many: string): string {
  return `${n} ${plural(n, one, many)}`;
}
