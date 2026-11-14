// Maths rendering primitives.
// HARD RULE: fractions are ALWAYS rendered stacked (numerator over a
// horizontal bar over the denominator). Never render "a/b" text.
import type { MathLine, MathToken } from '../types';

export function Fraction({ n, d, large }: { n: number; d: number; large?: boolean }) {
  return (
    <span className={large ? 'frac frac-lg' : 'frac'} aria-label={`${n} phần ${d}`}>
      <span className="frac-num">{n}</span>
      <span className="frac-den">{d}</span>
    </span>
  );
}

export function MixedNumber({ w, n, d, large }: { w: number; n: number; d: number; large?: boolean }) {
  return (
    <span className="mixed">
      <span className="mixed-whole">{w}</span>
      <Fraction n={n} d={d} large={large} />
    </span>
  );
}

function Token({ token, large }: { token: MathToken; large?: boolean }) {
  if (token.k === 'f') return <Fraction n={token.n} d={token.d} large={large} />;
  if (token.k === 'm') return <MixedNumber w={token.w} n={token.n} d={token.d} large={large} />;
  return <span className="math-text">{token.s}</span>;
}

/** Renders one line of maths (one equation per line, never joined). */
export function MathExpr({ line, large }: { line: MathLine; large?: boolean }) {
  return (
    <span className="math-expr">
      {line.map((token, i) => (
        <Token key={i} token={token} large={large} />
      ))}
    </span>
  );
}

/** Visual bar model: `filled` coloured parts out of `total`. */
export function FractionBar({ filled, total, color }: { filled: number; total: number; color: string }) {
  return (
    <div className="frac-bar" role="img" aria-label={`${filled} phần trong ${total} phần`}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="frac-bar-cell"
          style={{ backgroundColor: i < filled ? color : '#ffffff' }}
        />
      ))}
    </div>
  );
}

/** Full long-division working, every step shown. */
export function LongDivisionView({
  dividend,
  divisor,
  result,
  rows,
}: {
  dividend: number;
  divisor: number;
  result: string;
  rows: { label: string; detail: string }[];
}) {
  return (
    <div className="long-division">
      <div className="long-division-head">
        <MathExpr line={[{ k: 't', s: `${dividend} ÷ ${divisor} = ${result}` }]} large />
      </div>
      <ol className="long-division-rows">
        {rows.map((row, i) => (
          <li key={i}>
            <strong>{row.label}</strong>
            <span>{row.detail}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
