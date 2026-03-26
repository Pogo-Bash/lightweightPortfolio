// Emoji shortcode map — Discord/Slack-style :shortcode: → emoji
// Covers the most commonly used shortcodes

const EMOJI_MAP: Record<string, string> = {
  // Smileys
  smile: "😄", grinning: "😀", grin: "😁", joy: "😂", rofl: "🤣",
  smiley: "😃", sweat_smile: "😅", laughing: "😆", wink: "😉",
  blush: "😊", innocent: "😇", slightly_smiling_face: "🙂",
  upside_down_face: "🙃", relieved: "😌", heart_eyes: "😍",
  kissing_heart: "😘", kissing: "😗", kissing_smiling_eyes: "😙",
  kissing_closed_eyes: "😚", yum: "😋", stuck_out_tongue: "😛",
  stuck_out_tongue_winking_eye: "😜", stuck_out_tongue_closed_eyes: "😝",
  zany_face: "🤪", money_mouth_face: "🤑", hugs: "🤗",
  thinking: "🤔", shushing_face: "🤫", zipper_mouth_face: "🤐",
  raised_eyebrow: "🤨", neutral_face: "😐", expressionless: "😑",
  no_mouth: "😶", smirk: "😏", unamused: "😒", roll_eyes: "🙄",
  grimacing: "😬", lying_face: "🤥", pensive: "😔",
  sleepy: "😪", drooling_face: "🤤", sleeping: "😴",
  mask: "😷", face_with_thermometer: "🤒", nerd_face: "🤓",
  sunglasses: "😎", disguised_face: "🥸", cowboy_hat_face: "🤠",
  partying_face: "🥳", confused: "😕", worried: "😟",
  slightly_frowning_face: "🙁", frowning_face: "☹️",
  open_mouth: "😮", hushed: "😯", astonished: "😲",
  flushed: "😳", pleading_face: "🥺", cry: "😢",
  sob: "😭", scream: "😱", confounded: "😖",
  persevere: "😣", disappointed: "😞", sweat: "😓",
  weary: "😩", tired_face: "😫", angry: "😠", rage: "😡",
  pout: "😡", cursing_face: "🤬", skull: "💀",
  skull_and_crossbones: "☠️", clown_face: "🤡", imp: "👿",
  smiling_imp: "😈", ghost: "👻", alien: "👽", robot: "🤖",
  poop: "💩", fire: "🔥", "100": "💯", star: "⭐",
  sparkles: "✨", boom: "💥", heart: "❤️", broken_heart: "💔",
  orange_heart: "🧡", yellow_heart: "💛", green_heart: "💚",
  blue_heart: "💙", purple_heart: "💜", black_heart: "🖤",
  white_heart: "🤍", cupid: "💘", two_hearts: "💕",
  sparkling_heart: "💖", heartpulse: "💗", revolving_hearts: "💞",

  // Hands
  thumbsup: "👍", "+1": "👍", thumbsdown: "👎", "-1": "👎",
  wave: "👋", raised_hands: "🙌", clap: "👏", handshake: "🤝",
  pray: "🙏", muscle: "💪", ok_hand: "👌", pinching_hand: "🤏",
  v: "✌️", crossed_fingers: "🤞", point_up: "☝️",
  point_down: "👇", point_left: "👈", point_right: "👉",
  middle_finger: "🖕", raised_hand: "✋", fist: "✊",
  punch: "👊", metal: "🤘", call_me_hand: "🤙",
  writing_hand: "✍️", eyes: "👀", eye: "👁️",
  brain: "🧠", tongue: "👅", lips: "👄",

  // People
  baby: "👶", boy: "👦", girl: "👧", man: "👨", woman: "👩",
  older_man: "👴", older_woman: "👵", shrug: "🤷",
  facepalm: "🤦",

  // Animals
  dog: "🐶", cat: "🐱", mouse: "🐭", hamster: "🐹",
  rabbit: "🐰", fox_face: "🦊", bear: "🐻", panda_face: "🐼",
  koala: "🐨", tiger: "🐯", lion: "🦁", cow: "🐮",
  pig: "🐷", frog: "🐸", monkey_face: "🐵", chicken: "🐔",
  penguin: "🐧", bird: "🐦", eagle: "🦅", owl: "🦉",
  bat: "🦇", wolf: "🐺", horse: "🐴", unicorn: "🦄",
  bee: "🐝", bug: "🐛", butterfly: "🦋", snail: "🐌",
  snake: "🐍", dragon: "🐲", turtle: "🐢", octopus: "🐙",
  shark: "🦈", whale: "🐋", dolphin: "🐬", crab: "🦀",

  // Food
  apple: "🍎", green_apple: "🍏", banana: "🍌", grapes: "🍇",
  watermelon: "🍉", strawberry: "🍓", peach: "🍑", cherry: "🍒",
  pizza: "🍕", hamburger: "🍔", fries: "🍟", hotdog: "🌭",
  taco: "🌮", burrito: "🌯", egg: "🥚", coffee: "☕",
  tea: "🍵", beer: "🍺", beers: "🍻", wine_glass: "🍷",
  cocktail: "🍸", tropical_drink: "🍹", champagne: "🍾",
  cookie: "🍪", cake: "🎂", candy: "🍬", lollipop: "🍭",
  chocolate_bar: "🍫", ice_cream: "🍦", doughnut: "🍩",
  popcorn: "🍿", ramen: "🍜", sushi: "🍣",

  // Activities
  soccer: "⚽", basketball: "🏀", football: "🏈", baseball: "⚾",
  tennis: "🎾", volleyball: "🏐", trophy: "🏆", medal: "🏅",
  video_game: "🎮", joystick: "🕹️", dart: "🎯", bowling: "🎳",
  guitar: "🎸", musical_note: "🎵", notes: "🎶", headphones: "🎧",
  microphone: "🎤", movie_camera: "🎥", camera: "📷",
  art: "🎨", paintbrush: "🖌️",

  // Objects
  computer: "💻", keyboard: "⌨️", desktop_computer: "🖥️",
  phone: "📱", telephone: "☎️", laptop: "💻",
  bulb: "💡", flashlight: "🔦", wrench: "🔧", hammer: "🔨",
  gear: "⚙️", link: "🔗", paperclip: "📎", scissors: "✂️",
  lock: "🔒", unlock: "🔓", key: "🔑", shield: "🛡️",
  bomb: "💣", knife: "🔪", gun: "🔫", pill: "💊",
  syringe: "💉", dna: "🧬", microscope: "🔬", telescope: "🔭",
  satellite: "📡", rocket: "🚀", airplane: "✈️", car: "🚗",
  bus: "🚌", train: "🚆", ship: "🚢",
  book: "📖", books: "📚", pencil: "✏️", pen: "🖊️",
  memo: "📝", envelope: "✉️", mailbox: "📫",
  clock: "🕐", hourglass: "⏳", alarm_clock: "⏰",
  money_with_wings: "💸", dollar: "💵", gem: "💎", crown: "👑",

  // Nature / Weather
  sun: "☀️", moon: "🌙", cloud: "☁️", rain: "🌧️",
  snow: "❄️", snowflake: "❄️", thunder: "⛈️", rainbow: "🌈",
  umbrella: "☂️", ocean: "🌊", earth: "🌍", globe: "🌐",
  mountain: "⛰️", volcano: "🌋", camping: "🏕️",
  tree: "🌳", palm_tree: "🌴", cactus: "🌵",
  flower: "🌸", rose: "🌹", sunflower: "🌻", herb: "🌿",
  four_leaf_clover: "🍀", mushroom: "🍄",

  // Symbols
  check: "✅", x: "❌", warning: "⚠️", no_entry: "⛔",
  question: "❓", exclamation: "❗", interrobang: "⁉️",
  sos: "🆘", new: "🆕", free: "🆓", up: "🆙",
  cool: "🆒", ok: "🆗", stop_sign: "🛑",
  recycle: "♻️", infinity: "♾️", peace: "☮️",
  yin_yang: "☯️", atom: "⚛️", radioactive: "☢️",
  arrow_up: "⬆️", arrow_down: "⬇️", arrow_left: "⬅️",
  arrow_right: "➡️", hash: "#️⃣", asterisk: "*️⃣",
  zero: "0️⃣", one: "1️⃣", two: "2️⃣", three: "3️⃣",
  four: "4️⃣", five: "5️⃣", six: "6️⃣", seven: "7️⃣",
  eight: "8️⃣", nine: "9️⃣", ten: "🔟",

  // Flags / Misc
  flag_white: "🏳️", flag_black: "🏴", checkered_flag: "🏁",
  pirate_flag: "🏴‍☠️", triangular_flag: "🚩",
  tada: "🎉", confetti_ball: "🎊", balloon: "🎈",
  gift: "🎁", ribbon: "🎀", bell: "🔔",
  mega: "📣", loudspeaker: "📢", speech_balloon: "💬",
  thought_balloon: "💭", zzz: "💤", wave_dash: "〰️",

  // Tech / Dev
  bug_fix: "🐛", deploy: "🚀", ship_it: "🚢", merge: "🔀",
  pin: "📌", pushpin: "📍", mag: "🔍", mag_right: "🔎",
  construction: "🚧", rotating_light: "🚨",
};

/** Replace :shortcode: patterns with emoji characters */
export function replaceEmoji(text: string): string {
  return text.replace(/:([a-z0-9_+-]+):/g, (match, code) => {
    return EMOJI_MAP[code] ?? match;
  });
}

/** Search for shortcodes matching a prefix (min 2 chars). Returns up to `limit` results. */
export function searchEmoji(query: string, limit = 8): { code: string; emoji: string }[] {
  if (query.length < 2) return [];
  const q = query.toLowerCase();
  const results: { code: string; emoji: string }[] = [];
  for (const [code, emoji] of Object.entries(EMOJI_MAP)) {
    if (code.includes(q)) {
      results.push({ code, emoji });
      if (results.length >= limit) break;
    }
  }
  return results;
}
