import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// docs/index.html is the hosted privacy policy AND the source of the in-app copy (ui.js imports it as raw text and
// shows its <body>). These checks keep that safe: the in-app copy injects the HTML, so it must stay plain content.
const html = readFileSync(new URL('../docs/index.html', import.meta.url), 'utf8');
const body = html.slice(html.indexOf('<body>'), html.indexOf('</body>'));

describe('privacy policy page', () => {
  it('has a title heading and several sections', () => {
    expect(body).toMatch(/<h1>[^<]*Privacy Policy<\/h1>/);
    expect((body.match(/<h2>/g) || []).length).toBeGreaterThanOrEqual(5);
  });
  it('is plain content: no scripts, no event handlers, no embedded frames or forms', () => {
    expect(body).not.toMatch(/<script|<iframe|<form|<object|<embed/i);
    expect(body).not.toMatch(/\son[a-z]+\s*=/i);
    expect(body).not.toMatch(/javascript:/i);
  });
  it('only links out over https, or to a mailto address', () => {
    const hrefs = [...body.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const h of hrefs) expect(h).toMatch(/^(https:\/\/|mailto:)/);
  });
});
