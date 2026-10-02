// The emotion wheel, carried over from Mindful · Emotion Quest (grimnetwork.srvp.ro):
// 8 core emotions ("worlds") → 3 families ("zones") each → 2 specific feelings each.
// Colors are a CVD-validated categorical palette (light, dark) — see README.

export type Valence = 'pleasant' | 'unpleasant';

export interface EmotionDef {
  id: string;          // 'joy', 'joy/excitement', 'joy/excitement/playful'
  name: string;
  def: string;
  depth: 0 | 1 | 2;
  core: string;        // id of the core emotion
  parent: string | null;
}

export interface CoreDef extends EmotionDef {
  valence: Valence;
  color: [string, string];
  sprite: string[];    // 8x8 pixel art, 'X' = filled
  families: FamilyDef[];
}
export interface FamilyDef extends EmotionDef { feelings: EmotionDef[] }

type Raw = [string, string, Valence, [string, string, [string, string][]][]];

const RAW: Raw[] = [
  ["Love / Connection", "Warmth, care, and a sense of meaningful connection with others.", 'pleasant', [
    ["Affection", "Warm fondness and care directed toward someone.", [
      ["Loving", "Feeling deep care and affection for someone."],
      ["Tender", "Feeling gentle warmth toward someone's vulnerability."],
    ]],
    ["Belonging", "Feeling that you have a place among people who welcome you.", [
      ["Connected", "Feeling a meaningful bond with another person or group."],
      ["Accepted", "Feeling welcomed as you are."],
    ]],
    ["Trust", "Feeling able to rely on someone's care, honesty, or support.", [
      ["Cared for", "Feeling that someone is genuinely looking out for you."],
      ["Understood", "Feeling that someone recognizes your experience."],
    ]],
  ]],
  ["Joy", "Pleasure or delight in something that feels rewarding.", 'pleasant', [
    ["Happiness", "A feeling of pleasure or contentment with an experience.", [
      ["Proud", "Feeling good about something you or someone close to you achieved."],
      ["Delighted", "Feeling a bright burst of pleasure or pleasant surprise."],
    ]],
    ["Excitement", "An energized feeling of enjoyment or eager anticipation.", [
      ["Enthusiastic", "Feeling eager and warmly engaged with something appealing."],
      ["Playful", "Feeling lighthearted and open to fun or experimentation."],
    ]],
    ["Gratitude", "Appreciation for something meaningful or beneficial you have received.", [
      ["Thankful", "Feeling grateful for care, help, or something good in your life."],
      ["Touched", "Feeling emotionally moved by kindness or a meaningful gesture."],
    ]],
  ]],
  ["Calm / Safety", "A sense of ease when you feel safe enough to lower your alertness.", 'pleasant', [
    ["Peace", "A sense of quiet ease with the present moment.", [
      ["Content", "Feeling satisfied with things as they are, without needing more."],
      ["Relaxed", "Feeling less tension in your mind or body."],
    ]],
    ["Security", "Feeling steady and relatively protected from threat.", [
      ["Safe", "Feeling relatively free from immediate danger."],
      ["Grounded", "Feeling anchored in the present and your surroundings."],
    ]],
    ["Relief", "Ease that comes when a burden, threat, or discomfort lessens.", [
      ["Lighter", "Feeling a weight lift once worry or pressure has passed."],
      ["Reassured", "Feeling calmer after receiving information or support that eases a concern."],
    ]],
  ]],
  ["Hope / Interest", "An open orientation toward a possibility that feels worth exploring.", 'pleasant', [
    ["Hope", "Feeling that a desired improvement or outcome remains possible.", [
      ["Inspired", "Feeling moved toward a new possibility by an idea or example."],
      ["Encouraged", "Feeling renewed hope after a sign of progress or support."],
    ]],
    ["Anticipation", "Looking ahead with interest toward something you want to experience.", [
      ["Eager", "Feeling a keen desire for an appealing future experience to arrive."],
      ["Expectant", "Feeling attentive to a meaningful possibility that may be approaching."],
    ]],
    ["Curiosity", "A desire to explore or understand something unfamiliar.", [
      ["Inquisitive", "Feeling driven to ask questions and learn more."],
      ["Fascinated", "Feeling deeply absorbed by something compelling or unfamiliar."],
    ]],
  ]],
  ["Fear", "An emotional response to a threat that feels immediate or possible.", 'unpleasant', [
    ["Anxiety", "Apprehension about a possible future threat or unwanted outcome.", [
      ["Worried", "Feeling your mind return again and again to what might go wrong."],
      ["Tense", "Feeling mentally or physically braced for possible difficulty."],
    ]],
    ["Uncertainty", "Discomfort when an outcome is hard to predict.", [
      ["Doubtful", "The mind questioning whether its current belief or decision is correct."],
      ["Confused", "Feeling unable to make sense of unclear or conflicting information."],
    ]],
    ["Threat", "Feeling that something important may be in danger.", [
      ["Afraid", "Feeling fear in response to a perceived danger."],
      ["Vulnerable", "Feeling exposed to possible hurt or harm."],
    ]],
  ]],
  ["Sadness", "An emotional response to loss, disappointment, or missing connection.", 'unpleasant', [
    ["Loneliness", "Feeling a gap between the meaningful connection you need and the connection you have.", [
      ["Left out", "Feeling excluded while others are together."],
      ["Abandoned", "Feeling left without the care or companionship you needed."],
    ]],
    ["Disappointment", "Sadness when reality falls short of a hope or expectation.", [
      ["Deflated", "Feeling your energy drop when something did not turn out as hoped."],
      ["Hopeless", "Feeling unable to imagine improvement, even though the feeling does not predict the future."],
    ]],
    ["Grief", "An emotional response to the loss of someone or something significant.", [
      ["Heartbroken", "Feeling profound emotional pain after a meaningful loss."],
      ["Numb", "Feeling emotionally muted or distant from your feelings."],
    ]],
  ]],
  ["Anger", "An emotional response to obstruction, unfairness, or a violated boundary.", 'unpleasant', [
    ["Frustration", "Tension or annoyance when something blocks, disturbs, or slows what you want.", [
      ["Annoyed", "Feeling bothered by an interruption, inconvenience, or unwanted behavior."],
      ["Stuck", "Feeling unable to move forward no matter how hard you try."],
    ]],
    ["Resentment", "Lingering anger about perceived unfairness or unresolved hurt.", [
      ["Wronged", "Feeling you were treated unfairly and it has not been made right."],
      ["Indignant", "Feeling anger at something you perceive as unjust or unacceptable."],
    ]],
    ["Rage", "Intense anger accompanied by a powerful urgency to react.", [
      ["Furious", "Feeling intensely angry about a perceived wrong or threat."],
      ["Explosive", "Feeling close to a sudden, intense expression of anger."],
    ]],
  ]],
  ["Shame / Aversion", "Painful self-consciousness or a strong urge to turn away from something distressing.", 'unpleasant', [
    ["Shame", "A painful feeling that something about you is unacceptable or exposed to judgment.", [
      ["Humiliated", "Feeling lowered or degraded in front of others."],
      ["Embarrassed", "Feeling uncomfortable about how you may appear to other people."],
    ]],
    ["Guilt", "Distress about an action or omission that conflicts with your values.", [
      ["Apologetic", "Feeling a wish to acknowledge harm you caused and make it right."],
      ["Regretful", "Feeling sorrow about a past action that you believe fell short of your values."],
    ]],
    ["Disgust", "A strong feeling of aversion toward something experienced as repellent.", [
      ["Contemptuous", "Looking down on someone or something as beneath respect."],
      ["Repulsed", "Feeling a powerful aversion and a wish to distance yourself."],
    ]],
  ]],
];

