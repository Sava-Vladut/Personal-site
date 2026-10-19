// Romanian text of Carnegie's principles 22–30 (part four: Be a leader). See ./types.ts.

import type { PrincipleRo } from './types';

export const RO: Record<number, PrincipleRo> = {
  /* ---------------- 22 ---------------- */
  22: {
    title: 'Începe cu laude și cu o apreciere sinceră',
    line: 'Înainte să-i spui cuiva ce are de îndreptat, spune-i, cinstit, ce e deja bun.',
    gist: 'Carnegie face comparația cu bărbierul, care își spumează clientul înainte să-l radă. Veștile grele se primesc mai ușor după o apreciere sinceră, pentru că omul poate auzi că ai văzut întreaga lui muncă, nu doar defectul. Critica sună atunci ca o observație venită din partea cuiva de partea lui, nu ca o sentință dată de un judecător. El spune limpede că lauda trebuie să fie adevărată și precisă. Un compliment vag, folosit ca să îndulcească lucrurile, se recunoaște ușor, iar omul se încordează în așteptarea loviturii în loc să se relaxeze.',
    story: {
      who: 'Calvin Coolidge și secretara lui',
      when: '1923–1929, Casa Albă a lui Coolidge',
      text: 'Un prieten al lui Carnegie, oaspete la Casa Albă pentru un weekend, a intrat în biroul președintelui și l-a auzit vorbind cu secretara. Coolidge, cunoscut drept „Silent Cal” (Cal cel Tăcut) pentru cât de puține cuvinte rostea, i-a spus că poartă o rochie frumoasă în dimineața aceea și că e o tânără foarte atrăgătoare. Probabil că fusese cel mai călduros lucru auzit vreodată de la el, iar ea s-a înroșit. Apoi i-a spus să nu i se suie la cap: a vorbit așa ca s-o facă să se simtă bine, iar de acum ar vrea să fie ceva mai atentă la punctuație. Carnegie recunoaște că metoda era puțin cam la vedere. O numește totuși o psihologie superbă, pentru că observația a venit exact când ea era cel mai dispusă să o audă.',
    },
    mind: 'Critica este procesată ca o amenințare la adresa sinelui, iar un sine amenințat se apără înainte să asculte: se explică, minimalizează și contraatacă. O apreciere reală, pusă la început, scade amenințarea. Îi spune omului că statutul lui în ochii tăi nu e în pericol, așa că mintea poate trata ce urmează drept informație, nu drept primejdie. Contează și ordinea, fiindcă prima impresie colorează felul în care sunt citite detaliile de după. Greutatea e că oamenii învață repede tiparele. Dacă lauda vine mereu chiar înaintea unei reclamații, nu mai e auzită ca laudă și începe să sune ca o sirenă de alarmă.',
    levers: [
      { name: 'Autoafirmarea', text: 'Teoria lui Claude Steele spune că oamenii se apără mai puțin față de informațiile amenințătoare când tocmai li s-a amintit ceva bun despre ei înșiși. În studiile lui David Sherman și ale colegilor săi, cei care afirmaseră mai întâi o valoare la care țineau erau mai deschiși la mesaje neplăcute despre sănătate. Lauda sinceră face ceva asemănător: întărește sinele, ca să nu mai fie nevoie să se lupte cu critica.' },
      { name: 'Efectul de primație', text: 'În studiul lui Solomon Asch din 1946, o persoană descrisă drept „inteligentă, harnică, impulsivă, critică, încăpățânată, invidioasă” era apreciată mai favorabil decât una descrisă cu aceleași trăsături în ordine inversă. Ce vine primul stabilește cadrul pentru tot ce urmează, într-o evaluare de performanță ca și într-un portret de caracter.' },
      { name: 'Raportul de pozitivitate și căderea lui', text: 'În 2005, Barbara Fredrickson și Marcial Losada au afirmat că oamenii înfloresc peste un raport precis, de aproximativ 2,9 momente pozitive la fiecare unul negativ. În 2013, Nicholas Brown, Alan Sokal și Harris Friedman au arătat că matematica de la baza lui nu se susține, iar revista a retras oficial modelul. Ideea mai largă, că relațiile bune au nevoie de mult mai multă căldură decât critică, încă are susținere, dar nu există un număr magic.' },
    ],
    traps: [
      { how: 'O singură critică cântărește în minte mai mult decât mai multe complimente. Dacă începi cu ceva bun și real, pui ceva și pe celălalt taler al balanței, iar defectul este văzut în proporție, nu ca un lucru care umple tot tabloul.' },
      { how: 'Primul lucru spus devine punctul de reper pentru tot ce urmează. Începe cu ce merge bine și greșeala va fi judecată în raport cu o lucrare în mare parte bună, nu invers.' },
    ],
    laws: [
      { how: 'Greene se folosește de o demonstrație de onestitate și generozitate ca să-i coboare cuiva garda înainte de mutarea adevărată. Carnegie folosește aceeași ordine, întâi binele și apoi greul, dar cu intenția opusă: lauda e adevărată, iar cererea e pe față.' },
    ],
    study: {
      who: 'Jay Parkes, Sara Abercrombie și Teresita McCarty, 2013',
      title: 'Sandvișurile de feedback afectează percepțiile, nu performanța',
      text: 'Studenții au rezolvat o sarcină și au primit feedback fie sub formă de „sandviș”, adică o critică strecurată între două laude, fie în alte formate. Au găsit sandvișul mai util și mai plăcut, dar nu i-a făcut să se descurce mai bine la încercarea următoare. Rezultatul îi dă dreptate lui Carnegie doar pe jumătate. Lauda de la început schimbă felul în care se simte critica, ceea ce contează pentru relație și pentru dorința oamenilor de a mai cere feedback. Nu ea însă învață: asta o face corectura clară și concretă.',
    },
    today: [
      'Începi un code review cu partea din pull request care e cu adevărat bine făcută, înainte să înșiri problemele',
      'Îi spui partenerului ce ți-a plăcut la cina pe care a plănuit-o, înainte să menționezi că restaurantul era prea zgomotos',
      'Începi un raport al profesorului cu o calitate concretă pe care copilul a arătat-o în trimestrul acesta',
      'Răspunzi la prima variantă a unui freelancer numind cele două idei pe care vrei să le păstrezi, înainte să ceri modificări',
    ],
    scenario: 'O manageră citește prezentarea unui designer începător în seara dinaintea unei întâlniri cu clientul. A doua zi dimineață îi spune că povestea de deschidere e cea mai clară formulare a problemei pe care a făcut-o cineva din echipă și că vrea s-o păstreze cuvânt cu cuvânt. Apoi îi spune că slide-ul cu prețurile va pierde sala, iar împreună îl refac la o cafea. El intră în întâlnire încrezător, nu dat peste cap.',
    practice: [
      'Înainte de următorul feedback, notează un lucru concret care e cu adevărat bun și spune-l primul, fără un „dar” după el',
      'Fă lauda destul de precisă ca să nu se potrivească decât acestei lucrări: numește slide-ul, propoziția, decizia',
      'O dată în săptămâna aceasta, dă aprecierea singură, fără nicio critică lipită de ea, ca oamenii să nu mai audă lauda drept avertisment',
    ],
    slips: [
      'O laudă atât de generică („bravo, în general”) încât toată lumea vede că e umplutură',
      'Un „dar” pus imediat după compliment, care anulează tot ce a fost înainte',
      'Să lauzi doar chiar înaintea unei critici, așa încât oamenii învață să tresară când ești drăguț',
    ],
    shadow: 'Folosită ca o formulă, devine „sandvișul de complimente” manipulator, pe care oamenii învață să-l vadă prin el și care îi face să nu mai aibă încredere în laudele tale. Poate îngropa și mesajul: dacă critica e serioasă, învelită în căldură poate lăsa omul cu impresia că totul e în regulă. Când miza e mare sau problema e urgentă, spune lucrul important clar și devreme, iar aprecierea păstreaz-o sinceră, nu strategică.',
    honest: 'Observi ce e bun pentru că te-ai uitat cu adevărat și o spui pentru că e adevărat, nu pentru că ți-ar face propoziția următoare mai ușoară. Apoi spui partea grea simplu, ca cineva care vrea ca omul să reușească.',
    question: 'Ultima oară când ai criticat pe cineva, ai fi putut numi un lucru concret pe care l-a făcut bine și l-ai numit?',
  },

  /* ---------------- 23 ---------------- */
  23: {
    title: 'Atrage atenția asupra greșelilor oamenilor în mod indirect',
    line: 'Lasă-i pe oameni să-și descopere singuri greșeala și o vor îndrepta fără să simtă nevoia să se apere.',
    gist: 'O acuzație directă îi pune pe oameni în boxa acuzaților, iar cine e în boxă se apără. Carnegie sugerează să arăți spre problemă, nu spre om: un indiciu, un exemplu, o întrebare, o schimbare discretă în propriul tău comportament, care îl lasă pe celălalt să vadă singur. Unul dintre sfaturile lui practice e mic, dar grăitor. După ce lăudăm pe cineva, mulți spunem „dar” și apoi critica, iar acel „dar” face lauda să sune ca o capcană. Înlocuiește-l cu „și” („ai muncit mult la asta, și dacă strângi puțin finalul, va fi excelent”) și lauda rămâne în picioare.',
    story: {
      who: 'Charles Schwab și placa „Fumatul interzis”',
      when: 'Începutul secolului al XX-lea',
      text: 'Magnatul oțelului Charles Schwab traversa la amiază una dintre fabricile lui când a dat peste câțiva muncitori care fumau, chiar sub o placă pe care scria „Fumatul interzis”. Putea să arate spre ea și să-i întrebe dacă știu să citească. În schimb, s-a apropiat, i-a dat fiecăruia câte un trabuc și a spus că ar fi bucuros dacă le-ar fuma afară. Ei au înțeles că le văzuse încălcarea regulii. Au înțeles și că nu fuseseră umiliți, ba chiar primiseră un mic cadou. Carnegie spune că oameni ca ei nu puteau să nu admire un șef care se purta așa cu ei.',
    },
    mind: 'Să ți se spună că greșești e un mic atac la adresa statutului tău și a sentimentului că ești stăpân pe situație, iar reflexul este să le aperi pe amândouă. Oamenii caută scuze, dau vina pe împrejurări sau hotărăsc că cel care critică e nedrept. Un indiciu indirect sare peste lupta aceasta. Omul ajunge singur la concluzie, deci și-o însușește, iar concluziile la care ajungem noi înșine ne conving mult mai mult decât cele primite de la alții. Îi lasă și loc să-și corecteze direcția fără să fie nevoit să recunoască, cu voce tare, că a fost prins.',
    levers: [
      { name: 'Politețea și amenințarea la adresa imaginii', text: 'Lingviștii Penelope Brown și Stephen Levinson au descris critica drept „act de amenințare a imaginii” și au catalogat felurile în care oamenii o îndulcesc, între care strategiile „off-record”, precum aluziile. Indirectul îi lasă pe amândoi să se prefacă că nu s-a întâmplat nimic jenant, iar mesajul ajunge totuși la destinație.' },
      { name: 'Autopersuasiunea', text: 'Elliot Aronson a susținut că cea mai durabilă persuasiune e cea pe care oamenii o fac asupra lor înșiși. Un indiciu sau o întrebare îi invită să construiască argumentul în propria minte, unde e mult mai greu de respins.' },
      { name: 'Concentrarea pe sarcină față de concentrarea pe sine', text: 'Feedbackul care ține atenția pe lucrare („cifra asta nu e bună”) tinde să ajute; cel care mută atenția pe persoană („ești neglijent”) tinde să rănească. O arătare blândă spre problemă ține reflectorul pe sarcină.' },
    ],
    traps: [
      { how: 'Oamenii își atribuie succesele lor înșiși, iar eșecurile împrejurărilor. O acuzație directă provoacă tocmai această apărare; un indiciu indirect îi lasă să repare greșeala fără să aibă nevoie de o poveste despre de ce nu a fost vina lor.' },
      { how: 'Oamenii se simt deja mai observați și mai judecați decât sunt de fapt. Dacă îi corectezi pe față, mai ales în fața altora, sentimentul acesta se umflă până la umilință; un semnal discret ține reflectorul departe.' },
      { how: 'E ușor să citești greșeala cuiva ca pe un defect de caracter. Dacă arăți spre situație („placa se vede greu”), nu spre om, reziști acestei judecăți, la fel de mult în tine ca în el.' },
    ],
    laws: [
      { how: 'Greene spune să câștigi prin fapte, niciodată prin argumente, fiindcă argumentele nu fac decât să întărească partea cealaltă. Trabucurile lui Schwab sunt exact asta: și-a spus punctul de vedere printr-un gest și nu a mai avut deloc cearta.' },
    ],
    study: {
      who: 'Avraham Kluger și Angelo DeNisi, 1996',
      title: 'Efectele intervențiilor de feedback asupra performanței',
      text: 'Această amplă meta-analiză a reunit peste șase sute de mărimi ale efectului din studii despre feedback. În medie, feedbackul a îmbunătățit performanța modest, dar în mai bine de o treime dintre cazuri a înrăutățit-o. Felul dăunător tindea să mute atenția de la sarcină la imaginea de sine a persoanei. Asta susține intuiția lui Carnegie că felul în care corectezi contează la fel de mult ca faptul că o faci. Nu înseamnă însă că mai vag e mai bine: un indiciu care nu e înțeles niciodată e doar un feedback care nu ajunge.',
    },
    today: [
      'Întrebi „ce zici de secțiunea asta la a doua citire?” în loc să scrii „partea asta e greșită” pe schița unui coleg',
      'Pui tu vasele la loc, vizibil de bine dispus, în loc să-i ții o prelegere colegului de apartament despre chiuvetă',
      'Împarți cu toată echipa un exemplu bun al formatului dorit, în loc să-l strigi pe singurul care a greșit',
      'Răspunzi la o postare inexactă a unui prieten printr-un mesaj privat, nu printr-o corectură publică în comentarii',
    ],
    scenario: 'O inginer senior observă că un coleg nou trimite mereu cod fără teste. În loc să semnaleze în chatul echipei, lucrează în pereche cu el la următorul tichet și scrie ea primul test, spunând că o ferise de un bug urât luna trecută. Până la sfârșitul săptămânii, toate pull request-urile lui vin cu teste.',
    practice: [
      'Data viitoare când ești pe punctul de a arăta o greșeală, încearcă o întrebare prin care omul o găsește singur: „Cum arată asta față de cerință?”',
      'Prinde-te în săptămâna asta spunând „dar” după un compliment și înlocuiește-l cu „și”',
      'Rezolvă o problemă care se tot repetă schimbând aranjamentul (un șablon, o listă de verificare, un memento), în loc să dai vina pe cel care se împiedică mereu',
    ],
    slips: [
      'Să sugerezi atât de subtil încât nimeni nu observă, apoi să le porți pică că nu s-au schimbat',
      'Să aluneci în pasiv-agresivitate: bilețele sarcastice pe frigider, oftaturi, glume cu țintă',
      'Să folosești „și” mecanic, așa că sună la fel de mult a capcană cum suna „dar”',
    ],
    shadow: 'Indirectul se strică atunci când devine un mod de a nu fi niciodată sincer sau de a critica păstrându-ți posibilitatea să negi. Unii oameni și unele culturi preferă mult vorbirea directă și găsesc aluziile derutante sau viclene. Când sunt în joc siguranța, banii sau slujba cuiva, sau când un indiciu a eșuat deja, spune-o direct și cu bunăvoință. Trabucurile lui Schwab au mers pentru că oamenii știau deja regula; un indiciu nu poate învăța ce nu știe nimeni.',
    honest: 'Îți pasă mai mult ca problema să fie rezolvată decât să se vadă că ai dreptate, așa că îi dai omului cea mai ușoară cale de a o rezolva. Dacă nu prinde aluzia, i-o spui simplu și între patru ochi.',
    question: 'Când corectezi pe cineva, cât din asta ține de greșeală și cât de grija ca el să știe că ai prins-o?',
  },

  /* ---------------- 24 ---------------- */
  24: {
    title: 'Vorbește despre propriile greșeli înainte de a-l critica pe celălalt',
    line: 'Recunoaște că ai fost și tu acolo, iar corectura ta va suna a ajutor, nu a judecată.',
    gist: 'Critica se primește mult mai ușor de la cineva care recunoaște că nici el nu e perfect. Dacă începi cu mărturisirea unei greșeli proprii, ideal chiar aceeași, cobori de pe scaunul judecătorului și te așezi lângă celălalt. Îți amintește și ție că ce te desparte de el e experiența, nu virtutea. Carnegie observă că metoda merge chiar și când nu ți-ai îndreptat propriile defecte: faptul că le recunoști îl ajută tot pe celălalt să le recunoască pe ale lui.',
    story: {
      who: 'Dale Carnegie și nepoata lui Josephine',
      when: 'New York, înainte de 1936',
      text: 'Nepoata lui Carnegie, Josephine, a venit la New York să-i fie secretară. Avea nouăsprezece ani, trei ani de la terminarea liceului, aproape nicio experiență în afaceri și greșea destul de des. Într-o zi, gata s-o certe, s-a oprit. Avea dublul vârstei ei și o experiență incomparabil mai mare, deci cum putea să se aștepte să aibă judecata lui? Și cum fusese el la nouăsprezece ani? Și-a amintit gafele prostești pe care le făcuse atunci și și-a recunoscut că ea se descurca mai bine decât el. De atunci, când trebuia să-i arate o greșeală, începea spunându-i că a greșit, dar că Dumnezeu știe că nu e mai rău decât multe dintre cele pe care le făcuse el, și că judecata vine doar cu experiența. Ea a primit bine corecturile și s-a îmbunătățit.',
    },
    mind: 'Când cel care critică își arată propria fragilitate, conversația trece de la o ierarhie (eu judec, tu ești judecat) la o problemă comună (amândoi greșim; iată una de îndreptat). Asta scade defensiva și îl face pe critic să pară corect. Corectează și o părtinire a criticului. După ce am învățat ceva, ne e greu să ne mai amintim cum era să nu știm, așa că greșelile de începător ale altora par neglijență, nu ceva normal. Dacă îți amintești propriile greșeli de la început, greșeala celuilalt revine la proporții.',
    levers: [
      { name: 'Efectul de poticnire', text: 'Elliot Aronson a descoperit că o persoană foarte competentă care face o mică gafă poate deveni mai simpatică, pentru că accidentul o arată omenească. Asumarea unei greșeli din trecut are același efect: un critic capabil devine mai ușor de ascultat.' },
      { name: 'Asimetria actor–observator', text: 'Tindem să ne explicăm propriile greșeli prin împrejurări („eram nou”, „nu mi-a spus nimeni”), iar pe ale altora prin caracter („e neglijentă”). Dacă îți amintești greșelile tale de începător, ești împins să le dai aceeași interpretare generoasă pe care ți-o dai ție.' },
      { name: 'Dezvăluirea reciprocă', text: 'Destăinuirea tinde să fie întoarsă: când un om se deschide, celălalt se simte mai liber s-o facă și el. Dacă îți recunoști greșeala, îi e mai sigur să-și recunoască și el greșeala în loc să și-o ascundă.' },
    ],
    traps: [
      { how: 'Odată ce știi să faci ceva, nu-ți mai poți imagina cu ușurință cum e să nu știi. Povestea ta de începător te trage înapoi în starea de atunci și îți face așteptările mai corecte.' },
      { how: 'Privind în urmă, propriile greșeli par evidente, așa că presupui că ale lor ar fi trebuit să fie la fel. Dacă îți amintești cât de neclar părea totul atunci, verdictul se îmblânzește.' },
      { how: 'Ești tentat să dai vina pe caracterul lui pentru o greșeală pe care la tine ai pune-o pe seama împrejurărilor. Dacă începi cu propria greșeală, comparația iese la vedere.' },
    ],
    laws: [
      { how: 'Greene recomandă să-ți arăți un defect inofensiv ca să nu stârnești invidie. Varianta lui Carnegie folosește defecte reale pentru un scop mai bun: nu ca să-ți aperi poziția, ci ca să facă suportabilă corectura altuia.' },
      { how: 'Tactica de capitulare a lui Greene cedează intenționat ca să capete mai târziu avantajul. Recunoașterea propriilor greșeli e și ea o formă de a te coborî, dar aici nu există nicio contramutare ascunsă; umilința este scopul.' },
    ],
    study: {
      who: 'Elliot Aronson, Ben Willerman și Joanne Floyd, 1966',
      title: 'Efectul unei poticniri asupra creșterii atractivității interpersonale',
      text: 'Studenții au ascultat o înregistrare cu cineva intervievat pentru echipa unui concurs de cultură generală al colegiului. Când un candidat foarte competent și-a vărsat stângaci cafeaua pe el la final, ascultătorii l-au plăcut mai mult decât atunci când nu o vărsa. Când un candidat mediocru a făcut la fel, l-au plăcut mai puțin. Cercetările de mai târziu au complicat tabloul: o continuare din 1970 a arătat că efectul depindea de stima de sine a ascultătorului, iar replicările au dat rezultate amestecate. Concluzia corectă este că o mică recunoaștere sinceră îi ajută pe cei care au arătat deja că sunt capabili. Nu e un truc care face pe oricine simpatic.',
    },
    today: [
      'Îi povestești unui coleg nou cum ai oprit producția în prima ta lună, înainte să discutați avaria lui',
      'Îi spui unui adolescent: „Am făcut exact asta la vârsta ta și uite cât m-a costat”, înainte să vorbiți despre petrecere',
      'Începi o ședință de mentorat arătând o schiță de-a ta care a fost făcută praf',
      'Începi o conversație grea cu partenerul recunoscându-ți mai întâi partea ta din ceartă',
    ],
    scenario: 'Un bucătar-șef descoperă că o bucătăreasă nouă a sărat prea tare o șarjă întreagă de supă de bază. Înainte să spună ceva despre asta, îi povestește că în primul lui job într-un restaurant a stricat sosul pe o zi întreagă citind greșit o rețetă, iar patronul l-a pus să guste fiecare oală timp de o lună. Apoi îi arată cum verifică el acum condimentarea. Ea râde, reface supa și începe să-i pună întrebări pe care până atunci fusese prea emoționată să le pună.',
    practice: [
      'Înainte de următoarea corectură, amintește-ți o dată când ai făcut o greșeală asemănătoare și spune povestea aceea prima, pe scurt',
      'Observă când te irită lipsa de experiență a cuiva și întreabă-te sincer cum erai tu în etapa lui',
      'Recunoaște în săptămâna asta, în fața unui coleg, o greșeală de-a ta de acum, fără să fii întrebat',
    ],
    slips: [
      'Să faci mărturisirea atât de lungă încât devine o poveste despre tine și problema reală se pierde',
      'Să inventezi sau să exagerezi o greșeală din trecut ca să pari apropiat, lucru pe care oamenii îl simt adesea',
      'Să folosești „și eu făceam asta” ca o mângâiere de sus, care spune de fapt „eu am crescut din asta”',
    ],
    shadow: 'O umilință exersată poate deveni spectacol: mărturisești defecte mici și sigure ca să pari firesc, păstrând toată autoritatea reală. Te poate și submina când oamenii au nevoie de încredere din partea ta, ca un lider nou în criză sau un expert pe care se bazează. Uneori lucrul mai bun este o corectură clară, fără un discurs despre tine.',
    honest: 'Îți amintești, cu adevărat, că ai fost și tu începător cândva și corectezi oamenii așa cum ai fi vrut să fii corectat atunci.',
    question: 'Ce greșeală de-a ta ți-ar plăcea cel mai puțin să recunoști în fața omului pe care ești pe cale să-l critici și de ce?',
  },

  /* ---------------- 25 ---------------- */
  25: {
    title: 'Pune întrebări în loc să dai ordine directe',
    line: 'Oamenii muncesc mai mult pentru ce au ajutat să se hotărască decât pentru ce li se spune să facă.',
    gist: 'Un ordin spune cuiva ce să facă; o întrebare îl invită să se gândească. Carnegie susține că a întreba („Ce părere ai despre asta?”, „Am putea încerca așa?”) le păstrează oamenilor mândria, îi face să se simtă importanți și îți aduce cooperarea lor, nu doar conformarea. Scoate adesea la iveală idei mai bune decât ale tale, pentru că cei care fac munca știu de obicei lucruri pe care tu nu le știi. Iar greșelile făcute în urma unei întrebări se corectează mai ușor, pentru că nimeni nu și-a pus autoritatea în joc pe ele.',
    story: {
      who: 'Owen D. Young, în relatarea Idei Tarbell',
      when: 'Cam în 1930',
      text: 'Jurnalista Ida Tarbell i-a povestit lui Carnegie că, pe când scria o biografie a lui Owen D. Young, șeful General Electric, a stat de vorbă cu un om care lucrase în același birou cu Young timp de trei ani. Acesta spunea că nu-l auzise niciodată pe Young dând un ordin direct. Young făcea în schimb sugestii: „Poate ai putea lua în calcul asta” sau „Crezi că ar merge?”. După ce dicta o scrisoare, îl întreba adesea pe celălalt ce părere are despre ea. Citind schița unui asistent, putea sugera că o altă formulare ar merge mai bine. Îi lăsa pe oameni să facă lucrurile singuri și să învețe din propriile greșeli.',
    },
    mind: 'Oamenii au o nevoie de bază de a simți că sunt stăpâni pe propriile acțiuni. Ordinele amenință această autonomie, iar un sentiment de libertate amenințat răspunde prin împotrivire: ne conformăm cu greu, facem minimul sau ne opunem pe tăcute. Întrebările redau o parte din control. Fac și ceva mai subtil. Când răspund la o întrebare, oamenii își produc propriile motive, iar o idee la care am lucrat o simțim mai mult a noastră, așa că ne pasă mai mult să reușească.',
    levers: [
      { name: 'Reactanța psihologică', text: 'Jack Brehm a descris în 1966 cum oamenii, când simt că libertatea le este îngrădită, se simt motivați s-o recapete, adesea făcând exact opusul a ceea ce li s-a spus. O întrebare lasă libertatea intactă, deci nu e nimic împotriva căruia să reacționeze.' },
      { name: 'Susținerea autonomiei', text: 'Teoria autodeterminării, dezvoltată de Edward Deci și Richard Ryan, arată că oamenii sunt mai implicați, mai creativi și mai perseverenți când simt că acțiunile le aparțin. A explica motivele și a invita la contribuții sunt mișcări clasice de susținere a autonomiei.' },
      { name: 'Efectul IKEA', text: 'Michael Norton, Daniel Mochon și Dan Ariely au descoperit că oamenii prețuiesc mai mult lucrurile pe care le-au construit ei înșiși decât lucruri identice construite pentru ei. Cu planurile e la fel: dacă ai ajutat să se contureze unul, vrei ca el să reușească.' },
    ],
    traps: [
      { how: 'Prețuim mai mult ce e al nostru decât ce nu e. O întrebare lasă planul să devină în parte al lor, așa că îl apără și îl îmbunătățesc în loc să-l execute doar.' },
      { how: 'Ordinele se sprijină pe rang, iar rangul obține ascultare fără prea multă gândire sau asumare. Întrebările cer oamenilor să-și pună judecata în lucru, ceea ce prinde și greșelile pe care ascultarea oarbă le-ar lăsa să treacă.' },
    ],
    laws: [
      { how: 'Greene recomandă să oferi alegeri care duc toate unde vrei tu, ca oamenii să se simtă liberi în timp ce tu rămâi la comandă. O întrebare cu răspunsul sugerat poate fi același truc. Varianta lui Carnegie merge cinstit doar dacă ești pregătit să auzi un răspuns la care nu te-ai așteptat.' },
    ],
    study: {
      who: 'Richard Koestner, Richard Ryan, Frank Bernieri și Kathleen Holt, 1984',
      title: 'Stabilirea limitelor în comportamentul copiilor: stiluri de control față de stiluri informaționale',
      text: 'Copiilor mici li s-a cerut să picteze păstrând materialele ordonate. Unii au auzit regula într-un mod controlant („trebuie”, „ar trebui”); alții au auzit aceeași regulă formulată informațional, cu un motiv și cu recunoașterea faptului că poate ar vrea să facă mizerie. Un al treilea grup nu a primit nicio regulă. Copiii cărora li s-au pus limite controlante au ales apoi să picteze mai puțin în timpul liber și au făcut desene mai puțin creative; grupul informațional s-a descurcat cam la fel ca cei fără limite. A fost un studiu mic, cu copii mici, iar miza nu e gramatica: „te-ar deranja să…?” spus pe un ton poruncitor rămâne un ordin. Contează dacă oamenii simt că au cu adevărat un cuvânt de spus.',
    },
    today: [
      'Îți întrebi echipa „Cum am putea respecta termenul?” în loc să anunți planul de ore suplimentare',
      'Îl întrebi pe copil „Ce trebuie să iei mâine la școală?” în loc să-i faci tu lista',
      'Răspunzi la oferta unui meseriaș cu „Există o cale să o aducem mai aproape de bugetul nostru?” în loc să ceri o reducere',
      'Îl întrebi pe partener „Ce ar face duminica odihnitoare pentru tine?” înainte să propui un plan',
    ],
    scenario: 'O brutărie mică primește o comandă en-gros de două ori mai mare decât orice a gestionat până acum. Patroana își adună cei patru brutari înainte de tura de dimineață, le explică ce ar însemna comanda pentru afacere și îi întreabă dacă cred că se poate face și cum. Își refac singuri programul de lucru, propun să pregătească aluatul în seara dinainte și iau comanda cu un entuziasm pe care ea nu l-ar fi putut impune prin ordin.',
    practice: [
      'Transformă următoarea ta instrucțiune într-o întrebare adevărată și așteaptă răspunsul înainte să-l adaugi pe al tău',
      'Într-o ședință din săptămâna asta, întreabă „Ce credeți că ar trebui să facem?” înainte să-ți spui părerea',
      'Când revizuiești munca cuiva, sugerează o schimbare sub formă de întrebare („Dar dacă asta ar veni prima?”) și lasă-l să decidă',
    ],
    slips: [
      'Să pui întrebări la care ai deja răspunsul în cap, pe care oamenii le recunosc repede drept ordine deghizate',
      'Să întrebi și apoi să treci peste fiecare răspuns, ceea ce e mai rău decât să dai pur și simplu ordinul',
      'Să faci din orice instrucțiune simplă o consultare de grup, așa că nu se mai hotărăște nimic',
    ],
    shadow: 'Întrebările pot deveni o formă blândă de manipulare, ducându-l pe cineva pas cu pas spre o concluzie pe care ai fixat-o dinainte, lăsându-l să creadă că e a lui. Într-o urgență, sau când cineva e nou și are pur și simplu nevoie să știe ce să facă, o instrucțiune clară e mai bună decât o ghicitoare. Iar unii oameni găsesc întrebările necontenite obositoare sau evazive: vor ca tu să-ți asumi responsabilitatea și să hotărăști.',
    honest: 'Întrebi pentru că vrei cu adevărat să afli și ești dispus să-ți schimbi planul dacă răspunsul e mai bun decât al tău.',
    question: 'Când ai întrebat ultima oară pe cineva ce crede și apoi chiar ai făcut cum a spus el?',
  },

  /* ---------------- 26 ---------------- */
  26: {
    title: 'Lasă-l pe celălalt să-și păstreze demnitatea',
    line: 'Corectează greșeala, niciodată demnitatea omului.',
    gist: 'Carnegie crede că acesta este unul dintre cele mai importante principii și unul dintre cele mai ignorate. Criticăm oamenii în fața altora, căutăm vinovați și amenințăm fără să ne oprim să ne gândim la mândria lor, când o clipă de gândire, un cuvânt bun sau puțină înțelegere ar face mult mai mult bine. Chiar și când ai dreptate și celălalt greșește vădit, umilirea cuiva îi distruge dorința de a se îmbunătăți și îl întoarce împotriva ta. El citează cazul liderului turc Mustafa Kemal, care în 1922, după ce învinsese armata greacă, le-a spus generalilor greci prinși să se așeze, fiindcă trebuie să fie obosiți, și a vorbit despre război ca despre un joc în care cei mai buni pierd uneori.',
    story: {
      who: 'Charles Steinmetz și General Electric',
      when: 'Începutul secolului al XX-lea',
      text: 'Charles Steinmetz era un geniu al ingineriei electrice și unul dintre cei mai valoroși oameni ai General Electric. Era însă și un manager slab și eșua în fruntea unui departament. Compania avea o problemă delicată: trebuia să-l scoată din funcție, dar nu-și permitea să rănească sau să piardă un om atât de strălucit și de sensibil. I-a dat deci un titlu nou, Inginer Consultant al Companiei General Electric, care descria munca la care se pricepea deja cel mai bine, și a lăsat discret pe altcineva să conducă departamentul. Steinmetz a fost mulțumit. La fel și conducătorii care găsiseră o cale de a rezolva problema fără victime.',
    },
    mind: 'Imaginea noastră publică este ceva ce păzim aproape ca pe siguranța noastră fizică. Când e lezată în fața altora, simțim rușine, iar rușinea tinde să provoace ascundere sau furie, nu reflecție. Un om umilit în public încetează adesea să se mai gândească la problemă și începe să se gândească cum să-și recapete demnitatea, chiar cu un cost pentru el și pentru tine. Dacă îi dai o cale de a da înapoi cu mândria intactă, dispare a doua luptă și rămâne de rezolvat doar greșeala în sine.',
    levers: [
      { name: 'Munca de păstrare a imaginii', text: 'Sociologul Erving Goffman a descris „fața” (imaginea) ca imaginea pozitivă pe care o persoană o revendică într-o întâlnire și a arătat cât din conversația de zi cu zi se duce în protejarea discretă a imaginii celuilalt. Când imaginea e pierdută, oamenii fac eforturi uriașe s-o repare, iar asta devine prioritatea.' },
      { name: 'Rușinea față de vinovăție', text: 'Cercetările lui June Tangney deosebesc vinovăția („am făcut un lucru rău”), care duce de regulă la scuze și reparații, de rușine („sunt rău”), asociată cu ascunderea, defensiva și furia. Umilirea publică împinge oamenii spre rușine; o corectură privată, concentrată pe comportament, lasă vinovăției loc să-și facă munca utilă.' },
      { name: 'Autojustificarea', text: 'Oamenilor care s-au angajat public într-o poziție le e dureros s-o schimbe, pentru că schimbarea i-ar face să pară proști. O ieșire demnă („având în vedere ce știai atunci, avea sens”) face schimbarea de direcție mai ieftină.' },
    ],
    traps: [
      { how: 'Cei jenați cred că mult mai mulți oameni au observat și le pasă decât în realitate, iar asta face pierderea imaginii și mai greu de suportat. Corectura în privat păstrează mic publicul imaginar.' },
      { how: 'Cine a apărat public o greșeală e tentat să o apere în continuare, ca să nu piardă poziția pe care a luat-o. O ieșire care salvează aparențele îl lasă să se oprească fără să pară că recunoaște că totul a fost în zadar.' },
      { how: 'Când cineva eșuează, e tentant să tratezi asta ca pe dovada felului în care e. Dacă arăți spre situație („rolul nu se potrivea punctelor tale forte”), cum a făcut GE cu Steinmetz, ții caracterul lui în afara verdictului.' },
    ],
    laws: [
      { how: 'Greene recomandă să-ți zdrobești total dușmanul, pentru că unul rănit se va întoarce să se răzbune. Carnegie trage concluzia opusă din aceeași observație: umilința naște răzbunare, așa că lasă-i celuilalt demnitatea și nu va deveni niciodată dușman.' },
      { how: 'Greene avertizează să nu mergi dincolo de țintă în victorie. A salva demnitatea cuiva înseamnă a ști când să te oprești: ai câștigat punctul, iar dacă îl tot reiei, nu faci decât să stârnești resentimente.' },
    ],
    study: {
      who: 'Bert Brown, 1968',
      title: 'Efectele nevoii de a-și păstra imaginea asupra negocierii interpersonale',
      text: 'Adolescenți băieți au jucat un joc de negociere împotriva unui adversar care i-a exploatat. Unora li s-a spus apoi, de către un presupus public de colegi, că arătaseră ca niște proști; altora, că arătaseră bine. Cei făcuți să se simtă proști s-au răzbunat mai des în rundele următoare, chiar și atunci când răzbunarea îi costa bani din buzunarul propriu. Refacerea imaginii a contat mai mult decât câștigul. E un singur studiu de laborator din anii ’60, dar tiparul lui, că oamenii plătesc costuri reale ca să-și repare imaginea pierdută, se potrivește cu o mare parte din cercetările ulterioare despre negociere și conflict.',
    },
    today: [
      'Muți un manager în dificultate într-un rol de expert, cu un titlu real, în loc de o retrogradare publică',
      'Corectezi cifra greșită a unui coleg printr-un mesaj privat după ședință, nu în fața clientului',
      'Îi spui unui prieten care a reținut greșit o poveste: „Se poate să țin minte și eu greșit”, în loc să-i demonstrezi la cină că a greșit',
      'Lași un copil care a avut o criză să se alăture iar jocului, fără o prelegere în fața prietenilor lui',
    ],
    scenario: 'La o analiză de proiect, o analistă senioară își dă seama că prognoza prezentată luna trecută de un coleg a pornit de la o bază de comparație greșită. În loc să ridice problema în fața directorului, îi scrie după aceea: „Baza s-a schimbat după ce ai făcut asta, deci cifrele vechi aveau sens la vremea aceea. Vrei să le actualizăm împreună până vineri?” El trimite chiar el varianta corectată tuturor, cu o notă în care îi mulțumește.',
    practice: [
      'Înainte să corectezi pe cineva săptămâna asta, întreabă-te dacă are nevoie de public; dacă nu, fă-o în privat',
      'Când cineva greșește, oferă-i o propoziție care explică cum a putut un om rezonabil să ajungă acolo',
      'După ce câștigi o dezbatere, nu mai spune nimic despre ea și vezi cât de mult mai ușoară e următoarea conversație',
    ],
    slips: [
      'Să corectezi pe cineva în public „ca să învețe toți”, când singura lecție pe care o ia omul e să te urască',
      'Să spui „Nu zic că ești prost, dar…”, ceea ce spune exact asta',
      'Să oferi o ieșire atât de aranjată încât problema nu mai este de fapt rezolvată niciodată',
    ],
    shadow: 'Păstrarea demnității poate aluneca în a-i feri pe oameni de adevăr: să inventezi titluri ca să eviți conversațiile grele sau să lași pe cineva să creadă că un eșec n-a fost unul. Organizațiile în care nimeni nu-și pierde niciodată imaginea ajung cu probleme pe care nu le poate numi nimeni. Unele situații, o breșă de siguranță sau un abuz de încredere, cer asumare publică limpede, nu o ieșire elegantă.',
    honest: 'Îți pasă ca omul să rămână întreg după ce greșeala e îndreptată, așa că tratezi corectura așa cum ai vrea s-o fie pe a ta: clar, în privat și fără urmă de triumf.',
    question: 'Gândește-te la ultima dată când ți s-a dat dreptate. A plecat celălalt cu demnitatea intactă?',
  },

  /* ---------------- 27 ---------------- */
  27: {
    title: 'Laudă cea mai mică îmbunătățire și laudă fiecare îmbunătățire',
    line: 'Observă cu voce tare fiecare pas mic înainte și oamenii vor continua să-i facă.',
    gist: 'Carnegie arată că dresorii de animale știu ce uită managerii și părinții: primești mai mult din ce răsplătești. Pomenește un dresor care își lăuda și hrănea câinele la cel mai mic semn de progres. Cu oamenii facem pe dos: tăcem cât merg lucrurile bine și vorbim doar când merg prost. El ne cere să-i prindem pe oameni făcând mai bine, nu doar făcând rău, și să lăudăm chiar și pașii mici, cu căldură și cu precizie. Încurajarea în clipa îmbunătățirii, susține el, este ceea ce transformă un începător șovăitor într-un om care crede că poate.',
    story: {
      who: 'Enrico Caruso și mama lui',
      when: 'Napoli, anii 1880',
      text: 'Așa cum o spune Carnegie, un băiat de zece ani care muncea într-o fabrică din Napoli își dorea să devină cântăreț. Primul lui profesor l-a descurajat, spunându-i că nu poate cânta deloc și că vocea lui sună ca vântul în obloane. Mama lui, o țărancă săracă, a avut părerea opusă. L-a îmbrățișat, l-a lăudat, i-a spus că deja îl aude cum se îmbunătățește și a umblat desculță ca să strângă bani pentru lecțiile lui de muzică. Lauda ei i-a schimbat cursul vieții. Băiatul era Enrico Caruso, care a devenit cel mai faimos tenor al vremii sale.',
    },
    mind: 'Un comportament urmat de ceva bun tinde să se repete, iar cu cât răsplata e mai aproape de acțiune, cu atât legătura e mai puternică. Dacă aștepți rezultatul final ca să spui ceva, atunci mulții pași mici de pe drum rămân nerăsplătiți, iar progresul pare invizibil. Lauda fiecărei îmbunătățiri face progresul vizibil, și pentru tine, și pentru cel care învață. Construiește și încredere: oamenii care văd că eforturile lor sunt observate și dau roade ajung să creadă că și mai mult efort va da roade.',
    levers: [
      { name: 'Modelarea comportamentului (shaping)', text: 'B. F. Skinner a descoperit că un comportament complex se poate construi răsplătind fiecare mică apropiere de țintă, în loc să aștepți performanța completă. Lauda pentru fiecare îmbunătățire este shaping aplicat oamenilor.' },
      { name: 'Principiul progresului', text: 'Teresa Amabile și Steven Kramer au studiat aproape 12.000 de însemnări de jurnal zilnic ale unor oameni care lucrau la proiecte creative. Cel mai puternic stimulent pentru dispoziția și motivația lor într-o zi dată a fost progresul într-o muncă cu sens, chiar și unul mic. Dacă îl observi cu voce tare, efectul se înmulțește.' },
      { name: 'Autoeficacitatea', text: 'Albert Bandura a arătat că încrederea în capacitatea de a reuși se construiește cel mai puternic din propriile experiențe de succes. Lauda îmbunătățirilor mici transformă progresul obișnuit într-o dovadă pe care cel care învață o poate vedea.' },
    ],
    traps: [
      { how: 'Greșelile atrag atenția, iar îmbunătățirea tăcută nu, așa că tindem să comentăm doar ce e greșit. A lăuda progresul în mod deliberat contrabalansează această atracție.' },
      { how: 'Odată ce crezi că cineva e slab, vezi mai ales eșecurile lui. A căuta intenționat îmbunătățirea rupe cercul și te lasă să observi schimbarea pe care altfel ai rata-o.' },
    ],
    laws: [
      { how: 'Greene avertizează că reforma reușește cel mai bine în pași mici pe care oamenii îi pot asimila. Carnegie aplică aceeași înțelepciune schimbării personale: cere și sărbătorește câte o mică îmbunătățire pe rând, nu o transformare totală.' },
    ],
    study: {
      who: 'B. F. Skinner și colaboratorii, 1943',
      title: 'Cum înveți un porumbel să joace popice',
      text: 'În timp ce lucrau la un proiect din timpul războiului, Skinner și colegii lui au încercat să învețe un porumbel să lovească o minge de lemn pe o mică pistă de popice. Așteptarea unei lovituri complete nu ducea nicăieri, așa că au început să răsplătească orice se apropia de ea, la început doar privirea spre minge, apoi mișcarea spre ea, apoi atingerea ei. În câteva minute, pasărea făcea mingea să zboare de-a latul cutiei. Skinner a descris mai târziu asta drept o revelație despre cum se construiește comportamentul. La oameni lucrurile sunt mai complicate. O meta-analiză din 1999 a lui Edward Deci, Richard Koestner și Richard Ryan a constatat că lauda verbală a crescut în general motivația intrinsecă a adulților, dar mai puțin sigur la copii, iar lauda dată într-un mod controlant o putea scădea.',
    },
    today: [
      'Îi spui unui coleg junior că a doua lui prezentare a fost vizibil mai bine strânsă decât prima și numești exact ce s-a schimbat',
      'Lauzi un copil că a citit cu o pagină mai mult decât ieri, nu doar că a terminat cartea',
      'Îi scrii unui prieten care se pune pe fitness că ai văzut că a fost la sală de trei ori săptămâna asta',
      'Comentezi singurul lucru pe care un cursant online l-a îmbunătățit în ultimul desen, nu cele cinci care mai sunt greșite',
    ],
    scenario: 'Un antrenor de fotbal pentru copii sub zece ani are un băiat care nu pasează niciodată. La antrenament, prima dată când băiatul ridică privirea înainte să șuteze, antrenorul strigă că a fost o conștientizare grozavă. La ședința următoare, când băiatul pasează în sfârșit mingea, chiar și prost, antrenorul oprește exercițiul ca să sublinieze asta. Până la sfârșitul sezonului, băiatul pregătește jumătate din golurile echipei.',
    practice: [
      'Alege o persoană pe care o corectezi des și, săptămâna asta, prinde-o făcând ceva puțin mai bine și spune-i concret',
      'Ține o scurtă notă cu micile îmbunătățiri pe care le vezi acasă sau la muncă și pomenește câte una pe zi',
      'Când lauzi, descrie ce s-a schimbat („ai verificat cifrele înainte să trimiți”), nu persoana („ești grozav”)',
    ],
    slips: [
      'Să lauzi atât de des și fără deosebire încât lauda nu mai înseamnă nimic',
      'Să lauzi îmbunătățirea cu o înțepătură („în sfârșit!” sau „era și timpul”)',
      'Să răsplătești progresul doar cu laude la adresa talentului („ești un talent natural”), care îi poate face pe oameni să se teamă de efort',
    ],
    shadow: 'Lauda poate fi folosită ca o lesă, dată doar când oamenii fac ce vrei tu, așa că învață să joace pentru aprobarea ta, nu pentru muncă. Și excesul de laude umflă și încurcă: cine e lăudat pentru orice nu mai poate deosebi ce contează cu adevărat. Uneori e mai bine să lași progresul să-l observe omul singur, mai ales la adulți, care ar putea găsi lauda frecventă condescendentă.',
    honest: 'Te bucuri cu adevărat când cineva se îmbunătățește și îi spui, pentru că îmbunătățirea e reală și ai văzut-o.',
    question: 'Cine din viața ta se îmbunătățește chiar acum și i-ai spus?',
  },

  /* ---------------- 28 ---------------- */
  28: {
    title: 'Dă-i celuilalt o reputație frumoasă pe care s-o merite',
    line: 'Spune-le oamenilor cine crezi că sunt, iar mulți se vor ridica la nivelul acesta.',
    gist: 'Dacă vrei ca cineva să se îmbunătățească într-un anume fel, poartă-te ca și cum acea calitate ar fi deja una dintre trăsăturile lui. Carnegie susține că oamenii fac eforturi mari ca să nu dezamăgească o părere bună despre ei înșiși, mai ales una a cuiva pe care îl respectă. În loc de „întârzii mereu”, spune „ești unul dintre cei mai de încredere oameni de aici, de aceea m-a surprins asta”. Omul are acum o reputație de apărat. El împrumută sfatul lui Shakespeare, „ia înfățișarea unei virtuți, dacă nu o ai”, și îl întoarce spre ceilalți: presupune virtutea la alții și spune-o deschis.',
    story: {
      who: 'Georgette Leblanc și „Marie Spălătoreasa de vase”',
      when: 'Începutul secolului al XX-lea, din memoriile lui Leblanc',
      text: 'Cântăreața și actrița Georgette Leblanc, partenera scriitorului Maurice Maeterlinck, a scris în memoriile ei despre o fată în casă care îi aducea mesele de la un hotel din apropiere. Toți îi spuneau „Marie Spălătoreasa de vase”, pentru că începuse ca ajutor de bucătărie, iar ea era banală, stângace și avea o părere foarte proastă despre sine. Într-o zi, în timp ce Marie punea o farfurie jos, Leblanc i-a spus că nu are idee ce comori se află în ea. Marie s-a întors în bucătărie gândindu-se la asta. A început să-și poarte de grijă înfățișarea și să se poarte altfel, iar oamenii din jurul ei au început, la rândul lor, să se poarte altfel cu ea. Peste vreo două luni a anunțat că se mărită cu nepotul bucătarului-șef și i-a spus lui Leblanc că va fi o doamnă.',
    },
    mind: 'Aflăm cine suntem în parte privind ce cred alții despre noi și în parte privind ce facem. Când cineva pe care îl respectăm ne pune eticheta de generos, atent sau curajos, eticheta ne oferă o nouă imagine de sine, iar apoi ne purtăm în feluri care i se potrivesc, pentru că oamenii preferă cu putere ca purtarea lor să se potrivească identității. Așteptarea schimbă și persoana care o are: ne purtăm mai călduros cu cei în care credem, le dăm mai multe șanse și le observăm reușitele, ceea ce creează chiar dovezile care confirmă eticheta.',
    levers: [
      { name: 'Autopercepția și consecvența', text: 'Daryl Bem a susținut că ne deducem atitudinile în parte din propriul comportament, la fel cum ar face un observator din afară. O trăsătură oferită de cineva credibil devine o autodescriere la înălțimea căreia să ne ridicăm, iar dorința de a acționa în acord cu ea face restul.' },
      { name: 'Efectul Pygmalion și limitele lui', text: 'Robert Rosenthal și Lenore Jacobson au raportat în 1968 că elevii etichetați la întâmplare drept „pe cale să înflorească” au câștigat mai multe puncte de IQ, mai ales în clasele cele mai mici. Studiul a fost criticat intens, iar replicările au dat rezultate amestecate. Analiza lui Lee Jussim și Kent Harber din 2005 a concluzionat că așteptările profesorilor influențează elevii, dar de obicei modest, iar efectele adesea se estompează.' },
      { name: 'Apelurile bazate pe identitate', text: 'Christopher Bryan și colegii lui au descoperit că a le cere oamenilor să „fie un ajutor” sau „un votant” în loc de „să ajute” sau „să voteze” a produs mai mult din comportamentul respectiv în mai multe studii, pentru că un substantiv invită la o identitate. Unele replicări ulterioare au găsit efecte mai slabe sau deloc, deci e o pârghie, nu o lege.' },
    ],
    traps: [
      { how: 'Odată ce un om e etichetat, atât el, cât și cei din jur caută dovezi care se potrivesc. Alegerea unei etichete bune îndreaptă părtinirea aceasta într-o direcție utilă, în loc să încuie pe cineva în cel mai rău moment al lui.' },
      { how: 'O singură calitate puternică, bună, colorează felul în care e văzut întregul om. Dacă numești o forță reală, strălucirea ei se poate întinde asupra zonei în care încearcă să crească.' },
    ],
    laws: [
      { how: 'Greene spune să te porți ca un rege ca să fii tratat ca unul, pentru că oamenii te iau la valoarea pe care ți-o dai singur. Carnegie îndreaptă același mecanism spre afară: dă o valoare mare altcuiva și el începe să se poarte pe măsură.' },
      { how: 'Greene spune să-ți păzești reputația cu prețul vieții. Carnegie sugerează să le dai altora o reputație care merită păzită, pentru că o vor păzi la fel de aprig cum și-o păzește Greene pe a lui.' },
    ],
    study: {
      who: 'Richard Miller, Philip Brickman și Diana Bolen, 1975',
      title: 'Atribuirea față de persuasiune ca mijloc de modificare a comportamentului',
      text: 'Într-o școală din Chicago, unei clase a cincea i s-a spus în mod repetat, timp de aproximativ o săptămână, de către învățător, director și chiar de către îngrijitor, că este o clasă ordonată și curată. Altei clase i s-a ținut o prelegere despre de ce ar trebui să fie ordonată. Clasa căreia i s-a dat reputația a pus mult mai multe gunoaie în coș și făcea încă asta două săptămâni mai târziu, în timp ce clasa convinsă s-a îmbunătățit puțin și apoi a recăzut. Un al doilea studiu a găsit rezultate asemănătoare la matematică, unde copiii cărora li se spusese că sunt buni la ea s-au îmbunătățit mai mult decât cei cărora li se spusese că ar trebui să se străduiască mai mult. Studiile au fost mici și limitate la câteva clase, dar sunt adesea citate ca dovadă că o etichetă bună poate depăși o prelegere.',
    },
    today: [
      'Îi spui unui coleg care a ratat un termen: „De obicei pe tine ne putem baza, așa că știu că ți s-a pus ceva în cale”',
      'Îți prezinți un prieten timid la o petrecere drept „cel mai amuzant om pe care îl cunosc”',
      'Îi spui unui copil: „Tu ești cineva care își ține promisiunile”, înainte să-i amintești de o treabă',
      'Scrii într-o evaluare de performanță calitatea în care vrei ca cineva să crească, formulată ca una pe care o arată deja',
    ],
    scenario: 'O asistentă nouă uită mereu să actualizeze fișele pacienților. În loc să o sancționeze, asistenta-șefă îi spune că grija ei față de pacienți e cea mai atentă pe care a văzut-o la o angajată nouă și că vrea ca fișele ei să arate asta. În două săptămâni, fișele ei sunt cele mai detaliate din secție, iar ea îi povestește unei prietene despre conversația aceea ca despre momentul în care s-a simțit parte din echipă.',
    practice: [
      'Gândește-te la cineva pe care vrei să-l schimbi, găsește un moment real în care a arătat calitatea dorită și amintește-i-l',
      'Înlocuiește în săptămâna asta o plângere de tipul „tu mereu…” cu „tu ești cineva care de obicei…”',
      'Prezintă un coleg cuiva nou numind o calitate prin care ar vrea să fie cunoscut',
    ],
    slips: [
      'Să dai o reputație atât de departe de adevăr încât sună a sarcasm sau a capcană',
      'Să o spui o singură dată și apoi să te întorci la critică, așa că eticheta nu mai are pe ce sta',
      'Să folosești reputația ca pârghie de vinovăție („credeam că ești mai bun de atât”)',
    ],
    shadow: 'Seamănă mult cu o manipulare clasică: lingușești pe cineva într-o identitate care, întâmplător, îți convine, apoi îl ții ostatic în ea. Etichetele pot și încuia oamenii într-un rol, „cel de încredere” care nu poate spune niciodată nu. Iar o etichetă prea departe de realitate se întoarce împotriva ta; oamenii simt când sunt manevrați. Când cineva are nevoie de feedback direct și sincer despre o problemă reală, o reputație frumoasă nu-l poate înlocui.',
    honest: 'Vezi ce e mai bun în cineva pentru că acolo chiar este, fie și doar în licăriri, și i-o spui pentru că vrei să vadă și el.',
    question: 'Ce reputație le dai acum oamenilor cei mai apropiați și este una la nivelul căreia ai vrea să se ridice?',
  },

  /* ---------------- 29 ---------------- */
  29: {
    title: 'Încurajează. Fă ca greșeala să pară ușor de îndreptat',
    line: 'Fă ca distanța dintre unde se află și unde ar putea ajunge să pară destul de mică ca s-o treacă.',
    gist: 'Spune-i cuiva că e de speranță pierdută la un lucru, că face totul greșit, și îi iei motivul să încerce. Spune-i că e ușor de îndreptat, că are simț pentru asta, că crezi în el, și va exersa până reușește. Carnegie dă exemplul unui prieten care, pe la patruzeci de ani, a luat lecții de dans ca să-i facă pe plac logodnicei. Primul profesor i-a spus că face totul greșit și că trebuie să o ia de la zero, iar el a renunțat curând. Următorul i-a spus că stilul lui e puțin demodat, dar că bazele sunt bune și că are un simț natural al ritmului. A continuat și s-a îmbunătățit.',
    story: {
      who: 'Dale Carnegie și Lowell Thomas',
      when: 'Între cele două războaie mondiale',
      text: 'Prietenul lui Carnegie, crainicul și scriitorul de călătorii Lowell Thomas, a vrut odată să-l atragă într-un joc de bridge. Carnegie nu jucase niciodată și era sigur că nu poate învăța: i se părea un mister de neînțeles. Thomas i-a spus că nu e nimic de el. Bridge-ul înseamnă doar memorie și judecată, iar cum Carnegie scrisese odată despre memorie, i se va părea floare la ureche. Carnegie s-a așezat și, aproape fără să-și dea seama, juca pentru prima dată în viață, pentru că fusese făcut să simtă că are talent pentru asta și că jocul e ușor.',
    },
    mind: 'Dacă oamenii încearcă sau nu depinde mai puțin de cât de grea e de fapt sarcina și mai mult de dacă cred că efortul va da roade. Când o greșeală pare mare, fixă și parte din cine sunt, să încerci pare inutil, iar ei se protejează renunțând. Când pare mică, concretă și remediabilă, efortul pare meritat. Încurajarea schimbă această credință. Funcționează cel mai bine când e întemeiată: o calitate reală pe care omul se poate sprijini și un prim pas concret pe care se poate vedea făcându-l.',
    levers: [
      { name: 'Autoeficacitatea', text: 'Albert Bandura a arătat că oamenii se apucă de sarcini și persistă în ele atunci când cred că le pot face. Încurajarea verbală din partea cuiva credibil este una dintre sursele ei principale, deși mai slabă decât reușita reală, așa că funcționează cel mai bine împreună cu o izbândă timpurie, la îndemână.' },
      { name: 'Reantrenarea atribuirii', text: 'Timothy Wilson și Patricia Linville le-au spus unor studenți din anul întâi aflați în dificultate că notele se îmbunătățesc de obicei după primul an. Acei studenți și-au îmbunătățit apoi notele și au abandonat mai rar decât un grup de comparație. Faptul că problema a fost prezentată ca temporară și frecventă a făcut-o să pară remediabilă.' },
      { name: 'Neputința învățată', text: 'Primele experimente ale lui Martin Seligman au arătat că animalele expuse la eșecuri pe care nu le puteau controla au încetat să mai încerce să scape chiar și când scăparea devenise posibilă. Oamenii cărora li se spune în repetate rânduri că eșuează pot învăța aceeași pasivitate; încurajarea restabilește sentimentul că efortul contează.' },
    ],
    traps: [
      { how: 'Tratăm cu ușurință o greșeală ca pe o parte fixă din caracterul cuiva. Dacă o descrii ca pe o abilitate încă neînvățată, nu ca pe un defect al persoanei, o faci remediabilă în ochii lui și în ai tăi.' },
      { how: 'Aceeași distanță poate fi încadrată ca „faci totul greșit” sau „ești la o singură schimbare distanță”. Încadrarea hotărăște dacă oamenii văd un zid sau o treaptă.' },
    ],
    laws: [
      { how: 'Greene recomandă să ascunzi efortul din spatele realizărilor tale, ca ele să pară fără efort, iar tu înzestrat. Carnegie folosește aparența de ușurință pentru celălalt: face sarcina lui să pară ușoară, ca el să îndrăznească să înceapă.' },
    ],
    study: {
      who: 'Claudia Mueller și Carol Dweck, 1998',
      title: 'Lauda pentru inteligență poate submina motivația și performanța copiilor',
      text: 'Elevi de clasa a cincea au rezolvat un set de probleme și au fost lăudați fie că sunt deștepți, fie că muncesc din greu. Apoi au primit un set mult mai greu și s-au descurcat prost. Copiii lăudați pentru inteligență au savurat sarcina mai puțin, au fost mai puțin dispuși să persevereze, au avut rezultate mai slabe la un set final și au fost mai înclinați să-și exagereze scorurile când le raportau altora. Copiii lăudați pentru efort au tratat eșecul ca pe un semn să încerce o altă abordare. Lucrarea a ajutat la lansarea mișcării „mentalității de creștere”, dar dovezile mai noi sunt mai sobre: studiile mari despre intervențiile de mentalitate găsesc efecte medii mici, concentrate la elevii în dificultate, iar cel puțin o replicare atentă a experimentului cu laude (Li și Bates, 2019) nu a găsit efectul.',
    },
    today: [
      'Îi spui unui coleg care a dat-o în bară la primul apel cu un client că structura era bună și doar începutul trebuie lucrat',
      'Îi spui unui copil care învață să înoate: „Bătaia ta de picioare e deja puternică, acum mai trebuie doar să îndreptăm brațele”',
      'Revizuiești prima contribuție open-source a unui începător arătând singura mică schimbare care o va face acceptată',
      'Îi spui partenerului emoționat de examenul de conducere că manevra de care se teme are doar trei pași și o exersați împreună',
    ],
    scenario: 'Un bărbat de vreo cincizeci de ani se înscrie la un curs de limbi străine seara și încremenește de fiecare dată când trebuie să vorbească. După a doua lecție, profesoara îi spune că pronunția lui e neobișnuit de bună pentru un începător și că singura lui problemă reală este ordinea cuvintelor, care vine cu câteva săptămâni de exercițiu. Începe să se ofere voluntar să răspundă, iar până la sfârșitul trimestrului el este cel care îi ajută pe cursanții mai noi.',
    practice: [
      'Data viitoare când cineva se chinuie, numește un lucru pe care îl face bine și o mică îndreptare concretă',
      'Împarte în trei pași o abilitate de care se teme cineva și ajută-l să facă astăzi primul pas',
      'Înlocuiește în mintea ta „ești slab la asta” cu „încă n-ai exersat asta” și observă cât de diferit te porți',
    ],
    slips: [
      'Să spui că ceva e ușor când e cu adevărat greu, ceea ce îi lasă pe oameni să se simtă proști când se chinuie',
      'Să încurajezi fără niciun pas următor concret, așa că vorbele calde nu duc nicăieri',
      'Să lauzi talentul („ești un talent natural”) în loc de abordare, ceea ce poate face următorul eșec să pară o dovadă a nereușitei',
    ],
    shadow: 'Încurajarea se transformă în falsă alinare când greșeala e serioasă, iar remediul chiar greu. Dacă îi spui cuiva că e ușor, îl poți face să se simtă mai rău când nu este, și îl poți opri să caute ajutor real. Uneori lucrul cinstit și bun este să spui: e greu, va dura, și cred că poți.',
    honest: 'Crezi că omul se poate îmbunătăți și îi arăți primul pas, descriind dificultatea cu sinceritate, dar fără să o faci mai mare decât este.',
    question: 'Ce defect de-al tău ai hotărât că nu se poate îndrepta și cum l-ar descrie cineva care te încurajează?',
  },

  /* ---------------- 30 ---------------- */
  30: {
    title: 'Fă-l pe celălalt să se bucure să facă ceea ce îi sugerezi',
    line: 'Arată-le oamenilor ce câștigă și cererea devine o ocazie, nu o corvoadă.',
    gist: 'Carnegie încheie cartea cu o regulă practică: când vrei ca cineva să facă ceva, gândește-te mai întâi ce câștigă el din asta și formulează în așa fel încât să facă bucuros. Fii sincer, știi exact ce vrei, gândește-te la ce își dorește el cu adevărat și potrivește beneficiul nevoilor lui. Povestește despre o femeie al cărei gazon era călcat în picioare de băieții din cartier. Cearta n-a mers, așa că i-a dat celui mai rău dintre ei un titlu, l-a făcut „detectivul” ei și l-a pus să țină intrușii departe. El a luat slujba în serios, iar problema a încetat.',
    story: {
      who: 'Napoleon Bonaparte',
      when: '1802–1805',
      text: 'În 1802, Napoleon a creat Legiunea de Onoare și a început să împartă decorațiile ei soldaților. În 1804 a numit optsprezece generali ai săi mareșali ai Imperiului, iar armata lui a numit-o Grande Armée. Criticii s-au plâns că dădea jucării unor veterani încercați. Napoleon a răspuns că oamenii sunt conduși prin jucării sau, după cum se traduce adesea, că oamenii se conduc cu brizbizuri. Carnegie recunoaște că poate părea cinic, dar susține că tehnica de a da titluri și recunoaștere a mers pentru Napoleon și merge în viața obișnuită, pentru că oamenii vor să se simtă importanți în ceea ce fac.',
    },
    mind: 'Oamenii fac mult mai mult și mult mai bine când o activitate pare aleasă și răsplătitoare decât când pare impusă. Felul în care e încadrată o sarcină modelează felul în care e trăită: aceeași treabă poate părea o onoare sau o povară, după ce se spune că înseamnă. Recunoașterea și sentimentul de scop sunt puternice pentru că hrănesc nevoile de a te simți apreciat și de a conta. Riscul este că recompensele externe, împărțite stângaci, îi pot face pe oameni să se simtă controlați și să alunge plăcerea pe care o aveau în muncă.',
    levers: [
      { name: 'Semnificația sarcinii', text: 'Adam Grant și colegii lui au descoperit că apelanții universității care strângeau fonduri și petreceau câteva minute cunoscând un student a cărui bursă fusese finanțată de munca lor au stat apoi mult mai mult la telefon și au strâns mult mai mulți bani decât cei care nu-l cunoscuseră. Faptul că au văzut cine are de câștigat a făcut aceeași muncă să merite.' },
      { name: 'Efectul de supra-justificare', text: 'Mark Lepper, David Greene și Richard Nisbett au descoperit că preșcolarii cărora li se promisese o recompensă pentru desenatul cu markere au ales apoi să deseneze cu ele mai puțin decât copiii cărora nu li se promisese. Recompensele care se simt ca o plată pot transforma jocul în muncă, așa că cele mai bune „brizbizuri” sunt recunoașterea a ceva la care oamenii țin deja.' },
      { name: 'Recunoașterea și statutul', text: 'Oamenii țin la poziție și la respect, nu doar la bani. Titlurile, mulțumirile publice și responsabilitatea semnalează că cineva contează, de aceea au mers medaliile lui Napoleon și insigna de „detectiv” a băiatului.' },
    ],
    traps: [
      { how: 'O cerere formulată ca oportunitate se simte altfel decât aceeași cerere formulată ca datorie. Principiul lui Carnegie este încadrarea cinstită: să găsești beneficiul real și să-l pui primul.' },
      { how: 'Un titlu sau o responsabilitate face ca treaba să se simtă a ta, iar oamenii apără ce e al lor. Băiatul-detectiv păzea gazonul pentru că, într-un fel, devenise al lui.' },
    ],
    laws: [
      { how: 'Greene spune că atunci când ceri ajutor, trebuie să apelezi la interesul propriu, nu la milă sau recunoștință. Carnegie e întru totul de acord, dar insistă că beneficiul trebuie să fie real, nu o promisiune pe care nu intenționezi să o ții.' },
      { how: 'Greene recomandă să hrănești fanteziile de glorie ale oamenilor. Medaliile lui Napoleon au făcut exact asta. Varianta mai blândă a lui Carnegie dă o recunoaștere care se potrivește cu ceva adevărat din contribuția omului, nu cu o iluzie.' },
    ],
    study: {
      who: 'Dan Ariely, George Loewenstein și Drazen Prelec, 2006',
      title: 'Tom Sawyer și construirea valorii',
      text: 'Numit după băiatul lui Mark Twain, care și-a convins prietenii că a vopsi un gard cu var era un privilegiu pentru care merita să plătești. Ariely le-a oferit studenților o scurtă lectură de poezie. Pe jumătate dintre ei i-a întrebat mai întâi dacă ar plăti o sumă mică ca s-o asculte; pe ceilalți, dacă ar veni dacă ar fi plătiți cu aceeași sumă. Mai târziu, cei întrebați mai întâi despre plată erau dispuși să plătească pentru lecturi, în timp ce cei întrebați mai întâi dacă ar fi plătiți voiau bani ca să vină. Aceeași experiență era o răsfățare sau o corvoadă după felul în care fusese prezentată. Sumele au fost mici, iar cadrul o sală de curs, dar studiul arată cât de mult încadrarea modelează ce cred oamenii că valorează o sarcină, tocmai de aceea trebuie folosită cinstit.',
    },
    today: [
      'Îi ceri unui coleg să conducă un proiect pentru că îi va da vizibilitatea pe care a spus că o vrea',
      'Îi dai copilului „sarcina” de a alege traseul la o plimbare în familie, în loc să-l târăști după tine',
      'Inviți un voluntar să conducă recepția pentru că are cea mai prietenoasă față din grup',
      'Îi ceri unui contributor open-source să devină responsabil (maintainer) al modulului pe care îl cunoaște cel mai bine',
    ],
    scenario: 'O școală are nevoie de cineva care să organizeze concertul de sfârșit de an, o sarcină pe care n-o vrea nimeni. Directoarea observă că unul dintre profesorii de muzică se plânge că ansamblul lui nu e niciodată ascultat. Îi cere să dirijeze concertul și să-l încheie cu prestația ansamblului lui. El își petrece primăvara cu el cu plăcere, iar concertul e cel mai bun pe care l-a avut școala în ultimii ani.',
    practice: [
      'Înainte de următoarea ta cerere, notează ce câștigă de fapt celălalt din ea și începe cu asta',
      'Oferă un titlu sau o responsabilitate reală cuiva care face mereu o treabă fără recunoștință, și gândește-o cu adevărat',
      'Transformă o corvoadă de acasă într-o alegere: lasă-l pe celălalt să aleagă ce sarcină preia',
    ],
    slips: [
      'Să inventezi beneficii care nu există, pe care oamenii le descoperă și nu le uită niciodată',
      'Să împarți titluri goale, care nu vin cu respect sau autoritate reale',
      'Să faci totul atât de vădit un discurs de vânzare încât omul se simte manevrat, nu apreciat',
    ],
    shadow: 'Aici Carnegie se apropie cel mai mult de manipularea pură: arta de a-i face pe oameni bucuroși să facă ce voiai tu de la început. Titlurile și brizbizurile pot fi substitute ieftine pentru o plată corectă sau pentru respect real, iar încadrarea poate face o afacere proastă să arate ca un dar. Dacă nu există cu adevărat nimic de câștigat pentru ei, lucrul cinstit este să spui asta, să ceri pe față și să fii recunoscător dacă te ajută oricum.',
    honest: 'Cauți ce ar face cu adevărat treaba bună pentru celălalt, iar dacă nu găsești nimic, îi ceri ca pe o favoare și o recunoști ca atare.',
    question: 'Următorul lucru pe care îl ceri cuiva: ce l-ar face să fie bucuros, nu doar dispus, să-l facă?',
  },
};
