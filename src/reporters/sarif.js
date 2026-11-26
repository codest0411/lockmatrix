import path from 'node:path';
import { sanitizeText } from '../sanitize.js';

/** @typedef {import('../index.js').AuditReport} AuditReport */

const SARIF_RULES = [
  {
    id: 'LM001',
    name: 'MissingOptionalDependency',
    shortDescription: { text: 'Declared optional dependency is missing from lockfile' },
    defaultConfiguration: { level: 'error' },
  },
  {
    id: 'LM002',
    name: 'UncoveredTargetPlatform',
    shortDescription: { text: 'Platform-variant group does not cover a requested target platform' },
    defaultConfiguration: { level: 'error' },
  },
  {
    id: 'LM003',
    name: 'SinglePlatformLockfile',
    shortDescription: { text: 'All platform-specific entries cover only a single OS/CPU pair' },
    defaultConfiguration: { level: 'warning' },
  },
  {
    id: 'LM004',
    name: 'PlatformCoverageMatrix',
    shortDescription: { text: 'Platform coverage matrix summary' },
    defaultConfiguration: { level: 'note' },
  },
];

/**
 * @param {'error' | 'warn' | 'info'} severity
 * @returns {'error' | 'warning' | 'note'}
 */
function toSarifLevel(severity) {
  if (severity === 'error') return 'error';
  if (severity === 'warn') return 'warning';
  return 'note';
}

/**
 * Format an audit report as SARIF v2.1.0 JSON.
 *
 * @param {AuditReport} report
 * @returns {string}
 */
export function formatSarif(report) {
  const artifactUri = sanitizeText(path.basename(report.lockfilePath) || 'package-lock.json');

  const sarif = {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'lockmatrix',
            version: report.toolVersion,
            informationUri: 'https://github.com/chirag127/lockmatrix',
            rules: SARIF_RULES,
          },
        },
        results: report.findings.map((f) => ({
          ruleId: sanitizeText(f.ruleId),
          level: toSarifLevel(f.severity),
          message: {
            text: sanitizeText(f.message),
          },
          locations: [
            {
              physicalLocation: {
                artifactLocation: {
                  uri: artifactUri,
                },
                region: {
                  startLine: 1,
                },
              },
            },
          ],
          properties: {
            packageName: sanitizeText(f.packageName),
            packagePath: sanitizeText(f.packagePath),
          },
        })),
      },
    ],
  };

  return JSON.stringify(sarif, null, 2) + '\n';
}
