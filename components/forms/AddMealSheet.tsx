"use client";

import { useEffect, useRef, useState } from "react";
import { Barcode, Camera, Search as SearchIcon, Trash2 } from "lucide-react";
import { useStorage } from "@/lib/storage/provider";
import { QUICK_ADDS } from "@/lib/data/quickAdds";
import { toISODate, uid } from "@/lib/utils";
import { apiUrl, authHeaders } from "@/lib/api";
import type { CachedFood, MealSlot, SavedMeal } from "@/lib/types";
import type { PhotoAnalysis } from "@/app/api/nutrition/photo/route";
import type { FoodSearchResult } from "@/app/api/nutrition/search/route";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Segmented } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type Tab = "photo" | "search" | "custom" | "quick" | "saved";

const LOW_CONFIDENCE = 0.45;
const PHOTO_MAX_PX = 1024;
const THUMB_MAX_PX = 256;

/** Downscale an image file on a canvas; returns a JPEG data URL. */
async function downscale(file: File, maxPx: number, quality: number): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}

interface PhotoItem {
  name: string;
  portion: string;
  calories: string;
  protein: string;
  carbs: string;
  fats: string;
  confidence: number;
}

/**
 * The single meal-logging sheet (v3 Phase 4 order): photo (flagship) →
 * search (Open Food Facts + local recents cache) → custom → quick adds →
 * saved recipes. Photo estimates are always labeled estimates, every line
 * item is editable before saving, and every failure path lands on search or
 * manual — no dead ends.
 */
