"use client";

import { useEffect, useState } from "react";
import { useStorage } from "@/lib/storage/provider";
import { toISODate, uid } from "@/lib/utils";
import type { SundayReview } from "@/lib/types";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MONEY_FIELDS: { key: keyof SundayReview; label: string }[] = [
  { key: "incomeExpected", label: "Income expected this week ($)" },
  { key: "billsDue", label: "Bills due ($)" },
  { key: "foodBudget", label: "Food budget ($)" },
  { key: "debtPayment", label: "Debt payment ($)" },
  { key: "businessBudget", label: "Business budget ($)" },
  { key: "emergencyBuffer", label: "Emergency buffer ($)" },
];

/** Sunday budget review: set the week up before the week spends you. */
export function SundayReviewSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { adapter, profile, touch, saveProfile } = useStorage();
  const today = toISODate();
  const [draft, setDraft] = useState<SundayReview>({
    id: uid(),
    date: today,
    incomeExpected: 0,
    billsDue: 0,
    foodBudget: 0,
    debtPayment: 0,
    businessBudget: 0,
    emergencyBuffer: 0,
    thingToCut: "",
    thingToSell: "",
    tomorrowLimit: profile?.dailySpendingLimit ?? 50,
  });

  useEffect(() => {
    if (!open) return;
    adapter.getSundayReview(today).then((r) => {
      if (r) setDraft(r);
      else if (profile) setDraft((d) => ({ ...d, tomorrowLimit: profile.dailySpendingLimit }));
    });
  }, [open, adapter, today, profile]);

  const setNum = (key: keyof SundayReview, v: string) =>
    setDraft({ ...draft, [key]: Math.max(0, Number(v) || 0) });

  const save = async () => {
    await adapter.saveSundayReview({ ...draft, date: today });
    // Tomorrow's limit becomes the live daily spending limit.
    if (profile && draft.tomorrowLimit !== profile.dailySpendingLimit) {
      await saveProfile({ ...profile, dailySpendingLimit: draft.tomorrowLimit });
    }
    touch();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Sunday budget review">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            {MONEY_FIELDS.map(({ key, label }) => (
              <div key={key} className="flex flex-col gap-1.5">
                <Label htmlFor={`sr-${key}`}>{label}</Label>
                <Input
                  id={`sr-${key}`}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={(draft[key] as number) || ""}
                  placeholder="0"
                  onChange={(e) => setNum(key, e.target.value)}
                />
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sr-cut">One thing to cut this week</Label>
            <Input
              id="sr-cut"
              placeholder="a subscription, a habit, a category"
              value={draft.thingToCut}
              onChange={(e) => setDraft({ ...draft, thingToCut: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sr-sell">One thing to sell / liquidate</Label>
            <Input
              id="sr-sell"
              placeholder="something sitting unused"
              value={draft.thingToSell}
              onChange={(e) => setDraft({ ...draft, thingToSell: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sr-limit">Daily spending limit going forward ($)</Label>
            <Input
              id="sr-limit"
              type="number"
              inputMode="decimal"
              min="0"
              value={draft.tomorrowLimit || ""}
              onChange={(e) => setNum("tomorrowLimit", e.target.value)}
            />
          </div>
          <Button size="lg" onClick={save}>
            Save review
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
