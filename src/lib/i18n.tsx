"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Globe } from "lucide-react";

export type Locale = "en" | "zh";

export const LOCALE_STORAGE_KEY = "czvg:locale";

/**
 * Detects the preferred locale from saved storage or browser `navigator.languages` / `navigator.language`.
 */
export function detectPreferredLocale(
  browserLanguages?: readonly string[] | string | null,
  savedLocale?: string | null,
): Locale {
  if (savedLocale === "zh" || savedLocale === "en") {
    return savedLocale;
  }

  const candidates: string[] = [];
  if (Array.isArray(browserLanguages)) {
    candidates.push(...browserLanguages);
  } else if (typeof browserLanguages === "string" && browserLanguages) {
    candidates.push(browserLanguages);
  } else if (typeof window !== "undefined" && typeof navigator !== "undefined") {
    // Keep unit tests deterministic in English unless explicitly testing locale detection/storage
    const isAutomatedTest =
      typeof process !== "undefined" &&
      (Boolean(process.env.VITEST) || process.env.NODE_ENV === "test");
    if (isAutomatedTest) {
      return "en";
    }
    if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
      candidates.push(...navigator.languages);
    } else if (navigator.language) {
      candidates.push(navigator.language);
    }
  }

  for (const lang of candidates) {
    const normalized = String(lang || "").trim().toLowerCase();
    if (!normalized) continue;
    if (normalized.startsWith("zh")) return "zh";
    if (normalized.startsWith("en")) return "en";
  }

  return "en";
}

/**
 * Comprehensive phrase dictionary (English -> Simplified Chinese) using authentic
 * Chinese civil aviation & China Southern Airlines (中国南方航空) operational terminology.
 */
