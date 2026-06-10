export const LEAGUE_STRENGTHS = {
  'England 1.':100.00,'Spain 1.':87.84,'Germany 1.':87.45,'Italy 1.':85.88,'France 1.':83.14,
  'England 2.':75.10,'Belgium 1.':74.51,'Brazil 1.':74.31,'Portugal 1.':72.94,'Argentina 1.':71.37,
  'USA 1.':70.00,'Denmark 1.':70.78,'Poland 1.':69.61,'Turkey 1.':69.02,'Netherlands 1.':69.02,
  'Croatia 1.':68.43,'Germany 2.':68.04,'Japan 1.':67.84,'Switzerland 1.':67.45,'Spain 2.':67.06,
  'Norway 1.':66.67,'Mexico 1.':66.47,'Sweden 1.':66.27,'Colombia 1.':65.88,'Czech 1.':65.29,
  'Ecuador 1.':65.29,'France 2.':64.00,'Greece 1.':64.12,'Saudi 1.':64.12,'Italy 2.':63.53,
  'Hungary 1.':63.53,'Austria 1.':63.33,'Morocco 1.':63.14,'Korea 1.':62.75,'Paraguay 1.':62.55,
  'Russia 1.':62.41,'England 3.':61.96,'Romania 1.':61.76,'Scotland 1.':61.76,'Algeria 1.':61.57,
  'Cyprus 1.':60.00,'Uruguay 1.':60.39,'Chile 1.':59.80,'Egypt 1.':59.22,'Israel 1.':58.43,
  'Brazil 2.':58.04,'Slovenia 1.':57.45,'Bolivia 1.':57.25,'Slovakia 1.':56.47,'Azerbaijan 1.':56.47,
  'South Africa 1.':56.27,'UAE 1.':55.49,'Costa Rica 1.':54.90,'Peru 1.':54.90,'Germany 3.':54.51,
  'Ukraine 1.':54.31,'Spain 3.':54.31,'Portugal 2.':53.14,'Bulgaria 1.':53.14,'Australia 1.':52.75,
  'Serbia 1.':52.16,'Albania 1.':51.96,'Bosnia 1.':51.76,'Kosovo 1.':51.37,'Japan 2.':50.98,
  'England 4.':50.78,'Ireland 1.':50.59,'Kazakhstan 1.':50.39,'Nigeria 1.':50.00,'France 3.':49.61,
  'Tunisia 1.':49.22,'Venezuela 1.':48.63,'Belgium 2.':48.43,'Finland 1.':48.43,'Armenia 1.':47.84,
  'Georgia 1.':47.65,'Switzerland 2.':46.47,'Qatar 1.':46.27,'Uzbekistan 1.':46.27,'Poland 2.':46.27,
  'Iceland 1.':46.08,'Norway 2.':45.88,'Sweden 2.':45.69,'Italy 3.':45.00,'North Macedonia 1.':44.71,
  'China 1.':44.70,'Turkey 2.':44.51,'Panama 1.':44.10,'Korea 2.':43.53,'Czech 2.':43.33,
  'Brazil 3.':43.14,'Lithuania 1.':42.35,'Netherlands 2.':42.16,'Malta 1.':41.96,'Estonia 1.':40.00,
  'Denmark 2.':40.39,'Moldova 1.':40.39,'USA 2.':40.00,'Latvia 1.':40.00,'Montenegro 1.':39.80,
  'Scotland 2.':48.00,'Canada 1.':38.24,'Austria 2.':38.24,'Israel 2.':38.04,'England 7.':37.25,
  'Faroe Islands 1.':35.02,'Germany 4.':35.29,'Portugal 3.':35.29,'England 5.':33.33,
  'England 9.':31.37,'Northern Ireland 1.':30.98,'Serbia 2.':30.39,'Denmark 3.':29.41,
  'Sweden 3.':29.41,'Slovenia 2.':28.82,'Slovakia 2.':28.24,'Italy 4.':28.24,'Greece 2.':27.06,
  'Wales 1.':26.67,'USA 3.':22.55,'Scotland 3.':20.00,'England 6.':16.08,'England 8.':15.69,
  'Ireland 2.':10.00,'England 10.':3.92,'Estonia 2.':3.00,
  'Andorra 1.':33.33,'Argentina 2.':64.12,'Colombia 2.':48.43,'Cyprus 2.':46.27,'Ecuador 2.':49.61,
  'Hungary 2.':40.00,'Kazakhstan 2.':16.08,'Kyrgyzstan 1.':16.08,'Malta 2.':16.08,
  'Montenegro 2.':47.84,'Netherlands 3.':27.06,'Norway 3.':40.00,'Romania 2.':49.61,
  'Saudi 2.':35.02,'Ukraine 2.':28.24,'Zambia 1.':46.47,
  'Sweden 4.':20.00,'Switzerland 3.':20.00,'Ukraine 3.':15.00,'Brazil 4.':30.00,
  'Czech 3.':20.00,'Denmark 4.':20.00,'Germany 5.':25.00,'Germany 6.':20.00,
  'Italy 5.':25.00,'Portugal 4.':25.00,'Serbia 3.':15.00,
};

