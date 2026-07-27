// TeamIndex.js v10 - Adds REPORT button per row -> TeamReport (Team All-in-One 1920x1080 export).
// v9 - Most Improved toggle: sidebar control sorts by adjusted season-on-season
// score delta for Overall/Attack/Defence/Possession/Pressing. Division-change correction:
// delta is multiplied by (prev_ls / curr_ls) so promoted teams (harder context) aren't
// penalised and relegated teams (easier context) aren't artificially inflated. Only available
// in Latest season mode; auto-disables in Weighted/specific-season modes.
// v1 - New tab: searchable/sortable/filterable team database, using teams_final.json
// (built by build_teams.py). Team detail/click-through page deliberately deferred per Matty —
// this is list/scoring/filtering only for now.
import React, { useState, useEffect, useMemo } from 'react';
import TeamCard from './TeamCard';
import CoachPanel from './CoachPanel';
import TeamReport from './TeamReport';
import { useIsMobile } from './utils';
import { LEAGUE_STRENGTHS, ALL_LEAGUES, DEFAULT_LEAGUES, HIDDEN_LEAGUES, YOUTH_LEAGUES,
         PRESET_LEAGUES, COUNTRY_TO_REGION, GBE_LEAGUE_BANDS, leagueToRegion, leagueToBand } from './constants';

// teams_final.json's `league` field has no trailing period ('England 1'), but constants.js's
// LEAGUE_STRENGTHS/ALL_LEAGUES use the player-CSV format with a trailing period ('England 1.').
// Same mismatch build_teams.py's norm_league() already handles on the Python side — mirrored
// here so league checkboxes/presets/bands/regions (all keyed on the '.' format) correctly match
// team rows (which never have the '.').
function normLeague(l) {
  return String(l || '').trim().replace(/\.$/, '').toLowerCase();
}
// Base country from a league name — strips the trailing tier number so 'England 1'/'England 2'/
// etc all collapse to 'england'. Used to group a team's history correctly: a promoted/relegated
// team (same country, different tier) should merge into one entity, but two unrelated clubs that
// happen to share a name in different countries (e.g. Arsenal England vs Arsenal Argentina) must
// NOT merge — an earlier version grouped by team name alone and incorrectly combined them.
function teamCountry(l) {
  return String(l || '').trim().replace(/\s+\d+\.?$/, '').toLowerCase();
}
// Reverse-lookup: normalized league name -> the '.' formatted key constants.js actually uses.
const NORM_TO_DOT = {};
for (const l of ALL_LEAGUES) NORM_TO_DOT[normLeague(l)] = l;
function toDotLeague(teamLeague) {
  return NORM_TO_DOT[normLeague(teamLeague)] || teamLeague;
}

