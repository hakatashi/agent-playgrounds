/**
 * Unicode Emoji Enumerator
 *
 * Fetches official Unicode data files (Emoji 17.0 / Unicode 17.0) and
 * enumerates every emoji defined by the standard, including:
 *   - Basic emoji characters (Emoji property)
 *   - Emoji with text/emoji presentation (Emoji_Presentation)
 *   - Emoji modified by skin-tone modifiers (Emoji_Modifier_Base + Emoji_Modifier)
 *   - Emoji keycap sequences, flag sequences, tag sequences
 *   - ZWJ (Zero Width Joiner) sequences
 *
 * Data sources (all from unicode.org):
 *   - UCD emoji-data.txt          — character-level emoji properties
 *   - emoji-sequences.txt         — emoji sequences (keycap, flag, modifier, etc.)
 *   - emoji-zwj-sequences.txt     — ZWJ sequences
 *   - emoji-test.txt              — full test/rendering list with qualification status
 *   - emoji-variation-sequences.txt — variation sequences (text vs emoji presentation)
 */

const URLS = {
  emojiData:               'https://www.unicode.org/Public/UCD/latest/ucd/emoji/emoji-data.txt',
  emojiSequences:          'https://unicode.org/Public/emoji/latest/emoji-sequences.txt',
  emojiZwjSequences:       'https://unicode.org/Public/emoji/latest/emoji-zwj-sequences.txt',
  emojiTest:               'https://unicode.org/Public/emoji/latest/emoji-test.txt',
  emojiVariationSequences: 'https://www.unicode.org/Public/UCD/latest/ucd/emoji/emoji-variation-sequences.txt',
};

// ── Helpers ──────────────────────────────────────────────────────────

