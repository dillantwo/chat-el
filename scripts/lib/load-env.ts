/**
 * Zero-dependency .env loader for the one-off scripts in this folder.
 *
 * Why not `dotenv`: these scripts used to `import "dotenv/config"`, but dotenv
 * is not a declared dependency of this project — it only happened to be present
 * in node_modules as a transitive dep of `shadcn` (via @dotenvx/dotenvx). That
 * made the scripts work locally by accident and break the moment that chain
 * changes. `dotenv/config` also reads `.env` only, never `.env.local`, so the
 * scripts' own docstrings ("requires MONGODB_URI in environment or .env.local")
 * were wrong.
 *
 * Precedence, highest first:
 *   1. the real environment (never overwritten — this is what Docker injects)
 *   2. .env.local   (local development secrets, gitignored)
 *   3. .env         (what docker compose reads)
 *
 * Inside the `tools` container none of these files exist (.dockerignore excludes
 * .env*) and every variable arrives through the compose `environment` block, so
 * this is a silent no-op there. That is intentional: the loader is a local
 * developer convenience, not part of the deployment path.
 *
 * Run the scripts from the project root. Not because of this file, but because
 * the models they import resolve `@/lib/...` through the `@/*` path alias, and
 * tsx resolves that against the working directory. Both supported entry points
 * already satisfy it: `npm run seed:admin` and `docker compose run --rm tools`
 * (WORKDIR /app).
 */

import fs from "node:fs";
import path from "node:path";

/** Strip matching surrounding quotes, and unescape \n only for double quotes. */
function unquote(raw: string): string {
  const value = raw.trim();

  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];

    if (first === last && (first === '"' || first === "'" || first === "`")) {
      const inner = value.slice(1, -1);
      // Only double quotes get escape processing, matching dotenv's behaviour.
      return first === '"' ? inner.replace(/\\n/g, "\n").replace(/\\r/g, "\r") : inner;
    }
  }

  // Unquoted values: an inline `# comment` is not part of the value.
  const hash = value.indexOf(" #");
  return (hash === -1 ? value : value.slice(0, hash)).trim();
}

function parseAndApply(filePath: string): number {
  if (!fs.existsSync(filePath)) return 0;

  let applied = 0;

  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const withoutExport = line.startsWith("export ") ? line.slice(7).trim() : line;
    const eq = withoutExport.indexOf("=");
    if (eq <= 0) continue;

    const key = withoutExport.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    // The real environment always wins, so Docker-injected values are safe.
    if (process.env[key] !== undefined) continue;

    process.env[key] = unquote(withoutExport.slice(eq + 1));
    applied++;
  }

  return applied;
}

/**
 * Locate the project root by walking up from the working directory looking for
 * package.json.
 *
 * Deliberately not derived from this file's own location: `tsx` runs these
 * scripts as CommonJS (the project has no `"type": "module"`), so
 * `import.meta.dirname` is undefined at runtime even though `module: esnext`
 * lets TypeScript accept it. `__dirname` would work but breaks if the project
 * ever switches to ESM, and it points into node_modules once this is bundled.
 */
function findProjectRoot(): string {
  let dir = process.cwd();

  for (let depth = 0; depth < 10; depth++) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;

    const parent = path.dirname(dir);
    if (parent === dir) break; // reached the filesystem root
    dir = parent;
  }

  return process.cwd();
}

/**
 * Load .env.local then .env from the project root into process.env, without
 * overwriting anything already set. Returns the files that contributed a value.
 */
export function loadEnv(): string[] {
  const root = findProjectRoot();
  const loaded: string[] = [];

  for (const name of [".env.local", ".env"]) {
    if (parseAndApply(path.join(root, name)) > 0) loaded.push(name);
  }

  return loaded;
}

/**
 * Resolve MONGODB_URI after loading the env files, failing loudly when it is
 * missing.
 *
 * The old scripts defaulted to `mongodb://localhost:27017/ai-qef` here. That is
 * the wrong default for a container: a typo'd or unset MONGODB_URI would connect
 * to nothing and report success, instead of telling you the config is broken.
 */
export function requireMongoUri(): string {
  loadEnv();

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error(
      "ERROR: MONGODB_URI is not set.\n" +
        "  - locally: put it in .env.local\n" +
        "  - in Docker: run via the tools profile, which supplies it\n" +
        "      docker compose run --rm tools npx tsx scripts/<script>.ts",
    );
    process.exit(1);
  }

  return uri;
}
