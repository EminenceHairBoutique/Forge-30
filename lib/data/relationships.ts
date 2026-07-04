import type { RelationshipMode } from "@/lib/types";

/** Seeded Relationships content (E11): decks, micro-lessons, safety resources. */

export const MODE_LABELS: Record<RelationshipMode, string> = {
  singleDating: "Single / dating",
  relationship: "In a relationship",
  marriedLongTerm: "Married / long-term",
  complicated: "It's complicated",
  familyFocus: "Family focus",
  friendshipFocus: "Friendship focus",
  socialConfidence: "Social confidence",
};

export interface PromptDeck {
  id: string;
  name: string;
  prompts: string[];
}

export const PROMPT_DECKS: PromptDeck[] = [
  { id: "gettingToKnow", name: "Getting to know", prompts: [
    "What's something you loved as a kid that you'd still defend today?",
    "What does a perfect ordinary Tuesday look like for you?",
    "What's a belief you've changed your mind about in the last five years?",
    "Who knows you best, and what would they say about you that would surprise me?",
  ]},
  { id: "emotionalIntimacy", name: "Emotional intimacy", prompts: [
    "When did you last feel really understood by me — what was I doing?",
    "What's something you find hard to ask for?",
    "What's a fear you carry that you rarely say out loud?",
    "What did comfort look like in the house you grew up in?",
  ]},
  { id: "conflictRepair", name: "Conflict repair", prompts: [
    "What helps you come back to a hard conversation — time, touch, words, space?",
    "What's a fight we've had that we never fully closed? One sentence each on what it was really about.",
    "What do I do mid-argument that makes things easier? Harder?",
    "What would a good apology from me actually sound like?",
  ]},
  { id: "values", name: "Values", prompts: [
    "What would you sacrifice a lot of money to protect?",
    "What kind of person are you trying to become in the next ten years?",
    "What did your family value that you've kept? Rejected?",
    "Where do our values pull in different directions — and where has that been useful?",
  ]},
  { id: "money", name: "Money", prompts: [
    "What did money feel like in your house growing up?",
    "What purchase says the most about what you value?",
    "What money conversation are we overdue for?",
    "What does 'enough' look like, concretely, for you?",
  ]},
  { id: "family", name: "Family", prompts: [
    "What family pattern do you most want to keep? Break?",
    "What's one thing your family does that I should understand rather than judge?",
    "Where do you need me to back you up with your family?",
    "What tradition should we start ourselves?",
  ]},
  { id: "intimacy", name: "Intimacy (adults)", prompts: [
    "What makes you feel wanted — not in general, specifically?",
    "What's something you've wanted to try or revisit that we haven't talked about?",
    "When do you feel closest to me physically — and what leads up to it?",
    "What's one thing about our intimacy you'd protect exactly as it is?",
  ]},
  { id: "futurePlanning", name: "Future planning", prompts: [
    "Five years out: what does a Tuesday look like for us?",
    "What's one big thing you want us to have decided within a year?",
    "What worries you about our future that we haven't discussed?",
    "If we could design next year around one shared priority, what would yours be?",
  ]},
  { id: "appreciation", name: "Appreciation", prompts: [
    "What's something I did this month that you never mentioned appreciating?",
    "What quality of mine do you rely on the most?",
    "What's a small ritual of ours you'd miss if it disappeared?",
    "Who in your life deserves a thank-you they haven't gotten? Send it today.",
  ]},
  { id: "apology", name: "Apology", prompts: [
    "What's an apology you still owe — to anyone?",
    "What makes an apology feel real to you versus performed?",
    "What's something you've apologized for but not yet changed?",
    "What would you want to hear from someone who hurt you, even if they'll never say it?",
  ]},
  { id: "boundaries", name: "Boundaries", prompts: [
    "What's a boundary you keep re-explaining instead of enforcing?",
    "Where do you say yes when you mean no — with whom?",
    "What boundary of someone else's do you find hardest to respect?",
    "What would change if you protected your evenings the way you protect meetings?",
  ]},
  { id: "friendshipBuilding", name: "Friendship building", prompts: [
    "Which friendship is running on old fuel — and what would refill it?",
    "Who do you want to know better? What's the next smallest step?",
    "What do you bring to friendships that you're proud of?",
    "Which friend haven't you told what they mean to you? There's your text for today.",
  ]},
  { id: "familyConnection", name: "Family connection", prompts: [
    "What question have you never asked a parent or elder that you'd regret not asking?",
    "What's a difficult topic with family you keep postponing — what's the 10% version of raising it?",
    "What does showing up for family look like for you this month, concretely?",
    "What's one story from your family's past worth writing down before it's lost?",
  ]},
];

export interface MicroLesson {
  id: string;
  title: string;
  minutes: number;
  points: string[];
}

