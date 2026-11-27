// Official Nativity brand marks. These always show the supplied SVG files in /public/brand,
// never a redraw. Width and height are set on every <img> so space is reserved before the
// file loads (no layout shift), and the aspect ratio is fixed so the marks never stretch.
const ICON = '/brand/nativity-icon.svg'
const LOCKUP = '/brand/nativity-lockup.svg'
const LOCKUP_DARK = '/brand/nativity-lockup-dark.svg'
const LOCKUP_RATIO = 1336 / 480

/** Square app icon, for compact spaces where the wordmark would be too large. */
export function BrandIcon({ size = 32, className = '', decorative = false }) {
  return (
    <img
      src={ICON} width={size} height={size} alt={decorative ? '' : 'Nativity'}
      className={`brand-icon ${className}`.trim()} decoding="async" draggable={false}
    />
  )
}

/**
 * Horizontal logo. tone="auto" follows the app theme: the light-background lockup on
 * Day, the dark lockup (its own #241E1A panel, which matches the Night surface) on Night.
 * tone="light" or "dark" forces one version.
 */
export function BrandLockup({ height = 40, tone = 'auto', className = '' }) {
  const width = Math.round(height * LOCKUP_RATIO)
  const img = (src, cls) => (
    <img src={src} width={width} height={height} alt="Nativity" className={cls} decoding="async" draggable={false} />
  )
  return (
    <span className={`brand-lockup ${tone} ${className}`.trim()} style={{ width }}>
      {tone !== 'dark' && img(LOCKUP, 'on-light')}
      {tone !== 'light' && img(LOCKUP_DARK, 'on-dark')}
    </span>
  )
}
