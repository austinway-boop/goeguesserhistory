require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { Agent, setGlobalDispatcher } = require('undici');

setGlobalDispatcher(new Agent({ connections: 100, pipelining: 1 }));

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const FAL_KEY = process.env.FAL_KEY;
const FAL_QUEUE_URL = 'https://queue.fal.run';
const VIDEO_MODEL = 'fal-ai/kling-video/v2/master/text-to-video';

// ─── Curated Historical Events ───

const EVENTS = [
  // Ancient
  { id: 'giza', year: -2560, lat: 29.9792, lng: 31.1342, locationName: 'Giza, Egypt', eventName: 'Construction of the Great Pyramid', era: 'Ancient',
    prompt: 'Cinematic wide shot of massive stone pyramids being constructed in the desert, thousands of workers hauling limestone blocks on ramps, wooden sledges and rollers, the Nile river visible in the background, golden desert sunlight, dust in the air, photorealistic, no text or watermarks' },
  { id: 'babylon', year: -600, lat: 32.5363, lng: 44.4209, locationName: 'Babylon, Mesopotamia', eventName: 'Hanging Gardens of Babylon', era: 'Ancient',
    prompt: 'Cinematic view of a grand ancient Mesopotamian city with terraced gardens overflowing with lush green plants and cascading water, massive ziggurat in the background, mudbrick buildings, palm trees, warm golden light, photorealistic, no text or watermarks' },
  { id: 'parthenon', year: -438, lat: 37.9715, lng: 23.7267, locationName: 'Athens, Greece', eventName: 'Completion of the Parthenon', era: 'Ancient',
    prompt: 'Cinematic view of a grand marble temple atop a rocky hill overlooking an ancient Mediterranean city, massive Doric columns gleaming white, citizens in draped garments walking along stone paths, olive trees, bright blue sky, photorealistic, no text or watermarks' },
  { id: 'alexander', year: -331, lat: 36.3566, lng: 43.1590, locationName: 'Gaugamela, Persia', eventName: 'Battle of Gaugamela', era: 'Ancient',
    prompt: 'Cinematic aerial shot of a vast ancient battlefield on open plains, two massive armies clashing with cavalry charges and infantry formations, dust clouds rising, bronze armor and spears glinting in sunlight, dramatic sky, photorealistic, no text or watermarks' },
  { id: 'great-wall', year: -210, lat: 40.4319, lng: 116.5704, locationName: 'Northern China', eventName: 'Construction of the Great Wall', era: 'Ancient',
    prompt: 'Cinematic aerial shot of a massive stone fortification wall snaking across mountainous green terrain, workers building and extending the wall, watchtowers at intervals, misty mountains in the distance, morning light, photorealistic, no text or watermarks' },
  { id: 'rome-forum', year: -44, lat: 41.8925, lng: 12.4853, locationName: 'Rome, Roman Republic', eventName: 'The Roman Forum at its peak', era: 'Ancient',
    prompt: 'Cinematic first-person view walking through the bustling center of an ancient city, grand marble temples and columns, senators in white togas debating, market stalls with merchants, cobblestone streets, warm Mediterranean sunlight, photorealistic, no text or watermarks' },
  { id: 'colosseum', year: 80, lat: 41.8902, lng: 12.4922, locationName: 'Rome, Roman Empire', eventName: 'Opening of the Colosseum', era: 'Ancient',
    prompt: 'Cinematic interior view of a massive oval amphitheater packed with spectators, gladiators on the sand floor, towering stone arches and columns, awnings stretched overhead for shade, crowd cheering, dust in the air, warm light, photorealistic, no text or watermarks' },
  { id: 'pompeii', year: 79, lat: 40.7484, lng: 14.4848, locationName: 'Pompeii, Roman Empire', eventName: 'Eruption of Mount Vesuvius', era: 'Ancient',
    prompt: 'Cinematic dramatic shot of a massive volcanic eruption raining ash and fire onto a Roman coastal city, citizens fleeing through streets, dark ash cloud towering into the sky, buildings collapsing, orange lava glow against dark sky, photorealistic, no text or watermarks' },
  { id: 'petra', year: -100, lat: 30.3285, lng: 35.4444, locationName: 'Petra, Nabataea', eventName: 'Petra at its height', era: 'Ancient',
    prompt: 'Cinematic shot of an elaborate temple facade carved directly into towering red sandstone cliffs, a narrow canyon entrance, merchant caravans with camels, figures in flowing robes, warm desert light casting dramatic shadows, photorealistic, no text or watermarks' },
  { id: 'teotihuacan', year: 200, lat: 19.6925, lng: -98.8438, locationName: 'Teotihuacan, Mesoamerica', eventName: 'Teotihuacan at its peak', era: 'Ancient',
    prompt: 'Cinematic aerial shot of a massive ancient city centered on a wide avenue lined with enormous stepped pyramids, the largest pyramid dominating the skyline, colorful murals on buildings, thousands of people in the plazas, lush green valley surroundings, photorealistic, no text or watermarks' },
  { id: 'constantinople', year: 330, lat: 41.0082, lng: 28.9784, locationName: 'Constantinople, Byzantine Empire', eventName: 'Founding of Constantinople', era: 'Ancient',
    prompt: 'Cinematic panoramic view of a grand new imperial city on a peninsula between two seas, massive walls under construction, domed basilicas, Roman-style colonnaded streets, ships in the harbor, golden light reflecting off water, photorealistic, no text or watermarks' },

  // Medieval
  { id: 'viking-lindisfarne', year: 793, lat: 55.6690, lng: -1.8010, locationName: 'Lindisfarne, England', eventName: 'Viking Raid on Lindisfarne', era: 'Medieval',
    prompt: 'Cinematic dramatic shot of longships with carved dragon prows arriving on a misty coastline near a stone monastery, Norse warriors leaping from boats onto a rocky beach, waves crashing, overcast sky, morning fog, photorealistic, no text or watermarks' },
  { id: 'viking-settlement', year: 870, lat: 64.1466, lng: -21.9426, locationName: 'Iceland', eventName: 'Norse Settlement of Iceland', era: 'Medieval',
    prompt: 'Cinematic shot of Norse settlers building turf longhouses on a dramatic volcanic landscape, geysers steaming in the background, rugged cliffs and waterfalls, sheep grazing, longship beached on black sand shore, overcast subarctic light, photorealistic, no text or watermarks' },
  { id: 'angkor-wat', year: 1150, lat: 13.4125, lng: 103.8670, locationName: 'Angkor, Khmer Empire', eventName: 'Angkor Wat at its peak', era: 'Medieval',
    prompt: 'Cinematic aerial shot of an enormous stone temple complex with towering spires reflected in a vast moat, intricate carvings on every surface, lush tropical jungle surrounding it, monks in saffron robes walking along causeways, golden sunrise light, photorealistic, no text or watermarks' },
  { id: 'notre-dame', year: 1200, lat: 48.8530, lng: 2.3499, locationName: 'Paris, France', eventName: 'Construction of Notre-Dame Cathedral', era: 'Medieval',
    prompt: 'Cinematic shot of a massive Gothic cathedral under construction with wooden scaffolding, flying buttresses and pointed arches taking shape, medieval workers hoisting stones with cranes, a river flowing beside it, overcast European sky, photorealistic, no text or watermarks' },
  { id: 'genghis-khan', year: 1220, lat: 39.6542, lng: 66.9597, locationName: 'Samarkand, Central Asia', eventName: 'Mongol Siege of Samarkand', era: 'Medieval',
    prompt: 'Cinematic wide shot of a vast mounted army on the Central Asian steppe surrounding a walled city with blue-tiled domes, siege engines and catapults, dust clouds from thousands of horses, dramatic golden hour light across endless grasslands, photorealistic, no text or watermarks' },
  { id: 'black-death', year: 1348, lat: 51.5074, lng: -0.1278, locationName: 'London, England', eventName: 'The Black Death reaches London', era: 'Medieval',
    prompt: 'Cinematic dark shot of a medieval European city in crisis, empty cobblestone streets, wooden carts, shuttered buildings with painted crosses on doors, smoke from burning pyres, overcast grey sky, grim atmosphere, photorealistic, no text or watermarks' },
  { id: 'forbidden-city', year: 1420, lat: 39.9163, lng: 116.3972, locationName: 'Beijing, Ming Dynasty', eventName: 'Completion of the Forbidden City', era: 'Medieval',
    prompt: 'Cinematic aerial shot of an enormous imperial palace complex with golden-tiled roofs and red walls, perfectly symmetrical courtyards, ornate gates and halls, officials in silk robes crossing marble bridges, misty morning light, photorealistic, no text or watermarks' },
  { id: 'machu-picchu', year: 1450, lat: -13.1631, lng: -72.5450, locationName: 'Andes Mountains, Inca Empire', eventName: 'Construction of Machu Picchu', era: 'Medieval',
    prompt: 'Cinematic aerial shot of a stone citadel built on a mountain ridge above the clouds, terraced agricultural platforms stepping down steep slopes, precisely fitted stone walls without mortar, llamas on the terraces, dramatic Andean peaks shrouded in mist, photorealistic, no text or watermarks' },
  { id: 'fall-constantinople', year: 1453, lat: 41.0082, lng: 28.9784, locationName: 'Constantinople, Byzantine Empire', eventName: 'Fall of Constantinople', era: 'Medieval',
    prompt: 'Cinematic dramatic shot of a massive siege against towering stone walls of an ancient city, cannons firing, soldiers scaling walls with ladders, ships in the harbor, massive dome of a basilica in the background, smoke and fire, dramatic sunset sky, photorealistic, no text or watermarks' },
  { id: 'timbuktu', year: 1400, lat: 16.7735, lng: -3.0074, locationName: 'Timbuktu, Mali Empire', eventName: 'Timbuktu as center of learning', era: 'Medieval',
    prompt: 'Cinematic shot of a prosperous Saharan trading city with grand mudbrick mosques and minarets, scholars reading manuscripts in a courtyard, camel caravans arriving loaded with goods, golden desert light, vibrant market scene, photorealistic, no text or watermarks' },

  // Early Modern
  { id: 'columbus', year: 1492, lat: 24.0500, lng: -74.5300, locationName: 'The Bahamas, Caribbean', eventName: 'Columbus arrives in the New World', era: 'Early Modern',
    prompt: 'Cinematic shot of three wooden sailing ships with full sails approaching a tropical island with white sand beaches and palm trees, crystal blue Caribbean waters, sailors on deck pointing at land, bright tropical sunlight, photorealistic, no text or watermarks' },
  { id: 'sistine-chapel', year: 1512, lat: 41.9029, lng: 12.4545, locationName: 'Vatican City, Rome', eventName: 'Completion of the Sistine Chapel ceiling', era: 'Early Modern',
    prompt: 'Cinematic interior shot looking upward inside a grand Renaissance chapel, an artist on scaffolding painting elaborate frescoes on the vaulted ceiling, candles illuminating colorful scenes of human figures, marble walls, soft warm light filtering in, photorealistic, no text or watermarks' },
  { id: 'magellan', year: 1521, lat: 10.3157, lng: 123.8854, locationName: 'Cebu, Philippines', eventName: 'Magellan reaches the Philippines', era: 'Early Modern',
    prompt: 'Cinematic shot of weathered European sailing ships anchoring near a lush tropical island, small boats rowing to shore, indigenous people watching from the beach, dense jungle backdrop, turquoise waters, dramatic clouds, photorealistic, no text or watermarks' },
  { id: 'taj-mahal', year: 1643, lat: 27.1751, lng: 78.0421, locationName: 'Agra, Mughal Empire', eventName: 'Completion of the Taj Mahal', era: 'Early Modern',
    prompt: 'Cinematic shot of an immense white marble mausoleum with a perfectly symmetrical onion dome, reflecting pools and manicured gardens leading up to it, minarets at each corner, warm golden sunrise light making the marble glow, photorealistic, no text or watermarks' },
  { id: 'great-fire-london', year: 1666, lat: 51.5120, lng: -0.0877, locationName: 'London, England', eventName: 'Great Fire of London', era: 'Early Modern',
    prompt: 'Cinematic dramatic shot of a massive fire engulfing a dense medieval city of timber buildings, flames leaping between narrow streets, citizens fleeing with belongings, the River Thames reflecting the orange inferno, thick smoke billowing, nighttime, photorealistic, no text or watermarks' },
  { id: 'versailles', year: 1682, lat: 48.8049, lng: 2.1204, locationName: 'Versailles, France', eventName: 'Court moves to Versailles', era: 'Early Modern',
    prompt: 'Cinematic shot of an impossibly grand Baroque palace with golden gates, endless formal gardens with geometric hedges and fountains, aristocrats in elaborate silk clothing strolling the grounds, horse-drawn carriages, warm afternoon light, photorealistic, no text or watermarks' },
  { id: 'boston-tea-party', year: 1773, lat: 42.3521, lng: -71.0551, locationName: 'Boston, Massachusetts', eventName: 'Boston Tea Party', era: 'Early Modern',
    prompt: 'Cinematic nighttime shot of colonial men disguised in indigenous clothing boarding merchant ships in a harbor, throwing wooden crates of cargo into dark water, torchlight reflecting on the harbor, colonial buildings along the wharf, tense atmosphere, photorealistic, no text or watermarks' },
  { id: 'american-revolution', year: 1776, lat: 39.9496, lng: -75.1503, locationName: 'Philadelphia, USA', eventName: 'Signing of the Declaration of Independence', era: 'Early Modern',
    prompt: 'Cinematic interior shot of a grand colonial assembly hall, men in 18th century attire with powdered wigs gathered around a large document on a table, quill pens, candelabras, wooden floors, sunlight streaming through tall windows, photorealistic, no text or watermarks' },
  { id: 'french-revolution', year: 1789, lat: 48.8534, lng: 2.3691, locationName: 'Paris, France', eventName: 'Storming of the Bastille', era: 'Early Modern',
    prompt: 'Cinematic dramatic shot of an angry crowd storming a medieval stone fortress with towers, smoke from muskets, cobblestone streets of a European city, revolutionary banners waving, overcast sky, chaotic energy, photorealistic, no text or watermarks' },
  { id: 'napoleon-egypt', year: 1798, lat: 30.0444, lng: 31.2357, locationName: 'Cairo, Egypt', eventName: 'Napoleon in Egypt', era: 'Early Modern',
    prompt: 'Cinematic shot of a European army in blue uniforms with cannons and cavalry facing ancient pyramids in the desert, soldiers on horseback surveying the landscape, Egyptian villages along a great river, blazing desert sun, photorealistic, no text or watermarks' },

  // Modern (19th century)
  { id: 'waterloo', year: 1815, lat: 50.7143, lng: 4.4044, locationName: 'Waterloo, Belgium', eventName: 'Battle of Waterloo', era: 'Modern',
    prompt: 'Cinematic aerial shot of a massive battle on rolling green farmland, infantry squares, cavalry charges, cannon smoke drifting across the field, thousands of soldiers in Napoleonic-era uniforms, dramatic stormy sky, photorealistic, no text or watermarks' },
  { id: 'gold-rush', year: 1849, lat: 38.2968, lng: -120.7735, locationName: 'Sierra Nevada, California', eventName: 'California Gold Rush', era: 'Modern',
    prompt: 'Cinematic shot of prospectors panning for gold in a mountain river, makeshift wooden mining camps on hillsides, mules carrying equipment, pine forests and rugged mountain terrain, golden afternoon light, dust and grit, photorealistic, no text or watermarks' },
  { id: 'industrial-london', year: 1850, lat: 51.5074, lng: -0.1278, locationName: 'London, England', eventName: 'Industrial Revolution London', era: 'Modern',
    prompt: 'Cinematic shot of a Victorian-era industrial city with smoking factory chimneys, steam trains crossing iron bridges, horse-drawn carriages on cobblestone streets, gas lamps, workers in period clothing, hazy sky from coal smoke, photorealistic, no text or watermarks' },
  { id: 'civil-war', year: 1863, lat: 39.8121, lng: -77.2268, locationName: 'Gettysburg, Pennsylvania', eventName: 'Battle of Gettysburg', era: 'Modern',
    prompt: 'Cinematic dramatic shot of a massive battle across farmland and rolling hills, lines of soldiers in blue and grey uniforms firing muskets, cannon smoke, stone walls as cover, a small town visible in the distance, American Civil War era, photorealistic, no text or watermarks' },
  { id: 'transcontinental-railroad', year: 1869, lat: 41.6180, lng: -112.5516, locationName: 'Promontory Summit, Utah', eventName: 'Completion of the Transcontinental Railroad', era: 'Modern',
    prompt: 'Cinematic shot of two steam locomotives facing each other on railroad tracks meeting at a point in a vast Western American desert landscape, crowds of workers celebrating, barren hills and scrubland, golden hour light, photorealistic, no text or watermarks' },
  { id: 'eiffel-tower', year: 1889, lat: 48.8584, lng: 2.2945, locationName: 'Paris, France', eventName: 'Eiffel Tower opens', era: 'Modern',
    prompt: 'Cinematic shot of a massive iron lattice tower freshly constructed, crowds in Victorian-era clothing gathering at its base for an exhibition, European city rooftops stretching to the horizon, a river nearby, warm golden light, photorealistic, no text or watermarks' },
  { id: 'ellis-island', year: 1892, lat: 40.6995, lng: -74.0395, locationName: 'New York Harbor, USA', eventName: 'Ellis Island opens for immigration', era: 'Modern',
    prompt: 'Cinematic shot of a crowded steamship arriving in a harbor with a massive green statue holding a torch visible in the background, immigrants on deck looking at the skyline, a grand red-brick processing building on an island, golden morning light, photorealistic, no text or watermarks' },
  { id: 'klondike', year: 1897, lat: 63.8661, lng: -139.1168, locationName: 'Dawson City, Yukon', eventName: 'Klondike Gold Rush', era: 'Modern',
    prompt: 'Cinematic shot of a long line of prospectors climbing a steep snowy mountain pass in single file, heavy packs on their backs, frozen wilderness stretching endlessly, wooden sled dogs, harsh winter conditions, dramatic mountain landscape, photorealistic, no text or watermarks' },

  // 20th Century
  { id: 'wright-brothers', year: 1903, lat: 36.0146, lng: -75.6672, locationName: 'Kitty Hawk, North Carolina', eventName: 'First powered flight', era: 'Contemporary',
    prompt: 'Cinematic shot of a fragile wooden biplane with fabric wings lifting off a sandy beach for the first time, men in early 1900s clothing watching in amazement, flat sandy dunes and ocean in the background, strong coastal wind, overcast winter sky, photorealistic, no text or watermarks' },
  { id: 'titanic', year: 1912, lat: 51.8451, lng: -1.3098, locationName: 'Southampton, England', eventName: 'RMS Titanic departs', era: 'Contemporary',
    prompt: 'Cinematic shot of an enormous ocean liner with four smokestacks departing a busy port, thousands of passengers waving from the decks, tugboats guiding the ship, crowds on the dock, early 20th century clothing and cars, overcast sky, photorealistic, no text or watermarks' },
  { id: 'wwi-trenches', year: 1916, lat: 50.0046, lng: 2.6839, locationName: 'The Somme, France', eventName: 'Battle of the Somme', era: 'Contemporary',
    prompt: 'Cinematic shot of a muddy World War I trench system stretching across devastated farmland, soldiers in helmets and heavy coats crouching in trenches, barbed wire and shell craters in no-mans-land, overcast grey sky, smoke and fog, photorealistic, no text or watermarks' },
  { id: 'russian-revolution', year: 1917, lat: 59.9311, lng: 30.3609, locationName: 'St. Petersburg, Russia', eventName: 'Russian Revolution', era: 'Contemporary',
    prompt: 'Cinematic shot of a massive crowd of workers and soldiers storming an ornate Baroque palace, red banners waving, cobblestone streets, armored cars, a river with grand bridges, snow on the ground, dramatic winter sky, photorealistic, no text or watermarks' },
  { id: 'roaring-twenties', year: 1925, lat: 40.7580, lng: -73.9855, locationName: 'New York City, USA', eventName: 'The Roaring Twenties', era: 'Contemporary',
    prompt: 'Cinematic shot of a bustling 1920s city street at night with Art Deco skyscrapers, neon signs, Model T automobiles, jazz club marquees, men in fedoras and women in flapper dresses, steam rising from manhole covers, vibrant nightlife energy, photorealistic, no text or watermarks' },
  { id: 'hindenburg', year: 1937, lat: 40.0121, lng: -74.3265, locationName: 'Lakehurst, New Jersey', eventName: 'Hindenburg Disaster', era: 'Contemporary',
    prompt: 'Cinematic dramatic shot of an enormous silver airship approaching a mooring mast at a military airfield, ground crew waiting below, stormy sky in the background, 1930s vehicles and people, the vast scale of the airship dwarfing everything below, photorealistic, no text or watermarks' },
  { id: 'd-day', year: 1944, lat: 49.3694, lng: -0.8731, locationName: 'Normandy, France', eventName: 'D-Day Invasion', era: 'Contemporary',
    prompt: 'Cinematic dramatic shot of thousands of soldiers wading from landing craft onto a wide beach under heavy fire, explosions in the sand, naval ships offshore, steel beach obstacles, overcast sky, chaos and bravery, World War II era, photorealistic, no text or watermarks' },
  { id: 'hiroshima', year: 1945, lat: 34.3853, lng: 132.4553, locationName: 'Hiroshima, Japan', eventName: 'Hiroshima before the bomb', era: 'Contemporary',
    prompt: 'Cinematic aerial shot of a mid-century Japanese city with traditional wooden buildings and modern concrete structures, a river delta with multiple bridges, streetcars, civilians going about daily life, a military dome building visible, clear summer morning, photorealistic, no text or watermarks' },
  { id: 'berlin-wall-built', year: 1961, lat: 52.5163, lng: 13.3777, locationName: 'Berlin, Germany', eventName: 'Berlin Wall construction', era: 'Contemporary',
    prompt: 'Cinematic shot of soldiers and workers constructing a concrete barrier wall through the middle of a European city, barbed wire being strung, families separated on either side, armed guards, grey overcast sky, divided city, Cold War tension, photorealistic, no text or watermarks' },
  { id: 'moon-landing', year: 1969, lat: 28.5721, lng: -80.6480, locationName: 'Cape Canaveral, Florida', eventName: 'Apollo 11 Moon Landing', era: 'Contemporary',
    prompt: 'Cinematic shot of a massive Saturn V rocket launching from a coastal launchpad, enormous clouds of smoke and flame, spectators watching from miles away, marshland and water reflecting the rocket exhaust, brilliant blue sky, photorealistic, no text or watermarks' },
  { id: 'woodstock', year: 1969, lat: 41.7121, lng: -74.8788, locationName: 'Bethel, New York', eventName: 'Woodstock Festival', era: 'Contemporary',
    prompt: 'Cinematic aerial shot of a massive outdoor music festival on rolling green farmland, hundreds of thousands of people gathered before a distant stage, colorful tents and VW vans, a muddy hillside, peace signs, late 1960s counterculture atmosphere, warm summer light, photorealistic, no text or watermarks' },
  { id: 'berlin-wall-fall', year: 1989, lat: 52.5163, lng: 13.3777, locationName: 'Berlin, Germany', eventName: 'Fall of the Berlin Wall', era: 'Contemporary',
    prompt: 'Cinematic shot of jubilant crowds climbing on top of and breaking apart a concrete wall in the center of a European city at night, people with hammers and chisels, fireworks in the sky, emotional celebrations, graffiti-covered wall, dramatic lighting, photorealistic, no text or watermarks' },
  { id: 'tiananmen', year: 1989, lat: 39.9054, lng: 116.3976, locationName: 'Beijing, China', eventName: 'Tiananmen Square protests', era: 'Contemporary',
    prompt: 'Cinematic shot of a vast public square filled with thousands of peaceful student protesters, a tall monument in the center, a massive portrait on a gate building in the background, banners and flags, bicycles everywhere, overcast sky, photorealistic, no text or watermarks' },
  { id: 'mandela', year: 1990, lat: -33.9185, lng: 18.4244, locationName: 'Cape Town, South Africa', eventName: 'Nelson Mandela released from prison', era: 'Contemporary',
    prompt: 'Cinematic shot of a dignified man walking free from a prison gate to massive cheering crowds, African landscape, people celebrating in the streets, fists raised in triumph, bright South African sunlight, emotional atmosphere, photorealistic, no text or watermarks' },
  { id: 'hubble', year: 1990, lat: 28.5721, lng: -80.6480, locationName: 'Cape Canaveral, Florida', eventName: 'Hubble Space Telescope launch', era: 'Contemporary',
    prompt: 'Cinematic shot of a space shuttle launching from a coastal launchpad carrying a large telescope payload, twin solid rocket boosters blazing, massive exhaust clouds reflected in water, spectators watching from a distance, clear blue sky, photorealistic, no text or watermarks' },
  { id: 'channel-tunnel', year: 1994, lat: 51.0125, lng: 1.5197, locationName: 'English Channel', eventName: 'Channel Tunnel opens', era: 'Contemporary',
    prompt: 'Cinematic shot inside a massive undersea tunnel with high-speed trains passing through, engineering marvel of concrete and steel, workers celebrating, the white cliffs of a coastline visible at the tunnel entrance, dramatic engineering scale, photorealistic, no text or watermarks' },

  // Additional diverse events
  { id: 'easter-island', year: 1200, lat: -27.1127, lng: -109.3497, locationName: 'Easter Island, Polynesia', eventName: 'Moai statue construction', era: 'Medieval',
    prompt: 'Cinematic shot of enormous stone head statues being carved and transported across a grassy volcanic island in the Pacific, Polynesian workers using log rollers and ropes, dramatic ocean cliffs, isolated island landscape, overcast sky, photorealistic, no text or watermarks' },
  { id: 'zheng-he', year: 1405, lat: 32.0603, lng: 118.7969, locationName: 'Nanjing, Ming Dynasty China', eventName: 'Zheng He treasure fleet departs', era: 'Medieval',
    prompt: 'Cinematic shot of an enormous wooden treasure ship leading a vast fleet down a wide river, the ship dwarfing everything around it, nine masts with red silk sails, hundreds of smaller ships following, a grand walled city in the background, golden light, photorealistic, no text or watermarks' },
  { id: 'spanish-armada', year: 1588, lat: 50.3660, lng: -4.1424, locationName: 'English Channel', eventName: 'Defeat of the Spanish Armada', era: 'Early Modern',
    prompt: 'Cinematic shot of a massive naval battle between wooden warships, cannons firing broadside, sails billowing in stormy winds, fire ships drifting among the fleet, dark churning seas, dramatic storm clouds, photorealistic, no text or watermarks' },
  { id: 'samurai-sekigahara', year: 1600, lat: 35.3657, lng: 136.4618, locationName: 'Sekigahara, Japan', eventName: 'Battle of Sekigahara', era: 'Early Modern',
    prompt: 'Cinematic shot of two massive samurai armies clashing on a misty valley battlefield, warriors in ornate armor with katanas and spears, cavalry charges, war banners fluttering in fog, Japanese mountain landscape, dramatic morning mist, photorealistic, no text or watermarks' },
  { id: 'mughal-delhi', year: 1650, lat: 28.6562, lng: 77.2410, locationName: 'Delhi, Mughal Empire', eventName: 'Shah Jahan\'s Delhi at its peak', era: 'Early Modern',
    prompt: 'Cinematic shot of a grand Mughal city with a massive red sandstone fort, white marble mosques and palaces, bustling bazaars with merchants selling spices and silk, elephants carrying nobles, minarets on the skyline, warm golden light, photorealistic, no text or watermarks' },
  { id: 'maori-nz', year: 1350, lat: -38.1368, lng: 176.2497, locationName: 'New Zealand', eventName: 'Polynesian settlement of New Zealand', era: 'Medieval',
    prompt: 'Cinematic shot of large double-hulled Polynesian voyaging canoes arriving at a lush green coastline with dramatic mountains, Polynesian navigators looking at the new land, native forest and birds, volcanic landscape, ocean swells, overcast sky, photorealistic, no text or watermarks' },
  { id: 'zulu', year: 1879, lat: -28.3434, lng: 30.6505, locationName: 'Isandlwana, South Africa', eventName: 'Battle of Isandlwana', era: 'Modern',
    prompt: 'Cinematic shot of a massive Zulu army with shields and assegai spears charging across African grassland toward a British camp at the base of a dramatic rocky hill, dust rising, dramatic African landscape, intense afternoon sun, photorealistic, no text or watermarks' },
  { id: 'meiji-tokyo', year: 1890, lat: 35.6762, lng: 139.6503, locationName: 'Tokyo, Japan', eventName: 'Meiji-era modernization of Tokyo', era: 'Modern',
    prompt: 'Cinematic shot of a rapidly modernizing East Asian city mixing traditional wooden temples with new Western-style brick buildings, steam trains on elevated tracks, gas streetlights, rickshaws alongside horse carriages, cherry blossoms, photorealistic, no text or watermarks' },
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

// ─── Video Generation Helpers ───

async function submitVideoGeneration(prompt) {
  const body = {
    prompt,
    duration: '5',
    aspect_ratio: '16:9',
    negative_prompt: 'blur, distort, low quality, text, watermark, logo, modern elements, anachronistic',
    cfg_scale: 0.5
  };

  const response = await fetch(`${FAL_QUEUE_URL}/${VIDEO_MODEL}`, {
    method: 'POST',
    headers: { 'Authorization': `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'fal.ai API error');
  return data;
}

async function pollVideoStatus(statusUrl, responseUrl) {
  const maxPolls = 120;
  let consecutiveErrors = 0;

  for (let i = 0; i < maxPolls; i++) {
    await new Promise(r => setTimeout(r, 3000));

    try {
      const statusRes = await fetch(statusUrl, {
        headers: { 'Authorization': `Key ${FAL_KEY}` }
      });
      const statusData = await statusRes.json();
      consecutiveErrors = 0;

      if (statusData.status === 'COMPLETED') {
        const resultRes = await fetch(responseUrl, {
          headers: { 'Authorization': `Key ${FAL_KEY}` }
        });
        const resultData = await resultRes.json();
        const videoUrl = resultData.video?.url || resultData.video_url || resultData.output?.url;
        if (!videoUrl) {
          console.error('Unexpected result format:', JSON.stringify(resultData).substring(0, 500));
          throw new Error('No video URL in result');
        }
        return videoUrl;
      } else if (statusData.status === 'FAILED') {
        throw new Error('Video generation failed: ' + (statusData.error || JSON.stringify(statusData)));
      }
    } catch (err) {
      if (err.message.includes('generation failed') || err.message.includes('No video URL')) throw err;
      consecutiveErrors++;
      if (consecutiveErrors >= 10) throw new Error(`Too many poll errors: ${err.message}`);
    }
  }
  throw new Error('Video generation timed out');
}

async function generateVideo(round, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      round.videoStatus = 'generating';
      round.videoError = null;
      console.log(`[Round ${round.event.id}] Submitting video generation (attempt ${attempt + 1})...`);
      const queueData = await submitVideoGeneration(round.event.prompt);
      console.log(`[Round ${round.event.id}] Queued: ${queueData.request_id}`);
      const videoUrl = await pollVideoStatus(queueData.status_url, queueData.response_url);
      round.videoUrl = videoUrl;
      round.videoStatus = 'ready';
      console.log(`[Round ${round.event.id}] Video ready: ${videoUrl}`);
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

// ─── Game API Endpoints ───

app.post('/api/game/new', (req, res) => {
  const events = pickRandomEvents(5);
  const gameId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const game = {
    id: gameId,
    rounds: events.map((event, i) => ({
      index: i,
      event,
      videoStatus: 'pending',
      videoUrl: null,
      videoError: null,
      guess: null,
      score: null
    })),
    currentRound: 0,
    totalScore: 0,
    created: Date.now()
  };

  games.set(gameId, game);

  generateVideo(game.rounds[0]);

  console.log(`[Game ${gameId}] Started with events: ${events.map(e => e.id).join(', ')}`);
  res.json({ gameId, totalRounds: 5 });
});

app.get('/api/game/:id/round/:num', (req, res) => {
  const game = games.get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const roundNum = parseInt(req.params.num);
  if (roundNum < 0 || roundNum >= game.rounds.length) {
    return res.status(400).json({ error: 'Invalid round number' });
  }

  const round = game.rounds[roundNum];

  if (round.videoStatus === 'pending') {
    generateVideo(round);
  }

  res.json({
    status: round.videoStatus,
    videoUrl: round.videoStatus === 'ready' ? round.videoUrl : null,
    error: round.videoStatus === 'failed' ? round.videoError : null
  });
});

app.post('/api/game/:id/round/:num/retry', (req, res) => {
  const game = games.get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const roundNum = parseInt(req.params.num);
  if (roundNum < 0 || roundNum >= game.rounds.length) {
    return res.status(400).json({ error: 'Invalid round number' });
  }

  const round = game.rounds[roundNum];
  round.videoStatus = 'pending';
  round.videoError = null;
  round.videoUrl = null;
  generateVideo(round);

  res.json({ status: 'retrying' });
});

app.post('/api/game/:id/round/:num/guess', (req, res) => {
  const game = games.get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const roundNum = parseInt(req.params.num);
  if (roundNum < 0 || roundNum >= game.rounds.length) {
    return res.status(400).json({ error: 'Invalid round number' });
  }

  const round = game.rounds[roundNum];
  const { year, lat, lng } = req.body;

  if (year == null || lat == null || lng == null) {
    return res.status(400).json({ error: 'year, lat, and lng are required' });
  }

  const score = calculateScore(year, lat, lng, round.event.year, round.event.lat, round.event.lng);
  round.guess = { year, lat, lng };
  round.score = score;
  game.totalScore += score.totalScore;
  game.currentRound = roundNum + 1;

  const nextRoundIndex = roundNum + 1;
  if (nextRoundIndex < game.rounds.length) {
    const nextRound = game.rounds[nextRoundIndex];
    if (nextRound.videoStatus === 'pending') {
      generateVideo(nextRound);
    }
  }

  console.log(`[Game ${game.id}] Round ${roundNum}: guessed ${year} at (${lat},${lng}) => ${score.totalScore} pts (dist: ${score.distanceKm}km, yearDiff: ${score.yearDiff})`);

  res.json({
    locationScore: score.locationScore,
    timeScore: score.timeScore,
    totalScore: score.totalScore,
    distanceKm: score.distanceKm,
    yearDiff: score.yearDiff,
    correctYear: round.event.year,
    correctLat: round.event.lat,
    correctLng: round.event.lng,
    correctLocationName: round.event.locationName,
    correctEventName: round.event.eventName,
    gameTotalScore: game.totalScore,
    gameComplete: game.currentRound >= game.rounds.length
  });
});

app.get('/api/game/:id/results', (req, res) => {
  const game = games.get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  res.json({
    gameId: game.id,
    totalScore: game.totalScore,
    maxScore: 50000,
    rounds: game.rounds.map(r => ({
      eventName: r.score ? r.event.eventName : null,
      locationName: r.score ? r.event.locationName : null,
      correctYear: r.score ? r.event.year : null,
      correctLat: r.score ? r.event.lat : null,
      correctLng: r.score ? r.event.lng : null,
      guess: r.guess,
      score: r.score
    }))
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`HistoryGuessr server running at http://localhost:${PORT}`);
  console.log(`Loaded ${EVENTS.length} historical events`);
});
