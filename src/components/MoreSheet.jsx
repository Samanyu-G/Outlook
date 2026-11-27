import Sheet from './Sheet.jsx'

// The More menu on a game: details, share, report, block the maker.
export default function MoreSheet({ game, isOwn, onClose, onDetails, onShare, onReport, onBlock }) {
  return (
    <Sheet title={game.title} onClose={onClose}>
      <div className="menu">
        {onDetails && <button type="button" onClick={() => onDetails(game)}>Game details</button>}
        <button type="button" onClick={() => onShare(game)}>Pass it on</button>
        {!isOwn && <button type="button" onClick={() => onReport({ type: 'game', id: game.id, label: game.title })}>Report game</button>}
        {!isOwn && <button type="button" className="danger" onClick={() => onBlock(game.creator)}>Block @{game.creator.handle}</button>}
      </div>
      {!isOwn && <p className="muted small">Blocking hides @{game.creator.handle}’s games and comments from you. They won’t be told.</p>}
    </Sheet>
  )
}
