import { readFileSync, writeFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
if (!pkg.pnpm) pkg.pnpm = {};
if (!pkg.pnpm.onlyBuiltDependencies) pkg.pnpm.onlyBuiltDependencies = [];
if (!pkg.pnpm.onlyBuiltDependencies.includes('canvas')) {
  pkg.pnpm.onlyBuiltDependencies.push('canvas');
}
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('canvas added to onlyBuiltDependencies');
