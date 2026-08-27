import type { RawComplaint, NormalizedOre } from "./types";

const PERSONAL_NAME_PATTERN = /([A-Z][a-z]+\s[A-Z][a-z]+|[ぁ-ん]{1,4}[一-龥]{1,2}さん)/g;

const COMPANY_RULES: [RegExp, string][] = [
  [/Amazon/i, "Amazon"], [/Google/i, "Google"], [/Apple/i, "Apple"],
  [/Microsoft/i, "Microsoft"], [/楽天/i, "楽天"], [/Yahoo/i, "Yahoo"],
  [/LINE/i, "LINE"], [/メルカリ/i, "メルカリ"], [/Uber/i, "Uber Eats"],
  [/Netflix/i, "Netflix"], [/Spotify/i, "Spotify"],
  [/ドコモ/i, "ドコモ"], [/\bau\b/i, "au"], [/ソフトバンク/i, "ソフトバンク"], [/NTT/i, "NTT"],
  [/三菱UFJ/i, "三菱UFJ"], [/みずほ/i, "みずほ"], [/三井住友/i, "三井住友"], [/ゆうちょ/i, "ゆうちょ"],
  [/JR/i, "JR"], [/ANA/i, "ANA"], [/JAL/i, "JAL"],
  [/セブン/i, "セブン"], [/ローソン/i, "ローソン"], [/ファミマ/i, "ファミマ"],
  [/Slack/i, "Slack"], [/Zoom/i, "Zoom"], [/Teams/i, "Teams"], [/Discord/i, "Discord"],
  [/Instagram/i, "Instagram"], [/TikTok/i, "TikTok"], [/Facebook/i, "Facebook"], [/Meta/i, "Meta"],
  [/PayPay/i, "PayPay"], [/Suica/i, "Suica"], [/PASMO/i, "PASMO"],
  [/au PAY/i, "au PAY"], [/d払い/i, "d払い"], [/マイナポータル/i, "マイナポータル"],
];

export function anonymize(text: string): string {
  return text.replace(PERSONAL_NAME_PATTERN, "〇〇さん");
}

export function extractCompanyNames(text: string): string[] {
  const found: string[] = [];
  for (const [pattern, canonical] of COMPANY_RULES) {
    if (pattern.test(text)) {
      found.push(canonical);
    }
  }
  return [...new Set(found)];
}

export function extractTags(text: string, source: RawComplaint["source"]): string[] {
  const tags: string[] = [];

  const categoryKeywords: Record<string, string[]> = {
    "UX": ["使いにくい", "UI", "操作", "画面", "ボタン", "わかりにくい", "見づらい", "デザイン"],
    "カスタマーサポート": ["サポート", "問い合わせ", "対応", "返信", "電話", "窓口", "オペレーター"],
    "配送": ["届かない", "配達", "配送", "遅い", "届く", "delivery", "shipping"],
    "認証": ["パスワード", "ログイン", "認証", "二段階", "SMS", "OTP", "password", "login"],
    "課金": ["課金", "サブスク", "解約", "料金", "値上げ", "pricing", "subscription"],
    "バグ": ["バグ", "クラッシュ", "落ちる", "フリーズ", "エラー", "bug", "crash"],
    "予約": ["予約", "キャンセル", "空き", "予約取れない"],
    "通知": ["通知", "プッシュ", "アラート", "メール", "notification"],
    "プライバシー": ["個人情報", "プライバシー", "データ", "追跡", "privacy", "tracking"],
    "広告": ["広告", "CM", "ad", "宣伝", "スパム"],
    "医療": ["病院", "医者", "薬", "診察", "クリニック"],
    "銀行": ["銀行", "口座", "振込", "ATM", "bank"],
    "EC": ["通販", "注文", "返品", "カート", "購入", "Amazon", "楽天"],
    "交通": ["電車", "バス", "JR", "遅延", "運休", "Suica"],
  };

  for (const [tag, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((kw) => text.includes(kw))) {
      tags.push(tag);
    }
  }

  if (tags.length === 0) {
    tags.push("その他");
  }

  return tags.slice(0, 5);
}

export function isValidOre(text: string): boolean {
  if (text.length < 10) return false;
  if (text.length > 500) return false;
  if (/人間がクソ|死ね|殺す/i.test(text)) return false;
  return true;
}

export function normalize(raw: RawComplaint): NormalizedOre | null {
  let body = raw.rawText.trim();

  if (!isValidOre(body)) return null;

  body = anonymize(body);
  const companyNames = extractCompanyNames(body);
  if (raw.appName) {
    const cleaned = raw.appName.replace(/\s*[-–—].*$/, "").trim();
    if (cleaned && !companyNames.includes(cleaned)) {
      companyNames.push(cleaned);
    }
  }

  const tags = extractTags(body, raw.source);

  return {
    body,
    tags,
    companyNames,
    source: raw.source,
    sourceId: raw.sourceId,
    sourceUrl: raw.url,
    empathyCount: 0,
    createdAt: raw.scrapedAt || Date.now(),
    authorId: `${raw.source}:anonymous`,
  };
}
