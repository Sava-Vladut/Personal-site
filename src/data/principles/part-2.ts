// Part 3 of the book, “How to Win People to Your Way of Thinking”: principles 10–21.

import type { Principle } from './types';

export const PRINCIPLES: Principle[] = [
  /* ---------------- 10 ---------------- */
  {
    n: 10, id: 'avoid-argument', title: 'The Only Way to Get the Best of an Argument Is to Avoid It', part: 'convince',
    line: 'You can win the argument or keep the person, and most of the time you cannot do both.',
    gist: 'The claim is blunt: nobody really wins an argument. If you lose, you lose. If you win, the other person feels smaller, resents you for it and usually holds their view more tightly than before. A mind changed against its will stays the same mind. So the book says to treat the urge to argue as a warning light: welcome disagreement as information, hold your first defensive reaction, listen to the end, look for what you agree on, and promise to think it over. The point is not to give up your views but to stop turning conversations into contests where the other person’s pride is the prize.',
    story: {
      who: 'A banquet guest and Frank Gammond',
      when: 'London, shortly after the First World War',
      text: 'At a banquet in honour of the aviator Sir Ross Smith, the man seated next to one guest told a story that hung on the line “There’s a divinity that shapes our ends, rough-hew them how we will,” and said it came from the Bible. The guest knew it was Shakespeare and said so. The man insisted. On the guest’s other side sat his old friend Frank Gammond, who had spent years studying Shakespeare. Asked to settle it, Gammond kicked him under the table and said the gentleman was right: it was from the Bible. On the way home he admitted it was from Hamlet, of course. But they were guests at a happy occasion, he said, and the man had not asked for a correction. Why prove him wrong and make him dislike you?',
    },
    mind: 'An argument does not feel like an exchange of information from the inside. It feels like a threat. When a belief we hold is attacked, especially one tied to who we are, the brain responds much as it does to other social dangers: the heart rate rises, attention narrows and the goal quietly shifts from finding the truth to not losing. In that state people stop weighing the other side’s points and start hunting for flaws in them. Each side hears the other getting louder and concludes that they are the unreasonable one. The audience matters too: backing down in front of others costs face, so the more public the fight, the more fixed both positions become.',
    levers: [
      { name: 'Psychological reactance', text: 'Jack Brehm argued in 1966 that when people feel their freedom to think or choose is being taken away, they push back to restore it, often by valuing the threatened option more. A hard push to change someone’s mind is exactly that kind of threat. Stepping back from the fight removes the thing they are pushing against.' },
      { name: 'Identity-protective cognition', text: 'Dan Kahan and colleagues found that people process evidence in ways that protect their standing in groups they care about. When a fact threatens that standing, smarter people are often better at explaining it away. An argument that frames the issue as “your side versus mine” makes it an identity question, and identity rarely loses.' },
      { name: 'Face', text: 'The sociologist Erving Goffman described “face” as the public image a person claims in an interaction, which everyone present works to keep intact. Winning an argument usually means taking someone’s face in public. People will defend a wrong position for a long time rather than pay that price.' },
    ],
    traps: [
      { id: 'confirmation', how: 'In a heated exchange both people search only for the points that prove them right. Avoiding the fight lowers the stakes enough for each to look at the evidence they were ignoring.' },
      { id: 'perseverance', how: 'A belief that has just been defended out loud is harder to drop than one that was never challenged. Every round of argument gives the other person new reasons, invented on the spot, to stay where they are.' },
      { id: 'naive-realism', how: 'Each side assumes it sees the world as it is, so the other must be biased, ignorant or stubborn. Declining to argue is a way of admitting you might be the one who is not seeing clearly.' },
    ],
    laws: [
      { n: 9, how: 'The law says the same thing in harder language: a victory won by argument is hollow, because the resentment it leaves behind outlasts the point you scored. The law would have you demonstrate instead; the principle would have you listen first. Both agree that words fired at someone’s pride rarely land.' },
    ],
    study: {
      who: 'Charles Lord, Lee Ross and Mark Lepper, 1979',
      title: 'Biased assimilation and attitude polarisation',
      text: 'Stanford students who either supported or opposed the death penalty read descriptions of two studies on whether it deterred murder, one seeming to show it did and one that it did not. Each side rated the study that agreed with them as better designed and picked holes in the other. Asked afterwards, both groups said they had become more convinced of their original view. The same mixed evidence pushed them further apart. Later work found that measured attitude change is often smaller than what people report, but the core finding, that people judge evidence by whether it suits them, has held up well.',
    },
    today: [
      'Letting a relative’s wrong fact pass at a family dinner rather than looking it up at the table',
      'Closing a reply box under a post that made you angry instead of hitting send',
      'Saying “Let me think about that” in a meeting when your first instinct is to rebut',
      'In a couple’s fight about who forgot what, dropping the scorekeeping and asking what the other needs',
    ],
    scenario: 'In a team retrospective a senior engineer insists the outage was caused by the new library, though Priya has the logs that show otherwise. She says, “That’s possible, and I want to look into it properly,” and moves the meeting on. The next morning she sends him the logs privately with a question rather than a verdict, and he replies an hour later with a fix of his own.',
    practice: [
      'The next time you feel the heat of “but that’s wrong”, wait three breaths and ask a question instead',
      'Pick one recurring argument in your life and write down what the other person is actually worried about',
      'End a disagreement this week with “You’ve given me something to think about” and mean it',
    ],
    slips: [
      'Going silent but sulking, which is still an argument, just a quiet one',
      'Avoiding every disagreement, so people stop telling you things you need to hear',
      'Saying “I’m not going to argue with you” in a tone that wins the argument anyway',
    ],
    shadow: 'Taken as a rule for everything, this becomes conflict avoidance: you let errors stand at work, swallow your views at home and call it wisdom. Some disagreements need to be had, about safety, money, ethics or a decision you will all live with. And refusing to engage can itself be a power move, a way of signalling that the other person is not worth arguing with. The book’s advice is about the fight, not the disagreement.',
    honest: 'Disagree openly when it matters, but without needing to win. Treat the other person’s view as information, look for the part that is true, and give them room to change their mind later, in private, without having to admit they lost.',
    question: 'Think of the last argument you won. Did the other person actually change their mind, or did they just stop talking?',
    hard: 8, everyday: 9, kin: [11, 12, 17, 26],
  },
  /* ---------------- 11 ---------------- */
  {
    n: 11, id: 'never-wrong', title: 'Show Respect for the Other Person’s Opinions. Never Say “You’re Wrong”', part: 'convince',
    line: '“You’re wrong” is not information. It is a challenge, and people answer challenges by digging in.',
    gist: 'Telling someone they are wrong, by word, look or tone, is telling them you are smarter than they are. The book says that strikes at their judgement and pride and makes them want to strike back, which leaves no room for them to change their mind. If you think someone is mistaken, it says, open with something like “I may be wrong, I often am, let’s look at the facts.” It is hard to argue with someone who has already admitted they might be wrong. And the habit has a second benefit: you often discover you were the one who had it wrong.',
    story: {
      who: 'Benjamin Franklin',
      when: 'Philadelphia, the 1720s and 1730s',
      text: 'As a young man Franklin loved to win debates and was good at it. Then an old Quaker friend took him aside and told him plainly that he had become unbearable: his opinions were so blunt and sure that his friends enjoyed themselves more when he was not around, and no one bothered to tell him anything any more. Franklin took it to heart. He made a rule to forbid himself every direct contradiction and every flat assertion. He dropped words like “certainly” and “undoubtedly” in favour of “I imagine” or “it appears to me at present”. He later wrote in his autobiography that conversations became more pleasant, people accepted his proposals more readily, and he found it easier to give way when he was the one in the wrong.',
    },
    mind: 'A person’s opinions are not just ideas they carry around. They are part of how they see themselves: as someone sensible, informed and good. An attack on the opinion lands as an attack on the self, and the mind defends the self first and thinks about the facts later. Respect lowers that defence. When people feel their intelligence is taken seriously, they can afford to consider that they might have missed something. Admitting your own uncertainty also changes the frame: the conversation stops being a test of who is smarter and becomes two people looking at a problem together.',
    levers: [
      { name: 'Self-affirmation', text: 'Geoffrey Cohen, David Sherman and colleagues found that people who first reflected on a value important to them were more open to evidence against their views. Feeling secure in their worth, they had less need to defend every belief. Respect from the other person can do some of the same work.' },
      { name: 'Intellectual humility', text: 'Mark Leary and colleagues found in 2017 that people who are more aware their beliefs might be wrong weigh evidence more carefully and judge others less harshly for changing their minds. Showing that awareness yourself invites it from the other person.' },
      { name: 'Hedged language', text: 'Saying “it seems to me” rather than “it is” signals that your claim is open to revision. It makes room for the other person to add something rather than simply accept or reject what you said.' },
    ],
    traps: [
      { id: 'naive-realism', how: 'We assume our view is simply how things are, so anyone who disagrees must be misinformed. Saying “I may be wrong” is a direct check on that assumption, out loud.' },
      { id: 'blind-spot', how: 'It is easy to see bias in the person across the table and hard to see it in yourself. Respecting their opinion leaves room for the possibility that the blind spot is yours.' },
      { id: 'motivated', how: 'A person who feels attacked starts reasoning towards the conclusion that protects them. Without the attack, there is less to protect and more chance they will follow the evidence.' },
    ],
    laws: [
      { n: 1, how: 'The law warns never to make the master feel less clever than you. The principle widens that warning to everyone: correcting anyone bluntly makes them feel smaller, and people rarely forgive that. The law’s reason is self-protection; the principle’s is that it simply does not work.' },
      { n: 38, how: 'The law advises thinking what you like but not flaunting views that put others on the defensive. The principle agrees about the flaunting but goes further: hold your own views more lightly, too, because you may be the one in the wrong.' },
    ],
    study: {
      who: 'Brendan Nyhan and Jason Reifler, 2010; Thomas Wood and Ethan Porter, 2019',
      title: 'When corrections fail, and when they do not',
      text: 'Nyhan and Reifler gave participants a mock news article in which President Bush implied Iraq had weapons of mass destruction. Some versions included a correction citing the official report that no such weapons were found. Among the most conservative participants, the correction seemed to increase belief in the weapons, which became famous as the “backfire effect”. But when Wood and Porter tested corrections on more than 10,000 people across dozens of issues, they found backfire was rare: most people moved at least somewhat towards the facts, even on politically charged topics. Nyhan himself later agreed backfire is uncommon. Correction usually works a little; it is the humiliation that tends to fail.',
    },
    today: [
      'Replying to a colleague’s flawed plan with “Can you walk me through how this handles X?” instead of “That won’t work”',
      'Telling your partner “I remember it differently” rather than “That’s not what happened”',
      'Starting a comment under a post with “I might be missing something, but…”',
      'Correcting a student by asking how they got their answer before saying it is wrong',
    ],
    scenario: 'A client is certain their website traffic fell because of a competitor’s new advert. The analyst thinks it was a broken tracking code. Instead of saying so, she says, “You may well be right, and I could be wrong here. Can we check one thing together first?” They open the analytics side by side, and the client is the one who spots the missing code.',
    practice: [
      'Go one full day without saying “you’re wrong”, “no, actually” or “that’s not true”',
      'When you disagree, first say back the strongest version of their point',
      'Write down one opinion you held firmly five years ago and have since changed',
    ],
    slips: [
      'Saying “I may be wrong” as a sarcastic preface to proving them wrong',
      'Respecting their opinion in words while your face shows contempt',
      'Being so soft that a dangerous error goes uncorrected',
    ],
    shadow: 'Fake humility is easy to spot and worse than honest disagreement: people feel handled. And there are times when the plain words “that is wrong” are the kind ones, in medicine, in safety, or when someone is about to make a costly mistake and needs to hear it clearly. Respect for a person’s opinion does not mean pretending every opinion is equally good.',
    honest: 'Disagree with the idea, not the person, and genuinely hold open the chance that you are the one who has it wrong. Ask questions you want the answers to, and when you are sure, say so with enough warmth that the other person can change their mind without losing face.',
    question: 'When someone tells you that you are wrong, what do you feel first: curiosity or the urge to defend yourself?',
    hard: 8, everyday: 9, kin: [10, 1, 23, 26],
  },
  /* ---------------- 12 ---------------- */
  {
    n: 12, id: 'admit-wrong', title: 'If You Are Wrong, Admit It Quickly and Emphatically', part: 'convince',
    line: 'Say the harsh thing about yourself before anyone else can, and they will usually rush to soften it.',
    gist: 'When you know you are in the wrong, the book says, the best defence is to give none. Admit it, quickly and fully, before the other person has the chance to say it. It takes the wind out of their anger: there is nothing left to prove, and most people respond to a frank admission by becoming generous. Fools try to defend their mistakes, it says, and most fools do. Owning up gives you a kind of dignity that excuses never do, and it is a relief besides, because you no longer have a position to defend.',
    story: {
      who: 'A dog owner and a mounted policeman',
      when: 'Forest Park, New York, 1930s',
      text: 'A dog owner liked to take his small dog, Rex, to a wooded park near his home and let Rex run without a leash or muzzle. One day a mounted policeman stopped him and warned him that next time it would be a court fine. He obeyed for a while, then slipped back. Soon he was caught again. This time he did not wait. He said straight away that the officer had caught him red-handed, that he had no excuses, and that he had been warned. The policeman’s tone changed at once. He said he understood the temptation when no one was around, that a little dog like that was harmless, and suggested he just let the dog run over the hill where he would not see it. The man went home without a fine.',
    },
    mind: 'An accuser needs a defendant. When you argue, you give the other person someone to fight and every reason to press their case. When you admit the fault in stronger terms than they would have used, you take that role away. They no longer need to establish your guilt, so they are free to do the thing people like to do once they have the upper hand: be generous. There is also a cost to defending a mistake. Every excuse commits you further to a position you know is weak, and the other person can see it. A quick admission looks like confidence; a long defence looks like fear.',
    levers: [
      { name: 'The pratfall effect', text: 'Elliot Aronson found in 1966 that a highly competent person who made a small blunder was liked more afterwards, while a mediocre person making the same blunder was liked less. A mistake, owned openly by someone who is otherwise capable, makes them more human. Later studies found the effect depends a lot on who is judging and how serious the mistake is.' },
      { name: 'Credibility through candour', text: 'People who volunteer bad news about themselves seem more trustworthy about everything else. When you own one fault without being asked, your account of the rest gains weight.' },
      { name: 'Reciprocity of concession', text: 'A frank admission is a concession, and concessions invite concessions in return. Robert Cialdini’s work on reciprocity shows how strongly people feel pulled to match a step taken towards them.' },
    ],
    traps: [
      { id: 'self-serving', how: 'We instinctively blame bad outcomes on circumstance and other people. Admitting fault quickly is a deliberate break with that reflex, and people notice how rare it is.' },
      { id: 'spotlight', how: 'We imagine our mistakes are more glaring and more damaging to our image than they are. Owning them often costs far less than the dread we feel beforehand.' },
      { id: 'sunk-cost', how: 'Having already defended a mistake, we feel we must keep defending it to justify the effort. An early admission stops that investment before it grows.' },
    ],
    laws: [
      { n: 26, how: 'The law says keep your hands clean: let a scapegoat or a cat’s paw carry the blame. The principle says pick up the blame yourself, at once. The law protects your image in the short run; the principle bets that people trust the person who owns their mistakes, and that trust lasts longer.' },
      { n: 46, how: 'The law warns that seeming flawless breeds envy and suspicion, and advises showing a harmless weakness. An honest admission does that naturally, without the calculation.' },
    ],
    study: {
      who: 'Fiona Lee, Christopher Peterson and Larissa Tiedens, 2004',
      title: 'Mea culpa: predicting stock prices from organisational attributions',
      text: 'The researchers analysed the annual reports of companies explaining bad results. Some blamed outside forces they could not control, such as the economy or regulation; others blamed their own decisions. Companies that took the blame had higher stock prices a year later. In a lab follow-up, people who read a self-blaming report saw the company as more in control of its fate and rated its prospects better. The data are correlational, and what seemed to help was blaming causes the company could control, which suggested it could fix them, but the pattern fits the principle: admitting fault read as strength, not weakness.',
    },
    today: [
      'Starting an email to a client with “We got this wrong, and here’s what we’re doing about it”',
      'Telling your partner “You’re right, I was short with you, and you didn’t deserve it” before they raise it',
      'A developer posting “My change caused the outage” in the incident channel before anyone asks',
      'Apologising to your child when you lost your temper, without adding “but you…”',
    ],
    scenario: 'Mark forgot to book the restaurant for his sister’s birthday, and she found out when they arrived. Before she could say anything he said, “I completely dropped this. You asked me twice and I said I’d handle it. That’s on me.” She laughed, said she had a back-up place in mind anyway, and the evening went on as if nothing had happened.',
    practice: [
      'The next time you make a small mistake at work, report it yourself before it is found',
      'Practise an apology with no “but” in it, and no explanation unless one is asked for',
      'Notice the urge to explain why it was not really your fault, and let it pass once',
    ],
    slips: [
      'Admitting the mistake and then spending five minutes on why it was understandable',
      'Overdoing it until the other person has to comfort you',
      'Using a fast admission as a tactic to dodge the real consequences',
    ],
    shadow: 'Quick confession can become a trick: say sorry fast, look disarming, and avoid ever being held to account. People catch on, and an apology that never changes anything loses its value. It can also tip into taking blame that is not yours, which helps no one and can be used against you. Research by Tyler Okimoto and colleagues even found that refusing to apologise can make people feel more powerful in the moment, which explains why so many people do not do it, but not why they should not.',
    honest: 'Admit your real mistakes plainly, take your share and no more, and follow through on putting things right. The aim is not to manage the other person’s anger but to tell them the truth and repair what you broke.',
    question: 'What mistake are you still quietly defending that you could simply own?',
    hard: 8, everyday: 7, kin: [24, 10, 11, 26],
  },
  /* ---------------- 13 ---------------- */
  {
    n: 13, id: 'friendly', title: 'Begin in a Friendly Way', part: 'convince',
    line: 'A drop of honey catches more flies than a gallon of gall, and the first drop matters most.',
    gist: 'If someone’s heart is set against you, the book says, no amount of logic will bring them round. If you want someone to come to your way of thinking, start by showing that you are on their side: friendly, calm, appreciative. The book borrows the old fable of the sun and the wind competing to make a traveller take off his coat. The wind blew harder and the man held his coat tighter; the sun shone gently and the man took it off. Opening with warmth is not weakness, it argues. It is simply the only way into a mind that would otherwise close.',
    story: {
      who: 'John D. Rockefeller Jr. and the Colorado miners',
      when: '1914–1915',
      text: 'The strike at the Rockefeller-controlled Colorado Fuel and Iron Company was one of the bloodiest in American history. In April 1914 militiamen attacked a tent colony of striking miners at Ludlow, and women and children died in the fire. The Rockefeller name was hated in the coalfields. In 1915 the younger Rockefeller went to Colorado himself. He toured the camps, visited miners’ homes and met their families. Then he spoke to a gathering of the miners’ representatives, opening by saying how proud he was to be there and that, having visited them, he felt he met them as friends. He went on to propose a plan for workers’ representation. The story is often told as an example of how a friendly approach could turn a crowd that had wanted to hang him into listeners.',
    },
    mind: 'People decide very quickly whether someone is a friend or a threat, and that decision colours everything that follows. Research on first impressions suggests warmth is judged before competence, and that once someone seems hostile, even reasonable proposals sound like traps. A friendly opening lowers the guard before the content arrives. It also sets up a norm: when one person is warm, the other feels pulled to match it, and it becomes awkward to be hostile to someone who is being kind to you.',
    levers: [
      { name: 'Warmth first', text: 'Susan Fiske, Amy Cuddy and Peter Glick found that people judge others on two main dimensions, warmth and competence, and that warmth is judged first and weighs more. Before we care whether someone is capable, we want to know whether they mean us well.' },
      { name: 'The primacy effect', text: 'Solomon Asch showed in 1946 that the same list of traits produced a better impression when the positive ones came first. Early information sets the frame through which later information is read. A friendly opening becomes the lens for everything you say after it.' },
      { name: 'Emotional contagion', text: 'Elaine Hatfield and colleagues described how people unconsciously catch the moods of those around them through facial expressions, voice and posture. Calm and warmth spread, and so do irritation and suspicion.' },
    ],
    traps: [
      { id: 'halo', how: 'A warm first impression spills over onto everything else: your proposal seems more reasonable because you seem decent. The principle is using the halo deliberately.' },
      { id: 'anchoring', how: 'The tone of the first minute anchors the whole conversation. Start cold and every later attempt at warmth has to climb back from there.' },
      { id: 'negativity', how: 'A hostile word weighs more than a kind one, and is remembered longer. Starting friendly means the first thing they file away is not a threat.' },
    ],
    laws: [
      { n: 12, how: 'The law advises a show of generosity or honesty to lower someone’s guard before you take what you want. The principle’s friendly opening uses the same mechanism, which is exactly why it must be sincere: done as a trick, it is the law under a nicer name.' },
      { n: 43, how: 'The law says to work on hearts and minds rather than force obedience. The principle agrees that hearts come first, and that a person who feels liked is already halfway to being persuaded.' },
    ],
    study: {
      who: 'Harold Kelley, 1950',
      title: 'The warm–cold variable in first impressions',
      text: 'Students at MIT were told a guest lecturer would take their class and given a short note about him. The notes were identical except that one version described him as “rather cold” and the other as “very warm”. After the same twenty-minute discussion with the same man, students who had read “warm” rated him as more considerate, more sociable and better humoured, and more of them took part in the discussion. A single word before he arrived changed how people saw him and how they behaved towards him.',
    },
    today: [
      'Opening a tense negotiation by thanking the other side for making the time',
      'Starting a complaint to customer service with “I know this isn’t your fault”',
      'Greeting a teenager warmly before raising the state of their room',
      'Beginning a code review with what the change does well',
    ],
    scenario: 'Hana’s neighbour has been parking across her driveway for weeks. She knocks on his door with a tin of biscuits she had baked anyway, chats about the building works down the street, then mentions that she sometimes needs to get her car out early. He apologises before she has finished, and the driveway has been clear ever since.',
    practice: [
      'Before a difficult conversation, write down one thing you genuinely like or respect about the other person',
      'Spend the first minute of your next hard conversation on something other than the problem',
      'Notice how you open emails asking for something, and soften one that starts abruptly',
    ],
    slips: [
      'Being friendly for thirty seconds before launching into an attack, which feels like an ambush',
      'Using warmth that is obviously forced, so it reads as a sales technique',
      'Being so friendly that the actual point never gets made',
    ],
    shadow: 'Friendliness is the con artist’s first tool, and the warmer the opening, the less people check what follows. Rockefeller’s visit did real good for the miners in some ways, but critics at the time saw the plan he brought as a way to keep out an independent union. Warmth can disarm people into agreeing to things that are not in their interest. And sometimes it is wiser to be direct from the start, when warmth would only blur a message that has to be heard.',
    honest: 'Start friendly because you actually wish the other person well, and let the friendliness carry on after you have got what you came for. Warmth that only lasts until the deal is signed was never warmth.',
    question: 'With whom do you start every conversation already braced for a fight, and how might they experience that?',
    hard: 4, everyday: 8, kin: [5, 22, 18, 10],
  },
  /* ---------------- 14 ---------------- */
  {
    n: 14, id: 'yes-yes', title: 'Get the Other Person Saying “Yes, Yes” Immediately', part: 'convince',
    line: 'Start with what you agree on. Every “yes” makes the next one easier; every “no” has to be defended.',
    gist: 'When you talk with someone, the book says, do not begin with the things you disagree on. Begin with what you share, and keep coming back to it: you both want the same outcome, you differ only on how. A “no” is a hard obstacle to get over, because once a person has said it their pride demands they stand by it. A run of “yes” answers, by contrast, sets them moving in the direction of agreement. The skilled speaker, it adds, gets a number of yes responses at the start and the listener’s whole mind goes along.',
    story: {
      who: 'Socrates',
      when: 'Athens, 5th century BC',
      text: 'Socrates, as Plato and Xenophon portray him, is the master of this method. Socrates rarely told anyone they were wrong. Instead he asked questions his partner could easily agree with: does a doctor practise medicine for the patient’s good? Does a shepherd care for the sheep? Each answer was a yes, and each yes built on the last, until the other person found themselves agreeing to a conclusion they would have rejected flatly a few minutes earlier. Socrates was eventually tried and executed, which is a reminder that the method can annoy as well as persuade, but it shaped Western teaching for two and a half thousand years.',
    },
    mind: 'People like to be consistent. Once we have said something out loud, we feel pressure to act and think in line with it, partly to look reliable to others and partly to feel coherent to ourselves. A series of agreements builds a picture of the conversation as a shared one: we are on the same side, we see things the same way. A “no”, on the other hand, commits the person to a position they then feel bound to defend. The principle’s claim that a “no” tenses the whole body is not well supported, but the core idea, that early commitments shape later ones, is.',
    levers: [
      { name: 'Commitment and consistency', text: 'Robert Cialdini describes the drive to be consistent with what we have already said and done as one of the strongest levers of influence. Small agreements early on set a direction that is uncomfortable to reverse.' },
      { name: 'Self-perception', text: 'Daryl Bem proposed that people learn their own attitudes partly by watching their behaviour. Someone who hears themselves agreeing repeatedly begins to see themselves as someone who agrees with you.' },
      { name: 'Common ground', text: 'Stressing shared goals turns the other person from opponent into partner. It also makes the remaining disagreement look smaller: a question of method among people who want the same thing.' },
    ],
    traps: [
      { id: 'framing', how: 'Starting with shared goals frames the whole discussion as cooperation. The same proposal sounds different after five agreements than after an opening dispute.' },
      { id: 'perseverance', how: 'Once someone has said “no”, they will defend that position even against good evidence. The best way round the trap is not to set it off in the first place.' },
    ],
    laws: [
      { n: 31, how: 'The law advises controlling the options so that every choice leads where you want. A string of yes questions can do the same. That is why it matters whether the questions are honest steps to a shared conclusion or a corridor built to trap someone.' },
    ],
    study: {
      who: 'Jonathan Freedman and Scott Fraser, 1966',
      title: 'Compliance without pressure: the foot-in-the-door technique',
      text: 'Researchers phoned homemakers in Palo Alto and asked a few simple questions about the household products they used. A few days later they called again with a much bigger request: could a team of five or six men come to the house for two hours to list every product in their cupboards? About 53 per cent of those who had answered the first questions agreed, compared with about 22 per cent of people asked cold. In a second study, people who had signed a petition or put up a small sign were far more likely to accept a large, ugly road-safety board in their front garden. Later reviews found the foot-in-the-door effect is real but often modest, and it weakens or vanishes when the first request is too small or too pushy.',
    },
    today: [
      'Opening a budget discussion with “We both want this launch to land on time, right?”',
      'A salesperson confirming the problem the customer described before suggesting a product',
      'Agreeing on what a fair outcome would look like before negotiating the details',
      'In a disagreement with a partner, starting with “We both want the kids to feel safe”',
    ],
    scenario: 'Ana wants her landlord to replace the broken boiler rather than patch it again. She begins by asking whether he wants the flat to keep its value, whether he would rather not pay for repeat call-outs, and whether a winter breakdown would be a headache for him too. By the time she mentions the price of a new boiler, he is the one suggesting they book it before the cold sets in.',
    practice: [
      'Before your next disagreement, list three things you and the other person already agree on, and start with them',
      'Turn one statement you were going to make into a question the other person can say yes to',
      'Notice when you have provoked an early “no” and how hard it was to move past',
    ],
    slips: [
      'Asking leading questions so obvious that the other person feels manipulated',
      'Collecting yeses on trivia that have nothing to do with the real issue',
      'Ignoring a real objection because it spoils the run of agreement',
    ],
    shadow: 'This is a staple of pushy sales scripts: “You want to save money, don’t you? You care about your family?” When the questions are a trap, people feel it, and they say no on principle. A string of yes answers can also bury genuine doubts that ought to be aired. Sometimes the most useful thing is to bring the disagreement out early, so it can be dealt with honestly.',
    honest: 'Look for the agreement that really exists, start from it, and build the rest together. Ask questions you are genuinely curious about, and if the honest answer is “no”, take it seriously.',
    question: 'In the argument you keep having with someone close to you, what do you both actually agree on?',
    hard: 5, everyday: 6, kin: [16, 13, 3],
  },
  /* ---------------- 15 ---------------- */
  {
    n: 15, id: 'let-them-talk', title: 'Let the Other Person Do a Great Deal of the Talking', part: 'convince',
    line: 'People are rarely persuaded by what you say to them. They are persuaded by what they hear themselves say.',
    gist: 'Most of us, trying to win someone over, talk too much. The book says to do the opposite. Let them talk themselves out: they know more about their business and their problems than you do. Ask questions and listen patiently, especially when they disagree, because they will not hear you while they still have things they want to say. Even friends, it notes, would rather talk about their own achievements than listen to yours. Give people the floor and they will often argue their way to your conclusion, or show you why yours was wrong.',
    story: {
      who: 'A fabric salesman with laryngitis',
      when: 'United States, 1930s',
      text: 'A salesman was bidding, against rivals, to supply upholstery fabric for a year to one of the big American car makers. On the day he was due to present, he woke with laryngitis so bad he could barely whisper. In the meeting he wrote a note saying he had lost his voice and could not speak. The company’s president said he would speak for him. He opened the samples, praised their qualities and argued the case to his own colleagues, while the salesman simply smiled, nodded and made a few gestures. The salesman won the contract, the largest of his career, and later said he would probably have lost it if he had been able to talk.',
    },
    mind: 'Talking about our own views and experiences is rewarding in itself: it lights up the same brain circuits as food and money. A person who is allowed to talk feels heard, and a person who feels heard relaxes. There is also a deeper effect. When people explain their position in their own words, they often notice its weak points without anyone pointing them out, and a conclusion they reach out loud feels like their own. Meanwhile the listener gathers the one thing a talker never gets: information about what the other person actually wants.',
    levers: [
      { name: 'Self-disclosure reward', text: 'Diana Tamir and Jason Mitchell found in 2012 that talking about oneself activates reward regions in the brain, and that people would give up small sums of money to do it. Letting someone talk gives them something they value.' },
      { name: 'The illusion of explanatory depth', text: 'Leonid Rozenblit and Frank Keil found that people think they understand things much better than they do, until asked to explain them step by step. Asking someone to walk you through their plan can show them its gaps more gently than any criticism.' },
      { name: 'Feeling understood', text: 'Studies of “perceived responsiveness” by Harry Reis and others find that people who feel understood by a partner trust them more and are more open to their influence. Listening is how that feeling is built.' },
    ],
    traps: [
      { id: 'curse', how: 'Once you know something, it is hard to imagine not knowing it, so you over-explain and lose the listener. Letting them talk shows you where they actually are.' },
      { id: 'spotlight', how: 'We think others are paying close attention to what we say. Mostly they are waiting for their turn. Give them the turn and they start listening.' },
    ],
    laws: [
      { n: 4, how: 'The law says always say less than necessary, so others reveal themselves and your words carry more weight. The principle reaches the same practice from the other side: say less so the other person can feel heard.' },
      { n: 14, how: 'The law’s spy listens to gather weapons. The principle’s listener gathers understanding. The behaviour looks the same; what you do with what you hear decides which law you are following.' },
    ],
    study: {
      who: 'Karen Huang, Michael Yeomans, Alison Wood Brooks, Julia Minson and Francesca Gino, 2017',
      title: 'It doesn’t hurt to ask: question-asking increases liking',
      text: 'In online chats between strangers, the researchers instructed some participants to ask many questions and others to ask few. Those who asked more questions, especially follow-up questions that built on what their partner had just said, were liked more by their partners. In recordings of real speed dates, people who asked more follow-up questions got more second-date offers. Yet in other studies, people did not predict that asking questions would make them more likeable. We underrate how much others enjoy being asked about themselves.',
    },
    today: [
      'In a job interview, asking what the team’s biggest headache is and then listening',
      'Letting a grieving friend tell the story again without steering it',
      'On a sales call, spending the first half asking about the customer’s problem',
      'With a teenager, asking one open question in the car and then saying nothing for a while',
    ],
    scenario: 'A new manager meets each of her six reports for an hour in her first week. She opens with “What’s working, and what drives you mad?” and mostly takes notes. By Friday she has a list of problems nobody had raised in meetings, and two of the team have offered to fix the worst of them.',
    practice: [
      'In your next conversation, ask at least two follow-up questions before giving your own view',
      'When someone disagrees with you, let them finish completely, then ask “What else?”',
      'After a conversation, guess what share of the time you were talking, and aim to lower it next time',
    ],
    slips: [
      'Being silent while visibly waiting to talk, which people can feel',
      'Asking questions only to set up your own point',
      'Letting someone talk so long that the conversation never gets anywhere',
    ],
    shadow: 'Listening can be used as a technique for extracting information, which is how interrogators and con artists use it. And never sharing your own view can feel withholding, even manipulative: the other person opens up and gets nothing back. In some settings, like a crisis or a decision that needs making now, someone has to talk, and long listening is just delay.',
    honest: 'Let people talk because you want to understand them, and when it is your turn, speak plainly. A conversation is a trade: give them room, then give them yourself.',
    question: 'Who in your life always seems to be talking when you see them, and when did you last ask them a question you did not already know the answer to?',
    hard: 6, everyday: 9, kin: [7, 16, 9, 4],
  },
  /* ---------------- 16 ---------------- */
  {
    n: 16, id: 'their-idea', title: 'Let the Other Person Feel That the Idea Is Theirs', part: 'convince',
    line: 'An idea you hand someone is yours. An idea they find is theirs, and they will fight for it.',
    gist: 'People trust conclusions they reached themselves far more than ones they were given. So the book says: do not force your opinions on others. Make suggestions, ask questions, and let them think it out. Bring them the raw materials and let them build the conclusion. Their commitment to it will be much stronger than if you had argued it, and you get what you wanted. The price is the credit, which, it says, you should be glad to give away.',
    story: {
      who: 'Colonel Edward House and President Woodrow Wilson',
      when: 'Washington, 1913–1919',
      text: 'Edward House was Wilson’s closest adviser and had more influence over him than most of the cabinet. He explained his method to a journalist: he had learned that the way to convert the President to an idea was to plant it casually, so that it caught his interest and he started thinking about it on his own. The first time it happened, House suggested a policy that Wilson seemed to reject. A few days later, at dinner, House was surprised to hear Wilson put forward the very same idea as his own. House did not interrupt to say it was his. He cared about the policy, not the credit, and let Wilson own it.',
    },
    mind: 'Ownership changes how we value things, including ideas. Something we helped create feels more worthwhile and more trustworthy, partly because we know the reasoning behind it and partly because it reflects on us. When an idea is pressed on us from outside, the mind looks for reasons to resist it. When we arrive at it ourselves, the mind looks for reasons to defend it. People also remember the arguments they generate better than the ones they hear, so self-reached conclusions last longer.',
    levers: [
      { name: 'The IKEA effect', text: 'People value what they help make. Michael Norton and colleagues found that the labour of building something, even badly, makes us love it more. Ideas work the same way: a plan you helped shape feels better than one handed to you.' },
      { name: 'Self-persuasion', text: 'Elliot Aronson argued that the most lasting persuasion is self-persuasion, where people generate the arguments themselves. Research on “self-generated arguments” supports this: arguments we produce are more convincing to us and more resistant to later attack.' },
      { name: 'Not invented here', text: 'Ralph Katz and Thomas Allen found that research teams which had worked together a long time became less receptive to outside ideas. People resist ideas that did not come from them or their group, so the cure is to let the idea come from them.' },
    ],
    traps: [
      { id: 'endowment', how: 'We overvalue what we own, and an idea we think of as ours is something we own. Letting someone find the idea hands them the endowment.' },
      { id: 'self-serving', how: 'People readily credit themselves for good ideas. The principle stops fighting this tendency and puts it to use.' },
    ],
    laws: [
      { n: 7, how: 'The law says get others to do the work and take the credit yourself. The principle turns it around: do the work and let the other person take the credit. The law gains glory; the principle gains the result, and an ally who believes in it.' },
      { n: 31, how: 'The law advises framing the choices so that people feel free while picking what you want. Planting an idea can drift into exactly that, so it stays honest only if you would genuinely accept a different conclusion.' },
    ],
    study: {
      who: 'Michael Norton, Daniel Mochon and Dan Ariely, 2012',
      title: 'The IKEA effect: when labour leads to love',
      text: 'Participants assembled plain IKEA storage boxes or were given identical ready-made ones. Those who built their own were willing to pay noticeably more for them. In another study, people who folded origami frogs and cranes valued their own clumsy creations almost as highly as models made by experts, while other people thought them nearly worthless. The effect disappeared when participants built something and then had to take it apart, or did not finish it. Completing the work was what made it theirs.',
    },
    today: [
      'Asking your team “What would you change about our onboarding?” when you already have a plan',
      'Showing a client two rough options and letting them combine the best of each',
      'Helping a child work out why their homework is wrong instead of correcting it',
      'Asking a partner “Where would you like to go this summer?” when you were hoping for the sea',
    ],
    scenario: 'Tom thinks his department should move its weekly meeting to a written update. Instead of proposing it, he asks the team what the meeting is really for and which parts could be done without everyone in a room. Within twenty minutes Leila suggests a shared document for status updates and keeping the meeting for decisions. The team adopts “Leila’s plan” and sticks to it.',
    practice: [
      'In your next meeting, ask a question that leads towards your idea instead of stating it',
      'When someone repeats your idea back as their own, let it go and back them',
      'Give someone the problem and three facts, and see what they come up with before sharing your answer',
    ],
    slips: [
      'Asking leading questions so heavy that the other person sees the trick',
      'Resenting it later when they take the credit you gave them',
      'Steering so hard that you never hear the better idea they would have had',
    ],
    shadow: 'This can become manipulation: steering people towards a fixed conclusion while letting them believe they chose freely. When discovered, it breeds deep distrust. It can also become self-erasure, especially for people whose work already goes unrecognised. Giving away credit is generous from a position of security; it is costly for someone whose career depends on being seen.',
    honest: 'Bring people into the thinking early, while the idea is still open, and be willing for it to change in their hands. Share credit freely when it is shared work, and let the plan become theirs because it truly is.',
    question: 'Which of your ideas would you be willing to let someone else take credit for, if it meant the idea actually happened?',
    hard: 7, everyday: 6, kin: [15, 25, 9, 14],
  },
  /* ---------------- 17 ---------------- */
  {
    n: 17, id: 'their-view', title: 'Try Honestly to See Things from the Other Person’s Point of View', part: 'convince',
    line: 'Everyone has a reason for what they do. Find it, and you have the key to their mind.',
    gist: 'Other people may be completely wrong, the book says, but they do not think so. There is a reason why they think and act as they do, and if you can find it, you understand them and often their whole personality. Before you try to change someone’s mind, ask yourself how you would feel and act in their place. You will save yourself time and irritation, and you will speak to what actually moves them instead of what moves you. The book calls this the formula that works wonders, and quotes the idea that success lies in getting the other person’s point of view and seeing things from their angle as well as your own.',
    story: {
      who: 'A man and the boys in the park',
      when: 'Forest Park, New York, 1930s',
      text: 'One man often walked in a park near his home where he loved the oak trees, and he was angry to see small fires lit by boys cooking under them, which could spread and burn the woods. At first he would march up, tell them they could be jailed for lighting fires, and threaten to have them arrested. They obeyed sullenly and, he suspected, lit the fire again as soon as he left. Later he tried something else. He would ask if they were having a good time and what they were cooking, say he had loved building fires as a boy too, and then explain that fires here were dangerous, that he knew they meant no harm but other boys might be careless. He asked them to rake leaves over the embers before they left, and next time to build the fire over the hill in the sandpit. The boys cooperated willingly.',
    },
    mind: 'We see our own actions from the inside, with all their reasons and pressures, and other people’s from the outside, as behaviour only. That gap makes other people seem more unreasonable than they are. Taking their perspective closes it: it brings their constraints, fears and goals into view, which makes their behaviour make sense and shows where they might move. It also changes how you come across. People can tell when someone has tried to understand them, and it makes them far more willing to try to understand back.',
    levers: [
      { name: 'Perspective-taking versus empathy', text: 'Adam Galinsky and colleagues distinguish thinking about what someone else wants (perspective-taking) from feeling what they feel (empathy). In negotiation studies, perspective-taking was the more useful of the two for reaching good deals; strong empathy sometimes led people to give away too much.' },
      { name: 'Perspective-getting', text: 'Tal Eyal, Mary Steffel and Nicholas Epley found in 2018 that imagining yourself in someone’s shoes did not make people better at guessing what others think. What worked was asking them. Seeing things from their point of view starts with finding out what it is.' },
      { name: 'The actor–observer gap', text: 'Edward Jones and Richard Nisbett noted that we explain our own behaviour by the situation and others’ behaviour by their character. Deliberately asking “what situation would make me act like that?” corrects the imbalance.' },
    ],
    traps: [
      { id: 'naive-realism', how: 'We take it for granted that our view is the objective one and that anyone who disagrees must be biased. Looking from their side shows you that they think exactly the same about you.' },
      { id: 'fae', how: 'We blame others’ behaviour on who they are and overlook what they face. Taking their perspective puts the circumstances back into the picture.' },
      { id: 'curse', how: 'What is obvious to you may be invisible to them, and you may not realise it. Seeing their view shows you what they actually know.' },
    ],
    laws: [
      { n: 19, how: 'The law says know who you are dealing with, because people react differently to the same move. The principle agrees that you must understand the person in front of you, but here the point is to meet them, not to avoid stepping on the wrong toes.' },
      { n: 33, how: 'The law is to find each person’s weakness, the thumbscrew that will move them. Seeing someone’s point of view also shows you their needs and fears. The principle uses that knowledge to give people what they want; the law uses it to squeeze.' },
    ],
    study: {
      who: 'Adam Galinsky, William Maddux, Debra Gilin and Judith White, 2008',
      title: 'Why it pays to get inside the head of your opponent',
      text: 'Participants negotiated over things like the sale of a petrol station, where a deal was only possible if they discovered the other side’s underlying interests rather than haggling over price. Those told to imagine what the other side was thinking reached deals more often and found more creative solutions than those told to focus on their own position. Those told to empathise with the other side’s feelings did less well than the perspective-takers. Later work, such as Eyal and colleagues’ 2018 studies, adds a caution: imagining is not knowing, and the most reliable way to see someone’s view is to ask them.',
    },
    today: [
      'Before replying to an angry customer, asking what their day might have looked like',
      'Reading a colleague’s blunt message as a sign of pressure rather than rudeness',
      'Asking a parent what worries them about your plans before defending them',
      'Considering what the other side of a political debate fears losing',
    ],
    scenario: 'A school asks parents to stop parking on the zigzag lines. Letters threatening fines have not worked. The new head stands at the gate one morning and talks to the drivers. She learns most of them are dropping off on the way to early shifts. The school opens the playground fifteen minutes earlier and arranges a drop-off spot round the corner, and the zigzags empty within a week.',
    practice: [
      'Before your next request, write down what the other person might want, fear and need from the situation',
      'Ask someone who disagrees with you, “What would I need to understand to see it the way you do?”',
      'Once this week, say back someone’s position so well that they say “Yes, exactly”',
    ],
    slips: [
      'Assuming you know their point of view without checking',
      'Understanding their view and then ignoring it anyway',
      'Saying “I see where you’re coming from” and then repeating your own position',
    ],
    shadow: 'Understanding people well is power, and it can be used to manipulate them as easily as to help them. Perspective-taking can also be one-sided: if only one person in a relationship ever tries to see the other’s side, it turns into constant accommodation. And seeing someone’s point of view does not mean agreeing with it. Sometimes you understand perfectly and still have to say no.',
    honest: 'Try to understand people because they deserve to be understood, and use what you learn to find solutions that work for both of you. Ask instead of assuming, and let what you hear change what you do.',
    question: 'Who in your life seems most unreasonable to you, and what would have to be true for their behaviour to make sense?',
    hard: 7, everyday: 8, kin: [3, 18, 8, 7],
  },
  /* ---------------- 18 ---------------- */
  {
    n: 18, id: 'sympathy', title: 'Be Sympathetic with the Other Person’s Ideas and Desires', part: 'convince',
    line: '“I don’t blame you for feeling that way. If I were you, I’d feel the same.”',
    gist: 'The book offers a magic phrase that stops arguments, dissolves bad feeling and makes people listen: “I don’t blame you one iota for feeling as you do. If I were you, I would feel just as you do.” The book says you can mean it every time, because if you had their history, their temperament and their circumstances, you would feel as they do. Most of the people you meet are hungry for sympathy. Give it to them, it says, and they will love you for it. It is not agreement with what they want; it is acknowledgement that wanting it makes sense.',
    story: {
      who: 'A radio speaker and a listener in Philadelphia',
      when: '1930s, after a radio broadcast',
      text: 'In a radio talk about the author of Little Women, Louisa May Alcott, the speaker said she had lived in Concord, New Hampshire. It was Concord, Massachusetts, and he made the mistake twice. A flood of letters followed, and one woman, who had grown up near Concord, Massachusetts, and lived in Philadelphia, wrote with real fury. He was tempted to reply that he had made one geographical slip, but she had made a much bigger one in manners. Instead he phoned her. He thanked her for her letter, said a woman of her background had every reason to be annoyed, and apologised. She softened at once, apologised for her own temper and said she would like to know him better.',
    },
    mind: 'Strong feelings demand to be acknowledged before they let go. When someone is upset and you argue with them, you are fighting the feeling as well as the point, and the feeling usually wins. When you recognise that their feeling makes sense, you remove the need to keep proving it. The anger has done its job, being heard, and can subside. Sympathy also signals that you are not an enemy, which turns the other person’s attention from defending themselves to solving the problem.',
    levers: [
      { name: 'Validation', text: 'Psychologists distinguish validating a feeling, saying it is understandable, from agreeing with the claim behind it. Therapies such as dialectical behaviour therapy, developed by Marsha Linehan, make validation a core skill because it reliably lowers emotional intensity.' },
      { name: 'Affect labelling', text: 'Matthew Lieberman and colleagues found in 2007 that putting feelings into words reduced activity in the amygdala, a brain region involved in threat responses. Naming the other person’s feeling for them, gently, can help calm it.' },
      { name: 'Reciprocity of goodwill', text: 'Sympathy given is often sympathy returned. When the other person feels understood, they become much more willing to understand your side, as the angry listener did.' },
    ],
    traps: [
      { id: 'fae', how: 'We see an angry person and conclude they are an angry kind of person. Sympathy looks for the circumstances that made the anger reasonable.' },
      { id: 'projection', how: 'When you are calm, it is hard to imagine how strongly someone feels while upset, and you underrate it. Deliberate sympathy bridges that hot–cold gap.' },
    ],
    laws: [
      { n: 44, how: 'The law’s mirror effect reflects people back to themselves to disarm or unsettle them. Sympathy is a gentle mirror: showing someone that their feeling is seen and makes sense disarms them, but leaves them feeling understood rather than outplayed.' },
      { n: 22, how: 'The law’s surrender tactic yields on the surface to take the force out of an attack. Saying “I would feel the same” yields on the feeling without yielding on the issue, and often achieves the same result more honestly.' },
    ],
    study: {
      who: 'Chad Shenk and Alan Fruzzetti, 2011',
      title: 'Validating and invalidating responses and emotional reactivity',
      text: 'Students did a stressful mental arithmetic task while the researchers measured their heart rate and asked about their mood. As they talked about the task, an experimenter responded with either validating comments, acknowledging that the task was hard and their feelings understandable, or invalidating ones, suggesting they were overreacting. Those who were invalidated showed greater increases in heart rate and negative emotion. Those who were validated stayed calmer. The study was small and in a lab, but it fits a broader body of work showing that acknowledgement helps people regulate strong feelings.',
    },
    today: [
      'Telling a frustrated customer “I’d be annoyed too if I’d been waiting this long”',
      'Saying to a teenager “I get why you want to go, I’d want to as well” before explaining why they cannot',
      'Replying to an angry email by first acknowledging what went wrong for them',
      'Listening to a partner vent about work without immediately offering solutions',
    ],
    scenario: 'A passenger at a delayed-flight desk starts shouting about a missed connection. The agent waits, then says, “You’ve had a long day and now this. If I were in your place I’d be furious.” The passenger exhales, says it is not her fault, and they work out a rebooking together.',
    practice: [
      'The next time someone complains to you, say “That makes sense” before anything else',
      'Practise the phrase “If I were in your shoes, I’d feel the same” in a low-stakes situation',
      'Notice when you feel the urge to correct someone’s feelings, and acknowledge them instead',
    ],
    slips: [
      'Saying the sympathetic phrase in a flat or rushed voice, so it sounds like a script',
      'Following sympathy immediately with “but”, which cancels it',
      'Sympathising so much that you agree to something you should not',
    ],
    shadow: 'Scripted sympathy, as in many customer service phone lines, can feel more insulting than none at all. And sympathy can be used to soothe people into accepting things they should fight. It can also reward bad behaviour: if shouting always brings sympathy and concessions, people learn to shout. Sometimes a feeling is based on a mistake, and the kind thing is to say so after acknowledging it.',
    honest: 'Acknowledge feelings because you understand them, not as a way to make them go away. You can recognise how someone feels and still disagree with what they want, and the best sympathy is both honest and warm.',
    question: 'Whose feelings do you find hardest to sympathise with, and what would you feel in their position?',
    hard: 6, everyday: 7, kin: [17, 7, 13, 1],
  },
  /* ---------------- 19 ---------------- */
  {
    n: 19, id: 'nobler-motives', title: 'Appeal to the Nobler Motives', part: 'convince',
    line: 'Treat people as the decent version of themselves, and most will try to live up to it.',
    gist: 'The book quotes the banker J. P. Morgan’s remark that people usually have two reasons for doing something: one that sounds good and the real one. The real one they will think of themselves, the book says, but all of us like to think of ourselves as idealistic, so we like to hear the reasons that sound good. When you want to change someone’s behaviour, appeal to their sense of fairness, honour or kindness. Most people, it says, are honest and want to meet their obligations, and when you treat them that way they usually respond in kind.',
    story: {
      who: 'Lord Northcliffe and John D. Rockefeller Jr.',
      when: 'Early 20th century',
      text: 'Lord Northcliffe, the powerful British newspaper owner, found a newspaper using a photograph of himself that he disliked. He did not threaten or complain. He wrote to the editor asking them not to publish it any more, because his mother did not like it. Rockefeller Jr. had a similar problem: press photographers kept trying to take pictures of his young children. Instead of ordering them away, he spoke to them as fathers: some of them had children of their own, he said, and they knew it was not good for youngsters to be in the papers too much. In both cases, the appeal to something the other person respected, a mother’s feelings or a child’s welfare, worked where demands might not have.',
    },
    mind: 'Most people want to see themselves as good: fair, honest, decent. When someone appeals to that self-image, they create a gap between who the person believes they are and what they are doing, and people are motivated to close it by acting better. An appeal to self-interest invites people to bargain. An appeal to principle invites them to live up to an identity. And because people resent being suspected of the worst, assuming the best of them is often what brings it out.',
    levers: [
      { name: 'Self-concept maintenance', text: 'Nina Mazar, On Amir and Dan Ariely proposed that people cheat only as much as they can while still seeing themselves as honest. Reminding people of their moral self-image makes it harder to stretch that line, and in their studies small reminders reduced cheating, though some later replications have been weaker.' },
      { name: 'Identity labelling', text: 'Christopher Bryan and colleagues found that asking people to “be a helper” or “not be a cheater” worked better in some studies than asking them “to help” or “not to cheat”. Appeals to identity can be powerful, though some follow-ups, such as a large study of “be a voter” messages, found no effect.' },
      { name: 'Altruistic framing', text: 'Messages that highlight benefits to other people sometimes motivate more than those about personal benefit, especially when a professional or moral identity is involved.' },
    ],
    traps: [
      { id: 'self-serving', how: 'People already see themselves as more moral than average. An appeal to nobler motives agrees with that self-image, and then invites them to act on it.' },
      { id: 'fae', how: 'We assume people who wrong us have bad character. Appealing to their better motives assumes the opposite, and often finds that they had better motives all along.' },
    ],
    laws: [
      { n: 13, how: 'The law says never appeal to mercy or gratitude, only to self-interest. The principle argues the opposite: people like to see themselves as generous and fair, and an appeal to that self-image often works where a bargain would not. Each is right about some people, and wise people learn to tell them apart.' },
      { n: 27, how: 'The law notes that people hunger to believe in something larger than themselves. Appealing to nobler motives speaks to the same hunger, but on a small scale, honestly, and in service of the person rather than a cult.' },
    ],
    study: {
      who: 'Adam Grant and David Hofmann, 2011',
      title: 'It’s not all about me: motivating hand hygiene by focusing on patients',
      text: 'In a US hospital, the researchers put signs above soap and gel dispensers. One said hand hygiene prevents you from catching diseases; another said it prevents patients from catching diseases; a third gave no reason. Over two weeks, dispensers with the patient-focused sign were used noticeably more, and observers saw staff wash their hands more often, while the self-focused sign made little difference. Doctors and nurses were moved more by their duty to others than by their own safety. It was a short study in one hospital, and appeals like this do not always work as well elsewhere, but it is a striking test of the idea.',
    },
    today: [
      'Asking a tenant who is late with rent to treat it as a matter of keeping their word',
      'Reminding a team that the users depend on the system they are rushing to ship',
      'Telling a child “I know you’re someone who looks after your little brother”',
      'Fundraising messages that speak to what kind of person the donor is',
    ],
    scenario: 'A small café keeps losing mugs to customers who take them away. Instead of a sign warning that theft will be prosecuted, the owner writes: “These mugs were made by a local potter. We trust you to bring them back.” Most of the missing mugs come back within a month, some with notes of apology.',
    practice: [
      'The next time someone lets you down, appeal to their sense of fairness rather than threatening consequences',
      'Write down one person you have assumed the worst about, and imagine what the best interpretation would look like',
      'In a request this week, mention who will benefit besides you',
    ],
    slips: [
      'Moralising, so it sounds like a lecture instead of an appeal',
      'Using noble language to cover a request that only benefits you',
      'Appealing to nobler motives when the real issue is an unfair deal',
    ],
    shadow: 'Nobler motives are easy to exploit: employers ask for loyalty while paying badly, causes ask for sacrifice while their leaders live well. An appeal to principle can be a way to get people to give more than they should. And some people really are acting from self-interest alone, and treating them as noble only makes you easy to exploit. When the stakes are high, an appeal to fairness should come with a contract.',
    honest: 'Appeal to the best in people because you believe it is there, and only for things that are actually right. Make it easy for people to be generous, and never use their goodness to take what you would not openly ask for.',
    question: 'When did someone treat you as better than you were acting, and what did it make you do?',
    hard: 5, everyday: 5, kin: [28, 3, 9],
  },
  /* ---------------- 20 ---------------- */
  {
    n: 20, id: 'dramatize', title: 'Dramatize Your Ideas', part: 'convince',
    line: 'The truth is not enough. It has to be shown, vividly enough to be felt.',
    gist: 'This is the age of dramatisation, the book declared in the 1930s: merely stating a truth is not enough. It must be made vivid, interesting and dramatic, the way films, radio and shop windows do. A point that people can see, touch or picture sticks where a plain claim slides off. So instead of saying you are right, show it. Instead of listing numbers, find a scene that makes them real. Showmanship, it argues, is not cheating. It is respect for how attention actually works.',
    story: {
      who: 'The Philadelphia Evening Bulletin',
      when: 'Philadelphia, early 20th century',
      text: 'The Philadelphia Evening Bulletin found itself the target of a whispering campaign. Rivals told advertisers it had too much advertising and too little news, and it was no longer attractive to readers. Arguing back would have sounded defensive. So the paper took all the news, features and other reading matter from a single ordinary day’s edition and published it as a book, called One Day. It ran to more than three hundred pages, the size of a hardback that sold for a couple of dollars, yet the paper had printed all of it in one day and sold it for a few cents. The book made the point no advertisement could.',
    },
    mind: 'The mind is built for stories, images and concrete events, not abstractions. A statistic asks for effort; a picture or scene is taken in instantly and stirs emotion, which marks it as important. Vivid information is easier to remember and easier to recall later, so it also gets more weight in decisions. Dramatisation works because it does the work of imagination for the listener, giving them something they can see instead of something they must believe.',
    levers: [
      { name: 'The identifiable victim effect', text: 'Thomas Schelling observed, and later researchers confirmed, that people respond more strongly to a single named person in need than to statistics about thousands. A face and a story move us; numbers rarely do.' },
      { name: 'The picture superiority effect', text: 'People remember pictures far better than words. In classic studies such as Lionel Standing’s in 1973, people shown thousands of images recognised a large majority of them days later.' },
      { name: 'Concreteness', text: 'Chip and Dan Heath, drawing on psychology research, argue that ideas which stick are concrete: things you can see and touch. Abstract claims are easy to agree with and easy to forget.' },
    ],
    traps: [
      { id: 'availability', how: 'Vivid examples come to mind easily, so we treat them as more common and important than they are. Dramatisation exploits this, for good and ill.' },
      { id: 'base-rate', how: 'A single striking case can outweigh the general statistics in people’s minds. A dramatic demonstration can move people where the base rate would not, which is why it should be honest about the base rate.' },
    ],
    laws: [
      { n: 37, how: 'The law says create compelling spectacles, because images move people in ways words cannot. The principle agrees completely. The difference is in the purpose: the law uses spectacle to dazzle and distract, the principle to make the truth easier to see.' },
      { n: 6, how: 'The law says court attention at all costs. The principle’s dramatisation earns attention too, but for an idea rather than for yourself.' },
    ],
    study: {
      who: 'Deborah Small, George Loewenstein and Paul Slovic, 2007',
      title: 'Sympathy and callousness: the identifiable victim',
      text: 'Participants who had just been paid for a survey were given a chance to donate to Save the Children. Some read about Rokia, a seven-year-old girl from Mali who was desperately poor, with her photo. Others read statistics about millions facing food shortages in Africa. Those who read about Rokia gave more than twice as much. Strikingly, people who read Rokia’s story together with the statistics gave less than those who read the story alone. The vivid case moved people; the numbers seemed to dampen the feeling.',
    },
    today: [
      'Showing a team a screen recording of a real user struggling, instead of a usability score',
      'A charity showing one family’s story rather than a chart',
      'Bringing a broken part into a meeting rather than describing the fault',
      'Putting the year’s takeaway coffee cups in a pile to show how much they cost',
    ],
    scenario: 'A product manager wants to convince leadership that the checkout is too slow. Instead of presenting load times, she starts the meeting by asking everyone to buy a product on their phones. Two minutes later most of them are still waiting. The redesign is approved before she opens her slides.',
    practice: [
      'For your next proposal, find one image, object or demonstration that makes the point without words',
      'Turn one statistic you often use into a story about a single person',
      'Ask yourself, “What would someone see if this were true?” and show them that',
    ],
    slips: [
      'Making the drama so big that it overshadows the point',
      'Using a vivid case that is not typical, so people are misled',
      'Being theatrical in a setting that calls for sober facts',
    ],
    shadow: 'Dramatisation is the stock in trade of propaganda and scaremongering: one vivid crime, one terrible accident, and the real risks are distorted. A dramatic demonstration can sell something that is not true as easily as something that is. And in some settings, such as medicine, science or finance, drama can undermine trust, and plain facts are the more respectful way to persuade.',
    honest: 'Use drama to make true things visible, not to make doubtful things convincing. Choose examples that are typical, give the numbers alongside the story, and let the vividness serve the truth.',
    question: 'What important truth have you been stating for years that no one has really felt?',
    hard: 6, everyday: 4, kin: [3, 21, 8],
  },
  /* ---------------- 21 ---------------- */
  {
    n: 21, id: 'challenge', title: 'Throw Down a Challenge', part: 'convince',
    line: 'People will not work hard for money alone. They will work hard to win.',
    gist: 'When nothing else works, the book says, throw down a challenge. Every successful person loves the game: the chance to prove their worth, to excel, to win. Money and orders get people to work; a challenge gets them to give their best. Done well, it is not a threat but an invitation: here is something hard and worth doing, are you the one to do it? The book quotes Charles Schwab’s view that the way to get things done is to stimulate competition, not in a mean way but in the desire to excel.',
    story: {
      who: 'Charles Schwab and a steel mill',
      when: 'United States, early 20th century',
      text: 'Schwab, the steel magnate, had a mill whose output was poor. The manager had tried coaxing, pushing and threatening, and nothing worked. At the end of a day shift, Schwab asked the men how many heats, or batches of steel, they had made that day. Six, they said. Without a word he chalked a big “6” on the floor and left. The night shift came in, asked what it meant, and heard that the big boss had written down the day shift’s count. Next morning there was a “7” on the floor. The day shift, not to be outdone, made ten. Before long, the lagging mill was producing more than any other in the plant.',
    },
    mind: 'People want to be competent, and they want to feel competent in comparison with others. A clear, visible goal gives effort a direction and a way to keep score. Competition adds a social dimension: the desire to beat a rival, or not to be beaten, taps into status, which humans care about deeply. A challenge also changes how work feels. A job is something you are made to do; a challenge is something you choose to take on, which makes the effort feel like yours.',
    levers: [
      { name: 'Goal-setting theory', text: 'Edwin Locke and Gary Latham found over decades of studies that specific, difficult goals lead to higher performance than vague goals like “do your best”, as long as people accept the goal and get feedback on progress.' },
      { name: 'Social comparison', text: 'Leon Festinger argued that people evaluate themselves by comparing with others. Schwab’s “6” was a comparison made visible: suddenly each shift had a standard to beat.' },
      { name: 'Competence motivation', text: 'Self-determination theory, from Edward Deci and Richard Ryan, holds that people have a basic need to feel competent. A good challenge feeds that need; an impossible one starves it.' },
    ],
    traps: [
      { id: 'anchoring', how: 'Schwab’s chalked “6” became the anchor for the next shift. The number someone sees first sets what they think is possible, and a challenge chooses that number.' },
      { id: 'conformity', how: 'Once one group sets a pace, others feel the pull to match or beat it. A public challenge makes the new norm visible to everyone.' },
    ],
    laws: [
      { n: 39, how: 'The law says stir up emotions in your opponents so they make mistakes. The principle stirs up emotion too, the urge to win, but in your own people and to help them do their best rather than their worst.' },
      { n: 2, how: 'The law notes that a former enemy works harder to prove themselves. A challenge uses the same energy: the need to prove something, directed at a task rather than a person.' },
    ],
    study: {
      who: 'Gary Latham and James Baldes, 1975',
      title: 'Goal-setting with logging truck drivers',
      text: 'Logging truck drivers in the US were carrying loads well below the legal limit, wasting trips. The company gave them a specific, difficult goal: load their trucks to 94 per cent of the legal weight. There was no reward or punishment for meeting it. Within months, loads rose from around 60 per cent to above 90 per cent, saving the company a large sum. Later research has also shown the dark side: Lisa Ordóñez and colleagues argued in 2009 that narrow, hard goals can encourage cheating and tunnel vision when pursued too aggressively.',
    },
    today: [
      'A team running a week-long challenge to cut the bug backlog in half',
      'A teacher asking “I wonder if anyone can solve this one?”',
      'Fitness apps that show your streak and your friends’ times',
      'A manager telling a new hire “This project has defeated two teams. I think you can crack it.”',
    ],
    scenario: 'A volunteer group struggles to collect enough donations for its food bank. The coordinator posts a whiteboard by the entrance with each neighbourhood’s total so far. Within a fortnight, two neighbourhoods are racing each other, and the food bank has its best month in three years.',
    practice: [
      'Turn one dull task into a challenge with a clear target and a visible score',
      'Next time someone is stuck, ask “What would it take to beat last week?”',
      'Give someone a hard task with the words “I think you could do this”',
    ],
    slips: [
      'Setting challenges that are impossible, so people give up',
      'Making competition so fierce that teams sabotage each other',
      'Using challenges to squeeze more work without more reward',
    ],
    shadow: 'Challenges can turn colleagues into rivals and breed cheating, burnout and resentment. Constant competition can crowd out the intrinsic pleasure of the work and harm people who are already struggling. It can also become a cheap substitute for fair pay and decent conditions. Sometimes people need support and cooperation, not another contest.',
    honest: 'Offer challenges that are worth meeting and within reach, celebrate the effort as well as the winner, and make sure the rewards are shared. The best challenge invites people to grow, not just to work harder for someone else.',
    question: 'What challenge would bring out your best right now, and who could you invite to take it on with you?',
    hard: 5, everyday: 4, kin: [3, 28, 27],
  },
];