export function AddMealSheet({
  open,
  onOpenChange,
  defaultSlot = "addon",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSlot?: MealSlot;
}) {
  const { adapter, touch } = useStorage();
  const [tab, setTab] = useState<Tab>("photo");
  const [slot, setSlot] = useState<MealSlot>(defaultSlot);
  const [saved, setSaved] = useState<SavedMeal[]>([]);

  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fats, setFats] = useState("");
  const [saveRecipe, setSaveRecipe] = useState(false);

  // Photo flow state
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [photoState, setPhotoState] = useState<"idle" | "analyzing" | "review" | "error">("idle");
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoItems, setPhotoItems] = useState<PhotoItem[]>([]);
  const [assumptions, setAssumptions] = useState<string[]>([]);
  const [overallConfidence, setOverallConfidence] = useState(1);
  const [thumb, setThumb] = useState<string | null>(null);

  // Search flow state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [recents, setRecents] = useState<CachedFood[]>([]);
  const [searching, setSearching] = useState(false);
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    if (open) {
      setSlot(defaultSlot);
      adapter.listSavedMeals().then(setSaved);
      adapter.listFoodCache().then(setRecents);
      setIsNative(
        (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() === true
      );
    }
  }, [open, defaultSlot, adapter]);

  // Debounced server search; the recents cache filters instantly + offline.
  useEffect(() => {
    if (tab !== "search" || query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(apiUrl(`/api/nutrition/search?q=${encodeURIComponent(query.trim())}`));
        const data = res.ok ? ((await res.json()) as { results: FoodSearchResult[] }) : { results: [] };
        setResults(data.results);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query, tab]);

  const log = async (
    mealName: string,
    macros: { calories: number; protein: number; carbs: number; fats: number },
    opts?: { close?: boolean; photoThumb?: string | null }
  ) => {
    const id = uid();
    await adapter.saveMeal({
      id,
      date: toISODate(),
      slot,
      name: mealName,
      loggedAt: new Date().toISOString(),
      ...macros,
    });
    if (opts?.photoThumb) await adapter.saveMealPhoto(id, opts.photoThumb);
    touch();
    if (opts?.close !== false) onOpenChange(false);
  };

  const submitCustom = async () => {
    if (!name.trim() || !calories) return;
    const macros = {
      calories: Math.max(0, Math.round(Number(calories) || 0)),
      protein: Math.max(0, Number(protein) || 0),
      carbs: Math.max(0, Number(carbs) || 0),
      fats: Math.max(0, Number(fats) || 0),
    };
    if (saveRecipe) {
      await adapter.saveSavedMeal({ id: uid(), name: name.trim(), createdAt: new Date().toISOString(), ...macros });
    }
    await log(name.trim(), macros);
    setName("");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFats("");
    setSaveRecipe(false);
  };

  const deleteSaved = async (id: string) => {
    await adapter.deleteSavedMeal(id);
    setSaved(await adapter.listSavedMeals());
  };

  // --- Photo flow -------------------------------------------------------------------

  const analyzePhoto = async (file: File) => {
    setPhotoState("analyzing");
    setPhotoError(null);
    try {
      const [full, thumbUrl] = await Promise.all([
        downscale(file, PHOTO_MAX_PX, 0.8),
        downscale(file, THUMB_MAX_PX, 0.7),
      ]);
      setThumb(thumbUrl);
      const res = await fetch(apiUrl("/api/nutrition/photo"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ image: full.split(",")[1], mediaType: "image/jpeg" }),
      });
      const data = (await res.json()) as { analysis?: PhotoAnalysis; error?: string; message?: string };
      if (!res.ok || !data.analysis) throw new Error(data.message ?? data.error ?? "Analysis failed.");
      setPhotoItems(
        data.analysis.items.map((i) => ({
          name: i.name,
          portion: i.portionEstimate,
          calories: String(Math.round(i.calories)),
          protein: String(Math.round(i.protein)),
          carbs: String(Math.round(i.carbs)),
          fats: String(Math.round(i.fat)),
          confidence: i.confidence,
        }))
      );
      setAssumptions(data.analysis.assumptions);
      setOverallConfidence(data.analysis.overallConfidence);
      setPhotoState("review");
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Analysis failed.");
      setPhotoState("error");
    }
  };

  const logPhotoItems = async () => {
    let first = true;
    for (const item of photoItems) {
      await log(
        item.name,
        {
          calories: Math.max(0, Math.round(Number(item.calories) || 0)),
          protein: Math.max(0, Number(item.protein) || 0),
          carbs: Math.max(0, Number(item.carbs) || 0),
          fats: Math.max(0, Number(item.fats) || 0),
        },
        { close: false, photoThumb: first ? thumb : null }
      );
      first = false;
    }
    setPhotoState("idle");
    setPhotoItems([]);
    setThumb(null);
    onOpenChange(false);
  };

  // --- Search flow ------------------------------------------------------------------

  const pickFood = async (food: FoodSearchResult | CachedFood) => {
    await adapter.saveFoodCacheItem({
      id: food.id,
      name: food.name,
      brand: food.brand,
      per100g: food.per100g,
      lastUsedAt: new Date().toISOString(),
    });
    // Prefill the custom form with per-100g values — the user adjusts the
    // portion by editing numbers, then logs. Nothing saves until they do.
    setName(`${food.name}${food.brand ? ` (${food.brand})` : ""} — 100 g`);
    setCalories(String(food.per100g.calories));
    setProtein(String(food.per100g.protein));
    setCarbs(String(food.per100g.carbs));
    setFats(String(food.per100g.fats));
    setTab("custom");
  };

  const scanBarcode = async () => {
    try {
      const { scanBarcodeNative } = await import("@/lib/barcode");
      const code = await scanBarcodeNative();
      if (!code) return;
      const res = await fetch(apiUrl(`/api/nutrition/search?barcode=${encodeURIComponent(code)}`));
      const data = res.ok ? ((await res.json()) as { results: FoodSearchResult[] }) : { results: [] };
      if (data.results[0]) await pickFood(data.results[0]);
      else setQuery(code);
    } catch {
      // Scanner unavailable → the search box right here is the fallback.
    }
  };

  const filteredRecents = recents.filter(
    (r) => query.trim().length < 2 || r.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Add meal">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="meal-slot">Log to</Label>
            <Select id="meal-slot" value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)}>
              <option value="meal1">Meal 1</option>
              <option value="meal2">Meal 2</option>
              <option value="addon">Add-on</option>
            </Select>
          </div>

          <Segmented<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: "photo", label: "Photo" },
              { value: "search", label: "Search" },
              { value: "custom", label: "Custom" },
              { value: "quick", label: "Quick" },
              { value: "saved", label: "Saved" },
            ]}
          />

          {tab === "photo" && (
            <div className="flex flex-col gap-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void analyzePhoto(f);
                  e.target.value = "";
                }}
              />
              {photoState === "idle" && (
                <>
                  <Button size="lg" onClick={() => fileRef.current?.click()}>
                    <Camera className="size-5" /> Snap or pick a photo
                  </Button>
                  <p className="text-xs leading-relaxed text-muted">
                    The photo is analyzed once and never stored — only a small thumbnail stays
                    on this device. Every number comes back as an editable estimate.
                  </p>
                </>
              )}
              {photoState === "analyzing" && (
                <div className="flex flex-col gap-2" aria-live="polite">
                  <p className="microlabel text-gold">Analyzing…</p>
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-12 animate-pulse rounded-(--radius-control) bg-elevated" />
                  ))}
                </div>
              )}
              {photoState === "error" && (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-muted">{photoError}</p>
                  <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1" onClick={() => fileRef.current?.click()}>
                      Try another photo
                    </Button>
                    <Button variant="secondary" className="flex-1" onClick={() => setTab("search")}>
                      Search instead
                    </Button>
                  </div>
                </div>
              )}
              {photoState === "review" && (
                <div className="flex flex-col gap-3">
                  {thumb && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="Meal thumbnail" className="h-20 w-20 rounded-(--radius-control) object-cover" />
                  )}
                  <p className="microlabel text-muted">Estimates — edit anything before logging</p>
                  {overallConfidence < LOW_CONFIDENCE && (
                    <p className="rounded-(--radius-control) border border-gold/30 bg-gold/5 px-3 py-2 text-xs leading-relaxed text-ivory">
                      Low confidence on this one — the photo is ambiguous. Search may be more
                      accurate than these numbers.
                    </p>
                  )}
                  {photoItems.map((item, idx) => (
                    <div key={idx} className="flex flex-col gap-2 rounded-(--radius-control) border border-line bg-elevated p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Input
                          aria-label={`Item ${idx + 1} name`}
                          value={item.name}
                          onChange={(e) =>
                            setPhotoItems((xs) => xs.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))
                          }
                        />
                        <button
                          type="button"
                          aria-label={`Remove ${item.name}`}
                          onClick={() => setPhotoItems((xs) => xs.filter((_, i) => i !== idx))}
                          className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted active:text-danger"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                      <p className="text-xs text-muted">
                        {item.portion} · confidence {Math.round(item.confidence * 100)}%
                      </p>
                      <div className="grid grid-cols-4 gap-2">
                        {(["calories", "protein", "carbs", "fats"] as const).map((f) => (
                          <div key={f} className="flex flex-col gap-1">
                            <Label htmlFor={`pi-${idx}-${f}`} className="text-[10px]">
                              {f === "calories" ? "kcal" : `${f[0]?.toUpperCase()}g`}
                            </Label>
                            <Input
                              id={`pi-${idx}-${f}`}
                              type="number"
                              inputMode="numeric"
                              min="0"
                              value={item[f]}
                              onChange={(e) =>
                                setPhotoItems((xs) => xs.map((x, i) => (i === idx ? { ...x, [f]: e.target.value } : x)))
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {assumptions.length > 0 && (
                    <p className="text-xs leading-relaxed text-muted">
                      Assumed: {assumptions.join("; ")}
                    </p>
                  )}
                  <Button size="lg" disabled={photoItems.length === 0} onClick={() => void logPhotoItems()}>
                    Log {photoItems.length} item{photoItems.length === 1 ? "" : "s"} (estimates)
                  </Button>
                </div>
              )}
            </div>
          )}

          {tab === "search" && (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Input
                  aria-label="Search foods"
                  placeholder="Search foods…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {isNative && (
                  <Button variant="secondary" aria-label="Scan barcode" onClick={() => void scanBarcode()}>
                    <Barcode className="size-5" />
                  </Button>
                )}
              </div>
              {filteredRecents.length > 0 && (
                <>
                  <p className="microlabel text-muted">Recent</p>
                  {filteredRecents.slice(0, 5).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => void pickFood(r)}
                      className="flex min-h-11 items-center justify-between gap-3 rounded-(--radius-control) border border-line bg-elevated px-3 py-2 text-left active:border-gold/50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ivory">{r.name}</span>
                        {r.brand && <span className="block text-xs text-muted">{r.brand}</span>}
                      </span>
                      <span className="shrink-0 text-xs text-muted tabular">{r.per100g.calories} kcal/100g</span>
                    </button>
                  ))}
                </>
              )}
              {searching && <p className="text-xs text-muted">Searching…</p>}
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => void pickFood(r)}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-(--radius-control) border border-line bg-elevated px-3 py-2 text-left active:border-gold/50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ivory">{r.name}</span>
                    {r.brand && <span className="block text-xs text-muted">{r.brand}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-muted tabular">
                    {r.per100g.calories} kcal · {r.per100g.protein}g P /100g
                  </span>
                </button>
              ))}
              {!searching && query.trim().length >= 2 && results.length === 0 && filteredRecents.length === 0 && (
                <p className="py-4 text-center text-sm text-muted">
                  Nothing found — the Custom tab logs anything in ten seconds.
                  <SearchIcon className="ml-1 inline size-3.5" />
                </p>
              )}
            </div>
          )}

          {tab === "custom" && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="meal-name">Name</Label>
                <Input
                  id="meal-name"
                  placeholder="e.g. Chicken rice bowl"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="meal-cal">Calories</Label>
                  <Input id="meal-cal" type="number" inputMode="numeric" min="0" value={calories} onChange={(e) => setCalories(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="meal-pro">Protein (g)</Label>
                  <Input id="meal-pro" type="number" inputMode="numeric" min="0" value={protein} onChange={(e) => setProtein(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="meal-carb">Carbs (g)</Label>
                  <Input id="meal-carb" type="number" inputMode="numeric" min="0" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="meal-fat">Fats (g)</Label>
                  <Input id="meal-fat" type="number" inputMode="numeric" min="0" value={fats} onChange={(e) => setFats(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-(--radius-control) border border-line bg-elevated px-3 py-1">
                <span className="text-sm text-ivory">Save as recipe</span>
                <Switch checked={saveRecipe} onCheckedChange={setSaveRecipe} aria-label="Save as recipe" />
              </div>
              <Button size="lg" onClick={submitCustom} disabled={!name.trim() || !calories}>
                Log meal
              </Button>
            </div>
          )}

          {tab === "quick" && (
            <div className="flex flex-col gap-2">
              {QUICK_ADDS.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => log(q.name, q)}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-(--radius-control) border border-line bg-elevated px-3 py-2 text-left active:border-gold/50 lg:hover:border-gold/50"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ivory">{q.name}</span>
                    <span className="block truncate text-xs text-muted">{q.description}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted tabular">
                    {q.calories} kcal · {q.protein}g P
                  </span>
                </button>
              ))}
            </div>
          )}

          {tab === "saved" && (
            <div className="flex flex-col gap-2">
              {saved.length === 0 && (
                <p className="py-6 text-center text-sm text-muted">
                  No saved recipes yet. Log a custom meal with “Save as recipe” on.
                </p>
              )}
              {saved.map((m) => (
                <div
                  key={m.id}
                  className="flex min-h-11 items-center gap-2 rounded-(--radius-control) border border-line bg-elevated px-3 py-2"
                >
                  <button type="button" onClick={() => log(m.name, m)} className="min-w-0 flex-1 text-left">
                    <span className="block text-sm font-semibold text-ivory">{m.name}</span>
                    <span className="block text-xs text-muted tabular">
                      {m.calories} kcal · {m.protein}g P · {m.carbs}g C · {m.fats}g F
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${m.name}`}
                    onClick={() => deleteSaved(m.id)}
                    className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted active:text-danger lg:hover:text-danger"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
