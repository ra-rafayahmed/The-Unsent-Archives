const REACTIONS = [
  ["like", "❤", "Love"],
  ["love", "🫂", "Felt"],
  ["sad", "💧", "Cried"],
  ["wow", "✨", "Wow"],
];

/**
 * The strip of reaction chips under a note. `reactions` is the count summary
 * keyed by reaction type; every chip reports its type back through `onReact`.
 */
const NoteReactions = ({ reactions = {}, onReact }) => {
  return (
    <div className="reaction-strip manuscript-reactions">
      {REACTIONS.map(([type, glyph, label]) => (
        <button key={type} type="button" className="reaction-chip" onClick={() => onReact(type)}>
          <span className="reaction-glyph" aria-hidden="true">
            {glyph}
          </span>
          <span>{label}</span>
          <span className="reaction-count">{reactions[type] || 0}</span>
        </button>
      ))}
    </div>
  );
};

export default NoteReactions;
