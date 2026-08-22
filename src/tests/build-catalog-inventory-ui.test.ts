import {describe,expect,it} from "vitest";
import {BUILDABLE_DEFINITIONS} from "../data/buildable-definitions";
import {createBuildCatalogRowMarkup} from "../ui/inventory-panel";

describe("inventory construction tab rows",()=>{
  it("uses one common item-grid row and InventoryItemView surface per buildable",()=>{const rows=Object.values(BUILDABLE_DEFINITIONS).map((definition)=>createBuildCatalogRowMarkup(definition,"/zombie_survival/"));expect(rows).toHaveLength(12);for(const [index,markup] of rows.entries()){const definition=Object.values(BUILDABLE_DEFINITIONS)[index]!;expect(markup.match(/item-grid-row/g)?.length).toBeGreaterThanOrEqual(1);expect(markup).toContain('data-surface="build-catalog"');expect(markup).toContain(`data-buildable-id="${definition.kind}"`);expect(markup).toContain(`alt="${definition.name}"`);expect(markup).toContain(`/zombie_survival/${definition.catalogArt.imagePath}`);expect(markup).toContain(`--grid-w:${definition.catalogArt.widthCells}`);expect(markup).toContain(`--grid-h:${definition.catalogArt.heightCells}`);}});
  it("shows structure and furniture classifications with update-only targets",()=>{const markup=Object.values(BUILDABLE_DEFINITIONS).map((definition)=>createBuildCatalogRowMarkup(definition)).join("");expect(markup).toContain("구조물");expect(markup).toContain("가구");expect(markup.match(/build-catalog-row__costs/g)).toHaveLength(12);expect(markup.match(/data-action="start-build"/g)).toHaveLength(12);});
});
