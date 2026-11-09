// Checks the email settings in .env WITHOUT sending anything: connects to the mail server, logs in, hangs up.
// Never prints the password. Run on the VPS:  cd ~/apps/site-api && node smtp-check.js
// If the port in .env doesn't answer, it also tries the other common port (465 <-> 587) and says which one works.
'use strict';
const fs = require('fs');
const path = require('path');
const net = require('net');
const { sendMail, mailConfig } = require('./smtp');

// read .env the way systemd's EnvironmentFile does (KEY=value, optional quotes)
const env = {};
try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
  }
} catch (e) { console.log('Could not read .env:', e.message); process.exit(1); }

for (const k of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'MAIL_FROM_ADDRESS']) {
  console.log(`${k.padEnd(18)} ${env[k] ? (k === 'SMTP_PASSWORD' ? `set (${env[k].length} characters)` : env[k]) : 'MISSING'}`);
}
const config = mailConfig(env);
if (!config) { console.log('\nSome settings are missing, so the website server can\'t send. Add them to .env and run this again.'); process.exit(1); }

// can this server reach a port at all? (some hosting companies block outgoing mail ports)
function reachable(host, port) {
  return new Promise((resolve) => {
    const s = net.connect(port, host);
    const done = (ok) => { s.destroy(); resolve(ok); };
    s.setTimeout(10000, () => done(false));
    s.once('connect', () => done(true));
    s.once('error', () => done(false));
  });
}

(async () => {
  console.log('');
  for (const port of [465, 587]) console.log(`port ${port}: ${(await reachable(config.host, port)) ? 'reachable' : 'NO ANSWER (blocked or closed)'}`);
  console.log(`\nLogging in on port ${config.port} (nothing is sent)...`);
  try {
    await sendMail(config, {}, { checkOnly: true, log: (step) => console.log('  ok:', step) });
    console.log('\nAll good: the website server can send emails with these settings.');
  } catch (err) {
    console.log('\nFAILED:', String(err.message).replace(env.SMTP_PASSWORD || '\0', '[hidden]'));
  }
})();
