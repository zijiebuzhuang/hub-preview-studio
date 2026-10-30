#!/usr/bin/env node
import { createStudioServer } from '../lib/server.mjs';
const args = process.argv.slice(2);
const help = 'Hub Preview Studio 0.1.1 — independent local layout tool\n\nUsage: hub-preview-studio [--app http://localhost:5173] [--port 4177]\n\nPhone preview accepts any embeddable HTTP(S) project. Glasses output uses the optional client adapter.\nDefault opens a neutral built-in example. Listens on 127.0.0.1 only.\n';
if (args.includes('--help') || args.includes('-h')) { console.log(help); process.exit(0); }
if (args.includes('--version')) { console.log('0.1.1'); process.exit(0); }
try {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!['--app', '--port'].includes(key) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('Unknown or incomplete option: ' + key);
    options[key.slice(2)] = args[++i];
  }
  const port = Number(options.port || 4177);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Port must be 1024–65535');
  const server = createStudioServer({ ...options, port });
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'Port is in use; choose another with --port.' : error.message); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log('Hub Preview Studio\nhttp://127.0.0.1:' + port + '\nPhone + glasses layout preview. No physical device connection.\nPress Ctrl+C to stop.'));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
} catch (error) { console.error(error.message); process.exitCode = 1; }
