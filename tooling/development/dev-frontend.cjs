const net = require('node:net');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '../../apps/frontend');
const project = crypto.createHash('sha256').update(root.toLowerCase()).digest('hex');

async function available(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', error => error.code === 'EADDRINUSE' ? resolve(false) : reject(error));
    server.listen(port, () => server.close(() => resolve(true)));
  });
}
async function main() {
  if (!await available(3000)) {
    let status;
    try {
      const response = await fetch('http://localhost:3000/api/dev/status', {signal:AbortSignal.timeout(15000)});
      if (response.ok) status = await response.json();
    } catch { /* Never kill an unknown or busy process automatically. */ }
    if (status?.project === project && status?.app === 'x3sales-frontend') {
      console.log('[Frontend] Dự án đã chạy tại http://localhost:3000. Không mở thêm tiến trình.');
      console.log('[Frontend] Muốn khởi động lại: Ctrl+C tại terminal đang chạy frontend, rồi chạy lại lệnh này.');
      return;
    }
    console.error('[Frontend] Cổng 3000 đang được sử dụng hoặc frontend chưa phản hồi. Kiểm tra terminal frontend đang chạy; không khởi động thêm bản thứ hai.');
    process.exitCode = 1;
    return;
  }
  const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '-p', '3000'], {
    cwd: root, stdio: 'inherit', windowsHide: true,
  });
  child.once('error', error => { console.error(error.message); process.exitCode = 1; });
  child.once('exit', code => { process.exitCode = code || 0; });
  for (const signal of ['SIGINT','SIGTERM']) process.once(signal, () => child.kill(signal));
}
if (require.main === module) main().catch(error => {console.error(error.message);process.exitCode=1;});
module.exports = {available};
