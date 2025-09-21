export function generateFaces(hongzhongPercent: number): Array<'红中'|'白板'> {
  const pick = (): '红中'|'白板' => (Math.random() * 100 < hongzhongPercent ? '红中' : '白板')
  return [pick(), pick(), pick()].sort(() => Math.random() - 0.5) as Array<'红中'|'白板'>
}