const SPRITES: Record<string, string[]> = {
  'love-connection': ["........",".XX..XX.","XXXXXXXX","XXXXXXXX",".XXXXXX.","..XXXX..","...XX...","........"],
  'joy': ["...XX...","...XX...","XXXXXXXX",".XXXXXX.","..XXXX..","..XXXX..",".XX..XX.",".X....X."],
  'calm-safety': [".....XXX","...XXXXX","..XXXXXX",".XXXXXX.",".XXXXX..",".XXXX...","X.......","........"],
  'hope-interest': ["...X....","...X....",".X.X.X..","..XXX...","XXXXXXX.","..XXX...",".X.X.X..","...X...."],
  'fear': ["..XXXX..",".XXXXXX.","XX.XX.XX","XX.XX.XX","XXXXXXXX","XXXXXXXX","XXXXXXXX","XX.XX.XX"],
  'sadness': ["..XXX...",".XXXXXX.","XXXXXXXX","XXXXXXXX","........",".X..X..X","........","X..X..X."],
  'anger': ["...X....","..XX....","..XXX.X.",".XXXXXX.","XXXXXXXX","XXX..XXX","XX....XX",".XXXXXX."],
  'shame-aversion': [".XXXXXX.","X......X","X.X..X.X","X......X","X..XX..X","X.X..X.X","X......X",".XXXXXX."],
};

/**
 * Idle loops for the sprites: extra frames (frame 0 is the sprite itself) and the order
 * they play in, as [frame, ms]. The heart beats, the star hops, the leaf drifts, the spark
 * twinkles, the ghost looks around, rain falls, the flame flickers, the face looks away.
 */
