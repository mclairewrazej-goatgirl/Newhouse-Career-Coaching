import { useId } from 'react';
import type { YesNo } from '../api/types';

interface Props {
  question: string;
  value: YesNo;
  onChange: (v: YesNo) => void;
  yes?: string;
  no?: string;
}

/** A small question with two answers, e.g. "Did they do it? Done / Not yet". Tapping the chosen answer clears it. */
export function YesNoToggle({ question, value, onChange, yes = 'Yes', no = 'Not yet' }: Props) {
  const id = useId();
  const pick = (v: Exclude<YesNo, ''>) => onChange(value === v ? '' : v);
  return (
    <div className="yesno" role="group" aria-labelledby={id}>
      <span id={id} className="yesno-q">{question}</span>
      <span className="outcome">
        <button type="button" className="outcome-btn helpful" aria-pressed={value === 'yes'} onClick={() => pick('yes')}>{yes}</button>
        <button type="button" className="outcome-btn not" aria-pressed={value === 'no'} onClick={() => pick('no')}>{no}</button>
      </span>
    </div>
  );
}
