declare namespace NodeJS {
  type Platform = string;
  interface ProcessEnv {
    [key: string]: string | undefined;
  }
}

declare var process: {
  argv: string[];
  env: NodeJS.ProcessEnv;
  execPath: string;
  platform: NodeJS.Platform;
  exitCode?: number;
  stdout: { write: (chunk: string) => unknown; isTTY?: boolean };
  stderr: { write: (chunk: string) => unknown };
};

declare var Buffer: {
  byteLength(str: string, encoding?: string): number;
};

declare module 'node:fs' {
  export function existsSync(p: string): boolean;
  export function statSync(p: string): { isDirectory(): boolean; isFile(): boolean; size: number };
  export function readFileSync(p: string, encoding: 'utf8'): string;
  export function mkdtempSync(prefix: string): string;
  export function copyFileSync(src: string, dest: string): void;
  export function rmSync(p: string, opts?: { recursive?: boolean; force?: boolean }): void;
  const fsDefault: {
    existsSync: typeof existsSync;
    statSync: typeof statSync;
    readFileSync: typeof readFileSync;
    mkdtempSync: typeof mkdtempSync;
    copyFileSync: typeof copyFileSync;
    rmSync: typeof rmSync;
  };
  export default fsDefault;
}

declare module 'node:path' {
  export const delimiter: string;
  export function resolve(...paths: string[]): string;
  export function join(...paths: string[]): string;
  export function dirname(p: string): string;
  export function basename(p: string): string;
  const pathDefault: {
    delimiter: typeof delimiter;
    resolve: typeof resolve;
    join: typeof join;
    dirname: typeof dirname;
    basename: typeof basename;
  };
  export default pathDefault;
}

declare module 'node:os' {
  export function tmpdir(): string;
  const osDefault: { tmpdir: typeof tmpdir };
  export default osDefault;
}

declare module 'node:url' {
  export function fileURLToPath(url: URL | string): string;
}

declare module 'node:child_process' {
  export function execFile(
    file: string,
    args: readonly string[],
    options: {
      cwd?: string;
      shell?: boolean;
      timeout?: number;
      maxBuffer?: number;
      windowsHide?: boolean;
    },
    callback: (err: Error | null, stdout: string, stderr: string) => void,
  ): void;
}

declare module 'node:util' {
  export function promisify<TArgs extends unknown[], TResult>(
    fn: (...args: [...TArgs, (err: Error | null, ...res: TResult[]) => void]) => void,
  ): (...args: TArgs) => Promise<{ stdout: string; stderr: string }>;

  export function parseArgs(config: {
    args?: string[];
    allowPositionals?: boolean;
    options: Record<string, { type: 'string' | 'boolean'; short?: string; default?: string | boolean }>;
  }): {
    values: Record<string, string | boolean | undefined>;
    positionals: string[];
  };
}