export const HIDDEN_LEAGUES = new Set([
  'Bolivia 1.','UAE 1.','Costa Rica 1.','Nigeria 1.','Qatar 1.','Uzbekistan 1.',
  'Poland 2.','Panama 1.','Lithuania 1.','USA 2.','Faroe Islands 1.','Germany 4.',
  'Portugal 3.','Slovenia 2.','Slovakia 2.','USA 3.','Scotland 3.','England 6.',
  'Ireland 2.','Estonia 2.','Andorra 1.','Argentina 2.','Colombia 2.','Cyprus 2.',
  'Ecuador 2.','Hungary 2.','Kazakhstan 2.','Kyrgyzstan 1.','Malta 2.','Montenegro 2.',
  'Netherlands 3.','Norway 3.','Romania 2.','Saudi 2.','Ukraine 2.','Zambia 1.','Italy 4.',
]);

export const YOUTH_LEAGUES = new Set([
  'Sweden 4.','Switzerland 3.','Ukraine 3.','Brazil 4.','Czech 3.','Denmark 4.',
  'Germany 5.','Germany 6.','Italy 5.','Portugal 4.','Serbia 3.',
  'England 7.','England 8.','England 9.','England 10.',
]);

export const INTERNATIONAL_LEAGUES = new Set([
  'UEFA WC Qualifiers.','UEFA U21 Euros.','UEFA U19 Euros.','Asia WC Qualifiers.',
  'AFCON.','AFCON U20.','AFCON U17.','AFCON Qualifiers.','S.America Qualifiers.',
  'U20 World Cup.','U17 World Cup.',
]);

export const CONTINENTAL_LEAGUES = new Set([
  'Conference League.','Conference League Qualifiers.','Europa League.',
  'Europa League Qualifiers.','Champions League.','Champions League Qualifiers.',
  'Asia Champions League.','Africa Champions League.','Copa Libertadores.',
  'U20 Copa.','Club World Cup.','UEFA Youth League.',
]);

export const GBE_LEAGUE_BANDS = {
  'England 1.':1,'England 2.':1,'England 3.':1,'England 4.':1,'England 5.':1,
  'England 6.':1,'England 7.':1,'England 8.':1,'England 9.':1,'England 10.':1,
  'Scotland 1.':1,'Scotland 2.':1,'Scotland 3.':1,'Wales 1.':1,'Ireland 1.':1,'Northern Ireland 1.':1,
  'Spain 1.':1,'Germany 1.':1,'Italy 1.':1,'France 1.':1,
  'Portugal 1.':2,'Netherlands 1.':2,'Belgium 1.':2,'Turkey 1.':3,'Brazil 1.':2,
  'USA 1.':3,'Argentina 1.':3,'Mexico 1.':3,
  'Czech 1.':4,'Croatia 1.':4,'Switzerland 1.':4,'Spain 2.':4,'Germany 2.':4,
  'Ukraine 1.':4,'Greece 1.':4,'Colombia 1.':4,'Austria 1.':4,'Denmark 1.':4,'France 2.':4,'Russia 1.':4,'Japan 1.':4,
  'Serbia 1.':5,'Poland 1.':5,'Chile 1.':5,'Uruguay 1.':5,
  'Sweden 1.':5,'Norway 1.':5,'Italy 2.':5,'Hungary 1.':5,'Korea 1.':5,'Australia 1.':5,'Slovenia 1.':6,
};

