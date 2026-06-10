import { ITEM_NAMES, POWDER_BY_MINERAL, REFINED_BY_RAW } from "./items";
import { MINI_RECIPES, WORKBENCH_RECIPES } from "./recipes";
import type { ItemId, Recipe } from "./types";

export interface RecipeGuideEntry {
  id: string;
  name: string;
  stationKey: RecipeGuideStation;
  station: string;
  outputLabel: string;
  ingredientsLabel: string;
  note: string;
  canMake: boolean;
  searchText: string;
}

const STATION_LABELS = {
  mini: "인벤토리 미니 제작대 2x2",
  workbench: "제작대 3x3",
  extendedWorkbench: "확장 제작대 6x6",
  smelter: "제련대 또는 특수 제련대",
  specialSmelter: "특수 제련대",
  grinder: "분쇄기",
} as const;

export type RecipeGuideStation = keyof typeof STATION_LABELS;

function itemName(item: ItemId) {
  return ITEM_NAMES[item] ?? item;
}

function ingredientLabel(ingredients: Record<ItemId, number>) {
  return (Object.entries(ingredients) as [ItemId, number][])
    .map(([item, count]) => `${itemName(item)} ${count}`)
    .join(" + ");
}

function hasIngredients(itemCounts: Record<ItemId, number>, ingredients: Record<ItemId, number>) {
  return (Object.entries(ingredients) as [ItemId, number][]).every(([item, count]) => (itemCounts[item] ?? 0) >= count);
}

function recipeEntry(recipe: Recipe, stationKey: RecipeGuideStation, itemCounts: Record<ItemId, number>): RecipeGuideEntry {
  const ingredientsLabel = ingredientLabel(recipe.ingredients);
  const outputLabel = `${itemName(recipe.output)} ${recipe.count}`;
  const canMake = hasIngredients(itemCounts, recipe.ingredients);
  const station = STATION_LABELS[stationKey];
  return {
    id: `${stationKey}:${recipe.id}`,
    name: recipe.name,
    stationKey,
    station,
    outputLabel,
    ingredientsLabel,
    note: recipe.note,
    canMake,
    searchText: `${recipe.id} ${recipe.name} ${stationKey} ${station} ${recipe.output} ${outputLabel} ${ingredientsLabel} ${recipe.note}`.toLowerCase(),
  };
}

function stationRecipe(
  id: string,
  name: string,
  station: RecipeGuideStation,
  output: ItemId,
  outputCount: number,
  input: ItemId,
  inputCount: number,
  itemCounts: Record<ItemId, number>,
  note: string,
): RecipeGuideEntry {
  const ingredients = { [input]: inputCount } as Record<ItemId, number>;
  return recipeEntry({ id, name, output, count: outputCount, ingredients, note }, station, itemCounts);
}

export function buildRecipeGuideEntries(itemCounts: Record<ItemId, number>) {
  return buildRecipeGuideEntriesForStations(itemCounts);
}

export function buildRecipeGuideEntriesForStations(itemCounts: Record<ItemId, number>, stations?: readonly RecipeGuideStation[]) {
  const allowed = stations ? new Set(stations) : null;
  const include = (station: RecipeGuideStation) => !allowed || allowed.has(station);
  const entries: RecipeGuideEntry[] = [
    ...(include("mini") ? MINI_RECIPES.map((recipe) => recipeEntry(recipe, "mini", itemCounts)) : []),
    ...(WORKBENCH_RECIPES.filter((recipe) => include(recipe.extendedOnly ? "extendedWorkbench" : "workbench")).map((recipe) =>
      recipeEntry(recipe, recipe.extendedOnly ? "extendedWorkbench" : "workbench", itemCounts),
    )),
    ...(include("smelter") ? (Object.entries(REFINED_BY_RAW) as [ItemId, ItemId][]).map(([input, output]) =>
      stationRecipe(
        `smelt_${input}`,
        itemName(output),
        "smelter",
        output,
        1,
        input,
        1,
        itemCounts,
        `${itemName(input)}을 제련해 ${itemName(output)}로 만듭니다.`,
      ),
    ) : []),
    ...(include("specialSmelter") ? [stationRecipe(
      "smelt_obsidian",
      itemName("sharp_obsidian"),
      "specialSmelter",
      "sharp_obsidian",
      1,
      "obsidian",
      1,
      itemCounts,
      "흑요석은 특수 제련대에서만 날카로운 흑요석으로 제련됩니다.",
    )] : []),
    ...(include("grinder") ? (Object.entries(POWDER_BY_MINERAL) as [ItemId, ItemId][]).map(([input, output]) =>
      stationRecipe(
        `grind_${input}`,
        itemName(output),
        "grinder",
        output,
        2,
        input,
        1,
        itemCounts,
        `${itemName(input)}을 가루 2개로 분쇄합니다.`,
      ),
    ) : []),
  ];

  return entries.sort((a, b) => Number(b.canMake) - Number(a.canMake) || a.station.localeCompare(b.station) || a.name.localeCompare(b.name));
}
