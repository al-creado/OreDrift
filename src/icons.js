/* Line icons (24x24, drawn with the current text colour) for the bottom nav and the tutorial. */
const PATHS = {
  // a rocket
  fleet: '<path d="M12 2.5c3 2.4 4.6 5.9 4.6 9.6v3.4l2.2 2.6H5.2l2.2-2.6v-3.4C7.4 8.4 9 4.9 12 2.5z"/><circle cx="12" cy="10.2" r="1.9"/><path d="M10 19.5l2 2.5 2-2.5"/>',
  // two chevrons pointing up
  ups: '<path d="M5.5 11.5L12 5l6.5 6.5"/><path d="M5.5 19L12 12.5 18.5 19"/>',
  // a trophy
  goals: '<path d="M8 4h8v5.2a4 4 0 0 1-8 0V4z"/><path d="M8 6.2H5.2v1a3 3 0 0 0 3 3"/><path d="M16 6.2h2.8v1a3 3 0 0 1-3 3"/><path d="M12 13.2V17"/><path d="M9 20.5h6"/><path d="M10 17h4v3.5h-4z"/>',
  // a ringed planet
  belt: '<circle cx="12" cy="12" r="5"/><ellipse cx="12" cy="12" rx="10" ry="3.4" transform="rotate(-20 12 12)"/>',
  // a bag
  shop: '<path d="M5 8h14l-1.1 12H6.1L5 8z"/><path d="M9 8V6.4a3 3 0 0 1 6 0V8"/>',
  // an asteroid with a tap ripple
  tap: '<path d="M6.5 6l5.5-2.5 5.5 2.5 2 5-2.5 5.5-5.5 2-5-2.5L4.5 11z"/><circle cx="10" cy="10.5" r="1.2"/><circle cx="14.2" cy="14.4" r="1.7"/>',
};

export const icon = (name, size = 26) =>
  '<svg class="ico" viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + PATHS[name] + '</svg>';
