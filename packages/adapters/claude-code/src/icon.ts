const CLAUDE_CODE_ICON_SVG = `
<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g fill="#D97957">
    <rect x="29" y="2" width="6" height="20" rx="3"/>
    <rect x="29" y="42" width="6" height="20" rx="3"/>
    <rect x="42" y="29" width="20" height="6" rx="3"/>
    <rect x="2" y="29" width="20" height="6" rx="3"/>
    <rect x="29" y="2" width="6" height="20" rx="3" transform="rotate(30 32 32)"/>
    <rect x="29" y="2" width="6" height="20" rx="3" transform="rotate(60 32 32)"/>
    <rect x="29" y="2" width="6" height="20" rx="3" transform="rotate(120 32 32)"/>
    <rect x="29" y="2" width="6" height="20" rx="3" transform="rotate(150 32 32)"/>
    <rect x="29" y="2" width="6" height="20" rx="3" transform="rotate(-30 32 32)"/>
    <rect x="29" y="2" width="6" height="20" rx="3" transform="rotate(-60 32 32)"/>
    <rect x="29" y="2" width="6" height="20" rx="3" transform="rotate(-120 32 32)"/>
    <rect x="29" y="2" width="6" height="20" rx="3" transform="rotate(-150 32 32)"/>
    <circle cx="32" cy="32" r="11"/>
  </g>
</svg>`.trim()

export const adapterIcon = `data:image/svg+xml;utf8,${encodeURIComponent(CLAUDE_CODE_ICON_SVG)}`
export const adapterDisplayName = 'Claude Code'