async function fetchText(url) {
  console.error(`Fetching ${url} ...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/** Parse a single hex code point like "1F600" → 0x1F600 */
function cp(hex) {
  return parseInt(hex, 16);
}

/** Convert a code-point number to a JS string (handles surrogates). */
function cpToStr(n) {
  return String.fromCodePoint(n);
}

/** Convert an array of code-point numbers to a string. */
function cpsToStr(arr) {
  return String.fromCodePoint(...arr);
}

/**
 * Parse a hex code-point field that may be a single value or a range
 * "1F600" → [0x1F600] , "1F3FB..1F3FF" → [0x1F3FB … 0x1F3FF]
 */
function parseRange(field) {
  const parts = field.split('..');
  if (parts.length === 1) {
    return [cp(parts[0])];
  }
  const start = cp(parts[0]);
  const end   = cp(parts[1]);
  const out = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}

/**
 * Parse a code-point sequence field like "1F468 200D 2764 FE0F 200D 1F468"
 * into an array of numbers.
 */
function parseSequence(field) {
  return field.trim().split(/\s+/).map(h => cp(h));
}

// ── Parsers for each data file ───────────────────────────────────────

/**
 * emoji-data.txt — each non-comment line is:
 *   <code-point(s)> ; <property> # <comment>
 * Returns Map<property, Set<codePoint>>
 */
function parseEmojiData(text) {
  const props = new Map();
  for (const line of text.split('\n')) {
    const trimmed = line.replace(/#.*/, '').trim();
    if (!trimmed) continue;
    const [cpField, propField] = trimmed.split(';').map(s => s.trim());
    const property = propField;
    if (!props.has(property)) props.set(property, new Set());
    const set = props.get(property);
    for (const c of parseRange(cpField)) set.add(c);
  }
  return props;
}

/**
 * emoji-sequences.txt — each non-comment line is:
 *   <code-point sequence> ; <type_field> ; <description> # …
 * Returns an array of { codepoints: number[], type: string, description: string, string: string }
 */
function parseEmojiSequences(text) {
  const results = [];
  for (const line of text.split('\n')) {
    const trimmed = line.replace(/#.*/, '').trim();
    if (!trimmed) continue;
    const parts = trimmed.split(';').map(s => s.trim());
    const cpField = parts[0];
    const type = parts[1] || '';
    const description = parts[2] || '';

    // cpField may be a range (for single-character sequences) or a sequence
    if (cpField.includes('..')) {
      // Range — expand
      for (const c of parseRange(cpField)) {
        results.push({
          codepoints: [c],
          type,
          description,
          string: cpToStr(c),
        });
      }
    } else {
      const seq = parseSequence(cpField);
      results.push({
        codepoints: seq,
        type,
        description,
        string: cpsToStr(seq),
      });
    }
  }
  return results;
}

/**
 * emoji-zwj-sequences.txt — same format as emoji-sequences.txt
 */
function parseEmojiZwjSequences(text) {
  const results = [];
  for (const line of text.split('\n')) {
    const trimmed = line.replace(/#.*/, '').trim();
    if (!trimmed) continue;
    const parts = trimmed.split(';').map(s => s.trim());
    const seq = parseSequence(parts[0]);
    results.push({
      codepoints: seq,
      type: parts[1] || 'Emoji_ZWJ_Sequence',
      description: parts[2] || '',
      string: cpsToStr(seq),
    });
  }
  return results;
}

/**
 * emoji-test.txt — each non-comment line is:
 *   <code-point sequence> ; <status> # <emoji> E<version> <description>
 * status is one of: fully-qualified, minimally-qualified, unqualified, component
 */
function parseEmojiTest(text) {
  const results = [];
  let currentGroup = '';
  let currentSubgroup = '';
  for (const line of text.split('\n')) {
    // Track groups/subgroups
    const groupMatch = line.match(/^# group: (.+)/);
    if (groupMatch) { currentGroup = groupMatch[1]; continue; }
    const subgroupMatch = line.match(/^# subgroup: (.+)/);
    if (subgroupMatch) { currentSubgroup = subgroupMatch[1]; continue; }

    if (line.startsWith('#') || !line.trim()) continue;

    const mainAndComment = line.split('#');
    const main = mainAndComment[0].trim();
    const comment = (mainAndComment[1] || '').trim();

    const [cpField, status] = main.split(';').map(s => s.trim());
    const seq = parseSequence(cpField);

    // Parse comment: <emoji> E<version> <description>
    const commentMatch = comment.match(/^(.+?)\s+E(\d+\.\d+)\s+(.+)$/);
    const emojiChar = commentMatch ? commentMatch[1] : '';
    const version = commentMatch ? commentMatch[2] : '';
    const description = commentMatch ? commentMatch[3] : comment;

    results.push({
      codepoints: seq,
      string: cpsToStr(seq),
      status,
      group: currentGroup,
      subgroup: currentSubgroup,
      version,
      description,
    });
  }
  return results;
}

/**
 * emoji-variation-sequences.txt — each non-comment line is:
 *   <code-point> <variation-selector> ; <style> # (<version>) <description>
 */
function parseVariationSequences(text) {
  const results = [];
  for (const line of text.split('\n')) {
    const trimmed = line.replace(/#.*/, '').trim();
    if (!trimmed) continue;
    const [seqField, style] = trimmed.split(';').map(s => s.trim());
    const seq = parseSequence(seqField);
    results.push({
      codepoints: seq,
      style: style || '',
      string: cpsToStr(seq),
    });
  }
  return results;
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  // Fetch all data files in parallel
  const [emojiDataText, seqText, zwjText, testText, varText] = await Promise.all([
    fetchText(URLS.emojiData),
    fetchText(URLS.emojiSequences),
    fetchText(URLS.emojiZwjSequences),
    fetchText(URLS.emojiTest),
    fetchText(URLS.emojiVariationSequences),
  ]);

  // Parse
  const emojiProps     = parseEmojiData(emojiDataText);
  const sequences      = parseEmojiSequences(seqText);
  const zwjSequences   = parseEmojiZwjSequences(zwjText);
  const testEntries    = parseEmojiTest(testText);
  const variationSeqs  = parseVariationSequences(varText);

  // ── Build property maps ────────────────────────────────────────────
  const propNames = [
    'Emoji',
    'Emoji_Presentation',
    'Emoji_Modifier_Base',
    'Emoji_Modifier',
    'Emoji_Component',
    'Extended_Pictographic',
  ];

  const emojiProperties = {};
  for (const prop of propNames) {
    const set = emojiProps.get(prop);
    emojiProperties[prop] = set
      ? [...set].sort((a, b) => a - b).map(c => ({
          codepoint: `U+${c.toString(16).toUpperCase().padStart(4, '0')}`,
          string: cpToStr(c),
        }))
      : [];
  }

  // ── Build sequence lists ───────────────────────────────────────────
  const formatSeq = (s) => ({
    codepoints: s.codepoints.map(c => `U+${c.toString(16).toUpperCase().padStart(4, '0')}`),
    string: s.string,
    type: s.type,
    description: s.description,
  });

  const formatZwj = (s) => ({
    codepoints: s.codepoints.map(c => `U+${c.toString(16).toUpperCase().padStart(4, '0')}`),
    string: s.string,
    type: s.type,
    description: s.description,
  });

  const formatTest = (s) => ({
    codepoints: s.codepoints.map(c => `U+${c.toString(16).toUpperCase().padStart(4, '0')}`),
    string: s.string,
    status: s.status,
    group: s.group,
    subgroup: s.subgroup,
    version: s.version,
    description: s.description,
  });

  const formatVar = (s) => ({
    codepoints: s.codepoints.map(c => `U+${c.toString(16).toUpperCase().padStart(4, '0')}`),
    string: s.string,
    style: s.style,
  });

  // ── Assemble output ────────────────────────────────────────────────
  const output = {
    metadata: {
      unicode_version: '17.0',
      emoji_version: '17.0',
      generated_at: new Date().toISOString(),
      sources: Object.values(URLS),
    },

    // Per-property character lists
    emoji_properties: emojiProperties,

    // Emoji sequences (keycap, flag, modifier, etc.)
    emoji_sequences: sequences.map(formatSeq),

    // ZWJ sequences
    emoji_zwj_sequences: zwjSequences.map(formatZwj),

    // Variation sequences (text vs emoji presentation)
    emoji_variation_sequences: variationSeqs.map(formatVar),

    // Full emoji test list (the most comprehensive, includes qualification status)
    emoji_test: testEntries.map(formatTest),

    // Summary statistics
    summary: {
      emoji_characters: emojiProps.get('Emoji')?.size ?? 0,
      emoji_presentation_characters: emojiProps.get('Emoji_Presentation')?.size ?? 0,
      emoji_modifier_base_characters: emojiProps.get('Emoji_Modifier_Base')?.size ?? 0,
      emoji_modifier_characters: emojiProps.get('Emoji_Modifier')?.size ?? 0,
      emoji_component_characters: emojiProps.get('Emoji_Component')?.size ?? 0,
      extended_pictographic_characters: emojiProps.get('Extended_Pictographic')?.size ?? 0,
      emoji_sequences: sequences.length,
      emoji_zwj_sequences: zwjSequences.length,
      emoji_variation_sequences: variationSeqs.length,
      emoji_test_total: testEntries.length,
      emoji_test_fully_qualified: testEntries.filter(e => e.status === 'fully-qualified').length,
      emoji_test_minimally_qualified: testEntries.filter(e => e.status === 'minimally-qualified').length,
      emoji_test_unqualified: testEntries.filter(e => e.status === 'unqualified').length,
      emoji_test_component: testEntries.filter(e => e.status === 'component').length,
    },
  };

  // Write JSON
  const fs = await import('node:fs');
  const path = await import('node:path');
  const outPath = path.join(import.meta.dirname, 'emoji.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');

  console.log(`\nDone! Written to ${outPath}`);
  console.log('\nSummary:');
  for (const [k, v] of Object.entries(output.summary)) {
    console.log(`  ${k}: ${v}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
