import Sheet from './Sheet.jsx'

// The "⋯" menu on a game: share, report, block the creator.
export default function MoreSheet({ game, isOwn, onClose, onShare, onReport, onBlock }) {
  return (
    <Sheet title={game.title} onClose={onClose}>
      <div className="menu">
        <button type="button" onClick={() => onShare(game)}>Share</button>
        {!isOwn && <button type="button" onClick={() => onReport({ type: 'game', id: game.id, label: game.title })}>Report game</button>}
        {!isOwn && <button type="button" className="danger" onClick={() => onBlock(game.creator)}>Block @{game.creator.handle}</button>}
      </div>
      {!isOwn && <p className="muted small">Blocking hides @{game.creator.handle}’s games and comments from you. They won’t be told.</p>}
    </Sheet>
  )
}
