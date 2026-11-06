import { digest, roles } from './court-schema.mjs';
import { boardChecks } from './storyboard.mjs';

// Offline verification of an exported storyboard against its approval receipt.
// It needs no server, database or Switch access: every claim is recomputed
// from the bytes and the receipt's own content.
export function verifyReceipt(receipt, {html, script} = {}) {
  const results = [];
  const check = (name, passed, detail) => results.push({name, passed:!!passed, detail});
  const manifest = receipt?.manifest;
  check('receipt-shape', manifest && typeof manifest === 'object' && typeof receipt.digest === 'string', 'Receipt contains a manifest and bundle digest.');
  if (!results[0].passed) return {ok:false, results};
  check('bundle-digest', digest(manifest) === receipt.digest, 'SHA-256 of the canonical manifest equals the approved bundle digest.');
  if (html !== undefined) check('storyboard-bytes', digest(Buffer.from(html)) === manifest.files?.['storyboard.html'], 'The storyboard file is byte-identical to the reviewed preview.');
  if (script !== undefined) check('script-bytes', digest(Buffer.from(script)) === manifest.files?.['script.txt'], 'The script file is byte-identical to the reviewed script.');
  for (const role of roles) {
    const brief = receipt.briefs?.[role];
    check(`brief-${role}`, brief && digest(brief.content) === brief.hash && manifest.briefs?.[role]?.sha256 === brief.hash && manifest.briefs[role].ref === brief.ref && !!brief.adoption, `${role} brief ${brief?.ref ?? '?'} content matches its hash, was adopted by its owner, and is the version bound into the bundle.`);
  }
  const current = (receipt.approvals ?? []).filter(approval => approval.digest === receipt.digest && approval.revision === manifest.revision && !approval.revokedBy);
  const signers = new Set(current.map(approval => approval.role));
  check('two-human-approvals', roles.every(role => signers.has(role)) && new Set(current.map(approval => approval.sender)).size >= 2 && current.every(approval => approval.sourceId), 'Both distinct human owners approved this exact digest, each from their own Switch message.');
  if (manifest.creatorReview) check('creator-review', manifest.creatorReview.decision === 'recommend' && manifest.creatorReview.boardHash === digest(manifest.board) && manifest.creatorReview.boardRevision === manifest.revision, 'The creator advocate reviewed this exact board (advisory only, not consent).');
  if (receipt.briefs?.lead && receipt.briefs?.creator) {
    const catalog = {assets:(manifest.assets ?? []).map(asset => ({id:asset.id, permitted:!!asset.sha256, bytes:asset.sha256}))};
    const recomputed = boardChecks(manifest.board, receipt.briefs, catalog);
    check('rule-checks', recomputed.every(item => item.passed), `Re-ran ${recomputed.length} encoded rules from the receipt: ${recomputed.filter(item => !item.passed).map(item => item.detail).join(' ') || 'all pass'}`);
  }
  return {ok:results.every(item => item.passed), results};
}
