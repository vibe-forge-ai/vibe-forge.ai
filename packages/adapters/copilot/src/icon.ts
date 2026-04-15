const COPILOT_ICON_SVG = `
<svg height="1em" style="flex:none;line-height:1" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg">
  <rect width="24" height="24" rx="6" fill="#111827"></rect>
  <path d="M7.25 8.1c.82-1.9 2.42-2.85 4.75-2.85s3.93.95 4.75 2.85c1.55.25 2.75 1.62 2.75 3.28v2.82c0 1.82-1.45 3.3-3.25 3.3h-.7c-.55 1.14-1.7 1.85-3.55 1.85s-3-.71-3.55-1.85h-.7c-1.8 0-3.25-1.48-3.25-3.3v-2.82c0-1.66 1.2-3.03 2.75-3.28Zm1.05 1.92a1.35 1.35 0 0 0-1.35 1.36v2.82c0 .76.6 1.38 1.35 1.38h1.28c.46 0 .86.33.94.79.11.62.55 1.05 1.48 1.05s1.37-.43 1.48-1.05c.08-.46.48-.79.94-.79h1.28c.75 0 1.35-.62 1.35-1.38v-2.82a1.35 1.35 0 0 0-1.35-1.36h-.42c-.45 0-.84-.31-.94-.75-.33-1.42-1.35-2.1-3.34-2.1s-3.01.68-3.34 2.1c-.1.44-.49.75-.94.75H8.3Zm1.25 2.45a1.05 1.05 0 1 1 2.1 0 1.05 1.05 0 0 1-2.1 0Zm3.8 0a1.05 1.05 0 1 1 2.1 0 1.05 1.05 0 0 1-2.1 0Z" fill="#F9FAFB"></path>
</svg>
`
  .trim()

export const adapterIcon = `data:image/svg+xml;utf8,${encodeURIComponent(COPILOT_ICON_SVG)}`
export const adapterDisplayName = 'Copilot'
