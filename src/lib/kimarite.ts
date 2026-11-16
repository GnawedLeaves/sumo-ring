// Every kimarite (winning technique) the Sumo API records, with Japanese, a short English label and a
// one-line explanation. Grouped by the Japan Sumo Association's official categories. The API's own
// spelling (lower case, no hyphens) is the key and the URL slug: /kimarite/yorikiri.

export type KimariteCategory = { id: string; en: string; jp: string; blurb: string };

export const KIMARITE_CATEGORIES: KimariteCategory[] = [
  { id: "basic", en: "Basic techniques", jp: "基本技", blurb: "Pushing, thrusting and forcing out — how most bouts are won." },
  { id: "throws", en: "Throws", jp: "投げ手", blurb: "Throwing the opponent, usually from a grip on the mawashi." },
  { id: "trips", en: "Leg trips", jp: "掛け手", blurb: "Tripping, hooking or picking up the opponent's legs." },
  { id: "backward", en: "Backward body drops", jp: "反り手", blurb: "Rare, acrobatic moves that drop the opponent backwards over the body." },
  { id: "twists", en: "Twist downs", jp: "捻り手", blurb: "Twisting or slapping the opponent off balance and down." },
  { id: "special", en: "Special techniques", jp: "特殊技", blurb: "Pull-downs, lifts, rear attacks and edge-of-the-ring escapes." },
  { id: "results", en: "Non-technique results", jp: "勝負結果", blurb: "Wins where the loser beat himself, or the bout wasn't fought." },
];

export type Kimarite = { name: string; jp: string; en: string; description: string; category: string };

// [name, jp, english label, explanation]
type Row = [string, string, string, string];

