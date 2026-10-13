'use client';

// One topic inside a course: name, difficulty, hours. Fully controlled by CourseEditor.
export default function TopicRow({ topic, onChange, onRemove }) {
  return (
    <div className="topic-row">
      <label className="field topic-name">
        <span>Topic</span>
        <input value={topic.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="e.g. Chapter 4: Cells" required />
      </label>
      <label className="field">
        <span>Difficulty</span>
        <select value={topic.difficulty} onChange={(e) => onChange({ difficulty: e.target.value })}>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </label>
      <label className="field">
        <span>Hours needed</span>
        <input type="number" inputMode="decimal" min="0.5" step="0.5" value={topic.hoursNeeded} onChange={(e) => onChange({ hoursNeeded: e.target.value })} required />
      </label>
      <button type="button" className="btn btn-quiet" onClick={onRemove} aria-label={`Remove topic ${topic.name || ''}`}>
        Remove
      </button>
      <small className="topic-hint">If not sure, take a safe guess.</small>
    </div>
  );
}
