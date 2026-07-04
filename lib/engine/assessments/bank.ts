import type { AssessmentDef } from "./defs";

/**
 * Wave 1 question banks (E10): Big Five, values ranking, conflict style,
 * communication style, attachment style. Self-report, deterministic scoring,
 * educational register throughout — styles are patterns, not labels; every
 * band is a legitimate place to be.
 */

const BIG_FIVE: AssessmentDef = {
  id: "bigFive",
  name: "Big Five personality",
  tagline: "The five broad traits research keeps finding — where you sit on each.",
  minutes: 5,
  kind: "likert",
  resultNote:
    "Traits describe tendencies, not limits — every position on every trait has real strengths. This is a self-portrait in five strokes, not a verdict.",
  traits: [
    {
      key: "openness",
      label: "Openness",
      blurb: "appetite for new ideas, experiences, and ways of seeing things",
      high: "You reach for the unfamiliar — new ideas energize you. Watch that novelty doesn't crowd out finishing.",
      low: "You favor the proven and practical — a stabilizing strength. Scheduled novelty keeps things fresh on your terms.",
      balanced: "You mix curiosity with practicality, picking your moments for each.",
    },
    {
      key: "conscientiousness",
      label: "Conscientiousness",
      blurb: "structure, follow-through, and preference for order",
      high: "Plans and follow-through come naturally. The growth edge is flexibility when plans break.",
      low: "You run flexible and spontaneous. External structure — like this app's daily loop — does the organizing so you don't have to.",
      balanced: "You can run structured or loose depending on what the situation needs.",
    },
    {
      key: "extraversion",
      label: "Extraversion",
      blurb: "where your energy comes from — people and stimulation vs. quiet and depth",
      high: "People and activity charge your battery. Build in recovery so the calendar doesn't run you.",
      low: "Depth over breadth: quiet focus and close one-on-ones are where you thrive. That's a feature, not a deficit.",
      balanced: "You draw energy from both company and solitude, in doses.",
    },
    {
      key: "agreeableness",
      label: "Agreeableness",
      blurb: "how naturally you prioritize harmony and others' needs",
      high: "Warmth and cooperation come easily. The practice edge: asking for what you need before resentment does it for you.",
      low: "You're comfortable with friction and directness — useful in negotiation and honest feedback. Softening the delivery costs nothing.",
      balanced: "You cooperate readily and still hold your ground when it matters.",
    },
    {
      key: "neuroticism",
      label: "Emotional reactivity",
      blurb: "how strongly your alarm system responds to stress",
      high: "Your alarm system runs sensitive — you feel things early and strongly. The tools in Mind (breathing, thought records) are built exactly for this.",
      low: "You run steady under pressure. Check in on others' stress signals — they may be louder than yours.",
      balanced: "You feel stress like anyone but usually recover your footing quickly.",
    },
  ],
  questions: [
    { id: "o1", kind: "likert", trait: "openness", text: "I'm drawn to new ideas even when they complicate things." },
    { id: "o2", kind: "likert", trait: "openness", text: "I enjoy art, music, or writing that takes effort to get into." },
    { id: "o3", kind: "likert", trait: "openness", text: "I prefer sticking with ways of doing things that already work.", reverse: true },
    { id: "o4", kind: "likert", trait: "openness", text: "I like playing with hypotheticals and what-ifs." },
    { id: "c1", kind: "likert", trait: "conscientiousness", text: "I finish what I start, even when the novelty wears off." },
    { id: "c2", kind: "likert", trait: "conscientiousness", text: "My spaces and plans tend to be organized." },
    { id: "c3", kind: "likert", trait: "conscientiousness", text: "I often leave things to the last minute.", reverse: true },
    { id: "c4", kind: "likert", trait: "conscientiousness", text: "I keep the promises I make to myself." },
    { id: "att1", kind: "attention", text: "To show you're reading, choose \"Agree\" for this one.", expected: 4 },
    { id: "e1", kind: "likert", trait: "extraversion", text: "Being around people usually gives me energy." },
    { id: "e2", kind: "likert", trait: "extraversion", text: "I speak up easily in groups." },
    { id: "e3", kind: "likert", trait: "extraversion", text: "After a busy social day I need real time alone to recover.", reverse: true },
    { id: "e4", kind: "likert", trait: "extraversion", text: "I'd rather go out than stay in, most nights." },
    { id: "a1", kind: "likert", trait: "agreeableness", text: "I give people the benefit of the doubt." },
    { id: "a2", kind: "likert", trait: "agreeableness", text: "Keeping the peace matters more to me than winning the point." },
    { id: "a3", kind: "likert", trait: "agreeableness", text: "I enjoy a good argument for its own sake.", reverse: true },
    { id: "a4", kind: "likert", trait: "agreeableness", text: "People's feelings weigh heavily in my decisions." },
    { id: "att2", kind: "attention", text: "Attention check: choose \"Strongly disagree\" here.", expected: 1 },
    { id: "n1", kind: "likert", trait: "neuroticism", text: "Small setbacks can throw off my whole day." },
    { id: "n2", kind: "likert", trait: "neuroticism", text: "I replay stressful moments long after they're over." },
    { id: "n3", kind: "likert", trait: "neuroticism", text: "I stay calm when things go wrong.", reverse: true },
    { id: "n4", kind: "likert", trait: "neuroticism", text: "My mood shifts noticeably with stress." },
  ],
};

