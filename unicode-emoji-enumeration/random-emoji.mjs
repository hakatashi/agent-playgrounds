/**
 * Picks 10 unique random fully-qualified emoji from emoji.json
 * and prints them as a single string.
 *
 * Usage: node random-emoji.mjs
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const data = JSON.parse(readFileSync(join(import.meta.dirname, 'emoji.json'), 'utf8'));

const fullyQualified = data.emoji_test
  .filter(e => e.status === 'fully-qualified')
  .map(e => e.string);

// Fisher-Yates partial shuffle to pick 10 unique entries
const pool = [...fullyQualified];
const count = Math.min(10, pool.length);
for (let i = 0; i < count; i++) {
  const j = i + Math.floor(Math.random() * (pool.length - i));
  [pool[i], pool[j]] = [pool[j], pool[i]];
}

console.log(pool.slice(0, count).join(''));