const CREST_BASE = 'https://raw.githubusercontent.com/Matthewduffy23/scouting-photos/main/crests/';
const TEAM_FOTMOB_MAP={"1860 München":"9753","1860 munchen":"9753","2 de Mayo":"49688","2 de mayo":"49688","ABB":"1297346","ADO Den Haag":"10217","ADT":"1104719","AEK Athens":"8563","AEK Larnaca":"7797","AEL":"2134","AF Elbasani":"10038","AFC Telford United":"6315","AFC Totton":"275027","AFC Wimbledon":"158319","AGF":"8071","AIK":"8349","APOEL":"8621","AS Soliman":"852755","AVS":"1889","AZ":"10229","AZ II":"681217","AaB":"8470","Aalesund":"8404","Aarau":"9930","Aarhus Fremad":"8109","Aberdeen":"8485","Academia Puerto Cabello":"657277","Academico Viseu":"1786","Accrington Stanley":"8671","Adana Demirspor":"1926","Adelaide United":"8008","Admira":"10053","Afturelding":"163251","Airdrieonians":"8176","Ajax":"8593","Ajax II":"163363","Akhmat Grozny":"8708","Akritas":"184615","Akron Togliatti":"1068364","Aktobe":"8000","Al Ahli":"2530","Al Akhdoud":"582759","Al Ettifaq":"101915","Al Fateh":"177356","Al Feiha":"582749","Al Hazem":"101911","Al Hilal":"2529","Al Ittihad":"8577","Al Khaleej":"550433","Al Kholood":"1523706","Al Najma":"1523707","Al Nassr":"101918","Al Qadisiyah":"101919","Al Riyadh":"582739","Al Shabab":"101916","Al Taawon":"205686","Alajuelense":"6335","Alanyaspor":"4678","Albacete":"8393","AlbinoLeffe":"9832","Albirex Niigata":"4425","Alcione Milano":"655295","Alcorcón":"161750","Aldershot Town":"8465","Alemannia Aachen":"8396","Alfreton Town":"6258","Algeciras":"7811","Alianza":"193029","Alianza Atlético":"4410","Alianza Lima":"6398","Alianza Universidad":"314221","Almere City":"4116","Almería":"9865","Altrincham":"9915","Aluminij":"1862","Alverca":"9780","Always Ready":"805913","AmaZulu":"102100","Amazonas":"1340094","Amed SK":"96498","Amiens SC":"8587","Amstetten":"8326","América":"6576","América Mineiro":"1757","América de Cali":"10280","Anderlecht":"8635","Anderlecht II":"1378461","Angers SCO":"8121","Ankara Keçiörengücü":"8387","Annecy":"293352","Anorthosis":"6243","Ansan Greeners":"821875","Antalyaspor":"1931","Antequera":"161849","Antwerp":"9988","Anyang":"429440","Anzoátegui FC":"1349498","Apollon":"8003","Ararat":"866109","Araz":"485832","Arbroath":"8280","Arda":"944173","Arenas Club":"189631","Arenteiro":"1314965","Arezzo":"9849","Argeș":"9732","Ariana":"1331261","Aris":"2136","Arka Gdynia":"8322","Arlanda":"841094","Arminia Bielefeld":"9912","Arouca":"158085","Arsenal":"9825","Arsenal U18":"950214","Arsenal U19":"950214","Arsenal U21":"950214","Artis Brno":"106189","Arzignano Valchiampo":"583958","Ascoli":"8522","Ashdod":"6203","Assyriska":"10225","Astana":"166865","Asteras Tripolis":"80654","Aston Villa":"10252","Aston Villa U16":"1070261","Aston Villa U18":"1070261","Aston Villa U19":"1070261","Aston Villa U21":"1070261","Astoria Walldorf":"94938","Atalanta":"8524","Atalanta U23":"1524591","Athletic Bilbao":"8315","Athletic Club":"1221604","Athletico Paranaense":"10273","Athlone Town":"2378","Atlanta United":"773958","Atlanta United II":"915806","Atlas":"6577","Atlético Bucaramanga":"4401","Atlético GO":"165545","Atlético Grau":"920789","Atlético Madrid":"9906","Atlético Madrid B":"161759","Atlético Mineiro":"10272","Atlético Nacional":"6368","Atlético Sanluqueño":"189730","Atlético Tembetary":"1299349","Atlético de San Luis":"6358","Atromitos":"10187","Atyrau":"2349","Aubagne":"293443","Aucas":"6608","Auckland FC":"1642068","Audace Cerignola":"867620","Audax Italiano":"4058","Augsburg":"8406","Aurora":"49720","Austin FC":"1218886","Austin FC II":"1451870","Austria Klagenfurt":"10009","Austria Lustenau":"9982","Austria Salzburg":"206091","Austria Wien":"10011","Austria Wien II":"10248","Auxerre":"8583","Avaí":"104822","Avellino":"6722","Avispa Fukuoka":"8270","Ayacucho":"165147","Ayr United":"9913","AŠK Bravo":"856680","B.93":"8453","BB Erzurumspor":"281467","BFC Daugavpils":"197864","BKMA":"1078402","Bahia":"7877","Bahlinger SC":"2393","Bala Town":"175654","Balingen":"145498","Ballymena United":"4063","Baltika":"49694","Bandırmaspor":"162975","Banfield":"10087","Banga":"169157","Bangor":"77755","Baník Ostrava":"6362","Baník Ostrava II":"1154238","Barakaldo":"7734","Barcelona":"8634","Bari":"9976","Barnet":"8175","Barnsley":"8283","Barockstadt Fulda-Lehnerz":"465626","Barrow":"6350","Barry Town United":"1603","Basel":"9931","Bastia":"7794","Bath City":"6095","Bayer Leverkusen":"8178","Bayern Alzenau":"95039","Bayern München":"9823","Bačka Topola":"676140","Bedford Town":"8717","Beerschot VA":"583877","Beijing Guoan":"4177","Beitar Jerusalem":"8173","Bellinzona":"6493","Ben Guerdane":"316413","Benevento":"6266","Benfica":"9772","Benfica II":"338302","Beroe":"10126","Betis Deportivo":"161780","Beşiktaş":"10188","Binacional":"916336","Birmingham City":"8658","Birmingham City U18":"1796111","Birmingham City U21":"1796111","Blackburn Rovers":"8655","Blackburn Rovers U18":"773685","Blackburn Rovers U21":"773685","Blackpool":"8483","Blau-Weiß Linz":"2433","Blaublitz Akita":"194015","Blooming":"49678","Bnei Sakhnin":"8718","Bnei Yehuda":"2215","Boca Juniors":"10077","Bochum":"9911","Bochum II":"8200","Bodrumspor":"658811","Bodø / Glimt":"8402","Bohemians":"4594","Bohemians 1905":"1670","Bologna":"9857","Bolton Wanderers":"8559","Boluspor":"4675","Bolívar":"5983","Bonner SC":"95047","Borac Banja Luka":"10116","Boreham Wood":"2488","Borussia Dortmund":"9789","Borussia Dortmund II":"8395","Borussia M'gladbach":"9788","Borussia M'gladbach II":"8278","Boston River":"188313","Boston United":"8646","Botafogo":"8517","Botafogo SP":"8355","Botev Plovdiv":"10131","Botev Vratsa":"187880","Botoşani":"188191","Boulogne":"4170","Bourg-en-Bresse":"6246","Bournemouth":"8678","Boyacá Chicó":"6255","Bra":"474518","Brackley Town":"158321","Bradford City":"8484","Brage":"6690","Braintree Town":"5763","Brann":"8468","Brattvåg":"47403","Bray Wanderers":"1629","Bregenz":"80619","Breidablik":"8332","Brentford":"9937","Brescia":"189481","Brest":"8521","Brighton":"10204","Brighton U18":"773678","Brighton U21":"773678","Brisbane Roar":"8118","Bristol City":"8427","Bristol Rovers":"10104","Briton Ferry":"560955","Bromley":"45729","Brommapojkarna":"8501","Bryne":"8531","Brøndby":"8595","Bucheon 1995":"429441","Burgos":"7876","Burnley":"8191","Burnley U18":"1796112","Burnley U21":"1796112","Burton Albion":"9792","Busan I'Park":"6092","Buxton":"161824","Bylis Ballsh":"10026","CA Bizertin":"102107","CF Montréal":"161195","CFR Cluj":"9731","CODM Meknès":"102032","CRB":"104821","CS Sfaxien":"102106","CSF Bălți":"8012","CSKA 1948 Sofia":"10144","CSKA Moskva":"9760","CSKA Sofia":"10144","Cacereño":"7809","Caen":"7819","Caernarfon Town":"2198","Cagliari":"8529","Cambridge United":"9834","Cambuur":"7788","Campobasso":"212658","Carabobo":"49681","Caracas":"7850","Cardiff City":"8344","Cardiff MU":"560953","Carlisle United":"10196","Carolina Core":"1610955","Carpi":"208931","Carrarese":"6488","Carrick Rangers":"187969","Cartagena":"8554","Cartaginés":"49732","Casa Pia AC":"212821","Casarano":"6460","Casertana":"277990","Castellón":"10279","Catania":"8530","Catanzaro":"10168","Cavese":"6063","Ceará":"172341","Celje":"4622","Celta Fortuna":"161743","Celta de Vigo":"9910","Celtic":"9925","Central Coast Mariners":"8164","Cercle Brugge":"9984","Cerezo Osaka":"4692","Cerro":"1836","Cerro Largo":"148967","Cerro Porteño":"6295","Cesena":"584022","Ceuta":"357259","Changchun Yatai":"6401","Chapecoense":"197693","Charleroi":"9986","Charlotte FC":"1323940","Charlton Athletic":"8451","Chattanooga":"521005","Chaves":"9774","Chelmsford City":"45724","Chelsea":"8455","Chelsea U18":"773652","Chelsea U19":"773652","Chelsea U21":"773652","Cheltenham Town":"8680","Chengdu Rongcheng":"737052","Cheonan City":"187960","Cherno More":"10141","Chesham United":"207145","Chester":"9797","Chesterfield":"9786","Chicago Fire":"6397","Chicago Fire II":"1348118","Chippa United":"316438","Chippenham Town":"7962","Chorley":"274599","Chrudim":"279088","Chungbuk Cheongju":"833651","Chungnam Asan":"429442","Châteauroux":"9854","Cienciano":"1845","Cincinnati":"722265","Cincinnati II":"1348109","Cittadella":"6485","Clermont":"8311","Cliftonville":"1703","Club Africain":"102102","Club Brugge":"8342","Club Brugge II":"1173026","Club Tijuana":"162418","Cobh Ramblers":"2383","Cobresal":"4055","Colchester United":"8416","Coleraine":"2202","Colo Colo":"7815","Colorado Rapids":"8314","Colorado Rapids II":"1348103","Columbus Crew":"6001","Columbus Crew II":"1348126","Colwyn Bay":"207869","Comerciantes Unidos":"536945","Como":"10171","Concarneau":"47207","Connah's Quay":"2193","Consadole Sapporo":"112688","Coquimbo Unido":"4062","Corinthians":"9808","Coritiba":"9767","Cork City":"2201","Cosenza":"6456","Coventry City":"8669","Cracovia Kraków":"2186","Crawley Town":"8647","Cremonese":"7801","Crewe Alexandra":"9784","Criciúma":"7729","Crotone":"9884","Crown Legacy FC":"1451868","Crusaders":"1937","Cruz Azul":"6578","Cruzeiro":"9781","Crvena Zvezda":"8687","Crystal Palace":"9826","Crystal Palace U18":"1267874","Crystal Palace U21":"1267874","Csikszereda Miercurea Ciuc":"583690","Cuiabá":"197815","Cultural Leonesa":"1753","Curzon Ashton":"158390","Cusco":"305171","Cádiz":"8385","Córdoba":"7869","DAC":"103598","DC United":"6602","Dacia-Buiucani":"188151","Daegu":"133897","Daejeon Citizen":"133900","Dagenham & Redbridge":"8009","Dainava":"254228","Dalian Young Boy":"1477043","Dallas":"6399","Danubio":"8562","Darlington 1883":"8598","Darmstadt 98":"8262","Dartford":"161813","De Graafschap":"8526","Debrecen":"8369","Defensa y Justicia":"161730","Defensor Sporting":"7796","Degerfors":"6544","Delfin":"519457","Den Bosch":"9835","Dender":"7947","Deportes Iquique":"162904","Deportes Limache":"584840","Deportivo Alavés":"9866","Deportivo Cali":"6387","Deportivo Cuenca":"4144","Deportivo Garcilaso":"920788","Deportivo La Coruña":"9783","Deportivo La Guaira":"176496","Deportivo Pasto":"4405","Deportivo Pereira":"4404","Deportivo Recoleta":"1427854","Deportivo Saprissa":"6607","Deportivo Táchira":"1896","Derby County":"10170","Derby County U18":"773680","Derby County U21":"773680","Derry City":"8338","Dhamk":"582823","Difaâ El Jadida":"102033","Dijon":"9836","Dila":"2217","Dinamo Batumi":"6193","Dinamo Bucureşti":"10271","Dinamo City":"10027","Dinamo Moskva":"9763","Dinamo Tbilisi":"7755","Dinamo Zagreb":"10156","Diósgyőr":"2476","Djurgården":"9802","Dobrudzha 1919":"10140","Dolomiti Bellunesi":"1295924","Domžale":"8154","Doncaster Rovers":"9903","Dordrecht":"6631","Dorking Wanderers":"580438","Dover Athletic":"4454","Drogheda United":"8339","Dukla Praha":"88657","Dundalk":"1853","Dundee":"8284","Dundee United":"9938","Dunfermline Athletic":"8457","Dungannon Swifts":"4615","Dunkerque":"47214","Durban City":"149599","Dynamo Dresden":"8480","Dynamo Kyiv":"8688","Dynamo Makhachkala":"1068353","Džiugas Telšiai":"624858","ES Tunis":"8153","Eastbourne Borough":"6627","Eastleigh":"161803","Ebbsfleet United":"9794","Egersund":"4722","Egnatia Rrogozhinë":"10039","Ehime":"162198","Eibar":"8372","Eindhoven":"6416","Eintracht Braunschweig":"9776","Eintracht Frankfurt":"9810","Eintracht Trier":"7774","El Nacional":"6612","Elche":"10268","Eldense":"8288","Elfsborg":"8014","Elversberg":"8232","Emelec":"1850","Emmen":"6660","Empoli":"8534","Energie Cottbus":"8398","Enfield Town":"282365","Enköping":"8425","Enosis":"4126","Envigado":"4402","Epitsentr Kamyanets-Podilskyi":"1395678","Erzgebirge Aue":"8319","Esbjerg":"8285","Esenler Erokspor":"863838","Eskilsminne":"303470","Eskilstuna":"6238","Espanyol":"8558","Estoril":"7842","Estrela Amadora":"1074320","Estudiantes":"10094","Estudiantes de Mérida":"93061","Ethnikos Achnas":"8334","Etoile du Sahel":"6366","Eupen":"6351","Europa":"189639","Everton":"8668","Everton U14":"773653","Everton U18":"773653","Everton U21":"773653","Excelsior":"10218","Exeter City":"9833","Eyüpspor":"4681","FAR Rabat":"102035","FC Andorra":"494050","FC Bocholt":"557692","FC Košice":"969268","FCS Bucureşti":"9723","FH":"8151","FK Auda":"2106","FK Liepāja":"8016","FK Metta":"197869","FK Tukums 2000/Telms":"197870","FS Jelgava":"192962","FSV Frankfurt":"88885","FUS Rabat":"102036","Fagiano Okayama":"164739","Falkenberg":"6545","Falkirk":"8596","Famalicão":"1634","Farense":"6004","Farnborough":"7954","Farul Constanţa":"210132","Fatih Karagümrük":"2088","Feirense":"4064","Felgueiras 1932":"474326","Fenerbahçe":"8695","Ferencváros":"8222","Ferroviária":"581832","Feyenoord":"10235","Finn Harps":"1627","Fiorentina":"8535","First Vienna":"2030","Flamengo":"9770","Flamurtari Vlorë":"10030","Fleetwood Town":"45723","Fleury 91 FC":"238687","Flint Town United":"316297","Flora":"8155","Floridsdorfer AC":"8274","Fluminense":"9863","Foggia":"6466","Forest Green Rovers":"9828","Forlì":"6071","Fortaleza":"8287","Fortuna Düsseldorf":"8194","Fortuna Düsseldorf II":"95052","Fortuna Köln":"7786","Fortuna Sittard":"6422","Fram":"6291","Francs Borains":"96953","Fredericia":"8454","Fredrikstad":"8417","Freiburg":"8358","Freiburg II":"6594","Frosinone":"9891","Fujieda MYFC":"305776","Fulham":"9879","Fulham U18":"860801","Fulham U21":"860801","Fylde":"282396","GAIS":"8297","GIANA Erminio":"568741","GIF Sundsvall":"8359","Gabès":"206148","Gagra":"154186","Galatasaray":"8637","Galway United":"520517","Gamba Osaka":"6582","Gangwon":"164734","Gareji":"1230631","Gateshead":"6189","Gaziantep":"4081","Gefle":"7997","General Caballero JLM":"1055181","Genk":"9987","Genk II":"1378463","Genoa":"10233","Gent":"9991","Gent II":"1379188","Gençlerbirliği":"7800","Getafe":"8305","Gil Vicente":"9764","Gillingham":"10173","Gimcheon Sangmu":"133901","Gimnàstic Tarragona":"8400","Gimpo Citizen":"833649","Girona":"7732","Giugliano":"6040","Glenavon":"1956","Glentoran":"2203","Gnistan":"2361","Go Ahead Eagles":"6433","Goiás":"9862","Golden Arrows":"102097","Gorica":"206560","Granada":"7878","Grasshopper":"9956","Grazer AK":"10012","Greenock Morton":"8648","Grenoble":"9855","Greuther Fürth":"8357","Grimsby Town":"10005","Grobiņa":"662738","Groningen":"8674","Grorud":"4201","Grêmio":"9769","Grêmio Novorizontino":"581838","Guabirá":"114830","Guadalajara":"7807","Guadalupe":"855904","Gualberto Villarroel SJ":"1504770","Guaraní":"1893","Gubbio":"6061","Guidonia Montecelio":"1667898","Guingamp":"9747","Gwangju":"245905","Gyeongnam":"133899","Győri ETO":"5755","Górnik Zabrze":"8020","Göztepe":"1925","Gütersloh":"6200","HB Køge":"8289","HJK":"9861","Hajduk Split":"10154","Haka":"7870","Halifax Town":"10195","Halmstad":"8310","HamKam":"8448","Hamburger SV":"9790","Hammarby":"8248","Hammarby Talang":"4438","Hampton & Richmond":"105552","Haninge":"628812","Hannover 96":"9904","Hansa Rostock":"8294","Hanácká":"2404","Hapoel Acre":"426452","Hapoel Afula":"426452","Hapoel Be'er Sheva":"9754","Hapoel Hadera":"857444","Hapoel Haifa":"8301","Hapoel Jerusalem":"459591","Hapoel Kfar Saba":"6280","Hapoel Kfar Shalem":"1177310","Hapoel Nof HaGalil":"4125","Hapoel Petah Tikva":"9755","Hapoel Raanana":"2096","Hapoel Ramat Gan":"89753","Hapoel Rishon LeZion":"1831","Hapoel Tel Aviv":"10181","Harju JK":"673053","Harrogate Town":"7946","Hartberg":"10056","Hartlepool United":"8488","Hassania Agadir":"102037","Hatayspor":"95749","Haugesund":"8512","Havelse":"89338","Haverfordwest County":"2194","Hearts":"9860","Hebburn Town":"292923","Hednesford Town":"9923","Heerenveen":"10228","Hegelmann Litauen":"736555","Heidenheim":"94937","Hellas Verona":"9876","Helmond Sport":"6417","Helsingborg":"9859","Hemel Hempstead Town":"161831","Henan":"51442","Heracles":"9791","Herediano":"49726","Hereford FC":"799249","Hermannstadt":"864269","Hertha BSC":"8177","Hessen Kassel":"8253","Hibernian":"10251","Hillerød":"9940","Hobro":"9950","Hoffenheim":"8226","Hoffenheim II":"94940","Holstein Kiel":"8150","Homburg":"1734","Hornchurch":"4047","Horsens":"9814","Horsham":"105554","Houston Dynamo":"8259","Houston Dynamo II":"1348104","Hradec Králové":"1712","Huachipato":"4056","Huddersfield Town":"9796","Huesca":"96925","Huntsville City":"1445755","Huracán":"10081","Husqvarna":"6119","Hvidovre":"10240","Hwaseong":"739800","Hyde United":"161802","Häcken":"8428","Hässleholms IF":"418688","Hércules":"10278","Hødd":"7937","IFK Göteborg":"9893","IFK Norrköping":"8449","IFK Skövde":"610365","IMT Novi Beograd":"568569","Iberia 1999":"480291","Ibiza":"1123073","Ilves":"162146","Imabari":"820969","Incheon United":"133895","Independiente":"10078","Independiente Petrolero":"958325","Independiente del Valle":"192875","Ingolstadt":"8234","Inter Miami":"960720","Inter Miami II":"1348111","Inter Turku":"6550","Internacional":"8702","Internazionale":"8636","Internazionale II":"1790497","Ipswich Town":"9902","Ipswich Town U18":"1796115","Ipswich Town U21":"1796115","Ironi Kiryat Shmona":"2095","Ironi Modi'in":"1691612","Ironi Tiberias":"543580","Istra 1961":"6038","Ittihad Tanger":"316657","Iwaki":"860934","Iğdır FK":"1281818","JEF United":"9756","Jablonec":"7758","Jagiellonia Białystok":"1957","Jahn Regensburg":"7789","Jaro":"8473","Javor Ivanjica":"2391","Jeju SK":"133898","Jeonbuk Motors":"46038","Jeonnam Dragons":"109377","Jeunesse Sportive Omrane":"1669235","Juan Pablo II College":"1573153","Junior":"2254","Juve Stabia":"6106","Juventud":"9883","Juventud Torremolinos":"371716","Juventude":"10274","Juventus":"9885","Juventus Next Gen":"956184","Juárez":"649424","Jönköpings Södra":"8510","Júbilo Iwata":"8065","KA":"2165","KFUM":"2305","KR":"8130","KTP":"6701","Kairat":"8037","Kairouan":"177179","Kaisar":"2125","Kaiserslautern":"8350","Kaizer Chiefs":"6279","Kalmar":"9892","Kapaz":"4150","Kapfenberger SV":"9979","Karlberg":"303472","Karlsruher SC":"8295","Karlstad":"627694","Karpaty":"8691","Karvan":"8045","Karviná":"143833","Kashima Antlers":"4397","Kashiwa Reysol":"8699","Kasımpaşa":"4685","Kataller Toyama":"164737","Katowice":"4023","Kauno Žalgiris":"439132","Kawasaki Frontale":"6304","Kawkab Marrakech":"102042","Kayserispor":"10182","Kazincbarcika":"2280","Kerry":"1426348","Kfar Kasem":"752833","Khemis Zemamra":"950070","Kickers Offenbach":"8407","Kidderminster Harriers":"10284","Kifissia":"488099","Kilmarnock":"8597","King's Lynn Town":"45731","Kiryat Yam":"1691614","Kocaelispor":"1569","Kolding IF":"6308","Kolkheti Poti":"2218","Kolos Kovalivka":"599924","Komárno":"611956","Kongsvinger":"8179","Konyaspor":"8622","Koper":"5772","Korona Kielce":"8245","Kortrijk":"8571","Krasnodar":"168719","Kristiansund":"8605","Krylya Sovetov":"8709","Kryvbas KR":"558259","KuPS":"1693","Kudrivka":"1763072","Kuressaare":"4146","Kyoto Sanga":"8542","Kyzyl-Zhar":"2120","Köln":"8722","Köln II":"8459","København":"8391","LASK":"9977","LDU Quito":"6721","LNZ Cherkasy":"2143","La Equidad":"47240","La Louvière":"1218969","La Serena":"1891","Landskrona":"8511","Lanús":"10082","Larissa":"8120","Larne":"2206","Las Palmas":"8306","Latina":"212660","Lausanne Sport":"7730","Laval":"7853","Lazio":"8543","Le Havre":"9746","Le Mans":"8682","Le Puy F.43 Auvergne":"293257","Leamington":"5764","Lecce":"9888","Lecco":"6512","Lech Poznań":"2182","Lechia Gdańsk":"8030","Leeds United":"8463","Leeds United U17":"1177187","Leeds United U18":"1177187","Leeds United U21":"1177187","Leganés":"7854","Legia Warszawa":"8673","Leicester City":"8197","Leicester City U18":"773642","Leicester City U21":"773642","Leixões":"6421","Lens":"8588","Levadia":"1588","Levadiakos":"4493","Levante":"8581","Levski Sofia":"8632","Leyton Orient":"8351","León":"1841","Libertad":"1345405","Liefering":"1915","Lierse Kempenzonen":"465631","Lille":"8639","Lillestrøm":"8476","Lincoln City":"8430","Linfield":"7971","Liverpool":"8650","Liverpool U17":"1070259","Liverpool U18":"1070259","Liverpool U19":"1070259","Liverpool U21":"1070259","Livingston":"8282","Livorno":"8537","Liège":"6363","Ljungskile":"8500","Llanelli Town":"8341","Llaneros":"348397","Lokeren-Temse":"213307","Lokomotiv Moskva":"8710","Lokomotiv Plovdiv":"10129","Lokomotiv Sofia 1929":"10128","Lokomotiva Zagreb":"175388","Lommel SK":"6702","Longford Town":"4569","Lorient":"8689","Los Angeles FC":"867280","Los Angeles Galaxy":"6637","Los Angeles II":"1451871","Los Chankas":"741328","Ludogorets":"210173","Lugano":"7896","Lugo":"8206","Lumezzane":"6452","Lund":"6174","Lusitania FC Lourosa":"188154","Luton Town":"8346","Luzern":"10199","Lyn":"10224","Lyngby":"9907","MSV Duisburg":"8293","MTK":"7778","MVV":"9838","Macarthur":"1209973","Macará":"6609","Maccabi Bnei Raina":"1121750","Maccabi Haifa":"10185","Maccabi Herzliya":"2097","Maccabi Kabilio Jaffa":"196257","Maccabi Netanya":"1832","Maccabi Petah Tikva":"9755","Maccabi Tel Aviv":"7855","Macclesfield Town":"8599","Machida Zelvia":"194011","Magdeburg":"8188","Magesi":"429859","Maghreb Fès":"102043","Maidenhead United":"45725","Maidstone United":"8131","Mainz 05":"9905","Mainz 05 II":"8397","Mallorca":"8661","Malmö FF":"10237","Mamelodi Sundowns":"4530","Manchester City":"8456","Manchester City U18":"860800","Manchester City U19":"860800","Manchester City U21":"860800","Manchester United":"10260","Manchester United U18":"1070257","Manchester United U21":"1070257","Manisa F.K.":"658812","Mansfield Town":"9818","Manta":"162922","Mantova":"9889","Marbella":"161781","Maribor":"8340","Mariehamn":"6634","Marine":"161816","Marsa":"102105","Marumo Gallants":"352390","Marítimo":"10212","Mazatlán":"1170234","Mechelen":"8203","Medellín":"2528","Meizhou Hakka":"585808","Melbourne City":"203576","Melbourne Victory":"6230","Melgar":"4417","Merthyr Town":"5762","Metalist 1925 Kharkiv":"949030","Metaloglobus":"404509","Metropolitanos":"365280","Metz":"8550","Middelfart":"9969","Middlesbrough":"8549","Middlesbrough U18":"773660","Middlesbrough U21":"773660","Midtjylland":"8113","Milan":"8564","Millonarios":"4403","Millwall":"10004","Milsami":"175682","Milton Keynes Dons":"8645","Minnesota United":"207242","Minnesota United II":"1348105","Miramar Misiones":"4424","Mirandés":"4032","Mirassol":"163782","Mito Hollyhock":"162195","Mjällby":"8127","Mjøndalen":"6541","Mladost Lučani":"1739","Mladá Boleslav":"10180","Modena":"9887","Molde":"9917","Monaco":"9829","Monagas":"49683","Monastir":"102109","Monopoli":"189506","Montana":"46475","Montedio Yamagata":"164720","Monterrey":"7849","Montpellier":"10249","Monza":"6504","Morecambe":"8489","Moreirense":"8348","Moss":"8405","Motherwell":"9927","Motor Lublin":"89466","Municipal Liberia":"210220","Mura":"2172","Mushuc Runa":"304929","Málaga":"9864","Mérida AD":"8317","Métlaoui":"405958","NAC Breda":"9761","NEC":"8464","NEOM":"1699505","Nacional":"10214","Nacional Asunción":"49689","Nacional Potosí":"164353","Nagoya Grampus":"8006","Nancy":"8481","Nantes":"9830","Napoli":"9875","Napredak Kruševac":"6050","Nashville SC":"915807","Necaxa":"1842","Neftchi":"4617","Neuchâtel Xamax":"7955","New England":"6580","New England II":"1121686","New York City":"546238","New York City II":"1348108","New York RB":"6514","New York RB II":"614318","Newcastle Jets":"6454","Newcastle United":"10261","Newcastle United U18":"860798","Newcastle United U19":"860798","Newcastle United U21":"860798","Newport County":"10262","Nice":"9831","Nieciecza":"177361","Nizhny Novgorod":"657508","Noah":"866111","Nordsjælland":"10202","Norrby":"2014","North Texas":"1004921","Northampton Town":"8651","Norwich City":"9850","Norwich City U18":"773658","Norwich City U21":"773658","Nottingham Forest":"10203","Nottingham Forest U14":"1389162","Nottingham Forest U18":"1389162","Nottingham Forest U21":"1389162","Notts County":"9819","Novara":"6269","Novi Pazar":"187854","Nyíregyháza Spartacus":"2035","Nõmme Kalju":"112484","Nürnberg":"8165","O'Higgins":"6296","OB":"8414","OFI":"7753","OFK Beograd":"8692","OH Leuven":"1773","Obolon":"583129","Oddevold":"6160","Odds":"7988","Oita Trinita":"4427","Okzhetpes":"2128","Oldham Athletic":"9785","Oleksandria":"6072","Olimpia":"6619","Olimpija":"7872","Olympiacos Piraeus":"8638","Olympic":"241064","Olympic Charleroi":"4137","Olympic Safi":"102047","Olympique Béja":"102104","Olympique Dcheïra":"570487","Olympique Lyonnais":"9748","Olympique Marseille":"8592","Omonia Aradippou":"8044","Omonia Nicosia":"8044","Once Caldas":"6024","Opava":"1713","Operário PR":"197429","Orbit College":"915983","Ordabasy":"2127","Orenburg":"132286","Orense":"1014174","Oriente Petrolero":"1844","Orlando City":"267810","Orlando City B":"722266","Orlando Pirates":"7866","Orléans":"47211","Osasuna":"8371","Osasuna Promesas":"161778","Osijek":"10157","Oskarshamns AIK":"2015","Osnabrück":"9775","Ospitaletto":"6494","Oulu":"4449","Ourense CF":"7859","Oxford City":"161836","Oxford United":"8653","Oţelul":"9736","PAOK":"8619","PEC Zwolle":"6413","PSG":"9847","PSV":"8640","PSV II":"455494","Pachuca":"7848","Paderborn":"8460","Paderborn II":"657648","Padova":"583944","Pafos":"2137","Paide":"163540","Paksi FC":"7986","Palermo":"8540","Palestino":"6455","Palmeiras":"10283","Panathinaikos":"10200","Panetolikos FC":"162386","Panevėžys":"479143","Panserraikos":"104814","Pardubice":"2406","Paris":"6379","Paris 13 Atletico":"238671","Parma":"10167","Partick Thistle":"8426","Partizan":"7998","Partizani Tirana":"10028","Patro Eisden":"274583","Pau":"6355","Paysandu":"6546","Paços de Ferreira":"6403","Penafiel":"6547","Pendikspor":"95745","Penybont":"474592","Pergolettese":"474521","Perth Glory":"7961","Perugia":"8685","Pescara":"9878","Peterborough Sports":"674289","Peterborough United":"8677","Petrocub":"561981","Petrolul 52":"188187","Peñarol":"8450","Philadelphia Union":"191716","Philadelphia Union II":"722264","Pianese":"584069","Piast Gliwice":"8028","Picerno":"674807","Pineto":"770928","Pisa":"6479","Plaza Colonia":"4669","Plymouth Argyle":"8401","Podbrezová":"2437","Pogoń Szczecin":"8023","Pohang Steelers":"109373","Polissya":"1181312","Politehnica UTM":"1771526","Polokwane City":"149600","Ponferradina":"8005","Pontedera":"145016","Pontevedra":"7862","Port Vale":"9799","Portadown":"7984","Portimonense":"9765","Portland Timbers":"307690","Portland Timbers II":"614322","Porto":"9773","Porto II":"338304","Portsmouth":"8462","Portuguesa":"49682","Posušje":"10111","Potenza":"6099","Prescot Cables":"161828","Preston North End":"8411","Preußen Münster":"8171","Primorje":"2171","Pro Patria":"6498","Pro Vercelli":"189486","Progreso":"1838","Prostějov":"358094","Puebla":"7847","Pumas UNAM":"1946","Puntarenas":"9935","Puskás FC":"355346","Pyunik":"6345","Pärnu JK Vaprus":"828265","Pérez Zeledón":"49730","Příbram":"1672","Qabala":"8076","Qarabag":"7981","Qingdao Hainiu":"4183","Qingdao West Coast":"1283248","Queen's Park":"8235","Queens Park Rangers":"10172","Querétaro":"1943","Quevilly Rouen":"2517","RB Leipzig":"178475","RB Omiya Ardija":"4398","RFC Seraing":"149408","RFS":"248871","RKC Waalwijk":"10219","RSB Berkane":"316652","RWD Molenbeek":"9992","Racing":"6043","Racing Club":"10080","Racing Ferrol":"8474","Racing Santander":"8696","Radcliffe FC":"282390","Radnik Bijeljina":"10124","Radnik Surdulica":"463461","Radnički Kragujevac":"1675","Radnički Niš":"6410","Radomiak Radom":"5769","Radomlje":"272871","Raith Rovers":"10250","Raja Casablanca":"102049","Raków Częstochowa":"4024","Randers":"8410","Rangers":"8548","Ranheim":"6563","Rapid Bucureşti":"9738","Rapid Wien":"10015","Rapid Wien II":"1952","Rapperswil-Jona":"185504","Raufoss":"9812","Ravenna":"8545","Rayo Vallecano":"8370","Rayo Zuliano":"1267963","Reading":"9798","Reading U18":"773686","Reading U21":"773686","Real Avilés":"189594","Real Betis":"8603","Real Madrid":"8633","Real Madrid Castilla":"189680","Real Monarchs":"614324","Real Murcia":"8392","Real Oruro":"1504766","Real Oviedo":"8670","Real Salt Lake":"6606","Real Sociedad":"8560","Real Sociedad B":"161744","Real Tomayapo":"1074622","Real Valladolid":"10281","Real Zaragoza":"8394","Red Bull Bragantino":"109705","Red Star":"6390","Reggiana":"6500","Reims":"9837","Remo":"1626","Renate":"177522","Rennes":"9851","Renofa Yamaguchi":"614556","Rheindorf Altach":"10008","Richards Bay":"866690","Ried":"10017","Riga FC":"624924","Rijeka":"10162","Rimini":"9886","Rio Ave":"7841","Riteriai":"257518","River Plate":"10076","Rizespor":"2166","Roasso Kumamoto":"162196","Rochdale":"8493","Roda JC":"9803","Rodez":"4120","Roma":"8686","Rosario Central":"10084","Rosenborg":"8422","Rosengård":"6170","Ross County":"8649","Rostov":"8705","Rot-Weiss Essen":"8296","Rot-Weiß Oberhausen":"7782","Rotherham United":"8119","Rouen":"8582","Rubin Kazan'":"8683","Rudar Prijedor":"175797","Rukh Lviv":"859316","Ružomberok":"10186","Rödinghausen":"465376","SGV Freiberg":"94935","SJ Earthquakes":"6603","SJK":"162162","SK Beveren":"8475","SK Poltava":"1395689","SK Super Nova Salaspils":"981193","Saarbrücken":"8271","Sabadell":"4033","Sabah":"951893","Sagan Tosu":"162193","Saint-Étienne":"9853","Sakaryaspor":"4124","Salernitana":"6480","Salford City":"282326","Salisbury":"1114695","Salzburg":"10013","Sambenedettese":"8482","Samgurali":"316432","Sampdoria":"9882","Samsunspor":"9750","San Antonio Bulo Bulo":"1297060","San Carlos":"49728","San Diego":"1701119","San Lorenzo":"10083","Sandefjord":"8609","Sandhausen":"8086","Sandviken":"6241","Sanfrecce Hiroshima":"6224","Santa Clara":"1567","Santa Fe":"7818","Santos":"8514","Santos Laguna":"7857","Sarajevo":"10105","Sarpsborg 08":"8509","Sarıyer":"2090","Sassuolo":"7943","Scarborough Athletic":"580382","Schalke 04":"10189","Schalke 04 II":"8198","Schott Mainz":"555501","Schweinfurt":"7780","Scunthorpe United":"8412","Seattle Sounders":"130394","Sekhukhune United":"612014","Seongnam":"6614","Seoul":"92630","Seoul E-Land":"616212","Septemvri Sofia":"312976","Serik Belediyespor":"914196","Servette":"9777","Sevilla":"8302","Sevilla Atlético":"91431","Shakhtar Donetsk":"9728","Shamakhi FK":"2103","Shamrock Rovers":"4131","Shandong Taishan":"8623","Shanghai Port":"198616","Shanghai Shenhua":"6628","Sheffield United":"8657","Sheffield Wednesday":"10163","Shelbourne":"5751","Shenzhen Peng City":"930027","Sheriff":"9729","Shimizu S-Pulse":"4426","Shonan Bellmare":"6180","Shrewsbury Town":"9896","Sigma Olomouc":"6461","Silkeborg":"8415","Sint-Truiden":"9997","Sion":"10179","Siracusa":"674812","Sirius":"6694","Sivasspor":"6265","Siwelele Football Club":"102099","Skalica":"555292","Skeid":"8421","Skövde AIK":"6153","Slaven Belupo":"1581","Slavia Praha":"7787","Slavia Praha II":"7787","Slavia Sofia":"10134","Sligo Rovers":"6361","Sloga Doboj":"187928","Slough Town":"6432","Slovan Bratislava":"6019","Slovan Liberec":"10245","Slovácko":"2021","Sochaux":"9874","Sochi":"195601","Sogndal":"8616","Solihull Moors":"161801","Sollentuna":"111120","Sonnenhof Großaspach":"94941","Sorrento":"88998","South Shields":"865163","Southampton":"8466","Southampton U18":"773645","Southampton U21":"773645","Southend United":"8652","Southport":"10197","Sparta Praha":"10247","Sparta Praha II":"132215","Sparta Rotterdam":"8614","Spartak Moskva":"8643","Spartak Subotica":"176525","Spartak Trnava":"4662","Spartak Varna":"10145","Spartanii Selemet":"771910","Spennymoor Town":"557101","Spezia":"9881","Sport Boys":"4412","Sport Huancayo":"165148","Sport Recife":"6305","Sportfreunde Lotte":"95103","Sportfreunde Siegen":"9757","Sporting Braga":"10264","Sporting CP":"9768","Sporting CP II":"338301","Sporting Cristal":"1848","Sporting FC":"776638","Sporting Gijón":"9869","Sporting KC":"6604","Sporting KC II":"722268","Sportivo Ameliano":"1242560","Sportivo Luqueño":"49687","Sportivo Trinidense":"59844","St. Gallen":"10190","St. Johnstone":"8467","St. Louis City":"1427963","St. Louis City II":"1346404","St. Mirren":"9800","St. Patrick's Ath.":"1854","St. Pauli":"8152","St. Pölten":"1907","Stabæk":"9918","Stade Briochin":"685213","Stade Lausanne-Ouchy":"289334","Stade Nyonnais":"2442","Stade Tunisien":"102116","Standard Liège":"9985","Start":"9919","Steinbach":"557592","Stellenbosch FC":"207873","Stevenage":"10253","Stjarnan":"6343","Stockholm Inter":"1011931","Stockport County":"10007","Stocksund":"916701","Stoke City":"10194","Stoke City FC U15":"773650","Stoke City U18":"773650","Stoke City U21":"773650","Strasbourg":"9848","Stripfing":"611179","Strømsgodset":"8180","Sturm Graz":"10014","Sturm Graz II":"1921","Stuttgart":"10269","Stuttgart II":"8458","Stuttgarter Kickers":"8195","Sumqayıt":"213987","Sunderland":"8472","Sunderland U17":"773657","Sunderland U18":"773657","Sunderland U21":"773657","Sutton United":"158316","Suwon":"187951","Suwon Bluewings":"88517","Swansea City":"10003","Swindon Town":"9795","Sydney":"10164","São Paulo":"10277","Sønderjyske":"8487","Südtirol":"189475","Sūduva":"8337","TOP Oss":"7781","TS Galaxy FC":"953498","Tacoma Defiance":"614327","Talavera CF":"357239","Tallinna Kalev":"49578","Tamworth":"10254","Tarazona":"209196","Tartu Tammeka":"4147","Tatran Prešov":"8010","Team Altamura":"867623","Team Thoren":"191427","Telavi":"1168646","Telstar":"6414","Tenerife":"9867","Teplice":"4721","Ternana":"6457","Teruel":"190091","Teuta Durrës":"10037","The New Saints":"7852","The Strongest":"2527","The Town":"1348115","Thun":"10191","Tianjin Tigers":"4189","Tigres UANL":"8561","Tirana":"10029","Tobol":"7983","Tokushima Vortis":"162199","Tokyo":"4399","Tokyo Verdy":"6223","Tolima":"1894","Toluca":"6618","Tonbridge Angels":"161808","Tondela":"188163","Torino":"9804","Toronto":"56453","Toronto II":"614319","Torpedo Kutaisi":"2216","Torquay United":"10193","Torque":"395613","Torreense":"212820","Torres":"7856","Torslanda":"6162","Tottenham Hotspur":"8586","Tottenham Hotspur U18":"860802","Tottenham Hotspur U19":"860802","Tottenham Hotspur U21":"860802","Toulouse":"9941","Trabzonspor":"9752","Tranmere Rovers":"8313","Trans":"2252","Trapani":"208936","Treaty United":"1233534","Trelleborg":"8333","Trento":"6097","Trenčín":"6496","Triestina":"9872","Trollhättan":"6183","Tromsø":"8608","Troyes":"10242","Truro City":"177067","Turan Turkistan":"1234149","Turan-T":"4674","Twente":"8611","Táborsko":"157007","Técnico Universitario":"113054","UCD":"1578","UCV":"188213","UD Oliveirense":"1785","UTA Arad":"584663","UTC Cajamarca":"425692","UTS Rabat":"320835","Udinese":"8600","Ulm":"8201","Ulsan Hyundai":"133896","Ulytau":"1622701","Umeå":"8601","Union Berlin":"8149","Union Saint-Gilloise":"7978","Unionistas de Salamanca":"780591","Unirea Slobozia":"364411","United Nordic":"1144284","Universidad Católica":"6458","Universidad de Chile":"6310","Universitario":"4409","Universitario de Vinto":"879029","Universitatea Cluj":"89022","Universitatea Craiova":"480286","União de Leiria":"9771","Unión Española":"7843","Unión La Calera":"192435","Unión Magdalena":"4408","Urartu":"7979","Urawa Reds":"6244","Utrecht":"9908","Utrecht II":"278960","Utsikten":"73158","V-Varen Nagasaki":"194016","VPS":"6597","VVV Venlo":"9839","Vaduz":"9824","Valencia":"10267","Valenciennes":"9873","Valur":"8064","Vancouver Whitecaps":"307691","Vancouver Whitecaps II":"614326","Vanspor FK":"146408","Varaždin":"10165","Varbergs":"6692","Vasalund":"1967","Vasco da Gama":"10276","Vegalta Sendai":"162192","Vejle":"8231","Velbert":"2564","Velež":"10122","Venezia":"7881","Ventforet Kofu":"8539","Ventura County":"521005","Veres":"1175395","Verl":"7783","Versailles":"191111","Vestri":"750462","Viborg":"9939","Vicenza":"145007","Viking":"8478","Viktoria Köln":"276267","Viktoria Plzeň":"6033","Viktoria Žižkov":"6096","Vila Nova":"109706","Villarreal":"10205","Villarreal B":"161771","Villefranche":"161694","Vinotinto de Ecuador":"1446544","Virtus Entella":"208932","Virtus Verona":"474519","Vis Pesaro":"6049","Vissel Kobe":"4688","Vitesse":"8277","Vitória":"7733","Vitória Guimarães":"7844","Vizela":"4531","Vlašim":"175807","Vllaznia Shkodër":"10034","Vojvodina":"6406","Volendam":"6601","Volos NFC":"885256","Volta Redonda":"198135","Vora":"585403","Vukovar":"45228","Vysočina Jihlava":"1949","Várda SE":"465382","Värnamo":"6181","Västerås SK":"6194","Vålerenga":"8007","Vélez Sarsfield":"10079","Víkingur Reykjavík":"6017","WSG Swarovski Tirol":"1583","WSPG Wels":"946908","Waldhof Mannheim":"9743","Walsall":"10006","Wanderers":"7863","Waterford FC":"6042","Watford":"9817","Wealdstone":"161812","Wehen Wiesbaden":"8196","Wellington Phoenix":"78785","Werder Bremen":"8697","West Bromwich Albion":"8659","West Bromwich Albion U18":"773656","West Bromwich Albion U21":"773656","West Ham United":"8654","West Ham United U14":"773649","West Ham United U18":"773649","West Ham United U21":"773649","Westerlo":"10001","Western Sydney Wanderers":"323834","Weston-super-Mare":"6314","Wexford":"62337","Widzew Łódź":"8024","Wiedenbrück":"95106","Wigan Athletic":"8528","Wil":"10175","Willem II":"8525","Wilstermann":"1892","Wimborne Town":"282358","Winterthur":"7894","Wisła Płock":"8243","Woking":"8345","Wolfsberger AC":"1954","Wolfsburg":"8721","Wolverhampton Wanderers":"8602","Wolverhampton Wanderers U18":"773683","Wolverhampton Wanderers U21":"773683","Worksop Town":"9894","Worthing":"282351","Wrexham":"9841","Wuhan Three Towns":"1029687","Wuppertaler SV":"8142","Wycombe Wanderers":"8676","Wydad Casablanca":"102050","Yacoub El Mansour":"1786714","Yaracuyanos":"176495","Yelimay Semey":"200281","Yeovil Town":"10198","Yokohama":"49615","Yokohama F. Marinos":"6581","York City":"9916","Young Boys":"10192","Ypsonas":"1075325","Yunnan Yukun":"1477056","Yverdon Sport":"6447","Zagłębie Lubin":"8021","Zalaegerszegi TE":"1667","Zamora":"4031","Zarzis":"102112","Zbrojovka Brno":"1673","Zemplín Michalovce":"9899","Zenit":"8698","Zhejiang Professional":"51443","Zhenys":"1614087","Zhetysu":"2118","Zimbru":"8039","Zira":"577619","Zlín":"1860","Zorya":"7770","Zrinjski":"10107","Zulte-Waregem":"10000","Zürich":"10243","aab":"8470","aalesund":"8404","aarau":"9930","aarhus fremad":"8109","abb":"1297346","aberdeen":"8485","academia puerto cabello":"657277","academico viseu":"1786","accrington stanley":"8671","adana demirspor":"1926","adelaide united":"8008","admira":"10053","ado den haag":"10217","adt":"1104719","aek athens":"8563","aek larnaca":"7797","ael":"2134","af elbasani":"10038","afc telford united":"6315","afc totton":"275027","afc wimbledon":"158319","afturelding":"163251","agf":"8071","aguilas doradas":"193025","aik":"8349","airdrieonians":"8176","ajax":"8593","ajax ii":"163363","akhmat grozny":"8708","akritas":"184615","akron togliatti":"1068364","aktobe":"8000","al ahli":"2530","al akhdoud":"582759","al ettifaq":"101915","al fateh":"177356","al feiha":"582749","al hazem":"101911","al hilal":"2529","al ittihad":"8577","al khaleej":"550433","al kholood":"1523706","al najma":"1523707","al nassr":"101918","al qadisiyah":"101919","al riyadh":"582739","al shabab":"101916","al taawon":"205686","alajuelense":"6335","alanyaspor":"4678","albacete":"8393","albinoleffe":"9832","albirex niigata":"4425","alcione milano":"655295","alcorcon":"161750","aldershot town":"8465","alemannia aachen":"8396","alfreton town":"6258","algeciras":"7811","alianza":"193029","alianza atletico":"4410","alianza lima":"6398","alianza universidad":"314221","almere city":"4116","almeria":"9865","altrincham":"9915","aluminij":"1862","alverca":"9780","always ready":"805913","amazonas":"1340094","amazulu":"102100","amed sk":"96498","america":"6576","america de cali":"10280","america mineiro":"1757","amiens sc":"8587","amstetten":"8326","anderlecht":"8635","anderlecht ii":"1378461","angelholm":"8189","angers sco":"8121","ankara keciorengucu":"8387","annecy":"293352","anorthosis":"6243","ansan greeners":"821875","antalyaspor":"1931","antequera":"161849","antwerp":"9988","anyang":"429440","anzoategui fc":"1349498","apoel":"8621","apollon":"8003","ararat":"866109","araz":"485832","arbroath":"8280","arda":"944173","arenas club":"189631","arenteiro":"1314965","arezzo":"9849","arges":"9732","ariana":"1331261","aris":"2136","arka gdynia":"8322","arlanda":"841094","arminia bielefeld":"9912","arouca":"158085","arsenal":"9825","arsenal u18":"950214","arsenal u19":"950214","arsenal u21":"950214","artis brno":"106189","arzignano valchiampo":"583958","as soliman":"852755","asane":"10021","ascoli":"8522","ashdod":"6203","ask bravo":"856680","assyriska":"10225","astana":"166865","asteras tripolis":"80654","aston villa":"10252","aston villa u16":"1070261","aston villa u18":"1070261","aston villa u19":"1070261","aston villa u21":"1070261","astoria walldorf":"94938","atalanta":"8524","atalanta u23":"1524591","athletic bilbao":"8315","athletic club":"1221604","athletico paranaense":"10273","athlone town":"2378","atlanta united":"773958","atlanta united ii":"915806","atlas":"6577","atletico bucaramanga":"4401","atletico de san luis":"6358","atletico go":"165545","atletico grau":"920789","atletico madrid":"9906","atletico madrid b":"161759","atletico mineiro":"10272","atletico nacional":"6368","atletico sanluqueno":"189730","atletico tembetary":"1299349","atromitos":"10187","atyrau":"2349","aubagne":"293443","aucas":"6608","auckland fc":"1642068","audace cerignola":"867620","audax italiano":"4058","augsburg":"8406","aurora":"49720","austin fc":"1218886","austin fc ii":"1451870","austria klagenfurt":"10009","austria lustenau":"9982","austria salzburg":"206091","austria wien":"10011","austria wien ii":"10248","auxerre":"8583","avai":"104822","avellino":"6722","avispa fukuoka":"8270","avs":"1889","ayacucho":"165147","ayr united":"9913","az":"10229","az ii":"681217","b.93":"8453","backa topola":"676140","bahia":"7877","bahlinger sc":"2393","bala town":"175654","balingen":"145498","ballymena united":"4063","baltika":"49694","bandrmaspor":"162975","banfield":"10087","banga":"169157","bangor":"77755","banik ostrava":"6362","banik ostrava ii":"1154238","barakaldo":"7734","barcelona":"8634","bari":"9976","barnet":"8175","barnsley":"8283","barockstadt fulda-lehnerz":"465626","barrow":"6350","barry town united":"1603","basel":"9931","bastia":"7794","bath city":"6095","bayer leverkusen":"8178","bayern alzenau":"95039","bayern munchen":"9823","bb erzurumspor":"281467","bedford town":"8717","beerschot va":"583877","beijing guoan":"4177","beitar jerusalem":"8173","bellinzona":"6493","ben guerdane":"316413","benevento":"6266","benfica":"9772","benfica ii":"338302","beroe":"10126","besiktas":"10188","betis deportivo":"161780","bfc daugavpils":"197864","binacional":"916336","birmingham city":"8658","birmingham city u18":"1796111","birmingham city u21":"1796111","bkma":"1078402","blackburn rovers":"8655","blackburn rovers u18":"773685","blackburn rovers u21":"773685","blackpool":"8483","blau-wei linz":"2433","blaublitz akita":"194015","blooming":"49678","bnei sakhnin":"8718","bnei yehuda":"2215","boca juniors":"10077","bochum":"9911","bochum ii":"8200","bod / glimt":"8402","bodrumspor":"658811","bohemians":"4594","bohemians 1905":"1670","bolivar":"5983","bologna":"9857","bolton wanderers":"8559","boluspor":"4675","bonner sc":"95047","borac banja luka":"10116","boreham wood":"2488","borussia dortmund":"9789","borussia dortmund ii":"8395","borussia m'gladbach":"9788","borussia m'gladbach ii":"8278","boston river":"188313","boston united":"8646","botafogo":"8517","botafogo sp":"8355","botev plovdiv":"10131","botev vratsa":"187880","botosani":"188191","boulogne":"4170","bourg-en-bresse":"6246","bournemouth":"8678","boyaca chico":"6255","bra":"474518","brackley town":"158321","bradford city":"8484","brage":"6690","braintree town":"5763","brann":"8468","brattvag":"47403","bray wanderers":"1629","bregenz":"80619","breidablik":"8332","brentford":"9937","brescia":"189481","brest":"8521","brighton":"10204","brighton u18":"773678","brighton u21":"773678","brisbane roar":"8118","bristol city":"8427","bristol rovers":"10104","briton ferry":"560955","brndby":"8595","bromley":"45729","brommapojkarna":"8501","bryne":"8531","bucheon 1995":"429441","burgos":"7876","burnley":"8191","burnley u18":"1796112","burnley u21":"1796112","burton albion":"9792","busan i'park":"6092","buxton":"161824","bylis ballsh":"10026","ca bizertin":"102107","cacereno":"7809","cadiz":"8385","caen":"7819","caernarfon town":"2198","cagliari":"8529","cambridge united":"9834","cambuur":"7788","campobasso":"212658","carabobo":"49681","caracas":"7850","cardiff city":"8344","cardiff mu":"560953","carlisle united":"10196","carolina core":"1610955","carpi":"208931","carrarese":"6488","carrick rangers":"187969","cartagena":"8554","cartagines":"49732","casa pia ac":"212821","casarano":"6460","casertana":"277990","castellon":"10279","catania":"8530","catanzaro":"10168","cavese":"6063","ceara":"172341","celje":"4622","celta de vigo":"9910","celta fortuna":"161743","celtic":"9925","central coast mariners":"8164","cercle brugge":"9984","cerezo osaka":"4692","cerro":"1836","cerro largo":"148967","cerro porteno":"6295","cesena":"584022","ceske budejovice":"7840","ceuta":"357259","cf montreal":"161195","cfr cluj":"9731","changchun yatai":"6401","chapecoense":"197693","charleroi":"9986","charlotte fc":"1323940","charlton athletic":"8451","chateauroux":"9854","chattanooga":"521005","chaves":"9774","chelmsford city":"45724","chelsea":"8455","chelsea u18":"773652","chelsea u19":"773652","chelsea u21":"773652","cheltenham town":"8680","chengdu rongcheng":"737052","cheonan city":"187960","cherno more":"10141","chesham united":"207145","chester":"9797","chesterfield":"9786","chicago fire":"6397","chicago fire ii":"1348118","chippa united":"316438","chippenham town":"7962","chorley":"274599","chrudim":"279088","chungbuk cheongju":"833651","chungnam asan":"429442","cienciano":"1845","cincinnati":"722265","cincinnati ii":"1348109","cittadella":"6485","clermont":"8311","cliftonville":"1703","club africain":"102102","club brugge":"8342","club brugge ii":"1173026","club tijuana":"162418","cobh ramblers":"2383","cobresal":"4055","codm meknes":"102032","colchester united":"8416","coleraine":"2202","colo colo":"7815","colorado rapids":"8314","colorado rapids ii":"1348103","columbus crew":"6001","columbus crew ii":"1348126","colwyn bay":"207869","comerciantes unidos":"536945","como":"10171","concarneau":"47207","connah's quay":"2193","consadole sapporo":"112688","coquimbo unido":"4062","cordoba":"7869","corinthians":"9808","coritiba":"9767","cork city":"2201","corum fk":"357274","cosenza":"6456","coventry city":"8669","cracovia krakow":"2186","crawley town":"8647","crb":"104821","cremonese":"7801","crewe alexandra":"9784","criciuma":"7729","crotone":"9884","crown legacy fc":"1451868","crusaders":"1937","cruz azul":"6578","cruzeiro":"9781","crvena zvezda":"8687","crystal palace":"9826","crystal palace u18":"1267874","crystal palace u21":"1267874","cs sfaxien":"102106","csf balti":"8012","csikszereda miercurea ciuc":"583690","cska 1948 sofia":"10144","cska moskva":"9760","cska sofia":"10144","cuiaba":"197815","cukaricki":"6374","cultural leonesa":"1753","curzon ashton":"158390","cusco":"305171","dac":"103598","dacia-buiucani":"188151","daegu":"133897","daejeon citizen":"133900","dagenham & redbridge":"8009","dainava":"254228","dalian young boy":"1477043","dallas":"6399","danubio":"8562","darlington 1883":"8598","darmstadt 98":"8262","dartford":"161813","dc united":"6602","de graafschap":"8526","debrecen":"8369","defensa y justicia":"161730","defensor sporting":"7796","degerfors":"6544","delfin":"519457","den bosch":"9835","dender":"7947","deportes iquique":"162904","deportes limache":"584840","deportivo alaves":"9866","deportivo cali":"6387","deportivo cuenca":"4144","deportivo garcilaso":"920788","deportivo la coruna":"9783","deportivo la guaira":"176496","deportivo pasto":"4405","deportivo pereira":"4404","deportivo recoleta":"1427854","deportivo saprissa":"6607","deportivo tachira":"1896","derby county":"10170","derby county u18":"773680","derby county u21":"773680","derry city":"8338","dhamk":"582823","difaa el jadida":"102033","dijon":"9836","dila":"2217","dinamo batumi":"6193","dinamo bucuresti":"10271","dinamo city":"10027","dinamo moskva":"9763","dinamo tbilisi":"7755","dinamo zagreb":"10156","diosgyor":"2476","djurgarden":"9802","dobrudzha 1919":"10140","dolomiti bellunesi":"1295924","domzale":"8154","doncaster rovers":"9903","dordrecht":"6631","dorking wanderers":"580438","dover athletic":"4454","drogheda united":"8339","dukla praha":"88657","dundalk":"1853","dundee":"8284","dundee united":"9938","dunfermline athletic":"8457","dungannon swifts":"4615","dunkerque":"47214","durban city":"149599","dynamo dresden":"8480","dynamo kyiv":"8688","dynamo makhachkala":"1068353","dziugas telsiai":"624858","eastbourne borough":"6627","eastleigh":"161803","ebbsfleet united":"9794","egersund":"4722","egnatia rrogozhine":"10039","ehime":"162198","eibar":"8372","eindhoven":"6416","eintracht braunschweig":"9776","eintracht frankfurt":"9810","eintracht trier":"7774","el nacional":"6612","elche":"10268","eldense":"8288","elfsborg":"8014","elversberg":"8232","emelec":"1850","emmen":"6660","empoli":"8534","energie cottbus":"8398","enfield town":"282365","enkoping":"8425","enosis":"4126","envigado":"4402","epitsentr kamyanets-podilskyi":"1395678","erzgebirge aue":"8319","es tunis":"8153","esbjerg":"8285","esenler erokspor":"863838","eskilsminne":"303470","eskilstuna":"6238","espanyol":"8558","estoril":"7842","estrela amadora":"1074320","estudiantes":"10094","estudiantes de merida":"93061","ethnikos achnas":"8334","etoile carouge":"6366","etoile du sahel":"6366","eupen":"6351","europa":"189639","everton":"8668","everton u14":"773653","everton u18":"773653","everton u21":"773653","excelsior":"10218","exeter city":"9833","eyupspor":"4681","fagiano okayama":"164739","falkenberg":"6545","falkirk":"8596","famalicao":"1634","far rabat":"102035","farense":"6004","farnborough":"7954","farul constanta":"210132","fatih karagumruk":"2088","fc andorra":"494050","fc bocholt":"557692","fc kosice":"969268","fcs bucuresti":"9723","feirense":"4064","felgueiras 1932":"474326","fenerbahce":"8695","ferencvaros":"8222","ferroviaria":"581832","feyenoord":"10235","fh":"8151","finn harps":"1627","fiorentina":"8535","first vienna":"2030","fk auda":"2106","fk liepaja":"8016","fk metta":"197869","fk tukums 2000/telms":"197870","flamengo":"9770","flamurtari vlore":"10030","fleetwood town":"45723","fleury 91 fc":"238687","flint town united":"316297","flora":"8155","floridsdorfer ac":"8274","fluminense":"9863","foggia":"6466","forest green rovers":"9828","forli":"6071","fortaleza":"8287","fortuna dusseldorf":"8194","fortuna dusseldorf ii":"95052","fortuna koln":"7786","fortuna sittard":"6422","fram":"6291","francs borains":"96953","fredericia":"8454","fredrikstad":"8417","freiburg":"8358","freiburg ii":"6594","frosinone":"9891","fs jelgava":"192962","fsv frankfurt":"88885","fujieda myfc":"305776","fulham":"9879","fulham u18":"860801","fulham u21":"860801","fus rabat":"102036","fylde":"282396","gabes":"206148","gagra":"154186","gais":"8297","galatasaray":"8637","galway united":"520517","gamba osaka":"6582","gangwon":"164734","gareji":"1230631","gateshead":"6189","gaziantep":"4081","gefle":"7997","genclerbirligi":"7800","general caballero jlm":"1055181","genk":"9987","genk ii":"1378463","genoa":"10233","gent":"9991","gent ii":"1379188","getafe":"8305","giana erminio":"568741","gif sundsvall":"8359","gil vicente":"9764","gillingham":"10173","gimcheon sangmu":"133901","gimnastic tarragona":"8400","gimpo citizen":"833649","girona":"7732","giugliano":"6040","glenavon":"1956","glentoran":"2203","gnistan":"2361","go ahead eagles":"6433","goias":"9862","golden arrows":"102097","gorica":"206560","gornik zabrze":"8020","goztepe":"1925","granada":"7878","grasshopper":"9956","grazer ak":"10012","greenock morton":"8648","gremio":"9769","gremio novorizontino":"581838","grenoble":"9855","greuther furth":"8357","grimsby town":"10005","grobina":"662738","groningen":"8674","grorud":"4201","guabira":"114830","guadalajara":"7807","guadalupe":"855904","gualberto villarroel sj":"1504770","guarani":"1893","gubbio":"6061","guidonia montecelio":"1667898","guingamp":"9747","gutersloh":"6200","gwangju":"245905","gyeongnam":"133899","gyori eto":"5755","hacken":"8428","hajduk split":"10154","haka":"7870","halifax town":"10195","halmstad":"8310","hamburger sv":"9790","hamkam":"8448","hammarby":"8248","hammarby talang":"4438","hampton & richmond":"105552","hanacka":"2404","haninge":"628812","hannover 96":"9904","hansa rostock":"8294","hapoel acre":"426452","hapoel afula":"426452","hapoel be'er sheva":"9754","hapoel hadera":"857444","hapoel haifa":"8301","hapoel jerusalem":"459591","hapoel kfar saba":"6280","hapoel kfar shalem":"1177310","hapoel nof hagalil":"4125","hapoel petah tikva":"9755","hapoel raanana":"2096","hapoel ramat gan":"89753","hapoel rishon lezion":"1831","hapoel tel aviv":"10181","harju jk":"673053","harrogate town":"7946","hartberg":"10056","hartlepool united":"8488","hassania agadir":"102037","hassleholms if":"418688","hatayspor":"95749","haugesund":"8512","havelse":"89338","haverfordwest county":"2194","hb kge":"8289","hdd":"7937","hearts":"9860","hebburn town":"292923","hednesford town":"9923","heerenveen":"10228","hegelmann litauen":"736555","heidenheim":"94937","hellas verona":"9876","helmond sport":"6417","helsingborg":"9859","hemel hempstead town":"161831","henan":"51442","heracles":"9791","hercules":"10278","herediano":"49726","hereford fc":"799249","hermannstadt":"864269","hertha bsc":"8177","hessen kassel":"8253","hibernian":"10251","hillerd":"9940","hjk":"9861","hobro":"9950","hoffenheim":"8226","hoffenheim ii":"94940","holstein kiel":"8150","homburg":"1734","hornchurch":"4047","horsens":"9814","horsham":"105554","houston dynamo":"8259","houston dynamo ii":"1348104","hradec kralove":"1712","huachipato":"4056","huddersfield town":"9796","huesca":"96925","huntsville city":"1445755","huracan":"10081","husqvarna":"6119","hvidovre":"10240","hwaseong":"739800","hyde united":"161802","ia":"8004","iberia 1999":"480291","ibiza":"1123073","ibv":"8299","ifk goteborg":"9893","ifk norrkoping":"8449","ifk skovde":"610365","igdr fk":"1281818","ilves":"162146","imabari":"820969","imisli":"1786024","imt novi beograd":"568569","incheon united":"133895","independiente":"10078","independiente del valle":"192875","independiente petrolero":"958325","ingolstadt":"8234","inter miami":"960720","inter miami ii":"1348111","inter turku":"6550","internacional":"8702","internazionale":"8636","internazionale ii":"1790497","ipswich town":"9902","ipswich town u18":"1796115","ipswich town u21":"1796115","ironi kiryat shmona":"2095","ironi modi'in":"1691612","ironi tiberias":"543580","istanbul basaksehir":"1933","istanbulspor":"106560","istra 1961":"6038","ittihad tanger":"316657","iwaki":"860934","jablonec":"7758","jagiellonia biaystok":"1957","jahn regensburg":"7789","jaro":"8473","javor ivanjica":"2391","jef united":"9756","jeju sk":"133898","jeonbuk motors":"46038","jeonnam dragons":"109377","jeunesse sportive omrane":"1669235","jonkopings sodra":"8510","juan pablo ii college":"1573153","juarez":"649424","jubilo iwata":"8065","junior":"2254","juve stabia":"6106","juventud":"9883","juventud torremolinos":"371716","juventude":"10274","juventus":"9885","juventus next gen":"956184","ka":"2165","kairat":"8037","kairouan":"177179","kaisar":"2125","kaiserslautern":"8350","kaizer chiefs":"6279","kalmar":"9892","kapaz":"4150","kapfenberger sv":"9979","karlberg":"303472","karlsruher sc":"8295","karlstad":"627694","karpaty":"8691","karvan":"8045","karvina":"143833","kashima antlers":"4397","kashiwa reysol":"8699","kasmpasa":"4685","kataller toyama":"164737","katowice":"4023","kauno zalgiris":"439132","kawasaki frontale":"6304","kawkab marrakech":"102042","kayserispor":"10182","kazincbarcika":"2280","kbenhavn":"8391","kerry":"1426348","kfar kasem":"752833","kfum":"2305","khemis zemamra":"950070","kickers offenbach":"8407","kidderminster harriers":"10284","kifissia":"488099","kilmarnock":"8597","king's lynn town":"45731","kiryat yam":"1691614","kocaelispor":"1569","kolding if":"6308","kolkheti poti":"2218","koln":"8722","koln ii":"8459","kolos kovalivka":"599924","komarno":"611956","kongsvinger":"8179","konyaspor":"8622","koper":"5772","korona kielce":"8245","kortrijk":"8571","kr":"8130","krasnodar":"168719","kristiansund":"8605","krylya sovetov":"8709","kryvbas kr":"558259","ktp":"6701","kudrivka":"1763072","kups":"1693","kuressaare":"4146","kyoto sanga":"8542","kyzyl-zhar":"2120","la equidad":"47240","la louviere":"1218969","la serena":"1891","landskrona":"8511","lanus":"10082","larissa":"8120","larne":"2206","las palmas":"8306","lask":"9977","latina":"212660","lausanne sport":"7730","laval":"7853","lazio":"8543","ldu quito":"6721","le havre":"9746","le mans":"8682","le puy f.43 auvergne":"293257","leamington":"5764","lecce":"9888","lecco":"6512","lech poznan":"2182","lechia gdansk":"8030","leeds united":"8463","leeds united u17":"1177187","leeds united u18":"1177187","leeds united u21":"1177187","leganes":"7854","legia warszawa":"8673","leicester city":"8197","leicester city u18":"773642","leicester city u21":"773642","leixoes":"6421","lens":"8588","leon":"1841","levadia":"1588","levadiakos":"4493","levante":"8581","levski sofia":"8632","leyton orient":"8351","libertad":"1345405","liefering":"1915","liege":"6363","lierse kempenzonen":"465631","lille":"8639","lillestrm":"8476","lincoln city":"8430","linfield":"7971","liverpool":"8650","liverpool u17":"1070259","liverpool u18":"1070259","liverpool u19":"1070259","liverpool u21":"1070259","livingston":"8282","livorno":"8537","ljungskile":"8500","llanelli town":"8341","llaneros":"348397","lnz cherkasy":"2143","lokeren-temse":"213307","lokomotiv moskva":"8710","lokomotiv plovdiv":"10129","lokomotiv sofia 1929":"10128","lokomotiva zagreb":"175388","lommel sk":"6702","longford town":"4569","lorient":"8689","los angeles fc":"867280","los angeles galaxy":"6637","los angeles ii":"1451871","los chankas":"741328","ludogorets":"210173","lugano":"7896","lugo":"8206","lumezzane":"6452","lund":"6174","lusitania fc lourosa":"188154","luton town":"8346","luzern":"10199","lyn":"10224","lyngby":"9907","macara":"6609","macarthur":"1209973","maccabi bnei raina":"1121750","maccabi haifa":"10185","maccabi herzliya":"2097","maccabi kabilio jaffa":"196257","maccabi netanya":"1832","maccabi petah tikva":"9755","maccabi tel aviv":"7855","macclesfield town":"8599","machida zelvia":"194011","magdeburg":"8188","magesi":"429859","maghreb fes":"102043","maidenhead united":"45725","maidstone united":"8131","mainz 05":"9905","mainz 05 ii":"8397","malaga":"9864","mallorca":"8661","malmo ff":"10237","mamelodi sundowns":"4530","manchester city":"8456","manchester city u18":"860800","manchester city u19":"860800","manchester city u21":"860800","manchester united":"10260","manchester united u18":"1070257","manchester united u21":"1070257","manisa f.k.":"658812","mansfield town":"9818","manta":"162922","mantova":"9889","marbella":"161781","maribor":"8340","mariehamn":"6634","marine":"161816","maritimo":"10212","marsa":"102105","marumo gallants":"352390","mazatlan":"1170234","mechelen":"8203","medellin":"2528","meizhou hakka":"585808","melbourne city":"203576","melbourne victory":"6230","melgar":"4417","merida ad":"8317","merthyr town":"5762","metalist 1925 kharkiv":"949030","metaloglobus":"404509","metlaoui":"405958","metropolitanos":"365280","metz":"8550","middelfart":"9969","middlesbrough":"8549","middlesbrough u18":"773660","middlesbrough u21":"773660","midtjylland":"8113","milan":"8564","millonarios":"4403","millwall":"10004","milsami":"175682","milton keynes dons":"8645","minnesota united":"207242","minnesota united ii":"1348105","miramar misiones":"4424","mirandes":"4032","mirassol":"163782","mito hollyhock":"162195","mjallby":"8127","mjndalen":"6541","mlada boleslav":"10180","mladost lucani":"1739","modena":"9887","molde":"9917","monaco":"9829","monagas":"49683","monastir":"102109","monopoli":"189506","montana":"46475","montedio yamagata":"164720","monterrey":"7849","montpellier":"10249","monza":"6504","morecambe":"8489","moreirense":"8348","moss":"8405","motherwell":"9927","motor lublin":"89466","msv duisburg":"8293","mtk":"7778","municipal liberia":"210220","mura":"2172","mushuc runa":"304929","mvv":"9838","nac breda":"9761","nacional":"10214","nacional asuncion":"49689","nacional potosi":"164353","nagoya grampus":"8006","nancy":"8481","nantes":"9830","napoli":"9875","napredak krusevac":"6050","nashville sc":"915807","nec":"8464","necaxa":"1842","neftchi":"4617","neom":"1699505","neuchatel xamax":"7955","new england":"6580","new england ii":"1121686","new york city":"546238","new york city ii":"1348108","new york rb":"6514","new york rb ii":"614318","newcastle jets":"6454","newcastle united":"10261","newcastle united u18":"860798","newcastle united u19":"860798","newcastle united u21":"860798","newport county":"10262","nice":"9831","nieciecza":"177361","nizhny novgorod":"657508","noah":"866111","nomme kalju":"112484","nordsjlland":"10202","norrby":"2014","north texas":"1004921","northampton town":"8651","norwich city":"9850","norwich city u18":"773658","norwich city u21":"773658","nottingham forest":"10203","nottingham forest u14":"1389162","nottingham forest u18":"1389162","nottingham forest u21":"1389162","notts county":"9819","novara":"6269","novi pazar":"187854","nublense":"49559","nurnberg":"8165","nyiregyhaza spartacus":"2035","o'higgins":"6296","ob":"8414","obolon":"583129","oddevold":"6160","odds":"7988","ofi":"7753","ofk beograd":"8692","oh leuven":"1773","oita trinita":"4427","okzhetpes":"2128","oldham athletic":"9785","oleksandria":"6072","olimpia":"6619","olimpija":"7872","olympiacos piraeus":"8638","olympic":"241064","olympic charleroi":"4137","olympic safi":"102047","olympique beja":"102104","olympique dcheira":"570487","olympique lyonnais":"9748","olympique marseille":"8592","omonia aradippou":"8044","omonia nicosia":"8044","once caldas":"6024","opava":"1713","operario pr":"197429","orbit college":"915983","ordabasy":"2127","orebro":"8527","orebro syrianska":"8527","orenburg":"132286","orense":"1014174","orgryte":"10002","oriente petrolero":"1844","orlando city":"267810","orlando city b":"722266","orlando pirates":"7866","orleans":"47211","osasuna":"8371","osasuna promesas":"161778","osijek":"10157","oskarshamns aik":"2015","osnabruck":"9775","ospitaletto":"6494","oster":"8641","ostersunds fk":"2004","otelul":"9736","oulu":"4449","ourense cf":"7859","oxford city":"161836","oxford united":"8653","pachuca":"7848","pacos de ferreira":"6403","paderborn":"8460","paderborn ii":"657648","padova":"583944","pafos":"2137","paide":"163540","paksi fc":"7986","palermo":"8540","palestino":"6455","palmeiras":"10283","panathinaikos":"10200","panetolikos fc":"162386","panevezys":"479143","panserraikos":"104814","paok":"8619","pardubice":"2406","paris":"6379","paris 13 atletico":"238671","parma":"10167","parnu jk vaprus":"828265","partick thistle":"8426","partizan":"7998","partizani tirana":"10028","patro eisden":"274583","pau":"6355","paysandu":"6546","pec zwolle":"6413","penafiel":"6547","penarol":"8450","pendikspor":"95745","penybont":"474592","perez zeledon":"49730","pergolettese":"474521","perth glory":"7961","perugia":"8685","pescara":"9878","peterborough sports":"674289","peterborough united":"8677","petrocub":"561981","petrolul 52":"188187","philadelphia union":"191716","philadelphia union ii":"722264","pianese":"584069","piast gliwice":"8028","picerno":"674807","pineto":"770928","pisa":"6479","plaza colonia":"4669","plymouth argyle":"8401","podbrezova":"2437","pogon szczecin":"8023","pohang steelers":"109373","polissya":"1181312","politehnica utm":"1771526","polokwane city":"149600","ponferradina":"8005","pontedera":"145016","pontevedra":"7862","port vale":"9799","portadown":"7984","portimonense":"9765","portland timbers":"307690","portland timbers ii":"614322","porto":"9773","porto ii":"338304","portsmouth":"8462","portuguesa":"49682","posusje":"10111","potenza":"6099","prescot cables":"161828","preston north end":"8411","preuen munster":"8171","pribram":"1672","primorje":"2171","pro patria":"6498","pro vercelli":"189486","progreso":"1838","prostejov":"358094","psg":"9847","psv":"8640","psv ii":"455494","puebla":"7847","pumas unam":"1946","puntarenas":"9935","puskas fc":"355346","pyunik":"6345","qabala":"8076","qarabag":"7981","qingdao hainiu":"4183","qingdao west coast":"1283248","queen's park":"8235","queens park rangers":"10172","queretaro":"1943","quevilly rouen":"2517","racing":"6043","racing club":"10080","racing ferrol":"8474","racing santander":"8696","radcliffe fc":"282390","radnicki kragujevac":"1675","radnicki nis":"6410","radnik bijeljina":"10124","radnik surdulica":"463461","radomiak radom":"5769","radomlje":"272871","raith rovers":"10250","raja casablanca":"102049","rakow czestochowa":"4024","randers":"8410","rangers":"8548","ranheim":"6563","rapid bucuresti":"9738","rapid wien":"10015","rapid wien ii":"1952","rapperswil-jona":"185504","raufoss":"9812","ravenna":"8545","rayo vallecano":"8370","rayo zuliano":"1267963","rb leipzig":"178475","rb omiya ardija":"4398","reading":"9798","reading u18":"773686","reading u21":"773686","real aviles":"189594","real betis":"8603","real madrid":"8633","real madrid castilla":"189680","real monarchs":"614324","real murcia":"8392","real oruro":"1504766","real oviedo":"8670","real salt lake":"6606","real sociedad":"8560","real sociedad b":"161744","real tomayapo":"1074622","real valladolid":"10281","real zaragoza":"8394","red bull bragantino":"109705","red star":"6390","reggiana":"6500","reims":"9837","remo":"1626","renate":"177522","rennes":"9851","renofa yamaguchi":"614556","rfc seraing":"149408","rfs":"248871","rheindorf altach":"10008","richards bay":"866690","ried":"10017","riga fc":"624924","rijeka":"10162","rimini":"9886","rio ave":"7841","riteriai":"257518","river plate":"10076","rizespor":"2166","rkc waalwijk":"10219","roasso kumamoto":"162196","rochdale":"8493","roda jc":"9803","rodez":"4120","rodinghausen":"465376","roma":"8686","rosario central":"10084","rosenborg":"8422","rosengard":"6170","ross county":"8649","rostov":"8705","rot-wei oberhausen":"7782","rot-weiss essen":"8296","rotherham united":"8119","rouen":"8582","rsb berkane":"316652","rubin kazan'":"8683","rudar prijedor":"175797","rukh lviv":"859316","ruzomberok":"10186","rwd molenbeek":"9992","saarbrucken":"8271","sabadell":"4033","sabah":"951893","sagan tosu":"162193","saint-etienne":"9853","sakaryaspor":"4124","salernitana":"6480","salford city":"282326","salisbury":"1114695","salzburg":"10013","sambenedettese":"8482","samgurali":"316432","sampdoria":"9882","samsunspor":"9750","san antonio bulo bulo":"1297060","san carlos":"49728","san diego":"1701119","san lorenzo":"10083","sandefjord":"8609","sandhausen":"8086","sandviken":"6241","sanfrecce hiroshima":"6224","santa clara":"1567","santa fe":"7818","santos":"8514","santos laguna":"7857","sao paulo":"10277","sarajevo":"10105","sarpsborg 08":"8509","saryer":"2090","sassuolo":"7943","scarborough athletic":"580382","schalke 04":"10189","schalke 04 ii":"8198","schott mainz":"555501","schweinfurt":"7780","scunthorpe united":"8412","seattle sounders":"130394","sekhukhune united":"612014","seongnam":"6614","seoul":"92630","seoul e-land":"616212","septemvri sofia":"312976","serik belediyespor":"914196","servette":"9777","sevilla":"8302","sevilla atletico":"91431","sgv freiberg":"94935","shakhtar donetsk":"9728","shamakhi fk":"2103","shamrock rovers":"4131","shandong taishan":"8623","shanghai port":"198616","shanghai shenhua":"6628","sheffield united":"8657","sheffield wednesday":"10163","shelbourne":"5751","shenzhen peng city":"930027","sheriff":"9729","shimizu s-pulse":"4426","shonan bellmare":"6180","shrewsbury town":"9896","siauliai":"1099941","sigma olomouc":"6461","silkeborg":"8415","sint-truiden":"9997","sion":"10179","siracusa":"674812","sirius":"6694","siroki brijeg":"10112","sivasspor":"6265","siwelele football club":"102099","sj earthquakes":"6603","sjk":"162162","sk beveren":"8475","sk poltava":"1395689","sk super nova salaspils":"981193","skalica":"555292","skeid":"8421","skovde aik":"6153","slaven belupo":"1581","slavia praha":"7787","slavia praha ii":"7787","slavia sofia":"10134","sligo rovers":"6361","sloga doboj":"187928","slough town":"6432","slovacko":"2021","slovan bratislava":"6019","slovan liberec":"10245","snderjyske":"8487","sochaux":"9874","sochi":"195601","sogndal":"8616","solihull moors":"161801","sollentuna":"111120","sonnenhof groaspach":"94941","sorrento":"88998","south shields":"865163","southampton":"8466","southampton u18":"773645","southampton u21":"773645","southend united":"8652","southport":"10197","sparta praha":"10247","sparta praha ii":"132215","sparta rotterdam":"8614","spartak moskva":"8643","spartak subotica":"176525","spartak trnava":"4662","spartak varna":"10145","spartanii selemet":"771910","spennymoor town":"557101","spezia":"9881","sport boys":"4412","sport huancayo":"165148","sport recife":"6305","sportfreunde lotte":"95103","sportfreunde siegen":"9757","sporting braga":"10264","sporting cp":"9768","sporting cp ii":"338301","sporting cristal":"1848","sporting fc":"776638","sporting gijon":"9869","sporting kc":"6604","sporting kc ii":"722268","sportivo ameliano":"1242560","sportivo luqueno":"49687","sportivo trinidense":"59844","st. gallen":"10190","st. johnstone":"8467","st. louis city":"1427963","st. louis city ii":"1346404","st. mirren":"9800","st. patrick's ath.":"1854","st. pauli":"8152","st. polten":"1907","stabk":"9918","stade briochin":"685213","stade lausanne-ouchy":"289334","stade nyonnais":"2442","stade tunisien":"102116","standard liege":"9985","start":"9919","steinbach":"557592","stellenbosch fc":"207873","stevenage":"10253","stjarnan":"6343","stockholm inter":"1011931","stockport county":"10007","stocksund":"916701","stoke city":"10194","stoke city fc u15":"773650","stoke city u18":"773650","stoke city u21":"773650","strasbourg":"9848","stripfing":"611179","strmsgodset":"8180","sturm graz":"10014","sturm graz ii":"1921","stuttgart":"10269","stuttgart ii":"8458","stuttgarter kickers":"8195","sudtirol":"189475","suduva":"8337","sumqayt":"213987","sunderland":"8472","sunderland u17":"773657","sunderland u18":"773657","sunderland u21":"773657","sutton united":"158316","suwon":"187951","suwon bluewings":"88517","swansea city":"10003","swindon town":"9795","sydney":"10164","taborsko":"157007","tacoma defiance":"614327","talavera cf":"357239","tallinna kalev":"49578","tamworth":"10254","tarazona":"209196","tartu tammeka":"4147","tatran presov":"8010","team altamura":"867623","team thoren":"191427","tecnico universitario":"113054","telavi":"1168646","telstar":"6414","tenerife":"9867","teplice":"4721","ternana":"6457","teruel":"190091","teuta durres":"10037","the new saints":"7852","the strongest":"2527","the town":"1348115","thun":"10191","tianjin tigers":"4189","tigres uanl":"8561","tirana":"10029","tobol":"7983","tokushima vortis":"162199","tokyo":"4399","tokyo verdy":"6223","tolima":"1894","toluca":"6618","tonbridge angels":"161808","tondela":"188163","top oss":"7781","torino":"9804","toronto":"56453","toronto ii":"614319","torpedo kutaisi":"2216","torquay united":"10193","torque":"395613","torreense":"212820","torres":"7856","torslanda":"6162","tottenham hotspur":"8586","tottenham hotspur u18":"860802","tottenham hotspur u19":"860802","tottenham hotspur u21":"860802","toulouse":"9941","trabzonspor":"9752","tranmere rovers":"8313","trans":"2252","trapani":"208936","treaty united":"1233534","trelleborg":"8333","trencin":"6496","trento":"6097","triestina":"9872","trollhattan":"6183","troms":"8608","troyes":"10242","truro city":"177067","ts galaxy fc":"953498","turan turkistan":"1234149","turan-t":"4674","twente":"8611","ucd":"1578","ucv":"188213","ud oliveirense":"1785","udinese":"8600","ujpest":"8043","ulm":"8201","ulsan hyundai":"133896","ulytau":"1622701","umea":"8601","umranyespor":"281460","uniao de leiria":"9771","union berlin":"8149","union espanola":"7843","union la calera":"192435","union magdalena":"4408","union saint-gilloise":"7978","unionistas de salamanca":"780591","unirea slobozia":"364411","united nordic":"1144284","universidad catolica":"6458","universidad de chile":"6310","universitario":"4409","universitario de vinto":"879029","universitatea cluj":"89022","universitatea craiova":"480286","urartu":"7979","urawa reds":"6244","usti nad labem":"5733","uta arad":"584663","utc cajamarca":"425692","utrecht":"9908","utrecht ii":"278960","uts rabat":"320835","utsikten":"73158","v-varen nagasaki":"194016","vaduz":"9824","valencia":"10267","valenciennes":"9873","valerenga":"8007","valur":"8064","vancouver whitecaps":"307691","vancouver whitecaps ii":"614326","vanspor fk":"146408","varazdin":"10165","varbergs":"6692","varda se":"465382","varnamo":"6181","vasalund":"1967","vasco da gama":"10276","vasteras sk":"6194","vegalta sendai":"162192","vejle":"8231","velbert":"2564","velez":"10122","velez sarsfield":"10079","venezia":"7881","ventforet kofu":"8539","ventura county":"521005","veres":"1175395","verl":"7783","versailles":"191111","vestri":"750462","viborg":"9939","vicenza":"145007","viking":"8478","vikingur reykjavik":"6017","viktoria koln":"276267","viktoria plzen":"6033","viktoria zizkov":"6096","vila nova":"109706","villarreal":"10205","villarreal b":"161771","villefranche":"161694","vinotinto de ecuador":"1446544","virtus entella":"208932","virtus verona":"474519","vis pesaro":"6049","vissel kobe":"4688","vitesse":"8277","vitoria":"7733","vitoria guimaraes":"7844","vizela":"4531","vlasim":"175807","vllaznia shkoder":"10034","vojvodina":"6406","volendam":"6601","volos nfc":"885256","volta redonda":"198135","vora":"585403","vps":"6597","vukovar":"45228","vvv venlo":"9839","vysocina jihlava":"1949","waldhof mannheim":"9743","walsall":"10006","wanderers":"7863","waterford fc":"6042","watford":"9817","wealdstone":"161812","wehen wiesbaden":"8196","wellington phoenix":"78785","werder bremen":"8697","west bromwich albion":"8659","west bromwich albion u18":"773656","west bromwich albion u21":"773656","west ham united":"8654","west ham united u14":"773649","west ham united u18":"773649","west ham united u21":"773649","westerlo":"10001","western sydney wanderers":"323834","weston-super-mare":"6314","wexford":"62337","widzew odz":"8024","wiedenbruck":"95106","wigan athletic":"8528","wil":"10175","willem ii":"8525","wilstermann":"1892","wimborne town":"282358","winterthur":"7894","wisa pock":"8243","woking":"8345","wolfsberger ac":"1954","wolfsburg":"8721","wolverhampton wanderers":"8602","wolverhampton wanderers u18":"773683","wolverhampton wanderers u21":"773683","worksop town":"9894","worthing":"282351","wrexham":"9841","wsg swarovski tirol":"1583","wspg wels":"946908","wuhan three towns":"1029687","wuppertaler sv":"8142","wycombe wanderers":"8676","wydad casablanca":"102050","yacoub el mansour":"1786714","yaracuyanos":"176495","yelimay semey":"200281","yeovil town":"10198","yokohama":"49615","yokohama f. marinos":"6581","york city":"9916","young boys":"10192","ypsonas":"1075325","yunnan yukun":"1477056","yverdon sport":"6447","zagebie lubin":"8021","zalaegerszegi te":"1667","zalgiris":"4616","zamora":"4031","zarzis":"102112","zbrojovka brno":"1673","zeleznicar pancevo":"676141","zeljeznicar":"10108","zemplin michalovce":"9899","zenit":"8698","zhejiang professional":"51443","zhenys":"1614087","zhetysu":"2118","zilina":"6022","zimbru":"8039","zira":"577619","zlin":"1860","zorya":"7770","zrinjski":"10107","zulte-waregem":"10000","zurich":"10243","Águilas Doradas":"193025","Ängelholm":"8189","Åsane":"10021","Çorum FK":"357274","Étoile Carouge":"6366","ÍA":"8004","ÍBV":"8299","Ñublense":"49559","Örebro":"8527","Örebro Syrianska":"8527","Örgryte":"10002","Öster":"8641","Östersunds FK":"2004","Újpest":"8043","Ústí nad Labem":"5733","Ümranıyespor":"281460","České Budějovice":"7840","Čukarički":"6374","İmişli":"1786024","İstanbul Başakşehir":"1933","İstanbulspor":"106560","Šiauliai":"1099941","Široki Brijeg":"10112","Žalgiris":"4616","Železničar Pancevo":"676141","Željezničar":"10108","Žilina":"6022"};
function teamCrest(name) {
  const id = TEAM_FOTMOB_MAP[name] || TEAM_FOTMOB_MAP[String(name).toLowerCase()];
  return id ? `${CREST_BASE}${id}.png` : '';
}

