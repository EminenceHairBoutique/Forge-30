"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpenText,
  Download,
  FileSearch,
  HeartHandshake,
  LifeBuoy,
  MessageSquareText,
  Mic,
  NotebookPen,
  Plus,
  Shield,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { useStorage } from "@/lib/storage/provider";
import {
  analyzeThread,
  checkInInsight,
  couplesComparison,
  debriefSupport,
  redactThread,
  type DebriefSupport,
  type ThreadAnalysis,
} from "@/lib/engine/relationshipRules";
import { MICRO_LESSONS, MODE_LABELS, PROMPT_DECKS, SAFETY_RESOURCES } from "@/lib/data/relationships";
import { ASSESSMENT_BANK } from "@/lib/engine/assessments/bank";
import { DISCLAIMERS } from "@/lib/engine/safetyCopy";
import { addDays, toISODate, uid } from "@/lib/utils";
import type {
  AssessmentId,
  AssessmentResult,
  ConflictDebrief,
  IncidentEntry,
  RelationshipCheckIn,
  RelationshipMode,
} from "@/lib/types";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScaleSlider } from "@/components/ui/slider";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { PaywallCard } from "@/components/cards/PaywallCard";
import { AssessmentRunner } from "@/components/assessments/AssessmentRunner";
import { RecordingSheet } from "@/components/recording/RecordingSheet";
import { flagEnabled } from "@/lib/flags";

const EMPTY_DEBRIEF = {
  whatHappened: "",
  whatIFelt: "",
  whatINeeded: "",
  whatTheyMayHaveNeeded: "",
  didWell: "",
  didPoorly: "",
  repairAttempt: "",
  boundaryNeeded: "",
  nextCalmMessage: "",
};

