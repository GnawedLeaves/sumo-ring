// Japanese for the romaji the app shows. Lookups return undefined when a term isn't listed, so callers
// simply show the romaji alone rather than guessing.
import { RANK_JP, rankTier } from "./rank";

const norm = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

function table(entries: Record<string, string>) {
  const t = new Map(Object.entries(entries).map(([k, v]) => [norm(k), v]));
  return (romaji?: string) => (romaji ? t.get(norm(romaji)) : undefined);
}

export const divisionJp = table({
  Makuuchi: "幕内",
  Juryo: "十両",
  Makushita: "幕下",
  Sandanme: "三段目",
  Jonidan: "序二段",
  Jonokuchi: "序ノ口",
  "Mae-zumo": "前相撲",
});

export const sanshoJp = table({
  "Shukun-sho": "殊勲賞",
  "Kanto-sho": "敢闘賞",
  "Gino-sho": "技能賞",
});

/** The 82 winning techniques plus non-technique results (official JSA list). */
export const kimariteJp = table({
  // 基本技
  tsukidashi: "突き出し", tsukitaoshi: "突き倒し", oshidashi: "押し出し", oshitaoshi: "押し倒し",
  yorikiri: "寄り切り", yoritaoshi: "寄り倒し", abisetaoshi: "浴びせ倒し",
  // 投げ手
  uwatenage: "上手投げ", shitatenage: "下手投げ", kotenage: "小手投げ", sukuinage: "掬い投げ",
  uwatedashinage: "上手出し投げ", shitatedashinage: "下手出し投げ", koshinage: "腰投げ", kubinage: "首投げ",
  ipponzeoi: "一本背負い", nichonage: "二丁投げ", yaguranage: "櫓投げ", kakenage: "掛け投げ", tsukaminage: "つかみ投げ",
  // 掛け手
  uchigake: "内掛け", sotogake: "外掛け", chongake: "ちょん掛け", kirikaeshi: "切り返し", kawazugake: "河津掛け",
  kekaeshi: "蹴返し", ketaguri: "蹴手繰り", mitokorozeme: "三所攻め", watashikomi: "渡し込み", nimaigeri: "二枚蹴り",
  komatasukui: "小股掬い", sotokomata: "外小股", omata: "大股", tsumatori: "褄取り", kozumatori: "小褄取り",
  ashitori: "足取り", susoharai: "裾払い", susotori: "裾取り",
  // 反り手
  izori: "居反り", shumokuzori: "撞木反り", kakezori: "掛け反り", tasukizori: "襷反り",
  sototasukizori: "外襷反り", tsutaezori: "伝え反り",
  // 捻り手
  tsukiotoshi: "突き落とし", makiotoshi: "巻き落とし", tottari: "とったり", sakatottari: "逆とったり",
  katasukashi: "肩透かし", sotomuso: "外無双", uchimuso: "内無双", zubuneri: "ずぶねり", uwatehineri: "上手捻り",
  shitatehineri: "下手捻り", amiuchi: "網打ち", sabaori: "鯖折り", harimanage: "波離間投げ", osakate: "大逆手",
  kainahineri: "腕捻り", gasshohineri: "合掌捻り", tokkurinage: "徳利投げ", kubihineri: "首捻り", kotehineri: "小手捻り",
  // 特殊技
  hikiotoshi: "引き落とし", hikkake: "引っ掛け", hatakikomi: "叩き込み", sokubiotoshi: "素首落とし",
  tsuridashi: "吊り出し", okuritsuridashi: "送り吊り出し", tsuriotoshi: "吊り落とし", okuritsuriotoshi: "送り吊り落とし",
  okuridashi: "送り出し", okuritaoshi: "送り倒し", okurinage: "送り投げ", okurigake: "送り掛け",
  okurihikiotoshi: "送り引き落とし", waridashi: "割り出し", utchari: "うっちゃり", kimedashi: "極め出し",
  kimetaoshi: "極め倒し", ushiromotare: "後ろもたれ", yobimodoshi: "呼び戻し",
  // 勝負結果 (non-techniques)
  isamiashi: "勇み足", koshikudake: "腰砕け", tsukite: "つき手", tsukihiza: "つきひざ", fumidashi: "踏み出し",
  fusen: "不戦", hansoku: "反則",
});

