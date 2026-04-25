const { spawn } = require('child_process');

const secretKey = 'GEMINI_API_KEY';
const secretValue = 'AIzaSyArhPxsC4VwGKIA1Fec4S6lxylLu9v8rp0';

console.log(`Setting secret for ${secretKey}...`);
const child = spawn('npx.cmd', ['wrangler', 'secret', 'put', secretKey], { shell: true });

child.stdout.on('data', (data) => {
  const str = data.toString();
  console.log(`stdout: ${str}`);
  if (str.includes('Enter a secret value:')) {
    console.log('Detected prompt! Writing secret value...');
    child.stdin.write(secretValue + '\n');
    child.stdin.end();
  }
});

child.stderr.on('data', (data) => {
  console.error(`stderr: ${data}`);
});

child.on('close', (code) => {
  console.log(`child process exited with code ${code}`);
  process.exit(code);
});
