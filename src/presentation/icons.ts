const paths: Record<string, string> = {
  map: '<path d="M3 6.5 8 4l8 3 5-2.5v13L16 20l-8-3-5 2.5z"/><path d="M8 4v13M16 7v13"/>',
  orders: '<path d="M7 3h10v4H7z"/><path d="M5 5H3v16h18V5h-2M8 12h8M8 16h5"/>',
  truck: '<path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  company: '<path d="M4 21V8l8-5 8 5v13M9 21v-6h6v6M8 10h1M15 10h1"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  box: '<path d="m4 7 8-4 8 4-8 4zM4 7v10l8 4 8-4V7M12 11v10"/>',
  arrow: '<path d="M5 12h14M14 7l5 5-5 5"/>'
};

export const icon = (name: string, className = "icon"): string =>
  `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] ?? paths.box}</svg>`;