export const COUNTRY_TO_REGION = {
  'England':'Europe','Spain':'Europe','Germany':'Europe','Italy':'Europe','France':'Europe',
  'Belgium':'Europe','Portugal':'Europe','Netherlands':'Europe','Croatia':'Europe',
  'Switzerland':'Europe','Norway':'Europe','Sweden':'Europe','Cyprus':'Europe','Czech':'Europe',
  'Greece':'Europe','Austria':'Europe','Hungary':'Europe','Romania':'Europe','Scotland':'Europe',
  'Slovenia':'Europe','Slovakia':'Europe','Ukraine':'Europe','Bulgaria':'Europe','Serbia':'Europe',
  'Albania':'Europe','Bosnia':'Europe','Kosovo':'Europe','Ireland':'Europe','Finland':'Europe',
  'Armenia':'Europe','Georgia':'Europe','Poland':'Europe','Iceland':'Europe',
  'North Macedonia':'Europe','Latvia':'Europe','Montenegro':'Europe','Denmark':'Europe',
  'Estonia':'Europe','Northern Ireland':'Europe','Wales':'Europe','Russia':'Europe',
  'Kazakhstan':'Europe','Lithuania':'Europe','Malta':'Europe','Moldova':'Europe',
  'Israel':'Europe','Andorra':'Europe','Faroe Islands':'Europe',
  'Brazil':'South America','Argentina':'South America','Colombia':'South America',
  'Ecuador':'South America','Paraguay':'South America','Uruguay':'South America',
  'Chile':'South America','Bolivia':'South America','Peru':'South America',
  'Venezuela':'South America','Panama':'South America',
  'USA':'North America','Mexico':'North America','Costa Rica':'North America','Canada':'North America',
  'Morocco':'Africa','Algeria':'Africa','Egypt':'Africa','Nigeria':'Africa',
  'Tunisia':'Africa','South Africa':'Africa','Zambia':'Africa',
  'Japan':'Asia','Korea':'Asia','Saudi':'Asia','UAE':'Asia','Qatar':'Asia',
  'Uzbekistan':'Asia','China':'Asia','Turkey':'Asia','Azerbaijan':'Asia','Kyrgyzstan':'Asia',
  'Australia':'Asia',
};

export const PRESET_LEAGUES = {
  'Top 5 Europe': new Set(['England 1.','France 1.','Germany 1.','Italy 1.','Spain 1.']),
  'Top 20 Europe': new Set([
    'England 1.','Italy 1.','Spain 1.','Germany 1.','France 1.',
    'England 2.','Portugal 1.','Belgium 1.','Turkey 1.','Germany 2.',
    'Spain 2.','France 2.','Netherlands 1.','Austria 1.','Switzerland 1.',
    'Denmark 1.','Croatia 1.','Italy 2.','Czech 1.','Norway 1.','Sweden 1.',
  ]),
  'EFL (England 2–4)': new Set(['England 2.','England 3.','England 4.']),
  'UK': new Set([
    'England 1.','England 2.','England 3.','England 4.','England 5.','England 6.',
    'Scotland 1.','Scotland 2.','Wales 1.','Ireland 1.','Northern Ireland 1.','Ireland 2.',
  ]),
};

// Derive ALL_LEAGUES from LEAGUE_STRENGTHS (excludes international/continental)
export const ALL_LEAGUES = Object.keys(LEAGUE_STRENGTHS);

// Standard leagues shown by default (exclude hidden + youth)
export const DEFAULT_LEAGUES = new Set(
  ALL_LEAGUES.filter(l => !HIDDEN_LEAGUES.has(l) && !YOUTH_LEAGUES.has(l))
);

