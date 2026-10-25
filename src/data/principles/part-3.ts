// How to Win Friends and Influence People, part four: Be a leader. Principles 22–30, on how to correct, ask and
// encourage so that people change without resentment. The prose is ours; only the titles are the book’s.

import type { Principle } from './types';

export const PRINCIPLES: Principle[] = [
  /* ---------------- 22 ---------------- */
  {
    n: 22, id: 'begin-praise', title: 'Begin with Praise and Honest Appreciation', part: 'lead',
    line: 'Before you tell someone what to fix, tell them, truthfully, what is already good.',
    gist: 'The book compares it to a barber, who lathers a man before he shaves him. Hard news goes down more easily after honest appreciation, because the person can hear that you have seen the whole of their work and not just the flaw in it. The criticism then reads as a note from someone on their side, not a verdict from a judge. The book is clear that the praise has to be true and specific. A vague compliment used as a softener is easy to spot, and it makes the person brace for the blow instead of relaxing.',
    story: {
      who: 'Calvin Coolidge and his secretary',
      when: '1923–1929, the Coolidge White House',
      text: 'A guest staying at the White House for a weekend walked into the president’s office and overheard him speaking to his secretary. Coolidge, famous as “Silent Cal” for how little he said, told her that she was wearing a pretty dress that morning and that she was a very attractive young woman. It was probably the warmest thing she had ever heard from him, and she blushed. Then he told her not to let it go to her head: he had said it to make her feel good, and from now on he would like her to be a bit more careful with her punctuation. The method was a little obvious, but the psychology was superb, because the correction arrived when she was most ready to hear it.',
    },
    mind: 'Criticism is processed as a threat to the self, and a threatened self defends before it listens: it explains, minimises and counter-attacks. Opening with real appreciation lowers that threat. It tells the person that their standing with you is safe, so the brain can treat what follows as information rather than danger. Order matters too, because first impressions colour how later details are read. The catch is that people learn patterns fast. If praise always comes right before a complaint, it stops being heard as praise and starts working as a warning siren.',
    levers: [
      { name: 'Self-affirmation', text: 'Claude Steele’s theory holds that people defend against threatening information less when they have just been reminded of something good about themselves. In studies by David Sherman and colleagues, people who first affirmed a value they cared about were more open to unwelcome health messages. Honest praise does a similar job: it shores up the self so the critique doesn’t have to be fought off.' },
      { name: 'The primacy effect', text: 'In Solomon Asch’s 1946 study, a person described as “intelligent, industrious, impulsive, critical, stubborn, envious” was rated more favourably than one given the same traits in reverse order. What comes first sets the frame for what follows, in a performance review as much as a character sketch.' },
      { name: 'The positivity ratio, and its fall', text: 'Barbara Fredrickson and Marcial Losada claimed in 2005 that people flourish above a precise ratio of about 2.9 positive moments to each negative one. In 2013 Nicholas Brown, Alan Sokal and Harris Friedman showed the mathematics behind it didn’t hold, and the journal formally withdrew the model. The broader idea that good relationships need plenty more warmth than criticism still has support, but there is no magic number.' },
    ],
    traps: [
      { id: 'negativity', how: 'One criticism weighs more in the mind than several compliments. Leading with real good puts something on the other side of the scale, so the flaw is seen in proportion instead of filling the whole picture.' },
      { id: 'anchoring', how: 'The first thing said becomes the reference point for everything after it. Start with what works and the fault is judged against a mostly good piece of work, not the other way round.' },
    ],
    laws: [
      { n: 12, how: 'The law uses a show of honesty and generosity to lower someone’s guard before the real move. The principle uses the same order, good first and hard second, with the opposite intent: the praise is true and the request is out in the open.' },
    ],
    study: {
      who: 'Jay Parkes, Sara Abercrombie and Teresita McCarty, 2013',
      title: 'Feedback sandwiches affect perceptions but not performance',
      text: 'Students completed a task and got feedback either as a “sandwich”, criticism wrapped between two pieces of praise, or in other formats. They rated the sandwich as more helpful and pleasant, but it did not make them do any better on their next attempt. The finding fits the principle only halfway. Praise first changes how criticism feels, which matters for the relationship and for whether people come back for more. It does not do the teaching: the clear, specific correction does that.',
    },
    today: [
      'Opening a code review with the part of the pull request that is genuinely well done before listing the problems',
      'Telling a partner what you love about the dinner they planned before mentioning the restaurant was too loud',
      'Starting a teacher’s report with a specific strength the child has shown this term',
      'Replying to a freelancer’s first draft by naming the two ideas you want to keep before asking for changes',
    ],
    scenario: 'A manager reads a junior designer’s pitch deck the night before a client meeting. The next morning she tells him the opening story is the clearest way anyone on the team has framed the problem, and that she wants to keep it word for word. Then she says the pricing slide will lose the room, and they rebuild it together over coffee. He walks into the meeting confident instead of rattled.',
    practice: [
      'Before your next piece of feedback, write down one specific thing that is genuinely good and say it first, without a “but” after it',
      'Make the praise precise enough that it could only apply to this work: name the slide, the sentence, the decision',
      'Once this week, give the appreciation on its own, with no criticism attached, so people stop hearing praise as a warning',
    ],
    slips: [
      'Praise so generic (“great job overall”) that everyone can tell it is padding',
      'Following the compliment straight away with “but”, which cancels everything before it',
      'Only ever praising right before a criticism, so people learn to flinch when you are nice',
    ],
    shadow: 'Used as a formula, this becomes the manipulative “compliment sandwich” that people learn to see through, and it teaches them to distrust your praise. It can also bury the message: if the criticism is serious, wrapping it in warmth can leave the person thinking all is well. When the stakes are high or the problem urgent, say the important thing clearly and early, and keep the appreciation honest rather than strategic.',
    honest: 'You notice what is good because you were actually looking, and you say it because it is true, not because it makes the next sentence easier. Then you say the hard part plainly, as someone who wants the person to succeed.',
    question: 'When you last criticised someone, could you have named one specific thing they did well, and did you?',
    hard: 4, everyday: 9, kin: [1, 2, 23, 27],
  },

  /* ---------------- 23 ---------------- */
  {
    n: 23, id: 'indirect', title: 'Call Attention to People’s Mistakes Indirectly', part: 'lead',
    line: 'Let people discover their mistake for themselves, and they’ll fix it without needing to defend it.',
    gist: 'A direct accusation puts people on trial, and people on trial defend themselves. The book suggests pointing towards the problem instead of at the person: a hint, an example, a question, a quiet change of your own behaviour that lets them see it themselves. One of the book’s practical tips is tiny but telling. After praising someone, many of us say “but” and then the criticism, and the “but” makes the praise sound like a set-up. Swap it for “and” (“you’ve worked hard on this, and if you tighten the ending it will be excellent”) and the praise survives.',
    story: {
      who: 'Charles Schwab and the “No Smoking” sign',
      when: 'Early twentieth century',
      text: 'The steel magnate Charles Schwab was walking through one of his mills at noon when he came across some of his men smoking, right underneath a sign that said “No Smoking”. He could have pointed at it and asked whether they could read. Instead he went over, handed each of them a cigar and said he would appreciate it if they smoked these outside. They knew he had seen them breaking the rule. They also knew he hadn’t humiliated them, and had even given them a small present. Men like that couldn’t help admiring a boss who treated them so.',
    },
    mind: 'Being told you are wrong is a small attack on your status and your sense of being in control, and the reflex is to protect both. People look for excuses, blame circumstances, or decide the critic is unfair. An indirect cue skips that fight. The person reaches the conclusion themselves, which means they own it, and conclusions we reach ourselves are far more convincing to us than ones handed over by others. It also leaves room for them to correct course without ever having to admit, out loud, that they were caught.',
    levers: [
      { name: 'Politeness and face threat', text: 'Linguists Penelope Brown and Stephen Levinson described criticism as a “face-threatening act” and catalogued how people soften it, including “off-record” strategies such as hints. Indirection lets both sides pretend nothing awkward happened while the message still gets through.' },
      { name: 'Self-persuasion', text: 'Elliot Aronson argued that the most lasting persuasion is the kind people do on themselves. A hint or a question invites them to generate the argument in their own heads, where it is far harder to dismiss.' },
      { name: 'Task focus versus self focus', text: 'Feedback that keeps attention on the work (“this number is off”) tends to help; feedback that turns attention onto the person (“you’re careless”) tends to hurt. A gentle pointer at the problem keeps the spotlight on the task.' },
    ],
    traps: [
      { id: 'self-serving', how: 'People credit their successes to themselves and their failures to circumstances. A direct accusation provokes that defence; an indirect cue lets them fix the slip without needing a story about why it wasn’t their fault.' },
      { id: 'spotlight', how: 'People already feel more watched and judged than they are. Correcting them openly, especially in front of others, inflates that feeling into humiliation; a quiet signal keeps the spotlight off.' },
      { id: 'fae', how: 'It is easy to read someone’s mistake as a flaw of character. Pointing at the situation (“the sign is easy to miss”) instead of the person resists that judgement, in you as much as in them.' },
    ],
    laws: [
      { n: 9, how: 'The law says win through actions, never argument, because argument only hardens the other side. Schwab’s cigars are exactly that: he made his point with a gesture and never had the argument at all.' },
    ],
    study: {
      who: 'Avraham Kluger and Angelo DeNisi, 1996',
      title: 'The effects of feedback interventions on performance',
      text: 'This large meta-analysis pooled over six hundred effect sizes from studies of feedback. On average feedback improved performance modestly, but in more than a third of cases it made performance worse. The damaging kind tended to pull attention away from the task and onto the person’s self-image. It supports the instinct that how you correct someone matters as much as whether you do. It doesn’t mean vaguer is better, though: hints that are never understood are just feedback that never arrives.',
    },
    today: [
      'Asking “what do you think of this section on a second read?” instead of writing “this part is wrong” on a colleague’s draft',
      'Putting the dishes away yourself, pointedly cheerful, rather than lecturing a flatmate about the sink',
      'Sharing a good example of the format you want with the whole team rather than calling out the one person who got it wrong',
      'Answering a friend’s inaccurate post with a private message instead of a public correction in the comments',
    ],
    scenario: 'A senior engineer notices a new hire keeps pushing code without tests. Instead of flagging it in the team chat, she pairs with him on his next ticket and writes the first test herself, saying it saved her from a nasty bug last month. By the end of the week, his pull requests all come with tests.',
    practice: [
      'Next time you are about to point out a mistake, try a question that lets the person find it: “How does this look against the brief?”',
      'Catch yourself saying “but” after a compliment this week and replace it with “and”',
      'Fix one recurring problem by changing the setup (a template, a checklist, a reminder) instead of blaming the person who keeps tripping on it',
    ],
    slips: [
      'Hinting so subtly that nobody notices, and then resenting them for not changing',
      'Sliding into passive aggression: sarcastic notes on the fridge, sighs, pointed jokes',
      'Using “and” mechanically, so it sounds just as much like a set-up as “but” did',
    ],
    shadow: 'Indirectness turns sour when it becomes a way to avoid ever being honest, or a way to criticise while keeping deniability. Some people and cultures much prefer plain speech and find hints confusing or sly. When safety, money or someone’s job is at stake, or a hint has already failed, say it directly and kindly. Schwab’s cigars worked because the men already knew the rule; a hint can’t teach something nobody knows.',
    honest: 'You care more about the problem being fixed than about being seen to be right, so you give the person the easiest possible way to fix it. If they don’t pick up the hint, you tell them plainly and privately.',
    question: 'When you correct someone, how much of it is about the mistake, and how much is about making sure they know you caught it?',
    hard: 6, everyday: 8, kin: [1, 22, 26],
  },

  /* ---------------- 24 ---------------- */
  {
    n: 24, id: 'own-mistakes', title: 'Talk About Your Own Mistakes Before Criticising the Other Person', part: 'lead',
    line: 'Admit you have been where they are, and your correction sounds like help instead of judgement.',
    gist: 'Criticism is much easier to take from someone who admits they aren’t perfect either. If you start by confessing a mistake of your own, ideally the same one, you step down from the judge’s bench and stand beside the other person. It reminds you, too, that experience is what separates you from them, not virtue. The book notes that this works even when you haven’t fixed your own faults: admitting them still makes it easier for the other person to admit theirs.',
    story: {
      who: 'An employer and his niece Josephine',
      when: 'New York, before 1936',
      text: 'A man’s niece Josephine came to New York to be his secretary. She was nineteen, three years out of high school, with almost no experience of business, and she made plenty of mistakes. One day, about to scold her, he stopped himself. He was twice her age with vastly more experience, so how could he expect her to have his judgement? And what had he been like at nineteen? He remembered the foolish blunders he had made then, and admitted to himself that she was doing better than he had. After that, when he needed to point out an error, he began by saying she had made a mistake, but that heaven knew it was no worse than many he had made, and that judgement only comes with experience. She took the corrections well and improved.',
    },
    mind: 'When a critic shows their own fallibility, the conversation changes from a hierarchy (I judge, you are judged) to a shared problem (we both get things wrong; here is one to fix). That lowers defensiveness and makes the critic seem fair. It also corrects a bias in the critic. Once we have learned something, it becomes hard to remember not knowing it, so others’ beginner mistakes look careless rather than normal. Remembering your own early errors puts the mistake back in proportion.',
    levers: [
      { name: 'The pratfall effect', text: 'Elliot Aronson found that a highly competent person who makes a small blunder can become more likeable, because the slip makes them seem human. Owning a past mistake has the same effect: it makes a capable critic easier to listen to.' },
      { name: 'Actor–observer asymmetry', text: 'We tend to explain our own mistakes by circumstances (“I was new”, “nobody told me”) and other people’s by character (“she’s careless”). Recalling your own beginner errors pushes you to give them the same generous reading you give yourself.' },
      { name: 'Reciprocal disclosure', text: 'Self-disclosure tends to be matched: when one person opens up, the other feels freer to do the same. Admitting your mistake makes it safer for them to admit theirs instead of hiding it.' },
    ],
    traps: [
      { id: 'curse', how: 'Once you know how to do something, you can’t easily imagine not knowing it. Telling your own beginner story drags you back to that earlier state and makes your expectations fairer.' },
      { id: 'hindsight', how: 'Looking back, your own mistakes seem obvious, so you assume theirs should have been too. Remembering how unclear it all felt at the time softens the verdict.' },
      { id: 'fae', how: 'You are tempted to blame their character for an error you would blame on circumstance in yourself. Leading with your own mistake forces the comparison into the open.' },
    ],
    laws: [
      { n: 46, how: 'The law advises showing a harmless flaw so you don’t provoke envy. The principle’s version uses real flaws for a kinder end: not to protect your position, but to make someone else’s correction bearable.' },
      { n: 22, how: 'The law’s surrender tactic yields on purpose to gain the upper hand later. Admitting your own mistakes is also a kind of lowering yourself, but here there is no hidden counter-move; the humility is the point.' },
    ],
    study: {
      who: 'Elliot Aronson, Ben Willerman and Joanne Floyd, 1966',
      title: 'The effect of a pratfall on increasing interpersonal attractiveness',
      text: 'Students listened to a recording of someone being interviewed for a college quiz team. When a highly competent candidate clumsily spilled coffee on himself at the end, listeners liked him more than when he didn’t. When a mediocre candidate did the same, they liked him less. Later work complicated the picture: a 1970 follow-up found the effect depended on the listener’s own self-esteem, and replications have been mixed. The fair reading is that a small, honest admission helps people who have already shown they are capable. It is not a trick that makes anyone likeable.',
    },
    today: [
      'Telling a new teammate about the time you took down production in your first month before discussing their outage',
      'Saying to a teenager, “I did exactly this at your age, and here’s what it cost me,” before talking about the party',
      'Opening a mentoring session by sharing a draft of yours that was torn apart',
      'Starting a hard conversation with a partner by owning your part in the argument first',
    ],
    scenario: 'A head chef finds a new cook has over-salted a whole batch of stock. Before saying anything about it, he tells her that in his first restaurant job he ruined a full day’s sauce by misreading a recipe, and the owner made him taste every pot for a month afterwards. Then he shows her how he checks seasoning now. She laughs, re-makes the stock, and starts asking him questions she had been too nervous to ask.',
    practice: [
      'Before your next correction, recall a time you made a similar mistake and tell that story first, briefly',
      'Notice when you are irritated by someone’s inexperience and ask yourself honestly what you were like at their stage',
      'Admit one current mistake of yours to a colleague this week, without being asked',
    ],
    slips: [
      'Making the confession so long that it becomes a story about you and the actual problem gets lost',
      'Inventing or exaggerating a past mistake to seem relatable, which people often sense',
      'Using “I used to do that too” as a superior pat on the head that really says “I’ve grown out of it”',
    ],
    shadow: 'A practised humility can become a performance: confessing small, safe faults to seem down-to-earth while keeping all the real authority. It can also undercut you when people need confidence from you, as a new leader in a crisis or an expert they are relying on. Sometimes the kinder thing is a clear correction without a speech about yourself.',
    honest: 'You remember, really remember, that you were once a beginner too, and you correct people the way you wish you had been corrected then.',
    question: 'What mistake of your own would you least like to admit to the person you’re about to criticise, and why?',
    hard: 5, everyday: 7, kin: [1, 12, 23],
  },

  /* ---------------- 25 ---------------- */
  {
    n: 25, id: 'ask-not-order', title: 'Ask Questions Instead of Giving Direct Orders', part: 'lead',
    line: 'People work harder at what they help decide than at what they are told to do.',
    gist: 'An order tells someone what to do; a question invites them to think about it. The book argues that asking (“What do you think of this?” “Could we try it this way?”) keeps people’s pride intact, makes them feel important, and gets you their cooperation instead of their compliance. It also often brings out better ideas than yours, because the people doing the work usually know things you don’t. And mistakes made under a question are easier to correct, since nobody has staked their authority on them.',
    story: {
      who: 'Owen D. Young, as told by Ida Tarbell',
      when: 'Around 1930',
      text: 'The journalist Ida Tarbell said that while she was writing a biography of Owen D. Young, the head of General Electric, she interviewed a man who had worked in the same office as Young for three years. He said he had never once heard Young give a direct order. Young made suggestions instead: “You might consider this,” or “Do you think this would work?” After dictating a letter, he would often ask what the other person thought of it. Reading an assistant’s draft, he might suggest that a different phrasing could work better. He let people do things themselves and learn from their own mistakes.',
    },
    mind: 'People have a basic need to feel in charge of their own actions. Orders threaten that autonomy, and a threatened sense of freedom pushes back: we comply grudgingly, do the minimum, or quietly resist. Questions hand some of the control back. They also do something subtler. Answering a question makes people generate their own reasons, and an idea we have worked on feels more like ours, so we care more about it succeeding.',
    levers: [
      { name: 'Psychological reactance', text: 'Jack Brehm described in 1966 how people, when they feel their freedom is being restricted, become motivated to restore it, often by doing the opposite of what they were told. A question leaves the freedom intact, so there is nothing to react against.' },
      { name: 'Autonomy support', text: 'Self-determination theory, developed by Edward Deci and Richard Ryan, finds that people are more engaged, creative and persistent when they feel their actions are their own. Explaining reasons and inviting input are classic autonomy-supportive moves.' },
      { name: 'The IKEA effect', text: 'Michael Norton, Daniel Mochon and Dan Ariely found that people value things they have built themselves more than identical things built for them. Plans work the same way: help shape one and you want it to succeed.' },
    ],
    traps: [
      { id: 'endowment', how: 'We value what is ours more than what isn’t. A question lets the plan become partly theirs, so they guard and improve it instead of just carrying it out.' },
      { id: 'authority', how: 'Orders lean on rank, and rank gets obedience without much thought or ownership. Questions ask people to engage their own judgement, which also catches the mistakes that blind obedience would let through.' },
    ],
    laws: [
      { n: 31, how: 'The law advises offering choices that all lead where you want, so people feel free while you stay in control. A loaded question can be that same trick. The principle’s version only works honestly if you are prepared to hear an answer you didn’t expect.' },
    ],
    study: {
      who: 'Richard Koestner, Richard Ryan, Frank Bernieri and Kathleen Holt, 1984',
      title: 'Setting limits on children’s behaviour: controlling versus informational styles',
      text: 'Young children were asked to paint while keeping the materials neat. Some heard the rule in a controlling way (“you must”, “you should”); others heard the same rule framed informationally, with a reason and an acknowledgement that they might want to be messy. A third group got no rule. Children given controlling limits later chose to paint less in their free time and produced less creative pictures; the informational group did about as well as children given no limits. It was a small study with young children, and the point isn’t grammar: “would you mind…?” said in a commanding tone is still an order. What matters is whether people feel they have a real say.',
    },
    today: [
      'Asking your team “How could we hit this deadline?” instead of announcing the overtime plan',
      'Asking a child “What do you need to bring for school tomorrow?” instead of listing it for them',
      'Replying to a contractor’s quote with “Is there a way to get this closer to our budget?” rather than demanding a discount',
      'Asking a partner “What would make Sunday feel restful for you?” before proposing a plan',
    ],
    scenario: 'A small bakery lands a wholesale order twice the size of anything it has handled. The owner gathers her four bakers before the morning shift, explains what the order would mean for the business, and asks whether they think it can be done and how. They rework the rota themselves, suggest prepping dough the night before, and take the order on with an enthusiasm she could never have ordered into them.',
    practice: [
      'Turn your next instruction into a genuine question and wait for the answer before adding your own',
      'In one meeting this week, ask “What do you think we should do?” before giving your view',
      'When you review someone’s work, suggest a change as a question (“What if this went first?”) and let them decide',
    ],
    slips: [
      'Asking questions you have already answered in your head, which people quickly recognise as orders in disguise',
      'Asking and then overruling every reply, which is worse than just giving the order',
      'Turning every simple instruction into a group consultation, so nothing gets decided',
    ],
    shadow: 'Questions can become a soft form of manipulation, leading someone step by step to a conclusion you have fixed in advance while letting them think it was theirs. In an emergency, or when someone is new and simply needs to know what to do, a clear instruction is kinder than a riddle. And some people find relentless questions draining or evasive: they want you to take responsibility and decide.',
    honest: 'You ask because you actually want to know, and you are willing to change your plan if the answer is better than yours.',
    question: 'When did you last ask someone what they thought and then actually do it their way?',
    hard: 5, everyday: 8, kin: [15, 16, 30],
  },

  /* ---------------- 26 ---------------- */
  {
    n: 26, id: 'save-face', title: 'Let the Other Person Save Face', part: 'lead',
    line: 'Correct the mistake, never the person’s dignity.',
    gist: 'This is one of the book’s most important principles, and one of the most ignored. We criticise people in front of others, find fault and threaten without stopping to consider their pride, when a moment’s thought, a kind word, or a little understanding would do far more good. Even when you are right and they are plainly wrong, humiliating someone destroys their will to improve and turns them against you. The book cites the Turkish leader Mustafa Kemal, who in 1922, after defeating the Greek army, told the captured Greek generals to sit down because they must be tired, and spoke of war as a game in which the best men sometimes lose.',
    story: {
      who: 'Charles Steinmetz and General Electric',
      when: 'Early twentieth century',
      text: 'Charles Steinmetz was a genius of electrical engineering and one of General Electric’s most valuable people. He was also a poor manager, and he was failing as head of a department. The company faced a delicate problem: it needed him out of the job, but it couldn’t afford to hurt or lose such a brilliant and sensitive man. So it gave him a new title, Consulting Engineer of the General Electric Company, which described the work he was already best at, and quietly let someone else run the department. Steinmetz was pleased. So were the officers who had found a way to fix the problem without a casualty.',
    },
    mind: 'Our public image is something we guard almost like our physical safety. When it is damaged in front of others, we feel shame, and shame tends to provoke hiding or anger rather than reflection. A person humiliated in public often stops caring about the problem and starts caring about getting their dignity back, even at a cost to themselves and to you. Giving them a way to back down with their pride intact removes that second fight, so the only thing left to deal with is the actual mistake.',
    levers: [
      { name: 'Facework', text: 'The sociologist Erving Goffman described “face” as the positive image a person claims in an encounter, and showed how much everyday conversation is spent quietly protecting each other’s. When face is lost, people go to great lengths to repair it, and that becomes the priority.' },
      { name: 'Shame versus guilt', text: 'June Tangney’s research distinguishes guilt (“I did a bad thing”), which tends to lead to apology and repair, from shame (“I am bad”), which is linked to hiding, defensiveness and anger. Public humiliation pushes people towards shame; private, behaviour-focused correction leaves room for guilt to do its useful work.' },
      { name: 'Self-justification', text: 'People who have publicly committed to a position find it painful to reverse, because the change would make them look foolish. Offering a dignified exit (“given what you knew then, it made sense”) makes changing course cheaper.' },
    ],
    traps: [
      { id: 'spotlight', how: 'Embarrassed people believe far more people noticed, and care, than really did, which makes losing face feel even worse. Correcting in private keeps the imagined audience small.' },
      { id: 'sunk-cost', how: 'Someone who has publicly defended a mistake is tempted to keep defending it rather than waste the stand they took. A face-saving exit lets them stop without seeming to admit everything was wasted.' },
      { id: 'fae', how: 'When someone fails, it is tempting to treat it as proof of who they are. Pointing to the situation (“the role didn’t suit your strengths”), as GE did with Steinmetz, keeps their character out of the verdict.' },
    ],
    laws: [
      { n: 15, how: 'The law advises crushing an enemy totally, because a wounded one will return for revenge. The principle draws the opposite conclusion from the same insight: humiliation breeds vengeance, so leave the other person their dignity and they never become an enemy at all.' },
      { n: 47, how: 'The law warns against pushing past the goal in victory. Saving someone’s face is knowing when to stop: you have won the point, and rubbing it in only creates resentment.' },
    ],
    study: {
      who: 'Bert Brown, 1968',
      title: 'The effects of need to maintain face on interpersonal bargaining',
      text: 'Teenage boys played a bargaining game against an opponent who exploited them. Some were then told by a supposed audience of peers that they had looked foolish; others that they had looked good. Those made to feel foolish were more likely to retaliate in the next rounds, even when getting back at their opponent cost them money of their own. Restoring their image mattered more than their winnings. It is a single 1960s laboratory study, but its pattern, that people will pay real costs to repair lost face, fits a great deal of later research on negotiation and conflict.',
    },
    today: [
      'Moving a struggling manager into an expert role with a real title rather than a public demotion',
      'Correcting a colleague’s wrong figure in a private message after the meeting, not in front of the client',
      'Telling a friend who misremembered a story, “I might have that wrong too,” instead of proving them wrong at dinner',
      'Letting a child who had a meltdown re-join the game without a lecture in front of their friends',
    ],
    scenario: 'In a project review, a senior analyst realises the forecast a colleague presented last month used the wrong baseline. Rather than raising it in front of the director, she messages him afterwards: “The baseline changed after you built this, so the old numbers made sense at the time. Want to update it together before Friday?” He sends the corrected version to everyone himself, with a note thanking her.',
    practice: [
      'Before correcting anyone this week, ask whether it needs an audience; if not, do it privately',
      'When someone is wrong, offer them one sentence that explains how a reasonable person could have got there',
      'After winning a disagreement, say nothing more about it, and see how much easier the next conversation is',
    ],
    slips: [
      'Correcting someone publicly “so everyone learns”, when the only lesson the person takes away is to resent you',
      'Saying “I’m not saying you’re stupid, but…”, which says exactly that',
      'Giving such a face-saving exit that the problem never actually gets fixed',
    ],
    shadow: 'Saving face can slide into protecting people from the truth: inventing titles to dodge hard conversations, or letting someone believe a failure wasn’t one. Organisations that never let anyone lose face end up with problems nobody can name. Some situations, a safety failure or abuse of trust, call for clear public accountability rather than a graceful exit.',
    honest: 'You care about the person still being whole after the mistake is fixed, so you handle the correction the way you’d want yours handled: clearly, privately, and without a trace of triumph.',
    question: 'Think of the last time you were proven right. Did the other person walk away with their dignity?',
    hard: 6, everyday: 7, kin: [1, 9, 12, 23],
  },

  /* ---------------- 27 ---------------- */
  {
    n: 27, id: 'every-improvement', title: 'Praise the Slightest Improvement and Praise Every Improvement', part: 'lead',
    line: 'Notice each small step forward out loud, and people keep taking them.',
    gist: 'The book points out that animal trainers know what managers and parents forget: you get more of what you reward. It mentions a trainer who praised and fed his dog at the slightest sign of progress. With people we do the opposite, staying silent while things go well and speaking up only when they go wrong. The book asks us to catch people doing better, not just doing badly, and to praise even small steps warmly and specifically. Encouragement at the moment of improvement, it argues, is what turns a hesitant beginner into someone who believes they can.',
    story: {
      who: 'Enrico Caruso and his mother',
      when: 'Naples, 1880s',
      text: 'In the story, a ten-year-old boy working in a factory in Naples longed to be a singer. His first teacher discouraged him, saying he couldn’t sing at all and his voice sounded like the wind in the shutters. His mother, a poor peasant woman, took the opposite view. She hugged him, praised him, told him she could already hear him getting better, and went without shoes to save money for his music lessons. Her praise changed the course of his life. The boy was Enrico Caruso, who became the most famous tenor of his age.',
    },
    mind: 'Behaviour that is followed by something good tends to be repeated, and the closer the reward is to the action, the stronger the link. Waiting for the finished result before saying anything means the many small steps along the way go unrewarded, and progress feels invisible. Praising each improvement makes progress visible, both to you and to the learner. It also builds belief: people who see that their efforts are noticed and working come to trust that more effort will work too.',
    levers: [
      { name: 'Shaping', text: 'B. F. Skinner found that complex behaviour can be built by rewarding each small approximation of the goal rather than waiting for the full performance. Praise for every improvement is shaping applied to people.' },
      { name: 'The progress principle', text: 'Teresa Amabile and Steven Kramer studied nearly 12,000 daily diary entries from people working on creative projects. The single strongest booster of their mood and motivation on a given day was making progress in meaningful work, even small progress. Noticing it out loud multiplies the effect.' },
      { name: 'Self-efficacy', text: 'Albert Bandura showed that belief in your ability to succeed is built most strongly by your own experiences of success. Praising small improvements turns ordinary progress into evidence the learner can see.' },
    ],
    traps: [
      { id: 'negativity', how: 'Mistakes grab attention and quiet improvement doesn’t, so we tend to comment only on what is wrong. Deliberately praising progress counterweights that pull.' },
      { id: 'confirmation', how: 'Once you think someone is weak, you see mainly their failures. Looking for improvement on purpose breaks the loop and lets you notice change you’d otherwise miss.' },
    ],
    laws: [
      { n: 45, how: 'The law warns that reform comes best in small steps people can absorb. The principle applies the same wisdom to personal change: ask for and celebrate one small improvement at a time, not a total transformation.' },
    ],
    study: {
      who: 'B. F. Skinner and colleagues, 1943',
      title: 'Teaching a pigeon to bowl',
      text: 'While working on a wartime project, Skinner and his colleagues tried to teach a pigeon to swipe a wooden ball down a tiny bowling alley. Waiting for a full swipe got nowhere, so they began rewarding anything that came close, at first merely looking at the ball, then moving towards it, then touching it. Within minutes the bird was knocking the ball across the box. Skinner later described this as a revelation about how behaviour is built. With people, it is more complicated. A 1999 meta-analysis by Edward Deci, Richard Koestner and Richard Ryan found that verbal praise generally raised adults’ intrinsic motivation, but less reliably in children, and praise delivered in a controlling way could lower it.',
    },
    today: [
      'Telling a junior colleague their second presentation was noticeably tighter than the first, and naming exactly what changed',
      'Praising a child for reading one page more than yesterday, not only for finishing the book',
      'Messaging a friend who is getting fit that you noticed they have been to the gym three times this week',
      'Commenting on the one thing an online learner improved in their latest drawing, not the five things still wrong',
    ],
    scenario: 'A football coach for under-tens has one boy who never passes. At training, the first time the boy looks up before shooting, the coach shouts that it was great awareness. Next session, when he finally passes the ball, even badly, the coach stops the drill to point it out. By the end of the season the boy is setting up half the team’s goals.',
    practice: [
      'Pick one person you often correct and, this week, catch them doing something slightly better and say so specifically',
      'Keep a short note of small improvements you see at home or work and mention one each day',
      'When you praise, describe what changed (“you checked the figures before sending”) rather than the person (“you’re great”)',
    ],
    slips: [
      'Praising so constantly and indiscriminately that it stops meaning anything',
      'Praising improvement with a sting (“finally!” or “about time”)',
      'Rewarding progress only with praise for talent (“you’re a natural”), which can make people afraid to struggle',
    ],
    shadow: 'Praise can be used as a leash, delivered only when people do what you want, so they learn to perform for your approval rather than for the work. Over-praising also inflates and confuses: someone praised for everything can’t tell what actually matters. Sometimes progress is better left for the person to notice themselves, especially with adults who might find frequent praise patronising.',
    honest: 'You are genuinely glad when someone gets better, and you let them know because the improvement is real and you saw it.',
    question: 'Who in your life is improving right now, and have you told them?',
    hard: 4, everyday: 9, kin: [2, 22, 29],
  },

  /* ---------------- 28 ---------------- */
  {
    n: 28, id: 'fine-reputation', title: 'Give the Other Person a Fine Reputation to Live Up To', part: 'lead',
    line: 'Tell people who you believe they are, and many will rise to meet it.',
    gist: 'If you want someone to improve in a particular way, act as though that quality were already one of their traits. The book argues that people will go to great lengths not to disappoint a good opinion of themselves, especially one held by someone they respect. Instead of “you’re always late”, say “you’re one of the most reliable people here, which is why this surprised me.” The person now has a reputation to protect. The book borrows Shakespeare’s advice to “assume a virtue, if you have it not”, and turns it outward: assume the virtue in others, and say so openly.',
    story: {
      who: 'Georgette Leblanc and “Marie the Dishwasher”',
      when: 'Early twentieth century, from Leblanc’s memoir',
      text: 'The singer and actress Georgette Leblanc, partner of the writer Maurice Maeterlinck, wrote in her memoirs about a servant girl who brought her meals from a nearby hotel. Everyone called her “Marie the Dishwasher”, because she had started out as a scullery maid, and she was plain, awkward and thought very little of herself. One day, as Marie set down a plate, Leblanc told her she had no idea what treasures lay inside her. Marie went back to the kitchen thinking about it. She began to take care of her appearance and carry herself differently, and the people around her began to treat her differently in turn. A couple of months later she announced she was going to marry the chef’s nephew, and told Leblanc she was going to be a lady.',
    },
    mind: 'We work out who we are partly by watching what others think of us and partly by watching what we do. When someone we respect labels us as generous, careful or brave, the label offers a new self-image, and we then act in ways that fit it, because people strongly prefer their behaviour to match their identity. The expectation also changes the person who holds it: we treat those we believe in more warmly, give them more chances, and notice their successes, which creates the very evidence that confirms the label.',
    levers: [
      { name: 'Self-perception and consistency', text: 'Daryl Bem argued that we infer our own attitudes partly from our behaviour, much as an outside observer would. A trait offered by someone credible becomes a self-description to live up to, and the desire to act consistently with it does the rest.' },
      { name: 'The Pygmalion effect, and its limits', text: 'Robert Rosenthal and Lenore Jacobson reported in 1968 that pupils randomly labelled as “about to bloom” gained more IQ points, mostly in the youngest grades. The study was heavily criticised and replications have been mixed. Lee Jussim and Kent Harber’s 2005 review concluded that teacher expectations do affect pupils, but usually modestly, and the effects often fade.' },
      { name: 'Identity-based appeals', text: 'Christopher Bryan and colleagues found that asking people to “be a helper” or “be a voter” rather than “help” or “vote” produced more of the behaviour in several studies, because a noun invites an identity. Some later replications found weaker or no effects, so it is a lever, not a law.' },
    ],
    traps: [
      { id: 'confirmation', how: 'Once a person is labelled, both they and everyone around them look for evidence that fits. Choosing a good label points that bias in a useful direction instead of locking someone into their worst moment.' },
      { id: 'halo', how: 'A single strong good quality colours how the whole person is seen. Naming a real strength lets that glow spread to the area where they are trying to grow.' },
    ],
    laws: [
      { n: 34, how: 'The law says act like a king to be treated like one, because people take you at the value you place on yourself. The principle points the same mechanism outward: place a high value on someone else and they start to act it.' },
      { n: 5, how: 'The law says guard your own reputation with your life. The principle suggests giving other people a reputation worth guarding, because they will guard it as fiercely as you guard yours.' },
    ],
    study: {
      who: 'Richard Miller, Philip Brickman and Diana Bolen, 1975',
      title: 'Attribution versus persuasion as a means for modifying behaviour',
      text: 'In a Chicago school, one fifth-grade class was told repeatedly over about a week, by their teacher, the principal and even the janitor, that they were a neat and tidy class. Another class was lectured on why they should be neat. The class given the reputation went on to put far more of its litter in the bin, and was still doing so two weeks later, while the persuaded class improved briefly and then slipped back. A second study found similar results for maths, where children told they were good at it improved more than those told they should try harder. The studies were small and limited to a few classrooms, but they are often cited as evidence that a good label can outperform a lecture.',
    },
    today: [
      'Telling a teammate who missed a deadline, “You’re usually the one we can count on, so I know something got in the way”',
      'Introducing a shy friend at a party as “the funniest person I know”',
      'Saying to a child, “You’re someone who keeps their promises,” before reminding them about a chore',
      'Writing in a performance review the strength you want someone to grow into, framed as one they already show',
    ],
    scenario: 'A new nurse keeps forgetting to update patient charts. Rather than writing her up, the ward sister tells her that her care with patients is the most thorough she has seen in a new starter, and that she wants her charts to show it. Within a fortnight her charting is the most detailed on the ward, and she mentions the conversation to a friend as the moment she felt she belonged.',
    practice: [
      'Think of someone you want to change, find a real moment where they showed the quality you want, and remind them of it',
      'Replace one “you always…” complaint this week with “you’re someone who usually…”',
      'Introduce a colleague to someone new by naming a strength they’d like to be known for',
    ],
    slips: [
      'Giving a reputation so far from the truth that it sounds like sarcasm or a trap',
      'Saying it once and then going back to criticism, so the label has nothing to stand on',
      'Using the reputation as a guilt lever (“I thought you were better than this”)',
    ],
    shadow: 'This is close to a classic manipulation: flatter someone into an identity that happens to serve you, then hold them hostage to it. Labels can also trap people in a role, the “reliable one” who can never say no. And a label too far from reality backfires; people know when they are being handled. When someone needs direct, honest feedback about a real problem, a nice reputation is no substitute.',
    honest: 'You see the best in someone because it is genuinely there, even if only in glimpses, and you tell them because you want them to see it too.',
    question: 'What reputation are you currently giving the people closest to you, and is it one you would want them to live up to?',
    hard: 5, everyday: 7, kin: [19, 21, 27, 29],
  },

  /* ---------------- 29 ---------------- */
  {
    n: 29, id: 'encourage', title: 'Use Encouragement. Make the Fault Seem Easy to Correct', part: 'lead',
    line: 'Make the gap between where they are and where they could be look small enough to cross.',
    gist: 'Tell someone they are hopeless at something, that they are doing it all wrong, and you take away the reason to try. Tell them it is easy to fix, that they have a feel for it, that you believe in them, and they will practise until they get it. The book gives the example of a friend who, at about forty, took dancing lessons to please his fiancée. The first teacher told him he was doing everything wrong and must start from scratch, and he soon gave up. The next told him his style was a little old-fashioned but the basics were sound, and that he had a natural sense of rhythm. He kept going and got better.',
    story: {
      who: 'Lowell Thomas and a friend',
      when: 'Between the world wars',
      text: 'The broadcaster and travel writer Lowell Thomas once wanted a friend to join a game of bridge. The friend had never played and was sure he couldn’t learn: it seemed a baffling mystery. Thomas told him there was nothing to it. Bridge was just memory and judgement, and since the friend had once written about memory, he would find it a cinch. The friend sat down and, almost before he knew it, was playing for the first time in his life, because he had been made to feel he had a gift for it and that the game was easy.',
    },
    mind: 'Whether people try depends less on how hard the task actually is than on whether they believe effort will pay off. When a fault feels large, fixed and part of who they are, trying seems pointless and they protect themselves by giving up. When it feels small, specific and fixable, effort seems worthwhile. Encouragement changes that belief. It works best when it is grounded: a real strength the person can build on and a concrete first step they can see themselves taking.',
    levers: [
      { name: 'Self-efficacy', text: 'Albert Bandura showed that people take on and persist at tasks they believe they can do. Verbal encouragement from someone credible is one of its main sources, though weaker than actually succeeding, so it works best paired with an early, achievable win.' },
      { name: 'Attribution retraining', text: 'Timothy Wilson and Patricia Linville told struggling first-year university students that grades usually improve after the first year. Those students went on to improve their grades and were less likely to drop out than a comparison group. Framing a problem as temporary and common made it feel fixable.' },
      { name: 'Learned helplessness', text: 'Martin Seligman’s early experiments showed that animals exposed to setbacks they couldn’t control stopped trying to escape even when escape became possible. People told repeatedly that they are failing can learn the same passivity; encouragement restores a sense that effort matters.' },
    ],
    traps: [
      { id: 'fae', how: 'We readily treat a fault as a fixed part of someone’s character. Describing it as a skill not yet learned, rather than a flaw in the person, makes it fixable in their eyes and in yours.' },
      { id: 'framing', how: 'The same gap can be framed as “you’re doing it all wrong” or “you’re one change away”. The frame decides whether people see a wall or a step.' },
    ],
    laws: [
      { n: 30, how: 'The law advises hiding the effort behind your achievements so they seem effortless and you seem gifted. The principle uses seeming ease for the other person’s sake: it makes their task look easy so they dare to begin.' },
    ],
    study: {
      who: 'Claudia Mueller and Carol Dweck, 1998',
      title: 'Praise for intelligence can undermine children’s motivation and performance',
      text: 'Fifth-graders solved a set of puzzles and were praised either for being smart or for working hard. Then they got a much harder set and did badly. Children praised for intelligence enjoyed the task less, were less willing to persist, did worse on a final set, and were more likely to exaggerate their scores when reporting them to others. Children praised for effort treated the failure as a sign to try a different approach. The work helped launch the “growth mindset” movement, but later evidence is more sobering: large studies of mindset interventions find small average effects, concentrated among struggling students, and at least one careful replication of the praise experiment (Li and Bates, 2019) didn’t find the effect.',
    },
    today: [
      'Telling a colleague who botched their first client call that the structure was right and only the opening needs work',
      'Saying to a child learning to swim, “Your kick is already strong, now we just need to fix your arms”',
      'Reviewing a beginner’s first open-source contribution by pointing to the one small change that will get it merged',
      'Telling a partner nervous about a driving test that the manoeuvre they fear is just three steps, and practising them together',
    ],
    scenario: 'A man in his fifties joins an evening language class and freezes whenever he has to speak. After the second lesson, the teacher tells him his pronunciation is unusually good for a beginner, and that his only real problem is word order, which comes with a few weeks of practice. He starts volunteering answers, and by the end of the term he is the one helping newer students.',
    practice: [
      'Next time someone is struggling, name one thing they are doing right and one small, specific fix',
      'Break a skill someone fears into three steps and help them take the first one today',
      'Replace “you’re bad at this” in your own head with “you haven’t practised this yet”, and notice how differently you act',
    ],
    slips: [
      'Calling something easy when it truly is hard, which leaves people feeling stupid when they struggle',
      'Encouraging without any concrete next step, so the warm words lead nowhere',
      'Praising talent (“you’re a natural”) instead of the approach, which can make the next setback feel like proof of failure',
    ],
    shadow: 'Encouragement shades into false comfort when the fault is serious and the fix truly difficult. Telling someone it is easy can set them up to feel worse when it isn’t, and can stop them seeking real help. Sometimes the honest and kind thing is to say: this is hard, it will take time, and I think you can do it.',
    honest: 'You believe the person can get better and you show them the first step, describing the difficulty truthfully but not making it bigger than it is.',
    question: 'What fault in yourself have you decided can’t be fixed, and how would someone encouraging describe it?',
    hard: 4, everyday: 8, kin: [2, 27, 28],
  },

  /* ---------------- 30 ---------------- */
  {
    n: 30, id: 'happy-to-do', title: 'Make the Other Person Happy About Doing the Thing You Suggest', part: 'lead',
    line: 'Show people what they gain, and the request becomes a chance instead of a chore.',
    gist: 'The book closes with a practical rule: when you want someone to do something, think first about what is in it for them, and frame it so they are glad to do it. Be sincere, know exactly what you want, think about what they really want, and match the benefit to their needs. The book tells of a woman whose lawn kept being trampled by local boys. Scolding didn’t work, so she gave the worst offender a title, made him her “detective”, and put him in charge of keeping trespassers off. He took the job seriously and the problem stopped.',
    story: {
      who: 'Napoleon Bonaparte',
      when: '1802–1805',
      text: 'In 1802 Napoleon created the Legion of Honour and began handing its decorations to soldiers. In 1804 he named eighteen of his generals Marshals of the Empire, and he called his army the Grande Armée. Critics complained he was giving toys to hardened veterans. Napoleon replied that men are ruled by toys, or as it is often translated, that it is with baubles that men are led. This can seem cynical, but the technique of giving titles and recognition worked for Napoleon and works in ordinary life, because people want to feel important in what they do.',
    },
    mind: 'People do much more, and much better, when an activity feels chosen and rewarding than when it feels imposed. How a task is framed shapes how it is experienced: the same job can feel like an honour or a burden depending on what it is said to mean. Recognition and a sense of purpose are powerful because they feed the needs to feel valued and to matter. The risk is that external rewards, handed out clumsily, can make people feel controlled and crowd out the pleasure they had in the work.',
    levers: [
      { name: 'Task significance', text: 'Adam Grant and colleagues found that university fundraising callers who spent a few minutes meeting a student whose scholarship their work had funded went on to spend much more time on the phone and raise far more money than those who didn’t. Seeing who benefits made the same job feel worth doing.' },
      { name: 'The overjustification effect', text: 'Mark Lepper, David Greene and Richard Nisbett found that preschoolers who were promised a reward for drawing with markers later chose to draw with them less than children who were not. Rewards that feel like payment can turn play into work, so the best “baubles” are recognition of something people already care about.' },
      { name: 'Recognition and status', text: 'People care about standing and respect, not just money. Titles, public thanks and responsibility signal that someone matters, which is why Napoleon’s medals and the boy’s “detective” badge worked.' },
    ],
    traps: [
      { id: 'framing', how: 'A request framed as an opportunity feels different from the same request framed as a duty. The principle here is honest framing: finding the real benefit and putting it first.' },
      { id: 'endowment', how: 'A title or responsibility makes the job feel owned, and people protect what is theirs. The boy-detective guarded the lawn because, in a sense, it had become his.' },
    ],
    laws: [
      { n: 13, how: 'The law says when asking for help, appeal to self-interest rather than mercy or gratitude. The principle agrees completely, but insists the benefit must be real, not a promise you don’t intend to keep.' },
      { n: 32, how: 'The law advises feeding people’s fantasies of glory. Napoleon’s medals did just that. The principle’s gentler version gives recognition that matches something true about the person’s contribution, not an illusion.' },
    ],
    study: {
      who: 'Dan Ariely, George Loewenstein and Drazen Prelec, 2006',
      title: 'Tom Sawyer and the construction of value',
      text: 'Named after Mark Twain’s boy who convinced his friends that whitewashing a fence was a privilege worth paying for. Ariely offered students a short poetry reading. Half were first asked whether they would pay a small sum to hear it; the other half whether they would attend if paid the same sum. Later, those first asked about paying were willing to pay for readings, while those first asked about being paid wanted money to attend. The same experience was a treat or a chore depending on how it was introduced. The sums were small and the setting a classroom, but it shows how much framing shapes what people think a task is worth, which is exactly why it must be used honestly.',
    },
    today: [
      'Asking a colleague to lead a project because it will give them the visibility they’ve said they want',
      'Giving a child the “job” of choosing the route on a family walk instead of dragging them along',
      'Inviting a volunteer to run the welcome desk because they are the friendliest face the group has',
      'Asking an open-source contributor to become a maintainer of the module they know best',
    ],
    scenario: 'A school needs someone to organise the end-of-year concert, a job nobody wants. The head notices that one of the music teachers has been complaining his ensemble never gets heard. She asks him to direct the concert and to close it with his ensemble’s performance. He spends the spring on it gladly, and the concert is the best the school has had in years.',
    practice: [
      'Before your next request, write down what the other person actually gains from it, and lead with that',
      'Offer a real title or responsibility to someone who keeps doing a thankless job, and mean it',
      'Turn one chore at home into a choice: let the other person pick which task they take',
    ],
    slips: [
      'Inventing benefits that don’t exist, which people discover and never forget',
      'Handing out empty titles that come with no real respect or authority',
      'Making it so obviously a sales pitch that the person feels handled rather than valued',
    ],
    shadow: 'This is where the principle comes closest to pure manipulation: the art of making people glad to do what you wanted all along. Titles and baubles can be cheap substitutes for fair pay or real respect, and framing can make a bad deal look like a gift. If there is truly nothing in it for them, the honest thing is to say so, ask plainly, and be grateful if they help anyway.',
    honest: 'You look for what would genuinely make the task good for the other person, and if you can’t find anything, you ask them as a favour and acknowledge it as one.',
    question: 'The next thing you ask of someone: what would make them glad, not just willing, to do it?',
    hard: 5, everyday: 8, kin: [3, 9, 16, 25],
  },
];