export const EN_TO_ZH_PHRASES: Record<string, string> = {
  // ============================================================================
  // 1. Navigation, Layout & Global Actions
  // ============================================================================
  Home: "首页",
  "About Us": "关于南航",
  About: "关于南航",
  Operations: "运行中心",
  Hubs: "基地枢纽",
  Fleet: "机队规模",
  Ranks: "飞行员职级",
  Routes: "航线网络",
  "Join Us": "加入我们",
  "Pilot Portal": "飞行员门户",
  "Crew Center": "机组中心",
  "Applicant Portal": "招飞中心",
  "Log Out": "退出登录",
  "Logging out...": "正在退出...",
  "Sign out": "退出登录",
  Menu: "导航菜单",
  Dashboard: "飞行员工作台",
  "File PIREP": "申报飞行报告",
  "Submit PIREP": "提交飞行报告",
  "Submitting...": "正在提交...",
  PIREPs: "飞行报告",
  "Find Routes": "航线查询",
  "Live Scheduling": "实时机队排班",
  "Staff Console": "运控管理后台",
  "Admin Dashboard": "运行统计总览",
  "Manage PIREPs": "审批飞行报告",
  "Manage Multipliers": "管理积分倍率",
  "Manage Routes": "管理航线库",
  "Manage Users": "管理飞行员与招飞",
  "Manage Aircrafts": "管理机队与机型",
  "Manage Ranks": "管理技术职级",
  "Manage Live Scheduling": "管理实时排班",
  "Manage Awards": "管理荣誉勋章",
  "Pilot Awards": "颁发飞行勋章",
  "Manage Permissions": "管理后台权限",
  "Back to Public Website": "返回门户官网",
  "Collapse sidebar": "收起侧边导航",
  "Expand sidebar": "展开侧边导航",
  "Toggle menu": "切换菜单",
  Close: "关闭",
  Cancel: "取消",
  Confirm: "确认",
  Back: "返回",
  Save: "保存",
  "Save changes": "保存更改",
  "Save Changes": "保存更改",
  "Saving...": "正在保存...",
  Edit: "编辑",
  Delete: "删除",
  "Deleting...": "正在删除...",
  Remove: "移除",
  "Removing...": "正在移除...",
  Add: "新增",
  Create: "创建",
  "Creating...": "正在创建...",
  Update: "更新",
  "Updating...": "正在更新...",
  Search: "搜索",
  Filter: "筛选",
  Reset: "重置",
  Clear: "清空",
  Refresh: "刷新",
  "Refreshing...": "正在刷新...",
  "Try again": "重试",
  Previous: "上一页",
  Next: "下一页",
  Actions: "操作",
  Status: "状态",
  Details: "详情",
  Notes: "备注",
  None: "无",
  Unknown: "未知",
  Unavailable: "不可用",
  Active: "在飞 / 启用",
  Inactive: "停场 / 停用",
  Optional: "选填",
  "(optional)": "（选填）",
  Required: "必填",
  Yes: "是",
  No: "否",

  // ============================================================================
  // 2. Pilot Ranks, Airlines & Civil Aviation Terminology
  // ============================================================================
  "Trainee Second Officer": "见习二副",
  "Second Officer": "二副驾驶",
  "First Officer": "第一副驾驶",
  "SR First Officer": "资深副驾驶",
  Captain: "责任机长",
  "SR Captain": "资深机长",
  "Fleet Captain": "机队总机长",
  "China Southern Airlines": "中国南方航空",
  "China Southern Cargo": "中国南方航空货运",
  "China Southern General Aviation": "中国南航通用航空",
  "China Southern": "中国南方航空",
  "Xiamen Airlines": "厦门航空",
  "Chongqing Airlines": "重庆航空",
  "Shantou Airlines": "汕头航空",
  "Guizhou Airlines": "贵州航空",
  "Zhuhai Airlines": "珠海航空",
  "Hebei Airlines": "河北航空",
  "Jiangxi Airlines": "江西航空",
  "Sichuan Airlines": "四川航空",

  // ============================================================================
  // 3. Public Website (Home, About Us, Operations, Fleet, Hubs, Ranks, Routes, Footer)
  // ============================================================================
  "IFVARB Approved Virtual Airline": "IFVARB 官方认证虚拟航空公司",
  "China Southern Virtual Group": "虚拟中国南方航空集团",
  "With hub airports across China and routes reaching around the world, CZVG brings the scale of China Southern Group to Infinite Flight.":
    "依托遍布全国的核心基地枢纽与通达全球的航线网络，CZVG 在 Infinite Flight 平台为您呈现中国南方航空集团的恢弘运行规模。",
  "Apply Now": "立即申请招飞",
  "Learn More": "了解南航虚航",
  "Destinations around the world": "全球通航目的地",
  "Routes to fly": "执飞计划航线",
  "Airlines in Operation": "运营成员航司",
  "Certified VA": "IFVARB 认证虚航",
  "Why fly with CZVG?": "为什么选择加入虚拟南航？",
  "Built for pilots who value realistic routes, a diverse fleet, and a welcoming community.":
    "专为追求真实航线签派、多元化机队执飞体验与专业飞行员社区氛围的飞友打造。",
  "Route-rich flying": "纵横全球的航线网络",
  "Fly domestic trunk routes, regional hops, and intercontinental flagships from major Chinese hubs.":
    "从中国核心门户枢纽出发，执飞国内精品快线、区域支线及洲际远程旗舰航线。",
  "Explore routes": "浏览航线网络",
  "Diverse fleet": "全谱系现代化机队",
  "Progress from regional jets and narrowbodies to long-haul widebodies and dedicated freighters.":
    "从支线客机、主流窄体机逐步晋升改装至远程宽体旗舰客机与全货机机队。",
  "View fleet": "查看机队阵容",
  "Pilot community": "专业机组与联飞社区",
  "Join group flights, earn ranks and awards, and fly alongside pilots from around the world.":
    "参与官方编队联飞活动、考取技术职级与荣誉勋章，与全球飞友并肩翱翔。",
  "Apply now": "立即报名加入",
  "Featured network": "精选干线网络",
  "Sample routes across the group": "集团精品示范航线",
  "View Hubs": "查看基地枢纽",
  "Browse Routes": "查询全部航线",
  "Featured Route": "精选示范航线",
  "Flight Number": "航班号",
  Departure: "起飞机场",
  Arrival: "到达机场",
  Duration: "计划航程",
  "Previous route": "上一条航线",
  "Next route": "下一条航线",
  "Live map": "实时空管雷达",
  "Track CZVG flights across the network.": "实时追踪虚拟南航在全球航线网络中的在线执飞航班。",
  "CEO message": "管理团队寄语",
  "Welcome aboard CZVG.": "欢迎登机，加入虚拟南航 CZVG。",
  "Welcome to China Southern Virtual Group! Whether you're here for short domestic hops or long-haul transcontinental flights, our goal is to make every flight feel purposeful, welcoming, and rewarding.":
    "欢迎来到虚拟中国南方航空集团！无论您钟情于国内城际精品短途，还是跨越洲际的远程重航段，我们都致力于让每一次航班签派都充满真实感、归属感与成就感。",
  "Chief Executive Officer, China Southern Virtual Group": "虚拟中国南方航空集团 首席执行官 (CEO)",
  "Ready to take flight?": "准备好开启您的蓝天之旅了吗？",
  "Start your application today and join our crew on the Infinite Flight Expert Server.":
    "立即提交招飞申请，与我们的机组同仁在 Infinite Flight 专家服并肩执飞。",
  "A community virtual airline for Infinite Flight pilots, inspired by the routes and liveries of the China Southern Group.":
    "面向 Infinite Flight 飞行员打造的高拟真虚拟航空公司社区，全面还原中国南方航空集团航线网络与机队涂装。",
  Community: "社区与平台",
  Explore: "门户导航",
  Legal: "法律与条款",
  "Privacy Policy": "隐私政策",
  "Terms of Service": "服务条款",
  "All rights reserved. Not affiliated with real-world China Southern Airlines Group or Infinite Flight.":
    "保留所有权利。本组织为模拟飞行爱好者社区，与现实中的中国南方航空集团及 Infinite Flight 官方无隶属关系。",

  // About Us Page
  "About CZVG": "关于虚拟南航",
  "Connecting the world with Canton hospitality in Infinite Flight.":
    "以木棉温情连接世界，在 Infinite Flight 蓝天之上传递南航精神。",
  "Founded by passionate virtual aviators, China Southern Virtual Group brings the domestic depth and global reach of China's largest airline group to the Infinite Flight community.":
    "由热爱民航模拟飞行的资深飞友创立，虚拟中国南方航空集团将中国机队规模最大航空集团的国内纵深网络与全球通航版图带入 Infinite Flight 社区。",
  "Our Story": "发展历程",
  "Built for realistic, accessible virtual airline operations.":
    "致力于打造兼具高拟真签派规范与友好包容氛围的虚拟航司运行体系。",
  "China Southern Virtual Group (CZVG) represents the routes, hubs, and liveries of China Southern Airlines and its group carriers inside Infinite Flight. From high-frequency Pearl River Delta shuttles to ultra-long-haul intercontinental sectors, our crew center gives pilots a structured yet flexible way to log flights and progress through ranks.":
    "虚拟中国南方航空集团 (CZVG) 在 Infinite Flight 中完整呈现中国南方航空及旗下成员航司的航线、枢纽与涂装。从高密度的珠三角“南航快线”到超远程洲际重航线，我们的机组中心为飞行员提供规范而灵活的飞行报告记录与技术职级晋升通道。",
  "Group Carriers": "集团成员航司",
  "Airlines under the CZVG umbrella": "虚拟南航集团旗下运营航司",
  "Leadership Team": "管理与运控团队",
  "The staff keeping CZVG flying": "保障虚拟南航安全顺畅运行的管理团队",
  "Chief Executive Officer": "首席执行官 (CEO)",
  "Chief Operations Officer": "首席运行官 (COO)",
  "Vice President": "副总裁 (VP)",
  "Director of Operations": "运行总监",
  "Human Resources Director": "招飞与人力资源总监",
  "Public Relations Director": "公关与品牌总监",
  "Event Manager": "联飞活动经理",
  "Route Manager": "航线网络规划经理",

  // Operations Overview, Hubs, Fleet, Ranks, Routes
  "Network, fleet, and progression": "航线网络、机队阵容与职级晋升",
  "Explore how CZVG operates across domestic hubs, international gateways, aircraft types, and pilot ranks.":
    "全面了解虚拟南航的基地枢纽布局、国际门户走廊、授权执飞机队及飞行员技术职级体系。",
  "Hub airports": "基地枢纽机场",
  "Primary bases and focus cities across China for China Southern and group airlines.":
    "中国南方航空及集团成员航司遍布全国的双核心主基地与重点区域基地。",
  "Explore hubs": "查看基地枢纽",
  "Aircraft fleet": "机队规模与机型",
  "Regional jets, narrowbodies, widebodies, and cargo aircraft mapped to pilot ranks.":
    "涵盖支线客机、干线窄体机、洲际宽体旗舰及全货机，并与飞行员技术职级挂钩。",
  "Explore fleet": "查看机队详情",
  "Pilot ranks": "飞行员技术职级",
  "Clear hour milestones and shoulder-board insignia from Trainee Second Officer to Fleet Captain.":
    "从见习二副到机队总机长的清晰飞行小时晋升阶梯与肩章标识。",
  "Explore ranks": "查看职级体系",
  "Route database": "航线网络数据库",
  "Searchable timetable of domestic, regional, and intercontinental passenger and cargo routes.":
    "支持多维度检索的国内干支线、港澳台地区航线及洲际客货运航班时刻表。",
  "Group Hubs": "集团基地枢纽",
  "Airports anchoring the CZVG network": "支撑虚拟南航全球航线网络的核心基地群",
  "From our primary twin hubs in Guangzhou (ZGGG) and Beijing Daxing (ZBAD) to regional bases across China, explore the airports where our group airlines operate.":
    "从广州白云 (ZGGG)、北京大兴 (ZBAD) 南北双核心主枢纽，到遍布全国的区域基地，探索集团各成员航司的运行大本营。",
  "Airline Hubs": "各成员航司基地",
  "Primary & regional operating bases": "核心主基地与区域运行基地",
  "Interactive Hub Map": "互动基地分布图",
  "CZVG Fleet": "虚拟南航机队",
  "Aircraft and liveries in service": "在役执飞机型与航司涂装",
  "Our fleet spans regional jets, single-aisle workhorses, flagship widebodies, and dedicated freighters across China Southern and its subsidiary airlines.":
    "我们的机队涵盖支线客机、干线主力窄体机、洲际宽体旗舰客机以及专业全货机，全面覆盖中国南方航空及各控股成员航司涂装。",
  "Failed to load fleet data": "加载机队数据失败",
  "No aircraft are currently listed.": "当前暂无在册机型。",
  "Minimum Rank": "最低准入职级",
  "Special Award": "专属资质勋章",
  "Entry Level": "初始准入机型",
  "Award Required": "需特定资质勋章",
  "Pilot Ranks": "飞行员技术职级",
  "Progression from Trainee Second Officer to Fleet Captain": "从见习二副到机队总机长的职业晋升之路",
  "Every approved PIREP adds to your credited flight hours, unlocking higher ranks and additional aircraft across the CZVG fleet.":
    "每一份经签派审核批准的飞行报告 (PIREP) 都将计入您的有效飞行经历时间，逐步晋升技术职级并解锁更高规格的机队机型。",
  "Failed to load ranks": "加载职级数据失败",
  "No ranks are currently configured.": "当前暂未配置职级数据。",
  "Requirement": "晋升经历要求",
  "Unlocked Aircraft": "本级解锁机型",
  "All previous rank aircraft remain unlocked": "保留所有低职级已解锁机型的执飞资质",
  "Route Network": "全球航线网络",
  "Scheduled passenger and cargo sectors": "计划客运与全货机航班航段",
  "Browse our route timetable or sign in to the Crew Center for advanced filtering, aircraft eligibility checks, and one-click PIREP filing.":
    "浏览集团航班时刻表，或登录机组中心使用高级筛选、机型资质校验及一键提交飞行报告。",
  "Search flight number, departure, arrival, or notes...": "搜索航班号、起飞机场、到达机场或航线备注...",
  "Loading routes...": "正在加载航线网络...",
  "No matching routes found.": "未找到匹配的计划航线。",
  "Aircraft Types": "配属执飞机型",
  "Route Spreadsheet": "完整航线时刻表",
  "Full embedded timetable": "内嵌完整航班计划表",

  // ============================================================================
  // 4. Auth, Login, Signup, Forgot Password & Applicant Portal
  // ============================================================================
  "Welcome Back": "欢迎归队",
  "Sign in to access your dashboard": "登录以进入您的飞行员机组中心",
  "Apply today to be a part of CZVG!": "立即申请招飞，加入虚拟南航大家庭！",
  "Sign Up": "申请加入",
  "Join CZVG Today!": "立即申请加入虚拟南航！",
  "Fill in the application form to get started": "填写以下招飞申请表以开启入职流程",
  "Application requirements": "飞行员招飞准入条件",
  "Active Infinite Flight Pro subscription": "拥有有效期的 Infinite Flight Pro 订阅会员",
  "Infinite Flight Community (IFC) account linked to Infinite Flight":
    "拥有已绑定 Infinite Flight 游戏账号的 IFC 社区账号",
  "Minimum Grade 3 in Infinite Flight with good standing":
    "Infinite Flight 等级达到 Grade 3 及以上，且飞行记录良好",
  "Not on the IFVARB blacklist or watchlist": "未列入 IFVARB 违规黑名单或观察名单",
  "At least 13 years of age and able to join our Discord server":
    "年满 13 周岁，且能够加入我们的 Discord 机组服务器",
  "Commit to logging at least one flight every 30 days":
    "承诺每 30 天至少执飞并提交一次有效航班报告",
  "Already have an account?": "已有飞行员账号？",
  "Sign in": "前往登录",
  "Sign In": "登录机组中心",
  "Logging in...": "正在验证登录...",
  "Email Address": "电子邮箱",
  "Email address": "电子邮箱",
  Email: "电子邮箱",
  Password: "登录密码",
  "Forgot password?": "忘记密码？",
  "Preferred Name (First & Last)": "常用姓名（如：Zhang San / 张三）",
  "Infinite Flight Community Username": "IFC 社区用户名 (Username)",
  "Case-sensitive username without the @ symbol": "区分大小写的 IFC 用户名（无需填写 @ 符号）",
  "Confirm Password": "确认登录密码",
  "At least 8 characters": "密码长度不少于 8 位",
  "I confirm that I meet the application requirements and agree to the Terms of Service and Privacy Policy.":
    "我确认本人符合上述招飞准入要求，并同意遵守《服务条款》与《隐私政策》。",
  "Submit Application": "提交招飞申请",
  "Submitting application...": "正在提交招飞申请...",
  "Reset Password": "重置登录密码",
  "Enter your pilot email to receive a one-time reset code.":
    "输入您的飞行员注册邮箱以获取一次性密码重置验证码。",
  "Send Reset Code": "发送验证码",
  "Sending...": "正在发送...",
  "Verify Reset Code": "验证安全代码",
  "Enter the 6-digit code sent to your email.": "请输入发送至您邮箱的 6 位数字验证码。",
  "Verification Code": "6 位验证码",
  "Verify Code": "核验验证码",
  "Verifying...": "正在核验...",
  "Set New Password": "设置新登录密码",
  "New Password": "新登录密码",
  "Confirm New Password": "确认新密码",
  "Update Password": "更新密码",
  "Back to Sign In": "返回登录页",

  // Applicant Portal (`src/app/crew/application/page.tsx` & `src/lib/applicant-portal.ts`)
  "Loading application status…": "正在加载招飞审核状态…",
  "Application Rejected": "招飞申请未通过",
  "Your application has been rejected": "您的招飞申请未获批准",
  "Your application to join CZVG was not approved. If you believe this was a mistake or would like more information, contact CZVG through our IFC account.":
    "很抱歉，您加入虚拟南航 (CZVG) 的申请未获通过。如您认为存在误判或希望了解具体原因，请通过 IFC 社区官方账号联系我们。",
  "Account Inactive": "飞行员账号已停用",
  "Your pilot account is inactive": "您的飞行员账号当前处于停用状态",
  "Your CZVG pilot account is currently inactive. To request reactivation or get assistance, contact CZVG through our IFC account.":
    "您的虚拟南航飞行员账号目前已停用。如需申请复飞激活或获取帮助，请通过 IFC 社区官方账号联系管理团队。",
  "Contact CZVG's IFC Account": "联系虚拟南航 IFC 官方账号",
  "Pilot Onboarding": "新飞行员入职引导",
  "Complete the steps below to activate your CZVG Crew Center account.":
    "请按顺序完成以下考核与核验步骤，以激活您的虚拟南航机组中心权限。",
  "Assigned Callsign": "配发呼号",
  "Application Status": "申请状态",
  "In Review": "审核进行中",
  "Step 1: Written Examination": "第一步：理论笔试考核",
  "Open the entrance examination form, complete all questions using your assigned callsign, and confirm completion here.":
    "打开招飞理论考试问卷，使用系统为您配发的呼号完成所有题目，并在下方确认交卷。",
  "Open Examination Form": "打开理论考试试卷",
  "I Have Completed the Exam": "我已完成理论考试交卷",
  "Confirming...": "正在确认...",
  "Exam marked as completed. Waiting for staff to grade your submission.":
    "已登记完成交卷，请等待教员批改并录入您的理论成绩。",
  "Step 2: Flight Assessment Replay": "第二步：航线飞行评估回放",
  "Because your written exam score was below 80, please submit a ShareMyInfiniteFlight replay link for staff review.":
    "由于您的理论笔试成绩未达 80 分免飞线，请提交一段 ShareMyInfiniteFlight 飞行回放链接供教员评估。",
  "No additional flight replay is required for your exam score.":
    "您的理论笔试成绩优异，无需加试航线飞行评估回放。",
  "Replay URL": "飞行回放链接 (ShareMyInfiniteFlight)",
  "Submit Replay": "提交回放链接",
  "Step 3: Join the Discord Server": "第三步：加入 Discord 机组服务器",
  "Once staff issue your personal invite link, join our Discord server to complete onboarding.":
    "待人事教员为您签发专属邀请链接后，请加入我们的 Discord 服务器完成入职报到。",
  "Join CZVG Discord": "加入虚拟南航 Discord",
  "Waiting for staff to issue your Discord invite link.":
    "正在等待管理团队为您生成专属 Discord 邀请链接。",
  "Application Summary": "申请人档案摘要",
  "Applicant Name": "申请人姓名",
  "IFC Username": "IFC 社区用户名",
  "Exam Score": "理论笔试成绩",
  "Not graded yet": "待批改",
  "Staff Notes": "教员审核备注",

  // ============================================================================
  // 5. Crew Center (Home Dashboard, File PIREP, View PIREPs, Find Routes, Route Detail)
  // ============================================================================
  "Loading pilot workspace…": "正在加载飞行员工作台…",
  "Top rank achieved": "已达最高技术职级",
  "Maximum pilot rank achieved": "已荣升至最高飞行员技术职级",
  "Review PIREPs": "飞行报告记录",
  "Total flight time": "累计飞行经历时间",
  "Approved PIREPs": "已批准飞行报告",
  "Pending PIREPs": "待审核飞行报告",
  "Pilot rank": "当前技术职级",
  "Flights & analytics": "近期航班与统计分析",
  "Awards & rank": "荣誉勋章与职级体系",
  "Recent Flight Time": "近期飞行时长趋势",
  "Most Flown Aircraft": "最常执飞机型统计",
  "All PIREPs →": "查看全部报告 →",
  "All aircraft": "全部执飞机型",
  "All statuses": "全部审批状态",
  Approved: "已批准",
  "Awaiting approval": "待审核",
  "Awaiting review": "待复核",
  Pending: "待审核",
  Rejected: "已驳回",
  "No flights to show": "暂无匹配的航班记录",
  "Try another filter, or file a new PIREP.": "请尝试调整筛选条件，或申报一份新的飞行报告。",
  "Click to file again": "点击再次执飞此航段",
  "Pilot Commendation": "飞行员荣誉勋章",
  "Earned Awards": "已获荣誉勋章",
  "No awards granted yet.": "暂未获得荣誉勋章。",
  "Rank Progression Ladder": "飞行员技术职级晋升阶梯",
  Current: "当前职级",
  Achieved: "已达成",

  // File PIREP Page
  "Submit a flight report manually or import active telemetry from Infinite Flight ACARS.":
    "手动填报飞行报告，或通过 Infinite Flight ACARS 一键导入实时航班遥测数据。",
  "Import ACARS": "导入 ACARS 数据",
  "Loading aircraft": "正在加载机队",
  "Aircraft unavailable": "暂无可用机型",
  "Selected sector": "当前执飞航段",
  "Not set": "未填写",
  "Block time": "轮挡时间",
  "Unlocked fleet": "已解锁机队",
  "ACARS linked": "ACARS 已同步",
  "Select an unlocked aircraft below": "请在下方选择您的职级已解锁的执飞机型",
  "Sector & Telemetry": "航段信息与运行数据",
  "Flight Number (Not Callsign)": "航班号（非呼号）",
  "Flight Number (Not Your Callsign)": "航班号（非呼号）",
  "Flight Date": "执飞日期",
  "Pick a date": "选择执飞日期",
  "Departure ICAO": "起飞机场 (ICAO)",
  "Arrival ICAO": "到达机场 (ICAO)",
  "Flight Time (HH:MM)": "轮挡时间 (HH:MM)",
  "Flight Time": "飞行时长",
  "Fuel Used (KG)": "消耗燃油量 (KG)",
  "Aircraft & Dispatch Remarks": "执飞机型与签派备注",
  Aircraft: "执飞机型",
  "Select aircraft..": "请选择执飞机型...",
  "Select an aircraft": "请选择执飞机型",
  "Filter aircraft fleet...": "搜索机型名称或涂装...",
  "No aircraft are available for your rank or awards.": "当前职级暂无可用机型。",
  "Multiplier Code (Optional)": "活动倍率代码（选填）",
  "Multiplier Code(if available)": "倍率代码（如有）",
  "Notes (Optional)": "签派与机组备注（选填）",
  "Add any details for the PIREP review team...": "补充说明航班情况...",
  "Your notes will be posted as the first comment on this PIREP.":
    "备注将作为该报告的第一条留言。",
  "All flight times are recorded in hours:minutes format.":
    "飞行时间均按 HH:MM 格式记录。",
  "ACARS Import": "ACARS 实时航班导入",
  "Importing flight data...": "正在从 Infinite Flight 获取实时航班数据...",

  // View PIREPs Page
  "Pilot Reports": "飞行报告档案",
  "Review your submitted flight reports, approval status, and staff comments.":
    "查阅您提交的历次飞行报告、签派审批状态及审核教员评语。",
  "Total submitted": "累计申报份数",
  "Approved on page": "本页已获批",
  "Search flight, departure, arrival, or aircraft": "搜索航班、机场或机型",
  "5 per page": "每页 5 条",
  "10 per page": "每页 10 条",
  "20 per page": "每页 20 条",
  "50 per page": "每页 50 条",
  "Loading PIREPs…": "正在加载飞行报告档案…",
  "No PIREPs to show": "暂无匹配的飞行报告",
  "Try another filter, or file a new pilot report.": "请尝试切换筛选条件，或提交一份新的飞行报告。",
  "Click to inspect & comment": "查看详情与留言",
  "Flight number": "航班号",
  Date: "执飞日期",
  "Block duration": "轮挡时间",
  "Fuel used": "消耗燃油",
  Multiplier: "积分倍率",
  Comments: "审核评语与留言",
  "Loading comments…": "正在加载留言记录…",
  "No comments yet.": "暂无审核留言。",
  "Add a comment": "添加补充留言",
  "Write a reply or note for this PIREP...": "填写回复或补充说明...",
  "Post comment": "发送留言",
  "Posting…": "正在发送…",

  // Find Routes & Route Details Page
  "Search scheduled flights across the China Southern Virtual Group network.":
    "检索查询虚拟中国南方航空集团全球航线网络中的计划航班。",
  "Save filter": "保存常用筛选",
  "Saved filters": "已保存的筛选方案",
  "Filter name": "筛选方案名称",
  "Matching routes": "匹配航线总数",
  "Eligible routes": "具备资质航线",
  "Unlocked aircraft": "已解锁执飞机型",
  "Search flight number, airport, aircraft, or notes": "搜索航班、机场、机型或备注",
  "Departure ICAO (e.g. ZGGG)": "起飞机场四字码（如 ZGGG）",
  "Arrival ICAO (e.g. ZBAD)": "到达机场四字码（如 ZBAD）",
  "Any duration": "不限计划航程",
  "Under 1h": "1 小时以内",
  "Show only routes with unlocked aircraft": "仅显示已解锁机型航线",
  "Loading routes…": "正在加载航线数据库…",
  "No routes to show": "未找到符合条件的计划航线",
  "Try another filter or clear the search criteria.": "请尝试调整筛选条件或清空搜索关键词。",
  Eligible: "具备执飞资质",
  Locked: "职级未解锁",
  Unlocked: "已解锁",
  "No aircraft assigned": "暂未配属机型",
  "Direct scheduled sector": "直飞计划航段",
  "Standard dispatch": "标准签派放行",
  "Scheduled duration": "计划航程时间",
  "Recent dispatches": "近期执飞架次",
  "Departure airport": "始发机场",
  "Arrival airport": "目的机场",
  "Destination airport": "目的机场",
  "Assigned Aircraft": "航线配属机型",
  "Recent Flights": "近期执飞记录",
  "Latest pilot reports filed on this route": "飞行员在此航线上最新提交的飞行报告",
  "No recent flights logged on this route.": "该航线近期暂无飞行报告记录。",
  "File PIREP for this route": "执飞并申报此航线",

  // ============================================================================
  // 6. Live Aircraft Scheduling (`src/components/scheduling/*`)
  // ============================================================================
  "Live aircraft scheduling": "实时机队排班中心",
  "Manage live scheduling": "管理实时机队排班",
  "Review flight requests, manage the live fleet, and connect Infinite Flight.":
    "审批实时排班航班申请、调配持续运营机队，并管理 Infinite Flight 平台同步连接。",
  "Plan your next flight from the aircraft’s location or join an approved crew.":
    "根据飞机当前停场机场申请下一航段排班，或申请加入已获批航班的联合机组。",
  "Plan your next flight from the aircraft's location or join an approved crew.":
    "根据飞机当前停场机场申请下一航段排班，或申请加入已获批航班的联合机组。",
  "Request flight": "申请航班排班",
  "Request a flight": "申请实时排班航班",
  "Edit flight request": "修改航班排班申请",
  "Amend flight": "签派变更航班计划",
  "Refresh scheduling": "刷新排班数据",
  "Loading live scheduling…": "正在加载实时机队排班数据…",
  "Scheduling is unavailable": "实时机队排班暂不可用",
  "Your account needs access to live scheduling.": "需获得实时运行准入勋章后方可使用。",
  "The live pilot access award has not been configured. Set the live pilot award before approving pilots for flights.":
    "尚未配置实时运行准入勋章，请先配置后再审批。",
  "Live aircraft": "在役实时运力",
  "Flights awaiting review": "待审批排班申请",
  "Your pending flights": "我的待审航班",
  "Crew requests": "联合机组申请",
  "Flights with crew space": "可加入联飞航班",
  Approvals: "排班审批队列",
  Flights: "全部排班航班",
  "My flights": "我的排班航班",
  "Live fleet": "实时运力机队",
  "Infinite Flight": "Infinite Flight 同步",
  "Search route, callsign, aircraft, or captain": "搜索航段、呼号、注册号或责任机长...",
  "Upcoming and in flight": "待执飞与空中航班",
  "All flights": "全部航班",
  History: "历史归档记录",
  "In flight": "空中执飞中",
  Completed: "已完航",
  Cancelled: "已取消",
  "Needs review": "需签派复核",
  "All times are UTC. Each flight has one captain and up to two additional crew members.":
    "所有时刻均为世界协调时 (UTC)。每个排班航班设责任机长 1 名，并可接纳最多 2 名副驾驶/增强机组成员。",
  "Oldest flight requests first. Check conflicts before approving.":
    "按申请提交先后顺序排列。批准前请核查飞机接续位置与时刻冲突。",
  "Unscheduled aircraft": "当前待命可用运力",
  "These active aircraft have no pending requests, approved flights, or flights in progress in Crew Center. Request a flight from their confirmed airport.":
    "以下在役飞机当前在机组中心无待审申请、无已批排班且未在执飞中。您可直接从其当前确认停场机场申请执飞。",
  "Persistent live aircraft": "持续运营机队 (Persistent Fleet)",
  "Confirmed airports change on arrival or admin correction.":
    "飞机确认停场位置将在航班完航落地或签派员人工校准后自动更新。",
  "Confirmed airports change on arrival or admin correction. Request IF positions using Refresh IF locations.":
    "飞机确认停场位置将在航班完航落地或签派员修正后更新。点击“刷新 IF 位置”可查询服务器实时位置。",
  "Refresh IF locations": "刷新 IF 实时位置",
  "Add aircraft": "新增运力飞机",
  "No live aircraft yet": "暂无实时运力飞机",
  "Add an aircraft with its registration, type, and last known airport.":
    "请添加一架带有机身注册号、机型涂装及当前停场机场的实时运力飞机。",
  "An admin can add aircraft to the live fleet.": "运控管理员可将飞机加入实时排班机队。",
  "Confirmed airport": "确认停场机场",
  "After approved flights": "后续计划落点",
  "Linked to Infinite Flight": "已关联 Infinite Flight 机队",
  "Manual scheduling": "本地人工排班模式",
  "No scheduled flights": "当前无排班计划",
  "View schedules": "查看航班排班表",
  "IF positions refresh only when requested. A parked aircraft may have an older report. Nearby airports are estimates from IF’s 3D airport list; confirm the actual airport before changing it.":
    "IF 飞机位置仅在手动请求时刷新。停场飞机可能显示较早的报告。邻近机场系根据 IF 3D 机场坐标估算，修改前请核实实际停场机场。",
  "Try another filter, or request a flight for an available aircraft.":
    "请尝试切换筛选条件，或选择一架待命可用飞机申请航班排班。",
  "Captain unavailable": "暂无责任机长",
  "Pilot unavailable": "飞行员信息不可用",
  "Time not specified": "未指定计划时刻",
  "Time unavailable": "时刻不可用",
  "Time not recorded": "未记录时间",
  "Planned times not specified": "未设定计划起降时刻",
  "Departure time not specified": "未设定起飞时刻",
  "Arrival time not specified": "未设定到达时刻",
  "IF publishing pending": "待同步至 IF",
  "Publishing to IF": "正在同步至 IF",
  "Published to IF": "已同步至 IF",
  "IF publishing failed": "IF 同步失败",
  "IF schedule conflict": "IF 排班冲突",
  "IF publishing unavailable": "IF 同步未启用",
  "IF reconciliation needed": "需与 IF 校准同步",
  "IF crew update incomplete": "IF 机组名单部分同步",
  "Local schedule": "本地排班计划",
  Scheduled: "已排班",
  Boarding: "正在登机",
  Boarded: "登机完毕",
  "Taxiing to runway": "滑行至跑道",
  Diverted: "已备降",
  Delayed: "航班延误",
  "Taxiing to parking": "滑行至机位",
  Arrived: "已到达停靠",
  "Unknown IF status": "未知 IF 状态",
  "Unknown state": "未知状态",
  "On the ground": "地面停场",
  Airborne: "空中飞行",
  Stopped: "已停机",
  Maintenance: "机务定检维护",

  // Flight Types
  Commercial: "商业正班",
  Freight: "全货机航班",
  Ferry: "调机航班",
  Charter: "包机航班",
  Training: "训练熟练飞行",
  "Test flight": "试飞航班",
  "Medical emergency": "航空医疗急救",
  Military: "特殊保障任务",
  "VIP / Executive": "要客专机 / 公务机",
  "Humanitarian relief": "人道主义救援",
  "General aviation": "通用航空飞行",
  Airshow: "飞行表演展示",
  Other: "其他任务性质",
  "Not specified": "未指定性质",

  // Flight Detail & Dialogs
  "Flight type": "航班任务性质",
  Requested: "申请提交时间",
  "Scheduled departure": "计划撤轮挡 (UTC)",
  "Scheduled arrival": "计划上轮挡 (UTC)",
  "Aircraft confirmed airport": "飞机当前确认停场",
  Scheduling: "同步状态",
  "Actual arrival airport": "实际落地机场",
  "Flight notes": "签派与航班备注",
  "Review note": "签派审批意见",
  "This flight needs attention": "此航班需要注意",
  "The latest schedule is not published to IF. An admin has enabled local starts without IF publication or departure checks.":
    "最新排班计划尚未发布至 IF。管理员已启用“免 IF 同步本地放行”策略。",
  "The latest schedule must be published to IF before departure.":
    "起飞放行前必须先将最新排班计划发布同步至 Infinite Flight。",
  Crew: "执飞机组名单",
  "Awaiting crew approval": "等待批准加入机组",
  Approve: "批准",
  Reject: "驳回",
  "Withdraw crew request": "撤回加入机组申请",
  "Crew is full": "机组席位已满",
  "Request to join crew": "申请加入联合机组",
  "Publish this approved schedule and its crew to Infinite Flight. Earlier legs must be published first.":
    "将此已获批排班及机组名单发布至 Infinite Flight（前序航段须先完成发布）。",
  "Publish to IF": "发布至 IF",
  "Edit flight": "编辑航班",
  "Approve flight": "批准排班放行",
  "Withdraw request": "撤回排班申请",
  "Start flight": "开始执飞放行",
  "Cancel flight": "取消此航班",
  "Record arrival": "登记落地完航",
  "Change captain": "变更责任机长",
  "Retry IF publishing": "重试发布至 IF",
  "Reconcile with IF": "与 IF 校准同步",
  "Reason (optional)": "审批说明（选填）",
  Reason: "原因说明",
  "Publish queued flights": "发布队列中的航班",
  "Load IF schedules": "加载 IF 排班表",
  "Refresh IF schedules": "刷新 IF 排班表",
  "Crew Center flights": "机组中心本地排班",
  "No local flights for this aircraft.": "该飞机当前暂无本地排班航班。",
  "Infinite Flight schedules": "Infinite Flight 服务器排班表",
  "This aircraft uses local scheduling. An admin can link it to an IF aircraft to load its schedules.":
    "该飞机当前采用本地排班模式。管理员可将其关联绑定至 IF 机队以读取服务器排班。",
  "Loading IF schedules…": "正在读取 IF 服务器排班表…",
  "Select Load IF schedules to request the aircraft’s current itinerary.":
    "点击“加载 IF 排班表”以查询该飞机在 Infinite Flight 服务器上的当前航段队列。",
  "Arrived flights are locked.": "已落地完航的航段已锁定。",
  "View or amend local flight": "查看或变更本地航班",
  "View local flight": "查看本地航班",
  "Edit IF schedule": "编辑 IF 排班",
  "Review flight match": "复核航班匹配",
  "Match to Crew Center flight": "关联匹配至本地航班",
  "No schedules returned by IF.": "Infinite Flight 未返回任何排班记录。",
  "Set UTC times (optional)": "指定计划起降时刻 (UTC，选填)",
  "Use suggested times": "采用推荐接续时刻",
  "Scheduled departure (UTC)": "计划起飞时刻 (UTC)",
  "Scheduled arrival (UTC)": "计划到达时刻 (UTC)",
  "Flight callsign": "航班无线电呼号",
  "Submit request": "提交排班申请",
  "Edit live aircraft": "编辑实时运力飞机",
  "Add to local fleet": "加入本地运力机队",
  "Add live aircraft": "新增实时运力飞机",
  Registration: "航空器注册号（如 B-308D）",
  "Aircraft type and livery": "机型与涂装",
  "Current airport": "当前停场机场",
  "Available for scheduling": "开放排班预约",
  "Link to this IF aircraft": "关联绑定至此 IF 飞机",
  "Save aircraft": "保存飞机信息",

  // Infinite Flight Admin Panel
  "Checking Infinite Flight connection…": "正在检查 Infinite Flight 平台连接状态…",
  "Infinite Flight Live preview": "Infinite Flight 实时运控同步连接",
  Connected: "已连接",
  "Reconnect required": "需重新授权连接",
  "Admin access changed": "管理员权限已变更",
  Disconnected: "未连接",
  "Connect an IF organization admin account to publish approved flights and crew assignments.":
    "连接具有 Infinite Flight 虚航组织管理员权限的账号，以自动发布已批准的排班计划与机组指派。",
  "Refresh status": "刷新连接状态",
  "Allow starts without IF publishing": "允许未同步至 IF 的航班在本地直接开始执飞",
  "OAuth connection setup": "OAuth 授权连接配置",
  "Registered callback": "已注册回调地址 (Callback URL)",
  "IF client setup and review": "IF 开发者客户端配置指南",
  Disconnect: "断开连接",
  "Connect Infinite Flight": "连接 Infinite Flight 账号",
  "Organization and live fleet": "虚航组织与服务器实时机队",
  "View current IF aircraft, add a local aircraft, or link one that is already in the local fleet.":
    "查看 IF 服务器在册飞机、将其导入本地机队，或与现有本地运力进行关联绑定。",
  "Load organizations": "加载虚航组织列表",
  Organization: "所属虚航组织",
  "Select an organization": "选择虚航组织",
  "Connected organization": "当前已绑定组织",
  "Save organization": "保存所选组织",
  "Load IF fleet": "加载 IF 机队",
  "Refresh IF fleet": "刷新 IF 机队",
  "Already in local fleet": "已在本地机队中",
  "View IF status": "查看 IF 实时状态",
  "Select a local aircraft": "选择要绑定的本地飞机",
  "Link aircraft": "绑定飞机",
  Unlink: "解除绑定",
  "Last IF position": "最新 IF 报告位置",
  "Refreshing IF location…": "正在刷新 IF 位置…",
  "View position on map": "在地图上查看位置",

  // Complete Public, Operations, Application & Admin Translations
  "Find routes": "查找航线",
  "Search active commercial and partner routes, filter by aircraft or duration, and dispatch a PIREP.": "检索活跃的商业与伙伴航线，按机型或航程筛选并签派申报。",
  "Search flight number (e.g. CSN327, CXA801)": "搜索航班号（如 CSN327、CXA801）",
  "Dep ICAO": "起飞 ICAO",
  "Arr ICAO": "到达 ICAO",
  "DEP ICAO": "起飞 ICAO",
  "ARR ICAO": "到达 ICAO",
  "You do not meet an aircraft requirement for this route": "未达到该航线机型要求",
  "Refresh dashboard": "刷新仪表盘",
  "Search recent flights": "搜索近期航班",
  "Search route, flight number, or aircraft": "搜索航段、航班号或机型",
  "Filter aircraft": "筛选机型",
  "Filter status": "筛选状态",
  "Must be 13 years of age or older": "年满 13 周岁及以上",
  "Must be Grade 3 or above": "Infinite Flight 等级达到 Grade 3 及以上",
  "Must have an IFC account linked to the Infinite Flight App": "须拥有与 Infinite Flight App 关联的 IFC 论坛账号",
  "Must not be on the IFVARB’s user blacklist/watchlist": "未被列入 IFVARB 用户黑名单或监控名单",
  "Must not be on the IFVARB's user blacklist/watchlist": "未被列入 IFVARB 用户黑名单或监控名单",
  "Must have an active Infinite Flight Pro Subscription": "拥有有效的 Infinite Flight Pro 专业版订阅",
  "Be in good standing with the IFC": "在 IFC 社区信誉良好、无重大违规记录",
  "Should be able to participate actively": "能够积极参与虚航活动与定期执飞",
  "Must be able to use Discord": "能够正常使用 Discord 进行机组联络",
  "My PIREPs": "我的飞行报告",
  "Review your submitted pilot reports, check approval status, and discuss with staff.": "查阅您提交的飞行报告、跟进审批状态并与教员留言交流。",
  "10 / page": "10 条/页",
  "20 / page": "20 条/页",
  "50 / page": "50 条/页",
  "100 / page": "100 条/页",
  "Items per page": "每页条数",
  "Write a comment about this PIREP...": "填写关于此份飞行报告的留言...",
  "Route Not Found": "未找到航线",
  "The requested route could not be found.": "所请求的航线不存在或已下线。",
  "Bulk Import CSV": "批量导入 CSV",
  "No routes found matching your criteria": "未找到符合筛选条件的航线",
  "Create a new flight route in the system. All fields marked with * are required.": "在系统中创建新航线。带 * 字段均为必填。",
  "Upload a CSV file to import multiple routes at once.": "上传 CSV 文件以批量导入多条航线。",
  "Parsing CSV...": "正在解析 CSV...",
  "Click to upload CSV or drag and drop": "点击上传 CSV 或拖拽至此处",
  "CSV files only": "仅限 CSV 文件",
  "Your CSV file should have the following columns (in any order):": "CSV 文件须包含以下表头列（顺序不限）：",
  "None (skip)": "无（跳过）",
  "Match aircraft names from your CSV with aircraft in the database.": "将 CSV 中的机型名称与数据库中的机型进行映射匹配。",
  "Manage PIREP credit multipliers, redemption codes, and rank requirements.": "管理飞行报告倍率加成、兑换代码及职级要求。",
  "Codes are entered by pilots when filing a PIREP. Existing reports retain their stored multiplier labels after edits or deletion.": "飞行员申报飞行报告时可输入代码。编辑或删除代码不影响已有报告中记录的倍率。",
  "Configure how the code adjusts credited PIREP flight time.": "配置该代码对飞行报告折算时间的加成方式。",
  "Pilots must meet this rank's required approved flight time before using the code.": "飞行员须达到该职级对应的有效飞行时间后方可使用此代码。",
  "Pilots must meet this rank’s required approved flight time before using the code.": "飞行员须达到该职级对应的有效飞行时间后方可使用此代码。",
  "Reset Your Password": "重置您的密码",
  "Main hubs": "核心主枢纽",
  "Fly a China-based network built for Infinite Flight pilots: major hubs, realistic route variety, codeshare operations, and a fleet ranging from regional jets to long-haul flagships.": "面向 Infinite Flight 飞行员打造的中国航线网络：涵盖核心枢纽、拟真航线、代码共享及从支线客机到远程旗舰机队的丰富机型。",
  "Built for pilots who want variety without losing realism.": "专为追求丰富航线与真实飞行体验的飞行员量身打造。",
  "Choose from domestic sectors, long-haul wide-body flights, cargo operations, and partner routes.": "覆盖中国国内航线、远程宽体洲际越洋、全货运航班及代码共享航线。",
  "Fly China Southern, Xiamen Air, Chongqing Airlines, Hebei Airlines, Jiangxi Air, and more.": "执飞中国南方航空、厦门航空、重庆航空、河北航空、江西航空等机队。",
  "Join an Infinite Flight virtual airline group built around realistic schedules and shared events.": "加入基于拟真航季排班与联飞活动的 Infinite Flight 虚拟航空集团。",
  "Start from major Chinese hubs and branch across the world.": "立足中国核心枢纽，航线网络连通全球。",
  "Explore China Southern Virtual Group routes from Guangzhou, Beijing Daxing, Xiamen, Chongqing, Chengdu, Shijiazhuang, and Nanchang with aircraft options for short hops and long-haul flights.": "探索广州、北京大兴、厦门、重庆、成都、石家庄、南昌等基地的虚拟南航航线，从短途穿梭到洲际远航应有尽有。",
  "China Southern aircraft on the runway": "跑道上的南方航空飞机",
  "CZVG Live Flight Map": "CZVG 实时飞行地图",
  "Aircraft on final approach": "五边进近中的飞机",
  "Guangzhou to Beijing": "广州 至 北京",
  "Beijing Daxing to Shanghai": "北京大兴 至 上海",
  "Xiamen to Hong Kong": "厦门 至 香港",
  "Guangzhou to Los Angeles": "广州 至 洛杉矶",
  "Chongqing to Guangzhou": "重庆 至 广州",
  "Chengdu to Beijing": "成都 至 北京",
  "Shijiazhuang to Xiamen": "石家庄 至 厦门",
  "Nanchang to Guangzhou": "南昌 至 广州",
  "Guangzhou to London Heathrow": "广州 至 伦敦希思罗",
  "Beijing Daxing to Tokyo Haneda": "北京大兴 至 东京羽田",
  "Xiamen to Singapore": "厦门 至 新加坡",
  "Guangzhou to Sydney": "广州 至 悉尼",
  "Welcome IF pilots. As the CEO of this virtual airline, I hope CZVG brings you an excellent experience. Our virtual airline has a welcoming community and countless routes to fly. Come and join us in the IF skies.": "各位 IF 飞行员大家好。作为虚航负责人，我真诚希望 CZVG 能为您带来优秀的飞行体验。我们拥有温暖热情的社区与数以千计的真实航线，期待与您在 IF 的蓝天中相会。",
  "Nelson Paing, CEO": "Nelson Paing，总裁",
  "Join our virtual airline today and start your journey through one of the largest China-based virtual networks in Infinite Flight.": "欢迎今天就加入我们，开启 Infinite Flight 最大中国虚拟航空网络的精彩飞行旅程。",
  Founded: "成立时间",
  "July 2021": "2021 年 7 月",
  Network: "航线网络",
  "300+ destinations": "300+ 航点",
  "1000+ flight options": "1000+ 航班选择",
  "A China-based virtual airline group for Infinite Flight pilots.": "面向 Infinite Flight 飞行员的中国虚拟航空集团。",
  "China Southern Virtual Group brings a broad Chinese airline network, realistic hub operations, and varied aircraft choices into the Infinite Flight community.": "虚拟中国南方航空集团将庞大的中国航线网络、拟真的枢纽运行与多样的机型涂装带入 Infinite Flight 社区。",
  "Our background": "发展历程",
  "Built around China Southern and its partner network.": "依托中国南方航空及其成员伙伴网络精心构筑。",
  "Founded in July 2021, China Southern Virtual Group was established to bring another China-based airline experience to Infinite Flight. Our primary hubs are Guangzhou Baiyun and Beijing Daxing.": "虚拟中国南方航空集团成立于 2021 年 7 月，旨在为 Infinite Flight 带来更丰富的中国民航飞行体验。我们的核心主枢纽为广州白云与北京大兴。",
  "Inspired by one of the largest airlines in China, we fly to more than 300 destinations across over 1,000 routes from our hubs and focus cities. We also offer a wide variety of aircraft for pilots to fly.": "源于中国最具规模的航空公司之一，我们从各枢纽与重点城市通达 300 余个目的地、1000 多条航线，并为飞行员提供丰富的机型选择。",
  "Join China Southern Virtual Group today to explore the exciting world of virtual flight with us.": "立即加入虚拟中国南方航空集团，与我们共同探索广阔精彩的虚拟飞行世界。",
  "Our group airlines": "集团成员航司",
  "One group, one connected aviation network.": "同属一个集团，共享互联互通的航空网络。",
  "Our virtual group represents the passenger, cargo, and general aviation operations within the China Southern Air Holding network.": "我们的虚拟航司集团代表了南航集团旗下的客运、货运及通用航空全方位运行体系。",
  CARGO: "货运航空",
  "Regional airlines": "区域航司",
  "Ready to join our team?": "准备好加入我们了吗？",
  "Become part of our virtual pilot community and start your journey today.": "加入我们的虚拟飞行员大家庭，今天就开启您的蓝天之旅。",
  "Explore Operations": "浏览运行中心",
  "The group’s flagship carrier, operating an extensive domestic and international network from major hubs across China.": "集团旗舰承运人，依托遍布中国的核心枢纽运营庞大的国内与国际航线网络。",
  "Based in Xiamen, operating an extensive domestic network alongside services across Asia and international destinations.": "总部设于厦门，运营覆盖全国的国内航线网络，以及辐射亚洲与各大洲的国际航线。",
  "The group’s dedicated air-freight carrier, operating cargo services within China and internationally.": "集团旗下专业全货运航空公司，运营中国境内及全球国际货运包机与定期班线。",
  "Representing the group’s general aviation operations.": "负责运行南航集团旗下的通用航空及直升机作业。",
  "Based in Chongqing, connecting Southwest China with destinations across the country.": "基地位于重庆，以江北机场为核心将西南地区与全国各大目的地紧密相连。",
  "Based in Shijiazhuang, connecting Hebei Province with destinations throughout China.": "基地位于石家庄正定机场，连接河北省与全国重点城市航线。",
  "Based in Nanchang, connecting Jiangxi Province with major cities across China.": "基地位于南昌昌北机场，连接江西省与全国主要城市。",
  "China Southern Henan Airlines": "南航河南航空",
  "Xiamen Air": "厦门航空",
  "Chengdu Airlines": "成都航空",
  "Jiangxi Air": "江西航空",
  "Main hubs and focus cities across the CZVG network.": "CZVG 全网核心枢纽基地与重点城市布局。",
  "Learn about our main operational hubs and focus cities across China.": "了解我们分布在中国各地的主要运行基地与骨干航线网络。",
  "Airline network": "航线枢纽网络",
  "A network centered around China with several regional bases.": "立足中国本土、多点协同的区域运行基地网络。",
  "China Southern Virtual Group, along with its subsidiary airlines, operates an extensive network of hubs and focus cities across China. Our airlines include China Southern Airlines, Xiamen Air, Chengdu Airlines, Hebei Airlines, Jiangxi Air, and Chongqing Airlines.": "虚拟中国南方航空集团协同各成员航司在中国境内构建了密集的枢纽与基地网络，包括南航、厦航、成航、河北航、江西航及重航等。",
  "China Southern Airlines main hubs": "中国南方航空核心主枢纽",
  Location: "机场地理位置",
  Terminals: "航站楼",
  Runways: "跑道配置",
  Destinations: "通航目的地",
  "Focus cities": "重点发展城市",
  "China Southern Airlines focus cities": "中国南方航空重点基地城市",
  "Subsidiary network": "成员航司网络",
  "Subsidiary airline hubs": "成员航司枢纽基地",
  "Image coming soon": "图集整理中",
  "Ready to explore our network?": "准备好探索我们的航线网络了吗？",
  "Join our virtual airline group today and fly from our hubs to destinations around the world.": "加入我们的虚拟航司，从中国各枢纽起飞，航线通达全球。",
  "View Routes": "查看航线",
  "Aircraft for regional hops, domestic workhorses, and long-haul flagships.": "覆盖支线客机、国内主力干线到远程双通道旗舰机队。",
  "Explore our diverse fleet of aircraft, from regional jets to wide-body airliners.": "探索我们的全系列机队，体验从喷气支线到巨型宽体客机的丰富操控感。",
  "Fleet overview": "机队总览",
  "A flexible lineup across multiple airlines.": "跨越多家成员航司的多元化机队配置。",
  "China Southern Virtual Group operates a diverse fleet of aircraft to serve our extensive network of destinations. Our fleet includes wide-body aircraft for long-haul international routes, narrow-body aircraft for domestic and regional routes, and regional jets for shorter routes to smaller cities.": "虚拟中国南方航空集团运营着丰富的机型阵容以支撑全网航班：用于洲际长途的宽体机群、用于国内干线与区域航班的窄体客机，以及服务中短途支线城市的喷气支线飞机。",
  "Our virtual pilots have the opportunity to fly a wide variety of aircraft types, providing a rich and diverse flying experience.": "我们的虚拟飞行员能够随技术职级晋升执飞多种不同机型，畅享丰富真实的飞行历程。",
  "Aircraft category": "机型分类",
  "Wide-body Aircraft": "宽体远程客机",
  "Narrow-body Aircraft": "窄体单通道客机",
  "Regional Aircraft": "支线喷气客机",
  "Historical Fleet": "历史经典机队",
  "Ready to fly our fleet?": "准备好执飞我们的机队了吗？",
  "Join our virtual airline group today and experience flying these amazing aircraft.": "立即加入虚拟南航，亲身体验驾驶这些卓越航空器的乐趣。",
  "Explore Routes": "探索航线",
  "Progress through the fleet as your flight time grows.": "随着有效飞行小时累积，稳步晋升并解锁更高级别机队。",
  "Use this rank guide to see flight-hour requirements, aircraft unlocks, Fleet Captain status, and CEO rewards.": "查阅技术职级指南，了解晋升所需小时数、解锁机型、机队总机长准入及总裁特别奖项。",
  "Rank ladder": "职级晋升阶梯",
  "Aircraft unlocks by rank.": "各职级准入与解锁机型一览",
  "Each tier lists the flight-time range and primary aircraft available at that rank.": "阶梯列明了各职级所需飞行时间区间及可执飞的主力机型。",
  "Rank information is being updated. Please check back soon.": "技术职级规范正在维护更新中，请稍后查看。",
  "Aircraft Unlocked": "已解锁执飞机型",
  "CEO's Award": "总裁特别嘉奖",
  "CEO’s Award": "总裁特别嘉奖",
  "A Reward for the most dedicated pilots.": "授予最为卓越与忠诚的资深机组人员。",
  "1.3x multiplier": "1.3 倍全航段时长加成",
  "CEO's Award applies a 1.3x multiplier to all flights.": "荣获总裁特别嘉奖后，所有申报航班均自动享有 1.3 倍积分加成。",
  "CEO’s Award applies a 1.3x multiplier to all flights.": "荣获总裁特别嘉奖后，所有申报航班均自动享有 1.3 倍积分加成。",
  "Ready to climb the ranks?": "准备好开启晋升之旅了吗？",
  "Join the crew center, file flights, and unlock aircraft as your hours grow.": "加入机组运行中心，提交飞行报告，随着飞行小时累积解锁更高级机队。",
  "View Fleet": "查看机队",
  "A large network for short sectors, long hauls, and partner ops.": "服务于国内短途穿梭、远程洲际干线及代码共享联运的宏大网络。",
  "Discover the CZVG route database, airline-specific network maps, and codeshare partners.": "探索 CZVG 航线数据库、成员航司专属航图以及天合联盟/代码共享伙伴航线。",
  "Browse available routes.": "检索查询可供执飞的计划航线。",
  "Route database displayed here may be outdated. Crew Center routes are the most up-to-date source.": "本页公开航线数据仅供参考，机组中心内的计划航班数据为最新准则。",
  "Route network": "航线网络图景",
  "Airline-specific network maps.": "成员航司航线网络图",
  "Explore routes across China Southern, Xiamen Air, Chengdu Airlines, Hebei Airlines, Jiangxi Air, and Chongqing Airlines.": "探索南航、厦航、成航、河北航、江西航及重航的全部计划航线。",
  "Codeshare partners": "代码共享合作航司",
  "More flying through partner networks.": "借助伙伴航司网络探索更多精彩全球航段。",
  "And more partners.": "以及更多合作伙伴航司。",
  "Ready to explore our routes?": "准备好执飞我们的航线了吗？",
  "Join our virtual airline group today and fly to destinations around the world.": "立即加入虚拟南航集团，开启飞往全球目的地的精彩航程。",
  "View Our Fleet": "查看机队",
  "CZVG route database": "CZVG 航线数据库",
  "Quick Summary": "内容提要",
  "Your exam score is below 80, so a recruiter needs to review an additional flight replay before continuing your application.": "您的理论笔试成绩低于 80 分，需由招飞教员复核一段完整的飞行回放以评估操纵技能。",
  "Upload a replay with full ATC coverage from departure to arrival, then paste the ShareMyInfiniteFlight link here. Required ATC coverage: Ground, Tower, Departure when available, and Approach.": "请上传一段包含始发至落地全航段 ATC 管制管制的飞行回放，并将 ShareMyInfiniteFlight 分享链接粘贴在此。要求的管制服务包括：地面、塔台、进近及离场（如有）。",
  "Open ShareMyInfiniteFlight": "打开 ShareMyInfiniteFlight 网站",
  "Your exam is marked done. You can undo this until a recruiter adds your score.": "您已声明完成理论笔试。在教员录入最终成绩前，您仍可撤销此声明。",
  "(opens in a new tab)": "（在新标签页中打开）",
  "Flight replay review": "飞行回放复核",
  "Save replay": "保存回放链接",
  "Password must be at least 8 characters long": "密码长度至少 8 位",
  "By applying, you agree to the": "提交申请即代表您同意",
  "and acknowledge the": "并已知悉",
  "All pilots are required to have an active": "所有飞行员均须具备有效的",
  Account: "账号",
  Manual: "人工录入",
  Livery: "涂装",
  Source: "数据来源",
  Rank: "职级",
  Award: "勋章",
  "Deactivate aircraft?": "确认停用该飞机？",
  "Aircraft source": "飞机数据来源",
  "Livery name (optional)": "涂装名称（选填）",
  "Minimum rank (optional)": "最低准入职级（选填）",
  "Required award (optional)": "指定准入勋章（选填）",
  "Select at least a rank or an award.": "请至少选择一项职级或勋章准入条件。",
  "Up to 12 characters": "最多 12 个字符",
  "Select a pilot": "选择飞行员",
  "Select an award": "选择勋章",
  "Name, callsign, IFC, or email": "姓名、呼号、IFC 或邮箱",
  "Search awards": "搜索勋章",
  "Search by name, callsign, IFC, or email": "按姓名、呼号、IFC 或邮箱搜索",
  "Admin Permissions": "管理员权限配置",
  "Add Admin": "添加管理员",
  "Add Admin Access": "添加管理员权限",
  "Pilot Email": "飞行员邮箱",
  Role: "角色职务",
  "Search Admins": "搜索管理员",
  "Filter by Role": "按角色筛选",
  "All Roles": "全部角色",
  Admin: "管理员",
  "Edit Permissions": "编辑权限",
  "Select a role": "选择角色职务",
  "Search by name, email, callsign, role...": "搜索姓名、邮箱、呼号或角色...",
  "Filter by role": "按角色筛选",
  Users: "用户花名册",
  Filters: "筛选器",
  "Search Users": "搜索用户",
  "All Users": "全部用户",
  "View and manage all user": "查看并管理所有在册用户",
  "User Name": "用户姓名",
  Joined: "注册时间",
  "Search by name, email, ID...": "按姓名、邮箱、ID 搜索...",
  "Filter by status": "按状态筛选",
  "Enter notes about this application...": "填写关于此申请的内部备注...",
  "Score out of 100": "满分 100 分",
  Awards: "荣誉勋章体系",
  "Manage award definitions and the featured public reward.": "管理勋章定义及公开展示的特色表彰奖项。",
  Description: "勋章说明",
  Public: "公开展示",
  "No awards found.": "未找到相关勋章。",
  Featured: "首页精选推荐",
  "This is allowed only when no aircraft or pilot grants reference the award.": "仅在无任何飞机或飞行员引用此勋章时允许删除。",
  "Image URL (HTTPS)": "图片链接 (HTTPS)",
  "Feature on public rank page": "在公开职级页面上突出展示",
  "Selecting this replaces the currently featured award.": "勾选此项将替换当前精选展示的勋章。",
  "PIREP Management": "飞行报告签派审核",
  "Search PIREPs": "搜索飞行报告",
  "Per Page": "每页条数",
  Flight: "航班",
  View: "查看",
  "Search by flight number, pilot name, airport code...": "按航班号、飞行员姓名或机场四字码搜索...",
  "Per page": "每页条数",
  "Manage pilot progression and the public rank ladder.": "管理飞行员晋升机制与公开技术职级阶梯。",
  "Required Seconds": "所需秒数",
  Display: "前台展示",
  "No ranks found.": "未找到相关职级。",
  "This is allowed only when no aircraft or multipliers use the rank.": "仅在无任何飞机或倍率绑定此职级时允许删除。",
  "Required flight time (seconds)": "所需飞行时间（秒）",
  "Aircraft image URL (HTTPS, optional)": "机型示意图链接 (HTTPS，选填)",
  Bars: "道杠数量",
  "Bar color": "道杠配色",
  Gold: "金色",
  White: "白色",
  Stars: "星徽数量",
  Multipliers: "时长倍率代码",
  "Search Multipliers": "搜索倍率",
  "PIREP Multipliers": "飞行报告时长倍率",
  Code: "代码",
  Factor: "倍率系数",
  "Redemption Code": "兑换代码",
  "Flight Time Factor": "飞行时长加成系数",
  "No minimum rank": "无最低职级要求",
  "Search by name, code, factor, or rank...": "按名称、代码、系数或职级搜索...",
  "Double Flight Time": "双倍飞行时间",
  "Select minimum rank": "选择最低准入职级",
  "All durations": "不限时长",
  "< 01:00": "1小时以内",
  "4-5 hours": "4-5 小时",
  "5-6 hours": "5-6 小时",
  "6-7 hours": "6-7 小时",
  "7-8 hours": "7-8 小时",
  "8-9 hours": "8-9 小时",
  "9-10 hours": "9-10 小时",
  "10+ hours": "10 小时以上",
  "Search by Flight Number": "按航班号搜索",
  "Flight Reports": "关联飞行报告",
  "Add New Route": "新增航线",
  "Flight Number *": "航班号 *",
  "Departure Airport *": "起飞机场 *",
  "Arrival Airport *": "到达机场 *",
  "Duration (HH:MM) *": "航程时长 (HH:MM) *",
  "Example:": "示例：",
  "ICAO code": "ICAO 四字码",
  "Select duration range": "选择计划时长范围",
  "Search by flight number": "按航班号搜索",
  "Enter departure ICAO code": "输入起飞机场 ICAO 代码",
  "Enter arrival ICAO code": "输入到达机场 ICAO 代码",
  "Enter any additional info...": "输入补充说明信息...",
  "Route not found": "未找到该航线",
  "PIREP Status": "报告审批状态",
  "Approved Flight Time": "已批准飞行小时",
  "Busiest PIREP Airports": "最繁忙起降机场",
  "Pilot Status": "飞行员花名册状态",
  "Application Pipeline": "招飞审批流程",
  "Recently Active": "近期活跃机组",
  "Route Duration Distribution": "航线飞行时长分布",
  "Top Departure Airports": "主要出港机场",
  "Top Arrival Airports": "主要进港机场",
  "Most Used Aircraft": "最常执飞机型",
  "Active Livery Breakdown": "在飞机队涂装分布",
  "Admin Permission Distribution": "管理权限分布",
  "Admin Access": "管理权限分配",
  "Admin Users": "在任管理人员",

  // ============================================================================
  // 7. Staff Console / Admin Pages (`src/app/crew/admin/**`)
  // ============================================================================
  // Admin Dashboard
  "Airline Analytics": "航司运行数据总览",
  "Overview of fleet activity, pilot engagement, and PIREP processing.":
    "全面监控集团机队运行动态、飞行员执飞活跃度及飞行报告签派审批效率。",
  "Last 7 days": "最近 7 天",
  "Last 30 days": "最近 30 天",
  "Last 90 days": "最近 90 天",
  "All time": "全部历史数据",
  "Loading analytics...": "正在加载运行统计数据...",
  "Review Queue": "待办审批队列",
  "Pending Applications": "待审招飞申请",
  "Active Pilots": "在册活跃飞行员",
  "Flight Operations": "航班运行总量",
  "Approved Flights": "已获批有效航班",
  "Credited Flight Hours": "累计有效飞行小时",
  "Fuel Burned": "累计消耗燃油",
  "Approval Rate": "飞行报告通过率",
  "Average Flight Duration": "平均航段轮挡时间",
  "Flight Activity Trend": "航班架次趋势",
  "Credited Hours Trend": "有效飞行小时趋势",
  "Active Pilots Trend": "活跃飞行员趋势",
  "Live Network Radar": "全球实时运行雷达",
  "Active CZVG aircraft on the Infinite Flight Expert Server":
    "Infinite Flight 专家服 (Expert Server) 上的虚拟南航实时在线机组",
  "Open Fullscreen": "全屏打开雷达",
  "Top Routes": "热门执飞航线排行",
  "Most Flown Aircraft Types": "主力执飞机型排行",
  "Top Pilots by Flights": "飞行员执飞架次榜",
  "Top Pilots by Hours": "飞行员飞行时长榜",
  "PIREP Status Breakdown": "飞行报告审批状态分布",
  "Pilot Roster Status": "飞行员花名册状态分布",
  "Rank Distribution": "飞行员技术职级分布",
  "Busiest Departure Airports": "最繁忙出港基地排行",
  "Busiest Arrival Airports": "最繁忙进港机场排行",
  "No data for this range": "该统计周期内暂无数据",
  "No data available": "暂无统计数据",
  "No activity in this range": "该统计周期内暂无运行记录",
  "Flight time": "飞行时间",

  // Auto-added: Public / Auth / Application / Admin extras
  "Preferred Name": "常用姓名",
  "Use English letters, numbers, and spaces only.": "仅限英文字母、数字和空格。",
  "Infinite Flight Community Profile URL": "IF 社区个人主页链接",
  "Must be at least 8 characters long": "密码至少 8 位",
  "Passwords match": "两次密码一致",
  "Sending application...": "正在提交申请...",
  Apply: "提交申请",
  "Enter your Email Address": "请输入注册邮箱",
  "OTP Code": "邮箱验证码",
  "Please check your email for a 6-digit code": "请查收邮件中的 6 位验证码",
  "Resetting...": "正在重置...",
  "Loading application...": "正在加载申请...",
  "Application Progress": "申请流程",
  "Application submitted": "申请已提交",
  "Exam declared done": "已声明完成笔试",
  "Score received": "已收到成绩",
  "Flight replay": "飞行回放",
  "Discord invite": "Discord 邀请",
  "Open Discord Invite": "打开 Discord 邀请",
  "Your Information": "个人信息",
  "Save Replay": "保存回放",
  "Entrance Examination": "入职笔试",
  "Access Key": "访问密钥",
  "Open Quiz": "打开试题",
  "Declare Examination Done": "声明笔试已完成",
  "Examination Submitted": "笔试已提交",
  "Admin Analytics": "运行数据分析",
  "7 days": "7 天",
  "30 days": "30 天",
  "90 days": "90 天",
  "This year": "今年",
  Custom: "自定义",
  "Flight Hours": "飞行小时",
  "PIREP Volume": "飞行报告数量",
  Departures: "出港",
  Arrivals: "进港",
  "Pilot Growth": "飞行员增长",
  "Pilot Activity": "飞行员活跃度",
  "Route Coverage": "航线覆盖",
  "Aircraft Inventory": "机队库存",
  "Active Aircraft": "在役机型",
  "Live Flight Map": "实时航班地图",
  "Live Radar": "实时雷达",
  "Infinite Flight Expert Server": "Infinite Flight 专家服务器",
  "Open live radar in new tab": "在新标签页打开全屏雷达",
  Name: "姓名",
  "Flight Information": "航班信息",
  "Status Information": "状态信息",
  "PIREP Comments": "飞行报告留言",
  "Add Admin Comment": "添加管理员留言",
  "Aircraft Type": "机型",
  "Duration (HH:MM)": "时长 (HH:MM)",
  "Select aircraft": "选择机型",
  "Select status": "选择状态",
  "Admin Notes": "管理员备注",
  "Application Review": "申请审核",
  "Refresh IF": "刷新 IF",
  "Exam Status": "笔试状态",
  "Discord Invite Link": "Discord 邀请链接",
  "IF Violations": "IF 违规记录",
  "Flight Replay": "飞行回放",
  "Save Application": "保存申请",
  "Confirm Approve": "确认批准",
  "Are you sure?": "确定吗？",
  "Search aircraft...": "搜索机型...",
  "Select aircraft...": "选择机型...",
  "Bulk Import Routes from CSV": "从 CSV 批量导入航线",
  "CSV Format": "CSV 格式",
  "Import Routes": "导入航线",
  "Importing...": "正在导入...",
  "Routes Found:": "航线总数：",
  "Routes to Import": "待导入航线",
  "Aircraft Mappings": "机型映射",
  "CSV Aircraft": "CSV 机型",
  "Database Aircraft": "数据库机型",
  "Import Successful": "导入成功",
  "Import Failed": "导入失败",
  "Routes Created:": "已创建航线：",
  "Errors:": "错误：",

  // Admin PIREPs (`src/app/crew/admin/pireps/page.tsx`)
  "Review, approve, or reject pilot flight reports.":
    "审核、批准或驳回飞行员提交的飞行报告 (PIREP)，并核验航段数据与倍率。",
  "All PIREPs": "全部历史飞行报告",
  "Search by pilot, callsign, flight, route, or aircraft...":
    "搜索飞行员、呼号、航班或机场",
  "Review PIREP": "审核飞行报告",
  "InspectPIREP": "查看报告详情",
  Pilot: "执飞飞行员",
  Callsign: "无线电呼号",
  Route: "执飞航段",
  "Raw Flight Time": "原始轮挡时间",
  "Credited Flight Time": "折算有效时间",
  "Approve PIREP": "批准飞行报告",
  "Reject PIREP": "驳回飞行报告",
  "Rejection reason (required when rejecting)...": "驳回原因（必填，将通知飞行员）...",

  // Admin Users (`src/app/crew/admin/users/page.tsx`)
  "Manage Users & Applications": "飞行员花名册与招飞管理",
  "Review pilot applications, manage active roster accounts, and sync Infinite Flight metrics.":
    "审核招飞入职申请、管理在册飞行员技术档案，并同步 Infinite Flight 社区等级与违规记录。",
  "Active Roster": "在册飞行员花名册",
  Applications: "待审招飞申请",
  "Rejected / Inactive": "未通过 / 已停用账号",
  "Sync IFC Metrics": "同步 IFC 社区数据",
  "Syncing IFC...": "正在同步 IFC 数据...",
  "Search by name, callsign, email, or IFC username...":
    "搜索姓名、呼号、邮箱或 IFC 用户名",
  "Joined Date": "入职/申请日期",
  "Last Activity": "最近执飞日期",
  "IF Grade": "IF 等级",
  Violations: "违规次数",
  "Manage Pilot": "管理飞行员档案",
  "Review Application": "审核招飞申请",
  "Transferred Hours": "转入经历小时",
  "Transferred Flights": "转入经历架次",
  "Written Exam Status": "理论笔试状态",
  "Written Exam Score": "理论笔试分数",
  "Discord Invite URL": "Discord 专属邀请链接",
  "Send Discord Invite": "发送 Discord 邀请邮件",
  "Approve Application": "批准招飞入职",
  "Reject Application": "驳回招飞申请",

  // Admin Routes (`src/app/crew/admin/routes/page.tsx`)
  "Create, edit, and assign aircraft to scheduled routes across the CZVG network.":
    "创建、编辑虚拟南航计划航线，并配置各航线的授权执飞机型。",
  "Add Route": "新增计划航线",
  "Edit Route": "编辑计划航线",
  "Create Route": "创建计划航线",
  "Delete Route": "删除航线",
  "Route Notes": "航线签派备注",
  "Authorized Aircraft": "授权执飞机型",
  "Select aircraft allowed on this route": "勾选允许在此航线上执飞的机型与涂装",

  // Admin Aircrafts (`src/app/crew/admin/aircrafts/page.tsx`)
  "Manage Fleet & Liveries": "管理机队机型与涂装库",
  "Configure aircraft types, Infinite Flight livery bindings, and rank or award unlock rules.":
    "配置集团机队机型、Infinite Flight 官方涂装 ID 绑定，以及职级或勋章准入条件。",
  "Add Aircraft": "新增机队机型",
  "Edit Aircraft": "编辑机队机型",
  "Aircraft Name": "机型名称",
  "Livery Name": "涂装名称",
  "ICAO Code / Notes": "机型四字码 / 备注（如 A359、B77W）",
  "Required Rank": "最低准入职级",
  "Required Award": "指定准入勋章",
  "No rank requirement": "无职级限制",
  "No award requirement": "无勋章限制",

  // Admin Ranks (`src/app/crew/admin/ranks/page.tsx`)
  "Configure pilot ranks, flight hour requirements, and shoulder-board insignia.":
    "配置飞行员技术职级名称、晋升所需飞行小时数及肩章星杠标识。",
  "Add Rank": "新增技术职级",
  "Edit Rank": "编辑技术职级",
  "Rank Name": "职级名称",
  "Required Hours": "晋升所需小时数",
  "Insignia Image URL": "肩章图片链接",
  "Stripe Count": "肩章道杠数",
  "Stripe Tone": "道杠配色（金/白）",
  "Star Count": "肩章星徽数",

  // Admin Multipliers (`src/app/crew/admin/multipliers/page.tsx`)
  "Configure event and bonus flight-time multiplier codes.":
    "配置联飞活动、精品快线及荣誉表彰专用的飞行时长倍率代码。",
  "Add Multiplier": "新增倍率代码",
  "Edit Multiplier": "编辑倍率代码",
  "Multiplier Code": "倍率代码（数字）",
  "Multiplier Value": "倍率系数（如 1.5）",
  "Multiplier Name": "倍率名称说明",
  "Minimum Rank Requirement": "最低适用职级",

  // Admin Awards & Pilot Awards (`src/app/crew/admin/awards/page.tsx`, `pilot-awards/page.tsx`)
  "Create and manage pilot commendations, event badges, and qualification awards.":
    "创建并管理飞行员荣誉表彰、联飞活动纪念章及特殊运行资质勋章。",
  "Add Award": "新增荣誉勋章",
  "Edit Award": "编辑荣誉勋章",
  "Award Name": "勋章名称",
  "Award Description": "勋章颁发说明",
  "Badge Image URL": "勋章图标链接",
  "Grant or revoke awards for active pilots.": "向在册飞行员授予或撤销荣誉勋章与资质认证。",
  "Grant Award": "授予荣誉勋章",
  "Select Pilot": "选择获颁飞行员",
  "Select Award": "选择荣誉勋章",
  "Date Awarded": "颁发日期",
  "Revoke": "撤销勋章",

  // Admin Permissions (`src/app/crew/admin/permissions/page.tsx`)
  "Assign staff console roles and module permissions to authorized team members.":
    "为管理团队成员分配运控后台角色与各功能模块的访问管理权限。",
  "Full Admin": "超级管理员",
  "Grant Permission": "授予权限",
  "Revoke Permission": "收回权限",

  // ============================================================================
  // 8. Mock Preview Data Translations (`src/lib/mock/crew-preview.ts`)
  // ============================================================================
  "Live Operations Certified Pilot": "实时运行签派准入飞行员",
  "Authorized for CZVG Live Aircraft Scheduling and real-time Infinite Flight dispatch queues.":
    "已获准使用虚拟南航实时机队排班系统及 Infinite Flight 实时签派放行队列。",
  "CEO's Commendation Award (1.3x)": "CEO 特别嘉奖勋章 (1.3x)",
  "Awarded by the CEO for outstanding dedication, operational excellence, and community leadership.":
    "由首席执行官颁发，表彰在航班运行品质、安全规范及社区建设中作出杰出贡献的飞行员。",
  "Canton Route Master": "广州之路洲际大师章",
  "Completed 50+ intercontinental wide-body sectors out of Guangzhou Baiyun International Hub (ZGGG).":
    "从广州白云国际主枢纽 (ZGGG) 出发累计完成 50 个以上宽体机洲际远程航段。",
  "Daxing Wing Pioneer": "大兴之翼护航先锋章",
  "Participated in the Beijing Daxing International Hub (ZBAD) inaugural group flight event.":
    "参与北京大兴国际主枢纽 (ZBAD) 首航纪念编队联飞活动并圆满完航。",
  "Silk Road Cargo Specialist": "空中丝路全货机专家章",
  "Logged over 100 hours on China Southern Cargo Boeing 777F international freighter operations.":
    "执飞中国南方航空货运波音 777F 国际全货机航线累计超过 100 飞行小时。",
  "Standard Line Operation": "日常正班航线运行",
  "Featured Hub Sector": "核心基地精品快线",
  "CEO's Award Multiplier": "CEO 嘉奖专属倍率",
  "Official Group Flight Event": "官方编队联飞活动",
  "Golden Week Double Hours": "黄金周双倍飞行小时活动",
  "Guangzhou Baiyun to Beijing Daxing trunk express service.":
    "广州白云至北京大兴南北双核心枢纽“南航快线”旗舰干线。",
  "Flagship transpacific service from Guangzhou to Los Angeles.":
    "广州白云至洛杉矶跨太平洋洲际旗舰客运航线。",
  "Canton Route flagship service to London Heathrow Terminal 4.":
    "“广州之路”广州白云至伦敦希思罗 T4 洲际旗舰航线。",
  "Southern Cross flagship service to Sydney Kingsford Smith.":
    "广州白云至悉尼金斯福德·史密斯南十字洲际旗舰航线。",
  "High-frequency Pearl River Delta to Shanghai Pudong shuttle.":
    "珠三角广州白云至上海浦东高频商务干线快线。",
  "Beijing Daxing international hub service to Tokyo Haneda.":
    "北京大兴国际枢纽至东京羽田精品国际快线。",
  "Xiamen Gaoqi to Hong Kong regional connector.":
    "厦门高崎至香港赤鱲角区域快线。",
  "Xiamen Airlines Southeast Asia trunk route to Singapore Changi.":
    "厦门航空厦门高崎至新加坡樟宜东南亚主力干线。",
  "Xiamen Airlines Dreamliner long-haul service to Amsterdam Schiphol.":
    "厦门航空 787 梦想客机厦门至阿姆斯特丹史基浦洲际远程航线。",
  "China Southern Cargo Polar freighter service to Chicago O'Hare.":
    "中国南方航空货运波音 777F 极地跨太平洋至芝加哥奥黑尔全货机航线。",
  "Chongqing Airlines domestic trunk route to Guangzhou.":
    "重庆航空重庆江北至广州白云国内主干线。",
  "Hebei Airlines Shijiazhuang Zhengding to Xiamen Gaoqi.":
    "河北航空石家庄正定至厦门高崎南北干线。",
  "Chengdu Shuangliu to Beijing Daxing express.":
    "成都双流至北京大兴西南核心商务快线。",
  "Ultra-long-haul non-stop service from Guangzhou to New York JFK.":
    "广州白云至纽约肯尼迪超远程跨极地直飞旗舰航线。",
  "Smooth Pacific crossing via NOPAC track R220, ILS RWY 24R at KLAX.":
    "经北太平洋 NOPAC R220 航路平稳跨越太平洋，洛杉矶 KLAX 24R 跑道盲降落地。",
  "Verified against Expert Server telemetry. Great flight!":
    "已核验专家服实时遥测轨迹，飞行数据非常标准，予以批准！",
  "Flown during Friday evening Beijing Daxing hub event (1.5x).":
    "周五晚间北京大兴主基地联飞活动航班（适用 1.5x 活动倍率）。",
  "2.0x event multiplier code was used outside event window; please re-file with 1.0x or 1.3x.":
    "非黄金周活动时段误用了 2.0x 倍率代码，请使用 1.0x 或 1.3x 重新提交报告。",
  "Cruising FL350 via W45, live telemetry active on Expert Server.":
    "沿 W45 航路于 FL350 巡航中，专家服实时遥测正常。",
  "Approved for immediate departure.": "签派已放行，准予按计划起飞。",
  "Relief First Officer approved.": "已批准巡航轮换副驾驶加入机组。",
  "Next leg following B-308D arrival at Beijing Daxing.":
    "接飞 B-308D 落地北京大兴后的后续东京羽田航段。",
  "Slot confirmed.": "时刻槽位已确认。",
  "Long-haul flagship service to London Heathrow.": "北京大兴始发前往伦敦希思罗远程旗舰航班。",
  "Requesting overnight southbound slot to Sydney.": "申请夜间南下悉尼洲际航段时刻。",
  "Xiamen Airlines B787-9 enroute over South China Sea.": "厦航 B787-9 正在南海空域巡航。",
  "Positioning cargo sector to Shanghai Pudong hub.": "调机兼货运航段前往上海浦东货运基地。",
  "Completed on schedule.": "已按计划正点完航。",

  // ============================================================================
  // 9. Split JSX Text Node Fragments (Prefixes & Suffixes around `{expr}`)
  // ============================================================================
  "Next:": "下一职级：",
  "Logged": "记录于",
  "Awarded": "颁发于",
  "aircraft unlocked for your rank": "架机型已在当前职级解锁",
  "additional aircraft on route": "架配属机型",
  "Fleet types authorized on": "授权执飞机型：",
  "Showing": "当前显示第",
  "of": "/",
  "of 3 seats": "/ 3 个机组席位",
  "/3 crew": "/3 名机组",
  "routes listed": "条在册航线",
  "ranks in ladder": "个技术职级",
  "hubs in network": "座基地枢纽",
  "airlines in group": "家成员航司",
  "aircraft variants": "种机型涂装",
  "(current captain)": "（当前责任机长）",
  "(inactive)": "（已停用）",
  "IF aircraft:": "IF 飞机：",
};

