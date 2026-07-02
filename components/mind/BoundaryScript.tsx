"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

/**
 * Template-based boundary script generator (no AI required): a calm,
 * fill-in-the-blanks structure for a hard conversation.
 */

const SITUATIONS = [
  { id: "interrupts", label: "Someone keeps crossing a line", behavior: "that happens" },
  { id: "money", label: "Someone pressures me about money", behavior: "I'm pressured about money" },
  { id: "time", label: "Someone demands my time last-minute", behavior: "plans land on me last-minute" },
  { id: "criticism", label: "Someone criticizes me in front of others", behavior: "that happens in front of people" },
  { id: "custom", label: "Something else…", behavior: "" },
] as const;

const NEEDS = [
  "space to respond when I'm calm",
  "a conversation at a planned time instead",
  "to be asked, not told",
  "this to stay between us",
  "to not discuss this today",
];

export function BoundaryScript() {
  const [situation, setSituation] = useState<string>(SITUATIONS[0].id);
  const [customBehavior, setCustomBehavior] = useState("");
  const [need, setNeed] = useState<string>(NEEDS[0]!);
  const [copied, setCopied] = useState(false);

  const chosen = SITUATIONS.find((s) => s.id === situation) ?? SITUATIONS[0];
  const behavior = situation === "custom" ? customBehavior || "that happens" : chosen.behavior;

  const script = `When ${behavior}, I shut down instead of showing up well. I need ${need}. I'm telling you because the relationship matters to me — if it keeps happening, I'll step away from the conversation and come back when we can do it differently.`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — the text is still selectable on screen.
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bs-situation">Situation</Label>
        <Select id="bs-situation" value={situation} onChange={(e) => setSituation(e.target.value)}>
          {SITUATIONS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>
      {situation === "custom" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bs-behavior">When…</Label>
          <Input
            id="bs-behavior"
            placeholder="describe the behavior"
            value={customBehavior}
            onChange={(e) => setCustomBehavior(e.target.value)}
          />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bs-need">What I need</Label>
        <Select id="bs-need" value={need} onChange={(e) => setNeed(e.target.value)}>
          {NEEDS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
      </div>
      <div className="rounded-(--radius-control) border border-gold/30 bg-gold/5 p-3">
        <p className="text-sm leading-relaxed text-ivory">{script}</p>
      </div>
      <Button variant="secondary" onClick={copy}>
        <Copy className="size-4" /> {copied ? "Copied" : "Copy script"}
      </Button>
    </div>
  );
}
