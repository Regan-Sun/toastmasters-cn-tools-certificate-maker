"use strict";

/**
 * 名单文本解析：把从微信、表格、备忘录里复制出来的各种写法，
 * 尽量还原成「奖项 + 获奖人」的配对。
 *
 * 设计原则：宁可少解析一行，也不要解析错一行。
 * 因此对无法判断的输入不猜，交给用户手动补。
 */

// 中文顿号/间隔号容易误伤（奖状名本身可能含间隔号），仅当它位于分隔位置时才剥离
const TRAILING_NOISE = /[、，,]\s*$/;

// 前缀噪声：项目符号、序号、emoji
// 注意：不能只做 \s 剥离，emoji 必须显式列出，否则「✅ 最佳主持人」会被切错
const LEADING_NOISE =
  /^[\s\uFEFF]*(?:[-*·•>》✓✔√☑️✅🎤🏆🌟⭐️👏]+|\d+[.、)）:：]\s*|\(\d+\)\s*)+/;

// 「王小明获得最佳主持人」这类语序
const AWARD_THEN_NAME = /^([\u4e00-\u9fa5]{2,6})(?:获得了?|当选了?|是)\s*(.+)$/;

// 人名：2~20 字符，允许中英文、间隔号、空格（复姓/外籍名）
const NAME_LIKE = /^[\u4e00-\u9fa5a-zA-Z·•\s]{2,20}$/;

/** 分隔符：全角冒号/制表符等强信号优先，弱信号（逗号、单空格）放最后 */
const SEPARATOR_PATTERN =
  /^(.+?)\s*(?:\t+|[：:＝=]|丨|\||[，,]|\s{2,}|\s)\s*(.+)$/;

function cleanCell(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .trim();
}

function stripLeadingNoise(text) {
  return cleanCell(String(text).replace(LEADING_NOISE, ""));
}

function stripTrailingNoise(text) {
  return cleanCell(String(text).replace(TRAILING_NOISE, ""));
}

/** 是否像人名。要求含中文或字母，纯数字/纯标点不算。 */
function isNameLike(value) {
  const text = cleanCell(value);
  if (!text || text.length > 20) return false;
  if (!/[\u4e00-\u9fa5a-zA-Z]/.test(text)) return false;
  // 含分隔符特征的一律不当作人名（如「获得最佳主持人」整句）
  if (/[:：=丨|]/.test(text)) return false;
  // 叙述句不当成人名
  if (isSentenceLike(text)) return false;
  return NAME_LIKE.test(text);
}

/** 明显是叙述句/统计句的标志：包含计数、日期、参会、通知等 */
const SENTENCE_LIKE =
  /\d+\s*(?:人|位|名|次|个|场|期|届|分钟|小时)|\d{4}\s*年|共\s*\d+|截止|报名|签到|合影|茶歇|通知|本周|上周|下次|今天|明天|例会|地点|时间[:：]/;

/** 奖项名的高置信特征词。命中即可直接定性，不再依赖长度猜测。 */
const AWARD_KEYWORDS =
  /最佳|优秀|之星|奖|担当|贡献|进步|潜力|小蜜蜂|主持人|点评|即兴|演讲|评估|计时|暖场|破冰|整场|全场|人气|参与/i;

/** 整行是否像一句叙述而非「奖项+人名」记录 */
function isSentenceLike(text) {
  const value = cleanCell(text);
  if (!value) return true;
  return SENTENCE_LIKE.test(value);
}

/**
 * 强判定：明确含奖项特征词，且不像叙述句。
 */
function isStrongAward(text) {
  const value = cleanCell(text);
  if (isSentenceLike(value)) return false;
  return AWARD_KEYWORDS.test(value);
}

/**
 * 判断哪一段更像奖项名（弱判定）。
 * 仅在没有强特征时才退化为长度启发式。
 */
function looksLikeAward(text) {
  const value = cleanCell(text);
  if (!value) return false;
  if (isStrongAward(value)) return true;
  return value.length >= 6;
}

/**
 * 解析单行。
 * @returns {{award: string, winner: string}|null}
 */
function parseLine(rawLine) {
  const stripped = stripLeadingNoise(rawLine);
  if (!stripped) return null;

  // 整行就是叙述句/统计句（如「本周共33人参加」「签到时间：19:30」），
  // 不是「奖项+人名」记录，直接不解析。
  if (isSentenceLike(stripped)) return null;

  // 语序一：「王小明获得最佳主持人」
  const awarded = stripped.match(AWARD_THEN_NAME);
  if (awarded) {
    return { award: stripTrailingNoise(awarded[2]), winner: awarded[1] };
  }

  // 语序二：靠分隔符切成左右两段
  const match = stripped.match(SEPARATOR_PATTERN);
  if (!match) {
    // 整行像人名 —— 奖项名缺失，留空由用户补
    return isNameLike(stripped) ? { award: "", winner: stripped } : null;
  }

  let left = stripTrailingNoise(stripLeadingNoise(match[1]));
  let right = stripTrailingNoise(match[2]);
  if (!left || !right) return null;

  // 分隔符切出来的边界可能不准，用「像不像」纠正方向。
  // 强特征词优先：左段命中「最佳/之星」等词时，绝不因为右段更长就翻转，
  // 否则「最佳即兴：Alex Chen」会把外籍名误当成奖项。
  const leftStrong = isStrongAward(left);
  const rightStrong = isStrongAward(right);
  const leftIsName = isNameLike(left);
  const rightIsName = isNameLike(right);

  if (leftStrong && !rightStrong) {
    // 左是奖项、右不是 —— 保持原样
  } else if (rightStrong && !leftStrong) {
    [left, right] = [right, left];
  } else if (leftStrong && rightStrong) {
    // 两边都是奖项名：取更长的那个作为奖项（奖项名通常比人名长）
    if (right.length > left.length) [left, right] = [right, left];
  } else if (leftIsName && rightIsName) {
    // 两边都没有特征词：退化为长度启发式
    if (left.length <= 4 && right.length >= 6) {
      [left, right] = [right, left];
    }
  }

  return { award: left, winner: right };
}

/**
 * 解析整段文本。
 * @returns {{rows: {award: string, winner: string}[], skipped: string[]}}
 */
function parseRoster(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const rows = [];
  const skipped = [];

  lines.forEach((rawLine) => {
    const line = cleanCell(rawLine);
    if (!line) return;
    // 分隔线
    if (/^[-=_*·\s]{3,}$/.test(line)) return;

    // 表头：含「奖项」且含「姓名/名字/获奖人」，且没有冒号
    if (/奖项/.test(line) && /姓名|名字|获奖/.test(line) && !/[:：]/.test(line)) return;
    // 纯表头「姓名」单独一行
    if (/^(获奖人姓名|获奖人|姓名|名字|奖项|奖项名称)$/.test(line)) return;

    const parsed = parseLine(rawLine);
    if (!parsed) {
      skipped.push(line);
      return;
    }
    rows.push(parsed);
  });

  return { rows, skipped };
}

/** 导出成可再次粘贴的纯文本。 */
function rowsToText(rows) {
  return rows.map((row) => `${row.award}：${row.winner}`).join("\n");
}

window.TMRosterParser = { parseRoster, rowsToText };