const EN_TO_ZH_PATTERNS: Array<[RegExp, string]> = [
  [/^Latest (\d+) sectors$/i, "最近 $1 个航段"],
  [/^Next:\s*(.+)$/i, "下一职级：$1"],
  [/^Logged\s+(.+)$/i, "记录于 $1"],
  [/^Block duration\s+(.+)$/i, "轮挡时间 $1"],
  [/^Scheduled duration\s+(.+)$/i, "计划航程 $1"],
  [/^Duration\s+(.+)$/i, "计划航程 $1"],
  [/^Date\s+(\d{4}-\d{2}-\d{2})$/i, "执飞日期 $1"],
  [/^Awarded\s+(.+)$/i, "颁发日期 $1"],
  [/^Requested\s+(.+)$/i, "申请于 $1"],
  [/^Arrival\s+(.+)$/i, "计划到达 $1"],
  [/^Updated\s+(.+)$/i, "更新于 $1"],
  [/^Last reported\s+(.+)$/i, "最后报告于 $1"],
  [/^Last refreshed\s+(.+)$/i, "最后刷新于 $1"],
  [/^Positions last refreshed\s+(.+)\.$/i, "位置数据最后刷新于 $1。"],
  [/^Fleet last refreshed\s+(.+)\. It refreshes only when requested\.$/i, "机队最后刷新于 $1（仅在手动请求时刷新）。"],
  [/^Last successful refresh:\s*(.+)\. Newest queue entries appear first\. Actual arrivals still confirm the local airport\.$/i, "上次成功刷新：$1。最新队列排在最前，实际停场机场仍以完航落地登记为准。"],
  [/^(\d+)\/(\d+) aircraft unlocked for your rank$/i, "当前职级已解锁 $1/$2 架机型"],
  [/^\+(\d+) additional aircraft on route$/i, "另有 +$1 架配属机型"],
  [/^Fleet types authorized on (.+)$/i, "$1 航线授权执飞机型"],
  [/^Showing (\d+)[–-](\d+) of (\d+) PIREPs$/i, "显示第 $1–$2 条，共 $3 份飞行报告"],
  [/^Showing (\d+)[–-](\d+) of (\d+) routes$/i, "显示第 $1–$2 条，共 $3 条航线"],
  [/^Showing (\d+)[–-](\d+) of (\d+) pilots$/i, "显示第 $1–$2 名，共 $3 名飞行员"],
  [/^Aircraft (\d+)[–-](\d+) of (\d+)$/i, "第 $1–$2 架，共 $3 架飞机"],
  [/^Page (\d+) of (\d+)$/i, "第 $1 / $2 页"],
  [/^(\d+) comment(s?)$/i, "$1 条留言"],
  [/^Flight date:\s*(.+)$/i, "执飞日期：$1"],
  [/^(\d+) of 3 seats$/i, "已占 $1 / 3 个机组席位"],
  [/^(\d+)\/3 crew$/i, "$1/3 名机组"],
  [/^(\d+) awaiting review$/i, "$1 人待审批"],
  [/^(\d+) assigned crew$/i, "已指派 $1 名机组"],
  [/^(\d+) crew$/i, "$1 名机组"],
  [/^Captain assigned$/i, "已指派机长"],
  [/^No captain assigned$/i, "未指派机长"],
  [/^Linked to Crew Center$/i, "已关联机组中心"],
  [/^No local flight link$/i, "未关联本地航班"],
  [/^Queue position (\d+)$/i, "队列顺位 #$1"],
  [/^Linked to (.+)$/i, "已绑定至 $1"],
  [/^(.+) linked to the local fleet\.$/i, "$1 已成功绑定至本地机队。"],
  [/^(.+) · Aircraft schedules$/i, "$1 · 飞机排班表"],
  [/^(.+) · IF status$/i, "$1 · IF 实时状态"],
  [/^Local flight:\s*(.+)$/i, "本地航班：$1"],
  [/^Captain:\s*(.+)$/i, "责任机长：$1"],
  [/^Crew:\s*(.+)$/i, "机组成员：$1"],
  [/^Notes:\s*(.+)$/i, "备注：$1"],
  [/^IF ID:\s*(.+)$/i, "IF 账号 ID：$1"],
  [/^Near ([A-Z0-9]{3,4})$/i, "邻近机场 $1"],
  [/^([\d.]+) NM \(estimate\)$/i, "约 $1 海里（估算）"],
  [/^Position (.+)$/i, "坐标位置 $1"],
  [/^The aircraft must reach ([A-Z0-9]{3,4}) before this flight can start\.$/i, "飞机必须先抵达 $1 机场，方可开始执飞本航段。"],
  [/^The nearby airport differs from ([A-Z0-9]{3,4})\. Review and confirm the actual airport before scheduling\.$/i, "估算邻近机场与确认停场机场 ($1) 不一致，排班前请核实实际位置。"],
  [/^Identify the same flight on (.+)\. Review both plans before confirming\. All times are UTC\.$/i, "在 $1 上识别并绑定同一航班。确认前请核对双方计划（所有时间均为 UTC）。"],
  [/^(\d+) routes?$/i, "$1 条航线"],
  [/^(\d+) hubs?$/i, "$1 座基地"],
  [/^(\d+) aircraft$/i, "$1 架机型"],
  [/^(\d+) hours?$/i, "$1 小时"],
  [/^(\d+)h required$/i, "需满 $1 小时"],
  [/^(\d+) hrs required$/i, "需满 $1 小时"],
  [/^Min\. rank:\s*(.+)$/i, "最低职级：$1"],
  [/^Rank:\s*(.+)$/i, "职级要求：$1"],
  [/^Award:\s*(.+)$/i, "勋章要求：$1"],
];

