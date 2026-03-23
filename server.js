require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { Agent, setGlobalDispatcher } = require('undici');

setGlobalDispatcher(new Agent({ connections: 100, pipelining: 1 }));

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const HF_AUTH = `Key ${process.env.HIGGSFIELD_KEY}:${process.env.HIGGSFIELD_SECRET}`;
const HF_BASE = 'https://platform.higgsfield.ai';
const IMG_MODEL = 'nano-banana-pro';
const VID_MODEL = 'higgsfield-ai/dop/standard';
const CACHE_DIR = path.join(__dirname, 'cache');
const CACHE_INDEX = path.join(CACHE_DIR, 'index.json');

fs.mkdirSync(CACHE_DIR, { recursive: true });

// ─── Video Cache ───

let videoCache = {};

function loadCache() {
  try {
    if (fs.existsSync(CACHE_INDEX)) {
      videoCache = JSON.parse(fs.readFileSync(CACHE_INDEX, 'utf8'));
      console.log(`Loaded ${Object.keys(videoCache).length} cached videos`);
    }
  } catch { videoCache = {}; }
}

function saveCache() {
  try { fs.writeFileSync(CACHE_INDEX, JSON.stringify(videoCache, null, 2)); } catch {}
}

function getCachedVideo(eventId) {
  const entry = videoCache[eventId];
  if (!entry) return null;
  const localPath = path.join(CACHE_DIR, entry.filename);
  if (!fs.existsSync(localPath)) { delete videoCache[eventId]; saveCache(); return null; }
  return `/cache/${entry.filename}`;
}

