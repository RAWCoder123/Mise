export function splitSqlStatements(sql) {
  const statements = [];
  let current = "";
  let singleQuoted = false;
  let doubleQuoted = false;
  let lineComment = false;
  let blockCommentDepth = 0;
  let dollarTag = null;

  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    const next = sql[index + 1];
    current += character;

    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (blockCommentDepth > 0) {
      if (character === "/" && next === "*") {
        current += next;
        blockCommentDepth += 1;
        index += 1;
      } else if (character === "*" && next === "/") {
        current += next;
        blockCommentDepth -= 1;
        index += 1;
      }
      continue;
    }
    if (dollarTag) {
      if (sql.startsWith(dollarTag, index)) {
        current += dollarTag.slice(1);
        index += dollarTag.length - 1;
        dollarTag = null;
      }
      continue;
    }
    if (singleQuoted) {
      if (character === "'" && next === "'") {
        current += next;
        index += 1;
      } else if (character === "'") {
        singleQuoted = false;
      }
      continue;
    }
    if (doubleQuoted) {
      if (character === '"' && next === '"') {
        current += next;
        index += 1;
      } else if (character === '"') {
        doubleQuoted = false;
      }
      continue;
    }

    if (character === "-" && next === "-") {
      current += next;
      lineComment = true;
      index += 1;
    } else if (character === "/" && next === "*") {
      current += next;
      blockCommentDepth = 1;
      index += 1;
    } else if (character === "'") {
      singleQuoted = true;
    } else if (character === '"') {
      doubleQuoted = true;
    } else if (character === "$") {
      const tag = sql.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/)?.[0];
      if (tag) {
        current += tag.slice(1);
        index += tag.length - 1;
        dollarTag = tag;
      }
    } else if (character === ";") {
      if (stripSqlComments(current).trim()) statements.push(current.trim());
      current = "";
    }
  }

  if (stripSqlComments(current).trim()) statements.push(current.trim());
  return statements;
}

export function buildFinalFunctionInventory(sqlDocuments) {
  const functions = new Map();
  const unrecognizedPrivilegedStatements = [];

  for (const document of sqlDocuments) {
    for (const statement of splitSqlStatements(document.sql)) {
      const normalized = stripSqlComments(statement).trim();
      const create = normalized.match(/^create\s+(?:or\s+replace\s+)?function\s+((?:"?[a-z_][a-z0-9_]*"?\.)?"?[a-z_][a-z0-9_]*"?)\s*\(/i);
      const alter = normalized.match(/^alter\s+function\s+((?:"?[a-z_][a-z0-9_]*"?\.)?"?[a-z_][a-z0-9_]*"?)\s*\([\s\S]*?\)\s+security\s+(definer|invoker)\s*;/i);
      const drop = normalized.match(/^drop\s+function(?:\s+if\s+exists)?\s+((?:"?[a-z_][a-z0-9_]*"?\.)?"?[a-z_][a-z0-9_]*"?)\s*\(/i);
      const grant = normalized.match(/^grant\s+execute\s+on\s+function\s+((?:"?[a-z_][a-z0-9_]*"?\.)?"?[a-z_][a-z0-9_]*"?)\s*\([\s\S]*?\)\s+to\s+([a-z0-9_,\s]+)\s*;/i);
      const revoke = normalized.match(/^revoke\s+(?:all|execute)\s+on\s+function\s+((?:"?[a-z_][a-z0-9_]*"?\.)?"?[a-z_][a-z0-9_]*"?)\s*\([\s\S]*?\)\s+from\s+([a-z0-9_,\s]+)\s*;/i);

      if (create) {
        const identity = normalizeIdentity(create[1]);
        const existing = functions.get(identity);
        functions.set(identity, {
          identity,
          schema: identity.includes(".") ? identity.split(".")[0] : "public",
          name: identity.split(".").at(-1),
          securityMode: /\bsecurity\s+definer\b/i.test(normalized) ? "definer" : "invoker",
          hasEmptySearchPath: /\bset\s+search_path\s*=\s*''/i.test(normalized),
          definition: normalized,
          source: document.path,
          executeRoles: existing?.executeRoles ?? new Set(["public"])
        });
        continue;
      }
      if (alter) {
        const identity = normalizeIdentity(alter[1]);
        const entry = functions.get(identity);
        if (entry) entry.securityMode = alter[2].toLowerCase();
        else if (/security\s+definer/i.test(normalized)) unrecognizedPrivilegedStatements.push({ source: document.path, statement: normalized });
        continue;
      }
      if (drop) {
        functions.delete(normalizeIdentity(drop[1]));
        continue;
      }
      if (grant) {
        const entry = functions.get(normalizeIdentity(grant[1]));
        if (entry) for (const role of parseRoles(grant[2])) entry.executeRoles.add(role);
        continue;
      }
      if (revoke) {
        const entry = functions.get(normalizeIdentity(revoke[1]));
        if (entry) for (const role of parseRoles(revoke[2])) entry.executeRoles.delete(role);
        continue;
      }
      if (/\bsecurity\s+definer\b/i.test(normalized)) {
        unrecognizedPrivilegedStatements.push({ source: document.path, statement: normalized });
      }
    }
  }

  return { functions, unrecognizedPrivilegedStatements };
}

function parseRoles(value) {
  return value.split(",").map((role) => role.trim().toLowerCase()).filter(Boolean);
}

function normalizeIdentity(value) {
  const normalized = value.replaceAll('"', "").toLowerCase();
  return normalized.includes(".") ? normalized : `public.${normalized}`;
}

function stripSqlComments(sql) {
  return sql.replace(/--[^\n]*(?:\n|$)/g, "\n").replace(/\/\*[\s\S]*?\*\//g, " ");
}