const EN_TO_ZH_LOWERCASE_PHRASES: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [k, v] of Object.entries(EN_TO_ZH_PHRASES)) {
    map[k.toLowerCase()] = v;
  }
  return map;
})();

function translateSingleSegment(trimmed: string): string {
  if (!trimmed) return trimmed;
  const normalized = trimmed.replace(/\s+/g, " ");

  const exact = EN_TO_ZH_PHRASES[trimmed] ?? EN_TO_ZH_PHRASES[normalized];
  if (exact) {
    return exact;
  }

  const lower = normalized.toLowerCase();
  const caseInsensitive = EN_TO_ZH_LOWERCASE_PHRASES[lower];
  if (caseInsensitive) {
    return caseInsensitive;
  }

  for (const [pattern, replacement] of EN_TO_ZH_PATTERNS) {
    if (pattern.test(normalized)) {
      return normalized.replace(pattern, replacement);
    }
  }

  return trimmed;
}

export function translateTextToZh(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return input;

  const direct = translateSingleSegment(trimmed);
  if (direct !== trimmed) {
    const startIdx = input.indexOf(trimmed);
    if (startIdx !== -1) {
      return (
        input.slice(0, startIdx) +
        direct +
        input.slice(startIdx + trimmed.length)
      );
    }
    return direct;
  }

  // Handle compound strings separated by middle dot " · " (e.g. "Commercial · Captain unavailable · 1/3 crew")
  if (trimmed.includes(" · ")) {
    const parts = trimmed.split(" · ");
    let changed = false;
    const translatedParts = parts.map((part) => {
      const pTrim = part.trim();
      const tPart = translateSingleSegment(pTrim);
      if (tPart !== pTrim) changed = true;
      return tPart;
    });
    if (changed) {
      const joined = translatedParts.join(" · ");
      const startIdx = input.indexOf(trimmed);
      if (startIdx !== -1) {
        return (
          input.slice(0, startIdx) +
          joined +
          input.slice(startIdx + trimmed.length)
        );
      }
      return joined;
    }
  }

  return input;
}