const VALUES: AssessmentDef = {
  id: "values",
  name: "Values ranking",
  tagline: "Order what actually drives you — decisions get easier when it's explicit.",
  minutes: 3,
  kind: "rank",
  resultNote:
    "There are no right rankings. The value of the exercise is honesty: decisions that fight your top three will always feel heavier than they look.",
  traits: [],
  questions: [],
  rankItems: [
    { key: "health", label: "Health & vitality", blurb: "energy, longevity, physical capability" },
    { key: "family", label: "Family", blurb: "the people you're bound to" },
    { key: "achievement", label: "Achievement", blurb: "mastery, building, being excellent at things" },
    { key: "freedom", label: "Freedom", blurb: "autonomy over your time and choices" },
    { key: "security", label: "Security", blurb: "stability, safety, a floor that holds" },
    { key: "connection", label: "Connection", blurb: "deep friendships and belonging" },
    { key: "growth", label: "Growth", blurb: "learning, stretching, becoming" },
    { key: "adventure", label: "Adventure", blurb: "novelty, risk, aliveness" },
    { key: "service", label: "Service", blurb: "contributing beyond yourself" },
    { key: "wealth", label: "Wealth", blurb: "resources and what they make possible" },
    { key: "creativity", label: "Creativity", blurb: "making things that didn't exist" },
    { key: "peace", label: "Peace of mind", blurb: "calm, simplicity, low drama" },
  ],
};

const CONFLICT: AssessmentDef = {
  id: "conflictStyle",
  name: "Conflict style",
  tagline: "What you actually do when needs collide — five patterns, all situational.",
  minutes: 3,
  kind: "likert",
  resultNote:
    "No style is the correct one — each fits some situations and misfires in others. The skill is noticing your default and choosing on purpose.",
  traits: [
    {
      key: "avoiding",
      label: "Avoiding",
      blurb: "stepping back from conflict until it cools (or compounds)",
      high: "Your default is distance — great for trivial friction, costly when the issue matters and quietly grows.",
      low: "You engage rather than sidestep. Just check that every hill is worth it.",
      balanced: "You pick your battles — engaging some, letting others pass.",
    },
    {
      key: "competing",
      label: "Direct / competing",
      blurb: "pushing hard for your position",
      high: "You advocate hard — invaluable in emergencies and negotiations, expensive with people who need to feel heard first.",
      low: "You rarely force your position. Make sure your needs still get said out loud.",
      balanced: "You can push when it counts without needing to win everything.",
    },
    {
      key: "accommodating",
      label: "Accommodating",
      blurb: "yielding to keep the relationship warm",
      high: "You give ground easily to protect the relationship — generous, and worth auditing for quiet resentment.",
      low: "You don't concede just to smooth things over. Small voluntary yields buy a lot of goodwill.",
      balanced: "You yield when it's cheap and hold when it's dear.",
    },
    {
      key: "compromising",
      label: "Compromising",
      blurb: "splitting the difference to move on",
      high: "You reach for the fair middle quickly — fast and even-handed, though the middle isn't always where the best answer lives.",
      low: "You rarely settle for half-measures — sometimes the split really is the answer.",
      balanced: "You use the 50/50 as a tool, not a reflex.",
    },
    {
      key: "collaborating",
      label: "Collaborating",
      blurb: "digging for the answer that serves both sides fully",
      high: "You dig for the both-win answer — the strongest style when there's time and trust. Not everything deserves the full excavation.",
      low: "You default to faster resolutions. For the relationships that matter most, the slow dig pays.",
      balanced: "You invest in the deep solve when the stakes justify it.",
    },
  ],
  questions: [
    { id: "av1", kind: "likert", trait: "avoiding", text: "I put off hard conversations hoping the issue fades." },
    { id: "av2", kind: "likert", trait: "avoiding", text: "When tension rises, my instinct is to leave the room." },
    { id: "av3", kind: "likert", trait: "avoiding", text: "I raise problems as soon as I notice them.", reverse: true },
    { id: "cp1", kind: "likert", trait: "competing", text: "In a disagreement, I argue my case until it lands." },
    { id: "cp2", kind: "likert", trait: "competing", text: "Backing down feels like losing." },
    { id: "cp3", kind: "likert", trait: "competing", text: "Being right matters less to me than moving forward.", reverse: true },
    { id: "ac1", kind: "likert", trait: "accommodating", text: "I'd rather give in than watch someone I care about get upset." },
    { id: "ac2", kind: "likert", trait: "accommodating", text: "I often say \"it's fine\" when it isn't, to end the tension." },
    { id: "att1", kind: "attention", text: "Attention check: choose \"Neutral\" for this one.", expected: 3 },
    { id: "cm1", kind: "likert", trait: "compromising", text: "Meeting in the middle is my go-to resolution." },
    { id: "cm2", kind: "likert", trait: "compromising", text: "I'll trade something I want so we can both move on." },
    { id: "cl1", kind: "likert", trait: "collaborating", text: "I keep digging until we find an answer that genuinely works for both of us." },
    { id: "cl2", kind: "likert", trait: "collaborating", text: "I ask a lot of questions about what the other person actually needs." },
    { id: "cl3", kind: "likert", trait: "collaborating", text: "Long problem-solving conversations feel like a waste of time.", reverse: true },
  ],
};