const ALL_ATTRIBUTES = ['Possession', 'Pressing', 'Long Ball', 'Attacking', 'Short Passing', 'Transitional', 'Vertical'];

// Distinct color per style archetype — same map duplicated in TeamCard.js.
const STYLE_COLORS = {
  'Possession-Pressing Based': { bg: '#0e2040', color: '#60a5fa' },
  'Possession Based': { bg: '#0a2e33', color: '#22d3ee' },
  'Vertical Possession Approach': { bg: '#1e1b4b', color: '#818cf8' },
  'Pressing': { bg: '#3a1a05', color: '#fb923c' },
  'Long Ball Style': { bg: '#3a2a05', color: '#fbbf24' },
  'Effective-Structured': { bg: '#0a2e17', color: '#4ade80' },
  'Balanced Style': { bg: '#1e293b', color: '#94a3b8' },
  'Mixed': { bg: '#2e1065', color: '#c084fc' },
  'Low Block': { bg: '#3a0a0a', color: '#f87171' },
  'No Defined Style': { bg: '#1e2d45', color: '#64748b' },
};
function styleColor(label) {
  return STYLE_COLORS[label] || { bg: '#0e1e38', color: '#93c5fd' };
}

const STYLE_KEYS = ['attack', 'defence', 'possession', 'pressing'];
const STYLE_LABELS = { attack: 'Attacking', defence: 'Defence', possession: 'Possession', pressing: 'Pressing' };
const SCORE_MODES = ['Overall', 'Attack', 'Defence', 'Possession', 'Pressing'];
const IMPROVED_MODES = ['Overall', 'Raw Overall', 'Attack', 'Defence', 'Possession', 'Pressing'];
// Field on each team row used for each improved mode
const IMPROVED_FIELD = { Overall: 'completeScore', 'Raw Overall': 'overall', Attack: 'attack', Defence: 'defence', Possession: 'possession', Pressing: 'pressing' };
const DECAY = 0.45; // matches build_players.py's recency decay for the "weighted avg" season mode

