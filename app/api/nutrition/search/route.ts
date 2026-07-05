import { NextResponse } from "next/server";

/**
 * Food search (v3 Phase 4) — Open Food Facts, free and keyless, normalized
 * to the MealEntry macro shape per 100g (the client scales portions). Also
 * resolves a single product by barcode (Capacitor scan path). The client
 * caches picks locally so repeat foods are instant and offline.
 */

export interface FoodSearchResult {
  id: string;
  name: string;
  brand: string;
  /** Macros per 100 g. */
  per100g: { calories: number; protein: number; carbs: number; fats: number };
}

interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  nutriments?: Record<string, number | string>;
}

function normalize(p: OffProduct): FoodSearchResult | null {
  const n = p.nutriments ?? {};
  const kcal = Number(n["energy-kcal_100g"]) || Math.round((Number(n["energy_100g"]) || 0) / 4.184);
  const name = (p.product_name ?? "").trim();
  if (!name || kcal <= 0) return null;
  return {
    id: p.code ?? name,
    name,
    brand: (p.brands ?? "").split(",")[0]?.trim() ?? "",
    per100g: {
      calories: Math.round(kcal),
      protein: Math.round((Number(n["proteins_100g"]) || 0) * 10) / 10,
      carbs: Math.round((Number(n["carbohydrates_100g"]) || 0) * 10) / 10,
      fats: Math.round((Number(n["fat_100g"]) || 0) * 10) / 10,
    },
  };
}

const FIELDS = "code,product_name,brands,nutriments";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const barcode = url.searchParams.get("barcode")?.trim() ?? "";

  try {
    if (barcode) {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}?fields=${FIELDS}`,
        { headers: { "User-Agent": "Forge30/1.0 (personal nutrition logging)" }, next: { revalidate: 3600 } }
      );
      if (!res.ok) return NextResponse.json({ results: [] });
      const data = (await res.json()) as { product?: OffProduct };
      const item = data.product ? normalize(data.product) : null;
      return NextResponse.json({ results: item ? [item] : [] });
    }
    if (q.length < 2) return NextResponse.json({ results: [] });
    const res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=12&fields=${FIELDS}`,
      { headers: { "User-Agent": "Forge30/1.0 (personal nutrition logging)" }, next: { revalidate: 3600 } }
    );
    if (!res.ok) return NextResponse.json({ results: [] });
    const data = (await res.json()) as { products?: OffProduct[] };
    const results = (data.products ?? [])
      .map(normalize)
      .filter((r): r is FoodSearchResult => r !== null)
      .slice(0, 10);
    return NextResponse.json({ results });
  } catch {
    // Network failure → empty results; the client falls back to its local
    // cache and manual entry. No dead ends.
    return NextResponse.json({ results: [] });
  }
}
