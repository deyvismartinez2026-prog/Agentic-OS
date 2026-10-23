/* Smokies Family Trip (Jan 1-5, 2027)
   Single-file React app. Runs on the React 18 UMD globals (React, ReactDOM).
   The plan is saved to the artifact's shared store when the viewer offers one,
   and mirrored to this browser as a fallback. */

const { useState, useEffect, useRef, useMemo, useCallback } = React;

/* ------------------------------------------------------------------ */
/* Trip structure                                                      */
/* ------------------------------------------------------------------ */

const DAYS = [
  { id: 'd1', n: 1, date: '2027-01-01', dow: 'Fri', weekday: 'Friday', short: 'Jan 1', long: 'January 1', tag: 'Travel', sun: ['7:53 AM', '5:39 PM'] },
  { id: 'd2', n: 2, date: '2027-01-02', dow: 'Sat', weekday: 'Saturday', short: 'Jan 2', long: 'January 2', tag: 'Adventure Day', sun: ['7:53 AM', '5:40 PM'] },
  { id: 'd3', n: 3, date: '2027-01-03', dow: 'Sun', weekday: 'Sunday', short: 'Jan 3', long: 'January 3', tag: 'Cabin Day', sun: ['7:54 AM', '5:41 PM'] },
  { id: 'd4', n: 4, date: '2027-01-04', dow: 'Mon', weekday: 'Monday', short: 'Jan 4', long: 'January 4', tag: 'Mixed', sun: ['7:54 AM', '5:42 PM'] },
  { id: 'd5', n: 5, date: '2027-01-05', dow: 'Tue', weekday: 'Tuesday', short: 'Jan 5', long: 'January 5', tag: 'Travel', sun: ['7:54 AM', '5:43 PM'] },
];
const DAY = Object.fromEntries(DAYS.map((d) => [d.id, d]));
const TAGS = ['Travel', 'Cabin Day', 'Adventure Day', 'Mixed'];
const TAG_TONE = { Travel: 'haze', 'Cabin Day': 'spruce', 'Adventure Day': 'ember', Mixed: 'plum' };

const SLOTS = [
  { id: 'morning', label: 'Morning', range: '8–11:30 AM', start: 480, end: 690, icon: 'sunrise' },
  { id: 'midday', label: 'Midday', range: '11:30 AM–2:30 PM', start: 690, end: 870, icon: 'sun', nap: true },
  { id: 'afternoon', label: 'Afternoon', range: '2:30–5:30 PM', start: 870, end: 1050, icon: 'sunset' },
  { id: 'evening', label: 'Evening', range: '5:30–8:30 PM', start: 1050, end: 1230, icon: 'moon' },
];
const SLOT = Object.fromEntries(SLOTS.map((s) => [s.id, s]));
const NAP = { start: 750, end: 870 }; // 12:30–2:30, when the littles usually sleep

const STATUS = {
  planned: { label: 'Planned', icon: 'dashed', next: 'booked' },
  booked: { label: 'Booked', icon: 'ticket', next: 'done' },
  done: { label: 'Done', icon: 'check', next: 'skipped' },
  skipped: { label: 'Skipped', icon: 'skip', next: 'planned' },
};

const KINDS = {
  travel: { label: 'Travel', icon: 'plane', tone: 'haze' },
  drive: { label: 'Drive', icon: 'car', tone: 'haze' },
  cabin: { label: 'Cabin', icon: 'cabin', tone: 'spruce' },
  nap: { label: 'Nap', icon: 'moon', tone: 'night' },
  meal: { label: 'Meal', icon: 'fork', tone: 'ember' },
  custom: { label: 'Other', icon: 'pin', tone: 'neutral' },
};
const CAT_ICON = { Indoor: 'home', Outdoor: 'tree', Food: 'fork', Cabin: 'cabin', 'Scenic Drive': 'car', 'Shows/Lights': 'sparkle', Shopping: 'bag' };
const CAT_TONE = { Indoor: 'haze', Outdoor: 'spruce', Food: 'ember', Cabin: 'spruce', 'Scenic Drive': 'haze', 'Shows/Lights': 'ember', Shopping: 'plum' };

/* ------------------------------------------------------------------ */
/* Activity library                                                    */
/* drive = rough minutes from a cabin between Pigeon Forge and         */
/* Gatlinburg. verify = seasonal dates; check = hours/roads reminder.  */
/* ------------------------------------------------------------------ */