export default function RelationshipsPage() {
  const { adapter, profile, saveProfile, revision, touch } = useStorage();
  const today = toISODate();
  const [checkIns, setCheckIns] = useState<RelationshipCheckIn[]>([]);
  const [incidents, setIncidents] = useState<IncidentEntry[]>([]);
  const [results, setResults] = useState<AssessmentResult[]>([]);

  const [checkInOpen, setCheckInOpen] = useState(false);
  const [deckId, setDeckId] = useState<string | null>(null);
  const [promptIndex, setPromptIndex] = useState(0);
  const [debriefOpen, setDebriefOpen] = useState(false);
  const [debriefDraft, setDebriefDraft] = useState(EMPTY_DEBRIEF);
  const [support, setSupport] = useState<DebriefSupport | null>(null);
  const [threadOpen, setThreadOpen] = useState(false);
  const [recordingOpen, setRecordingOpen] = useState(false);
  const [threadText, setThreadText] = useState("");
  const [redactNames, setRedactNames] = useState("");
  const [analysis, setAnalysis] = useState<ThreadAnalysis | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [couplesId, setCouplesId] = useState<AssessmentId | "">("");
  const [partnerRun, setPartnerRun] = useState<AssessmentId | null>(null);

  const [draft, setDraft] = useState({
    connection: 0,
    communication: 0,
    conflict: false,
    repairAttempt: false,
    appreciationExpressed: false,
    boundaryRespected: true,
    feelingHeard: 0,
    feelingSafe: 0,
    note: "",
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      adapter.listRelationshipCheckIns(addDays(today, -13), today),
      adapter.listIncidents(),
      adapter.listAssessmentResults(),
    ]).then(([c, i, r]) => {
      if (cancelled) return;
      setCheckIns(c);
      setIncidents(i);
      setResults(r);
    });
    return () => {
      cancelled = true;
    };
  }, [adapter, today, revision]);

  const mode: RelationshipMode = profile?.relationshipMode ?? "relationship";
  const insight = useMemo(() => checkInInsight(checkIns.slice(-7)), [checkIns]);
  const escalate = insight.escalateSafety || (analysis?.abuseIndicators ?? false);
  const todayCheckIn = checkIns.find((c) => c.date === today);
  const deck = PROMPT_DECKS.find((d) => d.id === deckId);
  const lesson = MICRO_LESSONS.find((l) => l.id === lessonId);

  // Couples: assessments with a self result; comparison when a partner pass exists.
  const selfResults = useMemo(
    () => results.filter((r) => (r.subject ?? "self") === "self"),
    [results]
  );
  const partnerResults = useMemo(() => results.filter((r) => r.subject === "partner"), [results]);
  const couplesSelf = [...selfResults].reverse().find((r) => r.assessmentId === couplesId);
  const couplesPartner = [...partnerResults].reverse().find((r) => r.assessmentId === couplesId);
  const comparison =
    couplesSelf && couplesPartner ? couplesComparison(couplesSelf, couplesPartner) : null;

  if (!profile) return null;

  const saveCheckIn = async () => {
    await adapter.saveRelationshipCheckIn({
      id: uid(),
      date: today,
      mode,
      ...draft,
      createdAt: new Date().toISOString(),
    });
    touch();
    setCheckInOpen(false);
  };

  const saveDebrief = async () => {
    const entry: ConflictDebrief = {
      id: uid(),
      date: today,
      ...debriefDraft,
      createdAt: new Date().toISOString(),
    };
    await adapter.saveConflictDebrief(entry);
    setSupport(debriefSupport(entry));
  };

  const runAnalysis = () => {
    const names = redactNames.split(",").map((n) => n.trim()).filter(Boolean);
    const redacted = redactThread(threadText, names);
    setThreadText(redacted);
    setAnalysis(analyzeThread(redacted));
  };

  const saveToTimeline = async () => {
    if (!analysis) return;
    await adapter.saveIncident({
      id: uid(),
      date: today,
      title: "Thread analysis",
      tags: analysis.findings.filter((f) => !f.healthy).map((f) => f.label),
      notes: "",
      patternFindings: [...analysis.summaryLines, ...analysis.healthyLines],
      createdAt: new Date().toISOString(),
    });
    touch();
    setThreadOpen(false);
    setAnalysis(null);
    setThreadText("");
  };

  const exportTimeline = () => {
    const lines = incidents.map(
      (i) =>
        `${i.date} — ${i.title}${i.tags.length ? ` [${i.tags.join(", ")}]` : ""}\n${
          i.notes ? `${i.notes}\n` : ""
        }${i.patternFindings.map((p) => `  · ${p}`).join("\n")}\n`
    );
    const blob = new Blob(
      [
        `Forge30 — private relationship timeline\nExported ${new Date().toLocaleString()}\n\n`,
        lines.join("\n"),
      ],
      { type: "text/plain" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `forge30-timeline-${today}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SafetyCard = (
    <Card className={escalate ? "border-danger/60 bg-danger/5" : "border-line"}>
      <CardHeader className="flex-row items-center gap-2">
        <LifeBuoy className={escalate ? "size-4 text-danger" : "size-4 text-gold"} />
        <CardTitle>Safety resources — always here, always free</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {escalate && (
          <p className="text-sm font-semibold text-ivory">
            Something you've logged here matters more than any pattern chart: if there is fear,
            control, threats, or violence in this relationship, the people below are trained for
            exactly that conversation — confidential, judgment-free.
          </p>
        )}
        {SAFETY_RESOURCES.map((r) => (
          <div key={r.name}>
            <p className="text-sm font-semibold text-ivory">{r.name}</p>
            <p className="text-xs text-muted">{r.detail}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-4 pb-4">
      <PageHeader
        title="Relationships"
        subtitle="Connection is a skill. This is the practice room."
        action={
          <Select
            aria-label="Relationship mode"
            value={mode}
            onChange={(e) =>
              void saveProfile({ ...profile, relationshipMode: e.target.value as RelationshipMode })
            }
            className="w-40"
          >
            {(Object.keys(MODE_LABELS) as RelationshipMode[]).map((m) => (
              <option key={m} value={m}>
                {MODE_LABELS[m]}
              </option>
            ))}
          </Select>
        }
      />

      {escalate && SafetyCard}

      {/* Daily check-in */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <HeartHandshake className="size-4 text-gold" /> Daily check-in
          </CardTitle>
          <Button size="sm" onClick={() => setCheckInOpen(true)}>
            {todayCheckIn ? "Update" : "Check in"}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {todayCheckIn ? (
            <p className="text-sm text-muted">
              Today: connection {todayCheckIn.connection}/10 · heard {todayCheckIn.feelingHeard}/10
              {todayCheckIn.conflict ? " · conflict logged" : ""}
              {todayCheckIn.repairAttempt ? " · repair attempted" : ""}
            </p>
          ) : (
            <p className="text-sm text-muted">60 seconds: how connected, how heard, how safe.</p>
          )}
          {insight.lines.map((line) => (
            <p key={line} className="rounded-(--radius-control) bg-elevated px-3 py-2 text-sm text-ivory">
              {line}
            </p>
          ))}
        </CardContent>
      </Card>

      {/* Prompt decks + lessons */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquareText className="size-4 text-gold" /> Prompt decks
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {PROMPT_DECKS.slice(0, 5).map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  setDeckId(d.id);
                  setPromptIndex(0);
                }}
                className="min-h-9 rounded-(--radius-control) px-2 py-1 text-left text-sm text-ivory active:bg-elevated"
              >
                {d.name}
              </button>
            ))}
            <Select
              aria-label="More decks"
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  setDeckId(e.target.value);
                  setPromptIndex(0);
                }
              }}
            >
              <option value="">More decks…</option>
              {PROMPT_DECKS.slice(5).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpenText className="size-4 text-gold" /> Micro-lessons
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {MICRO_LESSONS.slice(0, 5).map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setLessonId(l.id)}
                className="min-h-9 rounded-(--radius-control) px-2 py-1 text-left text-sm text-ivory active:bg-elevated"
              >
                {l.title}
              </button>
            ))}
            <Select
              aria-label="More lessons"
              value=""
              onChange={(e) => e.target.value && setLessonId(e.target.value)}
            >
              <option value="">All lessons…</option>
              {MICRO_LESSONS.slice(5).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* Conflict debrief */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <NotebookPen className="size-4 text-gold" /> Conflict debrief
          </CardTitle>
          <Button size="sm" variant="secondary" onClick={() => setDebriefOpen(true)}>
            Debrief one
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted">
            Walk one conflict through nine questions and get a neutral summary, repair language,
            and a calm-message draft back — built from your own words.
          </p>
        </CardContent>
      </Card>

      {/* Thread analysis + couples — Pro */}
      <PaywallCard
        feature="relationshipTools"
        title="Relationship Clarity tools"
        description="Text-thread pattern analysis with redaction, a dated documentation timeline, and couples comparisons."
      >
        <div className="flex flex-col gap-3">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileSearch className="size-4 text-gold" /> Thread analysis
              </CardTitle>
              <Button size="sm" variant="secondary" onClick={() => setThreadOpen(true)}>
                Analyze a thread
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted">
                Paste a conversation (redacted, on-device). Deterministic pattern heuristics name
                what shows up — the hard patterns and the healthy ones — never a verdict on a
                person.
              </p>
            </CardContent>
          </Card>

          {/* Consensual recording (Phase NEXT C) — dev flag until counsel review */}
          {flagEnabled("consensualRecording") && (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Mic className="size-4 text-gold" /> Record a conversation
                </CardTitle>
                <Button size="sm" variant="secondary" onClick={() => setRecordingOpen(true)}>
                  Open consent flow
                </Button>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted">
                  Consent-first by construction: location sets the consent flow (unknown means
                  everyone consents), agreement is affirmed before the record button exists, and
                  a REC indicator stays visible the whole time. General information, not legal
                  advice.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Shield className="size-4 text-gold" /> Private timeline
              </CardTitle>
              {incidents.length > 0 && (
                <Button size="sm" variant="secondary" onClick={exportTimeline}>
                  <Download className="size-4 text-gold" /> Export
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {incidents.length === 0 ? (
                <p className="text-sm text-muted">
                  A dated, private record of incidents and analyses — on this device only, with a
                  one-tap dated export. Advocates and lawyers often ask for exactly this.
                </p>
              ) : (
                incidents.slice(0, 6).map((i) => (
                  <div key={i.id} className="flex items-start gap-2 rounded-(--radius-control) bg-elevated px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ivory">
                        {i.date} — {i.title}
                      </p>
                      {i.tags.length > 0 && (
                        <p className="text-xs text-muted">{i.tags.join(" · ")}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      aria-label="Delete entry"
                      onClick={async () => {
                        await adapter.deleteIncident(i.id);
                        touch();
                      }}
                      className="flex size-9 items-center justify-center rounded-full text-muted active:text-danger"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))
              )}
              <Button
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={async () => {
                  await adapter.saveIncident({
                    id: uid(),
                    date: today,
                    title: "Note",
                    tags: [],
                    notes: "",
                    patternFindings: [],
                    createdAt: new Date().toISOString(),
                  });
                  touch();
                }}
              >
                <Plus className="size-4" /> Add dated entry
              </Button>
            </CardContent>
          </Card>

          {/* Couples comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-4 text-gold" /> Couples comparison
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <p className="text-sm text-muted">
                Answer separately, then compare: similarities, differences, and discussion
                prompts — never a compatibility verdict.
              </p>
              <Select
                aria-label="Assessment to compare"
                value={couplesId}
                onChange={(e) => setCouplesId(e.target.value as AssessmentId | "")}
              >
                <option value="">Pick an assessment you've taken…</option>
                {ASSESSMENT_BANK.filter((d) =>
                  selfResults.some((r) => r.assessmentId === d.id)
                ).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
              {couplesId && !couplesPartner && (
                <Button variant="secondary" onClick={() => setPartnerRun(couplesId as AssessmentId)}>
                  Hand the phone over — partner pass
                </Button>
              )}
              {comparison && (
                <div className="flex flex-col gap-2">
                  {(
                    [
                      ["Where you're similar", comparison.similarities],
                      ["Differences to understand", comparison.differences],
                      ["Talk about", comparison.discussionPrompts],
                      ["Plan around", comparison.frictionPoints],
                    ] as const
                  )
                    .filter(([, items]) => items.length > 0)
                    .map(([heading, items]) => (
                      <div key={heading}>
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-gold">
                          {heading}
                        </p>
                        <ul className="mt-1 flex flex-col gap-1">
                          {items.map((line) => (
                            <li key={line} className="text-sm leading-relaxed text-ivory">
                              · {line}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </PaywallCard>

      {/* Recording scaffold — WAIT(legal). Placeholder shows only while the
          consensualRecording flag is off; dev builds render the real flow above. */}
      {!flagEnabled("consensualRecording") && (
      <Card className="opacity-70">
        <CardHeader className="flex-row items-center gap-2">
          <Mic className="size-4 text-muted" />
          <CardTitle>Conversation recording — not available</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs leading-relaxed text-muted">
            Recording laws differ by jurisdiction (one-party vs. all-party consent), so this
            ships only after legal review. If you ever record a conversation anywhere, tell the
            other person first — consent isn't just the legal bar, it's the relationship one.
          </p>
        </CardContent>
      </Card>
      )}

      {!escalate && SafetyCard}

      <p className="px-2 pb-2 text-center text-xs leading-relaxed text-muted">
        {DISCLAIMERS.relationships}
      </p>

      {/* Check-in sheet */}
      <Sheet open={checkInOpen} onOpenChange={setCheckInOpen}>
        <SheetContent title="Relationship check-in">
          <div className="flex flex-col gap-4">
            {(
              [
                ["Connection", "connection"],
                ["Communication", "communication"],
                ["Feeling heard", "feelingHeard"],
                ["Feeling safe", "feelingSafe"],
              ] as const
            ).map(([label, key]) => (
              <div key={key} className="flex flex-col gap-1.5">
                <Label>{label}</Label>
                <ScaleSlider
                  label={label}
                  value={draft[key]}
                  onChange={(v: number) => setDraft({ ...draft, [key]: v })}
                />
              </div>
            ))}
            {(
              [
                ["Conflict today", "conflict"],
                ["Repair attempt made", "repairAttempt"],
                ["Appreciation expressed", "appreciationExpressed"],
                ["Boundary respected", "boundaryRespected"],
              ] as const
            ).map(([label, key]) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-(--radius-control) border border-line bg-elevated px-3 py-1"
              >
                <span className="text-sm text-ivory">{label}</span>
                <Switch
                  checked={draft[key]}
                  onCheckedChange={(v) => setDraft({ ...draft, [key]: v })}
                  aria-label={label}
                />
              </div>
            ))}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rc-note">Note (optional)</Label>
              <Input
                id="rc-note"
                placeholder="one line is plenty"
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              />
            </div>
            <Button size="lg" onClick={saveCheckIn}>
              Save check-in
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Prompt deck sheet */}
      <Sheet open={!!deck} onOpenChange={(o) => !o && setDeckId(null)}>
        <SheetContent title={deck?.name ?? "Prompts"}>
          {deck && (
            <div className="flex flex-col gap-4">
              <p className="min-h-24 rounded-(--radius-card) border border-gold/30 bg-gold/5 p-4 text-base leading-relaxed text-ivory">
                {deck.prompts[promptIndex % deck.prompts.length]}
              </p>
              <Button size="lg" onClick={() => setPromptIndex(promptIndex + 1)}>
                <Sparkles className="size-4" /> Next prompt
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Lesson sheet */}
      <Sheet open={!!lesson} onOpenChange={(o) => !o && setLessonId(null)}>
        <SheetContent title={lesson?.title ?? "Lesson"}>
          {lesson && (
            <ul className="flex flex-col gap-3">
              {lesson.points.map((p) => (
                <li key={p} className="rounded-(--radius-control) bg-elevated px-3 py-2.5 text-sm leading-relaxed text-ivory">
                  {p}
                </li>
              ))}
            </ul>
          )}
        </SheetContent>
      </Sheet>

      {/* Debrief sheet */}
      <Sheet
        open={debriefOpen}
        onOpenChange={(o) => {
          setDebriefOpen(o);
          if (!o) {
            setSupport(null);
            setDebriefDraft(EMPTY_DEBRIEF);
          }
        }}
      >
        <SheetContent title="Conflict debrief">
          {!support ? (
            <div className="flex flex-col gap-3">
              {(
                [
                  ["What happened?", "whatHappened"],
                  ["What did I feel?", "whatIFelt"],
                  ["What did I need?", "whatINeeded"],
                  ["What might they have needed?", "whatTheyMayHaveNeeded"],
                  ["What did I do well?", "didWell"],
                  ["What did I do poorly?", "didPoorly"],
                  ["Any repair attempt?", "repairAttempt"],
                  ["Boundary needed?", "boundaryNeeded"],
                  ["Draft of my next calm message", "nextCalmMessage"],
                ] as const
              ).map(([label, key]) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <Label htmlFor={`db-${key}`}>{label}</Label>
                  <Textarea
                    id={`db-${key}`}
                    rows={2}
                    value={debriefDraft[key]}
                    onChange={(e) => setDebriefDraft({ ...debriefDraft, [key]: e.target.value })}
                  />
                </div>
              ))}
              <Button
                size="lg"
                disabled={!debriefDraft.whatHappened.trim()}
                onClick={() => void saveDebrief()}
              >
                Get the debrief
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {(
                [
                  ["Neutral summary", support.summary],
                  ["Repair language", support.repairLanguage],
                  ["Calm message", support.calmMessage],
                  ["Before you send", support.pauseSuggestion],
                  ["Boundary", support.boundarySuggestion],
                ] as const
              ).map(([heading, body]) => (
                <div key={heading} className="rounded-(--radius-control) bg-elevated px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-gold">
                    {heading}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-ivory">{body}</p>
                </div>
              ))}
              {support.patterns.map((p) => (
                <p key={p} className="text-sm leading-relaxed text-muted">
                  {p}
                </p>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {flagEnabled("consensualRecording") && (
        <RecordingSheet open={recordingOpen} onOpenChange={setRecordingOpen} />
      )}

      {/* Thread analysis sheet */}
      <Sheet
        open={threadOpen}
        onOpenChange={(o) => {
          setThreadOpen(o);
          if (!o) setAnalysis(null);
        }}
      >
        <SheetContent title="Thread analysis">
          <div className="flex flex-col gap-4">
            {!analysis ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ta-text">Paste the conversation</Label>
                  <Textarea
                    id="ta-text"
                    rows={8}
                    placeholder={"Them: …\nMe: …"}
                    value={threadText}
                    onChange={(e) => setThreadText(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ta-names">Names to redact (comma-separated)</Label>
                  <Input
                    id="ta-names"
                    placeholder="e.g. Sam, Alex"
                    value={redactNames}
                    onChange={(e) => setRedactNames(e.target.value)}
                  />
                  <p className="text-xs text-muted">
                    Emails, phone numbers, and links are stripped automatically. Everything stays
                    on this device.
                  </p>
                </div>
                <Button size="lg" disabled={!threadText.trim()} onClick={runAnalysis}>
                  Redact & analyze
                </Button>
              </>
            ) : (
              <>
                {analysis.abuseIndicators && (
                  <div className="rounded-(--radius-card) border border-danger/60 bg-danger/10 p-3">
                    <p className="text-sm leading-relaxed text-ivory">
                      This thread contains language that restricts, threatens, or controls.
                      Whatever else is true, that category is worth taking to the confidential
                      resources on this page — they exist for exactly this.
                    </p>
                  </div>
                )}
                {analysis.summaryLines.map((line) => (
                  <p key={line} className="rounded-(--radius-control) bg-elevated px-3 py-2.5 text-sm leading-relaxed text-ivory">
                    {line}
                  </p>
                ))}
                {analysis.healthyLines.length > 0 && (
                  <div className="rounded-(--radius-control) border border-success/30 bg-success/5 px-3 py-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-success">
                      The healthy side
                    </p>
                    {analysis.healthyLines.map((line) => (
                      <p key={line} className="mt-1 text-sm leading-relaxed text-ivory">
                        {line}
                      </p>
                    ))}
                  </div>
                )}
                {analysis.findings.length === 0 && (
                  <p className="text-sm text-muted">
                    No named pattern shows up in this thread — that's a finding too.
                  </p>
                )}
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={saveToTimeline}>
                    Save to timeline
                  </Button>
                  <Button variant="ghost" onClick={() => setAnalysis(null)}>
                    Edit text
                  </Button>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AssessmentRunner
        assessmentId={partnerRun}
        subject="partner"
        open={partnerRun !== null}
        onOpenChange={(o) => !o && setPartnerRun(null)}
        onComplete={(r) => setResults((prev) => [...prev, r])}
      />
    </div>
  );
}
