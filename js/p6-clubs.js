/* js/p6-clubs.js — Part 6, clubs: who a club fits (TH.clubMatch), personal filters, short taglines,
 * real EngageSC images (TH.CLUB_PHOTOS from js/club-photos.js) and generated covers for clubs without one.
 *
 * Contract (P6-CONTRACT.md):
 *   TH.clubMatch(club)  → {score, career:boolean, major:boolean, why:[strings], careerTier, majorTier, careerKey, majorKey}
 *   TH.clubCover(club, {photo, size}) → HTML for a cover: a real EngageSC image when we have one,
 *                          otherwise an obviously generated graphic (category colour + initials + pattern).
 *   TH.clubPhotos(club) → [{src, kind:'logo'|'photo', from}] (accepts plain data-URI strings too)
 *   TH.clubTagline(club) → one complete short phrase (≤ ~60 chars, usually ≤ 46) taken from the club's own EngageSC
 *                          description, or a compact "Category · Type" label when no clean phrase exists. Never a fragment.
 *   TH.clubPersonal(kind) → {kind, ok, label, values, strong, rows:[{c, m, tier}]} for 'foryou' | 'career' | 'major'
 *                          ('mycareer' / 'mymajor' are accepted too: they are the list's filter keys).
 * Matching is deliberately strict for the Career and Your major filters: a club counts only when the goal shows up in
 * its NAME, or its description mentions it (twice, or once in the opening sentence or alongside a matching EngageSC
 * category). A category on its own never counts, and generic words ("health", "media", "tech") count only in the name.
 * Tier 1 = strong match ("Matched to your goal"), tier 2 = "Also related" (weaker mention, or a grad/staff group).
 * Reads preferences only through TH.prefs() / TH.likeScore() (profile agent); falls back to the friend's
 * profile store (TH.H().x.profile) when those are not loaded. Pure functions, no side effects at load.
 */