export const ROLE_KEY_LABELS={GK:'Goalkeeper',CB:'Centre Back',FB:'Fullback',CM:'Central Mid',ATT:'Attacker',CF:'Striker'};
export const ROLES_BY_KEY={
  GK:['Shot Stopper GK','Ball Playing GK','Sweeper GK','Complete GK'],
  CB:['Ball Playing CB','Wide CB','Box Defender'],
  FB:['Build Up FB','Attacking FB','Defensive FB','Wide Creator FB','Wide Carrier FB'],
  CM:['Deep Playmaker CM','Advanced Playmaker CM','Defensive Midfielder DM','Goal Threat CM','Ball Carrying CM','Box-to-Box CM'],
  ATT:['Playmaker ATT','Goal Threat ATT','Ball Carrier ATT'],
  CF:['Target Man CF','Goal Threat CF','Link Up CF','False-9 Runner CF','False-9 Passer CF'],
};
export const ALL_SEASONS=['2025-26','2024-25','2023-24','2022-23','2021-22','2020-21','2019-20','2018-19'];

export function scoreBandColor(s){
  if(s>=81) return '#22c55e';
  if(s>=70) return '#3b82f6';
  if(s>=60) return '#f59e0b';
  return '#6b7280';
}

export function scoreLabel(score){
  if(score>=81) return 'Elite Premier League';
  if(score>=76) return 'Excellent Premier League';
  if(score>=70) return 'Premier League Level';
  if(score>=65) return 'Very Good Championship';
  if(score>=57) return 'Championship Level';
  if(score>=53) return 'League One Level';
  if(score>=50) return 'League Two Level';
  if(score>=46) return 'National League Level';
  if(score>=43) return 'Youth / Non-League';
  return 'Development';
}
export function scoreLabelShort(score){
  if(score>=81) return 'Elite PL';
  if(score>=76) return 'Excellent PL';
  if(score>=70) return 'PL Level';
  if(score>=65) return 'Top Champ';
  if(score>=57) return 'Championship';
  if(score>=53) return 'League One';
  if(score>=50) return 'League Two';
  if(score>=46) return 'Non-League';
  if(score>=43) return 'Youth';
  return 'Dev';
}

export function promotionBadge(score,league){
  const ls=(LEAGUE_STRENGTHS[league])||50;
  if(ls>=95) return null;
  if(ls>=70){ return score>=75?'Elite':null; }
  if(ls>=55){ return score>=72?'Elite':null; }
  if(ls>=43){ return score>=68?'Elite':null; }
  if(score>=65) return 'Elite';
  return null;
}

export function scoreToStars(score){
  if(score>=81) return 5.0;
  if(score>=76) return 4.5;
  if(score>=70) return 4.0;
  if(score>=65) return 3.5;
  if(score>=57) return 3.0;
  if(score>=53) return 2.5;
  if(score>=50) return 2.0;
  if(score>=46) return 1.5;
  if(score>=43) return 1.0;
  return 0.5;
}
export function starLabel(stars){
  if(stars>=5.0) return 'Elite Premier League';
  if(stars>=4.5) return 'Excellent Premier League';
  if(stars>=4.0) return 'Premier League Level';
  if(stars>=3.5) return 'Very Good Championship';
  if(stars>=3.0) return 'Championship Level';
  if(stars>=2.5) return 'League One Level';
  if(stars>=2.0) return 'League Two Level';
  if(stars>=1.5) return 'National League Level';
  if(stars>=1.0) return 'Youth / Non-League';
  return 'Development';
}

export function formatMV(v){
  if(!v||v<=0) return '—';
  if(v>=1000000) return `£${(v/1000000).toFixed(1)}m`;
  if(v>=1000) return `£${Math.round(v/1000)}k`;
  return `£${v}`;
}
export function formatFoot(f){
  if(!f||f==='unknown'||f==='nan') return '—';
  return f.charAt(0).toUpperCase()+f.slice(1);
}
export function divColor(v){
  const n=Math.max(0,Math.min(100,v||0));
  if(n>=80) return '#22c55e';
  if(n>=60) return '#84cc16';
  if(n>=40) return '#eab308';
  if(n>=20) return '#f97316';
  return '#ef4444';
}

