import type { AssessmentDef } from "./defs";

/**
 * Coaching Style & Values (v3, §A3 replacement): a short, plainly-disclaimed
 * preferences assessment that tunes how the AI coach talks — tone, structure,
 * pace, and evidence style. Results are communication preferences, never
 * diagnoses and never scores of the person. Non-clinical by construction:
 * every item is about what kind of coaching lands for you.
 */
export const COACHING_STYLE: AssessmentDef = {
  id: "coachingStyle",
  name: "Coaching Style & Values",
  tagline: "Tune how your coach talks to you — tone, structure, pace, evidence.",
  minutes: 3,
  kind: "likert",
  introNote:
    "This tunes your coach, not you. There are no good or bad answers and nothing here is a score of you as a person — it's a set of preference dials the coach reads, changeable any time by retaking.",
  resultNote:
    "These are communication preferences, not traits or diagnoses. The coach uses them to pick its register — every position on every dial gets the same quality of coaching, said differently.",
  traits: [
    {
      key: "directness",
      label: "Directness",
      blurb: "how unvarnished you want feedback delivered",
      high: "Your coach will lead with the plain verdict and skip the cushioning.",
      low: "Your coach will frame feedback with context first, verdict second.",
      balanced: "Your coach will match bluntness to the stakes — direct on the big stuff, softer on the small.",
    },
    {
      key: "structure",
      label: "Structure",
      blurb: "fixed plans versus room to improvise",
      high: "Your coach will hand you concrete checklists and exact next steps.",
      low: "Your coach will set direction and leave the how to you.",
      balanced: "Your coach will give structure where it earns its keep and leave the rest loose.",
    },
    {
      key: "push",
      label: "Push",
      blurb: "how hard you want to be stretched",
      high: "Your coach will set stretch targets and call out headroom when it sees it.",
      low: "Your coach will protect a steady, sustainable pace over stretch goals.",
      balanced: "Your coach will push when momentum is there and back off when the week is heavy.",
    },
    {
      key: "dataOrientation",
      label: "Evidence style",
      blurb: "numbers-first versus story-first explanations",
      high: "Your coach will lead with the numbers and trends behind every suggestion.",
      low: "Your coach will lead with the plain-language why and keep numbers in the background.",
      balanced: "Your coach will mix a headline number with a plain-language why.",
    },
  ],
  questions: [
    { id: "cs1", kind: "likert", trait: "directness", text: "When something isn't working, I want to hear it stated flat out, even if it stings." },
    { id: "cs2", kind: "likert", trait: "directness", text: "Feedback lands better for me when it's cushioned with what's going well first.", reverse: true },
    { id: "cs3", kind: "likert", trait: "directness", text: "I'd rather a coach be too blunt than too careful." },
    { id: "cs4", kind: "likert", trait: "structure", text: "I want an exact plan for tomorrow — specific items, in order." },
    { id: "cs5", kind: "likert", trait: "structure", text: "Detailed plans feel confining — give me the goal and let me find the route.", reverse: true },
    { id: "cs6", kind: "likert", trait: "structure", text: "Checklists genuinely help me finish things." },
    { id: "csa", kind: "attention", text: "To show you're reading, choose Disagree for this one.", expected: 2 },
    { id: "cs7", kind: "likert", trait: "push", text: "I do my best work chasing a target that's slightly out of reach." },
    { id: "cs8", kind: "likert", trait: "push", text: "I'd rather protect a pace I can hold for months than sprint and crash.", reverse: true },
    { id: "cs9", kind: "likert", trait: "push", text: "When I have headroom, I want my coach to say so and raise the bar." },
    { id: "cs10", kind: "likert", trait: "dataOrientation", text: "Show me the trend line — numbers persuade me more than pep talks." },
    { id: "cs11", kind: "likert", trait: "dataOrientation", text: "Too many numbers make advice feel colder and less useful to me.", reverse: true },
    { id: "cs12", kind: "likert", trait: "dataOrientation", text: "I want the data behind a suggestion before I change anything." },
  ],
};
