import type { DayMarks } from '../shared/schedule';
import { longDayLabel, monthGrid, monthLabel, shiftMonth } from '../shared/schedule';

interface Props {
  year: number;
  month: number;
  today: string;
  selected: string;
  marks: Map<string, DayMarks>;
  onSelect: (date: string) => void;
  onMonth: (year: number, month: number) => void;
}

const WEEKDAYS = Array.from({ length: 7 }, (_, i) =>
  new Date(2026, 10, 1 + i).toLocaleDateString(undefined, { weekday: 'narrow' }));
const WEEKDAYS_LONG = Array.from({ length: 7 }, (_, i) =>
  new Date(2026, 10, 1 + i).toLocaleDateString(undefined, { weekday: 'long' }));

function dayLabel(date: string, m: DayMarks | undefined): string {
  const parts = [longDayLabel(date)];
  if (m?.booked) parts.push(`${m.booked} booked`);
  if (m?.logged) parts.push(`${m.logged} logged`);
  return parts.join(', ');
}

export function MonthCalendar({ year, month, today, selected, marks, onSelect, onMonth }: Props) {
  const weeks = monthGrid(year, month);
  const go = (delta: number) => {
    const m = shiftMonth(year, month, delta);
    onMonth(m.year, m.month);
  };
  return (
    <section className="card calendar" aria-label="Calendar">
      <div className="cal-head">
        <button type="button" className="icon-btn" onClick={() => go(-1)} aria-label="Previous month">‹</button>
        <h2 className="display cal-title" aria-live="polite">{monthLabel(year, month)}</h2>
        <button type="button" className="icon-btn" onClick={() => go(1)} aria-label="Next month">›</button>
      </div>
      <table className="cal-grid">
        <thead>
          <tr>{WEEKDAYS.map((d, i) => <th key={i} scope="col" abbr={WEEKDAYS_LONG[i]}>{d}</th>)}</tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0].date}>
              {week.map((d) => {
                const m = marks.get(d.date);
                return (
                  <td key={d.date}>
                    <button
                      type="button"
                      className={`cal-day${d.inMonth ? '' : ' other-month'}`}
                      aria-pressed={d.date === selected}
                      aria-current={d.date === today ? 'date' : undefined}
                      aria-label={dayLabel(d.date, m)}
                      onClick={() => onSelect(d.date)}
                    >
                      <span>{d.day}</span>
                      <span className="dots" aria-hidden="true">
                        {m?.booked ? <span className="dot dot-booked" /> : null}
                        {m?.logged ? <span className="dot dot-logged" /> : null}
                      </span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="cal-key" aria-hidden="true">
        <span className="dot dot-booked" /> Booked <span className="dot dot-logged" /> Logged
      </p>
    </section>
  );
}