// Helper: get region from league name
export function leagueToRegion(league) {
  const country = league.replace(/ \d+\.$/, '').trim();
  return COUNTRY_TO_REGION[country] || 'Other';
}

// Helper: get band from league name
export function leagueToBand(league) {
  return GBE_LEAGUE_BANDS[league] || 6;
}

export const POSITION_ATTRIBUTES = {
  GK: [
    { key:'shotStopper', label:'Shot Stopper', tests:[{m:'Prevented goals per 90',p:75}] },
    { key:'sweeper',     label:'Sweeper',      tests:[{m:'Exits per 90',p:75}] },
    { key:'ballPlayer',  label:'Ball Player',  tests:[{m:'Passes per 90',p:50},{m:'Accurate passes, %',p:75}] },
    { key:'secure',      label:'Secure',       tests:[{m:'Accurate passes, %',p:75}] },
    { key:'longPasser',  label:'Long Passer',  tests:[{m:'Accurate long passes, %',p:75}] },
  ],
  CB: [
    { key:'aerial',       label:'Aerial',         tests:[{m:'Aerial duels won, %',p:70}] },
    { key:'aggressive',   label:'Aggressive',      tests:[{m:'Defensive duels per 90',p:70}] },
    { key:'tackler',      label:'Tackler',         tests:[{m:'Defensive duels won, %',p:70}] },
    { key:'securePasser', label:'Secure Passer',   tests:[{m:'Accurate passes, %',p:70}] },
    { key:'progressive',  label:'Progressive',     tests:[{m:'Progressive passes per 90',p:70}] },
    { key:'verticalPass', label:'Vertical Passer', tests:[{m:'Progressive passes per 90',p:60}] },
    { key:'ballCarrier',  label:'Ball Carrier',    tests:[{m:'Dribbles per 90',p:70},{m:'Progressive runs per 90',p:70}] },
  ],
  FB: [
    { key:'creativeCross',label:'Creative Crosser',tests:[{m:'Crosses per 90',p:70},{m:'xA per 90',p:70}] },
    { key:'aggressive',   label:'Aggressive',      tests:[{m:'Defensive duels per 90',p:70}] },
    { key:'lockdown',     label:'Lockdown',        tests:[{m:'Defensive duels per 90',p:70},{m:'Defensive duels won, %',p:70}] },
    { key:'securePasser', label:'Secure Passer',   tests:[{m:'Accurate passes, %',p:70}] },
    { key:'progressive',  label:'Progressive',     tests:[{m:'Progressive passes per 90',p:70}] },
    { key:'verticalPass', label:'Vertical Passer', tests:[{m:'Progressive passes per 90',p:60}] },
    { key:'ballCarrier',  label:'Ball Carrier',    tests:[{m:'Dribbles per 90',p:70},{m:'Progressive runs per 90',p:70}] },
    { key:'veryAttacking',label:'Very Attacking',  tests:[{m:'Touches in box per 90',p:75}] },
  ],
  CM: [
    { key:'firstPhase',   label:'1st Phase Passer', tests:[{m:'Accurate passes, %',p:70}] },
    { key:'secondPhase',  label:'2nd Phase Passer', tests:[{m:'Passes to final third per 90',p:70}] },
    { key:'advPlaymaker', label:'Advanced Playmaker',tests:[{m:'Passes to penalty area per 90',p:70}] },
    { key:'chanceCreator',label:'Chance Creator',   tests:[{m:'xA per 90',p:70}] },
    { key:'securePasser', label:'Secure Passer',    tests:[{m:'Accurate passes, %',p:75}] },
    { key:'verticalPass', label:'Vertical Passer',  tests:[{m:'Progressive passes per 90',p:60}] },
    { key:'ballCarrier',  label:'Ball Carrier',     tests:[{m:'Dribbles per 90',p:70},{m:'Progressive runs per 90',p:70}] },
    { key:'boxCrasher',   label:'Box Crasher',      tests:[{m:'Touches in box per 90',p:80}] },
    { key:'aerial',       label:'Aerial',           tests:[{m:'Aerial duels won, %',p:70}] },
    { key:'ballWinner',   label:'Ball Winner',      tests:[{m:'Defensive duels per 90',p:55},{m:'Defensive Duel %',p:55}] },
    { key:'readsGame',    label:'Reads Game',       tests:[{m:'PAdj Interceptions',p:70}] },
    { key:'goalThreat',   label:'Goal Threat',      tests:[{m:'Non-penalty goals per 90',p:80},{m:'xG per 90',p:80}] },
  ],
  ATT: [
    { key:'chancesCreated',label:'Creates Chances', tests:[{m:'xA per 90',p:70}] },
    { key:'playmaker',    label:'Playmaker',         tests:[{m:'Passes to penalty area per 90',p:70},{m:'Smart passes per 90',p:70}] },
    { key:'securePasser', label:'Secure Passer',     tests:[{m:'Accurate passes, %',p:70}] },
    { key:'deepPlaymaker',label:'Deep Playmaker',    tests:[{m:'Accurate passes, %',p:70},{m:'Progressive passes per 90',p:70}] },
    { key:'crosser',      label:'Crosser',           tests:[{m:'Crosses per 90',p:70}] },
    { key:'ballCarrier',  label:'Ball Carrier',      tests:[{m:'Dribbles per 90',p:70},{m:'Progressive runs per 90',p:70}] },
    { key:'goalThreat',   label:'Goal Threat',       tests:[{m:'Non-penalty goals per 90',p:70},{m:'xG per 90',p:70}] },
    { key:'aerial',       label:'Aerial',            tests:[{m:'Aerial duels won, %',p:70}] },
  ],
  CF: [
    { key:'chancesCreated',label:'Creates Chances', tests:[{m:'xA per 90',p:70}] },
    { key:'targetMan',    label:'Target Man',        tests:[{m:'Aerial duels per 90',p:35},{m:'Aerial duels won, %',p:70}] },
    { key:'linksPlay',    label:'Links Play',        tests:[{m:'Accurate passes, %',p:70},{m:'Passes to penalty area per 90',p:60}] },
    { key:'securePasser', label:'Secure Passer',     tests:[{m:'Accurate passes, %',p:70}] },
    { key:'ballCarrier',  label:'Ball Carrier',      tests:[{m:'Dribbles per 90',p:70},{m:'Progressive runs per 90',p:70}] },
    { key:'goalThreat',   label:'Goal Threat',       tests:[{m:'xG per 90',p:70}] },
  ],
};

