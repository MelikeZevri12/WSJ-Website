// A tiny email sender for the website server (plain Node, no packages), used for the Black Friday
// "your code is live" emails. Same mail server and mailbox as the cruise API (booking@everyavenue.com):
// SMTP_HOST, SMTP_PORT (465 = SSL/TLS from the start, what the noreply@ mailbox uses; 587 = STARTTLS), SMTP_USER, SMTP_PASSWORD, MAIL_FROM_ADDRESS (+ optional MAIL_REPLY_TO: where replies go,
// e.g. booking@everyavenue.com when sending from a no-reply address) in ~/apps/site-api/.env,
// copied from the cruise API's .env (see README.md). Never print those values.
'use strict';
const net = require('net');
const tls = require('tls');
const crypto = require('crypto');

function mailConfig(env = process.env) {
  const c = { host: env.SMTP_HOST, port: Number(env.SMTP_PORT || 587), user: env.SMTP_USER, pass: env.SMTP_PASSWORD, from: env.MAIL_FROM_ADDRESS, replyTo: env.MAIL_REPLY_TO || '' };
  return c.host && c.user && c.pass && c.from ? c : null;
}

// one SMTP conversation: read a (possibly multi-line) reply, check its code
function conversation(socket) {
  let buf = '', waiting = null;
  const onData = (d) => {
    buf += d.toString('utf8');
    const lines = buf.split('\r\n');
    for (let i = 0; i < lines.length - 1; i++) {
      if (/^\d{3} /.test(lines[i])) {          // last line of a reply
        const reply = lines.slice(0, i + 1).join('\n');
        buf = lines.slice(i + 1).join('\r\n');
        if (waiting) { const w = waiting; waiting = null; w(reply); }
        return;
      }
    }
  };
  return {
    attach(s) { socket = s; s.on('data', onData); },
    reply(expect) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('The mail server did not answer in time.')), 30000);
        waiting = (r) => {
          clearTimeout(timer);
          if (!String(expect).split('|').some((code) => r.startsWith(code))) reject(Object.assign(new Error(`Mail server said: ${r.split('\n').pop().slice(0, 200)}`), { smtp: r }));
          else resolve(r);
        };
      });
    },
    async cmd(line, expect) { const p = this.reply(expect); socket.write(line + '\r\n'); return p; },
  };
}

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const wrap76 = (s) => s.replace(/.{1,76}/g, '$&\r\n');
// =?UTF-8?B?...?= for headers with non-ASCII characters (€, ’, ā)
const header = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);

function buildMessage({ from, fromName, to, replyTo, subject, text, html }) {
  const boundary = 'wsj-' + crypto.randomBytes(12).toString('hex');
  const domain = from.split('@')[1] || 'localhost';
  return [
    `From: ${header(fromName)} <${from}>`,
    `To: <${to}>`,
    ...(replyTo ? [`Reply-To: <${replyTo}>`] : []),
    `Subject: ${header(subject)}`,
    `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(b64(text)),
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(b64(html)),
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

// send one email; resolves when the mail server has accepted it. opts.insecure: tests only (local fake server, no TLS).
// opts.checkOnly: connect + log in, then hang up without sending (smtp-check.js). opts.log: called with each step done.
async function sendMail(config, msg, opts = {}) {
  if (!config) throw Object.assign(new Error('Email isn’t set up on the website server yet (SMTP settings missing in .env).'), { status: 503 });
  const log = opts.log || (() => {});
  const to = opts.checkOnly ? '' : String(msg.to || '').trim();
  if (!opts.checkOnly && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(to)) throw Object.assign(new Error('That email address doesn’t look right.'), { status: 400 });
  // port 465 = secure from the first byte ("SSL/TLS"); 587 = plain first, then STARTTLS
  const implicit = !opts.insecure && config.port === 465;
  let socket = implicit ? tls.connect({ host: config.host, port: config.port, servername: config.host }) : net.connect(config.port, config.host);
  socket.setTimeout(25000, () => socket.destroy(new Error(`No answer from the mail server (${config.host}, port ${config.port}). The port may be blocked on this server.`)));
  const failed = new Promise((_, reject) => socket.once('error', reject));
  failed.catch(() => {});   // an error after a successful send must not crash the server
  const c = conversation(socket);
  c.attach(socket);
  const talk = (async () => {
    await c.reply('220');
    log(`connected to the mail server on port ${config.port}${implicit ? ' (secure)' : ''}`);
    const name = 'worldschoolingjourneys.com';
    const ehlo = await c.cmd(`EHLO ${name}`, '250');
    if (!opts.insecure && !implicit) {
      if (!/STARTTLS/i.test(ehlo)) throw new Error('The mail server doesn’t offer a secure connection.');
      await c.cmd('STARTTLS', '220');
      socket.removeAllListeners('data');
      socket = tls.connect({ socket, servername: config.host });
      socket.once('error', () => {});
      await new Promise((resolve, reject) => { socket.once('secureConnect', resolve); socket.once('error', reject); });
      c.attach(socket);
      await c.cmd(`EHLO ${name}`, '250');
      log('secure connection (STARTTLS) ok');
    }
    await c.cmd(`AUTH PLAIN ${Buffer.from(`\0${config.user}\0${config.pass}`).toString('base64')}`, '235');
    log(`logged in as ${config.user}`);
    if (opts.checkOnly) { c.cmd('QUIT', '221').catch(() => {}).finally(() => socket.end()); return { ok: true }; }
    await c.cmd(`MAIL FROM:<${config.from}>`, '250');
    await c.cmd(`RCPT TO:<${to}>`, '250|251');
    await c.cmd('DATA', '354');
    const body = buildMessage({ ...msg, to, from: config.from, replyTo: msg.replyTo || config.replyTo, fromName: msg.fromName || 'Worldschooling Journeys' })
      .replace(/\r\n\./g, '\r\n..');   // dot-stuffing
    const done = await c.cmd(body + '\r\n.', '250');
    c.cmd('QUIT', '221').catch(() => {}).finally(() => socket.end());
    return { accepted: to, serverReply: done.split('\n').pop().slice(0, 120) };
  })();
  try { return await Promise.race([talk, failed]); }
  catch (err) { socket.destroy(); throw err; }
}

module.exports = { sendMail, mailConfig, buildMessage };
