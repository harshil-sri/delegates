import { readFile } from 'node:fs/promises';
import { verifyReceipt } from '../src/receipt-verify.mjs';

const [receiptPath, htmlPath, scriptPath] = process.argv.slice(2);
if (!receiptPath) {
  console.error('Usage: npm run verify -- <receipt.json> [storyboard.html] [script.txt]');
  process.exit(2);
}
const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
const html = htmlPath ? await readFile(htmlPath) : undefined;
const script = scriptPath ? await readFile(scriptPath) : undefined;
const {ok, results} = verifyReceipt(receipt, {html, script});
for (const item of results) console.log(`${item.passed ? 'PASS' : 'FAIL'}  ${item.name.padEnd(20)} ${item.detail}`);
console.log(ok ? `\nVerified: ${receipt.caseId} BOARD${receipt.revision} is the exact bundle both owners approved (${receipt.digest}).` : '\nNOT VERIFIED: the files or receipt do not match.');
process.exit(ok ? 0 : 1);