const COMMUNICATION: AssessmentDef = {
  id: "communicationStyle",
  name: "Communication style",
  tagline: "How your needs travel from your head to other people.",
  minutes: 3,
  kind: "likert",
  resultNote:
    "Styles are habits, not identities — most people mix all four and shift under stress. Assertive is a skill anyone can build; the Mind tab's boundary tools train exactly that.",
  traits: [
    {
      key: "passive",
      label: "Holding back",
      blurb: "needs stay unspoken to avoid imposing",
      high: "Your needs tend to stay inside. They're still real — unspoken needs usually get invoiced later, with interest.",
      low: "You voice your needs readily.",
      balanced: "You speak up selectively; some needs still stay quieter than they should.",
    },
    {
      key: "aggressive",
      label: "Steamrolling",
      blurb: "needs land hard, sometimes over other people's",
      high: "Your needs arrive at full volume — nothing gets buried, but people may defend instead of listen. Same message, softer entry, better results.",
      low: "You rarely bulldoze.",
      balanced: "Under pressure your delivery sharpens; mostly it stays fair.",
    },
    {
      key: "passiveAggressive",
      label: "Sideways signals",
      blurb: "frustration leaks out indirectly — hints, silence, sarcasm",
      high: "Frustration tends to leak sideways — hints, edges, silence. The direct sentence you're avoiding is almost always cheaper than the leak.",
      low: "When something bothers you, it comes out in words, not signals.",
      balanced: "Occasionally a hint stands in for the sentence; mostly you say it.",
    },
    {
      key: "assertive",
      label: "Direct & fair",
      blurb: "clear needs, stated plainly, with room for the other person",
      high: "You say what you need plainly and leave room for the other person — the style every other style is trying to become.",
      low: "Directness-with-respect is a skill, not a trait — scripts and practice build it fast (see the boundary tool in Mind).",
      balanced: "You're direct and fair much of the time; stress is what knocks it loose.",
    },
  ],
  questions: [
    { id: "p1", kind: "likert", trait: "passive", text: "I keep quiet about what I want if it might inconvenience someone." },
    { id: "p2", kind: "likert", trait: "passive", text: "I say yes to things I don't want to do, often." },
    { id: "p3", kind: "likert", trait: "passive", text: "Asking directly for what I need feels natural.", reverse: true },
    { id: "ag1", kind: "likert", trait: "aggressive", text: "When I'm sure I'm right, I talk over people to make the point land." },
    { id: "ag2", kind: "likert", trait: "aggressive", text: "People have told me my delivery feels harsh." },
    { id: "pa1", kind: "likert", trait: "passiveAggressive", text: "When I'm upset, I go quiet and expect people to notice." },
    { id: "pa2", kind: "likert", trait: "passiveAggressive", text: "Sarcasm does some of my complaining for me." },
    { id: "att1", kind: "attention", text: "Attention check: choose \"Strongly agree\" here.", expected: 5 },
    { id: "as1", kind: "likert", trait: "assertive", text: "I can say no clearly without attacking or apologizing twice." },
    { id: "as2", kind: "likert", trait: "assertive", text: "I state my needs early, before they turn into resentment." },
    { id: "as3", kind: "likert", trait: "assertive", text: "I can disagree with someone and keep it warm." },
  ],
};