const ACTIVITIES = [
  {
    id: 'anakeesta', name: 'Anakeesta', area: 'Gatlinburg', cats: ['Outdoor', 'Shows/Lights'], icon: 'sparkle',
    cost: '$$$', toddler: 'Good', weather: 'fair', dur: 180, drive: 20, stroller: 'partial', setting: 'Outdoor', slot: 'afternoon',
    why: 'Ride up in an enclosed gondola cabin. The mountaintop has a treehouse playground, gentle paved paths and holiday lights that switch on at dusk.',
    tips: 'Head up around 3:30 PM to get daylight and then the lights at sunset (about 5:40 PM in early January). Strollers work on the paved paths; use a carrier on the Treetop Skywalk bridges. It is colder and windier on the ridge, so add a layer. Kids 3 and under are usually free.',
    check: 'Holiday light dates, winter hours and ride status (wind, ice) change. Check before you go.', verify: true,
    url: 'https://anakeesta.com',
  },
  {
    id: 'ripleys', name: "Ripley's Aquarium of the Smokies", area: 'Gatlinburg', cats: ['Indoor'], icon: 'fish',
    cost: '$$$', toddler: 'Great', weather: 'any', dur: 150, drive: 20, stroller: 'yes', setting: 'Indoor', slot: 'morning',
    why: 'Warm, fully indoors and built at toddler height: a moving walkway through the shark tunnel, a penguin habitat with crawl-through tubes and pop-up viewing bubbles, and a stingray touch pool.',
    tips: 'Arrive right at opening on New Year’s weekend and buy timed tickets online. Park in a downtown garage nearby. Elevators, restrooms and changing tables inside. Children under 2 are usually free.',
    check: 'Holiday-week hours can differ. Confirm the opening time.', verify: false,
    url: 'https://www.ripleyaquariums.com/gatlinburg/',
  },
  {
    id: 'dollywood', name: 'Dollywood Smoky Mountain Christmas', area: 'Pigeon Forge', cats: ['Outdoor', 'Shows/Lights'], icon: 'sparkle',
    cost: '$$$', toddler: 'Good', weather: 'fair', dur: 300, drive: 25, stroller: 'yes', setting: 'Mixed', slot: 'afternoon',
    why: 'Millions of lights, cozy indoor Christmas shows, and whole kids’ areas (Wildwood Grove, Country Fair) with gentle rides sized for toddlers.',
    tips: 'Arrive late morning, let the littles nap in the stroller, then stay for the lights after 5:30 PM. Expect hills, so bring a stroller with good wheels (rentals are available). Kids 3 and under are free.',
    check: 'Smoky Mountain Christmas usually ends in the first days of January, then the park closes until spring. Confirm it is open on your date before planning around it.', verify: true,
    url: 'https://www.dollywood.com',
  },
  {
    id: 'island', name: 'The Island in Pigeon Forge', area: 'Pigeon Forge', cats: ['Outdoor', 'Shows/Lights', 'Shopping', 'Food'], icon: 'wheel',
    cost: 'Free', toddler: 'Great', weather: 'fair', dur: 150, drive: 15, stroller: 'yes', setting: 'Outdoor', slot: 'evening',
    why: 'Free to walk, flat and stroller-easy, with a fountain show set to music, a carousel, holiday lights and a 200-foot Ferris wheel with enclosed gondolas.',
    tips: 'Admission and parking are free; you pay only for rides and food. Restrooms are inside the shops and near the center. Ride the wheel at dusk for the light views. It is close to most cabins, so it is an easy bail-out if someone melts down.',
    check: 'Fountain show times and ride hours are shorter in winter. Check the schedule.', verify: false,
    url: 'https://islandinpigeonforge.com',
  },
  {
    id: 'cadescove', name: 'Cades Cove Loop scenic drive', area: 'National Park', cats: ['Scenic Drive', 'Outdoor'], icon: 'car',
    cost: 'Free', toddler: 'Great', weather: 'fair', dur: 240, drive: 60, stroller: 'partial', setting: 'In the car', slot: 'morning',
    why: 'An 11-mile one-way loop you see from the car, so toddlers stay buckled, warm and free to nap. Deer and wild turkeys are common, and old cabins and churches make quick stretch stops.',
    tips: 'Start early; traffic slows to a crawl by late morning. Restrooms are near the loop entrance and at the Cable Mill area about halfway. Pack lunch and snacks, since there is no food on the loop. A park parking tag is required if you park for more than 15 minutes.',
    check: 'Laurel Creek Road and the loop can close for snow or ice. Check the park’s road status the morning of.', verify: false,
    url: 'https://www.nps.gov/grsm/planyourvisit/cadescove.htm',
  },
  {
    id: 'gatlinburgtrail', name: 'Gatlinburg Trail', area: 'National Park', cats: ['Outdoor'], icon: 'tree',
    cost: 'Free', toddler: 'Great', weather: 'fair', dur: 90, drive: 20, stroller: 'yes', setting: 'Outdoor', slot: 'morning',
    why: 'One of the flattest trails in the park: a riverside path from Sugarlands toward town with a footbridge, old homestead chimneys and plenty of rocks to point at. Walk as far as little legs want, then turn back.',
    tips: 'It runs about 1.9 miles each way, so most families do a short out-and-back. The surface is packed gravel; a stroller with bigger wheels does best, with a carrier as backup. Start at Sugarlands for restrooms. Watch for ice on the footbridge on cold mornings.',
    check: null, verify: false,
    url: 'https://www.nps.gov/grsm/',
  },
  {
    id: 'sugarlands', name: 'Sugarlands Visitor Center', area: 'National Park', cats: ['Indoor', 'Outdoor'], icon: 'home',
    cost: 'Free', toddler: 'Great', weather: 'any', dur: 45, drive: 20, stroller: 'yes', setting: 'Mixed', slot: 'morning',
    why: 'Warm, free and full of restrooms: natural history exhibits with bears and owls at kid height, a short park film, and an easy walk out back to little Cataract Falls.',
    tips: 'Buy your park parking tags here. It is the best restroom and diaper stop on the way to Cades Cove or Newfound Gap.',
    check: 'Winter hours are shorter. Check before you go.', verify: false,
    url: 'https://www.nps.gov/grsm/planyourvisit/visitorcenters.htm',
  },
  {
    id: 'skylift', name: 'Gatlinburg SkyLift Park & SkyBridge', area: 'Gatlinburg', cats: ['Outdoor', 'Shows/Lights'], icon: 'lift',
    cost: '$$$', toddler: 'Use carrier', weather: 'fair', dur: 90, drive: 20, stroller: 'no', setting: 'Outdoor', slot: 'afternoon',
    why: 'A short chairlift up Crockett Mountain to a 680-foot suspension bridge with big views over Gatlinburg, plus light displays after dark. Toddlers love the “flying” chair ride.',
    tips: 'Strollers stay at the bottom. A front carrier keeps little ones secure on the open chairlift and the bridge. Bring blankets, because the lift is cold and breezy. The glass-floor section is optional. Judge your group’s comfort with heights before buying tickets.',
    check: 'The lift can pause for wind or ice, and winter hours vary. Confirm the day of.', verify: false,
    url: 'https://www.gatlinburgskylift.com',
  },
  {
    id: 'oldmill', name: 'Old Mill Square', area: 'Pigeon Forge', cats: ['Food', 'Shopping', 'Indoor'], icon: 'mill',
    cost: '$$', toddler: 'Great', weather: 'any', dur: 120, drive: 15, stroller: 'partial', setting: 'Mixed', slot: 'morning',
    why: 'A working 1830 gristmill on the river, Southern comfort food, and a candy kitchen where kids can watch taffy being pulled in the window, plus a toy shop and a creamery.',
    tips: 'The Old Mill Restaurant has long waits at peak meals. Go early, put your name in, and browse the shops while you wait. The Pottery House Café next door is a quieter option for 10. Shops are cozy and crowded, so fold the stroller or wear a carrier.',
    check: 'Restaurant hours shift in winter. Check before you go.', verify: false,
    url: 'https://www.old-mill.com',
  },
  {
    id: 'pancakes', name: 'Pancake house breakfast', area: 'Gatlinburg', cats: ['Food', 'Indoor'], icon: 'fork',
    cost: '$$', toddler: 'Great', weather: 'any', dur: 75, drive: 20, stroller: 'partial', setting: 'Indoor', slot: 'morning',
    why: 'A Smokies tradition, and breakfast is the easiest meal out with toddlers: they are rested, hungry and nowhere near a meltdown.',
    tips: 'Lines build after 9 AM on weekends. For 10 people, arrive before 8:30 or ask about two tables side by side. Ask for three high chairs when you check in. Pancake Pantry and Crockett’s Breakfast Camp are local favorites.',
    check: null, verify: false, url: null,
  },
  {
    id: 'bucees', name: "Buc-ee's Sevierville", area: 'Sevierville', cats: ['Food', 'Shopping', 'Indoor'], icon: 'bag',
    cost: '$', toddler: 'Great', weather: 'any', dur: 40, drive: 25, stroller: 'yes', setting: 'Indoor', slot: 'afternoon',
    why: 'Huge, spotless restrooms, a giant beaver statue for photos, and every road snack imaginable, right off I-40 at Exit 407.',
    tips: 'Make it the diaper-change and leg-stretch stop between the airport and the cabin. Brisket sandwiches make an easy first-night dinner.',
    check: null, verify: false, url: null,
  },
  {
    id: 'grocery', name: 'Grocery pickup for the cabin', area: 'Sevierville', cats: ['Food', 'Shopping'], icon: 'bag',
    cost: '$$', toddler: 'Great', weather: 'any', dur: 45, drive: 20, stroller: 'na', setting: 'In the car', slot: 'afternoon',
    why: 'Curbside pickup keeps the littles buckled while you stock the cabin for easy breakfasts, nap-time snacks and fewer restaurant meals with 10 people.',
    tips: 'Order ahead from a Walmart or Kroger in Sevierville or Pigeon Forge. Add milk, diapers, wipes, night-lights and a few outlet covers to the list.',
    check: 'January 1 is New Year’s Day, so pickup windows may be limited. Book a slot early.', verify: false, url: null,
  },
  {
    id: 'winterfest', name: 'Winterfest lights drive', area: 'Pigeon Forge', cats: ['Shows/Lights', 'Scenic Drive'], icon: 'sparkle',
    cost: 'Free', toddler: 'Great', weather: 'any', dur: 60, drive: 10, stroller: 'na', setting: 'In the car', slot: 'evening',
    why: 'Millions of lights along the Parkway in Pigeon Forge and Gatlinburg, seen from warm car seats in pajamas. If they fall asleep on the way home, even better.',
    tips: 'Go right after dinner, around 6 PM, and loop the Parkway. Queue up a holiday playlist.',
    check: 'Winterfest displays usually stay up through February. Confirm this season’s dates.', verify: true,
    url: 'https://www.mypigeonforge.com',
  },
  {
    id: 'cabinbrunch', name: 'Slow pancake brunch at the cabin', area: 'Cabin', cats: ['Cabin', 'Food'], icon: 'cabin',
    cost: 'Free', toddler: 'Great', weather: 'any', dur: 90, drive: 0, stroller: 'na', setting: 'Indoor', slot: 'morning',
    why: 'No car seats and no lines. Kids eat in pajamas while the grown-ups get a second cup of coffee by the window.',
    tips: 'Let the 3-year-old help stir and add sprinkles. If the cabin has no high chairs, pack a travel booster or two.',
    check: null, verify: false, url: null,
  },
  {
    id: 'cocoa', name: 'Hot cocoa bar & crafts', area: 'Cabin', cats: ['Cabin', 'Indoor'], icon: 'mug',
    cost: 'Free', toddler: 'Great', weather: 'any', dur: 60, drive: 0, stroller: 'na', setting: 'Indoor', slot: 'afternoon',
    why: 'A warm, mess-friendly afternoon: tiny marshmallows, sticker scenes, play dough and a “snow day” sensory bin.',
    tips: 'Cool the cocoa to lukewarm for the littles and use lidded cups. A plastic tablecloth under the craft table saves the cabin’s floors.',
    check: null, verify: false, url: null,
  },
  {
    id: 'snowplay', name: 'Snow or frost play outside', area: 'Cabin', cats: ['Cabin', 'Outdoor'], icon: 'snow',
    cost: 'Free', toddler: 'Good', weather: 'fair', dur: 45, drive: 0, stroller: 'na', setting: 'Outdoor', slot: 'morning',
    why: 'If it snows, 20 minutes of snowman-building right outside the door is all a toddler needs. No snow? Hunt for frost, pinecones and animal tracks.',
    tips: 'Keep waterproof mittens and a full change of clothes by the door. Decks and steps get icy, and hillside cabins often have steep drop-offs, so keep little ones close.',
    check: null, verify: false, url: null,
  },
  {
    id: 'movienight', name: 'Movie night in PJs', area: 'Cabin', cats: ['Cabin', 'Indoor'], icon: 'moon',
    cost: 'Free', toddler: 'Great', weather: 'any', dur: 90, drive: 0, stroller: 'na', setting: 'Indoor', slot: 'evening',
    why: 'Popcorn, blankets and an early bedtime, so the grown-ups get the rest of the evening.',
    tips: 'Pick a short movie (under an hour) for the toddlers. Bring your streaming logins; cabin TVs usually have the apps but not your accounts.',
    check: null, verify: false, url: null,
  },
  {
    id: 'gamenight', name: 'Grown-ups’ game night', area: 'Cabin', cats: ['Cabin', 'Indoor'], icon: 'cabin',
    cost: 'Free', toddler: 'Good', weather: 'any', dur: 120, drive: 0, stroller: 'na', setting: 'Indoor', slot: 'evening',
    why: 'Once the littles are down, the cabin becomes the grown-ups’ lodge: board games, a puzzle and the fireplace.',
    tips: 'Set up baby monitors in each sleeping room first. If the cabin has a hot tub, keep the cover locked; hot tubs are not safe for kids under 5.',
    check: null, verify: false, url: null,
  },
  {
    id: 'familyphoto', name: 'Family photo by the fireplace', area: 'Cabin', cats: ['Cabin', 'Indoor'], icon: 'camera',
    cost: 'Free', toddler: 'Great', weather: 'any', dur: 30, drive: 0, stroller: 'na', setting: 'Indoor', slot: 'morning',
    why: 'All 10 of you in one frame, before anyone needs a nap. Mornings are peak toddler cooperation.',
    tips: 'Bring a phone tripod and use the timer. Matching sweaters or pajamas are optional but encouraged.',
    check: null, verify: false, url: null,
  },
  {
    id: 'titanic', name: 'Titanic Museum Attraction', area: 'Pigeon Forge', cats: ['Indoor'], icon: 'ship',
    cost: '$$$', toddler: 'Use carrier', weather: 'any', dur: 120, drive: 15, stroller: 'no', setting: 'Indoor', slot: 'morning',
    why: 'Indoors and warm, with a grand staircase replica and a real wall of ice to touch. Best for the older family members; toddlers usually enjoy about an hour.',
    tips: 'Galleries are narrow and busy, so a carrier is easier than a stroller (ask about the stroller policy at the door). Go at opening, before the crowds.',
    check: 'Holiday-week hours vary. Book timed tickets ahead.', verify: false,
    url: 'https://www.titanicattraction.com',
  },
  {
    id: 'tanger', name: 'Tanger Outlets Sevierville', area: 'Sevierville', cats: ['Shopping', 'Outdoor'], icon: 'bag',
    cost: '$$', toddler: 'Good', weather: 'fair', dur: 120, drive: 20, stroller: 'yes', setting: 'Outdoor', slot: 'afternoon',
    why: 'Wide, flat open-air sidewalks for easy stroller laps between stores. A good grown-ups’ break while others stay back for naps.',
    tips: 'Split the group: half shop while the other half covers nap time at the cabin, then swap another day. The walkways are outdoors, so dress warm.',
    check: 'New Year’s week may bring holiday hours.', verify: false, url: null,
  },
  {
    id: 'applebarn', name: 'The Apple Barn', area: 'Sevierville', cats: ['Food', 'Shopping', 'Indoor'], icon: 'apple',
    cost: '$$', toddler: 'Great', weather: 'any', dur: 90, drive: 20, stroller: 'partial', setting: 'Indoor', slot: 'morning',
    why: 'Warm apple fritters with apple butter, a cider mill to peek into, and a farmhouse restaurant that is used to big families.',
    tips: 'The farmhouse restaurant fills up on weekends, so go early. Browse the general store and candy shop while you wait for a table.',
    check: 'Restaurant and shop hours differ in winter.', verify: false,
    url: 'https://www.applebarncidermill.com',
  },
  {
    id: 'stampede', name: 'Dolly Parton’s Stampede', area: 'Pigeon Forge', cats: ['Shows/Lights', 'Food', 'Indoor'], icon: 'horse',
    cost: '$$$', toddler: 'Good', weather: 'any', dur: 120, drive: 15, stroller: 'na', setting: 'Indoor', slot: 'evening',
    why: 'Horses, a four-course dinner eaten with your hands and a loud, cheerful show. Toddlers love the animals, and nobody minds a little noise from your table.',
    tips: 'Choose the earliest show to protect bedtime. Kids 3 and under usually sit on a lap for free. Bring small ear protectors; it is loud.',
    check: 'The Christmas show runs into early January. Confirm dates and show times.', verify: true,
    url: 'https://dpstampede.com',
  },
  {
    id: 'mynatt', name: 'Mynatt Park playground', area: 'Gatlinburg', cats: ['Outdoor'], icon: 'tree',
    cost: 'Free', toddler: 'Great', weather: 'fair', dur: 45, drive: 20, stroller: 'yes', setting: 'Outdoor', slot: 'afternoon',
    why: 'A free city park with a playground and a creek for throwing rocks, a quick wiggle break between car rides.',
    tips: 'Pair it with a downtown Gatlinburg stop. Some park restrooms close in winter, so plan a bathroom stop before you go.',
    check: null, verify: false, url: null,
  },
  {
    id: 'newfound', name: 'Newfound Gap Road drive', area: 'National Park', cats: ['Scenic Drive'], icon: 'car',
    cost: 'Free', toddler: 'Great', weather: 'fair', dur: 120, drive: 25, stroller: 'na', setting: 'In the car', slot: 'midday',
    why: 'Climb to 5,046 feet at the Tennessee–North Carolina line without leaving the car: frosted trees, long ridgeline views and an easy car nap.',
    tips: 'It is often 10–20°F colder at the top. Restrooms at the Newfound Gap parking area. Turn around there; there is no need to go farther with little ones.',
    check: 'US-441 often closes for snow and ice in January. Check the park’s road status before you head up.', verify: false,
    url: 'https://www.nps.gov/grsm/planyourvisit/conditions.htm',
  },
];
const ACT = Object.fromEntries(ACTIVITIES.map((a) => [a.id, a]));

const FILTERS = [
  { key: 'cat', label: 'Category', options: ['Indoor', 'Outdoor', 'Food', 'Cabin', 'Scenic Drive', 'Shows/Lights', 'Shopping'], test: (a, v) => a.cats.includes(v) },
  { key: 'cost', label: 'Cost', options: ['Free', '$', '$$', '$$$'], test: (a, v) => a.cost === v },
  { key: 'toddler', label: 'Toddler-friendly', options: ['Great', 'Good', 'Use carrier'], test: (a, v) => a.toddler === v },
  { key: 'weather', label: 'Weather', options: ['Any weather', 'Fair weather only'], test: (a, v) => (v === 'Any weather') === (a.weather === 'any') },
  { key: 'dur', label: 'Duration', options: ['<1 hr', '1–3 hrs', 'Half day'], test: (a, v) => durBucket(a.dur) === v },
  { key: 'area', label: 'Area', options: ['Gatlinburg', 'Pigeon Forge', 'Sevierville', 'Cabin', 'National Park'], test: (a, v) => a.area === v },
];
const SORTS = [['drive', 'Closest'], ['cost', 'Cost'], ['dur', 'Duration']];
const COST_ORDER = { Free: 0, $: 1, $$: 2, $$$: 3 };

const PACKING = [
  ['seats', 'Three car seats, or rentals reserved'],
  ['cribs', 'Pack ’n plays, or confirm the cabin has cribs'],
  ['gates', 'Baby gates for cabin stairs and lofts'],
  ['proof', 'Outlet covers and cabinet locks'],
  ['lights', 'Night-lights and a white noise machine'],
  ['monitor', 'Baby monitors'],
  ['carriers', 'A carrier for each toddler'],
  ['stroller', 'A stroller with all-terrain wheels'],
  ['snow', 'Snowsuits, waterproof mittens and hats'],
  ['layers', 'Spare clothes and a blanket in each car'],
  ['meds', 'Kids’ fever reducer, thermometer, bandages'],
  ['snacks', 'Snacks, sippy cups and car activities'],
  ['potty', 'Travel potty seat, diapers and wipes'],
  ['tags', 'Park parking tag for each car'],
];

const KNOW = [
  { icon: 'snow', title: 'January weather', text: 'Expect highs near 50°F and lows in the upper 20s in town, and 10–20° colder up high. Snow and ice come and go, so dress the littles in layers and keep a dry change of clothes in each car.' },
  { icon: 'car', title: 'Mountain roads', text: 'Cabin driveways can be steep and shaded. Ask the host about the grade and winter access before you arrive; AWD or 4WD helps. Newfound Gap Road and Cades Cove can close for ice, and Roaring Fork Motor Nature Trail is closed for the winter.' },
  { icon: 'ticket', title: 'Park parking tags', text: 'Parking anywhere in the national park for more than 15 minutes needs a tag on each car, about $5 a day or $15 a week. Buy them online or at Sugarlands.' },
  { icon: 'baby', title: 'Cars & car seats', text: 'Ten people plus seats for ages 1, 2 and 3 usually means two minivans or a 12-passenger van. Airlines check car seats free; rental seats add up per day.' },
  { icon: 'moon', title: 'Naps & bedtimes', text: 'Do big outings in the morning, protect 12:30–2:30 for naps (or a car-nap drive), and see lights right after sunset, about 5:40 PM, so everyone is home by 7:30.' },
  { icon: 'plus', title: 'If someone gets sick', text: 'LeConte Medical Center in Sevierville has a 24-hour emergency room. Pack children’s fever reducer, a thermometer and any prescriptions in your carry-on.' },
];

