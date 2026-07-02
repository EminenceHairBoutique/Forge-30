"use client";

import { useEffect, useRef, useState } from "react";
import { useStorage } from "@/lib/storage/provider";
import { toISODate, uid } from "@/lib/utils";
import type { SpendingCategory } from "@/lib/types";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const CATEGORIES: { value: SpendingCategory; label: string }[] = [
  { value: "food", label: "Food" },
  { value: "bills", label: "Bills" },
  { value: "transport", label: "Transport" },
  { value: "business", label: "Business" },
  { value: "health", label: "Health" },
  { value: "entertainment", label: "Entertainment" },
  { value: "shopping", label: "Shopping" },
  { value: "subscriptions", label: "Subscriptions" },
  { value: "debt", label: "Debt" },
  { value: "other", label: "Other" },
];

/**
 * The <30-second spending log: one screen, big number-pad amount input,
 * three toggles, save. Everything else is optional.
 */
export function SpendLogSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { adapter, touch } = useStorage();
  const amountRef = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<SpendingCategory>("food");
  const [necessary, setNecessary] = useState(true);
  const [business, setBusiness] = useState(false);
  const [stressPurchase, setStressPurchase] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setAmount("");
      setNote("");
      setNecessary(true);
      setBusiness(false);
      setStressPurchase(false);
      // Focus after the sheet's open animation so the keypad pops immediately.
      setTimeout(() => amountRef.current?.focus(), 150);
    }
  }, [open]);

  const save = async () => {
    const value = Number(amount);
    if (!value || value <= 0) return;
    await adapter.saveSpending({
      id: uid(),
      date: toISODate(),
      amount: Math.round(value * 100) / 100,
      category,
      necessary,
      business,
      stressPurchase,
      note: note.trim(),
      loggedAt: new Date().toISOString(),
    });
    touch();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Log spending">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="display-num text-4xl text-muted">$</span>
            <Input
              ref={amountRef}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0.00"
              aria-label="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="display-num h-16 border-gold/40 !text-4xl"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sp-cat">Category</Label>
            <Select
              id="sp-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value as SpendingCategory)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1 rounded-(--radius-control) border border-line bg-elevated px-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-ivory">Necessary</span>
              <Switch checked={necessary} onCheckedChange={setNecessary} aria-label="Necessary" />
            </div>
            <div className="flex items-center justify-between border-t border-line">
              <span className="text-sm text-ivory">Business</span>
              <Switch checked={business} onCheckedChange={setBusiness} aria-label="Business" />
            </div>
            <div className="flex items-center justify-between border-t border-line">
              <span className="text-sm text-ivory">Stress purchase</span>
              <Switch
                checked={stressPurchase}
                onCheckedChange={setStressPurchase}
                aria-label="Stress purchase"
              />
            </div>
          </div>
          <Input
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button size="lg" onClick={save} disabled={!Number(amount)}>
            Save
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