const ATTACHMENT: AssessmentDef = {
  id: "attachmentStyle",
  name: "Attachment patterns",
  tagline: "How closeness and distance feel in your important relationships.",
  minutes: 4,
  kind: "likert",
  resultNote:
    "Attachment patterns are learned expectations, not fixed categories or conditions — they shift with experience and secure relationships. High scores describe familiar feelings, never a label on you or anyone else.",
  traits: [
    {
      key: "secure",
      label: "Secure leanings",
      blurb: "closeness and independence both feel workable",
      high: "Closeness and space both feel workable to you — the pattern that makes repair after conflict easiest.",
      low: "Ease with closeness is built, not issued — it grows through steady, repaired relationships at any age.",
      balanced: "You have solid secure footing with some situational wobble — like most people.",
    },
    {
      key: "anxiousLean",
      label: "Reassurance-seeking",
      blurb: "distance reads as danger; closeness calms",
      high: "Distance tends to read as danger before it reads as normal — the pull for reassurance is strong. Naming the need directly usually works better than testing for it.",
      low: "Partner distance doesn't usually set off alarms for you.",
      balanced: "You feel the reassurance pull sometimes, mostly when stressed.",
    },
    {
      key: "avoidantLean",
      label: "Space-keeping",
      blurb: "closeness can feel like pressure; independence calms",
      high: "When things get close, part of you reaches for the exit — independence feels safest. Letting people in by degrees keeps the safety without the distance.",
      low: "Depending on people doesn't feel especially risky to you.",
      balanced: "You value your space but rarely need to bolt.",
    },
    {
      key: "mixedSignals",
      label: "Push-pull",
      blurb: "wanting closeness and fearing it at the same time",
      high: "Closeness can feel like wanting and bracing at the same time — an exhausting combination that often traces to earlier relationships. This pattern especially rewards working with a therapist.",
      low: "Closeness doesn't usually trigger competing signals for you.",
      balanced: "Occasionally close relationships pull you two directions at once.",
    },
  ],
  branchRules: [
    // No close-relationship experience to draw on → skip the partner-specific items.
    { afterId: "scr1", whenLte: 2, skipIds: ["ax2", "av2", "mx2"] },
  ],
  questions: [
    { id: "scr1", kind: "likert", trait: "secure", text: "I have (or have had) a close relationship — romantic or otherwise — that these questions can draw on." },
    { id: "se1", kind: "likert", trait: "secure", text: "I find it easy to depend on people I'm close to." },
    { id: "se2", kind: "likert", trait: "secure", text: "After a fight, I trust the relationship survives it." },
    { id: "se3", kind: "likert", trait: "secure", text: "Letting someone see me struggle feels dangerous.", reverse: true },
    { id: "ax1", kind: "likert", trait: "anxiousLean", text: "When someone close goes quiet, I assume something's wrong between us." },
    { id: "ax2", kind: "likert", trait: "anxiousLean", text: "I've checked a partner's mood repeatedly to feel settled." },
    { id: "att1", kind: "attention", text: "Attention check: choose \"Disagree\" for this one.", expected: 2 },
    { id: "av1", kind: "likert", trait: "avoidantLean", text: "I get uncomfortable when someone wants more closeness than I do." },
    { id: "av2", kind: "likert", trait: "avoidantLean", text: "In relationships I've kept an exit half-planned." },
    { id: "mx1", kind: "likert", trait: "mixedSignals", text: "I want deep closeness and brace against it at the same time." },
    { id: "mx2", kind: "likert", trait: "mixedSignals", text: "I've pulled someone close and pushed them away in the same week." },
  ],
};

export const ASSESSMENT_BANK: AssessmentDef[] = [
  BIG_FIVE,
  VALUES,
  CONFLICT,
  COMMUNICATION,
  ATTACHMENT,
];

export function getAssessmentDef(id: string): AssessmentDef | undefined {
  return ASSESSMENT_BANK.find((d) => d.id === id);
}
