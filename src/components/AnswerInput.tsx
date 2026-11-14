// Answer inputs for the question types. Fraction answers use stacked
// numerator/denominator boxes — never a slash.
import { useState } from 'react';
import type { Question, StudentAnswer } from '../types';
import { MathExpr } from './Fraction';

export function FractionInput({
  value,
  onChange,
  disabled,
}: {
  value: { n: string; d: string };
  onChange: (value: { n: string; d: string }) => void;
  disabled?: boolean;
}) {
  return (
    <span className="frac-input" aria-label="Nhập phân số: tử số ở trên, mẫu số ở dưới">
      <input
        inputMode="numeric"
        aria-label="Tử số"
        placeholder="Tử"
        value={value.n}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, n: e.target.value.replace(/[^0-9]/g, '') })}
      />
      <input
        inputMode="numeric"
        aria-label="Mẫu số"
        placeholder="Mẫu"
        value={value.d}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, d: e.target.value.replace(/[^0-9]/g, '') })}
      />
    </span>
  );
}

export function MixedInput({
  value,
  onChange,
  disabled,
}: {
  value: { w: string; n: string; d: string };
  onChange: (value: { w: string; n: string; d: string }) => void;
  disabled?: boolean;
}) {
  const digits = (s: string) => s.replace(/[^0-9]/g, '');
  return (
    <span className="mixed-input">
      <input
        inputMode="numeric"
        aria-label="Số nguyên"
        placeholder="Số"
        value={value.w}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, w: digits(e.target.value) })}
      />
      <FractionInput
        value={{ n: value.n, d: value.d }}
        onChange={(f) => onChange({ ...value, ...f })}
        disabled={disabled}
      />
    </span>
  );
}

export function DecimalInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <input
      className="decimal-input"
      inputMode="decimal"
      aria-label="Nhập số thập phân"
      placeholder="Ví dụ: 0.375"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ''))}
    />
  );
}

/** Parse raw input state into a StudentAnswer. Returns 'empty' when blank. */
export function parseDecimalInput(raw: string): StudentAnswer {
  const cleaned = raw.trim().replace(',', '.');
  if (cleaned === '' || cleaned === '.') return { type: 'empty' };
  const v = Number(cleaned);
  return Number.isNaN(v) ? { type: 'empty' } : { type: 'decimal', v };
}

export function parseFractionInput(value: { n: string; d: string }): StudentAnswer {
  if (value.n === '' || value.d === '') return { type: 'empty' };
  return { type: 'fraction', n: Number(value.n), d: Number(value.d) };
}

export function parseMixedInput(value: { w: string; n: string; d: string }): StudentAnswer {
  if (value.n === '' || value.d === '') return { type: 'empty' };
  return {
    type: 'mixed',
    w: value.w === '' ? 0 : Number(value.w),
    n: Number(value.n),
    d: Number(value.d),
  };
}

/**
 * One self-contained answer control for a question.
 * Calls onAnswer with the current StudentAnswer whenever it changes.
 * Parent must key this component by question id so state resets per question.
 */
export function AnswerInput({
  question,
  disabled,
  onAnswer,
}: {
  question: Question;
  disabled: boolean;
  onAnswer: (answer: StudentAnswer) => void;
}) {
  const [frac, setFrac] = useState({ n: '', d: '' });
  const [mixed, setMixed] = useState({ w: '', n: '', d: '' });
  const [decimal, setDecimal] = useState('');
  const [whole, setWhole] = useState('');
  const [choice, setChoice] = useState<number | null>(null);

  const a = question.answer;
  if (a.type === 'fraction') {
    return (
      <FractionInput
        value={frac}
        disabled={disabled}
        onChange={(v) => {
          setFrac(v);
          onAnswer(parseFractionInput(v));
        }}
      />
    );
  }
  if (a.type === 'mixed') {
    return (
      <MixedInput
        value={mixed}
        disabled={disabled}
        onChange={(v) => {
          setMixed(v);
          onAnswer(parseMixedInput(v));
        }}
      />
    );
  }
  if (a.type === 'decimal') {
    return (
      <DecimalInput
        value={decimal}
        disabled={disabled}
        onChange={(v) => {
          setDecimal(v);
          onAnswer(parseDecimalInput(v));
        }}
      />
    );
  }
  if (a.type === 'whole') {
    return (
      <input
        className="decimal-input"
        inputMode="numeric"
        aria-label="Nhập số nguyên"
        placeholder="Nhập đáp án"
        value={whole}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9-]/g, '');
          setWhole(v);
          onAnswer(v === '' || v === '-' ? { type: 'empty' } : { type: 'whole', v: Number(v) });
        }}
      />
    );
  }
  // choice
  return (
    <div className="choice-list">
      {(question.choices ?? []).map((option, i) => (
        <button
          key={i}
          type="button"
          className={choice === i ? 'choice-btn choice-selected' : 'choice-btn'}
          disabled={disabled}
          onClick={() => {
            setChoice(i);
            onAnswer({ type: 'choice', index: i });
          }}
        >
          <span className="choice-letter">{String.fromCharCode(65 + i)}</span>
          <MathExpr line={option} />
        </button>
      ))}
    </div>
  );
}
