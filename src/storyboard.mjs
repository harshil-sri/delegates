import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { canonical, digest, roles } from './court-schema.mjs';

export const rendererVersion = 'cvc-storyboard-html-v1';
export const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export async function loadCatalog(root) {
  const assets = [];
  for (const id of ['signal-mark', 'notebook', 'hands-sketch', 'light-trails']) {
    const bytes = await readFile(resolve(root, 'assets', `${id}.svg`));
    assets.push({id, permitted:true, mime:'image/svg+xml', bytes:bytes.toString('base64'), sha256:digest(bytes)});
  }
  assets.push({id:'portrait-daksh',permitted:false,mime:null,bytes:null,sha256:null});
  return {version:'signal-assets-v1',assets};
}
export function boardChecks(board, briefs, catalog) {
  const checks = [];
  const check = (code, passed, detail) => checks.push({code,passed,detail});
  check('FOUR_PANELS', board.panels.length === 4, 'Exactly four panels.');
  check('THIRTY_SECONDS', board.panels.reduce((total, panel) => total + panel.seconds, 0) === 30, 'Planned duration totals 30 seconds.');
  const used = board.panels.map(panel => panel.assetId);
  for (const id of new Set(used)) check(`ASSET:${id}`, catalog.assets.some(asset => asset.id === id && asset.permitted && asset.bytes), `Asset ${id} must be registered and permitted.`);
  for (const role of roles) {
    const brief = briefs[role];
    for (const id of brief.content.requiredAssets) check(`${brief.ref}:REQUIRES:${id}`, used.includes(id), `${brief.ref} requires ${id}.`);
    for (const id of brief.content.forbiddenAssets) check(`${brief.ref}:FORBIDS:${id}`, !used.includes(id), `${brief.ref} forbids ${id}.`);
    const allLines = board.panels.flatMap(panel => panel.onScreen.split('\n'));
    const finalLines = board.panels.at(-1).onScreen.split('\n');
    for (const line of brief.content.requiredCopy) check(`${brief.ref}:COPY:${line}`, allLines.includes(line), `${brief.ref} requires the exact on-screen line: ${line}`);
    for (const line of brief.content.finalCopy) check(`${brief.ref}:FINAL:${line}`, finalLines.includes(line), `${brief.ref} requires the exact final-panel line: ${line}`);
  }
  return checks;
}
export function prepareBundle({caseId, revision, board, briefs, catalog, readyAt, review=null}) {
  const title = `${caseId} · BOARD${revision} · ${briefs.lead.ref}/${briefs.creator.ref}`;
  const cards = board.panels.map((panel, index) => {
    const asset = catalog.assets.find(asset => asset.id === panel.assetId && asset.permitted);
    if (!asset?.bytes || digest(Buffer.from(asset.bytes, 'base64')) !== asset.sha256) throw new Error('Asset bytes failed integrity verification.');
    return `<article><h2>Panel ${index + 1} · ${panel.seconds}s</h2><img alt="${escapeHtml(panel.assetId)}" src="data:${asset.mime};base64,${asset.bytes}"><p>${escapeHtml(panel.scene)}</p><h3>On screen</h3><pre>${escapeHtml(panel.onScreen)}</pre><h3>Voiceover</h3><p>${escapeHtml(panel.voiceover)}</p></article>`;
  }).join('\n');
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><style>body{font:17px system-ui;margin:40px auto;padding:0 20px;max-width:1100px;background:#f4f1e9;color:#172522}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px}article{padding:20px;border:1px solid #b8c2ba;border-radius:12px;background:white}img{width:100%;height:180px;object-fit:contain}pre{white-space:pre-wrap;font:inherit}h3{font-size:14px;color:#476355}footer{margin-top:24px;font-size:14px}</style><h1>${escapeHtml(board.title)}</h1><p>Storyboard review · ${escapeHtml(title)} · 30 seconds planned</p><main>${cards}</main><footer>This immutable production plan is the review artifact. Human decisions and approval status are recorded separately in its receipt.</footer></html>\n`;
  const script = `${title}\n${board.title}\n\n` + board.panels.map((panel,index) => `PANEL ${index+1} (${panel.seconds}s)\nAsset: ${panel.assetId}\nScene: ${panel.scene}\nOn screen:\n${panel.onScreen}\nVoiceover: ${panel.voiceover}\n`).join('\n');
  const manifest = {
    schema:'cvc-approval-bundle-v1',caseId,revision,readyAt,rendererVersion,creatorReview:review,
    briefs:Object.fromEntries(roles.map(role => [role,{ref:briefs[role].ref,sha256:briefs[role].hash}])),
    catalogSha256:digest(catalog),board,
    assets:[...new Set(board.panels.map(panel => panel.assetId))].map(id => {const asset=catalog.assets.find(item=>item.id===id);return {id,sha256:asset.sha256};}),
    files:{'storyboard.html':digest(html),'script.txt':digest(script)}
  };
  return {digest:digest(manifest),manifest:canonical(manifest),html,script,readyAt};
}
