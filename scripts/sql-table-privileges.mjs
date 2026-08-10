import { splitSqlStatements } from "./sql-function-inventory.mjs";

const DML_PRIVILEGES = new Set(["insert", "update", "delete"]);
const TRACKED_PRIVILEGES = new Set(["select", "insert", "update", "delete", "all"]);

function emptyPrivileges() {
  return {
    select: false,
    insert: false,
    update: false,
    updateColumns: new Set(),
    delete: false
  };
}

function clonePrivileges(value = emptyPrivileges()) {
  return {
    select: value.select,
    insert: value.insert,
    update: value.update,
    updateColumns: new Set(value.updateColumns),
    delete: value.delete
  };
}

function ensureTable(tables, table) {
  if (!tables.has(table)) tables.set(table, emptyPrivileges());
  return tables.get(table);
}

function parseRoles(value) {
  return value
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeTableIdentity(value) {
  const normalized = value.replaceAll('"', "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes(".")) {
    const [schema, name] = normalized.split(".");
    return schema === "public" ? name : null;
  }
  return normalized;
}

function parseTableList(value) {
  return value
    .split(",")
    .map((entry) => normalizeTableIdentity(entry))
    .filter(Boolean);
}

function targetsOnlyNonPublicTables(value) {
  const entries = value
    .split(",")
    .map((entry) => entry.replaceAll('"', "").trim().toLowerCase())
    .filter(Boolean);
  if (entries.length === 0) return false;
  return entries.every((entry) => entry.includes(".") && !entry.startsWith("public."));
}

function parsePrivilegeList(value) {
  const privileges = [];
  const pattern = /\b(select|insert|update|delete|all)\b(?:\s*\(([^)]*)\))?/gi;
  for (const match of value.matchAll(pattern)) {
    const privilege = match[1].toLowerCase();
    if (!TRACKED_PRIVILEGES.has(privilege)) continue;
    const columns = (match[2] ?? "")
      .split(",")
      .map((column) => column.replaceAll('"', "").trim().toLowerCase())
      .filter(Boolean);
    privileges.push({ privilege, columns });
  }
  return privileges;
}

function applyGrant(entry, privileges) {
  for (const { privilege, columns } of privileges) {
    if (privilege === "all") {
      entry.select = true;
      entry.insert = true;
      entry.update = true;
      entry.updateColumns.clear();
      entry.delete = true;
      continue;
    }
    if (privilege === "select") {
      entry.select = true;
      continue;
    }
    if (privilege === "insert") {
      entry.insert = true;
      continue;
    }
    if (privilege === "delete") {
      entry.delete = true;
      continue;
    }
    if (privilege === "update") {
      if (columns.length === 0) {
        entry.update = true;
        entry.updateColumns.clear();
      } else {
        for (const column of columns) entry.updateColumns.add(column);
      }
    }
  }
}

function applyRevoke(entry, privileges) {
  for (const { privilege, columns } of privileges) {
    if (privilege === "all") {
      entry.select = false;
      entry.insert = false;
      entry.update = false;
      entry.updateColumns.clear();
      entry.delete = false;
      continue;
    }
    if (privilege === "select") {
      entry.select = false;
      continue;
    }
    if (privilege === "insert") {
      entry.insert = false;
      continue;
    }
    if (privilege === "delete") {
      entry.delete = false;
      continue;
    }
    if (privilege === "update") {
      if (columns.length === 0) {
        entry.update = false;
        entry.updateColumns.clear();
      } else {
        for (const column of columns) entry.updateColumns.delete(column);
      }
    }
  }
}

function clearAuthenticatedPrivileges(tables, tableNames = tables.keys()) {
  for (const table of tableNames) {
    tables.set(table, emptyPrivileges());
  }
}

