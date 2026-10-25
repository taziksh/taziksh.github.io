// Variables 1–4 are x₁…x₄; variables 5–8 are y₁…y₄.
export const groups = [
  { id: 1, name: 'OR', definition: 'y_1 \\leftrightarrow (x_1 \\lor x_2)', clauses: [[5, -1], [5, -2], [-5, 1, 2]] },
  { id: 2, name: 'EQUIVALENCE', definition: 'y_2 \\leftrightarrow (y_1 \\leftrightarrow x_3)', clauses: [[-6, -5, 3], [-6, 5, -3], [6, -5, -3], [6, 5, 3]] },
  { id: 3, name: 'NOT', definition: 'y_3 \\leftrightarrow \\lnot x_4', clauses: [[7, 4], [-7, -4]] },
  { id: 4, name: 'IMPLICATION', definition: 'y_4 \\leftrightarrow (y_2 \\Rightarrow y_3)', clauses: [[8, 6], [8, -7], [-8, -6, 7]] },
];

export const rootClause = [8];
export const allClauses = [...groups.flatMap((group) => group.clauses), rootClause];

export function evaluateOriginal(x: boolean[]): boolean {
  return !((x[0] || x[1]) === x[2]) || !x[3];
}

export function deriveAuxiliaries(x: boolean[]): boolean[] {
  const y1 = x[0] || x[1];
  const y2 = y1 === x[2];
  const y3 = !x[3];
  return [y1, y2, y3, !y2 || y3];
}

export function clauseHolds(clause: number[], assignment: boolean[]): boolean {
  return clause.some((literal) => literal > 0 ? assignment[literal - 1] : !assignment[-literal - 1]);
}

export function variableTex(variable: number): string {
  return variable <= 4 ? `x_${variable}` : `\\htmlClass{tseitin-y${variable - 4}}{y_${variable - 4}}`;
}

export function clauseTex(clause: number[]): string {
  return `(${clause.map((literal) => `${literal < 0 ? '\\lnot ' : ''}${variableTex(Math.abs(literal))}`).join(' \\lor ')})`;
}

export function colorDefinition(tex: string): string {
  return tex.replace(/y_([1-4])/g, (_, id) => `\\htmlClass{tseitin-y${id}}{y_${id}}`);
}