const T = {
  layout: { display: 'flex', gap: 0, minHeight: '100vh', background: '#0a0e17', color: '#e2e8f4', fontFamily: 'system-ui,-apple-system,sans-serif' },
  sb: { width: 260, flexShrink: 0, borderRight: '1px solid #1e2d45', padding: 14, overflowY: 'auto', maxHeight: '100vh', boxSizing: 'border-box' },
  // Drawer: off to one side of the viewport rather than in the flex row, so the table
  // gets the full width instead of the ~130px the fixed sidebar used to leave it.
  sbMobile: { position: 'fixed', top: 0, left: 0, bottom: 0, width: '86vw', maxWidth: 330,
              zIndex: 60, background: '#0a0e17', borderRight: '1px solid #1e2d45',
              padding: 14, overflowY: 'auto', boxSizing: 'border-box',
              boxShadow: '0 0 40px rgba(0,0,0,.6)' },
  scrim: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 55 },
  main: { flex: 1, padding: 14, overflowX: 'auto' },
  mainMobile: { flex: 1, padding: 10, minWidth: 0, boxSizing: 'border-box' },
  // Card list replaces the table: a 10-column table cannot be read on a phone, and
  // horizontal scrolling hides the columns that matter.
  card: { background: '#0d1220', border: '1px solid #1a2740', borderRadius: 10,
          padding: 11, marginBottom: 8 },
  cardTop: { display: 'flex', alignItems: 'center', gap: 9 },
  cardStat: { display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 44 },
  fabBtn: { position: 'fixed', left: 12, bottom: 16, zIndex: 50, padding: '11px 16px',
            borderRadius: 22, border: '1px solid #26456f', background: '#12203a',
            color: '#dbeafe', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(0,0,0,.5)' },
  fg: { marginBottom: 14 },
  fl: { fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 4 },
  sel: { width: '100%', background: '#0d1220', border: '1px solid #1e2d45', borderRadius: 5, color: '#e2e8f4', padding: '6px 7px', outline: 'none', fontSize: 11.5, cursor: 'pointer' },
  cr: { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: 6 },
  cb: (on) => ({ width: 14, height: 14, borderRadius: 3, border: `1px solid ${on ? '#3b7de8' : '#334155'}`, background: on ? '#3b7de8' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }),
  cl: (on) => ({ fontSize: 11, color: on ? '#e2e8f4' : '#94a3b8' }),
  dv: { height: 1, background: '#1e2d45', margin: '10px 0' },
  statsBar: { padding: '10px 16px', background: '#0a0d18', borderBottom: '1px solid #1e2d45', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  statsBarMobile: { padding: '9px 10px', background: '#0a0d18', borderBottom: '1px solid #1e2d45',
                    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  sortRowMobile: { display: 'flex', gap: 6, overflowX: 'auto', padding: '8px 10px',
                   WebkitOverflowScrolling: 'touch' },
  si: { display: 'flex', flexDirection: 'column', gap: 1 },
  sv: { fontSize: 16, fontWeight: 800, color: '#f1f5f9', lineHeight: 1 },
  sl2: { fontSize: 8, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' },
  sdv: { width: 1, height: 22, background: '#1e2d45' },
  tw: { flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch' },
  tbl: { width: '100%', borderCollapse: 'collapse', minWidth: 960 },
  th_: { position: 'sticky', top: 0, zIndex: 10, background: '#0a0d18' },
  th: { padding: '7px 10px', textAlign: 'left', fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid #1e2d45', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' },
  tha: { color: '#60a5fa' },
  td: { padding: '8px 10px', borderBottom: '1px solid #0d1525', fontSize: 11.5, color: '#e2e8f4', whiteSpace: 'nowrap', verticalAlign: 'middle' },
  es: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: '#64748b', gap: 8 },
};

function Th({ col, label, sort, onSort }) {
  const a = sort.col === col;
  return <th style={{ ...T.th, ...(a ? T.tha : {}) }} onClick={() => onSort(col)}>{label}{a ? (sort.asc ? ' ↑' : ' ↓') : ''}</th>;
}

function scoreColor(v) {
  if (v == null) return '#475569';
  if (v >= 80) return '#00bf63';
  if (v >= 65) return '#22c55e';
  if (v >= 50) return '#fbc701';
  if (v >= 35) return '#f18c31';
  return '#ef4444';
}

// Viewport check lives in utils.js so there is exactly one definition of what "mobile"
// means. A second local copy here drifted out of sync the moment the pointer:coarse
// guard was added, which would have left TeamIndex flipping to phone layout on desktop
// zoom while every other tab stayed put.

export default function TeamIndex({ players = [] }) {
  const isMobile = useIsMobile();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selTeam, setSelTeam] = useState(null);
  const [showCoaches, setShowCoaches] = useState(false);
  const [reportTeam, setReportTeam] = useState(null); // Team All-in-One report (TeamReport.js)

  useEffect(() => {
    fetch('/teams_final.json').then(r => r.ok ? r.json() : []).catch(() => [])
      .then(data => { setAll(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Avg squad xValue per team+league — not in teams_final.json (that's built purely from the
  // team CSV), so computed here by grouping the already-loaded player data by team+league.
  // Player leagues use the '.' format ('England 1.'); team rows don't ('England 1') — same
  // normLeague() mismatch handled everywhere else in this file.
  const xValueByTeam = useMemo(() => {
    const sums = {};
    for (const p of players) {
      if (!p.xValue) continue;
      const key = String(p.team).toLowerCase() + '|' + normLeague(p.league);
      if (!sums[key]) sums[key] = { sum: 0, n: 0 };
      sums[key].sum += p.xValue;
      sums[key].n += 1;
    }
    const out = {};
    for (const key in sums) out[key] = sums[key].sum / sums[key].n;
    return out;
  }, [players]);
  const getAvgXValue = (team, league) => xValueByTeam[String(team).toLowerCase() + '|' + normLeague(league)] ?? null;

  // Total squad market value per team (sum of all players' marketValue in that team)
  const totalMVByTeam = useMemo(() => {
    const sums = {};
    for (const p of players) {
      if (!p.marketValue || p.marketValue <= 0) continue;
      const key = String(p.team).toLowerCase() + '|' + normLeague(p.league);
      sums[key] = (sums[key] || 0) + p.marketValue;
    }
    return sums;
  }, [players]);
  const getTotalMV = (team, league) => totalMVByTeam[String(team).toLowerCase() + '|' + normLeague(league)] ?? null;

  const [search, setSearch] = useState('');
  const [scoreMode, setScoreMode] = useState('Overall');
  const [styleFilters, setStyleFilters] = useState(new Set());
  const [attrFilters, setAttrFilters] = useState(new Set());
  const [rawMode, setRawMode] = useState(false); // "Raw Score (Not League Weighted)" — only affects Overall mode, see note below
  const [minScore, setMinScore] = useState(40);
  const [minStyleScore, setMinStyleScore] = useState(40);

  const allSeasons = useMemo(() => [...new Set(all.map(t => t.season))].sort().reverse(), [all]);
  const [season, setSeason] = useState('latest'); // 'latest' | specific season string | 'weighted'

  const [activePreset, setActivePreset] = useState('');
  const [activeBands, setActiveBands] = useState(new Set());
  const [activeRegions, setActiveRegions] = useState(new Set());
  const [leagues, setLeagues] = useState(new Set(DEFAULT_LEAGUES));
  const [showHidden, setShowHidden] = useState(false);
  const [showYouth, setShowYouth] = useState(false);
  const [lsMin, setLsMin] = useState(0);
  const [lsMax, setLsMax] = useState(101);

  const [metricFilters, setMetricFilters] = useState([]); // [{key,label,min,max,mode}] — mode: 'pct'|'raw'; key prefix 'mg:Group:Name' for metricGroups
  const METRIC_OPTIONS = [
    { key: 'completeScore', label: 'Overall Score', group: 'Scores', isPct: true },
    { key: 'attack',        label: 'Attack',        group: 'Scores', isPct: true },
    { key: 'defence',       label: 'Defence',       group: 'Scores', isPct: true },
    { key: 'possession',    label: 'Possession',    group: 'Scores', isPct: true },
    { key: 'pressing',      label: 'Pressing',      group: 'Scores', isPct: true },
    // Attack metrics — stored in metricGroups.Attack as [name, pct, raw]
    { key: 'mg:Attack:Crosses',       label: 'Crosses',       group: 'Attack',     isPct: true },
    { key: 'mg:Attack:Goals Scored',  label: 'Goals Scored',  group: 'Attack',     isPct: true },
    { key: 'mg:Attack:xG',            label: 'xG',            group: 'Attack',     isPct: true },
    { key: 'mg:Attack:Shots',         label: 'Shots',         group: 'Attack',     isPct: true },
    { key: 'mg:Attack:Shooting %',    label: 'Shooting %',    group: 'Attack',     isPct: true },
    { key: 'mg:Attack:Touches in Box',label: 'Touches in Box',group: 'Attack',     isPct: true },
    // Defence metrics
    { key: 'mg:Defence:Goals Against',        label: 'Goals Against',        group: 'Defence', isPct: true },
    { key: 'mg:Defence:xG Against',           label: 'xG Against',           group: 'Defence', isPct: true },
    { key: 'mg:Defence:Aerial Duels',         label: 'Aerial Duels',         group: 'Defence', isPct: true },
    { key: 'mg:Defence:Aerial Duel Success %',label: 'Aerial Duel Success %', group: 'Defence', isPct: true },
    { key: 'mg:Defence:Defensive Duels',      label: 'Defensive Duels',      group: 'Defence', isPct: true },
    { key: 'mg:Defence:Defensive Duel Win %', label: 'Defensive Duel Win %', group: 'Defence', isPct: true },
    { key: 'mg:Defence:Shots Against',        label: 'Shots Against',        group: 'Defence', isPct: true },
    { key: 'mg:Defence:PPDA',                 label: 'PPDA (def)',            group: 'Defence', isPct: true },
    // Possession metrics
    { key: 'mg:Possession:Possession',         label: 'Possession %',         group: 'Possession', isPct: true },
    { key: 'mg:Possession:Passes',             label: 'Passes',               group: 'Possession', isPct: true },
    { key: 'mg:Possession:Passing Accuracy %', label: 'Passing Accuracy %',   group: 'Possession', isPct: true },
    { key: 'mg:Possession:Long Passes',        label: 'Long Passes',          group: 'Possession', isPct: true },
    { key: 'mg:Possession:Long Passing %',     label: 'Long Passing %',       group: 'Possession', isPct: true },
    { key: 'mg:Possession:Passes to Final 3rd',label: 'Passes to Final 3rd',  group: 'Possession', isPct: true },
    { key: 'mg:Possession:Progressive Passes', label: 'Progressive Passes',   group: 'Possession', isPct: true },
    { key: 'mg:Possession:Progressive Runs',   label: 'Progressive Runs',     group: 'Possession', isPct: true },
    { key: 'mg:Possession:Dribbles',           label: 'Dribbles',             group: 'Possession', isPct: true },
    // Pressing
    { key: 'mg:Pressing:PPDA',  label: 'PPDA (pressing)', group: 'Pressing', isPct: true },
    // Raw stats
    { key: 'points',         label: 'Points',          group: 'Stats' },
    { key: 'expectedPoints', label: 'Expected Points', group: 'Stats' },
    { key: 'goalsFor',       label: 'Goals For',       group: 'Stats' },
    { key: 'goalsAgainst',   label: 'Goals Against',   group: 'Stats' },
    { key: 'avgAge',         label: 'Avg Age',         group: 'Stats' },
    { key: 'wins',           label: 'Wins',            group: 'Stats' },
    { key: 'draws',          label: 'Draws',           group: 'Stats' },
    { key: 'losses',         label: 'Losses',          group: 'Stats' },
  ];
  // Helper: resolve a metric filter value from a team row
  const resolveMetricVal = (t, mf) => {
    if (!mf.key) return null;
    if (mf.key.startsWith('mg:')) {
      const [, grp, name] = mf.key.split(':').map((s, i) => i === 0 ? s : s); // 'mg', group, name
      // key is 'mg:Group:Metric Name' — split carefully (name may contain colons never, but be safe)
      const parts = mf.key.slice(3).split(':'); // ['Attack', 'xG'] or ['Possession', 'Passes to Final 3rd']
      const group = parts[0];
      const metricName = parts.slice(1).join(':');
      const metrics = t.metricGroups?.[group];
      if (!metrics) return null;
      const row = metrics.find(m => m[0] === metricName);
      if (!row) return null;
      return mf.mode === 'raw' ? row[2] : row[1]; // [name, pct, rawVal]
    }
    return t[mf.key];
  };

  const [mostImproved, setMostImproved] = useState(false);
  const [improvedMode, setImprovedMode] = useState('Overall');

  const [minMVPerf, setMinMVPerf] = useState(null); // null = no filter; number = show teams with mvPerf >= this
  const [sort, setSort] = useState({ col: 'score', asc: false });
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    if (activePreset && PRESET_LEAGUES[activePreset]) setLeagues(new Set(PRESET_LEAGUES[activePreset]));
  }, [activePreset]);

  // Build one row per TEAM (grouping by team+league across seasons), resolving each row's
  // display record according to the Season control: a specific season's row directly, the
  // most recent season available, or a recency-weighted average across all seasons on file
  // (DECAY=0.45, same rate as player career scoring) — skipping nulls per-field so gaps like
  // the Spain 1 PPDA issue don't silently corrupt an average.
  const resolved = useMemo(() => {
    if (season !== 'weighted') {
      if (season === 'latest') {
        const byTeam = {};
        for (const t of all) {
          const key = t.team + '|' + teamCountry(t.league); // team+country — merges promotion/relegation (same country) but NOT unrelated clubs sharing a name across countries
          if (!byTeam[key] || t.season > byTeam[key].season) byTeam[key] = t;
        }
        return Object.values(byTeam);
      }
      return all.filter(t => t.season === season);
    }
    // weighted mode
    const byTeam = {};
    for (const t of all) {
      const key = t.team + '|' + teamCountry(t.league); // team+country — same fix as latest mode above
      (byTeam[key] = byTeam[key] || []).push(t);
    }
    const NUMERIC = ['completeScore', 'overall', 'attack', 'defence', 'possession', 'pressing', 'points', 'expectedPoints', 'goalsFor', 'goalsAgainst', 'avgAge', 'wins', 'draws', 'losses', 'matches'];
    const out = [];
    for (const key in byTeam) {
      const rows = byTeam[key].sort((a, b) => a.season < b.season ? -1 : 1); // oldest -> newest
      const latest = rows[rows.length - 1];
      const merged = { team: rows[0].team, league: latest.league, season: 'All (weighted)', attributes: latest.attributes, style: latest.style, similarTeams: latest.similarTeams };
      for (const field of NUMERIC) {
        let wsum = 0, vsum = 0;
        rows.forEach((r, i) => {
          const v = r[field];
          if (v == null) return;
          const posFromEnd = rows.length - 1 - i;
          const w = Math.exp(-DECAY * posFromEnd);
          wsum += w; vsum += v * w;
        });
        merged[field] = wsum > 0 ? Math.round((vsum / wsum) * 10) / 10 : null;
      }
      out.push(merged);
    }
    return out;
  }, [all, season]);

  const getDisplayScore = (t) => {
    if (scoreMode === 'Overall') return rawMode ? t.overall : t.completeScore;
    return t[scoreMode.toLowerCase()];
  };

  // £ Performance: within each league rank teams by total squad MV, compare to pointsRank.
  // Positive = outperforming market value (1st in table, 5th by MV = +4).
  const mvPerfByTeam = useMemo(() => {
    const byLeague = {};
    for (const t of resolved) {
      if (!byLeague[t.league]) byLeague[t.league] = [];
      byLeague[t.league].push(t);
    }
    const out = {};
    for (const league of Object.keys(byLeague)) {
      const teams = byLeague[league];
      const withMV = teams
        .map(t => ({ t, mv: getTotalMV(t.team, t.league) }))
        .filter(x => x.mv != null && x.t.pointsRank != null);
      if (withMV.length < 2) continue;
      withMV.sort((a, b) => b.mv - a.mv);
      withMV.forEach(({ t }, i) => {
        const key = String(t.team).toLowerCase() + '|' + normLeague(t.league);
        out[key] = (i + 1) - t.pointsRank; // positive = overperforming (low MV rank vs high table position)
      });
    }
    return out;
  }, [resolved, totalMVByTeam]);
  const getMVPerf = (team, league) => mvPerfByTeam[String(team).toLowerCase() + '|' + normLeague(league)] ?? null;
  // previous season. Uses (prev_ls / curr_ls) as a division-change correction factor so:
  //   - promoted teams (curr_ls > prev_ls) get their delta multiplied UP (they improved in harder context)
  //   - relegated teams (curr_ls < prev_ls) get their delta multiplied DOWN (easier context)
  //   - same-league teams get factor ~1.0 (no adjustment)
  // Only meaningful in 'latest' season mode — returns empty map otherwise.
  const [sameDivOnly, setSameDivOnly] = useState(false);

  const improvementMap = useMemo(() => {
    const map = {};
    if (season !== 'latest' || !mostImproved) return map;

    // Build a lookup of ALL seasons per team (team+country key, same as resolved)
    const byTeam = {};
    for (const t of all) {
      const key = t.team + '|' + teamCountry(t.league);
      (byTeam[key] = byTeam[key] || []).push(t);
    }

    for (const t of resolved) {
      const key = t.team + '|' + teamCountry(t.league);
      const rows = (byTeam[key] || []).sort((a, b) => a.season < b.season ? -1 : 1);
      if (rows.length < 2) { map[key] = null; continue; }

      const curr = rows[rows.length - 1];
      const prev = rows[rows.length - 2];

      const currDot = toDotLeague(curr.league);
      const prevDot = toDotLeague(prev.league);
      const sameDiv = currDot === prevDot;

      // Sub-scores (attack/defence/possession/pressing) are raw within-league percentiles —
      // they reset completely when a team changes division, making cross-division deltas
      // meaningless (a relegated team jumps from 5th→95th pct naturally = +90 raw).
      // For division-changers, fall back to completeScore which IS cross-league comparable —
      // UNLESS the user explicitly chose Raw Overall, in which case use overall as-is.
      const isRawOverall = improvedMode === 'Raw Overall';
      const field = sameDiv || isRawOverall ? (IMPROVED_FIELD[improvedMode] || 'completeScore') : 'completeScore';
      const currVal = curr[field];
      const prevVal = prev[field];
      if (currVal == null || prevVal == null) { map[key] = null; continue; }

      let delta = currVal - prevVal;

      // For division-changers using completeScore: apply league-strength correction.
      // Raw Overall mode: no correction — user explicitly wants the unweighted number.
      if (!sameDiv && !isRawOverall) {
        const currLs = LEAGUE_STRENGTHS[currDot] || 50;
        const prevLs = LEAGUE_STRENGTHS[prevDot] || 50;
        // promoted (currLs > prevLs): multiply UP — same completeScore in harder league = real improvement
        // relegated (currLs < prevLs): multiply DOWN — same completeScore in easier league = regression
        delta = delta * (currLs / prevLs);
      }

      map[key] = { delta, rawDelta: currVal - prevVal, sameDiv, prevSeason: prev.season, prevLeague: prev.league, prevVal, currVal, fieldUsed: field };
    }
    return map;
  }, [all, resolved, season, mostImproved, improvedMode]);

  const getImprovement = (t) => {
    const key = t.team + '|' + teamCountry(t.league);
    return improvementMap[key] ?? null;
  };

  const filtered = useMemo(() => {
    return resolved.filter(t => {
      if (search && !t.team.toLowerCase().includes(search.toLowerCase())) return false;
      const dotLeague = toDotLeague(t.league);
      if (!leagues.has(dotLeague)) return false;
      if (!showHidden && HIDDEN_LEAGUES.has(dotLeague)) return false;
      if (!showYouth && YOUTH_LEAGUES.has(dotLeague)) return false;
      if (activeBands.size > 0 && !activeBands.has(leagueToBand(dotLeague))) return false;
      if (activeRegions.size > 0 && !activeRegions.has(leagueToRegion(dotLeague))) return false;
      const ls = LEAGUE_STRENGTHS[dotLeague] || 0;
      if (ls < lsMin || ls > lsMax) return false;
      const ds = getDisplayScore(t);
      if (ds == null || ds < minScore) return false;
      if (styleFilters.size > 0) {
        const matches = [...styleFilters].some(s => (t[s] || 0) >= minStyleScore);
        if (!matches) return false;
      }
      if (attrFilters.size > 0) {
        const teamAttrs = t.attributes || [];
        for (const a of attrFilters) {
          if (!teamAttrs.includes(a)) return false;
        }
      }
      for (const mf of metricFilters) {
        if (!mf.key) continue;
        const v = resolveMetricVal(t, mf);
        if (v == null || v < mf.min || v > mf.max) return false;
      }
      // Same division filter
      if (mostImproved && season === 'latest' && sameDivOnly) {
        const imp = improvementMap[t.team + '|' + teamCountry(t.league)];
        if (!imp || !imp.sameDiv) return false;
      }
      // £ Performance filter
      if (minMVPerf !== null) {
        const perf = getMVPerf(t.team, t.league);
        if (perf == null || perf < minMVPerf) return false;
      }
      return true;
    });
  }, [resolved, search, leagues, showHidden, showYouth, activeBands, activeRegions, lsMin, lsMax, scoreMode, rawMode, minScore, styleFilters, minStyleScore, attrFilters, metricFilters, mostImproved, season, sameDivOnly, improvementMap, minMVPerf, mvPerfByTeam]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (mostImproved && season === 'latest') {
      // Sort by adjusted improvement delta desc; teams with no prior season sink to bottom
      arr.sort((a, b) => {
        const ai = getImprovement(a);
        const bi = getImprovement(b);
        const av = ai != null ? ai.delta : -Infinity;
        const bv = bi != null ? bi.delta : -Infinity;
        return bv - av;
      });
      return arr;
    }
    arr.sort((a, b) => {
      let av, bv;
      if (sort.col === 'score' || sort.col === 'overall') { av = getDisplayScore(a); bv = getDisplayScore(b); }
      else if (sort.col === 'avgXValue') { av = getAvgXValue(a.team, a.league); bv = getAvgXValue(b.team, b.league); }
      else if (sort.col === 'totalMV') { av = getTotalMV(a.team, a.league); bv = getTotalMV(b.team, b.league); }
      else if (sort.col === 'mvPerf') { av = getMVPerf(a.team, a.league); bv = getMVPerf(b.team, b.league); }
      else { av = a[sort.col]; bv = b[sort.col]; }
      av = av ?? (sort.col === 'mvPerf' ? -Infinity : sort.asc ? Infinity : -Infinity);
      bv = bv ?? (sort.col === 'mvPerf' ? -Infinity : sort.asc ? Infinity : -Infinity);
      if (typeof av === 'string') return sort.asc ? av.localeCompare(bv) : bv.localeCompare(av);
      return sort.asc ? av - bv : bv - av;
    });
    return arr;
  }, [filtered, sort, scoreMode, rawMode, xValueByTeam, mostImproved, improvedMode, improvementMap]);

  const onSort = (col) => setSort(p => p.col === col ? { col, asc: !p.asc } : { col, asc: false });
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (loading) return <div style={{ padding: 40, color: '#94a3b8' }}>Loading teams…</div>;

  return (
    <div style={T.layout}>
      {/* On mobile the drawer is only mounted when open, so its inputs can't be
          tabbed into or read out while it is hidden. */}
      {isMobile && filtersOpen && (
        <div style={T.scrim} onClick={() => setFiltersOpen(false)} />
      )}
      {(!isMobile || filtersOpen) && (
      <aside style={isMobile ? T.sbMobile : T.sb}>
        {isMobile && (
          <button onClick={() => setFiltersOpen(false)}
            style={{ width: '100%', marginBottom: 12, padding: '9px 0', borderRadius: 7,
                     border: '1px solid #26456f', background: '#12203a', color: '#dbeafe',
                     fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Done</button>
        )}
        <div style={{ ...T.fg, display: 'flex', gap: 6 }}>
          <button onClick={() => setShowCoaches(true)} style={{ flex: 1, padding: '6px 10px', borderRadius: 5, border: '1px solid #1e2d45', background: 'transparent', color: '#93c5fd', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>👔 Coaches</button>
        </div>
        <div style={T.fg}>
          <input placeholder="Team…" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
            style={{ width: '100%', background: '#0d1220', border: '1px solid #1e2d45', borderRadius: 5, padding: '6px 8px', color: '#e2e8f4', fontSize: 12, outline: 'none' }} />
        </div>
        <div style={T.dv} />

        <div style={T.fg}>
          <span style={T.fl}>Scoring Mode</span>
          <select style={T.sel} value={scoreMode} onChange={e => { setScoreMode(e.target.value); setPage(0); }}>
            {SCORE_MODES.map(m => <option key={m}>{m}</option>)}
          </select>
        </div>

        <div style={T.fg}>
          <span style={T.fl}>Filter by Style (select multiple)</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {STYLE_KEYS.map(k => {
              const active = styleFilters.has(k);
              return (
                <button key={k} onClick={() => { setStyleFilters(prev => { const n = new Set(prev); active ? n.delete(k) : n.add(k); return n; }); setPage(0); }}
                  style={{ padding: '3px 8px', borderRadius: 10, border: `1px solid ${active ? '#3b7de8' : '#1e2d45'}`, background: active ? '#0e2040' : 'transparent', color: active ? '#60a5fa' : '#64748b', fontSize: 9.5, fontWeight: active ? 700 : 400, cursor: 'pointer' }}>
                  {STYLE_LABELS[k]}
                </button>
              );
            })}
          </div>
          {styleFilters.size > 0 && (
            <div style={{ marginTop: 6 }}>
              <span style={T.fl}>Min style score: <strong style={{ color: '#60a5fa' }}>{minStyleScore}</strong></span>
              <input type="range" min={0} max={100} value={minStyleScore} onChange={e => { setMinStyleScore(Number(e.target.value)); setPage(0); }} style={{ width: '100%', accentColor: '#3b7de8' }} />
            </div>
          )}
        </div>

        <div style={T.fg}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={T.fl}>Attributes{attrFilters.size > 0 && <span style={{ color: '#60a5fa' }}> ({attrFilters.size} active)</span>}</span>
            {attrFilters.size > 0 && <button onClick={() => setAttrFilters(new Set())} style={{ fontSize: 8, padding: '1px 6px', borderRadius: 3, border: '1px solid #1e2d45', background: 'transparent', color: '#f87171', cursor: 'pointer' }}>Clear</button>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {ALL_ATTRIBUTES.map(attr => {
              const on = attrFilters.has(attr);
              return (
                <button key={attr} onClick={() => { setAttrFilters(prev => { const n = new Set(prev); on ? n.delete(attr) : n.add(attr); return n; }); setPage(0); }}
                  style={{ padding: '3px 8px', borderRadius: 12, border: `1px solid ${on ? '#3b7de8' : '#1e2d45'}`, background: on ? '#0e2040' : 'transparent', color: on ? '#60a5fa' : '#64748b', fontSize: 9.5, fontWeight: on ? 700 : 400, cursor: 'pointer' }}>
                  {attr}
                </button>
              );
            })}
          </div>
        </div>

        <div style={T.fg}>
          <span style={T.fl}>Season</span>
          <select style={T.sel} value={season} onChange={e => { setSeason(e.target.value); setPage(0); }}>
            <option value="latest">Latest season</option>
            <option value="weighted">All seasons (weighted avg)</option>
            {allSeasons.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <label style={T.cr} onClick={() => { setRawMode(p => !p); setPage(0); }}>
          <div style={T.cb(rawMode)}>{rawMode && <span style={{ color: '#fff', fontSize: 8 }}>✓</span>}</div>
          <span style={T.cl(rawMode)}>Raw Score (not league weighted)</span>
        </label>
        <div style={{ fontSize: 9, color: '#475569', marginTop: -4, marginBottom: 8 }}>Only affects Overall — Attack/Defence/Possession/Pressing are always raw percentiles.</div>

        <label style={{ ...T.cr, opacity: season !== 'latest' ? 0.4 : 1 }} onClick={() => { if (season !== 'latest') return; setMostImproved(p => !p); setPage(0); }}>
          <div style={T.cb(mostImproved && season === 'latest')}>{(mostImproved && season === 'latest') && <span style={{ color: '#fff', fontSize: 8 }}>✓</span>}</div>
          <span style={{ ...T.cl(mostImproved && season === 'latest'), fontWeight: 600 }}>📈 Most Improved</span>
        </label>
        {season !== 'latest' && <div style={{ fontSize: 9, color: '#475569', marginTop: -4, marginBottom: 4 }}>Requires "Latest season" mode.</div>}
        {mostImproved && season === 'latest' && (
          <div style={{ marginTop: 2, marginBottom: 8 }}>
            <span style={T.fl}>Improve by</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {IMPROVED_MODES.map(m => (
                <button key={m} onClick={() => { setImprovedMode(m); setPage(0); }}
                  style={{ padding: '3px 8px', borderRadius: 10, border: `1px solid ${improvedMode === m ? '#3b7de8' : '#1e2d45'}`, background: improvedMode === m ? '#0e2040' : 'transparent', color: improvedMode === m ? '#60a5fa' : '#64748b', fontSize: 9.5, fontWeight: improvedMode === m ? 700 : 400, cursor: 'pointer' }}>
                  {m}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 9, color: '#475569', marginTop: 5, marginBottom: 6 }}>Sub-scores (Attack etc.) only compare same-division teams. Cross-division uses Overall.</div>
            <label style={T.cr} onClick={() => { setSameDivOnly(p => !p); setPage(0); }}>
              <div style={T.cb(sameDivOnly)}>{sameDivOnly && <span style={{ color: '#fff', fontSize: 8 }}>✓</span>}</div>
              <span style={T.cl(sameDivOnly)}>Same Division Only</span>
            </label>
            <div style={{ fontSize: 9, color: '#475569', marginTop: -2 }}>Hide teams that changed league.</div>
          </div>
        )}

        <div style={T.fg}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={T.fl}>£ Performance Min</span>
            {minMVPerf !== null && <button onClick={() => { setMinMVPerf(null); setPage(0); }} style={{ fontSize: 9, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>clear</button>}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="number" value={minMVPerf ?? ''} onChange={e => { setMinMVPerf(e.target.value === '' ? null : Number(e.target.value)); setPage(0); }}
              placeholder="e.g. 3" style={{ width: 60, background: '#0d1220', border: '1px solid #1e2d45', borderRadius: 4, color: '#e2e8f4', fontSize: 11, padding: '4px 6px' }} />
            <span style={{ fontSize: 9, color: '#475569' }}>league places overperformed</span>
          </div>
          <div style={{ fontSize: 9, color: '#334155', marginTop: 3 }}>Pos rank − MV rank. +3 = 3 places above expected.</div>
        </div>

        <div style={T.fg}>
          <span style={T.fl}>Min Score: <strong style={{ color: '#60a5fa' }}>{minScore}</strong></span>
          <input type="range" min={0} max={99} value={minScore} onChange={e => { setMinScore(Number(e.target.value)); setPage(0); }} style={{ width: '100%', accentColor: '#3b7de8' }} />
        </div>

        <div style={T.dv} />

        <div style={T.fg}>
          <span style={T.fl}>League Presets</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {Object.keys(PRESET_LEAGUES).map(p => (
              <button key={p} onClick={() => { setActivePreset(p); setPage(0); }}
                style={{ padding: '3px 7px', borderRadius: 5, border: `1px solid ${activePreset === p ? '#3b7de8' : '#1e2d45'}`, background: activePreset === p ? '#0e2040' : 'transparent', color: activePreset === p ? '#60a5fa' : '#64748b', fontSize: 9, cursor: 'pointer' }}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <div style={T.fg}>
          <span style={T.fl}>League Strength: {lsMin}–{lsMax}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="range" min={0} max={100} value={lsMin} onChange={e => { setLsMin(Number(e.target.value)); setPage(0); }} style={{ flex: 1, accentColor: '#3b7de8' }} />
            <input type="range" min={1} max={101} value={lsMax} onChange={e => { setLsMax(Number(e.target.value)); setPage(0); }} style={{ flex: 1, accentColor: '#3b7de8' }} />
          </div>
        </div>

        <div style={T.fg}>
          <span style={T.fl}>Regions</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {[...new Set(Object.values(COUNTRY_TO_REGION))].map(r => {
              const active = activeRegions.has(r);
              return (
                <button key={r} onClick={() => { setActiveRegions(prev => { const n = new Set(prev); active ? n.delete(r) : n.add(r); return n; }); setPage(0); }}
                  style={{ padding: '3px 7px', borderRadius: 5, border: `1px solid ${active ? '#3b7de8' : '#1e2d45'}`, background: active ? '#0e2040' : 'transparent', color: active ? '#60a5fa' : '#64748b', fontSize: 9, cursor: 'pointer' }}>
                  {r}
                </button>
              );
            })}
          </div>
        </div>

        <div style={T.fg}>
          <span style={T.fl}>Bands</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {[...new Set(Object.values(GBE_LEAGUE_BANDS))].sort().map(b => {
              const active = activeBands.has(b);
              return (
                <button key={b} onClick={() => { setActiveBands(prev => { const n = new Set(prev); active ? n.delete(b) : n.add(b); return n; }); setPage(0); }}
                  style={{ padding: '3px 7px', borderRadius: 5, border: `1px solid ${active ? '#3b7de8' : '#1e2d45'}`, background: active ? '#0e2040' : 'transparent', color: active ? '#60a5fa' : '#64748b', fontSize: 9, cursor: 'pointer' }}>
                  Band {b}
                </button>
              );
            })}
          </div>
        </div>

        <div style={T.fg}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={T.fl}>Leagues ({leagues.size} active)</span>
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            <button onClick={() => setLeagues(new Set(DEFAULT_LEAGUES))} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, border: '1px solid #1e2d45', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>Default</button>
            <button onClick={() => setLeagues(new Set(ALL_LEAGUES))} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, border: '1px solid #1e2d45', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>All</button>
            <button onClick={() => setLeagues(new Set())} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, border: '1px solid #1e2d45', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>None</button>
          </div>
          <label style={T.cr} onClick={() => setShowHidden(p => !p)}>
            <div style={T.cb(showHidden)}>{showHidden && <span style={{ color: '#fff', fontSize: 8 }}>✓</span>}</div>
            <span style={T.cl(showHidden)}>Show Hidden</span>
          </label>
          <label style={T.cr} onClick={() => setShowYouth(p => !p)}>
            <div style={T.cb(showYouth)}>{showYouth && <span style={{ color: '#fff', fontSize: 8 }}>✓</span>}</div>
            <span style={T.cl(showYouth)}>Show Youth</span>
          </label>
          <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #1e2d45', borderRadius: 5, padding: 6, marginTop: 6 }}>
            {[...ALL_LEAGUES].filter(l => showHidden || !HIDDEN_LEAGUES.has(l)).filter(l => showYouth || !YOUTH_LEAGUES.has(l)).sort((a, b) => a.localeCompare(b)).map(l => (
              <label key={l} style={{ ...T.cr, marginBottom: 2 }} onClick={() => { setLeagues(prev => { const n = new Set(prev); n.has(l) ? n.delete(l) : n.add(l); return n; }); setPage(0); }}>
                <div style={T.cb(leagues.has(l))}>{leagues.has(l) && <span style={{ color: '#fff', fontSize: 7 }}>✓</span>}</div>
                <span style={{ ...T.cl(leagues.has(l)), fontSize: 10 }}>{l}</span>
              </label>
            ))}
          </div>
        </div>

        <div style={T.dv} />

        <div style={T.fg}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={T.fl}>Metric Filter ({metricFilters.length}/10)</span>
            {metricFilters.length < 10 && <button onClick={() => setMetricFilters(f => [...f, { key: '', label: '', min: 0, max: 100, mode: 'pct' }])} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, border: '1px solid #1e2d45', background: 'transparent', color: '#60a5fa', cursor: 'pointer' }}>+ Add</button>}
          </div>
          {metricFilters.map((mf, i) => {
            const opt = METRIC_OPTIONS.find(o => o.key === mf.key);
            const isPct = opt?.isPct;
            return (
              <div key={i} style={{ marginBottom: 6, background: '#080f1c', border: '1px solid #1e2d45', borderRadius: 5, padding: '5px 6px' }}>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: isPct ? 4 : 0 }}>
                  <select style={{ ...T.sel, flex: 2 }} value={mf.key} onChange={e => {
                    const o = METRIC_OPTIONS.find(x => x.key === e.target.value);
                    setMetricFilters(f => f.map((x, j) => j === i ? { ...x, key: e.target.value, label: o?.label || '', min: 0, max: o?.isPct ? 100 : 999, mode: o?.isPct ? 'pct' : 'raw' } : x));
                  }}>
                    <option value="">Metric…</option>
                    {['Scores', 'Attack', 'Defence', 'Possession', 'Pressing', 'Stats'].map(grp => (
                      <optgroup key={grp} label={grp}>
                        {METRIC_OPTIONS.filter(o => o.group === grp).map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  <button onClick={() => setMetricFilters(f => f.filter((_, j) => j !== i))} style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>×</button>
                </div>
                {mf.key && (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {isPct && (
                      <div style={{ display: 'flex', borderRadius: 4, overflow: 'hidden', border: '1px solid #1e2d45', flexShrink: 0 }}>
                        {['pct', 'raw'].map(m => (
                          <button key={m} onClick={() => setMetricFilters(f => f.map((x, j) => j === i ? { ...x, mode: m } : x))}
                            style={{ fontSize: 9, padding: '2px 6px', background: mf.mode === m ? '#0e2040' : 'transparent', color: mf.mode === m ? '#60a5fa' : '#475569', border: 'none', cursor: 'pointer', fontWeight: mf.mode === m ? 700 : 400 }}>
                            {m === 'pct' ? 'Pct' : 'Score'}
                          </button>
                        ))}
                      </div>
                    )}
                    <span style={{ fontSize: 9, color: '#475569', flexShrink: 0 }}>min</span>
                    <input type="number" value={mf.min} onChange={e => setMetricFilters(f => f.map((x, j) => j === i ? { ...x, min: Number(e.target.value) } : x))} style={{ width: 40, background: '#0d1220', border: '1px solid #1e2d45', borderRadius: 4, color: '#e2e8f4', fontSize: 10, padding: '3px' }} />
                    <span style={{ fontSize: 9, color: '#475569', flexShrink: 0 }}>max</span>
                    <input type="number" value={mf.max} onChange={e => setMetricFilters(f => f.map((x, j) => j === i ? { ...x, max: Number(e.target.value) } : x))} style={{ width: 40, background: '#0d1220', border: '1px solid #1e2d45', borderRadius: 4, color: '#e2e8f4', fontSize: 10, padding: '3px' }} />
                    {isPct && <span style={{ fontSize: 9, color: '#334155' }}>{mf.mode === 'pct' ? '0–100 percentile' : 'raw value'}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>
      )}
      {isMobile && !filtersOpen && (
        <button style={T.fabBtn} onClick={() => setFiltersOpen(true)}>☰ Filters</button>
      )}

      <main style={isMobile ? T.mainMobile : T.main}>
        <div style={isMobile ? T.statsBarMobile : T.statsBar}>
          <div style={T.si}><div style={T.sv}>{sorted.length.toLocaleString()}</div><div style={T.sl2}>Found</div></div>
          <div style={T.sdv} />
          <div style={T.si}><div style={T.sv}>{(sorted.reduce((s, t) => s + (getDisplayScore(t) || 0), 0) / (sorted.length || 1)).toFixed(1)}</div><div style={T.sl2}>Avg Score</div></div>
          <div style={T.sdv} />
          <div style={T.si}><div style={T.sv}>{(sorted.reduce((s, t) => s + (t.avgAge || 0), 0) / (sorted.length || 1)).toFixed(1)}</div><div style={T.sl2}>Avg Age</div></div>
          <div style={T.sdv} />
          <div style={T.si}><div style={T.sv}>{sorted.filter(t => (getDisplayScore(t) || 0) >= 80).length}</div><div style={T.sl2}>Score 80+</div></div>
          <div style={isMobile
            ? { width: '100%', display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 2,
                WebkitOverflowScrolling: 'touch' }
            : { marginLeft: 'auto', display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            {['overall', 'attack', 'defence', 'possession', 'pressing', 'avgAge', 'mvPerf', 'totalMV', 'avgXValue'].map(col => (
              <button key={col} onClick={() => onSort(col)} style={{ flexShrink: 0, padding: isMobile ? '7px 11px' : '4px 9px', borderRadius: 4, border: `1px solid ${sort.col === col ? '#3b7de8' : '#1e2d45'}`, background: sort.col === col ? '#0e2040' : 'transparent', color: sort.col === col ? '#93c5fd' : '#94a3b8', fontSize: 10, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {col === 'overall' ? 'Overall' : col === 'attack' ? 'Attack' : col === 'defence' ? 'Defence' : col === 'possession' ? 'Possession' : col === 'pressing' ? 'Pressing' : col === 'avgAge' ? 'Avg Age' : col === 'avgXValue' ? 'Avg xValue' : col === 'totalMV' ? 'Squad MV' : '£ Perf'}{sort.col === col ? (sort.asc ? ' ↑' : ' ↓') : ''}
              </button>
            ))}
          </div>
        </div>

        <div style={T.tw}>
          {sorted.length === 0
            ? <div style={T.es}><div style={{ fontSize: 26 }}>⚽</div><div style={{ fontSize: 12, color: '#94a3b8' }}>No teams match filters</div></div>
            /* Mobile: cards instead of a 10-column table. Everything that matters on a
               phone — crest, name, league, headline score and a way into both reports —
               with no horizontal scrolling. */
            : isMobile ? (
                  <div>
                    {paged.map((t, i) => {
                      const avgXV = getAvgXValue(t.team, t.league);
                      const totMV = getTotalMV(t.team, t.league);
                      const mvPerf = getMVPerf(t.team, t.league);
                      const open = (setter) => setter({ ...t, crest: teamCrest(t.team),
                        avgXValue: avgXV, totalMV: totMV, mvPerf });
                      return (
                        <div key={t.team + t.league + t.season + i} style={T.card}>
                          <div style={T.cardTop}>
                            <span style={{ color: '#475569', fontSize: 11, minWidth: 18 }}>
                              {page * PAGE_SIZE + i + 1}</span>
                            {teamCrest(t.team) && (
                              <img src={teamCrest(t.team)} alt="" style={{ width: 26, height: 26, objectFit: 'contain' }}
                                   onError={e => { e.target.style.display = 'none'; }} />
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap',
                                            overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.team}</div>
                              <div style={{ fontSize: 10.5, color: '#64748b' }}>{t.league} · {t.season}</div>
                            </div>
                            <div style={T.cardStat}>
                              <span style={{ fontWeight: 800, fontSize: 17, color: scoreColor(getDisplayScore(t)) }}>
                                {getDisplayScore(t) != null ? Math.round(getDisplayScore(t)) : '—'}</span>
                              <span style={{ fontSize: 8, color: '#475569', letterSpacing: '.08em' }}>
                                {scoreMode.toUpperCase()}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                            <button onClick={() => open(setSelTeam)}
                              style={{ flex: 1, padding: '9px 0', borderRadius: 7, border: '1px solid #1e2d45',
                                       background: '#111a2c', color: '#cbd5e1', fontSize: 12,
                                       fontWeight: 700, cursor: 'pointer' }}>Details</button>
                            <button onClick={() => open(setReportTeam)}
                              style={{ flex: 1, padding: '9px 0', borderRadius: 7, border: '1px solid #26456f',
                                       background: '#12203a', color: '#93c5fd', fontSize: 12,
                                       fontWeight: 700, cursor: 'pointer' }}>Report</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
            ) : (
              <table style={T.tbl}>
                <thead style={T.th_}><tr>
                  <th style={{ ...T.th, width: 30, textAlign: 'center' }}>#</th>
                  <th style={{ ...T.th, width: 30 }} />
                  <Th col="team" label="Club" sort={sort} onSort={onSort} />
                  <th style={T.th}>League</th>
                  <th style={T.th}>Style</th>
                  {mostImproved && season === 'latest' && <th style={{ ...T.th, color: '#4ade80' }}>Δ {improvedMode}</th>}
                  <Th col="overall" label="Overall" sort={sort} onSort={onSort} />
                  <Th col="attack" label="Attack" sort={sort} onSort={onSort} />
                  <Th col="defence" label="Defence" sort={sort} onSort={onSort} />
                  <Th col="possession" label="Possession" sort={sort} onSort={onSort} />
                  <Th col="pressing" label="Pressing" sort={sort} onSort={onSort} />
                  <Th col="avgAge" label="Avg Age" sort={sort} onSort={onSort} />
                  <Th col="mvPerf" label="£ Perf" sort={sort} onSort={onSort} />
                  <Th col="totalMV" label="Squad MV" sort={sort} onSort={onSort} />
                  <Th col="avgXValue" label="Avg xValue" sort={sort} onSort={onSort} />
                </tr></thead>
                <tbody>
                  {paged.map((t, i) => {
                    const avgXV = getAvgXValue(t.team, t.league);
                    const totMV = getTotalMV(t.team, t.league);
                    const mvPerf = getMVPerf(t.team, t.league);
                    return (
                      <tr key={t.team + t.league + t.season + i} className="rh" onClick={() => setSelTeam({ ...t, crest: teamCrest(t.team), avgXValue: getAvgXValue(t.team, t.league), totalMV: getTotalMV(t.team, t.league), mvPerf: getMVPerf(t.team, t.league) })} style={{ cursor: 'pointer' }}>
                        <td style={{ ...T.td, textAlign: 'center', color: '#64748b', fontSize: 10 }}>{page * PAGE_SIZE + i + 1}</td>
                        <td style={T.td}>
                          {teamCrest(t.team) && <img src={teamCrest(t.team)} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} onError={e => { e.target.style.display = 'none'; }} />}
                        </td>
                        <td style={{ ...T.td, fontWeight: 700 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                            {t.team}
                            {/* Opens TeamReport. stopPropagation is required — the whole <tr>
                                already has an onClick that opens TeamCard. */}
                            <button
                              title="Team Report (1920x1080 export)"
                              onClick={e => { e.stopPropagation(); setReportTeam({ ...t, crest: teamCrest(t.team), avgXValue: avgXV, totalMV: totMV, mvPerf }); }}
                              style={{ marginLeft: 8, padding: '1px 6px', borderRadius: 4, border: '1px solid #1e2d45', background: 'transparent', color: '#64748b', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                            >REPORT</button>
                          </span>
                        </td>
                        <td style={T.td}>{t.league}</td>
                        <td style={T.td}>
                          <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: 8, background: t.style ? styleColor(t.style).bg : '#0e1e38', color: t.style ? styleColor(t.style).color : '#93c5fd', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>{t.style || '—'}</span>
                        </td>
                        {mostImproved && season === 'latest' && (() => {
                          const imp = getImprovement(t);
                          if (!imp) return <td style={{ ...T.td, color: '#475569' }}>—</td>;
                          const { delta, rawDelta, sameDiv, prevSeason, prevLeague, prevVal, currVal, fieldUsed } = imp;
                          const color = delta > 5 ? '#4ade80' : delta > 0 ? '#86efac' : delta > -5 ? '#fca5a5' : '#f87171';
                          const prefix = delta >= 0 ? '+' : '';
                          const divArrow = !sameDiv ? (LEAGUE_STRENGTHS[toDotLeague(t.league)] > LEAGUE_STRENGTHS[toDotLeague(prevLeague)] ? '↑' : '↓') : '';
                          const tooltip = `${prevSeason} (${prevLeague}) → ${t.league} | ${prevVal?.toFixed(1)} → ${currVal?.toFixed(1)} (${fieldUsed === 'completeScore' && improvedMode !== 'Overall' && improvedMode !== 'Raw Overall' ? 'Overall used — div. changed' : improvedMode})`;
                          return (
                            <td style={{ ...T.td, fontWeight: 700 }} title={tooltip}>
                              <span style={{ color, fontSize: 12 }}>{prefix}{delta.toFixed(1)}</span>
                              {!sameDiv && <span style={{ fontSize: 9, color: '#94a3b8', marginLeft: 3 }}>{divArrow}</span>}
                            </td>
                          );
                        })()}
                        <td style={{ ...T.td, fontWeight: 700, color: scoreColor(getDisplayScore(t)) }}>{getDisplayScore(t) != null ? getDisplayScore(t).toFixed(1) : '—'}</td>
                        <td style={{ ...T.td, color: scoreColor(t.attack) }}>{t.attack != null ? t.attack.toFixed(1) : '—'}</td>
                        <td style={{ ...T.td, color: scoreColor(t.defence) }}>{t.defence != null ? t.defence.toFixed(1) : '—'}</td>
                        <td style={{ ...T.td, color: scoreColor(t.possession) }}>{t.possession != null ? t.possession.toFixed(1) : '—'}</td>
                        <td style={{ ...T.td, color: scoreColor(t.pressing) }}>{t.pressing != null ? t.pressing.toFixed(1) : '—'}</td>
                        <td style={T.td}>{t.avgAge ?? '—'}</td>
                        <td style={{ ...T.td, fontWeight: 700, textAlign: 'center' }} title={mvPerf != null ? `Pts Rank: ${t.pointsRank} | MV Rank: ${t.pointsRank - mvPerf} | £ Perf: ${mvPerf > 0 ? '+' : ''}${mvPerf} (${mvPerf > 0 ? 'overperforming' : 'underperforming'})` : 'No MV data'}>
                          {mvPerf != null
                            ? <span style={{ color: mvPerf > 2 ? '#4ade80' : mvPerf > 0 ? '#86efac' : mvPerf < -2 ? '#f87171' : mvPerf < 0 ? '#fca5a5' : '#94a3b8', fontSize: 13 }}>{mvPerf > 0 ? '+' : ''}{mvPerf}</span>
                            : <span style={{ color: '#334155' }}>—</span>}
                        </td>
                        <td style={{ ...T.td, color: '#c084fc', fontWeight: 700 }}>{totMV != null ? `£${(totMV / 1000000).toFixed(1)}m` : '—'}</td>
                        <td style={{ ...T.td, color: '#93c5fd', fontWeight: 700 }}>{avgXV != null ? `£${(avgXV / 1000000).toFixed(1)}m` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
        </div>
        <div style={isMobile
          ? { display: 'flex', gap: 10, margin: '12px 10px 78px', alignItems: 'center', justifyContent: 'center' }
          : { display: 'flex', gap: 8, margin: '12px 16px', alignItems: 'center' }}>
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)} style={{ padding: isMobile ? '9px 18px' : '4px 10px', borderRadius: 5, border: '1px solid #1e2d45', background: 'transparent', color: page === 0 ? '#475569' : '#e2e8f4', cursor: page === 0 ? 'default' : 'pointer' }}>Prev</button>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>Page {page + 1} of {Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))}</span>
          <button disabled={(page + 1) * PAGE_SIZE >= sorted.length} onClick={() => setPage(p => p + 1)} style={{ padding: isMobile ? '9px 18px' : '4px 10px', borderRadius: 5, border: '1px solid #1e2d45', background: 'transparent', color: (page + 1) * PAGE_SIZE >= sorted.length ? '#475569' : '#e2e8f4', cursor: (page + 1) * PAGE_SIZE >= sorted.length ? 'default' : 'pointer' }}>Next</button>
        </div>
      </main>
      {selTeam && (
        <TeamCard
          team={selTeam}
          allTeamSeasons={all.filter(t => t.team === selTeam.team && teamCountry(t.league) === teamCountry(selTeam.league)).map(t => ({ ...t, crest: undefined }))}
          onClose={() => setSelTeam(null)}
        />
      )}
      {showCoaches && (
        <CoachPanel
          allTeams={all}
          allPlayers={players}
          onClose={() => setShowCoaches(false)}
        />
      )}
      {reportTeam && (
        <TeamReport
          team={reportTeam}
          allTeamSeasons={all.filter(t => t.team === reportTeam.team && teamCountry(t.league) === teamCountry(reportTeam.league)).map(t => ({ ...t, crest: undefined }))}
          allTeams={all}
          players={players}
          onClose={() => setReportTeam(null)}
        />
      )}
    </div>
  );
}
