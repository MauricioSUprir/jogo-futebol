// Serve jsdelivr/Google Fonts a partir de um cache local baixado com curl
// (o Chromium headless não passa pelo proxy desta máquina).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const cache = '/tmp/claude-0/-home-user-jogo-futebol/9805b587-e422-5403-9106-8bf9d9184706/scratchpad/.cdn-cache-core';
mkdirSync(cache, { recursive: true });
export async function routeCDN(ctx) {
  await ctx.route(/cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com/, async (route) => {
    const url = route.request().url();
    const f = join(cache, createHash('md5').update(url).digest('hex'));
    try { if (!existsSync(f)) execFileSync('curl', ['-sSL', '-A', 'Mozilla/5.0 Chrome/120', '-o', f, url]); }
    catch { return route.abort(); }
    const type = url.includes('fonts.googleapis') ? 'text/css' : url.includes('gstatic') ? 'font/woff2' : 'application/javascript';
    await route.fulfill({ body: readFileSync(f), contentType: type, headers: { 'access-control-allow-origin': '*' } });
  });
}
