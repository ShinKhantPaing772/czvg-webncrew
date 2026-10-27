import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const badgesDir = path.join(__dirname, "../public/badges");

if (!fs.existsSync(badgesDir)) {
  fs.mkdirSync(badgesDir, { recursive: true });
}

// 102 Master Badges with authentic English and poetic, understated Chinese (Claude style: Sonnet, Haiku, Opus)
export const MASTER_BADGES = [
  // ================= 1. MILESTONES: FLIGHTS (16) =================
  {
    id: 101,
    name: "First Light",
    nameZh: "初光",
    description: "Complete your first verified flight with CZVG.",
    descriptionZh: "执飞首个经审核批准的航班，向蔚蓝长空启航。",
    imageurl: "/badges/badge-first-flight.svg",
    category: "milestone",
    criteria: { type: "flights", threshold: 1 },
    featured: null,
  },
  {
    id: 102,
    name: "Dawn Flight",
    nameZh: "破晓",
    description: "Complete 5 verified flights, mastering standard line procedures.",
    descriptionZh: "累计执飞 5 架次航班，熟练起落航线程序。",
    imageurl: "/badges/badge-flights-5.svg",
    category: "milestone",
    criteria: { type: "flights", threshold: 5 },
    featured: null,
  },
  {
    id: 103,
    name: "Clear Horizon",
    nameZh: "巡礼",
    description: "Complete 10 verified flights with dependable line operations.",
    descriptionZh: "累计执飞 10 架次航班，展现稳健出勤素养。",
    imageurl: "/badges/badge-flights-10.svg",
    category: "milestone",
    criteria: { type: "flights", threshold: 10 },
    featured: null,
  },
  {
    id: 104,
    name: "Crossroads",
    nameZh: "经纬",
    description: "Complete 25 verified flights across regional and trunk routes.",
    descriptionZh: "累计执飞 25 架次航班，穿行于各条干支航线。",
    imageurl: "/badges/badge-flights-25.svg",
    category: "milestone",
    criteria: { type: "flights", threshold: 25 },
    featured: null,
  },
  {
    id: 105,
    name: "Skyward",
    nameZh: "浮光",
    description: "Complete 50 verified flights, developing seasoned operational instincts.",
    descriptionZh: "累计执飞 50 架次航班，飞行技艺日益从容纯熟。",
    imageurl: "/badges/badge-flights-50.svg",
    category: "milestone",
    criteria: { type: "flights", threshold: 50 },
    featured: null,
  },
  {
    id: 106,
    name: "Wayfarer",
    nameZh: "远岫",
    description: "Complete 75 verified flights with calm precision across weather conditions.",
    descriptionZh: "累计执飞 75 架次航班，沉稳应对多变航路气象。",
    imageurl: "/badges/badge-flights-75.svg",
    category: "milestone",
    criteria: { type: "flights", threshold: 75 },
    featured: null,
  },
  {
    id: 107,
    name: "Centurion",
    nameZh: "百川",
    description: "Complete 100 verified flights, a hallmark milestone of airline experience.",
    descriptionZh: "累计执飞 100 架次航班，百战归航，从容持重。",
    imageurl: "/badges/badge-flights-100.svg",
    category: "milestone",
    criteria: { type: "flights", threshold: 100 },
    featured: null,
  },
  {
    id: 108,
    name: "Meridian",
    nameZh: "澄明",
    description: "Complete 150 verified flights across diverse flight corridors.",
    descriptionZh: "累计执飞 150 架次航班，心明如镜，从容巡航。",
    imageurl: "/badges/badge-flights-150.svg",
    category: "milestone",
    criteria: { type: "flights", threshold: 150 },
    featured: null,
  },
  {
    id: 109,
    name: "Breeze & Cloud",
    nameZh: "双百",
    description: "Complete 200 verified flights throughout the airline route network.",
    descriptionZh: "累计执飞 200 架次航班，纵横通衢，轻车熟路。",
    imageurl: "/badges/badge-flights-200.svg",
    category: "milestone",
    criteria: { type: "flights", threshold: 200 },
    featured: null,
  },
  {
    id: 110,
    name: "Triple Century",
    nameZh: "叠嶂",
    description: "Complete 300 verified flights spanning seasons and skies.",
    descriptionZh: "累计执飞 300 架次航班，飞越重峦叠嶂，历经四时流转。",
    imageurl: "/badges/badge-flights-300.svg",
    category: "milestone",
    criteria: { type: "flights", threshold: 300 },
    featured: null,
  },
  {
    id: 111,
    name: "Five Hundred Sorties",
    nameZh: "半千",
    description: "Complete 500 verified flights as a core pillar of airline operations.",
    descriptionZh: "累计执飞 500 架次航班，成为机队运行的坚实砥柱。",
    imageurl: "/badges/badge-flights-500.svg",
    category: "milestone",
    criteria: { type: "flights", threshold: 500 },
    featured: null,
  },
  {
    id: 112,
    name: "Vast Expanse",
    nameZh: "遐览",
    description: "Complete 750 verified flights with masterful airmanship.",
    descriptionZh: "累计执飞 750 架次航班，极目千里，洞悉天际风云。",
    imageurl: "/badges/badge-flights-750.svg",
    category: "milestone",
    criteria: { type: "flights", threshold: 750 },
    featured: null,
  },
  {
    id: 113,
    name: "Millennium Sorties",
    nameZh: "千回",
    description: "Complete 1,000 verified flights, an enduring record of dedicated service.",
    descriptionZh: "累计执飞 1,000 架次航班，千回起落，铸就长空深厚履历。",
    imageurl: "/badges/badge-flights-1000.svg",
    category: "milestone",
    criteria: { type: "flights", threshold: 1000 },
    featured: null,
  },
  {
    id: 114,
    name: "Iron Feather",
    nameZh: "岁暮",
    description: "Complete 1,500 verified flights with exceptional perseverance.",
    descriptionZh: "累计执飞 1,500 架次航班，经年累月，翼下皆是岁月沉淀。",
    imageurl: "/badges/badge-flights-1500.svg",
    category: "milestone",
    criteria: { type: "flights", threshold: 1500 },
    featured: null,
  },
  {
    id: 201,
    name: "Double Millennium",
    nameZh: "广袤",
    description: "Complete 2,000 verified flights woven deeply into the airline network.",
    descriptionZh: "累计执飞 2,000 架次航班，航网经纬已与呼吸相融。",
    imageurl: "/badges/badge-flights-2000.svg",
    category: "milestone",
    criteria: { type: "flights", threshold: 2000 },
    featured: null,
  },
  {
    id: 202,
    name: "Grand Opus Sorties",
    nameZh: "韶光",
    description: "Complete 3,000 verified flights, a crowning lifetime achievement in flight frequency.",
    descriptionZh: "累计执飞 3,000 架次航班，以三千航段书写云间锦瑟华年。",
    imageurl: "/badges/badge-flights-3000.svg",
    category: "milestone",
    criteria: { type: "flights", threshold: 3000 },
    featured: null,
  },

  // ================= 2. MILESTONES: HOURS UP TO 10,000H (17) =================
  {
    id: 115,
    name: "Bronze Wings",
    nameZh: "铜羽",
    description: "Accumulate 5 total verified flight hours.",
    descriptionZh: "累计有效飞行经历时间达到 5 小时。",
    imageurl: "/badges/badge-hours-5.svg",
    category: "milestone",
    criteria: { type: "hours", threshold: 5 },
    featured: null,
  },
  {
    id: 116,
    name: "Green Blade",
    nameZh: "青芒",
    description: "Accumulate 10 total verified flight hours.",
    descriptionZh: "累计有效飞行经历时间达到 10 小时。",
    imageurl: "/badges/badge-hours-10.svg",
    category: "milestone",
    criteria: { type: "hours", threshold: 10 },
    featured: null,
  },
  {
    id: 117,
    name: "Azure Sky",
    nameZh: "碧空",
    description: "Accumulate 25 total verified flight hours.",
    descriptionZh: "累计有效飞行经历时间达到 25 小时。",
    imageurl: "/badges/badge-hours-25.svg",
    category: "milestone",
    criteria: { type: "hours", threshold: 25 },
    featured: null,
  },
  {
    id: 118,
    name: "Silver Lining",
    nameZh: "银翼",
    description: "Accumulate 50 total verified flight hours.",
    descriptionZh: "累计有效飞行经历时间达到 50 小时。",
    imageurl: "/badges/badge-hours-50.svg",
    category: "milestone",
    criteria: { type: "hours", threshold: 50 },
    featured: null,
  },
  {
    id: 119,
    name: "Golden Hour",
    nameZh: "金缕",
    description: "Accumulate 100 total verified flight hours, entering senior pilot standing.",
    descriptionZh: "累计有效飞行经历时间达到 100 小时，步入资深飞行序列。",
    imageurl: "/badges/badge-hours-100.svg",
    category: "milestone",
    criteria: { type: "hours", threshold: 100 },
    featured: null,
  },
  {
    id: 120,
    name: "Cruising Cloud",
    nameZh: "凌云",
    description: "Accumulate 150 total verified flight hours.",
    descriptionZh: "累计有效飞行经历时间达到 150 小时。",
    imageurl: "/badges/badge-hours-150.svg",
    category: "milestone",
    criteria: { type: "hours", threshold: 150 },
    featured: null,
  },
  {
    id: 121,
    name: "Tidal Wind",
    nameZh: "沧澜",
    description: "Accumulate 200 total verified flight hours.",
    descriptionZh: "累计有效飞行经历时间达到 200 小时。",
    imageurl: "/badges/badge-hours-200.svg",
    category: "milestone",
    criteria: { type: "hours", threshold: 200 },
    featured: null,
  },
  {
    id: 122,
    name: "Frostfall",
    nameZh: "霁雪",
    description: "Accumulate 350 total verified flight hours.",
    descriptionZh: "累计有效飞行经历时间达到 350 小时。",
    imageurl: "/badges/badge-hours-350.svg",
    category: "milestone",
    criteria: { type: "hours", threshold: 350 },
    featured: null,
  },
  {
    id: 123,
    name: "Twilight & Dawn",
    nameZh: "晨昏",
    description: "Accumulate 500 total verified flight hours with distinguished dedication.",
    descriptionZh: "累计有效飞行经历时间达到 500 小时，历览无数晨昏变幻。",
    imageurl: "/badges/badge-hours-500.svg",
    category: "milestone",
    criteria: { type: "hours", threshold: 500 },
    featured: null,
  },
  {
    id: 124,
    name: "Resting Wings",
    nameZh: "宿羽",
    description: "Accumulate 750 total verified flight hours.",
    descriptionZh: "累计有效飞行经历时间达到 750 小时。",
    imageurl: "/badges/badge-hours-750.svg",
    category: "milestone",
    criteria: { type: "hours", threshold: 750 },
    featured: null,
  },
  {
    id: 125,
    name: "Thousand Hours",
    nameZh: "千时",
    description: "Accumulate 1,000 total verified flight hours, an honored milestone in civil aviation.",
    descriptionZh: "累计有效飞行经历时间突破 1,000 小时，步入功勋飞行之林。",
    imageurl: "/badges/badge-hours-1000.svg",
    category: "milestone",
    criteria: { type: "hours", threshold: 1000 },
    featured: null,
  },
  {
    id: 126,
    name: "Years of Flight",
    nameZh: "岁华",
    description: "Accumulate 1,500 total verified flight hours across continents.",
    descriptionZh: "累计有效飞行经历时间突破 1,500 小时，长风万里，积淀深沉。",
    imageurl: "/badges/badge-hours-1500.svg",
    category: "milestone",
    criteria: { type: "hours", threshold: 1500 },
    featured: null,
  },
  {
    id: 127,
    name: "Transoceanic",
    nameZh: "越洋",
    description: "Accumulate 2,000 total verified flight hours of dedicated operations.",
    descriptionZh: "累计有效飞行经历时间突破 2,000 小时，云途遥遥，初心不改。",
    imageurl: "/badges/badge-hours-2000.svg",
    category: "milestone",
    criteria: { type: "hours", threshold: 2000 },
    featured: null,
  },
  {
    id: 128,
    name: "Traverse Sky",
    nameZh: "纵横",
    description: "Accumulate 3,000 total verified flight hours spanning hemispheres.",
    descriptionZh: "累计有效飞行经历时间突破 3,000 小时，纵横天际三千昼夜。",
    imageurl: "/badges/badge-hours-3000.svg",
    category: "milestone",
    criteria: { type: "hours", threshold: 3000 },
    featured: null,
  },
  {
    id: 129,
    name: "Primordial Cloud",
    nameZh: "鸿蒙",
    description: "Accumulate 5,000 total verified flight hours in virtual aviation.",
    descriptionZh: "累计有效飞行经历时间突破 5,000 小时，深沉纯粹的长空奉献。",
    imageurl: "/badges/badge-hours-500.svg",
    category: "milestone",
    criteria: { type: "hours", threshold: 5000 },
    featured: null,
  },
  {
    id: 210,
    name: "Boundless Sky",
    nameZh: "瀚海",
    description: "Accumulate 7,500 total verified flight hours across vast distances.",
    descriptionZh: "累计有效飞行经历时间突破 7,500 小时，横贯苍穹七千余载。",
    imageurl: "/badges/badge-hours-7500.svg",
    category: "milestone",
    criteria: { type: "hours", threshold: 7500 },
    featured: null,
  },
  {
    id: 211,
    name: "Grand Universe",
    nameZh: "万象",
    description: "Accumulate 10,000 total verified flight hours, the crowning pinnacle of pilot dedication.",
    descriptionZh: "累计有效飞行经历时间达到 10,000 小时，包罗万象，云间大成。",
    imageurl: "/badges/badge-hours-10000.svg",
    category: "milestone",
    criteria: { type: "hours", threshold: 10000 },
    featured: null,
  },

  // ================= 3. HUBS & ROUTES (26) =================
  {
    id: 130,
    name: "Canton Gateway",
    nameZh: "羊城晚照",
    description: "Complete 5 flight movements at Guangzhou Baiyun International Airport (ZGGG).",
    descriptionZh: "在广州白云国际机场 (ZGGG) 完成 5 次进出港起降。",
    imageurl: "/badges/badge-hub-zggg.svg",
    category: "hub",
    criteria: { type: "airport", icao: "ZGGG", count: 5 },
    featured: null,
  },
  {
    id: 131,
    name: "Baiyun Regular",
    nameZh: "白云归燕",
    description: "Complete 20 flight movements at Guangzhou Baiyun International Airport (ZGGG).",
    descriptionZh: "在广州白云国际机场 (ZGGG) 累计完成 20 次进出港起降。",
    imageurl: "/badges/badge-hub-zggg-master.svg",
    category: "hub",
    criteria: { type: "airport", icao: "ZGGG", count: 20 },
    featured: null,
  },
  {
    id: 132,
    name: "Baiyun Guardian 50",
    nameZh: "越秀长风",
    description: "Complete 50 flight movements at Guangzhou Baiyun International Airport (ZGGG).",
    descriptionZh: "在广州白云主枢纽 (ZGGG) 深度执飞累计达到 50 次。",
    imageurl: "/badges/badge-hub-zggg-50.svg",
    category: "hub",
    criteria: { type: "airport", icao: "ZGGG", count: 50 },
    featured: null,
  },
  {
    id: 133,
    name: "Baiyun Century",
    nameZh: "云山叠翠",
    description: "Complete 100 flight movements at Guangzhou Baiyun International Airport (ZGGG).",
    descriptionZh: "在广州白云主枢纽 (ZGGG) 累计执飞达到 100 次起降。",
    imageurl: "/badges/badge-hub-zggg-100.svg",
    category: "hub",
    criteria: { type: "airport", icao: "ZGGG", count: 100 },
    featured: null,
  },
  {
    id: 220,
    name: "Baiyun Sovereign 250",
    nameZh: "珠水安澜",
    description: "Complete 250 flight movements at Guangzhou Baiyun International Airport (ZGGG).",
    descriptionZh: "在广州白云主枢纽 (ZGGG) 累计起降突破 250 次，主场深厚信赖。",
    imageurl: "/badges/badge-hub-zggg-250.svg",
    category: "hub",
    criteria: { type: "airport", icao: "ZGGG", count: 250 },
    featured: null,
  },
  {
    id: 134,
    name: "Daxing Gateway",
    nameZh: "兴耀南畿",
    description: "Complete 5 flight movements at Beijing Daxing International Airport (ZBAD).",
    descriptionZh: "在北京大兴国际机场 (ZBAD) 完成 5 次进出港航班。",
    imageurl: "/badges/badge-hub-zbad.svg",
    category: "hub",
    criteria: { type: "airport", icao: "ZBAD", count: 5 },
    featured: null,
  },
  {
    id: 135,
    name: "Daxing Phoenix",
    nameZh: "凤羽初展",
    description: "Complete 20 flight movements at Beijing Daxing International Airport (ZBAD).",
    descriptionZh: "在北京大兴国际机场 (ZBAD) 累计完成 20 次进出港航班。",
    imageurl: "/badges/badge-hub-zbad-master.svg",
    category: "hub",
    criteria: { type: "airport", icao: "ZBAD", count: 20 },
    featured: null,
  },
  {
    id: 136,
    name: "Daxing Centurion 50",
    nameZh: "金凤朝阳",
    description: "Complete 50 flight movements at Beijing Daxing International Airport (ZBAD).",
    descriptionZh: "在北京大兴国际机场 (ZBAD) 累计起落执飞达到 50 次。",
    imageurl: "/badges/badge-hub-zbad-50.svg",
    category: "hub",
    criteria: { type: "airport", icao: "ZBAD", count: 50 },
    featured: null,
  },
  {
    id: 222,
    name: "Daxing Legend 100",
    nameZh: "畿辅百川",
    description: "Complete 100 flight movements at Beijing Daxing International Airport (ZBAD).",
    descriptionZh: "在北京大兴国际机场 (ZBAD) 累计起落执飞突破 100 次。",
    imageurl: "/badges/badge-hub-zbad-100.svg",
    category: "hub",
    criteria: { type: "airport", icao: "ZBAD", count: 100 },
    featured: null,
  },
  {
    id: 137,
    name: "Shenzhen Express",
    nameZh: "鹏城晨曦",
    description: "Complete 5 flight movements at Shenzhen Bao'an International Airport (ZGSZ).",
    descriptionZh: "在深圳宝安国际机场 (ZGSZ) 完成 5 次进出港航班。",
    imageurl: "/badges/badge-hub-zgsz.svg",
    category: "hub",
    criteria: { type: "airport", icao: "ZGSZ", count: 5 },
    featured: null,
  },
  {
    id: 138,
    name: "Shenzhen Regular 20",
    nameZh: "扶摇九万",
    description: "Complete 20 flight movements at Shenzhen Bao'an International Airport (ZGSZ).",
    descriptionZh: "在深圳宝安国际机场 (ZGSZ) 累计完成 20 次进出港航班。",
    imageurl: "/badges/badge-hub-zgsz-20.svg",
    category: "hub",
    criteria: { type: "airport", icao: "ZGSZ", count: 20 },
    featured: null,
  },
  {
    id: 223,
    name: "Shenzhen Master 50",
    nameZh: "潮涌珠江",
    description: "Complete 50 flight movements at Shenzhen Bao'an International Airport (ZGSZ).",
    descriptionZh: "在深圳宝安国际机场 (ZGSZ) 累计完成 50 次进出港航班。",
    imageurl: "/badges/badge-hub-zgsz-50.svg",
    category: "hub",
    criteria: { type: "airport", icao: "ZGSZ", count: 50 },
    featured: null,
  },
  {
    id: 139,
    name: "Silk Road Gateway",
    nameZh: "西域驼铃",
    description: "Complete 5 flight movements at Urumqi Diwopu International Airport (ZWWW).",
    descriptionZh: "在乌鲁木齐地窝堡国际机场 (ZWWW) 完成 5 次进出港航班。",
    imageurl: "/badges/badge-hub-zwww.svg",
    category: "hub",
    criteria: { type: "airport", icao: "ZWWW", count: 5 },
    featured: null,
  },
  {
    id: 140,
    name: "Silk Road Regular 20",
    nameZh: "天山行旅",
    description: "Complete 20 flight movements at Urumqi Diwopu International Airport (ZWWW).",
    descriptionZh: "在乌鲁木齐地窝堡国际机场 (ZWWW) 累计完成 20 次进出港航班。",
    imageurl: "/badges/badge-hub-zwww-20.svg",
    category: "hub",
    criteria: { type: "airport", icao: "ZWWW", count: 20 },
    featured: null,
  },
  {
    id: 224,
    name: "Silk Road Master 50",
    nameZh: "瀚海行云",
    description: "Complete 50 flight movements at Urumqi Diwopu International Airport (ZWWW).",
    descriptionZh: "在乌鲁木齐地窝堡国际机场 (ZWWW) 累计完成 50 次进出港航班。",
    imageurl: "/badges/badge-hub-zwww-50.svg",
    category: "hub",
    criteria: { type: "airport", icao: "ZWWW", count: 50 },
    featured: null,
  },
  {
    id: 141,
    name: "Chongqing Hub",
    nameZh: "巴山夜雨",
    description: "Complete 5 flight movements at Chongqing Jiangbei International Airport (ZUCK).",
    descriptionZh: "在重庆江北国际机场 (ZUCK) 完成 5 次进出港航班。",
    imageurl: "/badges/badge-hub-zuck.svg",
    category: "hub",
    criteria: { type: "airport", icao: "ZUCK", count: 5 },
    featured: null,
  },
  {
    id: 142,
    name: "Chongqing Master 20",
    nameZh: "峡江雾霭",
    description: "Complete 20 flight movements at Chongqing Jiangbei International Airport (ZUCK).",
    descriptionZh: "在重庆江北国际机场 (ZUCK) 累计完成 20 次进出港航班。",
    imageurl: "/badges/badge-hub-zuck-20.svg",
    category: "hub",
    criteria: { type: "airport", icao: "ZUCK", count: 20 },
    featured: null,
  },
  {
    id: 143,
    name: "Jing-Guang Shuttle",
    nameZh: "京广比翼",
    description: "Fly 5 round-trip sectors on the Jing-Guang trunk corridor (ZGGG ↔ ZBAD).",
    descriptionZh: "执飞京广空中快线 (ZGGG ↔ ZBAD) 往返航段累计达到 5 次。",
    imageurl: "/badges/badge-route-jingguang.svg",
    category: "hub",
    criteria: { type: "route", airports: ["ZGGG", "ZBAD"], count: 5 },
    featured: null,
  },
  {
    id: 144,
    name: "Jing-Guang Commuter 20",
    nameZh: "燕粤连珠",
    description: "Fly 20 round-trip sectors on the Jing-Guang trunk corridor (ZGGG ↔ ZBAD).",
    descriptionZh: "执飞京广空中快线 (ZGGG ↔ ZBAD) 往返航段累计达到 20 次。",
    imageurl: "/badges/badge-route-jingguang-20.svg",
    category: "hub",
    criteria: { type: "route", airports: ["ZGGG", "ZBAD"], count: 20 },
    featured: null,
  },
  {
    id: 145,
    name: "Lhasa Snow Wings",
    nameZh: "雪域飞羽",
    description: "Complete 3 successful landings at Lhasa Gonggar Airport (ZULS, elev 3,570m).",
    descriptionZh: "在拉萨贡嘎高高原机场 (ZULS, 海拔 3,570 米) 成功完成 3 次起降。",
    imageurl: "/badges/badge-hub-zuls.svg",
    category: "hub",
    criteria: { type: "airport", icao: "ZULS", count: 3 },
    featured: null,
  },
  {
    id: 146,
    name: "Plateau Gateway",
    nameZh: "青海澄碧",
    description: "Complete 3 flight movements at Xining Caojiabao Airport (ZLXN, elev 2,171m).",
    descriptionZh: "在西宁曹家堡高原门户机场 (ZLXN, 海拔 2,171 米) 完成 3 次起降。",
    imageurl: "/badges/badge-hub-zlxn.svg",
    category: "hub",
    criteria: { type: "airport", icao: "ZLXN", count: 3 },
    featured: null,
  },
  {
    id: 147,
    name: "Kashgar Gateway",
    nameZh: "疏勒秋风",
    description: "Complete 3 flight movements at Kashgar Laining International Airport (ZWSH).",
    descriptionZh: "在华夏西陲喀什徕宁国际机场 (ZWSH) 完成 3 次起降，重温古丝路风华。",
    imageurl: "/badges/badge-hub-zwsh.svg",
    category: "hub",
    criteria: { type: "airport", icao: "ZWSH", count: 3 },
    featured: null,
  },
  {
    id: 148,
    name: "Shanghai Gateway",
    nameZh: "沪渚申江",
    description: "Complete 10 flight movements across Shanghai Hongqiao (ZSSS) or Pudong (ZSPD).",
    descriptionZh: "在上海虹桥 (ZSSS) 或浦东 (ZSPD) 累计完成 10 次进出港航班。",
    imageurl: "/badges/badge-hub-shanghai.svg",
    category: "hub",
    criteria: { type: "airports_multi", airports: ["ZSSS", "ZSPD"], count: 10 },
    featured: null,
  },
  {
    id: 149,
    name: "Chengdu Tianfu",
    nameZh: "锦里行云",
    description: "Complete 10 flight movements across Chengdu Shuangliu (ZUUU) or Tianfu (ZUTF).",
    descriptionZh: "在成都双流 (ZUUU) 或天府 (ZUTF) 累计完成 10 次进出港航班。",
    imageurl: "/badges/badge-hub-chengdu.svg",
    category: "hub",
    criteria: { type: "airports_multi", airports: ["ZUUU", "ZUTF"], count: 10 },
    featured: null,
  },
  {
    id: 150,
    name: "Hainan Breeze",
    nameZh: "南溟潮汐",
    description: "Complete 10 flight movements across Haikou Meilan (ZJHK) or Sanya Phoenix (ZGSY).",
    descriptionZh: "在海口美兰 (ZJHK) 或三亚凤凰 (ZGSY) 累计完成 10 次热带航线执飞。",
    imageurl: "/badges/badge-hub-hainan.svg",
    category: "hub",
    criteria: { type: "airports_multi", airports: ["ZJHK", "ZGSY"], count: 10 },
    featured: null,
  },
  {
    id: 151,
    name: "Pearl of the Orient",
    nameZh: "维港晴空",
    description: "Complete 5 flight movements at Hong Kong International Airport (VHHH).",
    descriptionZh: "在香港赤腊角国际机场 (VHHH) 完成 5 次进出港航班。",
    imageurl: "/badges/badge-hub-vhhh.svg",
    category: "hub",
    criteria: { type: "airport", icao: "VHHH", count: 5 },
    featured: null,
  },

  // ================= 4. FLEET MASTERY (25) =================
  {
    id: 152,
    name: "A350 Shades Aviator",
    nameZh: "墨镜巡风",
    description: "Complete 3 flights piloting the Airbus A350-900 widebody aircraft.",
    descriptionZh: "执飞空中客车 A350-900 宽体客机完成 3 架次航班。",
    imageurl: "/badges/badge-fleet-a350.svg",
    category: "fleet",
    criteria: { type: "aircraft", match: "A350", count: 3 },
    featured: null,
  },
  {
    id: 153,
    name: "A350 Flagship Veteran",
    nameZh: "碳翼长空",
    description: "Complete 15 flights piloting the Airbus A350-900 widebody aircraft.",
    descriptionZh: "深度专精空中客车 A350-900 宽体客机，执飞达到 15 架次。",
    imageurl: "/badges/badge-fleet-a350-15.svg",
    category: "fleet",
    criteria: { type: "aircraft", match: "A350", count: 15 },
    featured: null,
  },
  {
    id: 230,
    name: "A350 Master 50",
    nameZh: "凌霄墨羽",
    description: "Complete 50 flights piloting the Airbus A350-900 widebody aircraft.",
    descriptionZh: "执飞空中客车 A350-900 宽体客机达到 50 架次，长空墨羽，驾轻就熟。",
    imageurl: "/badges/badge-fleet-a350-50.svg",
    category: "fleet",
    criteria: { type: "aircraft", match: "A350", count: 50 },
    featured: null,
  },
  {
    id: 154,
    name: "B777 Flagship Flier",
    nameZh: "广宇沉雄",
    description: "Complete 3 flights piloting the Boeing 777-300ER long-range aircraft.",
    descriptionZh: "执飞波音 777-300ER 远程洲际客机完成 3 架次航班。",
    imageurl: "/badges/badge-fleet-b77w.svg",
    category: "fleet",
    criteria: { type: "aircraft", match: "777-300ER", count: 3 },
    featured: null,
  },
  {
    id: 155,
    name: "B777 Intercontinental Veteran",
    nameZh: "洲际长驱",
    description: "Complete 15 flights piloting the Boeing 777-300ER long-range aircraft.",
    descriptionZh: "深度专精波音 777-300ER 远程客机，洲际执飞达到 15 架次。",
    imageurl: "/badges/badge-fleet-b77w-15.svg",
    category: "fleet",
    criteria: { type: "aircraft", match: "777-300ER", count: 15 },
    featured: null,
  },
  {
    id: 231,
    name: "B777 Master 50",
    nameZh: "沧海横流",
    description: "Complete 50 flights piloting the Boeing 777-300ER long-range aircraft.",
    descriptionZh: "执飞波音 777 洲际客机达到 50 架次，跨越大洋如履平川。",
    imageurl: "/badges/badge-fleet-b77w-50.svg",
    category: "fleet",
    criteria: { type: "aircraft", match: "777-300ER", count: 50 },
    featured: null,
  },
  {
    id: 156,
    name: "B787 Dreamliner Flier",
    nameZh: "梦羽轻扬",
    description: "Complete 3 flights piloting the Boeing 787 Dreamliner family.",
    descriptionZh: "执飞波音 787 梦想客机系列完成 3 架次航班。",
    imageurl: "/badges/badge-fleet-b787.svg",
    category: "fleet",
    criteria: { type: "aircraft", match: "787", count: 3 },
    featured: null,
  },
  {
    id: 157,
    name: "B787 Dreamliner Veteran",
    nameZh: "浮光织梦",
    description: "Complete 15 flights piloting the Boeing 787 Dreamliner family.",
    descriptionZh: "深度专精波音 787 梦想客机，完成 15 架次高空巡航。",
    imageurl: "/badges/badge-fleet-b787-15.svg",
    category: "fleet",
    criteria: { type: "aircraft", match: "787", count: 15 },
    featured: null,
  },
  {
    id: 158,
    name: "A330 Cruiser",
    nameZh: "远岫青峦",
    description: "Complete 3 flights piloting the Airbus A330 widebody series.",
    descriptionZh: "执飞空中客车 A330 系列宽体客机完成 3 架次航班。",
    imageurl: "/badges/badge-fleet-a330.svg",
    category: "fleet",
    criteria: { type: "aircraft", match: "A330", count: 3 },
    featured: null,
  },
  {
    id: 159,
    name: "A330 Trunk Veteran",
    nameZh: "渊渟岳立",
    description: "Complete 15 flights piloting the Airbus A330 widebody series.",
    descriptionZh: "深度专精空中客车 A330 宽体客机，累计执飞达到 15 架次。",
    imageurl: "/badges/badge-fleet-a330-15.svg",
    category: "fleet",
    criteria: { type: "aircraft", match: "A330", count: 15 },
    featured: null,
  },
  {
    id: 160,
    name: "A320 Flier",
    nameZh: "灵巧轻燕",
    description: "Complete 5 flights piloting the Airbus A320 narrowbody family.",
    descriptionZh: "执飞空中客车 A320 家族窄体客机完成 5 架次航班。",
    imageurl: "/badges/badge-fleet-a320.svg",
    category: "fleet",
    criteria: { type: "aircraft", match: "A32", count: 5 },
    featured: null,
  },
  {
    id: 161,
    name: "A320 Veteran 25",
    nameZh: "穿林掠影",
    description: "Complete 25 flights piloting the Airbus A320 narrowbody family.",
    descriptionZh: "熟练驾驭空中客车 A320 家族客机，累计执飞达到 25 架次。",
    imageurl: "/badges/badge-fleet-a320-25.svg",
    category: "fleet",
    criteria: { type: "aircraft", match: "A32", count: 25 },
    featured: null,
  },
  {
    id: 232,
    name: "A320 Master 50",
    nameZh: "经世之翼",
    description: "Complete 50 flights piloting the Airbus A320 narrowbody family.",
    descriptionZh: "执飞空中客车 A320 家族窄体客机达到 50 架次，起降行云流水。",
    imageurl: "/badges/badge-fleet-a320-50.svg",
    category: "fleet",
    criteria: { type: "aircraft", match: "A32", count: 50 },
    featured: null,
  },
  {
    id: 162,
    name: "B737 Backbone Flier",
    nameZh: "经纬中坚",
    description: "Complete 5 flights piloting the Boeing 737 narrowbody family.",
    descriptionZh: "执飞波音 737 系列窄体客机完成 5 架次航班。",
    imageurl: "/badges/badge-fleet-b737.svg",
    category: "fleet",
    criteria: { type: "aircraft", match: "737", count: 5 },
    featured: null,
  },
  {
    id: 163,
    name: "B737 Veteran 25",
    nameZh: "驰行九州",
    description: "Complete 25 flights piloting the Boeing 737 narrowbody family.",
    descriptionZh: "执飞波音 737 系列窄体客机累计达到 25 架次。",
    imageurl: "/badges/badge-fleet-b737-25.svg",
    category: "fleet",
    criteria: { type: "aircraft", match: "737", count: 25 },
    featured: null,
  },
  {
    id: 233,
    name: "B737 Master 50",
    nameZh: "砥柱长川",
    description: "Complete 50 flights piloting the Boeing 737 narrowbody family.",
    descriptionZh: "执飞波音 737 系列窄体客机达到 50 架次，穿梭国内骨干航网。",
    imageurl: "/badges/badge-fleet-b737-50.svg",
    category: "fleet",
    criteria: { type: "aircraft", match: "737", count: 50 },
    featured: null,
  },
  {
    id: 164,
    name: "Cargo Transport Flier",
    nameZh: "潜行重装",
    description: "Complete 3 freight flights piloting B777F or heavy cargo aircraft.",
    descriptionZh: "执飞南航货运 B777F 或全货机完成 3 架次运输任务。",
    imageurl: "/badges/badge-fleet-cargo.svg",
    category: "fleet",
    criteria: { type: "aircraft", match: "Freighter|777F|747", count: 3 },
    featured: null,
  },
  {
    id: 165,
    name: "Cargo Logistics Veteran",
    nameZh: "云路邮驿",
    description: "Complete 15 freight flights piloting heavy cargo aircraft.",
    descriptionZh: "执飞南航全货机完成 15 架次货物运输，护航环球物流走廊。",
    imageurl: "/badges/badge-fleet-cargo-15.svg",
    category: "fleet",
    criteria: { type: "aircraft", match: "Freighter|777F|747", count: 15 },
    featured: null,
  },
  {
    id: 234,
    name: "Cargo Master 50",
    nameZh: "环球飞鸿",
    description: "Complete 50 freight flights piloting heavy cargo aircraft.",
    descriptionZh: "执飞南航全货机达到 50 架次，跨越大洲大洋，沉静通达四海。",
    imageurl: "/badges/badge-fleet-cargo-50.svg",
    category: "fleet",
    criteria: { type: "aircraft", match: "Freighter|777F|747", count: 50 },
    featured: null,
  },
  {
    id: 166,
    name: "A380 Superjumbo Flier",
    nameZh: "巨擘凌空",
    description: "Complete at least 1 flight piloting the Airbus A380-800 superjumbo.",
    descriptionZh: "执飞空中客车 A380-800 旗舰客机完成至少 1 架次飞行。",
    imageurl: "/badges/badge-fleet-a380.svg",
    category: "fleet",
    criteria: { type: "aircraft", match: "A380", count: 1 },
    featured: null,
  },
  {
    id: 167,
    name: "A380 Legend 5",
    nameZh: "云海苍茫",
    description: "Complete 5 classic route flights piloting the Airbus A380-800 superjumbo.",
    descriptionZh: "深度驾驭空中客车 A380-800 巨无霸完成 5 架次经典航线。",
    imageurl: "/badges/badge-fleet-a380-5.svg",
    category: "fleet",
    criteria: { type: "aircraft", match: "A380", count: 5 },
    featured: null,
  },
  {
    id: 168,
    name: "Queen of the Skies B747",
    nameZh: "岁稔女王",
    description: "Complete 3 flights piloting the Boeing 747-400F four-engine freighter.",
    descriptionZh: "执飞波音 747-400F 传奇四发货机完成 3 架次航线飞行。",
    imageurl: "/badges/badge-fleet-b747.svg",
    category: "fleet",
    criteria: { type: "aircraft", match: "747", count: 3 },
    featured: null,
  },
  {
    id: 169,
    name: "B757 Classic Pencil",
    nameZh: "经典流韵",
    description: "Complete 3 flights piloting the classic Boeing 757-200 aircraft.",
    descriptionZh: "执飞经典波音 757-200 客机完成 3 架次航班，重温高原经典之韵。",
    imageurl: "/badges/badge-fleet-b757.svg",
    category: "fleet",
    criteria: { type: "aircraft", match: "757", count: 3 },
    featured: null,
  },
  {
    id: 170,
    name: "E190 Regional Jet",
    nameZh: "幽径清泉",
    description: "Complete 3 flights piloting the Embraer E190 regional jet.",
    descriptionZh: "执飞 Embraer E190 喷气支线客机完成 3 架次航班，穿行支线绿水青山。",
    imageurl: "/badges/badge-fleet-e190.svg",
    category: "fleet",
    criteria: { type: "aircraft", match: "E190|Embraer", count: 3 },
    featured: null,
  },
  {
    id: 171,
    name: "XiamenAir Egret",
    nameZh: "白鹭逐波",
    description: "Complete 3 flights in XiamenAir livery.",
    descriptionZh: "执飞厦门航空涂装客机完成 3 架次客运航班。",
    imageurl: "/badges/badge-fleet-xiamen.svg",
    category: "fleet",
    criteria: { type: "aircraft", match: "Xiamen|CXA", count: 3 },
    featured: null,
  },

  // ================= 5. CHALLENGES (11) =================
  {
    id: 172,
    name: "Transpacific 10h+",
    nameZh: "逐日长征",
    description: "Complete a single long-haul intercontinental flight of 10 hours or longer.",
    descriptionZh: "完成单次有效飞行经历时间达到或超过 10 小时的洲际越洋航线。",
    imageurl: "/badges/badge-challenge-longhaul.svg",
    category: "challenge",
    criteria: { type: "single_duration_hours", threshold: 10 },
    featured: null,
  },
  {
    id: 173,
    name: "Ultra Long Haul 14h+",
    nameZh: "极夜之光",
    description: "Complete a single ultra long-haul flight of 14 hours or longer (e.g. CAN to JFK/LAX).",
    descriptionZh: "完成单次飞行时间超过 14 小时的极限航线（如广州直飞纽约/洛杉矶）。",
    imageurl: "/badges/badge-challenge-ultrahaul.svg",
    category: "challenge",
    criteria: { type: "single_duration_hours", threshold: 14 },
    featured: null,
  },
  {
    id: 174,
    name: "European Gateway",
    nameZh: "欧罗巴巡礼",
    description: "Fly 5 flights to London Heathrow (EGLL), Paris CDG (LFPG), Amsterdam (EHAM), or Frankfurt (EDDF).",
    descriptionZh: "执飞伦敦希思罗 (EGLL)、巴黎戴高乐 (LFPG)、阿姆斯特丹 (EHAM) 或法兰克福 (EDDF) 累计 5 次。",
    imageurl: "/badges/badge-challenge-europe.svg",
    category: "challenge",
    criteria: { type: "airports_multi", airports: ["EGLL", "LFPG", "EHAM", "EDDF"], count: 5 },
    featured: null,
  },
  {
    id: 175,
    name: "North America Expert",
    nameZh: "远渡重洋",
    description: "Fly 5 flights to Los Angeles (KLAX), New York JFK (KJFK), San Francisco (KSFO), or Vancouver (CYVR).",
    descriptionZh: "执飞洛杉矶 (KLAX)、纽约肯尼迪 (KJFK)、旧金山 (KSFO) 或温哥华 (CYVR) 累计 5 次。",
    imageurl: "/badges/badge-challenge-northamerica.svg",
    category: "challenge",
    criteria: { type: "airports_multi", airports: ["KLAX", "KJFK", "KSFO", "CYVR"], count: 5 },
    featured: null,
  },
  {
    id: 176,
    name: "Oceania Kangaroo Route",
    nameZh: "南十字星",
    description: "Fly 5 flights to Sydney (YSSY), Melbourne (YMML), or Auckland (NZAA).",
    descriptionZh: "执飞悉尼 (YSSY)、墨尔本 (YMML) 或奥克兰 (NZAA) 累计 5 次。",
    imageurl: "/badges/badge-challenge-oceania.svg",
    category: "challenge",
    criteria: { type: "airports_multi", airports: ["YSSY", "YMML", "NZAA"], count: 5 },
    featured: null,
  },
  {
    id: 177,
    name: "Middle East Golden Bridge",
    nameZh: "金色绿洲",
    description: "Fly 3 flights to Dubai (OMDB) or Doha (OTHH).",
    descriptionZh: "执飞迪拜 (OMDB) 或多哈 (OTHH) 进出港累计 3 次。",
    imageurl: "/badges/badge-challenge-mideast.svg",
    category: "challenge",
    criteria: { type: "airports_multi", airports: ["OMDB", "OTHH"], count: 3 },
    featured: null,
  },
  {
    id: 178,
    name: "Night Owl Aviator",
    nameZh: "星夜同辉",
    description: "Complete 3 flights with nighttime departure or arrival.",
    descriptionZh: "累计完成 3 次夜间起飞或降落的航段执飞。",
    imageurl: "/badges/badge-challenge-night.svg",
    category: "challenge",
    criteria: { type: "night_flights", count: 3 },
    featured: null,
  },
  {
    id: 179,
    name: "Midnight Cruiser 10",
    nameZh: "枕星入眠",
    description: "Complete 10 flights with nighttime departure or arrival under starlit skies.",
    descriptionZh: "累计完成 10 次夜间起落执飞，伴星光启航。",
    imageurl: "/badges/badge-challenge-night-10.svg",
    category: "challenge",
    criteria: { type: "night_flights", count: 10 },
    featured: null,
  },
  {
    id: 241,
    name: "Midnight Phantom 30",
    nameZh: "寂夜幽巡",
    description: "Complete 30 flights with nighttime departure or arrival.",
    descriptionZh: "累计完成 30 次夜间起落执飞，静默巡航于深夜天幕。",
    imageurl: "/badges/badge-challenge-night-30.svg",
    category: "challenge",
    criteria: { type: "night_flights", count: 30 },
    featured: null,
  },
  {
    id: 180,
    name: "Clean Record 20",
    nameZh: "严谨持身",
    description: "Achieve 20 consecutively approved PIREPs with zero rejections.",
    descriptionZh: "累计获得 20 次 100% 审核通过且无驳回的有效飞行记录。",
    imageurl: "/badges/badge-challenge-clean-20.svg",
    category: "challenge",
    criteria: { type: "clean_streak", count: 20 },
    featured: null,
  },
  {
    id: 181,
    name: "Flawless Captain 50",
    nameZh: "皓月无瑕",
    description: "Achieve 50 consecutively approved PIREPs with zero rejections.",
    descriptionZh: "累计获得 50 次 100% 审核通过无驳回记录，严谨执飞典范。",
    imageurl: "/badges/badge-challenge-clean-50.svg",
    category: "challenge",
    criteria: { type: "clean_streak", count: 50 },
    featured: null,
  },

  // ================= 6. HONORS (7) =================
  {
    id: 1,
    name: "Live Operations Certified Pilot",
    nameZh: "实时运行认证机长",
    description: "Authorized for CZVG Live Aircraft Scheduling and real-time dispatch operations.",
    descriptionZh: "获得 CZVG 实时机队排班与实时签派调度认证资格。",
    imageurl: "/badges/badge-honor-live.svg",
    category: "honor",
    criteria: { type: "manual" },
    featured: null,
  },
  {
    id: 2,
    name: "CEO's Commendation Award",
    nameZh: "总裁特别嘉奖",
    description: "Awarded by the CEO for outstanding operational excellence and community dedication.",
    descriptionZh: "由管理层特许颁发的杰出贡献、飞行卓越与社区表彰奖章。",
    imageurl: "/badges/badge-honor-ceo.svg",
    category: "honor",
    criteria: { type: "manual" },
    featured: 1,
  },
  {
    id: 182,
    name: "1 Year Active Service",
    nameZh: "岁稔一章",
    description: "One full year of active service with China Southern Virtual Group.",
    descriptionZh: "加入 CZVG 虚拟航空满 1 周年，春华秋实，岁稔一章。",
    imageurl: "/badges/badge-honor-year-1.svg",
    category: "honor",
    criteria: { type: "membership_days", days: 365 },
    featured: null,
  },
  {
    id: 183,
    name: "2 Years Veteran",
    nameZh: "岁律两重",
    description: "Two full years of active service with China Southern Virtual Group.",
    descriptionZh: "加入 CZVG 虚拟航空满 2 周年，风雨同舟，岁律两重。",
    imageurl: "/badges/badge-honor-year-2.svg",
    category: "honor",
    criteria: { type: "membership_days", days: 730 },
    featured: null,
  },
  {
    id: 250,
    name: "3 Years Hall of Fame",
    nameZh: "千日成诵",
    description: "Three full years of active service with China Southern Virtual Group.",
    descriptionZh: "加入 CZVG 虚拟航空满 3 周年，逾千日长空相伴，岁月成诵。",
    imageurl: "/badges/badge-honor-year-3.svg",
    category: "honor",
    criteria: { type: "membership_days", days: 1095 },
    featured: null,
  },
  {
    id: 251,
    name: "5 Years Legend",
    nameZh: "半秩清欢",
    description: "Five full years of dedicated service with China Southern Virtual Group.",
    descriptionZh: "加入 CZVG 虚拟航空满 5 周年，半秩岁月，初心如磐。",
    imageurl: "/badges/badge-honor-year-5.svg",
    category: "honor",
    criteria: { type: "membership_days", days: 1825 },
    featured: null,
  },
  {
    id: 184,
    name: "Flight Operations Inspector",
    nameZh: "五星运行检查教官",
    description: "Special commendation awarded by management for flight training and standard enforcement.",
    descriptionZh: "由管理层特许颁发的 CZVG 飞行运行检查与教官特别荣誉。",
    imageurl: "/badges/badge-honor-inspector.svg",
    category: "honor",
    criteria: { type: "manual" },
    featured: null,
  },
];

