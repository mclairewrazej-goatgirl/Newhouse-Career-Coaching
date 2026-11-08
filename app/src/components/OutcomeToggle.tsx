import type { Outcome, Suggestion } from '../api/types';
import { useApp } from '../state/AppContext';

/** "Helped" / "Didn't help" for one suggestion. Tapping the selected one clears it. */
export function OutcomeToggle({ suggestion }: { suggestion: Suggestion }) {
  const { sync } = useApp();
  const set = (o: Exclude<Outcome, ''>) =>
    sync.enqueue({ action: 'setSuggestionOutcome', suggestionId: suggestion.suggestionId, outcome: suggestion.outcome === o ? '' : o });
  return (
    <div className="outcome" role="group" aria-label={`Did "${suggestion.text}" help?`}>
      <button type="button" className="outcome-btn helpful" aria-pressed={suggestion.outcome === 'helpful'} onClick={() => set('helpful')}>
        Helped
      </button>
      <button type="button" className="outcome-btn not" aria-pressed={suggestion.outcome === 'not'} onClick={() => set('not')}>
        Didn't help
      </button>
    </div>
  );
}