export const MICRO_LESSONS: MicroLesson[] = [
  { id: "activeListening", title: "Active listening", minutes: 3, points: [
    "Listening is not waiting to talk. The test: could you restate their point so well they'd say 'exactly'?",
    "Reflect before you respond: 'So what I'm hearing is…' — then let them correct you.",
    "Two-person exercise: one speaks for 2 minutes uninterrupted, the other summarizes before replying. Swap.",
  ]},
  { id: "repairAttempts", title: "Repair attempts", minutes: 3, points: [
    "A repair attempt is any move that de-escalates mid-conflict: humor, a touch, 'can we start over?'",
    "What predicts lasting relationships isn't fewer fights — it's repair attempts made AND received.",
    "Practice receiving: when someone offers repair mid-argument, accept it out loud even if you're still activated.",
  ]},
  { id: "validation", title: "Validation", minutes: 3, points: [
    "Validation means treating their experience as real — not agreeing with their conclusion.",
    "'That makes sense given how you saw it' costs nothing and changes the temperature of everything after it.",
    "Validate first, problem-solve second. Reversing the order is the most common communication mistake there is.",
  ]},
  { id: "boundaries", title: "Boundaries", minutes: 4, points: [
    "A boundary is what YOU will do, not what they must do: 'I'll leave the room if shouting starts' is enforceable by you alone.",
    "State it once, kindly. Repetition turns a boundary into a negotiation.",
    "Guilt after setting a boundary is normal and passes. Resentment from not setting one compounds.",
  ]},
  { id: "secureCommunication", title: "Secure communication", minutes: 4, points: [
    "Soft startup: complaints that start gently get resolved; those that start with attack rarely do.",
    "Formula that works: 'When X happened, I felt Y, and what I need is Z' — no character verdicts anywhere in it.",
    "Timing is content: the same sentence lands differently at 11 PM mid-stress than on a Saturday walk.",
  ]},
  { id: "apologizing", title: "Apologizing well", minutes: 3, points: [
    "A real apology has three parts: name what you did, name its impact, name what changes. No 'but'.",
    "'I'm sorry you feel that way' is not an apology — it relocates the problem into their feelings.",
    "Repair beats perfection: a mediocre apology today outperforms a perfect one never delivered.",
  ]},
  { id: "hardTopics", title: "Raising hard topics", minutes: 4, points: [
    "Announce the topic before the conversation: 'I want to talk about X this weekend' lets both nervous systems prepare.",
    "One topic per conversation. Bundling grievances guarantees none get resolved.",
    "Aim for the 10% version first: raising a hard thing imperfectly beats holding it perfectly.",
  ]},
  { id: "respectfulDisagreement", title: "Respectful disagreement", minutes: 3, points: [
    "Steelman first: state their position at its strongest before arguing yours.",
    "Separate the person from the position — attack ideas all day, never character.",
    "You can end a disagreement without resolution: 'we see this differently and we're okay' is a real outcome.",
  ]},
  { id: "patternsWithoutBlame", title: "Noticing patterns without blame", minutes: 4, points: [
    "Patterns are made by two people plus circumstances. 'We keep ending up here' opens; 'you always' closes.",
    "Describe the loop, not the villain: 'I push, you withdraw, I push harder' — no one has to be wrong for that to be true.",
    "Name the pattern when calm. Mid-conflict, everyone defends their role in it.",
  ]},
  { id: "communicationDifferences", title: "Communication differences without stereotyping", minutes: 3, points: [
    "People differ in processing speed, directness, and conflict tolerance — as individuals, not as categories.",
    "Ask, don't assume: 'do you want solutions or company right now?' works for everyone of every gender.",
    "Your normal is a preference, not a standard. Their different normal isn't a malfunction.",
  ]},
  { id: "intentionalDating", title: "Intentional dating", minutes: 4, points: [
    "Know your top three values before the first date — attraction is loud, alignment is quiet.",
    "Green flags deserve as much attention as red ones: repair skills, curiosity about you, how they treat waitstaff.",
    "Post-date reflection (two minutes): How did I feel in my body around them? Could I be fully myself?",
  ]},
  { id: "friendshipMaintenance", title: "Friendship maintenance", minutes: 3, points: [
    "Friendships die of scheduling, not conflict. A recurring slot beats good intentions.",
    "Low-pressure outreach counts: a meme, a 'saw this and thought of you' — connection is maintained in small units.",
    "Follow up on what they told you last time. Remembering is love, operationalized.",
  ]},
  { id: "familyBoundaries", title: "Family boundaries", minutes: 4, points: [
    "You can love people and limit your exposure to them. Both can be true at once.",
    "With family, boundaries often need repetition plus consistency across visits — expect the extinction burst.",
    "You're allowed to leave the table, the topic, or the visit. Guilt is not evidence you did something wrong.",
  ]},
];

/** Safety resources — free at every tier, never gated (entitlements invariant). */
export const SAFETY_RESOURCES = [
  {
    name: "National Domestic Violence Hotline (US)",
    detail: "1-800-799-7233 · text START to 88788 · thehotline.org — confidential, 24/7",
  },
  {
    name: "Emergency services",
    detail: "If you are in immediate danger, call your local emergency number (911 in the US).",
  },
  {
    name: "Outside the US",
    detail: "Search \"domestic violence hotline\" plus your country — most countries staff a confidential line.",
  },
  {
    name: "Documentation",
    detail: "The timeline on this page keeps a dated, private record on your device — advocates and lawyers often ask for exactly this.",
  },
] as const;
