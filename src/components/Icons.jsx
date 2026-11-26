const HEART = 'M12 20.5s-7.6-4.6-9.5-9.3C1.1 7.7 3.3 4.2 6.9 4.2c2 0 3.5 1.1 5.1 3 1.6-1.9 3.1-3 5.1-3 3.6 0 5.8 3.5 4.4 7-1.9 4.7-9.5 9.3-9.5 9.3z'

export const HeartIcon = () => <svg className="ico heart" viewBox="0 0 24 24"><path d={HEART} /></svg>
export const HeartBurst = ({ x, y }) => <svg className="burst" viewBox="0 0 24 24" style={{ left: x, top: y }}><path d={HEART} /></svg>
export const CommentIcon = () => <svg className="ico" viewBox="0 0 24 24"><path d="M4 5.5h16v11H10l-5 4v-4H4z" /></svg>
export const ShareIcon = () => <svg className="ico" viewBox="0 0 24 24"><path d="M20.5 3.5 3.5 10l7 3 3 7z" /><path d="M10.5 13 20.5 3.5" /></svg>
export const PlayIcon = () => <svg viewBox="0 0 24 24"><path d="M6 3.8v16.4L20 12z" /></svg>
export const MoreIcon = () => <svg className="ico" viewBox="0 0 24 24"><circle cx="5.5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="18.5" cy="12" r="1.6" /></svg>
export const CloseIcon = () => <svg className="ico" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" /></svg>
export const HomeIcon = () => <svg className="ico" viewBox="0 0 24 24"><path d="M4 10.5 12 4l8 6.5V20h-5.5v-6h-5v6H4z" /></svg>
export const PlusIcon = () => <svg className="ico" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
export const UserIcon = () => <svg className="ico" viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20c1.2-3.8 4-5.6 7.5-5.6s6.3 1.8 7.5 5.6" /></svg>
export const FileIcon = () => <svg className="ico" viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M12 11v6M9 14l3-3 3 3" /></svg>
export const FilmIcon = () => <svg className="ico" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10 9.5v5l4-2.5z" /></svg>