(function (TH) {
  'use strict';
  const esc = s => TH.esc(s);
  if (TH.iconPaths && !TH.iconPaths.expand) TH.iconPaths.expand = '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>';
  const hue = id => { let s = 0; for (const ch of String(id)) s = (s * 31 + ch.charCodeAt(0)) >>> 0; return s % 360; };
  const uniq = a => [...new Set(a.filter(Boolean))];
  const words = s => new Set(s.split(/\s+/));

  // ---------------------------------------------------------------------------------------------
  // preferences (read-only)
  // ---------------------------------------------------------------------------------------------
  function prefs() {
    try { if (typeof TH.prefs === 'function') { const p = TH.prefs(); if (p) return p; } } catch (e) { console.warn(e); }
    let pr = {};
    try { pr = (TH.H().x || {}).profile || {}; } catch (e) { /* no account yet */ }
    const major = (TH.student && TH.student().major) || '';
    return { interests: pr.hobbies || [], careerInterests: pr.careerInterests || [], careerGoals: pr.goals || [], clubTypes: pr.clubTypes || [],
      foods: pr.foods || [], snacks: pr.snacks || [], drinks: pr.drinks || [], diet: pr.diet || [], allergies: pr.allergies || [],
      major: pr.major || major, minor: pr.minor || '', year: pr.year || '', onboarded: !!pr.onboarded };
  }
  const cleanMajor = m => String(m || '').replace(/\s*\((BS|BA|BFA|BM|MS|MA|PhD|Minor)\)\s*/gi, ' ').replace(/\s+/g, ' ').trim();

  // ---------------------------------------------------------------------------------------------
  // keyword tables: [what the goal / major / interest looks like, STRONG stems, WEAK stems]
  // Stems are regex sources matched after a word boundary. Strong stems count in the name, the EngageSC category and
  // the description; weak stems are generic words that count only in the club's name or category.
  // ---------------------------------------------------------------------------------------------
  const CAREER = [
    [/software|developer|\bswe\b|programm|coding|computer|\btech\b|web dev|app dev/i,
      ['software', 'coding', 'coders?\\b', 'programmers?\\b', 'programming (languages?|skills|competitions?|contests?)\\b', 'hackathons?', 'hack(s|ers|ing)?\\b', 'developers?\\b', 'computer science', 'computing\\b', 'acm\\b', 'women in (cs|computing|tech)\\b', 'cyber ?security', 'data science', 'machine learning', 'ai\\b', 'artificial intelligence', 'web (development|dev|design|apps?)\\b', 'open[- ]source', 'full[- ]stack', 'swe\\b'],
      ['tech\\b', 'technolog', 'robot', 'blockchain', 'computer', 'digital', 'cs\\b', 'apps?\\b', 'startups?\\b']],
    [/\bdata\b|analytic|machine learning|\bai\b|artificial intel/i,
      ['data (science|analytics?|engineering|visuali[sz]ation)\\b', 'datathons?', 'analytics\\b', 'machine learning', 'ai\\b', 'artificial intelligence', 'statistic(s|al)\\b', 'big data'],
      ['data\\b', 'quant\\b', 'quantitative', 'computing\\b']],
    [/consult/i,
      ['consult(ing|ancy|ancies|ants?)\\b', 'case comp(etition)?s?\\b', 'case interviews?', 'case prep'],
      ['consult', 'strategy', 'advisory', 'business']],
    [/financ|bank|invest|trading|accounting|wall street|private equity|venture cap/i,
      ['finance\\b', 'financial (services|markets?|model(l)?ing|analysis|analysts?|industry|planning|literacy|engineering|institutions?)\\b', 'fintech', 'invest(ing|ments?|ors?)\\b', 'investment bank', 'banking\\b', 'bankers?\\b', 'private equity', 'venture capital', 'hedge funds?', 'asset management', 'wall street', 'stock (market|pitch(es)?)\\b', '(stock|equity|algorithmic|quantitative|options) trading', 'traders?\\b', 'quantitative finance', 'accounting\\b', 'accountants?\\b', 'cpa\\b', 'portfolio management'],
      ['financ', 'econom', 'quant\\b', 'venture', 'markets?\\b', 'capital\\b', 'trading']],
    [/medic|doctor|physician|pre-?med|pre-?health|health|nurs|dent|pharm|surg|clinic/i,
      ['medic(al|ine|s)?\\b', 'pre-?med', 'pre-?health', 'pre-?dent', 'pre-?pharm', 'physicians?\\b', 'doctors?\\b', 'clinic(s|al)?\\b', 'hospitals?\\b', 'nurs(e|es|ing)\\b', 'dental\\b', 'dentist', 'pharmac', 'mcat\\b', 'surg(ery|eons?|ical)\\b', 'emts?\\b', 'emergency medical', 'public health', 'global health', 'health ?care\\b', 'health professions?', 'patients\\b', 'patient care', 'med school', 'shadowing', 'anatomy', 'cardiolog', 'oncolog', 'pediatric', 'neurolog', 'psychiatr', 'radiolog', 'dermatolog', 'ophthalm', 'orthop(a)?ed', 'optometr', 'physical therap', 'occupational therap', 'veterinar'],
      ['(?<!mental )health(?!\\s*(&|and)\\s*wellness)', 'medic', 'cancer', 'disease', 'diabet', 'kidney', 'cardio', 'cpr\\b', 'first aid', 'red cross']],
    [/\blaw\b|legal|attorney|lawyer|pre-?law|court/i,
      ['law\\b', 'lawyers?\\b', 'legal\\b', 'pre-?law', 'mock trial', 'moot court', 'attorneys?\\b', 'paralegal', 'lsat\\b', 'law school', 'criminal justice', 'constitution(al)?\\b', 'litigat', 'jurisprud', 'judicial', 'phi alpha delta', 'legal aid'],
      ['justice', 'court\\b', 'rights\\b', 'policy', 'debate']],
    [/film|\btv\b|television|cinema|entertain|screen|movie|animation|hollywood/i,
      ['films?\\b', 'filmmak', 'cinema', 'cinematic', 'movies?\\b', 'screenwrit', 'screenplay', 'television', 'tv\\b', 'entertainment\\b', 'animation', 'animators?\\b', 'documentar', 'video production', 'hollywood', 'showrunn'],
      ['media\\b', 'productions?\\b', 'video', 'actors?\\b', 'acting\\b', 'studios?\\b', 'content creat', 'youtube', 'streaming']],
    [/research|scien|\blab\b/i,
      ['research(ers?|ing)?\\b', 'undergraduate research', 'labs?\\b', 'laborator', 'scientific', 'scientists?\\b', 'peer[- ]reviewed'],
      ['scien', 'journal', 'stem\\b', 'scholars?\\b']],
    [/design|\bux\b|\bui\b|graphic/i,
      ['design\\b(?! teams?)', 'designers?\\b', 'ux\\b', 'ui\\b', 'user experience', 'graphic design', 'product design', 'industrial design', 'interaction design', 'figma', 'architect(ure|ural)\\b'],
      ['creative', 'graphic', 'product\\b', 'visual\\b', 'art\\b']],
    [/market|brand|advertis|\bpr\b|public relations/i,
      ['marketing', 'brand(ing|s)?\\b', 'advertis', 'public relations', 'pr\\b', 'social media marketing'],
      ['social media', 'communications?\\b', 'media\\b', 'influencers?', 'content\\b']],
    [/public service|government|policy|politic|nonprofit|non-profit|civic|public sector/i,
      ['public service', 'public policy', 'government\\b', 'policy\\b', 'policies', 'politic', 'civic', 'nonprofits?\\b', 'non-profits?\\b', 'public sector', 'advocacy', 'legislat'],
      ['service', 'community', 'justice', 'volunteer']],
    [/entrepreneur|start ?a company|start-?up|founder|venture/i,
      ['entrepreneur', 'start-?ups?\\b', 'ventures?\\b', 'incubator', 'accelerator', 'pitch (competitions?|nights?|decks?)\\b', 'shark tank', 'small business'],
      ['innovation', 'business', 'pitch', 'founders?\\b']],
    [/educat|teach|tutor/i,
      ['teach(ing|ers?)?\\b', 'tutor', 'literacy', 'k-12', 'classrooms?\\b', 'underserved (youth|students|schools)', 'high school students', 'elementary', 'middle school'],
      ['education', 'school', 'mentor(s|ing|ship)?\\b', 'youth']],
    [/^(?!.*software).*engineer/i, // "Software engineering" uses the software stems only
      ['engineer', 'viterbi', 'design teams?', 'robot', 'aero(space)?\\b', 'rocket', 'mechanical', 'electrical', 'civil engineering', 'biomedical engineering', 'chemical engineering', 'aircraft', 'satellite', 'cubesat'],
      ['stem\\b', 'build']],
    [/\bgame|gaming|esport/i, ['video games?', 'game (dev|design|development|jams?|studios?)\\b', 'gaming', 'esports?', 'gamers?\\b'], ['games?\\b']],
    [/music|perform|sing|\bband\b|songwrit/i, ['music', 'musicians?\\b', 'bands?\\b', 'choir', 'a cappella', 'cappella', 'orchestra', 'concerts?\\b', 'singing', 'singers?\\b', 'songwrit', 'jazz', 'djs?\\b', 'record label'], ['perform']],
    [/journal|writ|publish|news|editor|reporter/i, ['journalis', 'writ(ing|ers?)\\b', 'magazines?\\b', 'publications?\\b', 'newspapers?\\b', 'daily trojan', 'press\\b', 'editorial', 'reporters?\\b', 'reporting\\b', 'news\\b', 'podcasts?\\b'], ['journal\\b', 'media\\b', 'stories']],
    [/sustainab|environment|climate|energy|conservation/i, ['sustainab', 'environment', 'climate', 'renewable', 'clean energy', 'conservation', 'recycl', 'zero waste'], ['energy', 'green\\b', 'nature', 'ocean']],
    [/real estate|property/i, ['real estate', 'propert(y|ies)\\b', 'reits?\\b'], ['housing', 'urban']],
    [/sport|athlet/i, ['sports? (business|management|analytics|medicine|marketing|industry|media)\\b', 'athletics\\b', 'athletes?\\b'], ['sports?\\b', 'coach']],
    // career interests (Profile → "This year I want…")
    [/intern/i, ['internships?\\b', 'interns?\\b', 'recruit(ing|ment|ers?)\\b', 'career fairs?', 'employers?\\b', 'info(rmation)? sessions?', 'hiring\\b'], ['career', 'professional']],
    [/network/i, ['networking', 'alumni\\b', 'mixers?\\b', 'industry (nights?|professionals|leaders|events?|panels?)\\b', 'mentors?(hip)?\\b'], ['professional', 'connections?']],
    [/grad(uate)? school|\bph\.?d\b/i, ['grad(uate)? school', 'pre-?(med|law|health|dental|pharmacy)\\b', 'mcat\\b', 'lsat\\b', 'gre\\b', 'ph\\.?d\\b', 'medical school', 'law school'], ['graduate']],
    [/hackathon|case comp|competition/i, ['hackathons?', 'hack nights?', 'case comp(etition)?s?\\b', 'datathons?', 'competitions?\\b', 'competitive programming'], ['compet']],
    [/portfolio/i, ['portfolio', 'design teams?', 'build(ing)? (projects?|nights?)\\b', 'hands-on projects?'], ['projects?\\b', 'workshops?']],
    [/abroad|exchange/i, ['study abroad', 'abroad\\b', 'exchange (programs?|students?)\\b'], ['international', 'travel']],
    [/\bjob|part-?time|work-?study/i, ['jobs?\\b', 'job fairs?', 'hiring\\b', 'work-?study', 'part-?time', 'employment\\b'], ['career']],
    [/leader/i, ['leadership\\b', 'leaders?\\b', 'executive board', 'student government'], ['officers?\\b']],
  ];
  const MAJOR = [
    [/computer sci|\bcsci\b|\bcs\b|computer engineering|informatics|software/i,
      ['computer science', 'computing\\b', 'software', 'coding', 'coders?\\b', 'programmers?\\b', 'programming (languages?|skills|competitions?|contests?)\\b', 'hackathons?', 'hack(s|ers)?\\b', 'acm\\b', 'women in (cs|computing|tech)\\b', 'cyber ?security', 'data science', 'machine learning', 'ai\\b', 'artificial intelligence', 'developers?\\b'],
      ['tech\\b', 'computer', 'robot', 'cs\\b', 'digital', 'technolog']],
    [/data sci|statistic|analytics/i, ['data (science|analytics?)\\b', 'datathons?', 'statistic(s|al)\\b', 'machine learning', 'analytics\\b', 'big data'], ['data\\b', 'computing\\b', 'quant\\b']],
    [/electrical|mechanical|aerospace|astronautic|civil|biomedical|chemical|industrial|engineer/i, ['engineer', 'viterbi', 'design teams?', 'robot', 'rocket', 'aero(space)?\\b', 'mechanical', 'electrical'], ['stem\\b', 'build']],
    [/business|accounting|finance|marketing|management|entrepreneur|real estate/i,
      ['business(es)?\\b', 'marshall\\b', 'finance\\b', 'financial (services|markets?|literacy|industry)\\b', 'invest(ing|ments?|ors?)\\b', 'consult(ing|ancy|ants?)\\b', 'entrepreneur', 'accounting\\b', 'marketing\\b', 'case comp', 'venture capital'],
      ['econom', 'management', 'ventures?\\b', 'financ', 'start-?ups?\\b']],
    [/econom/i, ['economics\\b', 'economists?\\b', 'economic (policy|research|analysis|theory|development)\\b', 'econ\\b'], ['econom', 'financ', 'policy', 'markets?\\b']],
    [/cinema|film|media arts|animation|screen|television|\btv\b/i,
      ['films?\\b', 'filmmak', 'cinema', 'cinematic', 'movies?\\b', 'screenwrit', 'screenplay', 'animation', 'animators?\\b', 'documentar', 'television', 'tv\\b', 'video production', 'hollywood'],
      ['media\\b', 'productions?\\b', 'video', 'actors?\\b', 'studios?\\b', 'entertainment']],
    [/^(?!.*design).*(journal|communicat|public relations|annenberg)/i, ['journalis', 'annenberg', 'news\\b', 'broadcast', 'reporters?\\b', 'newspapers?\\b', 'magazines?\\b', 'public relations', 'podcasts?\\b', 'radio\\b'], ['media\\b', 'communicat', 'writ']],
    [/biolog|neuro|chemis|health|kinesiol|pre-?med|biochem|nursing|pharmac|physiolog/i,
      ['biolog', 'neuroscien', 'chemis', 'biochem', 'pre-?med', 'pre-?health', 'medic(al|ine)\\b', 'kinesiolog', 'public health', 'health (sciences?|care)\\b', 'healthcare', 'physiolog'],
      ['health', 'scien', 'research', 'labs?\\b', 'neuro']],
    [/psych/i, ['psycholog', 'psych\\b', 'mental health', 'cognitive', 'neuroscien'], ['wellness', 'neuro']],
    [/political|international relations|public policy|politic|government|global studies/i, ['politic', 'policy\\b', 'policies', 'government\\b', 'model un\\b', 'model united nations', 'diplomac', 'international relations', 'foreign affairs', 'geopolit', 'elections?\\b'], ['international', 'civic', 'law\\b']],
    [/\blaw\b|legal|pre-?law/i, ['law\\b', 'legal\\b', 'pre-?law', 'mock trial', 'moot court', 'lsat\\b', 'criminal justice', 'lawyers?\\b', 'attorneys?\\b'], ['justice', 'rights\\b', 'policy']],
    [/music|thornton|jazz|songwrit/i, ['music', 'thornton', 'bands?\\b', 'orchestra', 'choir', 'a cappella', 'cappella', 'concerts?\\b', 'jazz', 'songwrit', 'musicians?\\b', 'record label'], ['perform', 'sing']],
    [/theat|drama|danc|perform|acting/i, ['theat(re|er|rical)\\b', 'drama\\b', 'danc(e|ers?|ing)\\b', 'musical theat', 'improv\\b', 'acting\\b', 'actors?\\b'], ['perform', 'stage\\b']],
    [/architect|urban/i, ['architect', 'urban design', 'urban planning'], ['design\\b', 'urban']],
    [/^(?!.*(cinema|film|media arts|music|theat|perform|architect)).*\b(art|arts|design|illustration|painting|photograph)/i,
      ['art\\b', 'arts\\b', 'artists?\\b', 'roski', 'design\\b(?! teams?)', 'designers?\\b', 'graphic design', 'illustrat', 'painting', 'drawing', 'galler(y|ies)\\b', 'ceramic', 'sculpt', 'photograph'],
      ['creative', 'visual\\b']],
    [/english|writing|literat|poetry/i, ['writ(ing|ers?)\\b', 'literary', 'literature', 'poetry', 'poets?\\b', 'books?\\b', 'novels?\\b', 'fiction\\b', 'creative writing'], ['reading\\b', 'stories']],
    [/math|physics|astron|statistic/i, ['math', 'physics', 'astronom', 'astrophys', 'quant\\b', 'quantitative'], ['stem\\b']],
    [/environment|sustainab|climate|marine|ocean/i, ['environment', 'sustainab', 'climate', 'conservation', 'renewable'], ['green\\b', 'nature', 'energy', 'ocean']],
    [/gam(e|ing)|interactive/i, ['video games?', 'game (dev|design|development|jams?|studios?)\\b', 'gaming', 'esports?', 'gamers?\\b'], ['games?\\b', 'interactive']],
  ];
  // interests are looser (any strong mention counts), but the stems avoid everyday words ("safe space", "Model UN", "food bank")
  const INTEREST = [
    [/hik/i, ['hik(e|es|ing|ers?)\\b', 'outdoors?\\b', 'backpack', 'camping', 'trails?\\b'], ['adventure', 'nature', 'climb']],
    [/\bfilm|movie|cinema/i, ['films?\\b', 'movies?\\b', 'cinema'], []],
    [/gaming|video game|esport/i, ['gaming', 'video games?', 'esports?', 'gamers?\\b', 'board games?'], ['games?\\b']],
    [/music|band|sing/i, ['music', 'bands?\\b', 'choir', 'cappella', 'concerts?\\b', 'orchestra', 'jazz', 'singing'], []],
    [/danc/i, ['danc(e|ers?|ing)\\b', 'ballet', 'hip[- ]hop', 'k-?pop', 'salsa', 'bhangra', 'choreograph'], []],
    [/coding|programm|software/i, ['coding', 'hackathons?', 'programmers?\\b', 'programming (languages?|skills|competitions?|contests?)\\b', 'software', 'developers?\\b', 'acm\\b'], ['tech\\b', 'computer']],
    [/volunteer|service/i, ['volunteer', 'community service', 'outreach', 'charity', 'nonprofits?\\b'], ['service']],
    [/basketball/i, ['basketball'], []], [/soccer|futbol/i, ['soccer', 'futbol'], []], [/tennis/i, ['tennis'], []],
    [/running|\brun\b/i, ['running\\b', 'run club', 'marathons?', 'track (and|&) field', 'cross country', 'runners?\\b'], []],
    [/yoga|meditat|mindful/i, ['yoga', 'meditat', 'mindful'], []],
    [/cook|bak|culinary/i, ['cook(ing)?\\b', 'culinary', 'bak(ing|ers?|ery)\\b', 'recipes?', 'chefs?\\b'], ['food']],
    [/photo/i, ['photograph', 'photos?\\b', 'cameras?\\b'], []],
    [/startup|entrepreneur/i, ['start-?ups?\\b', 'entrepreneur', 'venture'], ['founders?\\b']],
    [/^art$|\bart\b|paint|draw/i, ['art\\b', 'arts\\b', 'artists?\\b', 'paint', 'drawing', 'galler(y|ies)\\b', 'illustrat', 'crafts?\\b'], []],
    [/fitness|gym|lift|workout/i, ['fitness', 'lifting', 'weightlift', 'powerlift', 'gym\\b', 'workouts?', 'strength training'], []],
    [/read|book/i, ['books?\\b', 'reading\\b', 'readers?\\b', 'literary', 'literature', 'poetry', 'book club'], []],
    [/writ|poet/i, ['writ(ing|ers?)\\b', 'poetry', 'creative writing', 'literary'], ['journal']],
    [/travel/i, ['travel', 'abroad\\b', 'trips?\\b'], ['international']],
    [/faith|relig|spiritual|church/i, ['faith', 'christian', 'muslim', 'islam', 'jewish', 'hindu', 'buddhis', 'church', 'spiritual', 'bible', 'catholic', 'worship', 'fellowship'], []],
    [/surf/i, ['surf'], []], [/climb|boulder/i, ['climb', 'boulder'], []], [/chess/i, ['chess'], []],
    [/debate|speech/i, ['debate', 'speech', 'model un\\b', 'forensics'], []],
    [/theat|drama|acting/i, ['theat', 'drama', 'improv\\b', 'musicals?\\b'], []],
    [/comedy|improv/i, ['comedy', 'improv\\b', 'stand-?up', 'sketch'], []],
    [/fashion|style/i, ['fashion', 'styling', 'modeling\\b', 'apparel', 'streetwear'], ['style']],
    [/anime|manga/i, ['anime', 'manga', 'cosplay'], []], [/robot/i, ['robot'], []],
    [/\bspace\b|astro|rocket/i, ['space (exploration|science|industry|technology)', 'aerospace', 'astronom', 'astro', 'rockets?\\b', 'nasa\\b', 'satellite'], []],
    [/sports games|game ?day|tailgat/i, ['game ?days?\\b', 'tailgat', 'spirit', 'athletics\\b', 'fans?\\b'], ['sports?\\b']],
  ];
  const STOP = new Set('and the for with of in on at to a an science sciences studies arts art bs ba bfa major minor program general'.split(' '));
  const reCache = new Map();
  const reOf = stems => { const k = stems.join('|'); let r = reCache.get(k); if (!r) { r = new RegExp('\\b(?:' + k + ')', 'i'); reCache.set(k, r); } return r; };
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function entryFor(value, table) {
    const v = String(value || '').trim(); if (!v) return null;
    const s = [], w = [];
    table.forEach(([re, st, wk]) => { if (re.test(v)) { s.push(...st); w.push(...(wk || [])); } });
    if (!s.length) v.toLowerCase().split(/[^a-z0-9+#]+/).filter(x => x.length > 3 && !STOP.has(x)).forEach(x => s.push(escRe(x.slice(0, Math.max(4, x.length - 2)))));
    const S = uniq(s);
    return S.length ? { s: S, w: uniq(w).filter(x => !S.includes(x)) } : null;
  }

  // ---------------------------------------------------------------------------------------------
  // club haystacks (computed once per club) and how a goal shows up in one
  // ---------------------------------------------------------------------------------------------
  const HAY = new Map();
  function hayOf(c) {
    let h = HAY.get(c.id);
    if (!h) {
      const d = String(c.desc || '').replace(/\s+/g, ' ').trim();
      const lead = (d.split(/(?<=[.!?])\s+(?=[A-Z])/)[0] || '').slice(0, 220);
      h = { name: ' ' + String(c.name || '').toLowerCase() + ' ', cats: ' ' + (c.cats || [c.cat]).join(' ').toLowerCase() + ' ' + String(c.type || '').toLowerCase() + ' ', desc: ' ' + d.toLowerCase() + ' ', lead: ' ' + lead.toLowerCase() + ' ' };
      HAY.set(c.id, h);
    }
    return h;
  }
  function scan(c, e) {
    const h = hayOf(c), S = reOf(e.s), W = e.w.length ? reOf(e.w) : null;
    const nameS = S.test(h.name), nameW = !nameS && !!W && W.test(h.name);
    const cat = S.test(h.cats) || (!!W && W.test(h.cats));
    let descN = 0, lead = false;
    if (S.test(h.desc)) for (const st of e.s) { const r = reOf([st]); if (r.test(h.desc)) { descN++; if (!lead && r.test(h.lead)) lead = true; if (descN >= 4 && lead) break; } }
    return { nameS, nameW, cat, descN, lead };
  }
  // careers and majors: a category alone never counts; one passing mention in a long description doesn't either
  function strict(x) {
    if (!(x.nameS || x.nameW || x.descN >= 2 || (x.descN === 1 && (x.lead || x.cat)))) return null;
    return { v: (x.nameS ? 3 : x.nameW ? 1.8 : 0) + Math.min(2.5, x.descN * 0.9) + (x.lead ? 0.5 : 0) + (x.cat ? 0.6 : 0),
      strong: x.nameS || x.descN >= 2 || (x.nameW && x.descN >= 1) || (x.descN === 1 && x.lead && x.cat) };
  }
  const loose = x => (x.nameS || x.descN >= 1) ? (x.nameS ? 3 : 0) + Math.min(2.5, x.descN * 0.9) + (x.nameW ? 1 : 0) + (x.cat ? 0.5 : 0) : 0;
  // grad/professional/staff groups rank lower for undergrads (they can still be searched and filtered)
  const GRADISH = /\b(graduate|grad student|ph\.?d|doctoral|mba|medical student|med school|keck|dental|dentistry|pharmacy|pharm\.?d|law school|gould|employee|staff|faculty|alumni|resident(s|cy)?\b|physician assistant|\bpa students?)/i;
  const OFFICE = /School or Department|Residential Education|Student Life/;
  function weight(c, p) {
    let w = 1;
    // "Undergraduate" must not read as grad (the demo student's level is "Undergraduate")
    const grad = v => /\b(?:grad|graduate|ph\.?d|masters?|doctoral|doctorate)\b/i.test(String(v || '')) && !/undergrad/i.test(String(v || ''));
    const ug = !grad(p.year) && !grad(TH.student && TH.student().level);
    if (ug && (GRADISH.test(c.name) || GRADISH.test(String(c.desc || '').slice(0, 140)))) w *= 0.2;
    if (OFFICE.test(c.type || '') || /Campus Department/.test((c.cats || []).join(' '))) w *= 0.45;
    return w;
  }

  // thumbs → −1..+1
  function likeOf(c) {
    try { if (typeof TH.likeScore === 'function') { const v = +TH.likeScore({ kind: 'club', type: 'club', id: c.id, org: c.id, orgId: c.id, tags: c.cats || [], cats: c.cats || [], title: c.name }); if (isFinite(v)) return Math.max(-1, Math.min(1, v)); } } catch (e) { /* fall back */ }
    try {
      const x = TH.H().x || {}, f = (x.fb || {})['c' + c.id];
      if (f && f.v) return f.v > 0 ? 1 : -1;
      const w = x.w || {}; let s = (w.org && w.org[c.id]) || 0;
      (c.cats || []).forEach(t => { s += ((w.tag || {})[t] || 0) * 0.35; });
      return Math.tanh(s / 4);
    } catch (e) { return 0; }
  }
  function fbKey() { try { const fb = (TH.H().x || {}).fb || {}; const ks = Object.keys(fb); return ks.length + ':' + ks.reduce((a, k) => a + (fb[k].v || 0) * (k.length + 1), 0); } catch (e) { return '0'; } }

  // ---------------------------------------------------------------------------------------------
  // TH.clubMatch
  // ---------------------------------------------------------------------------------------------
  let MC = null;
  function model() {
    const p = prefs(), key = JSON.stringify([p.interests, p.careerInterests, p.careerGoals, p.clubTypes, p.major, p.minor, p.year]) + '|' + fbKey() + '|' + (TH.CLUBS || []).length;
    if (MC && MC.key === key) return MC;
    const careers = uniq([...(p.careerGoals || []), ...(p.careerInterests || [])]).map(v => ({ v, e: entryFor(v, CAREER) })).filter(o => o.e);
    const major = cleanMajor(p.major), minor = cleanMajor(p.minor);
    const majors = [major && { v: major, minor: false, e: entryFor(major, MAJOR) }, minor && minor.toLowerCase() !== major.toLowerCase() && { v: minor, minor: true, e: entryFor(minor, MAJOR) }].filter(o => o && o.e);
    const interests = uniq(p.interests || []).map(v => ({ v, e: entryFor(v, INTEREST) })).filter(o => o.e);
    const types = uniq(p.clubTypes || []).map(v => String(v));
    MC = { key, p, careers, majors, interests, types, map: new Map(), lists: new Map(), hasPrefs: !!(careers.length || interests.length || types.length || (p.onboarded && majors.length)) };
    return MC;
  }
  const groupsOf = c => (TH.clubGroupsOf ? TH.clubGroupsOf(c) : new Set());
  const groupLabel = k => { const g = (TH.CLUB_GROUPS || []).find(x => x[0] === k); return g ? g[1] : k; };
  function typeHit(c, types) {
    if (!types.length) return null;
    const gs = [...groupsOf(c)], cats = (c.cats || [c.cat]).map(x => String(x).toLowerCase());
    for (const t0 of types) {
      const t = t0.toLowerCase(), tw = t.split(/[^a-z]+/).filter(w => w.length > 2 && !STOP.has(w));
      const g = gs.find(k => { const l = groupLabel(k).toLowerCase(); return l === t || tw.some(w => l.includes(w.slice(0, 5))); });
      // say it in the student's own words ("Tech & engineering"), not the internal group name
      if (g || cats.some(x => tw.some(w => x.includes(w.slice(0, 5))))) return t0.replace(/^./, ch => ch.toUpperCase());
    }
    return null;
  }
  const NONE = { score: 0, career: false, major: false, why: [], careerTier: 2, majorTier: 2, careerKey: 0, majorKey: 0 };
  TH.clubMatch = function (club) {
    const c = club && club.id != null ? club : TH.clubById(club);
    if (!c) return NONE;
    const M = model(); let r = M.map.get(c.id); if (r) return r;
    // a thumbs down on this club itself takes it off every personal list (it stays in All and search)
    let own = 0; try { own = ((((TH.H().x || {}).fb || {})['c' + c.id]) || {}).v || 0; } catch (e) { own = 0; }
    if (own < 0) { r = Object.assign({}, NONE, { score: -1, why: ['You gave this a thumbs down'] }); M.map.set(c.id, r); return r; }
    let cPart = 0, cStrong = false, mPart = 0, mStrong = false, iPart = 0;
    const cHit = [], cRel = [], mHits = [], iHits = [];
    M.careers.forEach(o => { const x = strict(scan(c, o.e)); if (x) { cPart += x.v; if (x.strong) { cStrong = true; cHit.push(o.v); } else cRel.push(o.v); } });
    M.majors.forEach(o => { const x = strict(scan(c, o.e)); if (x) { mPart += x.v * (o.minor ? 0.85 : 1); if (x.strong) mStrong = true; mHits.push({ o, strong: x.strong }); } });
    M.interests.forEach(o => { const v = loose(scan(c, o.e)); if (v) { iPart += v; iHits.push(o.v); } });
    const t = typeHit(c, M.types), like = likeOf(c), why = [];
    let score = cPart * 1.6 + mPart * 1.3 + iPart * 1.2 + (t ? 1.5 : 0) + like * 6;
    if (cHit.length) why.push(`Matched to your goal: ${cHit.slice(0, 2).join(', ')}`);
    else if (cRel.length) why.push(`Related to your goal: ${cRel.slice(0, 2).join(', ')}`);
    mHits.sort((a, b) => b.strong - a.strong).forEach(({ o, strong }) => why.push(`${strong ? 'Fits' : 'Related to'} your ${o.minor ? 'minor' : 'major'}: ${o.v}`));
    if (iHits.length) why.push(`You’re into ${iHits.slice(0, 2).join(' & ')}`);
    if (t) why.push(`You like ${t} clubs`);
    if (own > 0) { score += 4; why.unshift('You gave this a thumbs up'); }
    else if (like > 0.25) why.push('Like clubs you gave a thumbs up');
    const w = weight(c, M.p), bonus = (c.registered ? 0.6 : 0) + (c.open ? 0.3 : 0);
    if (score > 0) score = score * w + bonus;
    if (like <= -0.9) score = -1;
    const key = part => Math.round((part * w + like * 2.5 + (own > 0 ? 3 : 0) + bonus) * 100) / 100;
    r = { score: Math.round(score * 10) / 10, career: cPart > 0 && score > 0, major: mPart > 0 && score > 0, why,
      careerTier: cStrong && w >= 0.45 ? 1 : 2, majorTier: mStrong && w >= 0.45 ? 1 : 2, careerKey: key(cPart), majorKey: key(mPart) };
    M.map.set(c.id, r);
    return r;
  };
  TH.clubMatchReady = () => model().hasPrefs;

  // personal filters: 'foryou' | 'career' (or 'mycareer') | 'major' (or 'mymajor'); memoised per profile + thumbs
  TH.clubPersonal = function (kind) {
    const k = kind === 'mycareer' ? 'career' : kind === 'mymajor' ? 'major' : kind === 'career' || kind === 'major' ? kind : 'foryou';
    const M = model(); if (M.lists.has(k)) return M.lists.get(k);
    const p = M.p, all = TH.CLUBS || [];
    const scored = () => all.map(c => ({ c, m: TH.clubMatch(c) })).filter(o => o.m.score > 0);
    const tie = (a, b) => b.m.score - a.m.score || (b.c.registered === true) - (a.c.registered === true) || a.c.name.localeCompare(b.c.name);
    let out;
    if (k === 'career') {
      const values = uniq([...(p.careerGoals || []), ...(p.careerInterests || [])]);
      const rows = values.length ? scored().filter(o => o.m.career).map(o => ({ c: o.c, m: o.m, tier: o.m.careerTier })).sort((a, b) => a.tier - b.tier || b.m.careerKey - a.m.careerKey || tie(a, b)) : [];
      out = { kind: k, ok: values.length > 0, label: 'Matched to your goal', values, rows, strong: rows.filter(o => o.tier === 1).length };
    } else if (k === 'major') {
      const values = [cleanMajor(p.major), p.minor ? cleanMajor(p.minor) + ' (minor)' : ''].filter(Boolean);
      // ranked by the major/minor part of the match only, so a strong career match can't push a weak major match up
      const rows = M.majors.length ? scored().filter(o => o.m.major).map(o => ({ c: o.c, m: o.m, tier: o.m.majorTier })).sort((a, b) => a.tier - b.tier || b.m.majorKey - a.m.majorKey || tie(a, b)) : [];
      out = { kind: k, ok: M.majors.length > 0, label: 'Matched to your major', values, rows, strong: rows.filter(o => o.tier === 1).length };
    } else {
      const values = uniq([...(p.interests || []), ...(p.careerGoals || []), ...(p.clubTypes || [])]).slice(0, 4);
      const rows = scored().map(o => ({ c: o.c, m: o.m, tier: 1 })).sort(tie);
      out = { kind: 'foryou', ok: M.hasPrefs, label: 'Picked from your profile and thumbs', values, rows, strong: rows.length };
    }
    M.lists.set(k, out);
    return out;
  };

  // ---------------------------------------------------------------------------------------------
  // taglines: one complete short phrase from the club's own description ("Student-run research lab",
  // "Mentors local Los Angeles high school students"), cut only where a clause or phrase ends. Mission-statement
  // boilerplate ("The purpose of this organization is to…", "We are…") is dropped and the verb kept ("Builds…").
  // When no clean phrase fits, a compact label from EngageSC's category and the club's type ("Culture · Association").
  // ---------------------------------------------------------------------------------------------
  const TAG = new Map();
  const T_MAX = 46, T_HARD = 60;
  const ABBR = /\b(?:Inc|Ltd|Co|Corp|St|Dr|Mr|Mrs|Ms|Prof|Jr|Sr|vs|etc|e\.g|i\.e|U\.S|No|Mt|Ave|Blvd|Univ|Dept|approx|Ph\.D|M\.D)\.$/i;
  function sentences(s) {
    const out = []; let cur = '';
    for (const p of s.split(/(?<=[.!?])\s+(?=["'(]?[A-Z0-9])/)) { cur = cur ? cur + ' ' + p : p; if (ABBR.test(cur) || /(?:^|\s)[A-Z]\.$/.test(cur)) continue; out.push(cur); cur = ''; }
    if (cur) out.push(cur);
    return out;
  }
  const VERBS = words('accelerate achieve acknowledge address advance advocate aid allow amplify apply assist bring bridge build carry celebrate challenge champion coach collaborate combat compete connect continue coordinate create cultivate deepen deliver design develop discover discuss distribute donate educate elevate embrace empower enable encourage endeavor engage enhance enrich ensure equip establish examine expand explore expose facilitate fight form foster fund gather give grow guide help highlight honor host improve increase inform inspire instill introduce invite lead learn maintain make manage mentor motivate network nurture offer organize oversee partner perform plan play preserve prepare produce promote protect provide publish pursue raise reach recognize reconnect redefine reduce reimagine represent research revolutionize run serve share showcase spread strengthen study supply support sustain tackle teach train transform tutor unify unite uplift volunteer welcome work');
  const isVerb = w => { w = String(w || '').toLowerCase(); return VERBS.has(w) || (/s$/.test(w) && (VERBS.has(w.slice(0, -1)) || VERBS.has(w.slice(0, -2)) || VERBS.has(w.replace(/ies$/, 'y')))); };
  const WEAK = words('a an the of to for with in on at by from into onto as and or but nor so that which who whom whose where when while its our their his her your my this these those is are was were be been being has have had do does did not very more most such through via about across among amongst around between including like toward towards upon within without than then also both either each every all any some many much other another own same new local diverse various several different numerous interested dedicated committed devoted focused designed aimed related based looking seeking hoping working striving aiming passionate able eager known motivated inspired charged tasked associated intended established general specific built run led made created formed started vibrant inclusive welcoming supportive meaningful positive active innovative creative collaborative educational cultural global interdisciplinary safe strong healthy sustainable accessible equitable holistic lasting engaging enriching rewarding thriving dynamic unique fun friendly involved present organized organised born located situated affiliated ready free available responsible aware informed empowered educated connected united engaged driven whether how what why if focuses focus centers centered centred specializes specializing revolves consists relies depends belongs works strives aims seeks serves tailored geared open career careers field fields area areas aspect aspects topic topics issue issues interests quality importance definition lives variety range number kinds kind types type form forms part parts way ways sense level levels power');
  const GENW = words('students student members member community communities space spaces organization organizations club clubs group groups opportunities opportunity support supports supporting provide provides providing foster fosters create creates develop develops build builds help helps promote promotes leaders leadership environment network networks events event people others interests interest involvement engagement growth development experience experiences place team home welcoming inclusive safe diverse dedicated committed purpose mission goal goals aim vision usc university campus trojan trojans new open fun friendly unique great together like-minded individuals everyone anyone all connect connects connection connections bring brings offer offers serve serves share shares encourage encourages empower empowers enhance enhances increase increases improve improves strengthen strengthens unite unites engage engages inspire inspires allow allows give gives skills resources platform peers passionate strong whole variety student-run student-led student-founded introduces introduce quality active actively meaningful lasting positive personal professional academic social motivated driven talented curious ambitious enthusiastic deepen deepens deepening relationships relationship maintain maintains establish establishes');
  const NONVERB = words('a an the be more all both each every any our its their this these those not also further better only even just very well as in on at by for from with into about over under above below between among one two three');
  const PEOPLE = words('students faculty staff alumni members parents families friends professionals peers undergraduates graduates individuals women men people youth children scholars');
  const PREPS = /^(?:of|in|from|across|within|among|around|at|on)$/i;
  const PART = 'dedicated|devoted|committed|focused|aimed|designed|founded|based|run|led|made|composed|representing|providing|offering|serving|bringing|promoting|working|helping|seeking|focusing|aiming|striving|hosting|creating|connecting|supporting|fostering|empowering|celebrating|uniting|devoting';
  const PART_RE = new RegExp(`^(?:${PART})$`, 'i');
  const CUT_RE = new RegExp(`(\\s*[;:]\\s+|\\s+[-–—]\\s+|\\s*\\(|,\\s+|\\s+(?:and|or)\\s+(?=\\w)|\\s+(?:that|which|who|whom|whose|where|while|through|by|via|in order to|so that|because|as well as|to|for|with|in|on|at|from|among|amongst|across|within|including|such as|like|about|towards?|into|between|${PART})\\b)`, 'gi');
  const GENERIC = /^(?:(?:a|an|the)\s+)?(?:(?:new|official|registered|recognized|premier|premiere|non-?profit|student[- ](?:led|run|founded)|undergraduate|graduate|professional|social|academic|national|local|inclusive|diverse|small|large|vibrant|welcoming|safe|supportive|fun|open)\s+)*(?:student\s+)?(?:organization|org|club|group|community|association|society|team|chapter|space|program|platform|collective|network|place|home)$/i;
  const ABOUT = /^(?:we|our|they|it|this|the (?:club|organization|group|team|society|association|chapter))\b/i;
  const SUBJ = /^(?:(?:the|our|its|this|their)\s+)?(?:(?:primary|main|overarching|core|fundamental|ultimate|central|overall|national|chief)\s+)?(?:missions?|purposes?|goals?|aims?|visions?|objectives?|intent)(?:\s+statement)?(?:\s+of\s+(?:the\s+)?[^,]{2,80}?)?\s+(?:is|are|shall be|will be|has been)\s+(?:to\s+|that\s+)?/i;
  const SV = /^((?:the\s+)?[A-Z0-9"'@][^,;:]{0,70}?)\s+(?=(?:serves|acts|functions|provides|offers|hosts|brings|connects|supports|promotes|creates|develops|builds|helps|unites|represents|celebrates|fosters|empowers|organizes|organises|educates|mentors|teaches|trains|produces|publishes|runs|plans|gives|raises|advocates|encourages|showcases|explores|studies|uplifts|invites|welcomes|focuses|works|meets|gets|is|was)\b)/;
  const third = w => { w = w.toLowerCase(); if (w === 'be') return 'is'; if (w === 'have') return 'has'; if (w === 'do') return 'does'; if (w === 'go') return 'goes'; if (/(?:s|sh|ch|x|z|o)$/.test(w)) return w + 'es'; if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + 'ies'; return w + 's'; };
  function stripSubject(s, c) {
    const full = String(c.name || '').replace(/\s*\((?:Migrated Duplicate|Inactive|Archived)\)\s*$/i, '').trim();
    const base = full.replace(/,?\s+Inc\.?$/i, '').replace(/\s+(?:at|@)\s+(?:USC|the University of Southern California)$|\s*[-–]\s*USC$|\s+USC$/i, '').trim();
    const acr = (String(c.desc || '').match(/\(([A-Z][A-Za-z&@.]{1,11})\)/) || [])[1];
    const names = [full, base, acr].filter(Boolean).sort((a, b) => b.length - a.length).map(x => escRe(x).replace(/(?:\\-|\s)+/g, '[\\s-]+')).join('|');
    s = s.replace(/^(?:hi|hello|hey|welcome)\b[^.!?]{0,80}[.!?]\s*/i, '').replace(/^(?:mission|purpose|vision|about(?: us)?|who we are|our mission|mission statement)\s*[:\-–—]\s*/i, '').replace(/^[-•*·–—\s]+/, '');
    s = s.replace(new RegExp('^(?:the\\s+)?(?:' + names + ')(?:,?\\s+Inc\\.?)?(?:\\s+(?:at|@)\\s+(?:USC|the University of Southern California))?(?:\\s*\\([^)]*\\))?\\s*,?\\s*', 'i'), '');
    s = s.replace(/^(?:our\s+)?(?:mission|purpose|vision)\s*[:\-–—]?\s+(?=to\s)/i, '').replace(/^(?:or|aka|a\.k\.a\.|also known as)\s+[^,]{1,24},\s+/i, '').replace(/^([^,]{2,50}),\s+(?:or|aka|a\.k\.a\.|also known as)\s+[^,]{1,24},\s+/i, '$1 ');
    s = s.replace(/^['’]s\s+(?:\([^)]{1,14}\)\s+)?/, '').replace(/^(?:(?:the|our|its)\s+)?(?:missions?|goals?|purposes?)\s+(?:includes?|involves?)\s+/i, '');
    const as = s.match(/^As\s+(?:a|an|the)\s+([^,]{8,70}),\s+/i);
    if (as) return { s: as[1], np: true };
    let inf = false;
    for (let k = 0; k < 2; k++) s = s.replace(SUBJ, m => { if (/\bto\s+$/i.test(m)) inf = true; return ''; });
    s = s.replace(/^it is\s+(?:our|the)\s+mission\s+(?:of|at)\s+[^,]{2,60}?\s+to\s+/i, () => { inf = true; return ''; });
    let passive = false;
    const pred = s.match(/^((?:the\s+)?[A-Z0-9"'@][^,;:]{0,70}?)\s+(?:is|are|was|has been)\s+(?=(?:a|an|the|one|dedicated|committed|devoted|focused|USC'?s?|here|proud|open|composed|made|comprised|run|led|founded|known|home)\b)/);
    if (pred && !/\.\s/.test(pred[1])) { s = s.slice(pred[0].length); if (/^(?:run|led|founded|known|composed|made|comprised|dedicated|committed|devoted|focused)\b/i.test(s)) passive = true; }
    const v = s.match(/^((?:the\s+)?[A-Z0-9"'@][^,;:]{0,70}?)\s+(?:aims|aim|strives|strive|seeks|seek|works|work|exists|exist|hopes|hope|wants|want|intends|intend|serves|serve)\s+to\s+/);
    if (v && !/\.\s/.test(v[1])) { s = s.slice(v[0].length); inf = true; }
    const sv = s.match(SV);
    if (sv && !/\.\s/.test(sv[1]) && !/^(?:we|they|it|this|our)$/i.test(sv[1])) { s = s.slice(sv[0].length); if (/^(?:is|was)\s+\w+(?:ed|en)\b/.test(s)) passive = true; s = s.replace(/^(?:is|was)\s+/, ''); }
    s = s.replace(/^(?:we|they)\s+(?:are|were)\s+(?=(?:a|an|the|one)\b)/i, '');
    if (/^(?:we|they|it)\s+(?:are|were|is)\s+\w+(?:ed|en|un)\b/i.test(s) || /^(?:is|are)\s+\w+(?:ed|en|un)\b/i.test(s)) passive = true;
    const we = /^(?:we|they)\s+(?!are|were|have|had|can|will|would|also)\w/i.test(s);
    if (/^(?:(?:we|they)\s+)?(?:aims?|strives?|seeks?|works?|exists?|hopes?|wants?|intends?|serves?)\s+to\s+|^to\s+/i.test(s)) inf = true;
    s = s.replace(/^(?:we|they)\s+(?:are\s+|were\s+)?/i, '').replace(/^(?:aims?|strives?|seeks?|works?|exists?|hopes?|wants?|intends?|serves?)\s+to\s+/i, '').replace(/^(?:is|are)\s+/i, '').replace(/^to\s+/i, '');
    s = s.replace(/^['’]s\s+(?:\w+\s+){0,2}?(?:missions?|purposes?|goals?)\s+(?:is|are)\s+(?:to\s+)?/i, '').replace(/^(?:have|be|become)\s+(?=(?:a|an)\s+(?:place|space|home|hub)\b)/i, '');
    return { s: s.trim(), passive, we, inf };
  }
  const cleanBody = s => s.replace(/\b501\s*\(?c\)?\s*\(?3\)?/gi, 'nonprofit').replace(/\s*\((?:[A-Z][A-Za-z&@.]{1,11}|[^)]{0,3})\)/g, '').replace(/\s*\[[^\]]*\]/g, '')
    .replace(/\s+(?:at|of|from)\s+(?:the\s+)?University of Southern California\b/gi, '').replace(/\s+at\s+USC\b(?!['’])/g, '')
    // "of our members" → "of its members" (only after a preposition or verb; "…, and our camp offers" stays and is rejected)
    .replace(/\s+here(?=\s+to\b)/, '').replace(/\b(of|for|to|with|among|amongst|within|in|empowering|supporting|serving|helping|engaging|connecting|uniting|empower|support|serve|help|engage|connect|unite)\s+our\b/gi, '$1 its').replace(/\s{2,}/g, ' ').trim();
  // "a, b, and c …" (single words) → one item: the last when more words follow (it carries the shared complement), else the first
  const compressLists = s => s.replace(/\b([a-z][\w'’-]*)((?:, [a-z][\w'’-]*){0,5}),? (?:and|or|&) ([a-z][\w'’-]*)\b/g, (m, a, mid, z, off, str) => {
    const items = [a, ...mid.split(', ').filter(Boolean), z];
    if (items.some(w => PEOPLE.has(w.toLowerCase()))) return m;
    if (new Set(items.map(w => isVerb(w))).size > 1) return m; // "…its community, and provides…": two clauses, not one list
    return /^\s+[\w(]/.test(str.slice(off + m.length)) ? z : a;
  });
  function cutPoints(s) {
    const out = []; let m; CUT_RE.lastIndex = 0;
    while ((m = CUT_RE.exec(s))) {
      const i = m.index, tok = m[0].trim().toLowerCase(), after = s.slice(i + m[0].length);
      if (tok === ',') CUT_RE.lastIndex = i + 1; // so ", and provides…" can still be cut before "and"
      if (tok === ',') {
        const nxt = after.split(/[,;]/)[0].trim();
        if (/^\d/.test(nxt)) continue;
        if (nxt.split(/\s+/).length <= 3 || /^(?:and|or)\b/i.test(nxt)) { // inside a list: only cut after its first item, and only if nothing is shared after it
          const before = s.slice(Math.max(0, i - 28), i), first = s.slice(0, i).match(/(\S+)\s+(\S+)$/) || [];
          const tail = after.match(/^(?:[^,;]{1,30},\s+){0,5}(?:and|or|&)\s+[\w'’-]+\s*([\w'’-]*)\s*([\w'’-]*)/);
          const verbList = /^to$/i.test(first[1] || '') || /ing$/i.test(first[2] || '') || isVerb(first[2] || '');
          if (/,/.test(before) || !tail || verbList || PREPS.test(tail[1]) || PREPS.test(tail[2]) || (/^[a-z][\w'’-]*$/.test(tail[1]) && !/^(?:through|by|to|for|with|who|that|which|while|and|or|so)$/.test(tail[1]))) continue; // "a, b, and c students": the head noun is shared
        }
      }
      if (tok === 'and' || tok === 'or') { const nw = (after.match(/^[\w'’-]+/) || [''])[0], pw = (s.slice(0, i).match(/[\w'’-]+$/) || [''])[0]; if (!(isVerb(nw) || (/^(?:other|others|more|beyond)$/i.test(nw) && /^[a-z]/.test(pw)))) continue; }
      if (PART_RE.test(tok) && s.slice(0, i).trim().split(/\s+/).length < 2) continue;
      out.push(s.slice(0, i).trim());
    }
    return out;
  }
  const NOUNS_S = /^(?:arts|sports|games|news|events|members|students|services|programs|projects|issues|sciences|studies|resources|skills|values|goals|rights|athletics|economics|politics|ethics|physics|mathematics|analytics|robotics|graphics|logistics|genetics|dynamics|systems|business|access|wellness|fitness|awareness|success|progress|process|class|glass|grass|press|chess|dress|stress|congress)$/;
  function okEnd(p) {
    const w = p.split(/\s+/), last = (w[w.length - 1] || '').toLowerCase().replace(/[^a-z0-9'’-]/g, '');
    if (w.length < 2 || WEAK.has(last) || /['’]s$/.test(last)) return false;
    if ((isVerb(last) || /(?:izes|ises|ates|ifies)$/.test(last)) && !NOUNS_S.test(last)) return false;
    if (/^(?:at|in|on|for|with|since|during|after|before|while|through|by|from|also|as|or|and|but|so|then|moreover|furthermore|additionally|it|this|these|they|he|she|welcomes? to)\s/i.test(p)) return false;
    if (/\b(?:is|are|was|were|be|been|being)\s+\w+ed$/i.test(p)) return false;
    if (/^(?:believes?|thinks?|feels?|knows?|recognizes?)\b/i.test(p)) return false;
    if (/^(?:\w+ly\s+)?(?:known|referred|called|nicknamed)\b/i.test(p)) return false; // a nickname says nothing about the club
    if (/,\s*[\w'’-]+$/.test(p)) return false; // "learn about, enjoy": a dangling list item
    if (/\bthe\s+[A-Z][a-z]+(?:ian|ese|ish|an|ic)$/.test(p) || /^(?:be|is|are)\s/i.test(p)) return false; // "Strengthens the Brazilian", "Be the premier…"
    if (/\b(?:abbreviated|named|titled|dubbed|focusing|centering|committing|devoting)$/i.test(p)) return false;
    // "Exposes USC students", "Teaches medical students": the verb's real object ("to …") was cut off
    if (/\b(?:exposes|introduces|connects|provides|gives|offers|helps|allows|enables|encourages|empowers|teaches|inspires|invites|prepares|equips|trains|supports|guides|brings)(?:\s+[\w'’-]+){0,3}\s+(?:students|members|people|others|youth|undergraduates|participants|scholars)$/i.test(p)) return false;
    if (/\b(?:we|our|us|i|my|hereafter|will|shall|would|could|should)\b/i.test(p)) return false;
    return (p.match(/\(/g) || []).length === (p.match(/\)/g) || []).length;
  }
  const specific = p => p.toLowerCase().split(/[^a-z0-9'’-]+/).filter(w => w.length > 2 && !WEAK.has(w) && !GENW.has(w)).length;
  function pickCut(s, max, nameW) {
    const named = p => { if (nameW.full && p.toLowerCase().includes(nameW.full)) return true; if (nameW.length < 2) return false; const pw = new Set(p.toLowerCase().split(/[^a-z0-9]+/)); return nameW.filter(w => pw.has(w)).length >= Math.max(2, Math.ceil(nameW.length * 0.7)); };
    const cands = [s, ...cutPoints(s)].map(x => x.replace(/[\s,;:–—-]+$/, '')).filter(p => p.length >= 14 && p.length <= max && okEnd(p) && !GENERIC.test(p) && specific(p) >= 1 && !named(p));
    return cands.sort((a, b) => Math.min(3, specific(b)) - Math.min(3, specific(a)) || b.length - a.length)[0] || null;
  }
  function phraseOf(c) {
    const d = String(c.desc || '').replace(/[“”"]/g, '').replace(/[‘’]/g, '\'').replace(/\s+/g, ' ').trim();
    if (!d) return null;
    const sents = sentences(d), nameW = String(c.name || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2 && !/^(usc|the|and|for|club|association|society|student|students|organization|of)$/.test(w));
    nameW.full = String(c.name || '').toLowerCase().replace(/\s*\([^)]*\)\s*$/, '').trim();
    let backup = null;
    for (let si = 0; si < Math.min(3, sents.length); si++) {
      if (si && !ABOUT.test(sents[si])) continue;
      const st = stripSubject(sents[si].replace(/[.!?…]+$/, '').replace(/\s*\.\.\.$/, ''), c);
      let s = st.s; if (!s || s.length < 10) continue;
      s = s.replace(/^([a-z]+)((?:, [a-z]+){0,4}),? (?:and|&) ([a-z]+)\b/i, (m, a, mid, z) => isVerb(a) && isVerb(z) ? z : m); // "support and uplift X" → "uplift X"
      const fw = s.split(/\s+/)[0];
      if (!st.passive && (VERBS.has(fw.toLowerCase()) || (st.we && /^[a-z]+$/.test(fw) && !/(?:ed|s)$/.test(fw) && !NONVERB.has(fw)) || (st.inf && /^[a-z]+$/.test(fw) && !NONVERB.has(fw)))) s = third(fw) + s.slice(fw.length);
      s = cleanBody(s).replace(/^(?:be|is)\s+(?:a|an)\s+/i, '');
      if ((/^(?:a|an|the)\s/i.test(s) || st.np) && !/^(?:a|an)\s+(?:place|space|home|hub)\b/i.test(s)) s = s.replace(/^(?:a|an|the)\s+/i, '');
      const alts = [s], gen = s.match(/^((?:[\w'’-]+\s+){0,3}(?:organization|club|group|community|association|society|team))\s+(?:dedicated|devoted|committed|focused)\s+(?:to|on)\s+(.{8,})$/i);
      if (gen && GENERIC.test(gen[1])) alts.push(gen[2]); // "Student-led organization devoted to practicing…" → "Practicing…"
      const best = lim => { for (const a of alts) { const o = pickCut(a, lim, nameW) || pickCut(compressLists(a), lim, nameW); if (o) return o; } return null; };
      const b1 = best(T_MAX), b2 = best(T_HARD);
      let out = b1 && (!b2 || (specific(b1) >= 2 && specific(b2) - specific(b1) < 2) || specific(b2) <= specific(b1)) ? b1 : b2;
      if (out && /^(?:run|led|founded|established|created|started|formed|organized|organised)\b/i.test(out) && si + 1 < Math.min(3, sents.length)) { backup = backup || out; out = null; }
      if (out) return out;
    }
    return backup;
  }
  // "Category · Type" when the description gives no clean phrase (or there is none)
  const TYPE_RE = /\b(a cappella|association|society|club|council|fraternity|sorority|team|ministr(?:y|ies)|fellowship|magazine|journal|review|lab|laboratory|program|initiative|project|collective|coalition|alliance|network|committee|union|assembly|board|chapter|company|ensemble|band|orchestra|choir|office|department|center|institute|forum|league|caucus|community|group)\b/gi;
  const TYPE_LABEL = { laboratory: 'Lab', ministries: 'Ministry', 'a cappella': 'A cappella group' };
  function labelOf(c) {
    const g = [...groupsOf(c)][0], cat = g === 'dept' ? 'USC' : g ? groupLabel(g) : '';
    const m = String(c.name || '').replace(/\s*\([^)]*\)\s*$/, '').match(TYPE_RE);
    let type = m ? m[m.length - 1].toLowerCase() : '';
    type = TYPE_LABEL[type] || (type ? type[0].toUpperCase() + type.slice(1) : '');
    const cs = (c.cats || []).join(' ');
    if (!type) type = /Interfraternity/.test(cs) ? 'Fraternity' : /Panhellenic/.test(cs) ? 'Sorority' : /Recreational Club Council/.test(c.type || '') ? 'Club sport' : /Religious/.test(c.type || '') ? 'Faith group' : /School or Department/.test(c.type || '') ? 'Department' : 'Student group';
    const office = g === 'dept' || /Student Life|School or Department|Residential Education/.test(c.type || '');
    if (office && /fraternity|sorority/i.test(c.name) && /fraternity/i.test(c.name) === /sorority/i.test(c.name)) type = 'Office'; // "Fraternity & Sorority Life"
    if (/Residential Education/.test(c.type || '') && !/college|community|hall|house/i.test(type)) type = 'Residential community';
    else if (office && !/office|department|center|institute|program|college|community/i.test(type)) type = 'Office';
    if (!cat || type.toLowerCase().startsWith(cat.toLowerCase())) return type + (c.registered ? '' : ' · new listing');
    return `${cat} · ${type}`;
  }
  TH.clubTagline = function (c) {
    if (!c) return '';
    let out = TAG.get(c.id); if (out != null) return out;
    try { out = phraseOf(c); } catch (e) { out = null; }
    if (out) {
      if ((out.match(/[A-Z]/g) || []).length > out.replace(/[^A-Za-z]/g, '').length * 0.6) out = out.toLowerCase().replace(/\busc\b/g, 'USC');
      out = out.replace(/^[a-z]/, ch => ch.toUpperCase());
    } else out = labelOf(c);
    TAG.set(c.id, out);
    return out;
  };

  // ---------------------------------------------------------------------------------------------
  // images
  // ---------------------------------------------------------------------------------------------
  TH.clubPhotos = function (c) {
    const raw = (TH.CLUB_PHOTOS || {})[c && c.id] || [];
    return raw.map(x => typeof x === 'string' ? { src: x, kind: 'photo', from: '' } : x).filter(x => x && x.src);
  };
  // what the bundled image set covers (for copy and reports): real photos, real logos, generated graphics
  TH.clubImageStats = function () {
    const all = TH.CLUBS || [], P = TH.CLUB_PHOTOS || {};
    let photo = 0, logoOnly = 0, none = 0;
    all.forEach(c => { const a = P[c.id] || []; if (a.some(x => (x.kind || 'photo') === 'photo')) photo++; else if (a.length) logoOnly++; else none++; });
    return { clubs: all.length, withPhoto: photo, logoOnly, generated: none };
  };
  const initials = name => String(name || '?').replace(/^(The|USC|Trojan)\s+/i, '').split(/[\s\-–&/]+/).filter(w => /^[A-Za-z0-9]/.test(w)).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';
  TH.clubInitials = initials;
  const PATTERNS = 4;
  // a cover: real photo (if asked and present) → real logo on a tinted card → generated graphic
  TH.clubCover = function (c, o = {}) {
    const ph = TH.clubPhotos(c), photo = ph.find(x => x.kind === 'photo'), logo = ph.find(x => x.kind === 'logo'), h = hue(c.id), pat = hue(c.name) % PATTERNS;
    const cls = 'ccv ' + (o.size || 'md');
    if (photo && o.photo !== false) return `<span class="${cls} photo"><img src="${photo.src}" alt="" loading="lazy" decoding="async"></span>`;
    if (logo) return `<span class="${cls} logo" style="--h:${h}"><img src="${logo.src}" alt="" loading="lazy" decoding="async"></span>`;
    return `<span class="${cls} gen p${pat}" style="--h:${h}" aria-hidden="true"><b>${esc(initials(c.name))}</b></span>`;
  };
  // the small square avatar: real logo → real photo → initials
  TH.clubThumb = function (c, size = 'md') {
    const ph = TH.clubPhotos(c), img = ph.find(x => x.kind === 'logo') || ph.find(x => x.kind === 'photo');
    return `<span class="club-logo cthumb ${size}" style="--lh:${hue(c.id)}" aria-hidden="true"><b>${esc(initials(c.name))}</b>${img ? `<img class="ok" src="${img.src}" alt="" loading="lazy" decoding="async">` : ''}</span>`;
  };
})(window.TH = window.TH || {});
