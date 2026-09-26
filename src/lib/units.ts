/** "A-101" stays "A-101"; "101" in building A becomes "A 101". Avoids "A A-101". */
export function unitLabel(u: { unitNumber: string; building: { code: string } }): string {
  const n = u.unitNumber.toUpperCase();
  const code = u.building.code.toUpperCase();
  return n.startsWith(code) ? u.unitNumber : `${u.building.code} ${u.unitNumber}`;
}
