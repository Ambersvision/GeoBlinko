import { getPgBoss } from './lib/pgBoss.mjs';

console.log('Initializing pg-boss...');
await getPgBoss();
console.log('pg-boss initialized successfully!');
process.exit(0);