export function playerHasAttribute(attr, gGroups) {
  if(!gGroups) return false;
  const allMetrics = [...(gGroups.A||[]),...(gGroups.D||[]),...(gGroups.P||[])];
  if(!allMetrics.length) return false;
  const G_LABEL = {
    'Aerial duels won, %':'Aerial Duel %','Aerial duels per 90':'Aerial Duels',
    'Defensive duels won, %':'Defensive Duel %','Defensive duels per 90':'Defensive Duels',
    'Accurate passes, %':'Pass %','Accurate forward passes, %':'Forward Pass %',
    'Progressive runs per 90':'Progressive Runs','Progressive passes per 90':'Progressive Passes',
    'PAdj Interceptions':'PAdj Interceptions','Dribbles per 90':'Dribbles',
    'Passes to final third per 90':'Passes to F3rd','xA per 90':'xA',
    'Passes to penalty area per 90':'Passes to Box','Non-penalty goals per 90':'Goals: Non-Penalty',
    'xG per 90':'xG','Key passes per 90':'Key Passes','Touches in box per 90':'Touches in Box',
    'Smart passes per 90':'Smart Passes','Crosses per 90':'Crosses',
    'Prevented goals per 90':'Goals Prevented','Exits per 90':'Exits',
    'Save rate, %':'Save Rate','Passes per 90':'Passes','Accurate long passes, %':'Long Pass %',
    'Defensive Duel %':'Defensive Duel %',
  };
  const find = (mName) => {
    const lbl = G_LABEL[mName]||mName;
    return allMetrics.find(x=>x[0]===lbl||x[0]===mName);
  };
  return attr.tests.every(t=>{
    const found = find(t.m);
    if(!found) return false;
    const pct = found[1];
    return (t.op==='<') ? pct < t.p : pct >= t.p;
  });
}