const PREVIEW_NOW = { date: '2027-01-02', min: 10 * 60 + 20 };

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const clone = (o) => JSON.parse(JSON.stringify(o));
const cx = (...a) => a.filter(Boolean).join(' ');
const pad = (n) => String(n).padStart(2, '0');
const toMin = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + (m || 0); };
const minToHHMM = (min) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;
function fmtClock(min) {
  const m = Math.round(min);
  const h = Math.floor(m / 60) % 24;
  return { t: `${h % 12 || 12}:${pad(m % 60)}`, ap: h >= 12 ? 'PM' : 'AM' };
}
const fmtTime = (min) => { const c = fmtClock(min); return `${c.t} ${c.ap}`; };
function fmtDur(m) {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} hr ${r} min` : `${h} hr${h > 1 ? 's' : ''}`;
}
function durBucket(m) { return m < 60 ? '<1 hr' : m <= 180 ? '1–3 hrs' : 'Half day'; }
const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const newUid = () => 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const lsGet = (k) => { try { const s = window.localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (_) { return null; } };
const lsSet = (k, v) => { try { window.localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* storage blocked */ } };

function resolveItem(it) {
  if (it.aid && ACT[it.aid]) {
    const a = ACT[it.aid];
    return { title: a.name, kind: 'activity', dur: it.dur || a.dur, act: a, tone: CAT_TONE[a.cats[0]] || 'neutral', icon: a.icon || CAT_ICON[a.cats[0]], area: a.area, info: '' };
  }
  const k = KINDS[it.kind] || KINDS.custom;
  return { title: it.title || 'Untitled', kind: it.kind || 'custom', dur: it.dur || 60, act: null, tone: k.tone, icon: k.icon, area: it.area || null, info: it.info || '' };
}
function napFriendly(info) {
  if (['nap', 'drive', 'cabin'].includes(info.kind)) return true;
  return !!(info.act && (info.act.setting === 'In the car' || info.act.area === 'Cabin'));
}

/* Start/end time for every item in a day. Untimed items follow the one
   before them; skipped items keep a time but don't push the clock. */
function computeTimeline(dayPlan, items) {
  const out = {};
  let cursor = SLOTS[0].start;
  SLOTS.forEach((slot) => {
    cursor = Math.max(cursor, slot.start);
    dayPlan[slot.id].forEach((uid) => {
      const it = items[uid];
      if (!it) return;
      const info = resolveItem(it);
      const explicit = it.time ? toMin(it.time) : null;
      const start = explicit != null ? explicit : cursor;
      const end = start + info.dur;
      const overlap = Math.max(0, Math.min(end, NAP.end) - Math.max(start, NAP.start));
      out[uid] = {
        start, end, est: explicit == null,
        napClash: overlap > 30 && !napFriendly(info) && it.status !== 'skipped' && it.status !== 'done',
      };
      if (it.status !== 'skipped') cursor = Math.max(cursor, end);
    });
  });
  return out;
}

function findLoc(plan, uid) {
  for (const d of DAYS) for (const s of SLOTS) {
    const idx = plan.days[d.id][s.id].indexOf(uid);
    if (idx >= 0) return { day: d.id, slot: s.id, idx };
  }
  return null;
}
function dayStats(plan, dayId) {
  let total = 0, done = 0, booked = 0;
  SLOTS.forEach((s) => plan.days[dayId][s.id].forEach((uid) => {
    const st = plan.items[uid] && plan.items[uid].status;
    if (st === 'skipped') return;
    total++;
    if (st === 'done') done++;
    if (st === 'booked') booked++;
  }));
  return { total, done, booked };
}
const tagFor = (plan, dayId) => (plan.tags && plan.tags[dayId]) || DAY[dayId].tag;
const whereLabel = (dayId, slotId) => `${DAY[dayId].dow}, ${DAY[dayId].short} · ${SLOT[slotId].label}`;

/* ------------------------------------------------------------------ */
/* Suggested starting plan                                             */
/* ------------------------------------------------------------------ */

function buildStarter() {
  const days = {};
  const items = {};
  DAYS.forEach((d) => { days[d.id] = { morning: [], midday: [], afternoon: [], evening: [] }; });
  const put = (day, slot, uid, spec) => {
    items[uid] = Object.assign({ uid, status: 'planned', time: null, note: '' }, spec);
    days[day][slot].push(uid);
  };
  // Day 1 · Travel
  put('d1', 'morning', 's1-fly', { kind: 'travel', title: 'Fly into Knoxville (TYS)', dur: 60, info: 'Add flight numbers and your arrival time. TYS is about 45–60 minutes from Pigeon Forge.' });
  put('d1', 'morning', 's1-rent', { kind: 'travel', title: 'Pick up rental cars & install car seats', dur: 60, info: 'Ten people plus three car seats usually means two minivans or a 12-passenger van. Ask for AWD or 4WD for steep cabin roads, and budget time to install seats in the lot.' });
  put('d1', 'midday', 's1-drive', { kind: 'drive', title: 'Drive to the cabin area (car nap)', dur: 60, info: 'Time the drive with nap so the littles sleep through it.' });
  put('d1', 'afternoon', 's1-bucees', { aid: 'bucees' });
  put('d1', 'afternoon', 's1-grocery', { aid: 'grocery' });
  put('d1', 'afternoon', 's1-checkin', { kind: 'cabin', title: 'Cabin check-in', dur: 45, time: '16:00', info: 'Check-in is usually 4 PM. Ask the host about the driveway grade and winter access before you arrive.' });
  put('d1', 'evening', 's1-dinner', { kind: 'meal', title: 'Easy first-night dinner & set up cribs', dur: 90, info: 'Keep it simple. Set up pack ’n plays, night-lights and baby gates before bedtime.' });
  // Day 2 · Gatlinburg
  put('d2', 'morning', 's2-pancakes', { aid: 'pancakes', time: '08:00' });
  put('d2', 'morning', 's2-ripleys', { aid: 'ripleys', time: '09:30' });
  put('d2', 'midday', 's2-nap', { kind: 'nap', title: 'Lunch & naps at the cabin', dur: 150, time: '12:15', info: 'Quiet time for everyone. Grown-ups can trade off a short outing.' });
  put('d2', 'afternoon', 's2-anakeesta', { aid: 'anakeesta', time: '15:30' });
  put('d2', 'evening', 's2-dinner', { kind: 'meal', title: 'Early dinner in Gatlinburg, then home', dur: 75, info: 'Saturday nights downtown get busy. Join a waitlist early or pick up takeout.' });
  // Day 3 · Cabin
  put('d3', 'morning', 's3-brunch', { aid: 'cabinbrunch', time: '08:30' });
  put('d3', 'morning', 's3-photo', { aid: 'familyphoto' });
  put('d3', 'morning', 's3-snow', { aid: 'snowplay' });
  put('d3', 'midday', 's3-nap', { kind: 'nap', title: 'Lunch & naps', dur: 150, time: '12:00', info: 'A long, unhurried nap at the cabin.' });
  put('d3', 'afternoon', 's3-cocoa', { aid: 'cocoa', time: '15:00' });
  put('d3', 'evening', 's3-chili', { kind: 'meal', title: 'Cabin chili night', dur: 60, time: '17:30', info: 'Slow-cooker chili or soup, so nobody is stuck in the kitchen.' });
  put('d3', 'evening', 's3-movie', { aid: 'movienight' });
  put('d3', 'evening', 's3-games', { aid: 'gamenight' });
  // Day 4 · Park morning, Island evening
  put('d4', 'morning', 's4-sugarlands', { aid: 'sugarlands', time: '08:30' });
  put('d4', 'morning', 's4-cades', { aid: 'cadescove' });
  put('d4', 'midday', 's4-drive', { kind: 'drive', title: 'Car nap on the drive back', dur: 60, info: 'About an hour from Cades Cove to most cabins.' });
  put('d4', 'afternoon', 's4-rest', { kind: 'cabin', title: 'Rest & snacks at the cabin', dur: 90, info: 'Recharge before the evening outing.' });
  put('d4', 'evening', 's4-island', { aid: 'island', time: '17:15' });
  put('d4', 'evening', 's4-lights', { aid: 'winterfest' });
  // Day 5 · Travel
  put('d5', 'morning', 's5-pack', { kind: 'cabin', title: 'Pack up & check out', dur: 90, time: '08:30', info: 'Checkout is usually 10–11 AM. Load the car the night before and leave out one bag of snacks and spare clothes.' });
  put('d5', 'morning', 's5-oldmill', { aid: 'oldmill', time: '10:15' });
  put('d5', 'midday', 's5-drive', { kind: 'drive', title: 'Drive to TYS & return rental cars', dur: 75, info: 'Fill the tanks and leave time to uninstall car seats.' });
  put('d5', 'afternoon', 's5-fly', { kind: 'travel', title: 'Fly home', dur: 60, info: 'Add flight numbers and the departure time. Aim to be at the airport 2 hours early with car seats to check.' });
  return { v: 1, days, items, tags: {}, checks: {}, updatedAt: 0 };
}

function validPlan(p) {
  return !!(p && p.v === 1 && p.days && p.items && DAYS.every((d) => p.days[d.id] && SLOTS.every((s) => Array.isArray(p.days[d.id][s.id]))));
}
function normalize(p) {
  const n = clone(p);
  n.tags = n.tags || {};
  n.checks = n.checks || {};
  DAYS.forEach((d) => SLOTS.forEach((s) => {
    n.days[d.id][s.id] = n.days[d.id][s.id].filter((u) => n.items[u] && (!n.items[u].aid || ACT[n.items[u].aid]));
  }));
  return n;
}

/* ------------------------------------------------------------------ */
/* Saving: shared store when available, this browser otherwise         */
/* ------------------------------------------------------------------ */

const DOC_PATH = 'trip/plan';
const LS_PLAN = 'smokies27.plan.v1';
const LS_UI = 'smokies27.ui.v1';

function useTripStore(notifyRef) {
  const hadCache = useRef(null);
  const [plan, setPlan] = useState(() => { const c = lsGet(LS_PLAN); hadCache.current = validPlan(c); return hadCache.current ? normalize(c) : buildStarter(); });
  const [sync, setSync] = useState('connecting');
  // Until the saved plan answers, the starter plan is only a placeholder.
  const [hydrated, setHydrated] = useState(() => !!hadCache.current);
  useEffect(() => { if (sync !== 'connecting') setHydrated(true); }, [sync]);
  useEffect(() => { const t = setTimeout(() => setHydrated(true), 2500); return () => clearTimeout(t); }, []);
  const latest = useRef(plan);
  const st = useRef({ ref: null, dirty: false, inflight: false, timer: null, readOnly: false });
  const notify = (m) => notifyRef.current && notifyRef.current(m);

  const flush = useCallback(async () => {
    const s = st.current;
    if (!s.ref || !s.dirty) return;
    if (s.inflight) { clearTimeout(s.timer); s.timer = setTimeout(flush, 300); return; }
    s.dirty = false;
    s.inflight = true;
    setSync('saving');
    let retry = false;
    try {
      await s.ref.set(latest.current);
      if (!s.dirty) setSync('synced');
    } catch (e) {
      const code = e && e.code;
      if (code === 'invalid_argument') {
        s.readOnly = true;
        s.ref = null;
        setSync('readonly');
        notify('This plan is view-only for you, so changes stay on this screen.');
      } else if (code === 'unavailable' || code === 'resource_exhausted') {
        s.dirty = true;
        retry = true;
      } else {
        setSync('error');
      }
    }
    s.inflight = false;
    if (s.dirty && s.ref) { clearTimeout(s.timer); s.timer = setTimeout(flush, retry ? 1500 + Math.random() * 1000 : 400); }
  }, []);

  useEffect(() => {
    let unsub = null;
    let dead = false;
    const c = window.claude;
    if (!c || typeof c.use !== 'function') { setSync('local'); return undefined; }
    (async () => {
      let db = null;
      try { db = await c.use('db'); } catch (_) { db = null; }
      if (dead) return;
      if (!db) { setSync('local'); return; }
      try {
        const u = await c.use('user');
        if (u && typeof u.can === 'function') { const can = await u.can('data.write'); if (can === false) st.current.readOnly = true; }
      } catch (_) { /* not told: keep inputs */ }
      if (dead) return;
      let ref;
      try { ref = db.doc(DOC_PATH); } catch (_) { setSync('local'); return; }
      if (!st.current.readOnly) st.current.ref = ref;
      unsub = ref.onSnapshot((snap) => {
        const s = st.current;
        if (!s.dirty && !s.inflight && snap.exists) {
          const d = snap.data();
          if (validPlan(d)) { const next = normalize(d); latest.current = next; setPlan(next); lsSet(LS_PLAN, next); }
        }
        setSync(s.readOnly ? 'readonly' : (s.dirty || s.inflight ? 'saving' : 'synced'));
      }, () => { st.current.ref = null; setSync(st.current.readOnly ? 'readonly' : 'local'); });
    })();
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onHide);
    return () => { dead = true; if (unsub) unsub(); document.removeEventListener('visibilitychange', onHide); };
  }, [flush]);

  const update = useCallback((fn) => {
    const s = st.current;
    if (s.readOnly) { notify('This plan is view-only for you.'); return false; }
    const draft = clone(latest.current);
    const res = fn(draft);
    if (res === false) return false;
    const next = res || draft;
    next.updatedAt = Date.now();
    latest.current = next;
    setPlan(next);
    lsSet(LS_PLAN, next);
    if (s.ref) { s.dirty = true; setSync('saving'); clearTimeout(s.timer); s.timer = setTimeout(flush, 600); }
    return true;
  }, [flush]);

  const getLatest = useCallback(() => latest.current, []);
  return { plan, sync, update, getLatest, hydrated, readOnly: sync === 'readonly' };
}

/* ------------------------------------------------------------------ */
/* Drag and drop (pointer events; long-press on touch, drag on mouse)  */
/* ------------------------------------------------------------------ */

function useDragDrop(opts) {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const [drag, setDrag] = useState(null);
  const [dropT, setDropT] = useState(null);
  const ghostRef = useRef(null);
  const api = useRef(null);

  if (!api.current) {
    let d = null; // active gesture
    let target = null;
    let raf = 0;
    const hover = { day: null, timer: null };
    const state = { suppressClick: false };

    const sameTarget = (a, b) => (!a && !b) || (a && b && a.pill === b.pill && a.day === b.day && a.slot === b.slot && a.index === b.index);
    const setTarget = (t) => { if (!sameTarget(target, t)) { target = t; setDropT(t); } };
    const moveGhost = () => {
      if (!ghostRef.current || !d) return;
      const gx = Math.max(8, Math.min(window.innerWidth - d.w - 8, d.x - d.offX));
      ghostRef.current.style.transform = `translate3d(${gx}px, ${d.y - d.offY}px, 0)`;
    };
    const hitTest = () => {
      if (!d) return;
      const el = document.elementFromPoint(d.x, d.y);
      const pill = el && el.closest('[data-drop-day]');
      if (pill) {
        const day = pill.getAttribute('data-drop-day');
        if (hover.day !== day) {
          clearTimeout(hover.timer);
          hover.day = day;
          hover.timer = setTimeout(() => { if (d && d.active && optsRef.current.onHoverDay) optsRef.current.onHoverDay(day); }, 550);
        }
        setTarget({ pill: day });
        return;
      }
      if (hover.day) { clearTimeout(hover.timer); hover.day = null; }
      const zone = el && el.closest('[data-drop-slot]');
      if (!zone) { setTarget(null); return; }
      const [day, slot] = zone.getAttribute('data-drop-slot').split(':');
      const dragUid = d.source.type === 'item' ? d.source.uid : null;
      const cards = Array.from(zone.querySelectorAll('[data-card-uid]')).filter((c) => c.getAttribute('data-card-uid') !== dragUid);
      let index = cards.length;
      for (let i = 0; i < cards.length; i++) {
        const r = cards[i].getBoundingClientRect();
        if (d.y < r.top + r.height / 2) { index = i; break; }
      }
      setTarget({ day, slot, index, beforeUid: cards[index] ? cards[index].getAttribute('data-card-uid') : null });
    };
    const tick = () => {
      if (!d || !d.active) return;
      const rail = document.querySelector('.rail');
      const top = rail ? rail.getBoundingClientRect().bottom : 0;
      const nav = document.querySelector('.bottomnav');
      const navTop = nav ? nav.getBoundingClientRect().top : window.innerHeight;
      const zone = 64;
      let dy = 0;
      if (d.y >= top && d.y < top + zone) dy = -Math.ceil(((top + zone - d.y) / zone) * 16);
      else if (d.y > navTop - zone) dy = Math.ceil(((d.y - (navTop - zone)) / zone) * 16);
      if (dy) { window.scrollBy(0, Math.max(-20, Math.min(20, dy))); hitTest(); }
      raf = requestAnimationFrame(tick);
    };
    const activate = () => {
      if (!d || d.active) return;
      d.active = true;
      try { if (navigator.vibrate) navigator.vibrate(12); } catch (_) { /* no haptics */ }
      try { window.getSelection().removeAllRanges(); } catch (_) { /* nothing selected */ }
      document.documentElement.classList.add('is-dragging');
      setDrag({ source: d.source, label: d.label, sub: d.sub, icon: d.icon, tone: d.tone, w: d.w });
      hitTest();
      raf = requestAnimationFrame(tick);
    };
    const finish = (commit) => {
      if (!d) return;
      const g = d;
      clearTimeout(g.timer);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('blur', onBlur);
      cancelAnimationFrame(raf);
      clearTimeout(hover.timer);
      hover.day = null;
      d = null;
      if (g.active) {
        document.documentElement.classList.remove('is-dragging');
        const t = target;
        target = null;
        setDropT(null);
        setDrag(null);
        state.suppressClick = true;
        setTimeout(() => { state.suppressClick = false; }, 120);
        if (commit && t && optsRef.current.onDrop) optsRef.current.onDrop(g.source, t);
      }
    };
    function onMove(e) {
      if (!d || e.pointerId !== d.pointerId) return;
      d.x = e.clientX;
      d.y = e.clientY;
      if (!d.active) {
        const dist = Math.hypot(d.x - d.sx, d.y - d.sy);
        if (d.touch) { if (dist > 10) finish(false); } else if (dist > 6) activate();
        return;
      }
      if (e.cancelable) e.preventDefault();
      moveGhost();
      hitTest();
    }
    function onUp(e) { if (d && e.pointerId === d.pointerId) finish(true); }
    function onCancel(e) { if (d && e.pointerId === d.pointerId) finish(false); }

    const start = (e, source, info) => {
      if (!optsRef.current.enabled) return;
      if (d) { if (d.active) return; finish(false); }
      if (e.button != null && e.button !== 0) return;
      if (e.target.closest('[data-nodrag]')) return;
      const r = e.currentTarget.getBoundingClientRect();
      const touch = e.pointerType === 'touch' || e.pointerType === 'pen';
      // Keep receiving a mouse drag even if it leaves the window.
      if (!touch) { try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* not capturable */ } }
      d = {
        source, label: info.label, sub: info.sub, icon: info.icon, tone: info.tone, pointerId: e.pointerId,
        sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, offX: Math.min(e.clientX - r.left, 60), offY: e.clientY - r.top,
        w: Math.min(r.width, 360, window.innerWidth - 16), touch, active: false, timer: null,
      };
      if (touch) d.timer = setTimeout(activate, 380);
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      window.addEventListener('blur', onBlur);
    };
    function onBlur() { finish(false); }
    api.current = {
      start,
      isActive: () => !!(d && d.active),
      isPending: () => !!d,
      shouldSuppressClick: () => state.suppressClick,
      placeGhost: moveGhost,
    };
  }

  useEffect(() => {
    // Stop the page from scrolling under a finger that is dragging a card.
    const block = (e) => { if (api.current.isActive()) e.preventDefault(); };
    document.addEventListener('touchmove', block, { passive: false });
    return () => document.removeEventListener('touchmove', block);
  }, []);

  return { drag, dropT, ghostRef, api: api.current };
}

/* ------------------------------------------------------------------ */
/* Small hooks                                                         */
/* ------------------------------------------------------------------ */

function useMedia(q) {
  const get = () => (window.matchMedia ? window.matchMedia(q).matches : false);
  const [m, setM] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(q);
    const f = () => setM(mq.matches);
    if (mq.addEventListener) mq.addEventListener('change', f); else mq.addListener(f);
    f();
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', f); else mq.removeListener(f); };
  }, [q]);
  return m;
}
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  return now;
}

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

const I = {
  plane: <path d="M12 2.5c.8 0 1.4.8 1.4 1.8v5l7.4 4.3v2l-7.4-2.1v4.4l2.3 1.7v1.6L12 20.3l-3.7.9v-1.6l2.3-1.7v-4.4l-7.4 2.1v-2l7.4-4.3v-5c0-1 .6-1.8 1.4-1.8z" />,
  car: <><path d="M3.5 16.5v-3.4c0-.5.2-1 .6-1.3L6.2 10l1.5-3.1c.3-.6.9-.9 1.5-.9h5.6c.6 0 1.2.3 1.5.9l1.5 3.1 2.1 1.8c.4.3.6.8.6 1.3v3.4z" /><path d="M6.2 10h11.6" /><circle cx="7.5" cy="16.8" r="1.7" /><circle cx="16.5" cy="16.8" r="1.7" /></>,
  cabin: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 9.6V20h13V9.6" /><path d="M10 20v-5.5h4V20" /><path d="M15.8 6.6V4h2.2v4.4" /></>,
  home: <><path d="M4 10.5 12 4l8 6.5V20H4z" /><path d="M9.5 20v-6h5v6" /></>,
  tree: <><path d="M12 3 6.5 10.5h3L5.5 16h13l-4-5.5h3z" /><path d="M12 16v5" /></>,
  moon: <path d="M19.5 14.6A7.8 7.8 0 1 1 9.4 4.5a6.3 6.3 0 0 0 10.1 10.1z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></>,
  sunrise: <><path d="M3 18.5h18" /><path d="M7.5 18.5a4.5 4.5 0 0 1 9 0" /><path d="M12 9.5V6.5M5.2 12.2l1.3 1.1M18.8 12.2l-1.3 1.1M3 15.5h1.5M19.5 15.5H21" /><path d="M10 4.5l2-2 2 2" /></>,
  sunset: <><path d="M3 18.5h18" /><path d="M7.5 18.5a4.5 4.5 0 0 1 9 0" /><path d="M12 3v4M5.2 12.2l1.3 1.1M18.8 12.2l-1.3 1.1M3 15.5h1.5M19.5 15.5H21" /><path d="M10 5.5l2 2 2-2" /></>,
  fork: <><path d="M7 3v18M4.5 3v5a2.5 2.5 0 0 0 5 0V3" /><path d="M17.5 21V3c-2.2 1.4-3.3 3.8-3.3 7 0 1.6.9 2.6 3.3 2.6" /></>,
  pin: <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  stroller: <><path d="M2.8 4.5h2.1l1.9 6.5" /><path d="M7 11h14a7 6 0 0 1-14 0z" /><path d="M13.8 11V4.2a7 7 0 0 1 7.2 6.8" /><circle cx="9" cy="20" r="1.5" /><circle cx="18.5" cy="20" r="1.5" /></>,
  baby: <><circle cx="12" cy="12.5" r="8.5" /><path d="M9.2 11h.01M14.8 11h.01" /><path d="M9.6 15.2a3.4 3.4 0 0 0 4.8 0" /><path d="M11 4.1c.4 1.3 1.8 1.6 2.6.9" /></>,
  carrier: <><circle cx="12" cy="4.8" r="2.1" /><path d="M8 21v-7.5a4 4 0 0 1 8 0V21" /><path d="M8 13.5c1.2 2.2 6.8 2.2 8 0" /><circle cx="12" cy="11.4" r="1.6" /></>,
  snow: <><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" /><path d="M9.6 4.6 12 6l2.4-1.4M9.6 19.4 12 18l2.4 1.4" /></>,
  sparkle: <><path d="M11 3.5l1.7 5.1 5.3 1.6-5.3 1.6L11 17l-1.7-5.2L4 10.2l5.3-1.6z" /><path d="M18 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" /></>,
  bag: <><path d="M5.5 8h13l-1 12.5h-11z" /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></>,
  fish: <><path d="M3 12c2.5-4 7-6 11-5 2.7.7 4.8 2.6 6 5-1.2 2.4-3.3 4.3-6 5-4 1-8.5-1-11-5z" /><path d="M3 12 1.8 8.8M3 12l-1.2 3.2" /><circle cx="15.5" cy="11" r=".6" fill="currentColor" /></>,
  wheel: <><circle cx="12" cy="10" r="7" /><circle cx="12" cy="10" r="1.3" /><path d="M12 3v14M5 10h14M7 5l10 10M17 5 7 15" /><path d="M8.5 21 12 11.3 15.5 21" /></>,
  lift: <><path d="M2.5 5.5 21.5 3" /><path d="M12 4.3V9" /><path d="M7.5 9h9v4.5a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2z" /><path d="M7.5 12.5h9M9.5 15.5v4M14.5 15.5v4" /></>,
  mill: <><path d="M4 20V10l5-4 5 4v10z" /><path d="M8 20v-4h2v4" /><circle cx="17" cy="14" r="4.5" /><path d="M17 9.5v9M12.5 14h9M13.8 10.8l6.4 6.4M20.2 10.8l-6.4 6.4" /></>,
  mug: <><path d="M5 8h11v6.5A4.5 4.5 0 0 1 11.5 19h-2A4.5 4.5 0 0 1 5 14.5z" /><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16" /><path d="M8.5 3.5c-.8 1 .8 1.7 0 2.8M12 3.5c-.8 1 .8 1.7 0 2.8" /></>,
  camera: <><path d="M4 8h3l1.6-2.5h6.8L17 8h3v11H4z" /><circle cx="12" cy="13.2" r="3.4" /></>,
  ship: <><path d="M3 15h18l-2.5 5h-13z" /><path d="M6 15V10h12v5" /><path d="M9 10V6h2.5v4M13 10V6h2.5v4" /></>,
  apple: <><path d="M12 7.5c-1.7-1.2-6.5-1.5-6.5 4.2 0 4 2.7 8.3 4.6 8.3 1 0 1.2-.5 1.9-.5s.9.5 1.9.5c1.9 0 4.6-4.3 4.6-8.3 0-5.7-4.8-5.4-6.5-4.2z" /><path d="M12 7.5c0-2 .8-3.5 2.5-4" /></>,
  horse: <><path d="M5 20l1.5-6.5c-1.6-1.3-2-3.3-1-5L8.5 4l1 2.5L12 5l1.5 3.5 4.5 2.5-1 2.5-3-1-2.5 2.5V20" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.3-4.3" /></>,
  sliders: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  more: <><circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  dashed: <circle cx="12" cy="12" r="7.5" strokeDasharray="3.2 2.8" />,
  ticket: <><path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z" /><path d="M14 7v10" strokeDasharray="1.6 2" /></>,
  skip: <><circle cx="12" cy="12" r="7.5" /><path d="M6.8 17.2 17.2 6.8" /></>,
  chevR: <path d="m9 5 7 7-7 7" />,
  chevL: <path d="m15 5-7 7 7 7" />,
  chevD: <path d="m6 9 6 6 6-6" />,
  up: <path d="M12 19V5M6 11l6-6 6 6" />,
  down: <path d="M12 5v14M6 13l6 6 6-6" />,
  trash: <><path d="M4 7h16M9.5 7V4.5h5V7" /><path d="M6 7l1 13h10l1-13" /></>,
  note: <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" />,
  ext: <><path d="M14 4h6v6M20 4l-8.5 8.5" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>,
  alert: <><path d="M12 4 2.8 19.5h18.4z" /><path d="M12 10v4M12 16.8h.01" /></>,
  cal: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M8.5 3v4M15.5 3v4" /></>,
  bulb: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.2 1.1 2V16h5v-.2c0-.8.4-1.5 1.1-2A6 6 0 0 0 12 3z" /></>,
  compass: <><circle cx="12" cy="12" r="8.5" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><circle cx="17" cy="9.5" r="2.3" /><path d="M15.5 14.2A4.5 4.5 0 0 1 21 18.5" /></>,
  grip: <><circle cx="9" cy="7" r="1.2" fill="currentColor" stroke="none" /><circle cx="15" cy="7" r="1.2" fill="currentColor" stroke="none" /><circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="9" cy="17" r="1.2" fill="currentColor" stroke="none" /><circle cx="15" cy="17" r="1.2" fill="currentColor" stroke="none" /></>,
  move: <><path d="M5 12h14M15 8l4 4-4 4" /><path d="M5 6v12" /></>,
  undo: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></>,
  cloud: <path d="M7 18.5h10a4 4 0 0 0 .6-8 5.5 5.5 0 0 0-10.6 1.4A3.3 3.3 0 0 0 7 18.5z" />,
};

function Icon({ name, size = 18, className }) {
  return (
    <svg className={cx('ico', className)} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {I[name] || I.pin}
    </svg>
  );
}

function Ring({ done, total, size = 22, stroke = 3 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total ? done / total : 0;
  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ring-track)" strokeWidth={stroke} />
      {pct > 0 && (
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ring)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${(c * pct).toFixed(2)} ${c.toFixed(2)}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Header art: layered Smokies ridgelines with a cabin                 */
/* ------------------------------------------------------------------ */

function ridgePath(pts, h = 160) {
  let d = `M0 ${h} L${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0]} ${p2[1]}`;
  }
  return `${d} L1000 ${h} Z`;
}
const RIDGES = [
  { fill: 'var(--r1)', d: ridgePath([[0, 70], [90, 52], [180, 64], [270, 36], [370, 58], [460, 44], [560, 66], [650, 40], [760, 54], [860, 30], [1000, 56]]) },
  { fill: 'var(--r2)', d: ridgePath([[0, 92], [110, 76], [210, 90], [310, 66], [430, 88], [530, 72], [630, 92], [720, 74], [820, 84], [920, 66], [1000, 80]]) },
  { fill: 'var(--r3)', d: ridgePath([[0, 118], [90, 104], [190, 116], [300, 98], [400, 112], [500, 102], [600, 116], [700, 106], [760, 100], [860, 100], [930, 110], [1000, 104]]) },
  { fill: 'var(--bg)', d: ridgePath([[0, 142], [120, 130], [240, 140], [380, 127], [520, 138], [660, 128], [800, 140], [920, 131], [1000, 136]]) },
];

function Ridges() {
  return (
    <>
      <svg className="ridges" viewBox="0 0 1000 160" preserveAspectRatio="none" aria-hidden="true">
        {RIDGES.map((r, i) => <path key={i} d={r.d} fill={r.fill} />)}
      </svg>
      <svg className="cabin-art" viewBox="0 0 40 46" aria-hidden="true">
        <path d="M29 12c-2.4-2 1.6-3.6-.4-6.2M31.6 9.2c-1.6-1.4 1-2.6-.3-4.4" fill="none" stroke="var(--smoke)" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M27 24V14.5h4.2V29z" fill="var(--cabin)" />
        <path d="M2 45 20 16l18 29z" fill="var(--cabin)" />
        <path d="M16.6 45v-8.2a3.4 3.4 0 0 1 6.8 0V45z" fill="var(--glow)" />
        <circle cx="20" cy="28.6" r="1.8" fill="var(--glow)" />
      </svg>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

function Sheet({ title, sub, onClose, children, wide }) {
  const panel = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const el = panel.current;
    if (el) {
      const f = el.querySelector('[data-autofocus]') || el;
      try { f.focus({ preventScroll: true }); } catch (_) { f.focus(); }
    }
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.documentElement.classList.add('sheet-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('sheet-open');
      if (prev && prev.focus) { try { prev.focus({ preventScroll: true }); } catch (_) { /* gone */ } }
    };
  }, []);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className={cx('sheet', wide && 'sheet-wide')} role="dialog" aria-modal="true" aria-label={title} ref={panel} tabIndex={-1}>
        <div className="sheet-grab" aria-hidden="true" />
        <div className="sheet-head">
          <div className="sheet-head-text">
            <h2 className="sheet-title">{title}</h2>
            {sub && <p className="sheet-sub">{sub}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        {children}
      </div>
    </>
  );
}

function DayPicker({ value, onChange, plan }) {
  return (
    <div className="pick-days" role="group" aria-label="Day">
      {DAYS.map((d) => (
        <button key={d.id} className="pick" aria-pressed={value === d.id} onClick={() => onChange(d.id)}>
          <span className="pick-dow">{d.dow}</span>
          <span className="pick-date">{d.short}</span>
          <span className={cx('pick-tag', `tone-${TAG_TONE[tagFor(plan, d.id)]}`)}>{tagFor(plan, d.id)}</span>
        </button>
      ))}
    </div>
  );
}

function SlotPicker({ value, onChange, suggested }) {
  return (
    <div className="pick-slots" role="group" aria-label="Time of day">
      {SLOTS.map((s) => (
        <button key={s.id} className="pick pick-slot" aria-pressed={value === s.id} onClick={() => onChange(s.id)}>
          <Icon name={s.icon} size={17} />
          <span className="pick-slot-text">
            <b>{s.label}{s.nap ? ' · nap window' : ''}</b>
            <span>{s.range}</span>
          </span>
          {suggested === s.id && <span className="pick-sugg">Suggested</span>}
        </button>
      ))}
    </div>
  );
}

function Facts({ a, compact }) {
  const toddlerTone = a.toddler === 'Great' ? 'good' : a.toddler === 'Use carrier' ? 'warn' : '';
  return (
    <div className={cx('facts', compact && 'facts-compact')}>
      <span className="fact"><Icon name="clock" size={14} />{fmtDur(a.dur)}</span>
      <span className="fact fact-cost">{a.cost}</span>
      <span className={cx('fact', toddlerTone)}><Icon name={a.toddler === 'Use carrier' ? 'carrier' : 'baby'} size={14} />{a.toddler === 'Use carrier' ? 'Use carrier' : `Toddlers: ${a.toddler}`}</span>
      {a.stroller !== 'na' && (
        <span className={cx('fact', a.stroller === 'no' && 'muted')}>
          <Icon name="stroller" size={14} />{a.stroller === 'yes' ? 'Stroller-friendly' : a.stroller === 'partial' ? 'Stroller in parts' : 'No strollers'}
        </span>
      )}
      <span className="fact"><Icon name={a.setting === 'Indoor' ? 'home' : a.setting === 'In the car' ? 'car' : a.setting === 'Mixed' ? 'cloud' : 'tree'} size={14} />{a.setting === 'Mixed' ? 'Indoor + outdoor' : a.setting}</span>
      <span className="fact"><Icon name={a.weather === 'any' ? 'snow' : 'sun'} size={14} />{a.weather === 'any' ? 'Any weather' : 'Fair weather only'}</span>
    </div>
  );
}

function CheckNote({ a }) {
  if (!a.check) return null;
  return (
    <p className={cx('check', a.verify && 'verify')}>
      <Icon name={a.verify ? 'alert' : 'clock'} size={16} />
      <span><b>{a.verify ? 'Verify before going' : 'Check hours/dates'}</b>{a.check}</span>
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Itinerary                                                           */
/* ------------------------------------------------------------------ */

function DayRail({ plan, dayId, onSelect, liveDayId, dropT }) {
  const railRef = useRef(null);
  useEffect(() => {
    const el = railRef.current && railRef.current.querySelector(`[data-drop-day="${dayId}"]`);
    if (el && el.scrollIntoView) {
      const p = railRef.current.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      if (r.left < p.left || r.right > p.right) railRef.current.scrollBy({ left: r.left - p.left - 16, behavior: 'smooth' });
    }
  }, [dayId]);
  return (
    <div className="rail">
      <div className="pills" ref={railRef} role="tablist" aria-label="Trip days">
        {DAYS.map((d) => {
          const s = dayStats(plan, d.id);
          const tag = tagFor(plan, d.id);
          return (
            <button key={d.id} role="tab" aria-selected={dayId === d.id} data-drop-day={d.id}
              className={cx('pill', dayId === d.id && 'sel', dropT && dropT.pill === d.id && 'drop-over')}
              onClick={() => onSelect(d.id)}>
              <span className="p-dow">{d.dow}{liveDayId === d.id ? ' · Today' : ''}</span>
              <span className="p-date">{d.short}</span>
              <Ring done={s.done} total={s.total} size={24} />
              <span className={cx('p-tag', `tone-${TAG_TONE[tag]}`)}><i />{tag}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ItemCard({ uid, item, info, time, live, lifted, dropBefore, readOnly, dnd, onStatus, onMenu }) {
  const [open, setOpen] = useState(false);
  const a = info.act;
  const clock = fmtClock(time.start);
  const st = STATUS[item.status] || STATUS.planned;
  const toggle = () => { if (dnd.api.shouldSuppressClick()) return; setOpen((o) => !o); };
  const draggable = !readOnly;
  return (
    <div className={cx('row', lifted && 'lifted', dropBefore && 'drop-before', `st-${item.status}`, live && `is-${live}`)} data-card-uid={uid} data-live={live || undefined}>
      <span className="dot" aria-hidden="true">{item.status === 'done' && <Icon name="check" size={10} />}</span>
      <div
        className={cx('card', `tone-${info.tone}`, draggable && 'draggable')}
        onPointerDown={draggable ? (e) => dnd.api.start(e, { type: 'item', uid }, { label: info.title, sub: 'Drop on a time of day, or on a day above', icon: info.icon, tone: info.tone }) : undefined}
        onContextMenu={draggable ? (e) => e.preventDefault() : undefined}
        onClick={toggle}
      >
        {live && <span className="live-tag">{live === 'now' ? 'Happening now' : 'Up next'}</span>}
        <div className="c-head">
          <span className={cx('tile', `tone-${info.tone}`)}><Icon name={info.icon} size={18} /></span>
          <div className="c-main">
            <p className="c-time">
              {time.est && <span className="tilde" title="Estimated from the item before">~</span>}{clock.t} {clock.ap}
              <span className="c-dur"> · {fmtDur(info.dur)}</span>
            </p>
            <h4 className="c-title">{info.title}</h4>
            {(info.area || (a && a.cost)) && (
              <p className="c-meta">{[info.area, a && a.cost !== 'Free' ? a.cost : a ? 'Free' : null, a && a.drive ? `${a.drive} min drive` : null].filter(Boolean).join(' · ')}</p>
            )}
          </div>
          {!readOnly && (
            <button className="icon-btn more" data-nodrag aria-label={`Options for ${info.title}`} onClick={(e) => { e.stopPropagation(); onMenu(uid); }}>
              <Icon name="more" />
            </button>
          )}
        </div>
        <div className="c-foot">
          {!a && info.info && !open && <p className="c-info">{info.info}</p>}
          <div className="badges">
            {a && <span className={cx('badge', a.toddler === 'Great' && 'good', a.toddler === 'Use carrier' && 'warn')} title={`Toddler-friendly: ${a.toddler}`}><Icon name={a.toddler === 'Use carrier' ? 'carrier' : 'baby'} size={13} />{a.toddler}</span>}
            {a && a.stroller !== 'na' && <span className={cx('badge', 'icon-only', a.stroller === 'no' && 'struck')} title={a.stroller === 'yes' ? 'Stroller-friendly' : a.stroller === 'partial' ? 'Stroller in parts' : 'No strollers'}><Icon name="stroller" size={14} /></span>}
            {a && <span className="badge icon-only" title={a.setting}><Icon name={a.setting === 'Indoor' ? 'home' : a.setting === 'In the car' ? 'car' : a.setting === 'Mixed' ? 'cloud' : 'tree'} size={14} /></span>}
            {a && a.verify && item.status !== 'done' && item.status !== 'skipped' && <span className="badge warn">Verify</span>}
            {time.napClash && <span className="badge night"><Icon name="moon" size={12} />Nap time</span>}
          </div>
          <button className={cx('status', `s-${item.status}`)} data-nodrag disabled={readOnly}
            aria-label={`Status: ${st.label}. Tap to change.`}
            onClick={(e) => { e.stopPropagation(); onStatus(uid); }}>
            <Icon name={st.icon} size={14} />{st.label}
          </button>
        </div>
        {item.note && <p className="c-note"><Icon name="note" size={13} />{item.note}</p>}
        {open && (
          <div className="c-details" data-nodrag onClick={(e) => e.stopPropagation()}>
            {a ? (
              <>
                <p className="why"><b>For little ones</b>{a.why}</p>
                <p className="tips"><b>Tips</b>{a.tips}</p>
                <CheckNote a={a} />
                {a.url && <a className="link" href={a.url} target="_blank" rel="noopener noreferrer">Official site <Icon name="ext" size={14} /></a>}
              </>
            ) : (
              info.info ? <p className="tips">{info.info}</p> : <p className="tips">No details yet. Add a note from the menu.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DayView({ plan, dayId, live, readOnly, dnd, onStatus, onMenu, onQuickAdd, onTag, isLiveDay }) {
  const day = DAY[dayId];
  const dp = plan.days[dayId];
  const timeline = useMemo(() => computeTimeline(dp, plan.items), [dp, plan.items]);
  const stats = dayStats(plan, dayId);
  const tag = tagFor(plan, dayId);
  const { drag, dropT } = dnd;

  // Current and next activity, only on the live day.
  let nowUid = null, nextUid = null;
  if (isLiveDay) {
    const order = SLOTS.flatMap((s) => dp[s.id]);
    order.forEach((uid) => {
      const it = plan.items[uid], t = timeline[uid];
      if (!it || !t || it.status === 'skipped' || it.status === 'done') return;
      if (!nowUid && t.start <= live.min && live.min < t.end) nowUid = uid;
    });
    let best = null;
    order.forEach((uid) => {
      const it = plan.items[uid], t = timeline[uid];
      if (!it || !t || it.status === 'skipped' || it.status === 'done' || uid === nowUid) return;
      if (t.start > live.min && (!best || t.start < timeline[best].start)) best = uid;
    });
    nextUid = best;
  }
  const allUids = SLOTS.flatMap((s) => dp[s.id]);
  const drives = allUids.filter((u) => { const i = resolveItem(plan.items[u]); return i.kind === 'drive' || (i.act && i.act.setting === 'In the car'); }).length;

  return (
    <section className="day" aria-label={`${day.weekday}, ${day.long}`}>
      <div className="day-head">
        <div className="day-head-text">
          <p className="day-kicker">
            Day {day.n} of 5
            <button className={cx('tag-btn', `tone-${TAG_TONE[tag]}`)} onClick={() => onTag(dayId)} disabled={readOnly} aria-label={`Day type: ${tag}. Change`}>
              {tag}{!readOnly && <Icon name="chevD" size={13} />}
            </button>
            {isLiveDay && <span className="today-chip">Today</span>}
          </p>
          <h2>{day.weekday}, {day.long}</h2>
          <p className="day-facts">
            <span><Icon name="sunrise" size={15} />{day.sun[0]}</span>
            <span><Icon name="sunset" size={15} />{day.sun[1]}</span>
            <span><Icon name="pin" size={15} />{allUids.length} {allUids.length === 1 ? 'stop' : 'stops'}</span>
            {drives > 0 && <span><Icon name="car" size={15} />{drives} {drives === 1 ? 'drive' : 'drives'}</span>}
            {stats.booked > 0 && <span><Icon name="ticket" size={15} />{stats.booked} booked</span>}
          </p>
        </div>
        <div className="big-ring" title={`${stats.done} of ${stats.total} done`}>
          <Ring done={stats.done} total={stats.total} size={62} stroke={5} />
          <b>{stats.done}<span>/{stats.total}</span></b>
          <small>done</small>
        </div>
      </div>

      {isLiveDay && (
        <div className="now-banner" role="status">
          {nowUid ? (
            <p className="now-line"><span className="pulse" /><b>Now</b><span>{resolveItem(plan.items[nowUid]).title}</span><em>until about {fmtTime(timeline[nowUid].end)}</em></p>
          ) : (
            <p className="now-line"><span className="pulse idle" /><b>Now</b><span>{nextUid ? 'Free time' : 'That’s a wrap for today'}</span></p>
          )}
          {nextUid && <p className="next-line">Up next at {fmtTime(timeline[nextUid].start)}: {resolveItem(plan.items[nextUid]).title}</p>}
        </div>
      )}

      <div className="tl">
        {SLOTS.map((slot) => {
          const uids = dp[slot.id];
          const isTarget = dropT && !dropT.pill && dropT.day === dayId && dropT.slot === slot.id;
          return (
            <section className={cx('slot', `slot-${slot.id}`)} key={slot.id} aria-label={slot.label}>
              <header className="slot-head">
                <span className="slot-ico"><Icon name={slot.icon} size={15} /></span>
                <div className="slot-title">
                  <h3>{slot.label}</h3>
                  <span className="slot-range">{slot.range}</span>
                  {slot.nap && <span className="nap-badge"><Icon name="moon" size={12} />Nap window</span>}
                </div>
                {!readOnly && (
                  <button className="add-btn" onClick={() => onQuickAdd(dayId, slot.id)} aria-label={`Add to ${slot.label}`}>
                    <Icon name="plus" size={15} />Add
                  </button>
                )}
              </header>
              {slot.nap && <p className="nap-hint">Littles usually nap about 12:30–2:30. Cabin time or a car-nap drive fits best.</p>}
              <div className={cx('slot-body', !uids.length && 'is-empty', isTarget && 'drop-active', isTarget && !dropT.beforeUid && 'drop-end')}
                data-drop-slot={`${dayId}:${slot.id}`}>
                {uids.map((uid) => {
                  const it = plan.items[uid];
                  if (!it) return null;
                  return (
                    <ItemCard key={uid} uid={uid} item={it} info={resolveItem(it)} time={timeline[uid]}
                      live={uid === nowUid ? 'now' : uid === nextUid ? 'next' : null}
                      lifted={!!(drag && drag.source.type === 'item' && drag.source.uid === uid)}
                      dropBefore={!!(isTarget && dropT.beforeUid === uid)}
                      readOnly={readOnly} dnd={dnd} onStatus={onStatus} onMenu={onMenu} />
                  );
                })}
                {!uids.length && (
                  <div className="row row-empty">
                    <span className="dot" aria-hidden="true" />
                    <div className="slot-empty">
                      {readOnly ? 'Open time.' : <>Open time. Drag a card here, or <button className="text-btn" onClick={() => onQuickAdd(dayId, slot.id)}>add something</button>.</>}
                    </div>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
      {!readOnly && <p className="dnd-hint"><Icon name="grip" size={15} />Press and hold a card to drag it, or use <Icon name="more" size={15} /> to move it to another day.</p>}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Idea bank                                                           */
/* ------------------------------------------------------------------ */

function IdeaCard({ a, onAdd, addLabel, dnd, draggable }) {
  return (
    <article className={cx('idea', draggable && 'draggable')}
      onPointerDown={draggable ? (e) => dnd.api.start(e, { type: 'lib', aid: a.id }, { label: a.name, sub: 'Drop on a time of day, or on a day', icon: a.icon || CAT_ICON[a.cats[0]], tone: CAT_TONE[a.cats[0]] }) : undefined}>
      <header className="idea-head">
        <span className={cx('tile', `tone-${CAT_TONE[a.cats[0]]}`)}><Icon name={a.icon || CAT_ICON[a.cats[0]]} size={19} /></span>
        <div className="idea-title">
          <h3>{a.name}</h3>
          <p className="idea-sub"><Icon name="pin" size={13} />{a.area}<span aria-hidden="true">·</span>{a.drive ? `about ${a.drive} min from the cabin` : 'at the cabin'}</p>
        </div>
      </header>
      <Facts a={a} />
      <p className="why"><b>Why it’s good for little ones</b>{a.why}</p>
      <p className="tips"><b>Tips</b>{a.tips}</p>
      <CheckNote a={a} />
      <footer className="idea-foot">
        {a.url ? <a className="link" href={a.url} target="_blank" rel="noopener noreferrer" data-nodrag>Official site <Icon name="ext" size={14} /></a> : <span />}
        {onAdd && <button className="btn btn-primary" data-nodrag onClick={() => onAdd(a.id)}><Icon name="plus" size={16} />{addLabel}</button>}
      </footer>
    </article>
  );
}

function IdeasView({ plan, scheduled, target, onClearTarget, onAdd, readOnly, dnd, canDrag }) {
  const saved = lsGet(LS_UI) || {};
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(() => saved.filters || {});
  const [sort, setSort] = useState(() => saved.sort || 'drive');
  const [open, setOpen] = useState(false);
  useEffect(() => { const u = lsGet(LS_UI) || {}; u.filters = sel; u.sort = sort; lsSet(LS_UI, u); }, [sel, sort]);

  const toggle = (key, v) => setSel((s) => {
    const cur = new Set(s[key] || []);
    if (cur.has(v)) cur.delete(v); else cur.add(v);
    return { ...s, [key]: Array.from(cur) };
  });
  const activeCount = Object.values(sel).reduce((n, a) => n + (a ? a.length : 0), 0);

  const list = useMemo(() => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const out = ACTIVITIES.filter((a) => !scheduled.has(a.id)).filter((a) => {
      for (const f of FILTERS) { const v = sel[f.key]; if (v && v.length && !v.some((x) => f.test(a, x))) return false; }
      if (!terms.length) return true;
      const hay = `${a.name} ${a.area} ${a.cats.join(' ')} ${a.why} ${a.tips}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
    const key = { drive: (a) => a.drive, cost: (a) => COST_ORDER[a.cost], dur: (a) => a.dur }[sort];
    return out.sort((x, y) => key(x) - key(y) || x.name.localeCompare(y.name));
  }, [q, sel, sort, scheduled]);
  const unscheduled = ACTIVITIES.length - scheduled.size;

  return (
    <section className="ideas" aria-label="Idea bank">
      <div className="ideas-head">
        <div className="ideas-title">
          <h2>Idea bank</h2>
          <p>{unscheduled} ideas not on the plan yet</p>
        </div>
        {target && (
          <div className="target-bar">
            <Icon name="plus" size={16} />
            <span>Adding to <b>{whereLabel(target.day, target.slot)}</b></span>
            <button className="text-btn" onClick={onClearTarget}>Done</button>
          </div>
        )}
        <label className="search" htmlFor="idea-search">
          <span className="sr">Search ideas</span>
          <Icon name="search" size={18} className="search-ico" />
          <input id="idea-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: lights, aquarium, free…" autoComplete="off" />
          {q && <button className="icon-btn search-clear" onClick={() => setQ('')} aria-label="Clear search"><Icon name="x" size={16} /></button>}
        </label>
        <div className="toolbar">
          <button className={cx('filter-btn', open && 'on')} aria-expanded={open} aria-controls="idea-filters" onClick={() => setOpen((o) => !o)}>
            <Icon name="sliders" size={16} />Filters{activeCount > 0 && <span className="count">{activeCount}</span>}
          </button>
          <div className="seg" role="group" aria-label="Sort by">
            {SORTS.map(([k, label]) => <button key={k} aria-pressed={sort === k} onClick={() => setSort(k)}>{label}</button>)}
          </div>
        </div>
        {open && (
          <div className="filters" id="idea-filters">
            {FILTERS.map((f) => (
              <div className="fgroup" key={f.key}>
                <h4>{f.label}</h4>
                <div className="chips">
                  {f.options.map((o) => (
                    <button key={o} className="chip" aria-pressed={(sel[f.key] || []).includes(o)} onClick={() => toggle(f.key, o)}>{o}</button>
                  ))}
                </div>
              </div>
            ))}
            {activeCount > 0 && <button className="text-btn clear-all" onClick={() => setSel({})}>Clear all filters</button>}
          </div>
        )}
        {!open && activeCount > 0 && (
          <div className="chips active-chips">
            {FILTERS.flatMap((f) => (sel[f.key] || []).map((o) => (
              <button key={f.key + o} className="chip" aria-pressed="true" onClick={() => toggle(f.key, o)} aria-label={`Remove filter ${o}`}>{o}<Icon name="x" size={13} /></button>
            )))}
            <button className="text-btn" onClick={() => setSel({})}>Clear</button>
          </div>
        )}
      </div>
      {list.length ? (
        <div className="idea-list">
          {list.map((a) => (
            <IdeaCard key={a.id} a={a} dnd={dnd} draggable={canDrag && !readOnly}
              onAdd={readOnly ? null : onAdd} addLabel={target ? `Add to ${SLOT[target.slot].label.toLowerCase()}` : 'Add to day'} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <Icon name="search" size={22} />
          <p>{unscheduled ? 'No ideas match these filters.' : 'Every idea is on the plan. Nice work.'}</p>
          {(activeCount > 0 || q) && <button className="btn btn-ghost" onClick={() => { setSel({}); setQ(''); }}>Clear search and filters</button>}
        </div>
      )}
      {scheduled.size > 0 && <p className="foot-note">{scheduled.size} more ideas are already on your plan. Remove one from a day to send it back here.</p>}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Trip essentials                                                     */
/* ------------------------------------------------------------------ */

function TripView({ plan, onToggleCheck, onJump, preview, onPreview, onReset, readOnly, inMain }) {
  const all = Object.values(plan.items);
  const live = all.filter((i) => i.status !== 'skipped');
  const booked = live.filter((i) => i.status === 'booked').length;
  const done = live.filter((i) => i.status === 'done').length;
  const toVerify = [];
  DAYS.forEach((d) => SLOTS.forEach((s) => plan.days[d.id][s.id].forEach((uid) => {
    const it = plan.items[uid];
    const a = it && it.aid && ACT[it.aid];
    if (a && a.check && it.status !== 'done' && it.status !== 'skipped') toVerify.push({ uid, a, day: d.id, slot: s.id, status: it.status });
  })));
  toVerify.sort((x, y) => (y.a.verify ? 1 : 0) - (x.a.verify ? 1 : 0));
  const packed = PACKING.filter(([k]) => plan.checks && plan.checks[k]).length;

  return (
    <section className={cx('trip', inMain && 'in-main')} aria-label="Trip essentials">
      <div className="trip-block">
        <h2 className="block-title">At a glance</h2>
        <div className="tiles">
          <div className="stat"><b>{live.length}</b><span>stops on the plan</span></div>
          <div className="stat"><b>{booked}</b><span>booked</span></div>
          <div className="stat"><b>{done}</b><span>done</span></div>
          <div className={cx('stat', toVerify.length && 'warn')}><b>{toVerify.length}</b><span>to check before going</span></div>
        </div>
      </div>

      <div className="trip-block">
        <h2 className="block-title">Check before you go</h2>
        {toVerify.length ? (
          <ul className="verify-list">
            {toVerify.map(({ uid, a, day, slot, status }) => (
              <li key={uid} className={cx(a.verify && 'is-verify')}>
                <button className="verify-main" onClick={() => onJump(day, uid)}>
                  <span className="v-when">{DAY[day].dow} {DAY[day].short} · {SLOT[slot].label}{status === 'booked' ? ' · Booked' : ''}</span>
                  <span className="v-name">{a.name}</span>
                  <span className="v-text">{a.verify && <b>Seasonal dates. </b>}{a.check}</span>
                </button>
                {a.url && <a className="icon-btn" href={a.url} target="_blank" rel="noopener noreferrer" aria-label={`${a.name} official site`}><Icon name="ext" size={16} /></a>}
              </li>
            ))}
          </ul>
        ) : <p className="muted-text">Nothing on the plan needs checking. Nice.</p>}
      </div>

      <div className="trip-block">
        <div className="block-row">
          <h2 className="block-title">Little ones packing list</h2>
          <span className="block-count">{packed}/{PACKING.length}</span>
        </div>
        <ul className="checklist">
          {PACKING.map(([k, label]) => {
            const on = !!(plan.checks && plan.checks[k]);
            return (
              <li key={k}>
                <label className={cx('check-row', on && 'on')} htmlFor={`pack-${k}`}>
                  <input id={`pack-${k}`} type="checkbox" checked={on} disabled={readOnly} onChange={() => onToggleCheck(k)} />
                  <span className="box" aria-hidden="true"><Icon name="check" size={13} /></span>
                  <span>{label}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="trip-block">
        <h2 className="block-title">Know before you go</h2>
        <div className="know">
          {KNOW.map((k) => (
            <div className="know-item" key={k.title}>
              <span className="tile tone-haze"><Icon name={k.icon} size={17} /></span>
              <div><h3>{k.title}</h3><p>{k.text}</p></div>
            </div>
          ))}
        </div>
      </div>

      <div className="trip-block settings">
        <h2 className="block-title">Settings</h2>
        <label className="switch-row" htmlFor="preview-toggle">
          <span>
            <b>Preview trip-day mode</b>
            <span>See how the plan looks on Saturday, Jan 2 at 10:20 AM, with the current activity highlighted.</span>
          </span>
          <input id="preview-toggle" type="checkbox" role="switch" checked={preview} onChange={(e) => onPreview(e.target.checked)} />
          <span className="switch" aria-hidden="true" />
        </label>
        {!readOnly && <button className="btn btn-ghost danger" onClick={onReset}><Icon name="undo" size={16} />Reset to the suggested plan</button>}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Sheets                                                              */
/* ------------------------------------------------------------------ */

function ItemMenu({ plan, uid, onClose, actions }) {
  const it = plan.items[uid];
  const loc = it ? findLoc(plan, uid) : null;
  const [view, setView] = useState('main');
  const [mvDay, setMvDay] = useState(loc ? loc.day : 'd1');
  const [mvSlot, setMvSlot] = useState(loc ? loc.slot : 'morning');
  const [time, setTime] = useState(it && it.time ? it.time : '');
  const [note, setNote] = useState(it ? it.note || '' : '');
  if (!it || !loc) return null;
  const info = resolveItem(it);
  const list = plan.days[loc.day][loc.slot];
  const where = whereLabel(loc.day, loc.slot);

  if (view === 'move') {
    return (
      <Sheet title="Move to…" sub={info.title} onClose={onClose}>
        <h3 className="field-label">Day</h3>
        <DayPicker value={mvDay} onChange={setMvDay} plan={plan} />
        <h3 className="field-label">Time of day</h3>
        <SlotPicker value={mvSlot} onChange={setMvSlot} suggested={info.act ? info.act.slot : null} />
        <div className="sheet-actions">
          <button className="btn btn-ghost" onClick={() => setView('main')}>Back</button>
          <button className="btn btn-primary" data-autofocus onClick={() => { actions.move(uid, mvDay, mvSlot, null); onClose(); }}>Move to {DAY[mvDay].dow} · {SLOT[mvSlot].label}</button>
        </div>
      </Sheet>
    );
  }
  if (view === 'time') {
    return (
      <Sheet title="Start time" sub={info.title} onClose={onClose}>
        <label className="field" htmlFor="im-time">
          <span className="field-label">Starts at</span>
          <input id="im-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} data-autofocus step="300" />
        </label>
        <p className="field-help">Leave it on auto and the time follows the activity before it.</p>
        <div className="sheet-actions">
          <button className="btn btn-ghost" onClick={() => { actions.setTime(uid, null); onClose(); }}>Use auto time</button>
          <button className="btn btn-primary" disabled={!time} onClick={() => { actions.setTime(uid, time); onClose(); }}>Save time</button>
        </div>
      </Sheet>
    );
  }
  if (view === 'note') {
    return (
      <Sheet title="Note" sub={info.title} onClose={onClose}>
        <label className="field" htmlFor="im-note">
          <span className="field-label">Confirmation numbers, who's driving, what to bring</span>
          <textarea id="im-note" rows={4} value={note} onChange={(e) => setNote(e.target.value)} data-autofocus maxLength={500} />
        </label>
        <div className="sheet-actions">
          <button className="btn btn-ghost" onClick={() => setView('main')}>Back</button>
          <button className="btn btn-primary" onClick={() => { actions.setNote(uid, note.trim()); onClose(); }}>Save note</button>
        </div>
      </Sheet>
    );
  }
  return (
    <Sheet title={info.title} sub={where} onClose={onClose}>
      <div className="seg seg-full" role="group" aria-label="Status">
        {Object.entries(STATUS).map(([k, s]) => (
          <button key={k} aria-pressed={it.status === k} className={`s-${k}`} onClick={() => actions.setStatus(uid, k)}>
            <Icon name={s.icon} size={15} />{s.label}
          </button>
        ))}
      </div>
      <div className="menu-list">
        <button data-autofocus onClick={() => setView('move')}><Icon name="move" />Move to another day or time<Icon name="chevR" className="end" /></button>
        <button disabled={loc.idx === 0 && loc.slot === 'morning'} onClick={() => actions.nudge(uid, -1)}><Icon name="up" />Move up</button>
        <button disabled={loc.idx === list.length - 1 && loc.slot === 'evening'} onClick={() => actions.nudge(uid, 1)}><Icon name="down" />Move down</button>
        <button onClick={() => setView('time')}><Icon name="clock" />{it.time ? `Start time: ${fmtTime(toMin(it.time))}` : 'Set a start time'}<Icon name="chevR" className="end" /></button>
        <button onClick={() => setView('note')}><Icon name="note" />{it.note ? 'Edit note' : 'Add a note'}<Icon name="chevR" className="end" /></button>
        <button className="danger" onClick={() => { actions.remove(uid); onClose(); }}>
          <Icon name="trash" />{it.aid ? 'Remove from plan (back to ideas)' : 'Delete from plan'}
        </button>
      </div>
    </Sheet>
  );
}

function AddToDaySheet({ plan, aid, defaultDay, onClose, onConfirm }) {
  const a = ACT[aid];
  const [day, setDay] = useState(defaultDay);
  const [slot, setSlot] = useState(a ? a.slot : 'morning');
  if (!a) return null;
  // Would this run into nap time if added at the end of the slot?
  const tl = computeTimeline(plan.days[day], plan.items);
  let cursor = SLOT[slot].start;
  SLOTS.forEach((s) => plan.days[day][s.id].forEach((u) => {
    const it = plan.items[u];
    if (tl[u] && it.status !== 'skipped' && SLOTS.findIndex((x) => x.id === s.id) <= SLOTS.findIndex((x) => x.id === slot)) cursor = Math.max(cursor, tl[u].end);
  }));
  const start = Math.max(cursor, SLOT[slot].start);
  const overlap = Math.max(0, Math.min(start + a.dur, NAP.end) - Math.max(start, NAP.start));
  const hints = [];
  if (overlap > 30 && !napFriendly({ kind: 'activity', act: a })) hints.push(['moon', `Starting around ${fmtTime(start)}, this runs into nap time. A stroller or carrier nap could work.`]);
  if (a.weather === 'fair') hints.push(['sun', 'Fair weather only. Keep an indoor backup handy, like the aquarium or Old Mill Square.']);
  if (a.toddler === 'Use carrier') hints.push(['carrier', 'Bring carriers for the littles. Strollers don’t work well here.']);
  if (a.verify) hints.push(['alert', 'Seasonal dates. Verify it’s open before you go.']);
  if (tagFor(plan, day) === 'Cabin Day' && a.area !== 'Cabin') hints.push(['cabin', 'This is marked as a cabin day.']);
  return (
    <Sheet title="Add to day" sub={a.name} onClose={onClose}>
      <h3 className="field-label">Day</h3>
      <DayPicker value={day} onChange={setDay} plan={plan} />
      <h3 className="field-label">Time of day</h3>
      <SlotPicker value={slot} onChange={setSlot} suggested={a.slot} />
      {hints.length > 0 && (
        <ul className="hints">
          {hints.map(([icon, text]) => <li key={text}><Icon name={icon} size={16} />{text}</li>)}
        </ul>
      )}
      <div className="sheet-actions">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" data-autofocus onClick={() => { onConfirm(aid, day, slot); onClose(); }}>Add to {DAY[day].dow} · {SLOT[slot].label}</button>
      </div>
    </Sheet>
  );
}

function QuickAddSheet({ plan, day, slot, scheduled, onClose, onAddIdea, onBrowse, onAddCustom }) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState(slot === 'midday' ? 'nap' : 'custom');
  const [time, setTime] = useState('');
  const [dur, setDur] = useState(60);
  const [note, setNote] = useState('');
  const sugg = ACTIVITIES.filter((a) => !scheduled.has(a.id))
    .sort((x, y) => (x.slot === slot ? 0 : 1) - (y.slot === slot ? 0 : 1) || x.drive - y.drive)
    .slice(0, 4);
  const submit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAddCustom(day, slot, { title: title.trim(), kind, time: time || null, dur: Number(dur), note: note.trim() });
    onClose();
  };
  return (
    <Sheet title={`Add to ${SLOT[slot].label.toLowerCase()}`} sub={`${DAY[day].weekday}, ${DAY[day].long}`} onClose={onClose}>
      {sugg.length > 0 && (
        <>
          <h3 className="field-label">From the idea bank</h3>
          <ul className="sugg-list">
            {sugg.map((a) => (
              <li key={a.id}>
                <span className={cx('tile', `tone-${CAT_TONE[a.cats[0]]}`)}><Icon name={a.icon || CAT_ICON[a.cats[0]]} size={17} /></span>
                <span className="sugg-text"><b>{a.name}</b><span>{fmtDur(a.dur)} · {a.cost} · {a.area}</span></span>
                <button className="btn btn-small" onClick={() => { onAddIdea(a.id, day, slot); onClose(); }} aria-label={`Add ${a.name}`}><Icon name="plus" size={15} />Add</button>
              </li>
            ))}
          </ul>
          <button className="text-btn browse" onClick={() => { onBrowse(day, slot); onClose(); }}>Browse all ideas <Icon name="chevR" size={15} /></button>
        </>
      )}
      <form className="qa-form" onSubmit={submit}>
        <h3 className="field-label">Or add your own</h3>
        <label className="field" htmlFor="qa-title">
          <span className="sr">What</span>
          <input id="qa-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Lunch at the cabin, Call the cabin host" maxLength={80} />
        </label>
        <div className="chips" role="group" aria-label="Type">
          {Object.entries(KINDS).map(([k, v]) => (
            <button type="button" key={k} className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}><Icon name={v.icon} size={14} />{v.label}</button>
          ))}
        </div>
        <div className="field-row">
          <label className="field" htmlFor="qa-time">
            <span className="field-label">Start (optional)</span>
            <input id="qa-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} step="300" />
          </label>
          <label className="field" htmlFor="qa-dur">
            <span className="field-label">How long</span>
            <select id="qa-dur" value={dur} onChange={(e) => setDur(e.target.value)}>
              {[15, 30, 45, 60, 90, 120, 150, 180, 240].map((m) => <option key={m} value={m}>{fmtDur(m)}</option>)}
            </select>
          </label>
        </div>
        <label className="field" htmlFor="qa-note">
          <span className="field-label">Note (optional)</span>
          <input id="qa-note" type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
        </label>
        <div className="sheet-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!title.trim()}>Add to plan</button>
        </div>
      </form>
    </Sheet>
  );
}

function TagSheet({ plan, day, onClose, onPick }) {
  const cur = tagFor(plan, day);
  return (
    <Sheet title="What kind of day?" sub={`${DAY[day].weekday}, ${DAY[day].long}`} onClose={onClose}>
      <div className="menu-list">
        {TAGS.map((t) => (
          <button key={t} aria-pressed={cur === t} data-autofocus={cur === t ? true : undefined} onClick={() => { onPick(day, t); onClose(); }}>
            <span className={cx('tag-dot', `tone-${TAG_TONE[t]}`)} />{t}{cur === t && <Icon name="check" className="end" />}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function ResetSheet({ onClose, onConfirm }) {
  return (
    <Sheet title="Reset the plan?" sub="This replaces every day with the suggested plan and clears statuses, notes and the packing list." onClose={onClose}>
      <div className="sheet-actions">
        <button className="btn btn-ghost" data-autofocus onClick={onClose}>Keep my plan</button>
        <button className="btn btn-danger" onClick={() => { onConfirm(); onClose(); }}>Reset plan</button>
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

const SYNC_LABEL = {
  connecting: 'Connecting…', synced: 'Saved', saving: 'Saving…', local: 'Saved on this device', readonly: 'View only', error: 'Not saved',
};

function App() {
  const notifyRef = useRef(null);
  const store = useTripStore(notifyRef);
  const { plan, sync, update, getLatest, readOnly, hydrated } = store;
  const isWide = useMedia('(min-width: 1080px)');
  const clock = useClock();
  const [preview, setPreview] = useState(false);
  const live = preview ? PREVIEW_NOW : { date: localDate(clock), min: clock.getHours() * 60 + clock.getMinutes() };
  const liveDay = DAYS.find((d) => d.date === live.date) || null;
  const ui0 = useRef(lsGet(LS_UI) || {});
  const [tab, setTab] = useState(() => {
    const h = (window.location.hash || '').slice(1);
    return ['plan', 'ideas', 'trip'].includes(h) ? h : 'plan';
  });
  const [dayId, setDayId] = useState(() => (liveDay ? liveDay.id : (DAY[ui0.current.day] ? ui0.current.day : 'd1')));
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState(null);
  const [target, setTarget] = useState(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((msg, undoPlan) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, undo: undoPlan || null, id: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), undoPlan ? 5500 : 3500);
  }, []);
  notifyRef.current = (m) => showToast(m);

  useEffect(() => { const u = lsGet(LS_UI) || {}; u.day = dayId; lsSet(LS_UI, u); }, [dayId]);
  useEffect(() => { if (sheet) setToast(null); }, [sheet]);

  // Open today's day and bring the current card into view during the trip.
  const liveKey = liveDay ? `${liveDay.id}-${preview}` : null;
  useEffect(() => {
    if (!liveDay) return;
    setDayId(liveDay.id);
    if (!isWide) setTab('plan');
    const t = setTimeout(() => {
      const el = document.querySelector('[data-live="now"]') || document.querySelector('[data-live="next"]');
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 250);
    return () => clearTimeout(t);
  }, [liveKey]);

  const scheduled = useMemo(() => new Set(Object.values(plan.items).filter((i) => i.aid).map((i) => i.aid)), [plan.items]);

  const act = useCallback((fn, msg) => {
    const before = clone(getLatest());
    const ok = update(fn);
    if (ok && msg) showToast(msg, before);
    return ok;
  }, [update, getLatest, showToast]);

  const actions = useMemo(() => ({
    cycle: (uid) => update((p) => { const it = p.items[uid]; if (!it) return false; it.status = (STATUS[it.status] || STATUS.planned).next; }),
    setStatus: (uid, s) => update((p) => { if (!p.items[uid]) return false; p.items[uid].status = s; }),
    move: (uid, day, slot, index, quiet) => {
      const p0 = getLatest();
      const loc = findLoc(p0, uid);
      if (!loc) return;
      if (loc.day === day && loc.slot === slot && (index == null ? loc.idx === p0.days[day][slot].length - 1 : index === loc.idx)) return;
      const it = p0.items[uid];
      const clearTime = it.time && (loc.slot !== slot || loc.day !== day) && !(toMin(it.time) >= SLOT[slot].start && toMin(it.time) < SLOT[slot].end);
      const crossed = loc.day !== day || loc.slot !== slot;
      act((p) => {
        p.days[loc.day][loc.slot].splice(loc.idx, 1);
        const arr = p.days[day][slot];
        arr.splice(index == null ? arr.length : Math.min(index, arr.length), 0, uid);
        if (clearTime) p.items[uid].time = null;
      }, crossed && !quiet ? `Moved to ${whereLabel(day, slot)}${clearTime ? ' (time set to auto)' : ''}` : null);
    },
    nudge: (uid, dir) => {
      const p0 = getLatest();
      const loc = findLoc(p0, uid);
      if (!loc) return;
      const list = p0.days[loc.day][loc.slot];
      const si = SLOTS.findIndex((s) => s.id === loc.slot);
      if (dir < 0 && loc.idx > 0) actions.move(uid, loc.day, loc.slot, loc.idx - 1, true);
      else if (dir > 0 && loc.idx < list.length - 1) actions.move(uid, loc.day, loc.slot, loc.idx + 1, true);
      else if (dir < 0 && si > 0) actions.move(uid, loc.day, SLOTS[si - 1].id, null);
      else if (dir > 0 && si < SLOTS.length - 1) actions.move(uid, loc.day, SLOTS[si + 1].id, 0);
    },
    addIdea: (aid, day, slot, index) => {
      if (getLatest() && Object.values(getLatest().items).some((i) => i.aid === aid)) return;
      const uid = newUid();
      act((p) => {
        p.items[uid] = { uid, aid, status: 'planned', time: null, note: '' };
        const arr = p.days[day][slot];
        arr.splice(index == null ? arr.length : Math.min(index, arr.length), 0, uid);
      }, `Added ${ACT[aid].name} to ${whereLabel(day, slot)}`);
    },
    addCustom: (day, slot, spec) => {
      const uid = newUid();
      act((p) => {
        p.items[uid] = { uid, kind: spec.kind, title: spec.title, dur: spec.dur, time: spec.time, note: spec.note || '', info: '', status: 'planned' };
        p.days[day][slot].push(uid);
      }, `Added to ${whereLabel(day, slot)}`);
    },
    remove: (uid) => {
      const it = getLatest().items[uid];
      if (!it) return;
      const name = resolveItem(it).title;
      act((p) => {
        const loc = findLoc(p, uid);
        if (loc) p.days[loc.day][loc.slot].splice(loc.idx, 1);
        delete p.items[uid];
      }, it.aid ? `${name} is back in the idea bank` : `Deleted ${name}`);
    },
    setTime: (uid, t) => update((p) => { if (!p.items[uid]) return false; p.items[uid].time = t || null; }),
    setNote: (uid, n) => update((p) => { if (!p.items[uid]) return false; p.items[uid].note = n; }),
    setTag: (day, t) => update((p) => { p.tags = p.tags || {}; p.tags[day] = t; }),
    toggleCheck: (k) => update((p) => { p.checks = p.checks || {}; p.checks[k] = !p.checks[k]; }),
    reset: () => act(() => buildStarter(), 'Plan reset to the suggested plan'),
  }), [update, act, getLatest]);

  const dnd = useDragDrop({
    enabled: !readOnly,
    onHoverDay: (d) => setDayId(d),
    onDrop: (source, t) => {
      let day, slot, index;
      if (t.pill) {
        day = t.pill;
        slot = source.type === 'item' ? (findLoc(getLatest(), source.uid) || {}).slot || 'morning' : ACT[source.aid].slot;
        index = null;
      } else ({ day, slot, index } = t);
      if (source.type === 'item') actions.move(source.uid, day, slot, index);
      else actions.addIdea(source.aid, day, slot, index);
    },
  });

  const goTab = (t) => {
    setTab(t);
    try { window.history.replaceState(null, '', t === 'plan' ? ' ' : `#${t}`); } catch (_) { /* sandboxed */ }
    window.scrollTo({ top: 0 });
  };
  const jumpTo = (day, uid) => {
    setDayId(day);
    goTab('plan');
    setTimeout(() => {
      const el = document.querySelector(`[data-card-uid="${uid}"]`);
      if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1600); }
    }, 120);
  };
  const onAddFromIdeas = (aid) => {
    if (target) actions.addIdea(aid, target.day, target.slot);
    else setSheet({ type: 'add', aid });
  };

  // Header summary
  const startOfToday = new Date(clock.getFullYear(), clock.getMonth(), clock.getDate());
  const daysToGo = Math.round((new Date(2027, 0, 1) - startOfToday) / 86400000);
  const allItems = Object.values(plan.items).filter((i) => i.status !== 'skipped');
  const bookedCount = allItems.filter((i) => i.status === 'booked' || i.status === 'done').length;
  const countdown = liveDay ? `Day ${liveDay.n} of 5` : daysToGo > 0 ? `${daysToGo} ${daysToGo === 1 ? 'day' : 'days'} to go` : 'Trip complete';

  const ideasCount = ACTIVITIES.length - scheduled.size;
  const sideTab = tab === 'trip' ? 'trip' : 'ideas';
  const showIdeas = isWide ? sideTab === 'ideas' : tab === 'ideas';
  const showTrip = isWide ? sideTab === 'trip' : tab === 'trip';

  const ideas = (
    <IdeasView plan={plan} scheduled={scheduled} target={target} onClearTarget={() => setTarget(null)} onAdd={onAddFromIdeas}
      readOnly={readOnly} dnd={dnd} canDrag={isWide} />
  );
  const trip = (
    <TripView plan={plan} onToggleCheck={actions.toggleCheck} onJump={jumpTo} preview={preview}
      onPreview={(v) => { setPreview(v); if (v) { showToast('Previewing Saturday, Jan 2 at 10:20 AM'); } }}
      onReset={() => setSheet({ type: 'reset' })} readOnly={readOnly} inMain={!isWide} />
  );

  return (
    <div className={cx('app', isWide && 'wide')}>
      <header className="hero">
        <Ridges />
        <div className="wrap hero-inner">
          <p className="eyebrow">Gatlinburg · Pigeon Forge · Sevierville</p>
          <h1>Smokies <span>Family Trip</span></h1>
          <p className="hero-sub">Fri, Jan 1 – Tue, Jan 5, 2027 · a cabin in the mountains</p>
          <div className="hero-chips">
            <span className="hchip strong"><Icon name="cal" size={15} />{countdown}</span>
            <span className="hchip"><Icon name="users" size={15} />10 of us · littles 1, 2 &amp; 3</span>
            <span className="hchip"><Icon name="ticket" size={15} />{bookedCount}/{allItems.length} booked</span>
            {preview && <button className="hchip preview" onClick={() => setPreview(false)}><Icon name="eye" size={15} />Preview: Sat 10:20 AM<Icon name="x" size={14} /></button>}
            <span className={cx('sync', `sync-${sync}`)} role="status"><i />{SYNC_LABEL[sync]}</span>
          </div>
        </div>
      </header>

      <div className="wrap layout">
        <main className={cx('main', !hydrated && 'is-loading')} hidden={!isWide && tab !== 'plan'} aria-busy={!hydrated}>
          <DayRail plan={plan} dayId={dayId} onSelect={setDayId} liveDayId={liveDay ? liveDay.id : null} dropT={dnd.dropT} />
          <DayView plan={plan} dayId={dayId} live={live} isLiveDay={!!liveDay && liveDay.id === dayId} readOnly={readOnly} dnd={dnd}
            onStatus={actions.cycle} onMenu={(uid) => setSheet({ type: 'menu', uid })}
            onQuickAdd={(day, slot) => setSheet({ type: 'quick', day, slot })}
            onTag={(day) => setSheet({ type: 'tag', day })} />
        </main>
        {isWide ? (
          <aside className="side" aria-label="Ideas and trip essentials">
            <div className="side-tabs seg seg-full" role="tablist">
              <button role="tab" aria-selected={sideTab === 'ideas'} aria-pressed={sideTab === 'ideas'} onClick={() => setTab('ideas')}><Icon name="bulb" size={16} />Ideas<span className="count">{ideasCount}</span></button>
              <button role="tab" aria-selected={sideTab === 'trip'} aria-pressed={sideTab === 'trip'} onClick={() => setTab('trip')}><Icon name="compass" size={16} />Trip essentials</button>
            </div>
            {showIdeas && ideas}
            {showTrip && trip}
          </aside>
        ) : (
          <>
            {showIdeas && <div className="panel">{ideas}</div>}
            {showTrip && <div className="panel">{trip}</div>}
          </>
        )}
      </div>

      {!isWide && (
        <nav className="bottomnav" aria-label="Sections">
          <button className="nav-btn" aria-current={tab === 'plan' ? 'page' : undefined} onClick={() => goTab('plan')}><Icon name="cal" size={21} />Plan</button>
          <button className="nav-btn" aria-current={tab === 'ideas' ? 'page' : undefined} onClick={() => goTab('ideas')}><Icon name="bulb" size={21} />Ideas{ideasCount > 0 && <span className="nav-badge">{ideasCount}</span>}</button>
          <button className="nav-btn" aria-current={tab === 'trip' ? 'page' : undefined} onClick={() => goTab('trip')}><Icon name="compass" size={21} />Trip</button>
        </nav>
      )}

      {dnd.drag && (
        <div className="ghost" ref={(el) => { dnd.ghostRef.current = el; if (el) dnd.api.placeGhost(); }} style={{ width: dnd.drag.w }} aria-hidden="true">
          <div className="ghost-card">
            <span className={cx('tile', `tone-${dnd.drag.tone}`)}><Icon name={dnd.drag.icon} size={18} /></span>
            <span className="ghost-text"><b>{dnd.drag.label}</b><span>{dnd.dropT ? (dnd.dropT.pill ? `Drop on ${DAY[dnd.dropT.pill].dow}, ${DAY[dnd.dropT.pill].short}` : `Drop in ${SLOT[dnd.dropT.slot].label.toLowerCase()}`) : dnd.drag.sub}</span></span>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast" role="status" key={toast.id}>
          <span>{toast.msg}</span>
          {toast.undo && <button onClick={() => { const prev = toast.undo; setToast(null); update(() => prev); }}><Icon name="undo" size={15} />Undo</button>}
        </div>
      )}

      {sheet && sheet.type === 'menu' && <ItemMenu plan={plan} uid={sheet.uid} onClose={() => setSheet(null)} actions={actions} />}
      {sheet && sheet.type === 'add' && <AddToDaySheet plan={plan} aid={sheet.aid} defaultDay={dayId} onClose={() => setSheet(null)} onConfirm={(aid, d, s) => actions.addIdea(aid, d, s)} />}
      {sheet && sheet.type === 'quick' && (
        <QuickAddSheet plan={plan} day={sheet.day} slot={sheet.slot} scheduled={scheduled} onClose={() => setSheet(null)}
          onAddIdea={(aid, d, s) => actions.addIdea(aid, d, s)}
          onBrowse={(d, s) => { setTarget({ day: d, slot: s }); if (!isWide) goTab('ideas'); else setTab('ideas'); }}
          onAddCustom={actions.addCustom} />
      )}
      {sheet && sheet.type === 'tag' && <TagSheet plan={plan} day={sheet.day} onClose={() => setSheet(null)} onPick={actions.setTag} />}
      {sheet && sheet.type === 'reset' && <ResetSheet onClose={() => setSheet(null)} onConfirm={actions.reset} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