const DATA: Record<string, Row[]> = {
  basic: [
    ["yorikiri", "寄り切り", "Frontal force out", "Grips the opponent's mawashi and drives him backwards out of the ring."],
    ["oshidashi", "押し出し", "Frontal push out", "Pushes the opponent out of the ring without holding the mawashi — hands on the chest, armpits or throat."],
    ["tsukidashi", "突き出し", "Frontal thrust out", "Thrusts the opponent out of the ring with open-hand strikes to the upper body."],
    ["tsukitaoshi", "突き倒し", "Frontal thrust down", "Thrusts the opponent so hard he falls down, inside or at the edge of the ring."],
    ["oshitaoshi", "押し倒し", "Frontal push down", "Pushes the opponent without a belt grip until he falls down."],
    ["yoritaoshi", "寄り倒し", "Frontal crush out", "Forces the opponent back while holding the mawashi and topples him over backwards."],
    ["abisetaoshi", "浴びせ倒し", "Backward force down", "Leans the whole body weight onto the opponent and crushes him down backwards."],
  ],
  throws: [
    ["uwatenage", "上手投げ", "Overarm throw", "Takes an outside grip on the mawashi (over the opponent's arm) and throws him."],
    ["shitatenage", "下手投げ", "Underarm throw", "Takes an inside grip on the mawashi (under the opponent's arm) and throws him."],
    ["kotenage", "小手投げ", "Armlock throw", "Wraps up the opponent's arm from outside, without a belt grip, and throws him by it."],
    ["sukuinage", "掬い投げ", "Beltless arm throw", "Scoops an arm under the opponent's armpit, without gripping the mawashi, and throws him."],
    ["uwatedashinage", "上手出し投げ", "Pulling overarm throw", "With an outside grip, steps back and pulls the opponent forward and down."],
    ["shitatedashinage", "下手出し投げ", "Pulling underarm throw", "With an inside grip, steps back and pulls the opponent forward and down."],
    ["dashinage", "出し投げ", "Pulling throw", "Older record for a pulling throw, before the overarm and underarm versions were listed separately."],
    ["koshinage", "腰投げ", "Hip throw", "Loads the opponent onto the hip and throws him over it."],
    ["kubinage", "首投げ", "Headlock throw", "Wraps an arm around the opponent's neck and throws him."],
    ["ipponzeoi", "一本背負い", "One-armed shoulder throw", "Grabs one of the opponent's arms and throws him over the shoulder."],
    ["nichonage", "二丁投げ", "Body drop throw", "Sweeps the opponent's leg with one's own leg while throwing him across it."],
    ["yaguranage", "櫓投げ", "Inner thigh throw", "Lifts the opponent on the thigh while holding the mawashi, then throws him."],
    ["kakenage", "掛け投げ", "Hooking inner thigh throw", "Hooks a leg inside the opponent's thigh and throws him."],
    ["tsukaminage", "つかみ投げ", "Lifting pulling throw", "Grabs the back of the opponent's mawashi, lifts him and throws him behind."],
  ],
  trips: [
    ["uchigake", "内掛け", "Inside leg trip", "Hooks a leg around the inside of the opponent's leg and trips him backwards."],
    ["sotogake", "外掛け", "Outside leg trip", "Hooks a leg around the outside of the opponent's leg and trips him backwards."],
    ["chongake", "ちょん掛け", "Pulling heel hook", "Hooks the opponent's heel from the inside and twists him down backwards."],
    ["kirikaeshi", "切り返し", "Twisting backward knee trip", "Puts a knee behind the opponent's knee and twists him over backwards."],
    ["kawazugake", "河津掛け", "Hooking backward counter throw", "Wraps a leg around the opponent's leg and falls backwards with him, landing on top."],
    ["kekaeshi", "蹴返し", "Minor inner foot sweep", "Kicks the opponent's foot from the inside while pulling him down."],
    ["ketaguri", "蹴手繰り", "Pulling inside ankle sweep", "Kicks the opponent's leg out at the charge and pulls him down."],
    ["mitokorozeme", "三所攻め", "Triple attack", "Attacks three points at once — a leg trip, a thigh grab and a push to the chest."],
    ["watashikomi", "渡し込み", "Thigh grabbing push down", "Grabs the back of the opponent's thigh and pushes him down."],
    ["nimaigeri", "二枚蹴り", "Ankle kicking twist down", "Kicks the outside of the opponent's ankle while twisting him down."],
    ["komatasukui", "小股掬い", "Over-thigh scooping body drop", "Scoops the opponent's thigh from the inside as he steps in, toppling him."],
    ["sotokomata", "外小股", "Outer thigh scoop", "Scoops the opponent's thigh from the outside, toppling him."],
    ["omata", "大股", "Far thigh scoop", "A variant of the thigh scoop that catches the opponent's far leg."],
    ["tsumatori", "褄取り", "Rear toe pick", "Grabs the opponent's toes from the side or behind and lifts the foot, toppling him."],
    ["kozumatori", "小褄取り", "Ankle pick", "Grabs the opponent's ankle from the front and pulls it up."],
    ["ashitori", "足取り", "Leg pick", "Grabs one of the opponent's legs with both arms and lifts it."],
    ["susoharai", "裾払い", "Rear foot sweep", "Sweeps the back of the opponent's ankle while pulling him down."],
    ["susotori", "裾取り", "Rear ankle pick", "Grabs the opponent's ankle from behind as he attempts a throw."],
  ],
  backward: [
    ["izori", "居反り", "Backwards body drop", "Crouches under the opponent, grabs his knees and tips him over backwards."],
    ["shumokuzori", "撞木反り", "Bell hammer drop", "Gets under the opponent, lifts him across the shoulders and falls backwards."],
    ["kakezori", "掛け反り", "Hooking backward body drop", "Puts the head under the opponent's arm, hooks a leg and drops him backwards."],
    ["tasukizori", "襷反り", "Reverse backward body drop", "Ducks under the opponent's arm, grabs a leg and drops him backwards over the shoulders."],
    ["sototasukizori", "外襷反り", "Outer reverse backward body drop", "Grabs the opponent's arm from outside and drops him backwards."],
    ["tsutaezori", "伝え反り", "Underarm forward body drop", "Ducks under the opponent's armpit and moves around him, forcing him to fall backwards."],
  ],
  twists: [
    ["tsukiotoshi", "突き落とし", "Thrust down", "Thrusts the opponent's side diagonally downwards, knocking him to the ground."],
    ["makiotoshi", "巻き落とし", "Twist down", "Wraps the arms around the opponent's body and twists him down."],
    ["tottari", "とったり", "Arm bar throw", "Grabs the opponent's arm with both hands and twists him forward and down."],
    ["sakatottari", "逆とったり", "Arm bar throw counter", "Counters a tottari by twisting the attacker down instead."],
    ["katasukashi", "肩透かし", "Under-shoulder swing down", "Grips under the opponent's arm at the shoulder, steps aside and pulls him down."],
    ["sotomuso", "外無双", "Outer thigh propping twist down", "Props the outside of the opponent's thigh with a hand and twists him down."],
    ["uchimuso", "内無双", "Inner thigh propping twist down", "Props the inside of the opponent's thigh with a hand and twists him down."],
    ["zubuneri", "ずぶねり", "Head pivot throw", "Presses the head into the opponent's chest and uses it as a pivot to twist him down."],
    ["uwatehineri", "上手捻り", "Twisting overarm throw", "Twists the opponent down using an outside mawashi grip."],
    ["shitatehineri", "下手捻り", "Twisting underarm throw", "Twists the opponent down using an inside mawashi grip."],
    ["amiuchi", "網打ち", "Fisherman's throw", "Grabs the opponent's arm with both hands and throws him like casting a net."],
    ["sabaori", "鯖折り", "Forward force down", "Pulls the opponent's mawashi to bend him backwards, forcing him down onto his knees."],
    ["harimanage", "波離間投げ", "Backward belt throw", "Reaches over the opponent's back, grabs the rear of his mawashi and throws him behind."],
    ["osakate", "大逆手", "Backward underarm twist", "Reaches over the opponent's arm for a deep grip and throws him with a big twisting motion."],
    ["kainahineri", "腕捻り", "Two-handed arm twist down", "Grabs the opponent's arm with both hands and twists him down from the outside."],
    ["gasshohineri", "合掌捻り", "Clasped-hand twist down", "Clasps both hands behind the opponent's back and twists him down."],
    ["tokkurinage", "徳利投げ", "Two-handed head twist down", "Grabs the opponent's head with both hands and twists him down."],
    ["kubihineri", "首捻り", "Headlock twist down", "Wraps an arm around the opponent's neck and twists him down."],
    ["kotehineri", "小手捻り", "Armlock twist down", "Locks the opponent's arm and twists him down."],
  ],
  special: [
    ["hatakikomi", "叩き込み", "Slap down", "Steps aside or back and slaps the opponent's back or shoulders as he charges, sending him down."],
    ["hikiotoshi", "引き落とし", "Hand pull down", "Steps back and pulls the opponent forward and down."],
    ["hikkake", "引っ掛け", "Arm grabbing force out", "Grabs the opponent's arm and, stepping aside, pulls him forward out of the ring."],
    ["sokubiotoshi", "素首落とし", "Head chop down", "Chops down on the back of the opponent's head or neck."],
    ["tsuridashi", "吊り出し", "Frontal lift out", "Lifts the opponent by the mawashi and carries him out of the ring."],
    ["okuritsuridashi", "送り吊り出し", "Rear lift out", "Lifts the opponent from behind and carries him out of the ring."],
    ["tsuriotoshi", "吊り落とし", "Frontal lift slam", "Lifts the opponent by the mawashi and slams him down."],
    ["okuritsuriotoshi", "送り吊り落とし", "Rear lift slam", "Lifts the opponent from behind and slams him down."],
    ["okuridashi", "送り出し", "Rear push out", "Gets behind the opponent and pushes him out of the ring."],
    ["okuritaoshi", "送り倒し", "Rear push down", "Gets behind the opponent and pushes him down."],
    ["okurinage", "送り投げ", "Rear throw down", "Throws the opponent down from behind."],
    ["okurigake", "送り掛け", "Rear leg trip", "Trips the opponent from behind."],
    ["okurihikiotoshi", "送り引き落とし", "Rear pull down", "Pulls the opponent down from behind."],
    ["waridashi", "割り出し", "Upper-arm force out", "Pushes against the opponent's upper arm while forcing him out with a belt grip."],
    ["utchari", "うっちゃり", "Backward pivot throw", "On the edge of the ring, twists and throws the attacker out while staying in."],
    ["kimedashi", "極め出し", "Arm barring force out", "Locks the opponent's arms and forces him out of the ring."],
    ["kimetaoshi", "極め倒し", "Arm barring force down", "Locks the opponent's arms and forces him down."],
    ["ushiromotare", "後ろもたれ", "Backward lean out", "Leans back onto an opponent who has got behind him, pushing him out."],
    ["yobimodoshi", "呼び戻し", "Pulling body slam", "Pulls the opponent in, then swings him the other way and throws him down."],
    ["yobikaeshi", "呼び返し", "Pulling body slam (old name)", "Older name for yobimodoshi, still found in historical records."],
  ],
  results: [
    ["isamiashi", "勇み足", "Forward step out", "Steps out of the ring while attacking — the opponent wins without a technique."],
    ["koshikudake", "腰砕け", "Inadvertent collapse", "Falls down on his own without being attacked."],
    ["tsukite", "つき手", "Hand touch down", "Touches the ground with a hand without being attacked."],
    ["tsukihiza", "つきひざ", "Knee touch down", "Touches the ground with a knee without being attacked."],
    ["fumidashi", "踏み出し", "Rear step out", "Steps backwards out of the ring without being forced out."],
    ["fusen", "不戦", "Default win", "The opponent withdrew or didn't appear, so the bout wasn't fought."],
    ["hansoku", "反則", "Disqualification", "The opponent committed a foul, such as pulling hair or gripping the mae-tatemitsu."],
    ["hikiwake", "引き分け", "Draw", "Bout declared a draw (historical — no longer used in top-division sumo)."],
    ["itamiwake", "痛み分け", "Injury draw", "Bout stopped as a draw because a wrestler was injured (historical)."],
  ],
};

export const KIMARITE: Kimarite[] = Object.entries(DATA).flatMap(([category, rows]) =>
  rows.map(([name, jp, en, description]) => ({ name, jp, en, description, category })),
);

const BY_NAME = new Map(KIMARITE.map((k) => [k.name, k]));

/** Look up by the API's spelling; tolerant of case, hyphens and spaces ("Yori-kiri" -> yorikiri). */
export function findKimarite(name?: string | null): Kimarite | undefined {
  if (!name) return undefined;
  return BY_NAME.get(name.toLowerCase().replace(/[^a-z]/g, ""));
}

export const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
