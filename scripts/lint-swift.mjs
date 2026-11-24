import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const TARGET_DIR = join(ROOT, "swift/Sources");
const IGNORED_DIRS = new Set([".build", "node_modules", ".git", "DerivedData"]);

function collectSwiftFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...collectSwiftFiles(full));
    } else if (entry.endsWith(".swift")) {
      results.push(full);
    }
  }
  return results;
}

function stripCommentsAndStrings(source) {
  let out = "";
  let i = 0;
  const n = source.length;
  while (i < n) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === "/" && next === "/") {
      out += "  ";
      i += 2;
      while (i < n && source[i] !== "\n") {
        out += " ";
        i++;
      }
      continue;
    }
    if (ch === "/" && next === "*") {
      let depth = 1;
      out += "  ";
      i += 2;
      while (i < n && depth > 0) {
        if (source[i] === "/" && source[i + 1] === "*") {
          depth++;
          out += "  ";
          i += 2;
        } else if (source[i] === "*" && source[i + 1] === "/") {
          depth--;
          out += "  ";
          i += 2;
        } else {
          out += source[i] === "\n" ? "\n" : " ";
          i++;
        }
      }
      continue;
    }
    if (ch === '"' && source[i + 1] === '"' && source[i + 2] === '"') {
      out += "   ";
      i += 3;
      while (i < n) {
        if (source[i] === "\\" && i + 1 < n) {
          out += source[i + 1] === "\n" ? " \n" : "  ";
          i += 2;
          continue;
        }
        if (source[i] === '"' && source[i + 1] === '"' && source[i + 2] === '"') {
          out += "   ";
          i += 3;
          break;
        }
        out += source[i] === "\n" ? "\n" : " ";
        i++;
      }
      continue;
    }
    if (ch === '"') {
      out += " ";
      i++;
      while (i < n && source[i] !== "\n") {
        if (source[i] === "\\" && i + 1 < n) {
          out += "  ";
          i += 2;
          continue;
        }
        if (source[i] === '"') {
          out += " ";
          i++;
          break;
        }
        out += " ";
        i++;
      }
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

export function lintSwiftSource(source, relPath) {
  const errors = [];
  const lines = stripCommentsAndStrings(source).split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (/:\s*PreviewProvider\b/.test(lines[i])) {
      errors.push(`${relPath}:${i + 1}: Use #Preview instead of legacy PreviewProvider.`);
    }
  }

  // .constant(...) is only banned inside #Preview blocks; track the block's braces.
  let inPreviewHeader = false;
  let parenDepth = 0;
  let inPreviewBody = false;
  let braceDepth = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let previewOnLine = inPreviewBody;
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (!inPreviewBody && !inPreviewHeader) {
        if (line.startsWith("#Preview", j) && !/\w/.test(line[j + 8] ?? "")) {
          inPreviewHeader = true;
          parenDepth = 0;
          j += 7;
        }
      } else if (inPreviewHeader) {
        if (ch === "(") parenDepth++;
        else if (ch === ")" && parenDepth > 0) parenDepth--;
        else if (ch === "{" && parenDepth === 0) {
          inPreviewHeader = false;
          inPreviewBody = true;
          previewOnLine = true;
          braceDepth = 1;
        }
      } else if (ch === "{") braceDepth++;
      else if (ch === "}" && --braceDepth === 0) inPreviewBody = false;
    }
    if (previewOnLine && /(\bBinding)?\.constant\s*\(/.test(line)) {
      errors.push(`${relPath}:${i + 1}: Use @Previewable with @State/@Bindable instead of .constant(...) inside #Preview.`);
    }
  }
  return errors;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;

if (isMain) {
  const files = collectSwiftFiles(TARGET_DIR);
  const allErrors = [];
  for (const file of files) {
    const relPath = relative(ROOT, file).replace(/\\/g, "/");
    allErrors.push(...lintSwiftSource(readFileSync(file, "utf8"), relPath));
  }
  if (allErrors.length > 0) {
    for (const err of allErrors) console.error(err);
    process.exit(1);
  }
  console.log(`lint-swift: ${files.length} Swift files checked, no issues.`);
}
