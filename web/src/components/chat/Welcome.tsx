/* ---------------------------------------
    The empty chat: what the assistant does, and a few requests to try with one click.
--------------------------------------- */

const EXAMPLES = [
  'Show me running shoes under $120',
  "I'm looking for orange running shorts in size small",
  'Polo brand shirts',
  'Something for a beach wedding',
];

export function Welcome({ onPick }: Readonly<{ onPick: (message: string) => void }>) {
  return (
    <div className="welcome">
      <h2 className="welcome-title">What are you shopping for?</h2>
      <p className="welcome-text">Describe it in your own words. Every product shown is a real listing from the catalog, and follow-ups like "anything cheaper?" refine the results.</p>
      <div className="welcome-examples">
        {EXAMPLES.map((example) => (
          <button key={example} type="button" className="pill-button example-chip" onClick={() => onPick(example)}>
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}
