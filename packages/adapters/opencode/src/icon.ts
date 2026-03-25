const OPENCODE_ICON_SVG = `
<svg height="1em" style="flex:none;line-height:1" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg">
  <rect width="24" height="24" rx="6" fill="#0F172A"></rect>
  <path d="M12 3.25 4.75 7.5v9L12 20.75l7.25-4.25v-9L12 3.25Zm0 2.06 5.5 3.22-5.5 3.22-5.5-3.22L12 5.31Zm-6 4.97 5 2.93v5.46l-5-2.93v-5.4Zm7 8.39v-5.46l5-2.93v5.4l-5 2.99Z" fill="url(#opencode-fill)"></path>
  <defs>
    <linearGradient id="opencode-fill" x1="4.75" x2="19.25" y1="3.25" y2="20.75" gradientUnits="userSpaceOnUse">
      <stop stop-color="#34D399"></stop>
      <stop offset=".55" stop-color="#22C55E"></stop>
      <stop offset="1" stop-color="#14B8A6"></stop>
    </linearGradient>
  </defs>
</svg>
`
  .trim()

export const adapterIcon = `data:image/svg+xml;utf8,${encodeURIComponent(OPENCODE_ICON_SVG)}`
export const adapterDisplayName = 'OpenCode'
