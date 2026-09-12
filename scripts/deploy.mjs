// Build, verify, and publish dist to the gh-pages branch.
//
// GitHub Actions runners are not currently available on this account, so the
// deploy runs here instead of in CI. npm run verify is the gate either way: this
// script refuses to publish if it fails.

import { execSync } from 'node:child_process';
import { cpSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts });
const capture = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();

run('npm run verify');

const sha = capture('git rev-parse --short HEAD');
const staging = mkdtempSync(join(tmpdir(), 'pages-'));
cpSync('dist', staging, { recursive: true });
writeFileSync(join(staging, '.nojekyll'), '');

const remote = capture('git remote get-url origin');
const git = (cmd) => run(`git ${cmd}`, { cwd: staging });

git('init -q');
git('checkout -qb gh-pages');
git('add -A');
git(`-c user.email=kurtkalwin@gmail.com -c user.name="Kurt Kalwin" commit -q -m "Deploy ${sha}"`);
git(`remote add origin ${remote}`);
git('push -qf origin gh-pages');

console.log(`\nDeployed ${sha} to gh-pages.`);
