import { Link } from "react-router-dom";

/**
 * The actions rail under a note: save-to-collection (signed in, and only when
 * the viewer actually has collections), edit/delete for those allowed, and
 * report for any signed-in reader who is not the author. Renders nothing when
 * the viewer has no action available.
 */
const NoteToolbar = ({
  postId,
  isAuthenticated,
  canEdit = false,
  canDelete = false,
  collections = [],
  selectedCollectionId,
  onSelectCollection,
  onSave,
  onDelete,
  onReport,
}) => {
  if (!canEdit && !canDelete && !isAuthenticated) return null;

  return (
    <div className="manuscript-toolbar">
      {isAuthenticated && collections.length > 0 ? (
        <>
          <select
            value={selectedCollectionId}
            onChange={(e) => onSelectCollection(e.target.value)}
            className="manuscript-select"
          >
            {collections.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="button" className="manuscript-toolbar-btn" onClick={onSave}>
            ✦ Save
          </button>
        </>
      ) : null}
      {canEdit ? (
        <Link to={`/write/${postId}`} className="manuscript-toolbar-btn">
          ✎ Edit
        </Link>
      ) : null}
      {canDelete ? (
        <button type="button" className="manuscript-toolbar-btn is-danger" onClick={onDelete}>
          🗑 Delete
        </button>
      ) : null}
      {isAuthenticated && !canEdit ? (
        <button type="button" className="manuscript-toolbar-btn" onClick={onReport}>
          ⚑ Report
        </button>
      ) : null}
    </div>
  );
};

export default NoteToolbar;