/** Sumo stables (current and recently closed). */
export const heyaJp = table({
  Ajigawa: "安治川", Arashio: "荒汐", Asahiyama: "朝日山", Asakayama: "浅香山", Dewanoumi: "出羽海",
  Fujishima: "藤島", Futagoyama: "二子山", Hakkaku: "八角", Hanaregoma: "放駒", Hidenoyama: "秀ノ山",
  Ikazuchi: "雷", Irumagawa: "入間川", Isegahama: "伊勢ヶ濱", Isenoumi: "伊勢ノ海", Kagamiyama: "鏡山",
  Kasugano: "春日野", Kataonami: "片男波", Kise: "木瀬", Kokonoe: "九重", Michinoku: "陸奥", Minato: "湊",
  Miyagino: "宮城野", Musashigawa: "武蔵川", Nakamura: "中村", Naruto: "鳴戸", Nishiiwa: "西岩",
  Nishikido: "錦戸", Nishonoseki: "二所ノ関", Oitekaze: "追手風", Onoe: "尾上", Onomatsu: "阿武松",
  Oshima: "大島", Oshiogawa: "押尾川", Otake: "大嶽", Otowayama: "音羽山", Sadogatake: "佐渡ヶ嶽",
  Sakaigawa: "境川", Shibatayama: "芝田山", Shikihide: "式秀", Shikoroyama: "錣山", Shiranui: "不知火",
  Tagonoura: "田子ノ浦", Takadagawa: "高田川", Takasago: "高砂", Tamanoi: "玉ノ井", Tatsunami: "立浪",
  Tokitsukaze: "時津風", Tokiwayama: "常盤山", Yamahibiki: "山響", Hanakago: "花籠", Minezaki: "峰崎",
  Tomozuna: "友綱", Oguruma: "尾車", Izutsu: "井筒", Kitanoumi: "北の湖", Matsugane: "松ヶ根",
  Tatsutagawa: "立田川", Takekuma: "武隈", Magaki: "間垣", Kumagatani: "熊ヶ谷",
});

const PREFECTURES: Record<string, string> = {
  Hokkaido: "北海道", Aomori: "青森県", Iwate: "岩手県", Miyagi: "宮城県", Akita: "秋田県", Yamagata: "山形県",
  Fukushima: "福島県", Ibaraki: "茨城県", Tochigi: "栃木県", Gunma: "群馬県", Saitama: "埼玉県", Chiba: "千葉県",
  Tokyo: "東京都", Kanagawa: "神奈川県", Niigata: "新潟県", Toyama: "富山県", Ishikawa: "石川県", Fukui: "福井県",
  Yamanashi: "山梨県", Nagano: "長野県", Gifu: "岐阜県", Shizuoka: "静岡県", Aichi: "愛知県", Mie: "三重県",
  Shiga: "滋賀県", Kyoto: "京都府", Osaka: "大阪府", Hyogo: "兵庫県", Nara: "奈良県", Wakayama: "和歌山県",
  Tottori: "鳥取県", Shimane: "島根県", Okayama: "岡山県", Hiroshima: "広島県", Yamaguchi: "山口県",
  Tokushima: "徳島県", Kagawa: "香川県", Ehime: "愛媛県", Kochi: "高知県", Fukuoka: "福岡県", Saga: "佐賀県",
  Nagasaki: "長崎県", Kumamoto: "熊本県", Oita: "大分県", Miyazaki: "宮崎県", Kagoshima: "鹿児島県",
  Okinawa: "沖縄県", Mongolia: "モンゴル", Georgia: "ジョージア", Ukraine: "ウクライナ", Kazakhstan: "カザフスタン",
  Russia: "ロシア", Bulgaria: "ブルガリア", Egypt: "エジプト", Brazil: "ブラジル", China: "中国", Estonia: "エストニア",
};
/** "Toyama-ken, Toyama-shi" -> 富山県 (prefecture or country only). */
export function shusshinJp(shusshin?: string) {
  if (!shusshin) return undefined;
  const head = shusshin.split(",")[0].replace(/-(ken|to|fu|do)$/i, "").trim();
  return table(PREFECTURES)(head);
}

/** "Maegashira 3 West" -> "前頭3 西". */
export function rankJp(rank?: string) {
  if (!rank) return undefined;
  const tier = RANK_JP[rankTier(rank)];
  if (!tier) return undefined;
  const num = rank.match(/\d+/)?.[0] ?? "";
  const side = /east/i.test(rank) ? " 東" : /west/i.test(rank) ? " 西" : "";
  return `${tier}${num}${side}`;
}

/** General sumo vocabulary used in headings and labels. */
export const termJp = table({
  basho: "場所",
  rikishi: "力士",
  dohyo: "土俵",
  torikumi: "取組",
  banzuke: "番付",
  yusho: "優勝",
  sansho: "三賞",
  kimarite: "決まり手",
  heya: "部屋",
  shikona: "四股名",
  shusshin: "出身",
});
