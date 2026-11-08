import type { Suggestion } from '../api/types';
import { useApp } from '../state/AppContext';
import { OutcomeToggle } from './OutcomeToggle';
import { YesNoToggle } from './YesNoToggle';

interface Props {
  suggestion: Suggestion;
  /** In a live session: put this step on today's next steps so it comes up again next time. */
  onCarry?: () => void;
  carried?: boolean;
}

/** One next step from an earlier session: did the client do it, and did it help? */
export function GoalItem({ suggestion: g, onCarry, carried = false }: Props) {
  const { sync } = useApp();
  const showHelp = g.done === 'yes' || g.outcome !== '';
  return (
    <div className="goal-item">
      <YesNoToggle
        question="Did they do it?" yes="Done" no="Not yet" value={g.done}
        onChange={(done) => sync.enqueue({ action: 'setSuggestionDone', suggestionId: g.suggestionId, done })}
      />
      {showHelp && (
        <div className="yesno">
          <span className="yesno-q">Did it help?</span>
          <OutcomeToggle suggestion={g} />
        </div>
      )}
      {g.done === 'no' && onCarry && (
        carried
          ? <p className="hint carried" role="status">✓ In today's next steps, so it comes up again next time.</p>
          : <button type="button" className="btn-quiet carry-btn" onClick={onCarry}>Carry over to next session</button>
      )}
    </div>
  );
}