async function downloadAndCache(eventId, remoteUrl) {
  try {
    const filename = `${eventId}.mp4`;
    const localPath = path.join(CACHE_DIR, filename);
    const res = await fetch(remoteUrl);
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(localPath, buffer);
    videoCache[eventId] = { filename, cachedAt: Date.now(), remoteUrl };
    saveCache();
    console.log(`[Cache] Saved ${eventId} (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
    return `/cache/${filename}`;
  } catch (err) {
    console.error(`[Cache] Failed to save ${eventId}: ${err.message}`);
    return remoteUrl;
  }
}

loadCache();

app.use('/cache', express.static(CACHE_DIR));

// ─── Curated Historical Events ───

const EVENTS = [
  { id: 'giza', year: -2560, lat: 29.9792, lng: 31.1342, locationName: 'Giza, Egypt', eventName: 'Construction of the Great Pyramid', era: 'Ancient',
    prompt: 'Cinematic sweeping shot of the Great Pyramid of Giza under construction in ancient Egypt circa 2560 BC. Thousands of Egyptian workers in white linen loincloths haul massive limestone blocks up earthen ramps using wooden sledges and copper tools. Overseers in pleated kilts direct labor gangs. The partially completed pyramid rises against a desert sky, scaffolding of acacia wood along its face. The green Nile floodplain visible in the background with papyrus boats. Historically accurate Bronze Age Egyptian construction techniques, no modern elements, photorealistic cinematography, golden hour desert light, no text or watermarks' },
  { id: 'babylon', year: -600, lat: 32.5363, lng: 44.4209, locationName: 'Babylon, Mesopotamia', eventName: 'Hanging Gardens of Babylon', era: 'Ancient',
    prompt: 'Cinematic view of ancient Babylon circa 600 BC under King Nebuchadnezzar II. The legendary Hanging Gardens rise in terraced stone platforms overflowing with exotic plants, date palms, and cascading irrigation channels. The massive blue-glazed Ishtar Gate with golden bull and dragon reliefs stands in the background. Citizens in Mesopotamian robes walk through mudbrick streets. The great ziggurat Etemenanki towers over the city. Historically accurate Neo-Babylonian architecture and clothing, Euphrates River visible, warm golden light, photorealistic, no text or watermarks' },
  { id: 'parthenon', year: -438, lat: 37.9715, lng: 23.7267, locationName: 'Athens, Greece', eventName: 'Completion of the Parthenon', era: 'Ancient',
    prompt: 'Cinematic view of the newly completed Parthenon atop the Acropolis in Athens, 438 BC. The marble temple gleams white with vivid painted decorations in red, blue, and gold on its pediments and friezes—historically accurate polychrome Greek architecture. Athenian citizens in chitons and himations walk the Sacred Way. The massive gold-and-ivory statue of Athena by Phidias visible through the colonnade. The ancient city of Athens spreads below with the agora visible. Mediterranean blue sky, olive groves, photorealistic, no text or watermarks' },
  { id: 'alexander', year: -331, lat: 36.3566, lng: 43.1590, locationName: 'Gaugamela, Persia', eventName: 'Battle of Gaugamela', era: 'Ancient',
    prompt: 'Cinematic aerial shot of the Battle of Gaugamela, 331 BC. Alexander the Great leads his Companion cavalry in a wedge formation charging toward the Persian center. Macedonian soldiers wear bronze Phrygian helmets and carry sarissa pikes in phalanx formation. Persian Immortals in elaborate robes and scale armor defend around Darius III golden chariot. War elephants, scythed chariots, dust clouds across the Mesopotamian plain. Historically accurate Hellenistic and Achaemenid military equipment, photorealistic, no text or watermarks' },
  { id: 'great-wall', year: -210, lat: 40.4319, lng: 116.5704, locationName: 'Northern China', eventName: 'Construction of the Great Wall', era: 'Ancient',
    prompt: 'Cinematic aerial shot of the Great Wall under construction during the Qin Dynasty circa 210 BC. Thousands of conscripted laborers in rough hemp clothing build rammed-earth fortifications across rugged northern Chinese mountains. Qin soldiers in lacquered leather armor with topknot hairstyles oversee the work. Watchtowers made of tamped earth and timber rise at intervals. Misty mountain landscape stretching endlessly. Historically accurate Qin Dynasty construction methods, no modern stone wall, photorealistic, no text or watermarks' },
  { id: 'rome-forum', year: -44, lat: 41.8925, lng: 12.4853, locationName: 'Rome, Roman Republic', eventName: 'Assassination of Julius Caesar', era: 'Ancient',
    prompt: 'Cinematic shot of the Roman Forum at the height of the late Republic, 44 BC. Senators in white togas with purple borders (toga praetexta) hurry along the Via Sacra past the Temple of Saturn and the Rostra. Roman legionaries in lorica hamata chainmail stand guard. Market stalls with amphora of wine and olive oil. The Basilica Aemilia rises with its marble columns. SPQR standards visible. Historically accurate late Republican Rome with correct architectural details, warm Mediterranean light, photorealistic, no text or watermarks' },
  { id: 'colosseum', year: 80, lat: 41.8902, lng: 12.4922, locationName: 'Rome, Roman Empire', eventName: 'Opening of the Colosseum', era: 'Ancient',
    prompt: 'Cinematic interior of the newly opened Flavian Amphitheatre (Colosseum) in Rome, 80 AD. 50,000 spectators fill the tiered seating. Gladiators in historically accurate equipment—a murmillo with fish-crested helmet and scutum shield faces a retiarius with trident and net—fight on the sand arena floor. The velarium canvas awning stretches overhead operated by sailors. Emperor Titus watches from the imperial box. Travertine stone arches, Corinthian columns, photorealistic, no text or watermarks' },
  { id: 'pompeii', year: 79, lat: 40.7484, lng: 14.4848, locationName: 'Pompeii, Roman Empire', eventName: 'Eruption of Mount Vesuvius', era: 'Ancient',
    prompt: 'Cinematic shot of Mount Vesuvius erupting on August 24, 79 AD, as seen from the streets of Pompeii. A massive Plinian eruption column rises 30km into the sky. Roman citizens in tunics and stolas flee through the streets past painted frescoed walls and fountain-courtyard houses. Hot pumice and ash rain down. The Forum with its temples and basilica visible. Ships in the Bay of Naples attempt to evacuate people. Historically accurate Roman Pompeii architecture, dramatic volcanic light, photorealistic, no text or watermarks' },
  { id: 'constantinople', year: 330, lat: 41.0082, lng: 28.9784, locationName: 'Constantinople, Byzantine Empire', eventName: 'Founding of Constantinople', era: 'Ancient',
    prompt: 'Cinematic panoramic view of the newly founded Constantinople in 330 AD. Emperor Constantine\'s new capital on the Bosphorus strait. The Hippodrome with its Egyptian obelisk, the first Hagia Sophia under construction, the new imperial palace complex. Roman-style colonnaded streets (the Mese). Triremes and merchant vessels in the Golden Horn harbor. Theodosian land walls being planned. Citizens in late Roman clothing. Historically accurate late antique Roman architecture, golden light on the strait, photorealistic, no text or watermarks' },
  { id: 'viking-lindisfarne', year: 793, lat: 55.6690, lng: -1.8010, locationName: 'Lindisfarne, England', eventName: 'Viking Raid on Lindisfarne', era: 'Medieval',
    prompt: 'Cinematic shot of the Viking raid on Lindisfarne monastery, June 793 AD. Norse longships with dragon-headed prows beach on the rocky Northumbrian coast. Viking warriors in iron helmets (no horns—historically accurate), chainmail byrnies, carrying round wooden shields and iron axes, storm the stone monastery. Anglo-Saxon monks in brown robes flee carrying illuminated manuscripts and gold reliquaries. The stone priory church of St Cuthbert. Grey North Sea, overcast English sky, morning fog, photorealistic, no text or watermarks' },
  { id: 'angkor-wat', year: 1150, lat: 13.4125, lng: 103.8670, locationName: 'Angkor, Khmer Empire', eventName: 'Angkor Wat at its peak', era: 'Medieval',
    prompt: 'Cinematic aerial shot of Angkor Wat at its peak under the Khmer Empire, circa 1150 AD. The vast sandstone temple complex with its five iconic lotus-bud towers reflected in the surrounding moat. Intricate bas-relief carvings of the Churning of the Ocean of Milk along the gallery walls. Khmer devotees in sampot garments walk the long causeway. Buddhist monks in saffron robes. Tropical jungle surrounds the complex. Historically accurate Khmer architecture and religious iconography, golden sunrise, photorealistic, no text or watermarks' },
  { id: 'notre-dame', year: 1200, lat: 48.8530, lng: 2.3499, locationName: 'Paris, France', eventName: 'Construction of Notre-Dame Cathedral', era: 'Medieval',
    prompt: 'Cinematic shot of Notre-Dame de Paris under construction circa 1200 AD. The Gothic cathedral rises with its revolutionary flying buttresses, pointed ribbed vaults, and rose windows being installed. Medieval master masons and carpenters on wooden scaffolding using treadwheel cranes to hoist carved limestone blocks. Workers in medieval tunics and hose. The Seine river with wooden bridges in the foreground. The medieval Île de la Cité with half-timbered houses. Overcast Parisian sky, historically accurate High Medieval construction, photorealistic, no text or watermarks' },
  { id: 'genghis-khan', year: 1220, lat: 39.6542, lng: 66.9597, locationName: 'Samarkand, Central Asia', eventName: 'Mongol Siege of Samarkand', era: 'Medieval',
    prompt: 'Cinematic wide shot of the Mongol siege of Samarkand, 1220 AD. Genghis Khan\'s vast army of mounted archers in deel robes and iron lamellar armor surrounds the walled Khwarezmian city with its blue-tiled Islamic domes and minarets. Mongol siege engineers operate Chinese-style trebuchets and battering rams. Mongol horsemen carry the yak-tail tugh standards. The Silk Road oasis city\'s irrigation canals visible. Central Asian steppe stretching to the horizon. Historically accurate Mongol military equipment, golden hour light, photorealistic, no text or watermarks' },
  { id: 'black-death', year: 1348, lat: 51.5074, lng: -0.1278, locationName: 'London, England', eventName: 'The Black Death reaches London', era: 'Medieval',
    prompt: 'Cinematic somber shot of London during the Black Death, 1348. Medieval half-timbered houses line narrow muddy streets. Plague victims with visible buboes lie in doorways. Flagellants in white robes process through the streets. Plague doctors in long dark robes (no beak masks yet—historically accurate for 1348). Dead-carts collect bodies. Red crosses painted on doors of infected houses. Old St Paul\'s Cathedral visible. The Thames with London Bridge and its buildings. Overcast, grim atmosphere, historically accurate 14th century England, photorealistic, no text or watermarks' },
  { id: 'forbidden-city', year: 1420, lat: 39.9163, lng: 116.3972, locationName: 'Beijing, Ming Dynasty', eventName: 'Completion of the Forbidden City', era: 'Medieval',
    prompt: 'Cinematic aerial shot of the newly completed Forbidden City in Beijing, 1420 AD, under the Yongle Emperor. The vast imperial palace complex with yellow-glazed roof tiles (reserved for the emperor), red-painted walls, and white marble terraces arranged along a perfect north-south axis. The Hall of Supreme Harmony dominates the outer court. Ming Dynasty officials in round-collared robes with mandarin squares and black gauze caps cross marble bridges over the Golden Water River. Dragon and phoenix motifs on every surface. Historically accurate early Ming Dynasty architecture, misty morning light, photorealistic, no text or watermarks' },
  { id: 'machu-picchu', year: 1450, lat: -13.1631, lng: -72.5450, locationName: 'Andes Mountains, Inca Empire', eventName: 'Construction of Machu Picchu', era: 'Medieval',
    prompt: 'Cinematic aerial shot of Machu Picchu as a living Inca royal estate, circa 1450 AD under Emperor Pachacuti. Precisely fitted ashlar stonework without mortar. Agricultural terraces with quinoa and potato crops. Inca nobility in fine cumbi cloth tunics with geometric tocapu patterns and gold ear spools. Llamas on the terraces. The Intihuatana sun stone and Temple of the Sun in use. Thatched ichu grass roofs on all buildings. Cloud forest vegetation, the Urubamba River far below, dramatic Andean peaks wreathed in mist. Historically accurate Inca architecture and dress, photorealistic, no text or watermarks' },
  { id: 'fall-constantinople', year: 1453, lat: 41.0082, lng: 28.9784, locationName: 'Constantinople, Byzantine Empire', eventName: 'Fall of Constantinople', era: 'Medieval',
    prompt: 'Cinematic shot of the Fall of Constantinople, May 29, 1453. Ottoman Sultan Mehmed II\'s massive army assaults the Theodosian Walls with the enormous Orban cannon. Janissaries in distinctive white bork hats with sipahi cavalry charge through a breach. Byzantine defenders in late Roman-style armor with the double-headed eagle standard make a last stand. The dome of Hagia Sophia visible in the background. Ottoman flags with the crescent. Ships in the Golden Horn. Historically accurate Ottoman and Byzantine military equipment, dramatic siege atmosphere, photorealistic, no text or watermarks' },
  { id: 'columbus', year: 1492, lat: 24.0500, lng: -74.5300, locationName: 'The Bahamas, Caribbean', eventName: 'Columbus arrives in the New World', era: 'Early Modern',
    prompt: 'Cinematic shot of Christopher Columbus\'s three ships—the Santa María (a carrack), the Pinta, and the Niña (caravels)—approaching San Salvador island on October 12, 1492. Historically accurate 15th century Spanish caravel rigging with lateen and square sails bearing red crosses of the Order of Christ. Spanish sailors in doublets and hose on deck. The Taíno people visible on the white sand beach among palm trees. Crystal blue Caribbean water. Columbus in a red cloak holds the royal standard of Castile and Aragon. Photorealistic, no text or watermarks' },
  { id: 'taj-mahal', year: 1643, lat: 27.1751, lng: 78.0421, locationName: 'Agra, Mughal Empire', eventName: 'Completion of the Taj Mahal', era: 'Early Modern',
    prompt: 'Cinematic shot of the newly completed Taj Mahal in Agra, 1643, commissioned by Mughal Emperor Shah Jahan. The white Makrana marble mausoleum with its iconic bulbous dome and four minarets. Pietra dura inlay of semi-precious stones—carnelian, lapis lazuli, jade—in floral patterns. The Charbagh garden with its reflecting pool perfectly mirroring the structure. Mughal nobles in jama coats and turbans with jeweled aigrettes. Calligraphic Quranic verses frame the grand archway. Historically accurate Mughal architecture and dress, golden sunrise light, photorealistic, no text or watermarks' },
  { id: 'american-revolution', year: 1776, lat: 39.9496, lng: -75.1503, locationName: 'Philadelphia, USA', eventName: 'Signing of the Declaration of Independence', era: 'Early Modern',
    prompt: 'Cinematic interior of the Assembly Room in the Pennsylvania State House (Independence Hall), July 4, 1776. Delegates of the Continental Congress in 18th century colonial attire—knee breeches, waistcoats, linen shirts, some with powdered wigs—gather around the document on a green baize-covered table. John Hancock signs prominently. The Rising Sun chair. Quill pens and inkwells. Sunlight through tall Georgian windows with their twelve-over-twelve panes. The original thirteen colony flags. Historically accurate colonial American setting, photorealistic, no text or watermarks' },
  { id: 'french-revolution', year: 1789, lat: 48.8534, lng: 2.3691, locationName: 'Paris, France', eventName: 'Storming of the Bastille', era: 'Early Modern',
    prompt: 'Cinematic shot of the Storming of the Bastille, July 14, 1789 in Paris. An angry mob of Parisian sans-culottes in working-class clothing—loose trousers instead of culottes, Phrygian caps, tricolor cockades—storms the medieval fortress prison. Smoke from musket fire. The drawbridge being lowered. French Guards who have defected to the revolution fire cannons at the fortress. The eight towers of the Bastille. Early tricolore flags (blue, white, red). Historically accurate late 18th century French clothing and architecture, dramatic overcast sky, photorealistic, no text or watermarks' },
  { id: 'waterloo', year: 1815, lat: 50.7143, lng: 4.4044, locationName: 'Waterloo, Belgium', eventName: 'Battle of Waterloo', era: 'Modern',
    prompt: 'Cinematic aerial shot of the Battle of Waterloo, June 18, 1815. The Duke of Wellington\'s Anglo-allied army in British red coats and shakos defends the ridge near La Haye Sainte farm against Napoleon\'s Grande Armée in blue coats with distinctive bicorne hats. French cuirassiers in steel breastplates and horsehair-plumed helmets charge British infantry squares. Cannon smoke drifts across the Belgian farmland. The Union Jack and French Tricolore visible. Prussian reinforcements arriving. Historically accurate Napoleonic-era uniforms and tactics, dramatic stormy sky, photorealistic, no text or watermarks' },
  { id: 'civil-war', year: 1863, lat: 39.8121, lng: -77.2268, locationName: 'Gettysburg, Pennsylvania', eventName: 'Battle of Gettysburg', era: 'Modern',
    prompt: 'Cinematic shot of the Battle of Gettysburg, July 1863. Union soldiers in dark blue kepi caps and sack coats fire Springfield rifled muskets from behind a stone wall on Cemetery Ridge. Confederate soldiers in butternut and grey advance across the open field during Pickett\'s Charge, carrying the Confederate battle flag (the Southern Cross). Artillery batteries fire Napoleon 12-pounders. White smoke blankets the Pennsylvania farmland. The town of Gettysburg and its seminary visible. Historically accurate American Civil War uniforms, equipment, and flags, photorealistic, no text or watermarks' },
  { id: 'eiffel-tower', year: 1889, lat: 48.8584, lng: 2.2945, locationName: 'Paris, France', eventName: 'Eiffel Tower opens for the World\'s Fair', era: 'Modern',
    prompt: 'Cinematic shot of the newly completed Eiffel Tower during the 1889 Exposition Universelle in Paris. The 300-meter wrought-iron lattice tower (originally painted reddish-brown, not grey) towers over the exhibition grounds on the Champ de Mars. Visitors in late Victorian attire—men in top hats and frock coats, women in bustled dresses—gather at its base. The Seine and Trocadéro palace visible. Gas-lit exhibition pavilions. The French Tricolore flies from the summit. Historically accurate 1889 Paris, warm golden afternoon light, photorealistic, no text or watermarks' },
  { id: 'd-day', year: 1944, lat: 49.3694, lng: -0.8731, locationName: 'Normandy, France', eventName: 'D-Day Invasion', era: 'Contemporary',
    prompt: 'Cinematic shot of the D-Day landings at Omaha Beach, June 6, 1944. American GIs of the 1st Infantry Division wade from Higgins boat LCVP landing craft through waist-deep surf onto the beach. Soldiers wear M1 steel helmets, OD green wool uniforms, and carry M1 Garand rifles and BAR automatic rifles. German MG42 machine gun fire from concrete bunkers on the bluffs. Czech hedgehog beach obstacles and Belgian gates in the surf. LST ships offshore. Barrage balloons overhead. Overcast Normandy sky. Historically accurate WWII equipment, uniforms, and vehicles, photorealistic, no text or watermarks' },
  { id: 'moon-landing', year: 1969, lat: 28.5721, lng: -80.6480, locationName: 'Cape Canaveral, Florida', eventName: 'Apollo 11 Launch', era: 'Contemporary',
    prompt: 'Cinematic shot of the Apollo 11 Saturn V rocket launching from Launch Complex 39A at Kennedy Space Center, July 16, 1969. The 363-foot rocket with its distinctive black-and-white roll pattern and "USA" lettering lifts off trailing a column of flame from its five F-1 engines. The red launch tower structure. VIP spectators 3 miles away watching through binoculars. The flat Florida marshland and Banana River reflecting the exhaust. CBS news cameras. 1960s cars in the parking areas. Historically accurate NASA Apollo program hardware, brilliant blue sky, photorealistic, no text or watermarks' },
  { id: 'berlin-wall-fall', year: 1989, lat: 52.5163, lng: 13.3777, locationName: 'Berlin, Germany', eventName: 'Fall of the Berlin Wall', era: 'Contemporary',
    prompt: 'Cinematic shot of the Fall of the Berlin Wall, November 9, 1989. Jubilant East and West Germans climb atop the 3.6-meter concrete wall at the Brandenburg Gate, chipping away with hammers and chisels. People in late 1980s clothing—denim jackets, leather jackets, mullets. Graffiti-covered western side of the wall. East German Trabant cars crossing through new openings. Champagne bottles being opened. West German deutschmarks being exchanged. The illuminated Brandenburg Gate and its quadriga sculpture. Television camera crews. Historically accurate 1989 Berlin, nighttime with dramatic floodlighting, photorealistic, no text or watermarks' },
  { id: 'wwi-trenches', year: 1916, lat: 50.0046, lng: 2.6839, locationName: 'The Somme, France', eventName: 'Battle of the Somme', era: 'Contemporary',
    prompt: 'Cinematic shot of the Battle of the Somme, 1916. British Tommies in Brodie steel helmets and khaki wool uniforms crouch in a muddy fire trench reinforced with sandbags and duckboards. Lee-Enfield rifles and Mills bomb grenades ready. A Lewis gun mounted on the parapet. No man\'s land visible through a periscope—a cratered wasteland of mud, barbed wire, and shattered tree stumps. Rum jar rations. Trench maps pinned to the revetment. A Sopwith Camel biplane passes overhead. Historically accurate WWI British equipment and trench construction, overcast grey sky, photorealistic, no text or watermarks' },
  { id: 'russian-revolution', year: 1917, lat: 59.9311, lng: 30.3609, locationName: 'St. Petersburg, Russia', eventName: 'Storming of the Winter Palace', era: 'Contemporary',
    prompt: 'Cinematic shot of the Storming of the Winter Palace in Petrograd, October 25, 1917. Bolshevik Red Guards in civilian clothing with red armbands and Mosin-Nagant rifles storm across Palace Square toward the baroque green-and-white Winter Palace. The cruiser Aurora fires a blank signal shot from the Neva River. Kerensky\'s Provisional Government defenders, women\'s battalion members among them. Revolutionary banners with hammer and sickle. Armored cars (Austin-Putilovets). Historically accurate Russian Revolution setting, dramatic winter twilight, photorealistic, no text or watermarks' },
  { id: 'hindenburg', year: 1937, lat: 40.0121, lng: -74.3265, locationName: 'Lakehurst, New Jersey', eventName: 'Hindenburg Disaster', era: 'Contemporary',
    prompt: 'Cinematic shot of the Hindenburg airship (LZ 129) approaching the mooring mast at Naval Air Station Lakehurst, New Jersey, May 6, 1937. The enormous 804-foot silver zeppelin with its red Nazi swastika tail fins and "D-LZ129" markings dwarfs everything below. Ground crew of US Navy sailors hold mooring lines. Spectators in 1930s clothing with press photographers. 1930s automobiles parked nearby. The metal mooring mast. Overcast stormy sky. Historically accurate 1937 setting with correct Hindenburg markings and proportions, photorealistic, no text or watermarks' },
  { id: 'roaring-twenties', year: 1925, lat: 40.7580, lng: -73.9855, locationName: 'New York City, USA', eventName: 'The Roaring Twenties in New York', era: 'Contemporary',
    prompt: 'Cinematic shot of Times Square, New York City, 1925. Art Deco theater marquees and electric advertising signs illuminate the night. Model T Fords and yellow checkered taxis on Broadway. Men in fedora hats, double-breasted suits, and spats. Women in beaded flapper dresses with bobbed hair and cloche hats. A speakeasy entrance visible down a side alley. The Times Building. Jazz music atmosphere. Prohibition-era New York energy. Historically accurate 1920s American fashion, architecture, and automobiles, vibrant nighttime lighting, photorealistic, no text or watermarks' },
  { id: 'industrial-london', year: 1850, lat: 51.5074, lng: -0.1278, locationName: 'London, England', eventName: 'Industrial Revolution London', era: 'Modern',
    prompt: 'Cinematic shot of London during the height of the Industrial Revolution, circa 1850. The skyline dominated by smoking factory chimneys and the Crystal Palace under construction. A steam locomotive crosses an iron railway bridge. Horse-drawn omnibuses and hansom cabs on cobblestone streets. Workers in cloth caps and women in crinoline dresses. Gas street lamps being lit. The Thames with paddle steamers and wherries. St Paul\'s Cathedral dome visible through the smog. Historically accurate mid-Victorian London with correct period clothing and transport, hazy diffused light, photorealistic, no text or watermarks' },
  { id: 'samurai-sekigahara', year: 1600, lat: 35.3657, lng: 136.4618, locationName: 'Sekigahara, Japan', eventName: 'Battle of Sekigahara', era: 'Early Modern',
    prompt: 'Cinematic shot of the Battle of Sekigahara, October 21, 1600. Tokugawa Ieyasu\'s Eastern Army clashes with the Western Army loyal to Toyotomi in a misty valley. Samurai in full yoroi armor with distinctive clan mon crests on their sashimono back banners charge with katanas and yari spears. Ashigaru foot soldiers in jingasa hats fire tanegashima matchlock arquebus rifles in volley formations. Uma-jirushi horse standards identify each clan. The fog-shrouded Japanese mountain valley of Sekigahara. Historically accurate Sengoku-period Japanese military equipment, photorealistic, no text or watermarks' },
  { id: 'versailles', year: 1682, lat: 48.8049, lng: 2.1204, locationName: 'Versailles, France', eventName: 'Court of Louis XIV at Versailles', era: 'Early Modern',
    prompt: 'Cinematic shot of the Palace of Versailles in 1682 as Louis XIV moves the French court there. The Hall of Mirrors with its 357 mirrors and crystal chandeliers lit by thousands of candles. French aristocrats in elaborate Baroque clothing—men in justaucorps coats with lace cravats and full-bottomed wigs, women in grand habit court dresses with fontange headdresses. The geometric André Le Nôtre gardens with the Grand Canal visible through the windows. The gold-leafed gates. Historically accurate late 17th century French court fashion and Baroque architecture, warm candlelight, photorealistic, no text or watermarks' },
  { id: 'boston-tea-party', year: 1773, lat: 42.3521, lng: -71.0551, locationName: 'Boston, Massachusetts', eventName: 'Boston Tea Party', era: 'Early Modern',
    prompt: 'Cinematic nighttime shot of the Boston Tea Party, December 16, 1773. Members of the Sons of Liberty crudely disguised with blankets and soot (not elaborate costumes—historically accurate) board three East India Company ships—the Dartmouth, Eleanor, and Beaver—at Griffin\'s Wharf. They smash open wooden tea chests stamped with the East India Company logo and dump 342 chests of British tea into Boston Harbor. Colonial-era Boston waterfront with brick warehouses. Men in tricorn hats and colonial clothing. Torchlight reflecting on dark harbor water. Historically accurate colonial American setting, photorealistic, no text or watermarks' },
  { id: 'wright-brothers', year: 1903, lat: 36.0146, lng: -75.6672, locationName: 'Kitty Hawk, North Carolina', eventName: 'First Powered Flight', era: 'Contemporary',
    prompt: 'Cinematic shot of the Wright Flyer making its historic first powered flight at Kill Devil Hills, North Carolina, December 17, 1903. The fragile biplane with its white muslin-covered spruce frame and 12-horsepower gasoline engine lifts off the wooden launch rail. Orville Wright lies prone at the controls while Wilbur runs alongside. The five witnesses—members of the Kill Devil Hills Life-Saving Station—watch in their period clothing. Sandy dunes and sea oats, the Atlantic Ocean in the background. Historically accurate Wright Flyer design with correct dual-propeller configuration, overcast winter sky, photorealistic, no text or watermarks' },
  { id: 'titanic', year: 1912, lat: 51.8451, lng: -1.3098, locationName: 'Southampton, England', eventName: 'RMS Titanic Departs Southampton', era: 'Contemporary',
    prompt: 'Cinematic shot of RMS Titanic departing Southampton on April 10, 1912. The 882-foot White Star Line ocean liner with its four distinctive buff-and-black funnels (the fourth is a dummy for ventilation—historically accurate) dominates the dock. First-class passengers in Edwardian clothing—women in large hats and hobble skirts, men in morning coats—wave from the Boat Deck. Third-class passengers in simpler clothing board via the lower gangways. Tugboats guide the ship. The dock crowded with well-wishers. Historically accurate 1912 Edwardian setting, overcast English sky, photorealistic, no text or watermarks' },
  { id: 'gold-rush', year: 1849, lat: 38.2968, lng: -120.7735, locationName: 'Sierra Nevada, California', eventName: 'California Gold Rush', era: 'Modern',
    prompt: 'Cinematic shot of the California Gold Rush, 1849. Forty-niners pan for gold in a Sierra Nevada mountain stream using tin pans and wooden sluice boxes and rockers. A rough mining camp of canvas tents and log cabins along the riverbank. Miners in flannel shirts, denim trousers (early Levi\'s), wide-brimmed felt hats, and tall boots. Pack mules loaded with supplies. Chinese miners in traditional clothing working a separate claim. Pine forest and granite mountain terrain. Historically accurate 1849 California mining equipment and clothing, golden afternoon light, photorealistic, no text or watermarks' },
  { id: 'ellis-island', year: 1892, lat: 40.6995, lng: -74.0395, locationName: 'New York Harbor, USA', eventName: 'Ellis Island Opens for Immigration', era: 'Modern',
    prompt: 'Cinematic shot of immigrants arriving at Ellis Island, 1892. A crowded steamship enters New York Harbor with the Statue of Liberty (green patina already forming on copper) visible. Immigrants on deck—Eastern European Jews in shtetl clothing, Italian families, Irish immigrants—clutch bundles and battered suitcases. The red-brick Main Building of Ellis Island processing center. Ferries shuttle between the island and Manhattan\'s Battery. The Lower Manhattan skyline of 1890s buildings (no skyscrapers yet). Historically accurate late 19th century immigrant clothing and ships, golden morning light, photorealistic, no text or watermarks' },
];

// ─── In-memory game store ───

const games = new Map();

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateScore(guessYear, guessLat, guessLng, correctYear, correctLat, correctLng) {
  const distanceKm = haversineDistance(guessLat, guessLng, correctLat, correctLng);
  const yearDiff = Math.abs(guessYear - correctYear);
  const locationScore = Math.round(5000 * Math.max(0, 1 - distanceKm / 20000));
  const timeScore = Math.round(5000 * Math.max(0, 1 - yearDiff / 500));
  return { locationScore, timeScore, totalScore: locationScore + timeScore, distanceKm: Math.round(distanceKm), yearDiff };
}

function pickRandomEvents(count) {
  const shuffled = [...EVENTS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ─── Video Generation ───

async function hfPoll(requestId) {
  const maxPolls = 200;
  let errors = 0;

  for (let i = 0; i < maxPolls; i++) {
    await new Promise(r => setTimeout(r, 3000));
    try {
      const res = await fetch(`${HF_BASE}/requests/${requestId}/status`, {
        headers: { 'Authorization': HF_AUTH }
      });
      const d = await res.json();
      errors = 0;
      if (d.status === 'completed') return d;
      if (d.status === 'failed' || d.status === 'nsfw') throw new Error(`Generation ${d.status}`);
    } catch (err) {
      if (err.message.includes('Generation')) throw err;
      errors++;
      if (errors >= 10) throw new Error(`Poll errors: ${err.message}`);
    }
  }
  throw new Error('Timed out');
}

async function generateImageThenVideo(prompt) {
  console.log(`[Higgsfield] Step 1: Generating image...`);
  const imgRes = await fetch(`${HF_BASE}/${IMG_MODEL}`, {
    method: 'POST',
    headers: { 'Authorization': HF_AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, aspect_ratio: '16:9', resolution: '1k' })
  });
  const imgTask = await imgRes.json();
  if (!imgRes.ok) throw new Error(imgTask.detail || JSON.stringify(imgTask));
  console.log(`[Higgsfield] Image queued: ${imgTask.request_id}`);

  const imgResult = await hfPoll(imgTask.request_id);
  const imageUrl = imgResult.images?.[0]?.url;
  if (!imageUrl) throw new Error('No image URL in result');
  console.log(`[Higgsfield] Image ready: ${imageUrl.substring(0, 60)}...`);

  console.log(`[Higgsfield] Step 2: Generating video from image...`);
  const vidRes = await fetch(`${HF_BASE}/${VID_MODEL}`, {
    method: 'POST',
    headers: { 'Authorization': HF_AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: imageUrl,
      prompt: 'Cinematic slow camera movement through the scene, subtle motion and atmosphere, photorealistic',
      duration: 10
    })
  });
  const vidTask = await vidRes.json();
  if (!vidRes.ok) throw new Error(vidTask.detail || JSON.stringify(vidTask));
  console.log(`[Higgsfield] Video queued: ${vidTask.request_id}`);

  const vidResult = await hfPoll(vidTask.request_id);
  const videoUrl = vidResult.video?.url;
  if (!videoUrl) throw new Error('No video URL in result');
  console.log(`[Higgsfield] Video ready`);
  return videoUrl;
}

async function generateVideo(round, retries = 2) {
  const cached = getCachedVideo(round.event.id);
  if (cached) {
    round.videoUrl = cached;
    round.videoStatus = 'ready';
    console.log(`[Round ${round.event.id}] Served from cache`);
    return;
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      round.videoStatus = 'generating';
      round.videoError = null;
      console.log(`[Round ${round.event.id}] Generating (attempt ${attempt + 1})...`);
      const remoteUrl = await generateImageThenVideo(round.event.prompt);
      const localUrl = await downloadAndCache(round.event.id, remoteUrl);
      round.videoUrl = localUrl;
      round.videoStatus = 'ready';
      console.log(`[Round ${round.event.id}] Ready (cached locally)`);
      return;
    } catch (err) {
      console.error(`[Round ${round.event.id}] Attempt ${attempt + 1} failed: ${err.message}`);
      if (attempt < retries) {
        console.log(`[Round ${round.event.id}] Retrying in 5s...`);
        await new Promise(r => setTimeout(r, 5000));
      } else {
        round.videoStatus = 'failed';
        round.videoError = err.message;
      }
    }
  }
}

// ─── Game API ───

app.post('/api/game/new', (req, res) => {
  const events = pickRandomEvents(5);
  const gameId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const game = {
    id: gameId,
    rounds: events.map((event, i) => ({
      index: i, event,
      videoStatus: 'pending', videoUrl: null, videoError: null,
      guess: null, score: null
    })),
    currentRound: 0, totalScore: 0, created: Date.now()
  };

  games.set(gameId, game);
  generateVideo(game.rounds[0]);

  console.log(`[Game ${gameId}] Started: ${events.map(e => e.id).join(', ')}`);
  res.json({ gameId, totalRounds: 5 });
});

app.get('/api/game/:id/round/:num', (req, res) => {
  const game = games.get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  const roundNum = parseInt(req.params.num);
  if (roundNum < 0 || roundNum >= game.rounds.length) return res.status(400).json({ error: 'Invalid round' });
  const round = game.rounds[roundNum];
  if (round.videoStatus === 'pending') generateVideo(round);
  res.json({ status: round.videoStatus, videoUrl: round.videoStatus === 'ready' ? round.videoUrl : null, error: round.videoStatus === 'failed' ? round.videoError : null });
});

app.post('/api/game/:id/round/:num/retry', (req, res) => {
  const game = games.get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  const roundNum = parseInt(req.params.num);
  if (roundNum < 0 || roundNum >= game.rounds.length) return res.status(400).json({ error: 'Invalid round' });
  const round = game.rounds[roundNum];
  round.videoStatus = 'pending'; round.videoError = null; round.videoUrl = null;
  generateVideo(round);
  res.json({ status: 'retrying' });
});

app.post('/api/game/:id/round/:num/guess', (req, res) => {
  const game = games.get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  const roundNum = parseInt(req.params.num);
  if (roundNum < 0 || roundNum >= game.rounds.length) return res.status(400).json({ error: 'Invalid round' });

  const round = game.rounds[roundNum];
  const { year, lat, lng } = req.body;
  if (year == null || lat == null || lng == null) return res.status(400).json({ error: 'year, lat, lng required' });

  const score = calculateScore(year, lat, lng, round.event.year, round.event.lat, round.event.lng);
  round.guess = { year, lat, lng };
  round.score = score;
  game.totalScore += score.totalScore;
  game.currentRound = roundNum + 1;

  if (roundNum + 1 < game.rounds.length && game.rounds[roundNum + 1].videoStatus === 'pending') {
    generateVideo(game.rounds[roundNum + 1]);
  }

  console.log(`[Game ${game.id}] Round ${roundNum}: ${score.totalScore} pts (${score.distanceKm}km, ${score.yearDiff}yr)`);

  res.json({
    locationScore: score.locationScore, timeScore: score.timeScore, totalScore: score.totalScore,
    distanceKm: score.distanceKm, yearDiff: score.yearDiff,
    correctYear: round.event.year, correctLat: round.event.lat, correctLng: round.event.lng,
    correctLocationName: round.event.locationName, correctEventName: round.event.eventName,
    correctEra: round.event.era,
    gameTotalScore: game.totalScore, gameComplete: game.currentRound >= game.rounds.length
  });
});

app.get('/api/game/:id/results', (req, res) => {
  const game = games.get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  res.json({
    gameId: game.id, totalScore: game.totalScore, maxScore: 50000,
    rounds: game.rounds.map(r => ({
      eventName: r.score ? r.event.eventName : null, locationName: r.score ? r.event.locationName : null,
      correctYear: r.score ? r.event.year : null, correctLat: r.score ? r.event.lat : null, correctLng: r.score ? r.event.lng : null,
      guess: r.guess, score: r.score
    }))
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`HistoryGuessr running at http://localhost:${PORT}`);
  console.log(`${EVENTS.length} events, ${Object.keys(videoCache).length} cached videos`);
});
