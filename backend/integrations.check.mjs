// Checks for the outside-service helpers. Run: node integrations.check.mjs
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { liveKitToken, buildCalendar } from './controllers/integrationsController.js';
import { serviceOf } from './services/alerts.js';

// LiveKit token: a valid HS256 JWT with the room grant
const token = liveKitToken({ key: 'APIkey', secret: 'shh', room: 'workspace-w1', identity: 'u1', name: 'Ada' });
const [head, body, sig] = token.split('.');
assert.equal(sig, createHmac('sha256', 'shh').update(`${head}.${body}`).digest('base64url'), 'signed with the secret');
const claims = JSON.parse(Buffer.from(body, 'base64url'));
assert.equal(claims.iss, 'APIkey');
assert.equal(claims.sub, 'u1');
assert.deepEqual(claims.video, { room: 'workspace-w1', roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true });
assert.ok(claims.exp > claims.nbf);
console.log('ok  call tokens are signed JWTs for one room');

// Only real Slack/Discord webhooks are accepted
assert.equal(serviceOf('https://hooks.slack.com/services/T000/B000/XXXX'), 'slack');
assert.equal(serviceOf('https://discord.com/api/webhooks/123/abc-DEF_9'), 'discord');
assert.equal(serviceOf('https://hooks.slack.com.evil.dev/services/x'), null);
assert.equal(serviceOf('http://hooks.slack.com/services/x'), null);
assert.equal(serviceOf('https://discord.com/api/webhooks/123/abc/../../x'), null);
assert.equal(serviceOf('https://169.254.169.254/latest'), null);
console.log('ok  only Slack and Discord webhook URLs are accepted');

// Calendar: escaped, CRLF, folded at 75 bytes
const ics = buildCalendar([{
  id: 'e1', title: 'Graphs; BFS, DFS', description: 'Bring\nlaptops', starts_at: '2026-11-20T15:00:00Z', ends_at: '2026-11-20T16:00:00Z',
  workspace: 'algorithms', url: `https://devsync.dev/editor/w1?view=events&x=${'y'.repeat(80)}`,
}], { now: new Date('2026-11-17T00:00:00Z') });
assert.ok(ics.includes('SUMMARY:Graphs\\; BFS\\, DFS (algorithms)'));
assert.ok(ics.includes('DESCRIPTION:Bring\\nlaptops'));
assert.ok(ics.includes('DTSTART:20261120T150000Z'));
assert.ok(ics.split('\r\n').every((l) => Buffer.byteLength(l) <= 75), 'lines fold at 75 bytes');
assert.ok(ics.includes('\r\n '), 'long URL was folded');
assert.ok(!/[^\r]\n/.test(ics), 'CRLF line endings only');
const unfolded = ics.replace(/\r\n /g, '');
assert.ok(unfolded.includes(`x=${'y'.repeat(80)}`), 'folding round-trips');
const emoji = buildCalendar([{ id: 'e2', title: '🎉'.repeat(40), starts_at: '2026-11-20T15:00:00Z', ends_at: '2026-11-20T16:00:00Z' }]);
assert.ok(emoji.split('\r\n').every((l) => Buffer.byteLength(l) <= 75), 'never splits inside a character');
assert.ok(emoji.replace(/\r\n /g, '').includes('🎉'.repeat(40)));
console.log('ok  calendar feed is valid iCalendar');

console.log('\nAll integration checks passed');
process.exit(0);
