const { spawn } = require('child_process');

const child = spawn('npx.cmd', ['wrangler', 'secret', 'put', 'GEMINI_API_KEY'], { shell: true });

child.stdout.on('data', (data) => {
  console.log(`stdout: ${data}`);
  if (data.toString().includes('Enter the secret text')) {
    child.stdin.write('AIzaSyAipWNO7cGv9TdEV4CBPnYYFyAVDtdfpBo\n');
    child.stdin.end();
  }
});

child.stderr.on('data', (data) => {
  console.error(`stderr: ${data}`);
});

child.on('close', (code) => {
  console.log(`child process exited with code ${code}`);
});
