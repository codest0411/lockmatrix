/**
 * Output sanitization utilities to prevent terminal escape injection,
 * GitHub Actions workflow-command injection, and ReDoS on untrusted strings.
 */

/**
 * Strip ANSI escape sequences and control characters in linear O(n) time.
 * Preserves spaces and printable UTF-8 characters; replaces CR/LF/TAB with space
 * when `preserveNewlines` is false.
 *
 * @param {unknown} input
 * @param {{ preserveNewlines?: boolean }} [options]
 * @returns {string}
 */
export function stripControlChars(input, options = {}) {
  const str = typeof input === 'string' ? input : String(input ?? '');
  const preserveNewlines = options.preserveNewlines === true;
  let out = '';
  let i = 0;

  while (i < str.length) {
    const code = str.charCodeAt(i);

    // ESC (0x1B): skip ANSI CSI / OSC / single-char escape sequences
    if (code === 0x1b) {
      const next = str.charCodeAt(i + 1);
      if (next === 0x5b) {
        // CSI: ESC [ ... final byte (0x40..0x7E)
        i += 2;
        while (i < str.length) {
          const c = str.charCodeAt(i);
          i++;
          if (c >= 0x40 && c <= 0x7e) break;
        }
        continue;
      }
      if (next === 0x5d) {
        // OSC: ESC ] ... BEL (0x07) or ST (ESC \)
        i += 2;
        while (i < str.length) {
          const c = str.charCodeAt(i);
          if (c === 0x07) {
            i++;
            break;
          }
          if (c === 0x1b && str.charCodeAt(i + 1) === 0x5c) {
            i += 2;
            break;
          }
          i++;
        }
        continue;
      }
      // Other 2-byte ESC sequence
      i += 2;
      continue;
    }

    // C0 control chars (0x00..0x1F) and DEL/C1 (0x7F..0x9F)
    if ((code >= 0x00 && code <= 0x1f) || (code >= 0x7f && code <= 0x9f)) {
      if (preserveNewlines && (code === 0x0a || code === 0x0d)) {
        out += str[i];
      } else if (code === 0x09 || code === 0x0a || code === 0x0d) {
        out += ' ';
      }
      i++;
      continue;
    }

    out += str[i];
    i++;
  }

  return out;
}

/**
 * Sanitize untrusted text for human/JSON/SARIF display.
 *
 * @param {unknown} input
 * @returns {string}
 */
export function sanitizeText(input) {
  return stripControlChars(input, { preserveNewlines: false });
}

/**
 * Escape a message string for GitHub Actions workflow commands (`::error ...::msg`).
 *
 * @param {unknown} input
 * @returns {string}
 */
export function escapeGitHubMessage(input) {
  const cleaned = stripControlChars(input, { preserveNewlines: true });
  return cleaned
    .replaceAll('%', '%25')
    .replaceAll('\r', '%0D')
    .replaceAll('\n', '%0A')
    .replaceAll('::', '%3A%3A');
}

/**
 * Escape a property value for GitHub Actions workflow commands (`file=...,title=...`).
 *
 * @param {unknown} input
 * @returns {string}
 */
export function escapeGitHubProperty(input) {
  return escapeGitHubMessage(input)
    .replaceAll(':', '%3A')
    .replaceAll(',', '%2C');
}
