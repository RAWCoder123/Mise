import type { SupplierCatalogGroup, SupplierCatalogLine } from "../domain/supplierCatalog";

/**
 * Filters a supplier catalog browse model by item name, SKU, pack label, or
 * supplier name. Empty queries return the input unchanged.
 */
export function filterSupplierCatalogGroups(
  groups: readonly SupplierCatalogGroup[],
  query: string
): SupplierCatalogGroup[] {
  const normalized = query.trim().toLocaleLowerCase("en-US");
  if (!normalized) return [...groups];

  return groups
    .map((group) => {
      const supplierMatch = group.supplierName.toLocaleLowerCase("en-US").includes(normalized);
      const lines = group.lines.filter(
        (line) => supplierMatch || catalogLineMatchesQuery(line, normalized)
      );
      if (lines.length === 0) return null;
      return {
        ...group,
        preferredCount: lines.filter((line) => line.preferred).length,
        lines
      };
    })
    .filter((group): group is SupplierCatalogGroup => group !== null);
}

export function catalogLineMatchesQuery(line: SupplierCatalogLine, normalizedQuery: string) {
  if (!normalizedQuery) return true;
  const haystacks = [
    line.itemName,
    line.unit,
    line.supplierSku ?? "",
    line.packSize ?? "",
    line.supplierName
  ];
  return haystacks.some((value) => value.toLocaleLowerCase("en-US").includes(normalizedQuery));
}