export const SPRITE_IDLE: Record<string, { frames: string[][]; loop: [number, number][] }> = {
  'love-connection': {
    frames: [["........","........",".XX..XX.",".XXXXXX.","..XXXX..","...XX...","........","........"]],
    loop: [[0, 900], [1, 110], [0, 150], [1, 110]],
  },
  'joy': {
    frames: [["...XX...","XXXXXXXX",".XXXXXX.","..XXXX..","..XXXX..",".XX..XX.",".X....X.","........"]],
    loop: [[0, 700], [1, 160], [0, 120], [1, 160]],
  },
  'calm-safety': {
    frames: [["........",".....XXX","...XXXXX","..XXXXXX",".XXXXXX.",".XXXXX..",".XXXX...","X......."]],
    loop: [[0, 1200], [1, 1200]],
  },
  'hope-interest': {
    frames: [
      ["...X....","...X....","...X....","..XXX...","XXXXXXX.","..XXX...","...X....","...X...."],
      ["........","........","...X....","..XXX...",".XXXXX..","..XXX...","...X....","........"],
    ],
    loop: [[0, 900], [1, 110], [2, 170], [1, 110]],
  },
  'fear': {
    frames: [
      ["..XXXX..",".XXXXXX.","X.XX.XXX","X.XX.XXX","XXXXXXXX","XXXXXXXX","XXXXXXXX","X.XX.XX."],
      ["..XXXX..",".XXXXXX.","XXX.XX.X","XXX.XX.X","XXXXXXXX","XXXXXXXX","XXXXXXXX",".XX.XX.X"],
    ],
    loop: [[0, 800], [1, 450], [0, 260], [2, 450]],
  },
  'sadness': {
    frames: [
      ["..XXX...",".XXXXXX.","XXXXXXXX","XXXXXXXX","X..X..X.","........",".X..X..X","........"],
      ["..XXX...",".XXXXXX.","XXXXXXXX","XXXXXXXX","........","X..X..X.","........",".X..X..X"],
      ["..XXX...",".XXXXXX.","XXXXXXXX","XXXXXXXX",".X..X..X","........","X..X..X.","........"],
    ],
    loop: [[0, 190], [1, 190], [2, 190], [3, 190]],
  },
  'anger': {
    frames: [
      ["....X...","....XX..",".X.XXX..",".XXXXXX.","XXXXXXXX","XXX..XXX","XX....XX",".XXXXXX."],
      ["........","...XX...","..XXXX..",".XXXXXX.","XXXXXXXX","XXX..XXX","XX....XX",".XXXXXX."],
    ],
    loop: [[0, 170], [1, 130], [2, 110], [1, 140]],
  },
  'shame-aversion': {
    frames: [
      [".XXXXXX.","X......X","X......X","X......X","X..XX..X","X.X..X.X","X......X",".XXXXXX."],
      [".XXXXXX.","X......X","X......X","X.X..X.X","X..XX..X","X.X..X.X","X......X",".XXXXXX."],
    ],
    loop: [[0, 1500], [1, 120], [0, 900], [2, 1100]],
  },
};

const COLORS: Record<string, [string, string]> = {
  'sadness': ['#2a78d6', '#3987e5'],
  'hope-interest': ['#eb6834', '#d95926'],
  'calm-safety': ['#1baf7a', '#199e70'],
  'joy': ['#eda100', '#c98500'],
  'love-connection': ['#e87ba4', '#d55181'],
  'shame-aversion': ['#008300', '#008300'],
  'fear': ['#4a3aa7', '#9085e9'],
  'anger': ['#e34948', '#e66767'],
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const CORES: CoreDef[] = RAW.map(([name, def, valence, fams]) => {
  const id = slug(name);
  return {
    id, name, def, depth: 0, core: id, parent: null, valence,
    color: COLORS[id], sprite: SPRITES[id],
    families: fams.map(([fName, fDef, feels]) => {
      const fid = `${id}/${slug(fName)}`;
      return {
        id: fid, name: fName, def: fDef, depth: 1, core: id, parent: id,
        feelings: feels.map(([n, d]) => ({ id: `${fid}/${slug(n)}`, name: n, def: d, depth: 2, core: id, parent: fid }) as EmotionDef),
      } as FamilyDef;
    }),
  };
});

export const CORE: Record<string, CoreDef> = Object.fromEntries(CORES.map((c) => [c.id, c]));
export const FAMILIES: FamilyDef[] = CORES.flatMap((c) => c.families);
export const FEELINGS: EmotionDef[] = FAMILIES.flatMap((f) => f.feelings);
export const EMOTION: Record<string, EmotionDef> = Object.fromEntries(
  [...CORES, ...FAMILIES, ...FEELINGS].map((e) => [e.id, e]),
);

/** Layout order for the picker: unpleasant row, then pleasant row (as in Emotion Quest). */
export const PICKER_ORDER = ['fear', 'sadness', 'anger', 'shame-aversion', 'love-connection', 'joy', 'calm-safety', 'hope-interest'];
/** Adjacency order validated for colour-blind separation — use for stacked charts and legends. */
export const CHART_ORDER = ['sadness', 'hope-interest', 'calm-safety', 'joy', 'love-connection', 'shame-aversion', 'fear', 'anger'];

/** "Love / Connection" → "Love" */
export const shortName = (id: string) => (EMOTION[id]?.name ?? id).split(' / ')[0];
export const coreOf = (id: string) => CORE[id.split('/')[0]];
export const valence = (id: string) => (coreOf(id)?.valence === 'pleasant' ? 1 : -1);