type I18nContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  toggleLocale: () => void;
  t: (en: string, zh: string) => string;
};

const I18nContext = createContext<I18nContextValue>({
  locale: "en",
  setLocale: () => undefined,
  toggleLocale: () => undefined,
  t: (en) => en,
});

type TextTranslationRecord = {
  original: string;
  translated: string;
};

const originalTextMap = new WeakMap<Text, TextTranslationRecord>();
const originalAttrMap = new WeakMap<Element, Map<string, TextTranslationRecord>>();

function applyDomTranslation(root: HTMLElement, locale: Locale) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") {
        return NodeFilter.FILTER_REJECT;
      }
      if (parent.closest("[data-no-i18n]")) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let currentNode = walker.nextNode() as Text | null;
  while (currentNode) {
    const currentValue = currentNode.nodeValue || "";
    const record = originalTextMap.get(currentNode);

    if (locale === "zh") {
      // If React updated the text node in place, `currentValue` will differ from `record.translated`
      const baseText =
        record && currentValue === record.translated
          ? record.original
          : currentValue;
      const translated = translateTextToZh(baseText);
      if (translated !== baseText) {
        originalTextMap.set(currentNode, { original: baseText, translated });
        if (currentNode.nodeValue !== translated) {
          currentNode.nodeValue = translated;
        }
      }
    } else if (record) {
      if (currentValue === record.translated) {
        currentNode.nodeValue = record.original;
      }
      originalTextMap.delete(currentNode);
    }
    currentNode = walker.nextNode() as Text | null;
  }

  const elements = root.querySelectorAll("[placeholder], [title], [aria-label]");
  elements.forEach((el) => {
    if (el.closest("[data-no-i18n]")) return;
    for (const attr of ["placeholder", "title", "aria-label"] as const) {
      const val = el.getAttribute(attr);
      if (!val) continue;
      let attrStore = originalAttrMap.get(el);
      if (!attrStore) {
        attrStore = new Map();
        originalAttrMap.set(el, attrStore);
      }
      const record = attrStore.get(attr);

      if (locale === "zh") {
        const baseVal =
          record && val === record.translated ? record.original : val;
        const translated = translateTextToZh(baseVal);
        if (translated !== baseVal) {
          attrStore.set(attr, { original: baseVal, translated });
          if (val !== translated) {
            el.setAttribute(attr, translated);
          }
        }
      } else if (record) {
        if (val === record.translated) {
          el.setAttribute(attr, record.original);
        }
        attrStore.delete(attr);
      }
    }
  });
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? window.localStorage.getItem(LOCALE_STORAGE_KEY)
        : null;
    const detected = detectPreferredLocale(undefined, saved);
    setLocaleState(detected);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
      } catch {
        // Ignore storage write errors
      }
    }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocaleState((prev) => {
      const next: Locale = prev === "zh" ? "en" : "zh";
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
        } catch {
          // Ignore storage write errors
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";

    const isAutomatedTest =
      typeof process !== "undefined" &&
      (Boolean(process.env.VITEST) || process.env.NODE_ENV === "test");
    if (isAutomatedTest) return;

    applyDomTranslation(document.body, locale);

    if (locale !== "zh") return;

    let rafId: number | null = null;
    const observer = new MutationObserver(() => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        applyDomTranslation(document.body, locale);
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      observer.disconnect();
    };
  }, [locale]);

  const t = useCallback(
    (en: string, zh: string) => (locale === "zh" ? zh : en),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, toggleLocale, t }),
    [locale, setLocale, toggleLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

/**
 * Compact Language Switcher (`中文 / EN`) benchmarked to the `h-8 rounded-[6px] px-2.5 text-[13px]` system.
 */
export function LanguageSwitcher({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  const { locale, toggleLocale } = useI18n();

  return (
    <button
      type="button"
      onClick={toggleLocale}
      data-no-i18n
      aria-label={locale === "zh" ? "Switch to English" : "切换到中文"}
      title={locale === "zh" ? "Switch to English" : "切换到中文"}
      className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-[6px] px-2.5 text-[13px] font-medium text-[var(--v2-text-text-muted,#475569)] transition-colors hover:bg-[#0052a5]/[0.06] hover:text-[#0052a5] ${className}`}
    >
      <Globe className="size-3.5 shrink-0 text-[var(--v2-icon-icon-muted,#64748b)]" />
      {!compact && (
        <span className="font-sans text-[12px] font-medium">
          {locale === "zh" ? "中文 / EN" : "EN / 中文"}
        </span>
      )}
    </button>
  );
}