function stripSqlComments(sql) {
  return sql.replace(/--[^\n]*(?:\n|$)/g, "\n").replace(/\/\*[\s\S]*?\*\//g, " ");
}

function compactSql(sql) {
  return stripSqlComments(sql).replace(/\s+/g, " ").trim();
}

export function hasAuthenticatedTableDml(privileges) {
  return Boolean(
    privileges?.insert ||
      privileges?.update ||
      privileges?.delete ||
      (privileges?.updateColumns?.size ?? 0) > 0
  );
}

export function listAuthenticatedDmlPrivileges(privileges) {
  const granted = [];
  if (privileges.insert) granted.push("INSERT");
  if (privileges.update) granted.push("UPDATE");
  if ((privileges.updateColumns?.size ?? 0) > 0) {
    granted.push(`UPDATE(${[...privileges.updateColumns].sort().join(", ")})`);
  }
  if (privileges.delete) granted.push("DELETE");
  return granted;
}

export function buildFinalAuthenticatedTablePrivileges(sqlDocuments) {
  const tables = new Map();
  const unrecognizedPrivilegeStatements = [];

  for (const document of sqlDocuments) {
    for (const statement of splitSqlStatements(document.sql)) {
      const normalized = compactSql(statement);

      const createTable = normalized.match(
        /^create\s+table(?:\s+if\s+not\s+exists)?\s+((?:"?[a-z_][a-z0-9_]*"?\.)?"?[a-z_][a-z0-9_]*"?)\s*\(/i
      );
      if (createTable) {
        const table = normalizeTableIdentity(createTable[1]);
        if (table) ensureTable(tables, table);
        continue;
      }

      const revokeAllTables = normalized.match(
        /^revoke\s+all\s+on\s+all\s+tables\s+in\s+schema\s+public\s+from\s+([a-z0-9_,\s]+)\s*;$/i
      );
      if (revokeAllTables) {
        if (parseRoles(revokeAllTables[1]).includes("authenticated")) {
          clearAuthenticatedPrivileges(tables);
        }
        continue;
      }

      const grantAllTables = normalized.match(
        /^grant\s+(.+?)\s+on\s+all\s+tables\s+in\s+schema\s+public\s+to\s+([a-z0-9_,\s]+)\s*;$/i
      );
      if (grantAllTables) {
        if (parseRoles(grantAllTables[2]).includes("authenticated")) {
          const privileges = parsePrivilegeList(grantAllTables[1]);
          if (privileges.length === 0) {
            unrecognizedPrivilegeStatements.push({ source: document.path, statement: normalized });
            continue;
          }
          for (const table of tables.keys()) {
            applyGrant(ensureTable(tables, table), privileges);
          }
        }
        continue;
      }

      // Ignore function/schema/sequence/routine privilege DDL; those are inventoried elsewhere.
      if (/\b(?:grant|revoke)\b[\s\S]*\bon\s+(?:function|procedure|routine|schema|sequence|all\s+sequences|all\s+functions)\b/i.test(normalized)) {
        continue;
      }
      if (/\balter\s+default\s+privileges\b/i.test(normalized)) {
        continue;
      }

      const grant = normalized.match(
        /^grant\s+(.+?)\s+on\s+(?:table\s+)?(.+?)\s+to\s+([a-z0-9_,\s]+)\s*;$/i
      );
      if (grant) {
        if (!parseRoles(grant[3]).includes("authenticated")) continue;
        if (targetsOnlyNonPublicTables(grant[2])) continue;
        const tableNames = parseTableList(grant[2]);
        const privileges = parsePrivilegeList(grant[1]);
        if (tableNames.length === 0 || privileges.length === 0) {
          unrecognizedPrivilegeStatements.push({ source: document.path, statement: normalized });
          continue;
        }
        for (const table of tableNames) {
          applyGrant(ensureTable(tables, table), privileges);
        }
        continue;
      }

      const revoke = normalized.match(
        /^revoke\s+(.+?)\s+on\s+(?:table\s+)?(.+?)\s+from\s+([a-z0-9_,\s]+)\s*;$/i
      );
      if (revoke) {
        if (!parseRoles(revoke[3]).includes("authenticated")) continue;
        if (targetsOnlyNonPublicTables(revoke[2])) continue;
        const tableNames = parseTableList(revoke[2]);
        const privileges = parsePrivilegeList(revoke[1]);
        if (tableNames.length === 0 || privileges.length === 0) {
          unrecognizedPrivilegeStatements.push({ source: document.path, statement: normalized });
          continue;
        }
        for (const table of tableNames) {
          applyRevoke(ensureTable(tables, table), privileges);
        }
        continue;
      }

      if (
        /\b(?:grant|revoke)\b/i.test(normalized) &&
        /\bon\s+(?:table\s+)?public\./i.test(normalized) &&
        /\bauthenticated\b/i.test(normalized)
      ) {
        unrecognizedPrivilegeStatements.push({ source: document.path, statement: normalized });
      }
    }
  }

  const snapshot = new Map();
  for (const [table, privileges] of tables.entries()) {
    snapshot.set(table, clonePrivileges(privileges));
  }

  return {
    tables: snapshot,
    unrecognizedPrivilegeStatements
  };
}