console.log(`Loaded ${MASTER_BADGES.length} Master Badges!`);

// Helper to generate themed SVG badges
function createBadgeSvg({
  id,
  type = "shield",
  primaryColor = "#002776",
  accentColor = "#F59E0B",
  metalColor = "#D97706",
  subText = "",
  tierStars = 0,
}) {
  const starsSvg = Array.from({ length: tierStars })
    .map((_, i) => {
      const offset = (i - (tierStars - 1) / 2) * 10;
      return `<polygon points="${48 + offset},76 ${50 + offset},80.5 ${54 + offset},80.5 ${51 + offset},83 ${52 + offset},87 ${48 + offset},85 ${44 + offset},87 ${45 + offset},83 ${42 + offset},80.5 ${46 + offset},80.5" fill="${accentColor}" stroke="#0F172A" stroke-width="0.5"/>`;
    })
    .join("\n");

  const subTextSvg = subText
    ? `<text x="48" y="70" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="6.2" font-weight="900" fill="${accentColor}" letter-spacing="0.3">${subText}</text>`
    : "";

  let baseShape = "";
  if (type === "diamond") {
    baseShape = `
      <polygon points="48,6 62,34 90,48 62,62 48,90 34,62 6,48 34,34" fill="url(#metalGrad)" stroke="${metalColor}" stroke-width="1.5" filter="url(#dropShadow)" />
      <polygon points="48,13 58,36 81,48 58,60 48,83 38,60 15,48 38,36" fill="url(#coreGrad)" stroke="${accentColor}" stroke-width="1.2" />
    `;
  } else if (type === "star") {
    baseShape = `
      <polygon points="48,8 57,28 78,18 73,39 94,48 73,57 78,78 57,68 48,88 39,68 18,78 23,57 2,48 23,39 18,18 39,28" fill="url(#metalGrad)" stroke="${metalColor}" stroke-width="1.5" filter="url(#dropShadow)"/>
      <circle cx="48" cy="48" r="24" fill="url(#coreGrad)" stroke="${accentColor}" stroke-width="1.5" />
    `;
  } else if (type === "wings") {
    baseShape = `
      <g filter="url(#dropShadow)">
        <path d="M 48 48 C 36 32, 16 34, 4 40 C 14 50, 32 54, 48 54 Z" fill="url(#metalGrad)" stroke="${metalColor}" stroke-width="1.5" />
        <path d="M 44 46 C 34 37, 20 38, 10 43 C 18 49, 32 51, 44 51 Z" fill="${accentColor}" opacity="0.3" />
        <path d="M 48 48 C 60 32, 80 34, 92 40 C 82 50, 64 54, 48 54 Z" fill="url(#metalGrad)" stroke="${metalColor}" stroke-width="1.5" />
        <path d="M 52 46 C 62 37, 76 38, 86 43 C 78 49, 64 51, 52 51 Z" fill="${accentColor}" opacity="0.3" />
      </g>
      <circle cx="48" cy="48" r="22" fill="url(#metalGrad)" stroke="${metalColor}" stroke-width="1.5" filter="url(#dropShadow)" />
      <circle cx="48" cy="48" r="18" fill="url(#coreGrad)" stroke="${accentColor}" stroke-width="1" />
    `;
  } else if (type === "roundel") {
    baseShape = `
      <circle cx="48" cy="48" r="40" fill="url(#metalGrad)" stroke="${metalColor}" stroke-width="2" filter="url(#dropShadow)" />
      <circle cx="48" cy="48" r="35" fill="none" stroke="${accentColor}" stroke-width="1" stroke-dasharray="3,2" />
      <circle cx="48" cy="48" r="32" fill="url(#coreGrad)" stroke="${accentColor}" stroke-width="1.5" />
    `;
  } else {
    // Shield
    baseShape = `
      <path d="M 48 10 C 68 10, 84 14, 84 32 C 84 62, 54 84, 48 88 C 42 84, 12 62, 12 32 C 12 14, 28 10, 48 10 Z" fill="url(#metalGrad)" stroke="${metalColor}" stroke-width="2" filter="url(#dropShadow)" />
      <path d="M 48 14 C 65 14, 79 18, 79 34 C 79 59, 53 79, 48 83 C 43 79, 17 59, 17 34 C 17 18, 31 14, 48 14 Z" fill="url(#coreGrad)" stroke="${accentColor}" stroke-width="1.2" opacity="0.95" />
    `;
  }

  // Choose icon glyph based on id
  let iconPath = `
    <path d="M 48 28 L 52 38 L 66 43 L 66 46 L 52 46 L 52 54 L 56 57 L 56 60 L 48 58 L 40 60 L 40 57 L 44 54 L 44 46 L 30 46 L 30 43 L 44 38 Z" fill="url(#glyphGrad)" stroke="#0F172A" stroke-width="0.75" />
  `;

  if (id.includes("hours")) {
    if (id.includes("10000")) {
      iconPath = `
        <polygon points="48,22 66,34 58,60 38,60 30,34" fill="url(#glyphGrad)" stroke="#0F172A" stroke-width="1" />
        <polyline points="30,34 48,39 66,34" fill="none" stroke="#FFFFFF" stroke-width="1" />
        <line x1="48" y1="39" x2="48" y2="60" stroke="#FFFFFF" stroke-width="1" />
      `;
    } else if (id.includes("7500") || id.includes("5000") || id.includes("3000")) {
      iconPath = `
        <circle cx="48" cy="44" r="16" fill="none" stroke="url(#glyphGrad)" stroke-width="1.5" />
        <polygon points="48,28 52,40 64,44 52,48 48,60 44,48 32,44 44,40" fill="url(#glyphGrad)" />
      `;
    } else if (id.includes("1000") || id.includes("1500") || id.includes("2000")) {
      iconPath = `
        <path d="M 48 28 L 53 38 L 63 35 L 58 45 L 68 49 L 56 53 L 54 63 L 48 56 L 42 63 L 40 53 L 28 49 L 38 45 L 33 35 L 43 38 Z" fill="url(#glyphGrad)" stroke="#E60012" stroke-width="0.8" />
        <circle cx="48" cy="46" r="3.5" fill="#E60012" />
      `;
    } else {
      iconPath = `
        <circle cx="48" cy="46" r="14" fill="none" stroke="url(#glyphGrad)" stroke-width="2" />
        <polyline points="48,37 48,46 54,46" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" />
        <polygon points="48,28 51,32 45,32" fill="url(#glyphGrad)" />
      `;
    }
  } else if (id.includes("hub") || id.includes("route")) {
    if (id.includes("zuls") || id.includes("zlxn") || id.includes("zwsh")) {
      iconPath = `
        <polygon points="34,56 48,34 62,56" fill="url(#glyphGrad)" stroke="#0F172A" stroke-width="0.75" />
        <polygon points="48,34 52,40 44,40" fill="#FFFFFF" />
        <polygon points="22,58 34,42 46,58" fill="url(#glyphGrad)" opacity="0.8" />
        <polygon points="50,58 62,44 74,58" fill="url(#glyphGrad)" opacity="0.8" />
      `;
    } else {
      iconPath = `
        <path d="M 44 60 L 46 40 L 43 40 L 43 36 L 53 36 L 53 40 L 50 40 L 52 60 Z" fill="url(#glyphGrad)" />
        <circle cx="48" cy="32" r="6" fill="url(#glyphGrad)" />
        <path d="M 38 28 A 14 14 0 0 1 58 28" fill="none" stroke="#0EA5E9" stroke-width="1.5" />
      `;
    }
  } else if (id.includes("fleet")) {
    if (id.includes("cargo")) {
      iconPath = `
        <rect x="38" y="38" width="20" height="18" rx="2" fill="url(#glyphGrad)" stroke="#0F172A" stroke-width="1" />
        <line x1="38" y1="47" x2="58" y2="47" stroke="#0F172A" stroke-width="1" />
        <line x1="48" y1="38" x2="48" y2="56" stroke="#0F172A" stroke-width="1" />
        <path d="M 30 35 L 42 27 L 54 27 L 66 35 Z" fill="#E60012" opacity="0.9" />
      `;
    } else if (id.includes("a380") || id.includes("b747")) {
      iconPath = `
        <path d="M 48 23 C 51 23, 52 28, 52 42 L 72 52 L 72 55 L 52 52 L 52 61 L 58 65 L 58 68 L 48 66 L 38 68 L 38 65 L 44 61 L 44 52 L 24 55 L 24 52 L 44 42 C 44 28, 45 23, 48 23 Z" fill="url(#glyphGrad)" stroke="#0F172A" stroke-width="0.75" />
      `;
    } else {
      iconPath = `
        <path d="M 48 24 C 50 24, 51 28, 51 40 L 68 50 L 68 53 L 51 51 L 51 60 L 56 64 L 56 67 L 48 65 L 40 67 L 40 64 L 45 60 L 45 51 L 28 53 L 28 50 L 45 40 C 45 28, 46 24, 48 24 Z" fill="url(#glyphGrad)" stroke="#0F172A" stroke-width="0.75" />
      `;
    }
  } else if (id.includes("clean")) {
    iconPath = `
      <path d="M 48 28 C 58 28, 64 30, 64 38 C 64 54, 52 64, 48 66 C 44 64, 32 54, 32 38 C 32 30, 38 28, 48 28 Z" fill="url(#glyphGrad)" stroke="#0F172A" stroke-width="1" />
      <polyline points="40,46 45,51 56,39" fill="none" stroke="#002776" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
    `;
  } else if (id.includes("night")) {
    iconPath = `
      <path d="M 54 26 A 12 12 0 1 1 40 44 A 15 15 0 0 0 54 26 Z" fill="#F59E0B" />
      <path d="M 32 50 C 32 46, 36 43, 40 44 C 42 40, 48 40, 50 43 C 54 42, 58 45, 57 49 C 60 50, 61 54, 58 57 L 34 57 C 32 57, 30 55, 32 50 Z" fill="#E2E8F0" opacity="0.8" />
    `;
  } else if (id.includes("year")) {
    iconPath = `
      <rect x="34" y="32" width="28" height="26" rx="3" fill="url(#glyphGrad)" stroke="#0F172A" stroke-width="1" />
      <rect x="34" y="32" width="28" height="8" rx="2" fill="#E60012" />
      <line x1="41" y1="28" x2="41" y2="34" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" />
      <line x1="55" y1="28" x2="55" y2="34" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" />
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
  <defs>
    <filter id="dropShadow" x="-10%" y="-10%" width="125%" height="125%">
      <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.5" />
    </filter>
    <linearGradient id="metalGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.8" />
      <stop offset="25%" stop-color="${accentColor}" />
      <stop offset="70%" stop-color="${metalColor}" />
      <stop offset="100%" stop-color="#0F172A" />
    </linearGradient>
    <linearGradient id="coreGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1E3A8A" />
      <stop offset="50%" stop-color="${primaryColor}" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
    <linearGradient id="glyphGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="60%" stop-color="${accentColor}" />
      <stop offset="100%" stop-color="${metalColor}" />
    </linearGradient>
  </defs>

  ${baseShape}

  <g transform="translate(0, 0)">
    ${iconPath}
  </g>

  ${subTextSvg}
  ${starsSvg}
</svg>`;
}

// 1. Generate SVGs for all badges
console.log(`Writing SVG files for all ${MASTER_BADGES.length} badges...`);
for (const b of MASTER_BADGES) {
  const filename = b.imageurl.replace("/badges/", "");
  const filePath = path.join(badgesDir, filename);

  let type = "shield";
  let primaryColor = "#002776";
  let accentColor = "#F59E0B";
  let metalColor = "#D97706";
  let subText = "";
  let tierStars = 0;

  if (filename.includes("10000") && filename.includes("hours")) {
    type = "diamond";
    accentColor = "#F43F5E";
    metalColor = "#E60012";
    subText = "10KH";
    tierStars = 5;
  } else if (filename.includes("7500") && filename.includes("hours")) {
    type = "star";
    accentColor = "#F59E0B";
    metalColor = "#B45309";
    subText = "7.5KH";
    tierStars = 5;
  } else if (filename.includes("5000") && filename.includes("hours")) {
    type = "star";
    accentColor = "#38BDF8";
    metalColor = "#0284C7";
    subText = "5KH";
    tierStars = 5;
  } else if (filename.includes("3000") && filename.includes("flights")) {
    type = "diamond";
    accentColor = "#F43F5E";
    metalColor = "#E60012";
    subText = "3KF";
    tierStars = 5;
  } else if (filename.includes("2000") && filename.includes("flights")) {
    type = "star";
    accentColor = "#8B5CF6";
    metalColor = "#6D28D9";
    subText = "2KF";
    tierStars = 5;
  } else if (filename.includes("1500") && filename.includes("flights")) {
    type = "star";
    accentColor = "#EC4899";
    metalColor = "#BE185D";
    subText = "1.5KF";
    tierStars = 4;
  } else if (filename.includes("hours")) {
    type = filename.includes("500") || filename.includes("750") || filename.includes("1000") ? "star" : "roundel";
    subText = filename.replace("badge-hours-", "").replace(".svg", "H").toUpperCase();
    tierStars = 3;
  } else if (filename.includes("flights")) {
    subText = filename.replace("badge-flights-", "").replace(".svg", "F").toUpperCase();
  }

  const svg = createBadgeSvg({
    id: filename,
    type,
    primaryColor,
    accentColor,
    metalColor,
    subText,
    tierStars,
  });

  fs.writeFileSync(filePath, svg, "utf-8");
}
console.log(`Successfully generated all ${MASTER_BADGES.length} badge SVGs!`);

// 2. Generate SQL migration file with name_zh and description_zh
const sqlRows = MASTER_BADGES.map((b) => {
  const criteriaJson = JSON.stringify(b.criteria);
  const featuredVal = b.featured === 1 ? "1" : "NULL";
  const nameSafe = b.name.replace(/'/g, "''");
  const nameZhSafe = b.nameZh.replace(/'/g, "''");
  const descSafe = b.description.replace(/'/g, "''");
  const descZhSafe = b.descriptionZh.replace(/'/g, "''");
  return `  ('${nameSafe}', '${nameZhSafe}', '${descSafe}', '${descZhSafe}', '${b.imageurl}', '${b.category}', '${criteriaJson}', ${featuredVal})`;
}).join(",\n");

const sqlContent = `-- Comprehensive awards migration with ${MASTER_BADGES.length} badges (Bilingual: Pure English + Poetic Chinese)
ALTER TABLE \`awards\`
  ADD COLUMN IF NOT EXISTS \`name_zh\` VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS \`description_zh\` TEXT NULL,
  ADD COLUMN IF NOT EXISTS \`category\` VARCHAR(50) NOT NULL DEFAULT 'milestone',
  ADD COLUMN IF NOT EXISTS \`criteria\` JSON NULL;

UPDATE \`awards\`
SET \`category\` = 'honor',
    \`imageurl\` = '/badges/badge-honor-live.svg',
    \`criteria\` = '{"type":"manual"}'
WHERE LOWER(\`name\`) LIKE '%live operations%' OR LOWER(\`name\`) LIKE '%live pilot%';

UPDATE \`awards\`
SET \`category\` = 'honor',
    \`imageurl\` = '/badges/badge-honor-ceo.svg',
    \`criteria\` = '{"type":"manual"}'
WHERE LOWER(\`name\`) LIKE '%ceo%';

INSERT INTO \`awards\` (\`name\`, \`name_zh\`, \`description\`, \`description_zh\`, \`imageurl\`, \`category\`, \`criteria\`, \`featured\`)
VALUES
${sqlRows}
ON DUPLICATE KEY UPDATE
  \`name_zh\` = VALUES(\`name_zh\`),
  \`description\` = VALUES(\`description\`),
  \`description_zh\` = VALUES(\`description_zh\`),
  \`imageurl\` = VALUES(\`imageurl\`),
  \`category\` = VALUES(\`category\`),
  \`criteria\` = VALUES(\`criteria\`);
`;

fs.writeFileSync(
  path.join(__dirname, "../migrations/20261027_comprehensive_awards_and_criteria.sql"),
  sqlContent,
  "utf-8"
);
console.log("Successfully wrote migrations/20261027_comprehensive_awards_and_criteria.sql!");

// 3. Update preview fixtures in crew-preview.ts
const previewPilotStats = {
  totalHours: 66,
  totalFlights: 42,
  membershipDays: 950,
};

const AIRPORT_NAMES_ZH = {
  ZGGG: "广州白云",
  ZBAD: "北京大兴",
  ZGSZ: "深圳宝安",
  ZWWW: "乌鲁木齐地窝堡",
  ZUCK: "重庆江北",
  ZULS: "拉萨贡嘎",
  ZLXN: "西宁曹家堡",
  ZWSH: "喀什徕宁",
  VHHH: "香港赤腊角",
};

const evaluatedPreviewBadges = MASTER_BADGES.map((b) => {
  let isUnlocked = false;
  let dateAwarded = null;
  let progress = null;

  switch (b.criteria.type) {
    case "flights": {
      const target = b.criteria.threshold;
      isUnlocked = previewPilotStats.totalFlights >= target;
      if (isUnlocked) dateAwarded = "2024-05-10";
      progress = {
        current: previewPilotStats.totalFlights,
        target,
        percentage: Math.min(100, Math.round((previewPilotStats.totalFlights / target) * 100)),
        unit: "flights",
        label: `${previewPilotStats.totalFlights} / ${target} flights`,
        labelZh: `${previewPilotStats.totalFlights} / ${target} 架次`,
      };
      break;
    }
    case "hours": {
      const target = b.criteria.threshold;
      isUnlocked = previewPilotStats.totalHours >= target;
      if (isUnlocked) dateAwarded = "2024-06-15";
      progress = {
        current: previewPilotStats.totalHours,
        target,
        percentage: Math.min(100, Math.round((previewPilotStats.totalHours / target) * 100)),
        unit: "hours",
        label: `${previewPilotStats.totalHours} / ${target} hrs`,
        labelZh: `${previewPilotStats.totalHours} / ${target} 小时`,
      };
      break;
    }
    case "airport": {
      const target = b.criteria.count;
      let current = 0;
      if (b.criteria.icao === "ZGGG") current = 18;
      else if (b.criteria.icao === "ZBAD") current = 8;
      else if (b.criteria.icao === "ZGSZ") current = 3;
      else if (b.criteria.icao === "ZWWW") current = 2;
      else if (b.criteria.icao === "ZUCK") current = 4;
      else if (b.criteria.icao === "ZULS") current = 1;
      else if (b.criteria.icao === "ZLXN") current = 1;
      else if (b.criteria.icao === "ZWSH") current = 1;
      else if (b.criteria.icao === "VHHH") current = 5;

      isUnlocked = current >= target;
      if (isUnlocked) dateAwarded = "2024-08-20";
      const aptZh = AIRPORT_NAMES_ZH[b.criteria.icao] || b.criteria.icao;
      progress = {
        current,
        target,
        percentage: Math.min(100, Math.round((current / target) * 100)),
        unit: "flights",
        label: `${current} / ${target} flights at ${b.criteria.icao}`,
        labelZh: `${aptZh} ${current} / ${target} 次起降`,
      };
      break;
    }
    case "route": {
      const target = b.criteria.count;
      const current = 6;
      isUnlocked = current >= target;
      if (isUnlocked) dateAwarded = "2024-09-01";
      progress = {
        current,
        target,
        percentage: Math.min(100, Math.round((current / target) * 100)),
        unit: "flights",
        label: `${current} / ${target} sectors`,
        labelZh: `${current} / ${target} 个往返航段`,
      };
      break;
    }
    case "airports_multi": {
      const target = b.criteria.count;
      let current = 2;
      let regionZh = "区域航线";
      if (b.imageurl.includes("shanghai")) { current = 8; regionZh = "上海双场"; }
      if (b.imageurl.includes("chengdu")) { current = 10; regionZh = "成都双场"; }
      if (b.imageurl.includes("hainan")) { current = 6; regionZh = "海南海口/三亚"; }
      if (b.imageurl.includes("europe")) { current = 3; regionZh = "欧洲主要门户"; }
      if (b.imageurl.includes("northamerica")) { current = 4; regionZh = "北美枢纽航网"; }
      if (b.imageurl.includes("oceania")) { current = 5; regionZh = "大洋洲澳新线"; }
      if (b.imageurl.includes("mideast")) { current = 2; regionZh = "中东枢纽走廊"; }

      isUnlocked = current >= target;
      if (isUnlocked) dateAwarded = "2024-10-15";
      progress = {
        current,
        target,
        percentage: Math.min(100, Math.round((current / target) * 100)),
        unit: "flights",
        label: `${current} / ${target} sectors in region`,
        labelZh: `${regionZh} ${current} / ${target} 次起降`,
      };
      break;
    }
    case "aircraft": {
      const target = b.criteria.count;
      let current = 1;
      let planeZh = b.criteria.match;
      if (b.criteria.match.includes("A350")) { current = 2; planeZh = "A350-900"; }
      else if (b.criteria.match.includes("777-300ER")) { current = 5; planeZh = "B777-300ER"; }
      else if (b.criteria.match.includes("787")) { current = 1; planeZh = "B787 梦想客机"; }
      else if (b.criteria.match.includes("A330")) { current = 4; planeZh = "A330 系列"; }
      else if (b.criteria.match.includes("A32")) { current = 12; planeZh = "A320 家族"; }
      else if (b.criteria.match.includes("737")) { current = 15; planeZh = "B737 系列"; }
      else if (b.criteria.match.includes("Freighter")) { current = 2; planeZh = "南航货运重装"; }
      else if (b.criteria.match.includes("A380")) { current = 1; planeZh = "A380 巨无霸"; }
      else if (b.criteria.match.includes("747")) { current = 1; planeZh = "B747-400F 女王"; }
      else if (b.criteria.match.includes("757")) { current = 2; planeZh = "B757-200 经典铅笔机"; }
      else if (b.criteria.match.includes("E190")) { current = 3; planeZh = "E190 喷气支线"; }
      else if (b.criteria.match.includes("Xiamen")) { current = 3; planeZh = "厦门航空白鹭客机"; }

      isUnlocked = current >= target;
      if (isUnlocked) dateAwarded = "2024-11-05";
      progress = {
        current,
        target,
        percentage: Math.min(100, Math.round((current / target) * 100)),
        unit: "flights",
        label: `${current} / ${target} flights on ${b.criteria.match}`,
        labelZh: `${planeZh} ${current} / ${target} 架次`,
      };
      break;
    }
    case "single_duration_hours": {
      const target = b.criteria.threshold;
      const current = 8.5;
      isUnlocked = current >= target;
      progress = {
        current,
        target,
        percentage: Math.min(100, Math.round((current / target) * 100)),
        unit: "hours",
        label: `${current} / ${target} hrs single sector`,
        labelZh: `单次执飞 ${current} / ${target} 小时`,
      };
      break;
    }
    case "night_flights": {
      const target = b.criteria.count;
      const current = 4;
      isUnlocked = current >= target;
      if (isUnlocked) dateAwarded = "2024-11-12";
      progress = {
        current,
        target,
        percentage: Math.min(100, Math.round((current / target) * 100)),
        unit: "flights",
        label: `${current} / ${target} night flights`,
        labelZh: `${current} / ${target} 次夜间起落`,
      };
      break;
    }
    case "clean_streak": {
      const target = b.criteria.count;
      const current = 22;
      isUnlocked = current >= target;
      if (isUnlocked) dateAwarded = "2024-11-20";
      progress = {
        current,
        target,
        percentage: Math.min(100, Math.round((current / target) * 100)),
        unit: "flights",
        label: `${current} / ${target} clean flights`,
        labelZh: `${current} / ${target} 次连续无驳回`,
      };
      break;
    }
    case "membership_days": {
      const target = b.criteria.days;
      const current = previewPilotStats.membershipDays;
      isUnlocked = current >= target;
      if (isUnlocked) dateAwarded = "2024-03-01";
      progress = {
        current,
        target,
        percentage: Math.min(100, Math.round((current / target) * 100)),
        unit: "days",
        label: `${current} / ${target} days active`,
        labelZh: `入队满 ${current} / ${target} 天`,
      };
      break;
    }
    case "manual": {
      if (b.id === 1) {
        isUnlocked = true;
        dateAwarded = "2024-02-15";
      } else if (b.id === 2) {
        isUnlocked = true;
        dateAwarded = "2024-06-01";
      }
      progress = null;
      break;
    }
  }

  return {
    id: b.id,
    name: b.name,
    nameZh: b.nameZh,
    description: b.description,
    descriptionZh: b.descriptionZh,
    imageurl: b.imageurl,
    category: b.category,
    criteria: b.criteria,
    isUnlocked,
    dateAwarded,
    progress,
  };
});

const unlockedList = evaluatedPreviewBadges.filter((b) => b.isUnlocked);
const lockedList = evaluatedPreviewBadges.filter((b) => !b.isUnlocked);
const totalUnlocked = unlockedList.length;
const totalAvailable = evaluatedPreviewBadges.length;
const unlockPercentage = Math.round((totalUnlocked / totalAvailable) * 100);

const previewAwardsBlock = `  statistics: {
    totalFlightTime: "66:00",
    approvedPireps: 42,
    pendingPireps: 0,
    rejectedPireps: 1,
    recentRejectedPireps: 0,
    recentPirepWarningLimit: 3,
  },
  awards: {
    ownedAwardIds: [${unlockedList.map((b) => b.id).join(", ")}],
    received: ${JSON.stringify(
      unlockedList.map((b) => ({
        id: b.id,
        name: b.name,
        nameZh: b.nameZh,
        description: b.description,
        descriptionZh: b.descriptionZh,
        imageurl: b.imageurl,
        dateAwarded: b.dateAwarded,
      })),
      null,
      4
    )},
    overview: {
      totalUnlocked: ${totalUnlocked},
      totalAvailable: ${totalAvailable},
      unlockPercentage: ${unlockPercentage},
      badges: ${JSON.stringify(evaluatedPreviewBadges, null, 6)},
    },
  },`;

// Read crew-preview.ts and replace awards block
const previewPath = path.join(__dirname, "../src/lib/mock/crew-preview.ts");
let previewCode = fs.readFileSync(previewPath, "utf-8");

const awardsRegex = /(?:statistics:\s*\{[\s\S]*?\},\s*\n\s*)?awards:\s*\{[\s\S]*?\n\s*\}\s*,\s*\n\s*recentPireps:/;
if (awardsRegex.test(previewCode)) {
  previewCode = previewCode.replace(
    awardsRegex,
    `${previewAwardsBlock}\n  recentPireps:`
  );
  fs.writeFileSync(previewPath, previewCode, "utf-8");
  console.log("Successfully updated crew-preview.ts with all 102 badges (Bilingual)! ");
} else {
  console.error("Could not find awards block in crew-preview.ts");
}
