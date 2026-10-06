"use strict";

const TOP_LOGO_SRC = window.TM_GLOBE_LOGO_DATA_URL || "";
const DISTRICT_MARK_SRC = window.TM_DISTRICT_118_DATA_URL || "";
const STORAGE_KEY = "tm_certificate_maker_state_v1";
const HISTORY_KEY = "tm_certificate_maker_history_v1";
const HISTORY_LIMIT = 20;
const DEFAULT_AWARDS = [
  "最佳小蜜蜂",
  "最佳主持人",
  "最佳即兴",
  "最佳点评人",
  "我们记住你啦",
  "最热心头马人",
];

const DEFAULT_TEMPLATE_TEXTS = {
  title: "Division X",
  presented: "Presented to",
  description: "Toastmasters District 118",
  managerLabel: "会议经理",
  dateLabel: "日　期",
  presidentLabel: "会长",
};

/**
 * 奖状版式参数。
 *
 * 字号取向：让文字在2200x1528 画布上占据更有存在感的比例，
 * 而不是在中间挤成一条窄带。原则是「获奖人姓名是主角」——
 * 姓名和奖项名用最大字号，说明性文字次之，落款标签最小。
 *
 * maxWidth 的取值不是随手写的：它同时承担两个职责——
 * ① 防止文字压到左右装饰区；② 在 drawFittedText 里充当溢出阈值。
 * 所以放宽字号的同时也要按比例放宽 maxWidth，否则放大不生效。
 */
const DISTRICT_CERT = {
  width: 2200,
  height: 1528,
  title: {
    x: 1100,
    y: 268,
    size: 78,
    minSize: 48,
    maxWidth: 760,
    // 到下方奖项名的垂直间距为 172，留约 3/4 给字高
    maxHeight: 130,
    color: "#004165",
    weight: "800",
    family: '"Arial","Helvetica Neue","PingFang SC","Noto Sans SC",sans-serif',
  },
  award: {
    x: 1100,
    y: 440,
    size: 108,
    minSize: 56,
    maxWidth: 1180,
    maxHeight: 150,
    color: "#050505",
    weight: "900",
    family: '"Arial Black","Arial","Helvetica Neue","PingFang SC","Noto Sans SC",sans-serif',
  },
  presented: {
    x: 1100,
    y: 610,
    size: 54,
    minSize: 34,
    maxWidth: 680,
    maxHeight: 100,
    color: "#050505",
    weight: "700",
    family: '"Arial","Helvetica Neue","PingFang SC","Noto Sans SC",sans-serif',
  },
  winner: {
    x: 1100,
    y: 768,
    size: 148,
    minSize: 64,
    maxWidth: 1300,
    // 距横线908 有 140 空间，不能让它压线
    maxHeight: 132,
    color: "#050505",
    weight: "800",
    family: '"Arial","Helvetica Neue","PingFang SC","Noto Sans SC",sans-serif',
  },
  description: {
    x: 1100,
    y: 962,
    size: 40,
    minSize: 26,
    maxWidth: 860,
    // 距落款签名线 1150 有 188 空间
    maxHeight: 80,
    color: "#050505",
    weight: "500",
    family: '"Arial","Helvetica Neue","PingFang SC","Noto Sans SC",sans-serif',
  },
  signatures: {
    lineY: 1150,
    nameY: 1098,
    labelY: 1194,
    lineWidth: 560,
    lineWeight: 5,
    nameSize: 58,
    labelSize: 36,
    color: "#666666",
    textColor: "#4d4d4d",
    x: {
      manager: 500,
      date: 1100,
      president: 1700,
    },
  },
  mainRule: { x: 1100, y: 908, width: 1040, weight: 5 },
  topLogo: { x: 1828, y: 86, width: 240, height: 199 },
  districtMark: { x: 1585, y: 1265, width: 430, height: 191 },
};

const state = {
  awards: DEFAULT_AWARDS.map((award) => ({ award, winner: "" })),
  certificates: [],
  history: [],
  pendingRows: [],
};

const topLogoImage = new Image();
const districtMarkImage = new Image();
const requiredImages = [topLogoImage, districtMarkImage];

const els = {
  templateState: document.querySelector("#templateState"),
  meetingManager: document.querySelector("#meetingManager"),
  president: document.querySelector("#president"),
  certDate: document.querySelector("#certDate"),
  certTitle: document.querySelector("#certTitle"),
  presentedText: document.querySelector("#presentedText"),
  descriptionText: document.querySelector("#descriptionText"),
  managerLabel: document.querySelector("#managerLabel"),
  dateLabel: document.querySelector("#dateLabel"),
  presidentLabel: document.querySelector("#presidentLabel"),
  awardList: document.querySelector("#awardList"),
  clearWinnersBtn: document.querySelector("#clearWinnersBtn"),
  addAwardBtn: document.querySelector("#addAwardBtn"),
  generateBtn: document.querySelector("#generateBtn"),
  progress: document.querySelector("#progress"),
  progressBar: document.querySelector("#progressBar"),
  progressText: document.querySelector("#progressText"),
  previewSection: document.querySelector("#previewSection"),
  previewCount: document.querySelector("#previewCount"),
  previewList: document.querySelector("#previewList"),
  downloadAllBtn: document.querySelector("#downloadAllBtn"),
  saveFolderBtn: document.querySelector("#saveFolderBtn"),
  wechatTip: document.querySelector("#wechatTip"),
  toggleRosterBtn: document.querySelector("#toggleRosterBtn"),
  rosterBody: document.querySelector("#rosterBody"),
  rosterInput: document.querySelector("#rosterInput"),
  parseRosterBtn: document.querySelector("#parseRosterBtn"),
  readClipboardBtn: document.querySelector("#readClipboardBtn"),
  rosterFile: document.querySelector("#rosterFile"),
  parseReport: document.querySelector("#parseReport"),
  parsePreview: document.querySelector("#parsePreview"),
  parseList: document.querySelector("#parseList"),
  parseSummary: document.querySelector("#parseSummary"),
  applyRosterBtn: document.querySelector("#applyRosterBtn"),
  cancelParseBtn: document.querySelector("#cancelParseBtn"),
  historyPanel: document.querySelector("#historyPanel"),
  historyList: document.querySelector("#historyList"),
  clearHistoryBtn: document.querySelector("#clearHistoryBtn"),
  dialog: document.querySelector("#messageDialog"),
  dialogTitle: document.querySelector("#dialogTitle"),
  dialogMessage: document.querySelector("#dialogMessage"),
  canvas: document.querySelector("#certificateCanvas"),
};

const ctx = els.canvas.getContext("2d");

function init() {
  requiredImages.forEach((image) => {
    image.addEventListener("load", updateTemplateState);
    image.addEventListener("error", () => {
      els.templateState.textContent = "模板缺失";
      els.templateState.className = "template-state error";
      showMessage("模板加载失败", "请确认模板资源和 index.html 位于同一目录。");
    });
  });

  topLogoImage.src = TOP_LOGO_SRC;
  districtMarkImage.src = DISTRICT_MARK_SRC;

  if (!TOP_LOGO_SRC || !DISTRICT_MARK_SRC) {
    els.templateState.textContent = "模板缺失";
    els.templateState.className = "template-state error";
  }

  loadSavedState();
  loadHistory();
  renderAwards();
  renderHistory();
  syncWechatMode();

  els.meetingManager.addEventListener("input", saveState);
  els.president.addEventListener("input", saveState);
  els.certDate.addEventListener("change", saveState);
  getTemplateTextInputs().forEach((input) => {
    input.addEventListener("input", saveState);
  });
  els.addAwardBtn.addEventListener("click", addAward);
  els.clearWinnersBtn.addEventListener("click", clearWinners);
  els.generateBtn.addEventListener("click", generateCertificates);
  els.downloadAllBtn.addEventListener("click", downloadAll);
  els.saveFolderBtn.addEventListener("click", saveToFolder);

  els.toggleRosterBtn.addEventListener("click", toggleRosterPanel);
  els.parseRosterBtn.addEventListener("click", () => handleRosterText(els.rosterInput.value));
  els.readClipboardBtn.addEventListener("click", readClipboardRoster);
  els.rosterFile.addEventListener("change", handleRosterFile);
  els.applyRosterBtn.addEventListener("click", applyPendingRows);
  els.cancelParseBtn.addEventListener("click", cancelPendingRows);
  els.clearHistoryBtn.addEventListener("click", clearHistory);
}

function loadSavedState() {
  const today = new Date().toISOString().slice(0, 10);
  els.certDate.value = today;

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    els.meetingManager.value = saved.meetingManager || "";
    els.president.value = saved.president || "";
    els.certDate.value = saved.date || today;
    loadTemplateTexts(saved.templateTexts);
    if (Array.isArray(saved.awards) && saved.awards.length > 0) {
      state.awards = saved.awards.map((item) => ({
        award: String(item.award || ""),
        winner: String(item.winner || ""),
      }));
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    loadTemplateTexts();
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      president: els.president.value,
      meetingManager: els.meetingManager.value,
      date: els.certDate.value,
      templateTexts: getTemplateTexts(),
      awards: state.awards,
    }),
  );
}

function loadTemplateTexts(savedTexts = {}) {
  els.certTitle.value = readSavedText(savedTexts.title, DEFAULT_TEMPLATE_TEXTS.title);
  els.presentedText.value = readSavedText(savedTexts.presented, DEFAULT_TEMPLATE_TEXTS.presented);
  els.descriptionText.value = readSavedText(savedTexts.description, DEFAULT_TEMPLATE_TEXTS.description);
  els.managerLabel.value = readSavedText(savedTexts.managerLabel, DEFAULT_TEMPLATE_TEXTS.managerLabel);
  els.dateLabel.value = normalizeDateLabel(
    readSavedText(savedTexts.dateLabel, DEFAULT_TEMPLATE_TEXTS.dateLabel),
  );
  els.presidentLabel.value = readSavedText(savedTexts.presidentLabel, DEFAULT_TEMPLATE_TEXTS.presidentLabel);
}

function readSavedText(value, fallback) {
  return typeof value === "string" ? value : fallback;
}

/**
 * 旧版本默认的日期标签是「日    期」（多个连续空格）。
 * 字号放大后那串空格会占掉过多宽度，所以把「日+若干空白+期」
 * 统一规范成全角空格；但如果是用户自己改过的其他文字，保持原样不动。
 */
function normalizeDateLabel(value) {
  return /^日\s+期$/.test(value) ? DEFAULT_TEMPLATE_TEXTS.dateLabel : value;
}

function getTemplateTexts() {
  return {
    title: els.certTitle.value,
    presented: els.presentedText.value,
    description: els.descriptionText.value,
    managerLabel: els.managerLabel.value,
    dateLabel: els.dateLabel.value,
    presidentLabel: els.presidentLabel.value,
  };
}

function getTemplateTextInputs() {
  return [
    els.certTitle,
    els.presentedText,
    els.descriptionText,
    els.managerLabel,
    els.dateLabel,
    els.presidentLabel,
  ];
}

function renderAwards() {
  els.awardList.replaceChildren();

  state.awards.forEach((item, index) => {
    const row = document.createElement("article");
    row.className = "award-item";

    const badge = document.createElement("span");
    badge.className = "award-index";
    badge.textContent = `第 ${index + 1} 项`;

    const awardField = createTextField(
      "奖项名称",
      item.award,
      "请输入奖项名称",
      (value) => {
        state.awards[index].award = value;
        saveState();
        invalidateCertificates();
      },
      `award-name-${index}`,
    );

    const winnerField = createTextField(
      "获奖人",
      item.winner,
      "请输入获奖人名字",
      (value) => {
        state.awards[index].winner = value;
        saveState();
        invalidateCertificates();
      },
      `winner-name-${index}`,
    );

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "icon-btn";
    deleteBtn.type = "button";
    deleteBtn.title = "删除奖项";
    deleteBtn.setAttribute("aria-label", `删除第 ${index + 1} 项`);
    deleteBtn.textContent = "×";
    deleteBtn.disabled = state.awards.length === 1;
    deleteBtn.addEventListener("click", () => {
      state.awards.splice(index, 1);
      saveState();
      renderAwards();
      invalidateCertificates();
    });

    row.append(badge, awardField, winnerField, deleteBtn);
    els.awardList.append(row);
  });
}

function createTextField(labelText, value, placeholder, onInput, testId) {
  const label = document.createElement("label");
  label.className = "field";

  const caption = document.createElement("span");
  caption.textContent = labelText;

  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.placeholder = placeholder;
  input.setAttribute("data-testid", testId);
  input.addEventListener("input", () => onInput(input.value));

  label.append(caption, input);
  return label;
}

function addAward() {
  state.awards.push({ award: "", winner: "" });
  saveState();
  renderAwards();
  invalidateCertificates();
  const lastInput = els.awardList.querySelector(".award-item:last-child input");
  lastInput?.focus();
}

function clearWinners() {
  state.awards = state.awards.map((item) => ({ ...item, winner: "" }));
  saveState();
  renderAwards();
}

async function generateCertificates() {
  const validation = validateAwards();
  if (validation) {
    showMessage("还差一点信息", validation);
    return;
  }

  if (!allTemplateAssetsReady()) {
    showMessage("模板还没加载好", "请稍等模板资源加载完成后再生成。");
    return;
  }

  els.generateBtn.disabled = true;
  els.downloadAllBtn.disabled = true;
  setProgress(0, state.awards.length, "准备生成");
  state.certificates = [];

  for (let index = 0; index < state.awards.length; index += 1) {
    const item = state.awards[index];
    setProgress(index, state.awards.length, `正在生成：${item.award.trim()}`);
    await nextFrame();
    const rendered = drawCertificate(item.award.trim(), item.winner.trim());
    state.certificates.push({
      award: item.award.trim(),
      winner: item.winner.trim(),
      dataUrl: rendered.dataUrl,
      width: rendered.width,
      height: rendered.height,
      saved: false,
    });
  }

  setProgress(state.awards.length, state.awards.length, "生成完成");
  renderPreviews();
  saveState();
  archiveCurrentMeeting();
  els.previewSection.classList.remove("hidden");
  els.previewSection.scrollIntoView({ behavior: "smooth", block: "start" });

  setTimeout(() => {
    els.progress.classList.add("hidden");
    els.generateBtn.disabled = false;
    els.downloadAllBtn.disabled = false;
  }, 350);
}

function validateAwards() {
  if (!els.certDate.value) return "请选择证书日期。";
  if (state.awards.length === 0) return "请至少添加一个奖项。";

  for (let index = 0; index < state.awards.length; index += 1) {
    const award = state.awards[index].award.trim();
    const winner = state.awards[index].winner.trim();
    if (!award) return `第 ${index + 1} 项的奖项名称不能为空。`;
    if (!winner) return `第 ${index + 1} 项的获奖人不能为空。`;
  }

  return "";
}

function drawCertificate(awardName, winnerName) {
  return drawDistrictCertificate(awardName, winnerName);
}

function drawDistrictCertificate(awardName, winnerName) {
  const CERT = DISTRICT_CERT;
  const templateTexts = getTemplateTexts();
  prepareCanvas(CERT.width, CERT.height);
  ctx.clearRect(0, 0, CERT.width, CERT.height);
  drawDistrictBackground();

  ctx.drawImage(
    topLogoImage,
    CERT.topLogo.x,
    CERT.topLogo.y,
    CERT.topLogo.width,
    CERT.topLogo.height,
  );
  ctx.drawImage(
    districtMarkImage,
    CERT.districtMark.x,
    CERT.districtMark.y,
    CERT.districtMark.width,
    CERT.districtMark.height,
  );

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  drawFittedText(templateTexts.title, CERT.title);
  drawFittedText(awardName, CERT.award);
  drawFittedText(templateTexts.presented, CERT.presented);
  drawFittedText(winnerName, CERT.winner);

  drawDistrictRule(
    CERT.mainRule.x,
    CERT.mainRule.y,
    CERT.mainRule.width,
    CERT.mainRule.weight,
    "#050505",
  );
  drawFittedText(templateTexts.description, CERT.description);

  drawDistrictSignatures(templateTexts);

  return {
    dataUrl: els.canvas.toDataURL("image/png"),
    width: CERT.width,
    height: CERT.height,
  };
}

function drawDistrictBackground() {
  const { width, height } = DISTRICT_CERT;

  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#8a1730";
  ctx.fillRect(900, 22, width - 922, 860);

  ctx.fillStyle = "#004165";
  ctx.beginPath();
  ctx.moveTo(22, 900);
  ctx.bezierCurveTo(165, 1135, 420, 1375, 900, height - 22);
  ctx.lineTo(22, height - 22);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#aab6b6";
  ctx.beginPath();
  ctx.moveTo(145, 1050);
  ctx.bezierCurveTo(445, 1335, 820, 1490, 1370, height - 22);
  ctx.lineTo(1075, height - 22);
  ctx.bezierCurveTo(705, 1478, 380, 1335, 90, 990);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#f2df74";
  ctx.beginPath();
  ctx.moveTo(275, 1195);
  ctx.bezierCurveTo(650, 1425, 1005, 1508, 1605, height - 22);
  ctx.lineTo(1345, height - 22);
  ctx.bezierCurveTo(895, 1485, 590, 1388, 245, 1150);
  ctx.closePath();
  ctx.fill();

  drawDistrictWhiteBody("#f3f3f3", 0, 0);
  drawDistrictWhiteBody("#ffffff", -18, -18);

  ctx.strokeStyle = "#cfcfcf";
  ctx.lineWidth = 2;
  ctx.strokeRect(22, 22, width - 44, height - 44);
  ctx.restore();
}

function drawDistrictWhiteBody(color, dx, dy) {
  ctx.beginPath();
  ctx.moveTo(22 + dx, 22 + dy);
  ctx.lineTo(930 + dx, 22 + dy);
  ctx.bezierCurveTo(1425 + dx, 45 + dy, 1885 + dx, 265 + dy, 2115 + dx, 715 + dy);
  ctx.bezierCurveTo(2160 + dx, 770 + dy, 2190 + dx, 820 + dy, 2190 + dx, 865 + dy);
  ctx.lineTo(2190 + dx, 1506 + dy);
  ctx.lineTo(1285 + dx, 1506 + dy);
  ctx.bezierCurveTo(820 + dx, 1490 + dy, 330 + dx, 1320 + dy, 22 + dx, 900 + dy);
  ctx.lineTo(22 + dx, 22 + dy);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function prepareCanvas(width, height) {
  if (els.canvas.width !== width) els.canvas.width = width;
  if (els.canvas.height !== height) els.canvas.height = height;
}

function drawDistrictRule(centerX, y, width, lineWidth, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.moveTo(centerX - width / 2, y);
  ctx.lineTo(centerX + width / 2, y);
  ctx.stroke();
  ctx.restore();
}

function drawDistrictSignatures(templateTexts) {
  const { signatures } = DISTRICT_CERT;
  const meetingManager = els.meetingManager.value.trim();
  const president = els.president.value.trim();
  const date = formatCertificateDate(els.certDate.value);
  const columns = [
    { x: signatures.x.manager, name: meetingManager, label: templateTexts.managerLabel },
    { x: signatures.x.date, name: date, label: templateTexts.dateLabel },
    { x: signatures.x.president, name: president, label: templateTexts.presidentLabel },
  ];

  ctx.save();
  columns.forEach((column) => {
    drawDistrictRule(
      column.x,
      signatures.lineY,
      signatures.lineWidth,
      signatures.lineWeight,
      "#050505",
    );
    if (column.name) {
      drawFittedText(column.name, {
        x: column.x,
        y: signatures.nameY,
        size: signatures.nameSize,
        minSize: 32,
        maxWidth: signatures.lineWidth - 40,
        color: signatures.textColor,
        weight: "700",
        family: '"STKaiti","Kaiti SC","KaiTi","Noto Serif CJK SC",serif',
      });
    }
    drawFittedText(column.label, {
      x: column.x,
      y: signatures.labelY,
      size: signatures.labelSize,
      minSize: 26,
      maxWidth: signatures.lineWidth - 40,
      color: signatures.color,
      weight: "700",
      family: '"STKaiti","Kaiti SC","KaiTi","Noto Serif CJK SC",serif',
    });
  });
  ctx.restore();
}

function formatCertificateDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  return `${match[1]}年${match[2]}月${match[3]}日`;
}

/**
 * 绘制自适应文字：宽度或高度任一超出上限就逐步缩小，直到 minSize。
 *
 * 为什么加了高度约束：原实现只按 maxWidth 收缩。字号整体放大后，
 * 用户若把「说明文字」改成多行长句，即使宽度勉强够，也会因为
 * 行高过大压到下方横线或落款区。补上 maxHeight 才能真正兜住。
 */
function drawFittedText(text, spec, options = {}) {
  const value = String(text ?? "");
  let fontSize = spec.size;
  ctx.fillStyle = spec.color;
  ctx.strokeStyle = spec.color;
  ctx.lineJoin = "round";

  const fits = (size) => {
    ctx.font = `${spec.weight} ${size}px ${spec.family}`;
    const metrics = ctx.measureText(value);
    if (metrics.width > spec.maxWidth) return false;
    if (spec.maxHeight && metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent > spec.maxHeight) {
      return false;
    }
    return true;
  };

  if (!fits(fontSize)) {
    while (fontSize > spec.minSize && !fits(fontSize)) {
      fontSize -= 2;
    }
    ctx.font = `${spec.weight} ${fontSize}px ${spec.family}`;
  }

  if (options.stroke) {
    ctx.lineWidth = Math.max(2, Math.round(fontSize / 38));
    ctx.strokeText(value, spec.x, spec.y);
  }

  ctx.fillText(value, spec.x, spec.y);
}

function renderPreviews() {
  els.previewList.replaceChildren();
  els.previewCount.textContent = `已生成 ${state.certificates.length} 张`;

  state.certificates.forEach((certificate, index) => {
    const card = document.createElement("article");
    card.className = "certificate-card";

    const image = document.createElement("img");
    image.src = certificate.dataUrl;
    image.alt = `${certificate.award} - ${certificate.winner}`;
    image.style.aspectRatio = `${certificate.width || DISTRICT_CERT.width} / ${
      certificate.height || DISTRICT_CERT.height
    }`;

    const footer = document.createElement("div");
    footer.className = "certificate-footer";

    const meta = document.createElement("div");
    meta.className = "certificate-meta";

    const award = document.createElement("strong");
    award.textContent = certificate.award;

    const winner = document.createElement("span");
    winner.textContent = certificate.winner;
    meta.append(award, winner);

    const actions = document.createElement("div");
    actions.className = "certificate-actions";

    const status = document.createElement("span");
    status.className = "status-pill";
    status.textContent = certificate.saved ? "已保存" : "待保存";
    if (certificate.saved) status.classList.add("saved");

    const saveBtn = document.createElement("button");
    saveBtn.className = "save-one-btn";
    saveBtn.type = "button";
    saveBtn.textContent = certificate.saved ? "已保存" : "保存";
    saveBtn.disabled = certificate.saved || isWechat();
    saveBtn.addEventListener("click", () => downloadOne(index));

    actions.append(status, saveBtn);
    footer.append(meta, actions);
    card.append(image, footer);
    els.previewList.append(card);
  });
}

function downloadOne(index) {
  const certificate = state.certificates[index];
  if (!certificate) return;

  downloadDataUrl(certificate.dataUrl, buildFileName(certificate));
  certificate.saved = true;
  renderPreviews();
}

/**
 * 打包下载：把所有奖状打成一个 ZIP。
 *
 * 为什么不逐张下载：原实现靠 setTimeout 逐个触发浏览器下载，
 * 一次会议 6 张就是 6 次下载弹窗，Safari/微信下经常只落地前几张。
 * PNG 本身已压缩，用 store 模式打包体积几乎不变，但只下载一次。
 */
async function downloadAll() {
  if (isWechat() || state.certificates.length === 0) return;

  els.downloadAllBtn.disabled = true;
  els.downloadAllBtn.textContent = "打包中...";

  try {
    const files = state.certificates.map((certificate) => ({
      name: buildFileName(certificate),
      dataUrl: certificate.dataUrl,
    }));
    const blob = window.TMCertificateZip.createZip(files);
    downloadBlob(blob, buildZipFileName());
    state.certificates.forEach((certificate) => {
      certificate.saved = true;
    });
    renderPreviews();
  } catch (error) {
    showMessage("打包失败", `没能生成压缩包：${error.message || "未知错误"}。可以改用「存到文件夹」或单张保存。`);
  } finally {
    els.downloadAllBtn.disabled = false;
    els.downloadAllBtn.textContent = "打包下载 ZIP";
  }
}

/**
 * 存到指定文件夹：Chrome/Edge 支持 File System Access API，
 * 一次选定目录后所有奖状直接落盘，不再经过下载栏。
 */
async function saveToFolder() {
  if (state.certificates.length === 0) return;

  if (typeof window.showDirectoryPicker !== "function") {
    showMessage(
      "当前浏览器不支持",
      "直接存文件夹需要 Chrome 或 Edge。其他浏览器请用「打包下载 ZIP」。",
    );
    return;
  }

  els.saveFolderBtn.disabled = true;
  const originalText = els.saveFolderBtn.textContent;
  els.saveFolderBtn.textContent = "选择文件夹...";

  try {
    const directory = await window.showDirectoryPicker({ mode: "readwrite" });
    for (let index = 0; index < state.certificates.length; index += 1) {
      const certificate = state.certificates[index];
      if (certificate.saved) continue;
      const blob = dataUrlToBlob(certificate.dataUrl);
      const fileHandle = await directory.getFileHandle(buildFileName(certificate), {
        create: true,
      });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      certificate.saved = true;
      els.saveFolderBtn.textContent = `已保存 ${index + 1}/${state.certificates.length}`;
      await nextFrame();
    }
    renderPreviews();
  } catch (error) {
    if (error && error.name === "AbortError") {
      showMessage("已取消", "没有选择文件夹，奖状没有被保存。");
    } else {
      showMessage("保存失败", `写入文件夹时出错：${error.message || "未知错误"}。可以改用「打包下载 ZIP」。`);
    }
  } finally {
    els.saveFolderBtn.disabled = false;
    els.saveFolderBtn.textContent = originalText;
  }
}

function dataUrlToBlob(dataUrl) {
  const [header, base64] = String(dataUrl).split(",");
  const mimeMatch = header.match(/data:([^;]+)/);
  const mime = mimeMatch ? mimeMatch[1] : "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // 立即 revoke 会让部分浏览器来不及取数据，延后释放
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function downloadDataUrl(dataUrl, fileName) {
  downloadBlob(dataUrlToBlob(dataUrl), fileName);
}

/** ZIP 包名：日期 + 会议经理，便于在下载栏里区分多场会议。 */
function buildZipFileName() {
  const manager = els.meetingManager.value.trim();
  const date = els.certDate.value || new Date().toISOString().slice(0, 10);
  const parts = [`奖状_${date}`];
  if (manager) parts.push(cleanFileSegment(manager));
  return `${parts.join("_")}.zip`;
}

function buildFileName(certificate) {
  const safeAward = cleanFileSegment(certificate.award);
  const safeWinner = cleanFileSegment(certificate.winner);
  return `${safeAward}-${safeWinner}-奖状.png`;
}

function cleanFileSegment(value) {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() || "未命名";
}

function setProgress(current, total, text) {
  els.progress.classList.remove("hidden");
  const percent = total === 0 ? 0 : Math.round((current / total) * 100);
  els.progressBar.style.width = `${percent}%`;
  els.progressText.textContent = text;
}

function syncWechatMode() {
  const wechat = isWechat();
  els.wechatTip.classList.toggle("hidden", !wechat);
  els.downloadAllBtn.classList.toggle("hidden", wechat);
  // 微信内置浏览器没有 File System Access API，隐藏免得点了没反应
  els.saveFolderBtn.classList.toggle("hidden", wechat);
}

function showMessage(title, message) {
  els.dialogTitle.textContent = title;
  els.dialogMessage.textContent = message;

  if (typeof els.dialog.showModal === "function") {
    els.dialog.showModal();
  } else {
    alert(`${title}\n\n${message}`);
  }
}

function isWechat() {
  return /MicroMessenger/i.test(navigator.userAgent);
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function updateTemplateState() {
  if (allTemplateAssetsReady()) {
    els.templateState.textContent = "模板已就绪";
    els.templateState.className = "template-state ready";
  }
}

function allTemplateAssetsReady() {
  return requiredImages.every((image) => image.complete && image.naturalWidth > 0);
}

/* ==================== 批量导入名单 ==================== */

function toggleRosterPanel() {
  const collapsed = els.rosterBody.classList.toggle("hidden");
  els.toggleRosterBtn.textContent = collapsed ? "展开" : "收起";
  els.toggleRosterBtn.setAttribute("aria-expanded", String(!collapsed));
}

function handleRosterText(text) {
  const source = String(text ?? "").trim();
  if (!source) {
    showMessage("没有内容", "请先粘贴名单，或者点「读取剪贴板」。");
    return;
  }

  const { rows, skipped } = window.TMRosterParser.parseRoster(source);

  if (rows.length === 0) {
    showMessage(
      "没能识别出奖项",
      `读到了 ${source.split(/\r?\n/).filter(Boolean).length} 行，但没有一行能拆成「奖项 + 获奖人」。\n建议每行写成：最佳主持人：小王`,
    );
    return;
  }

  state.pendingRows = rows;
  renderParsePreview(rows, skipped);
}

async function readClipboardRoster() {
  if (!navigator.clipboard || !navigator.clipboard.readText) {
    showMessage("无法读取剪贴板", "浏览器不允许直接读取剪贴板，请手动粘贴到输入框。");
    return;
  }
  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) {
      showMessage("剪贴板是空的", "先复制名单，再回来点这里。");
      return;
    }
    els.rosterInput.value = text;
    handleRosterText(text);
  } catch {
    showMessage("读取剪贴板失败", "可能是浏览器权限限制，请手动粘贴到输入框。");
  }
}

function handleRosterFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result || "");
    els.rosterInput.value = text;
    handleRosterText(text);
    // 允许重复选择同一个文件
    event.target.value = "";
  };
  reader.onerror = () => showMessage("读取文件失败", "请确认文件是纯文本或 CSV 格式。");
  reader.readAsText(file, "UTF-8");
}

function renderParsePreview(rows, skipped) {
  els.parseReport.classList.remove("hidden");
  els.parseList.replaceChildren();
  els.parseSummary.textContent = `识别 ${rows.length} 条${
    skipped.length ? ` · 跳过 ${skipped.length} 行` : ""
  }`;

  rows.forEach((row, index) => {
    const item = document.createElement("div");
    item.className = "parse-item";

    const indexTag = document.createElement("span");
    indexTag.className = "parse-index";
    indexTag.textContent = String(index + 1);

    const awardInput = document.createElement("input");
    awardInput.type = "text";
    awardInput.value = row.award;
    awardInput.placeholder = "奖项名称";
    awardInput.className = row.award ? "" : "input-warning";
    awardInput.addEventListener("input", () => {
      row.award = awardInput.value;
    });

    const winnerInput = document.createElement("input");
    winnerInput.type = "text";
    winnerInput.value = row.winner;
    winnerInput.placeholder = "获奖人";
    winnerInput.addEventListener("input", () => {
      row.winner = winnerInput.value;
    });

    const removeBtn = document.createElement("button");
    removeBtn.className = "icon-btn small";
    removeBtn.type = "button";
    removeBtn.title = "移除这一条";
    removeBtn.setAttribute("aria-label", `移除第 ${index + 1} 条`);
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => {
      const indexInState = state.pendingRows.indexOf(row);
      if (indexInState > -1) state.pendingRows.splice(indexInState, 1);
      renderParsePreview(state.pendingRows, skipped);
      if (state.pendingRows.length === 0) cancelPendingRows();
    });

    item.append(indexTag, awardInput, winnerInput, removeBtn);
    els.parseList.append(item);
  });

  const missing = rows.filter((row) => !row.award.trim() || !row.winner.trim()).length;
  if (missing > 0) {
    els.parseReport.textContent = `有 ${missing} 条缺奖项名或获奖人，已用黄色标出，请补齐后再应用。`;
  } else if (skipped.length > 0) {
    els.parseReport.textContent = `以下 ${skipped.length} 行没能识别，已跳过：${skipped
      .slice(0, 3)
      .join("；")}${skipped.length > 3 ? "…" : ""}`;
  } else {
    els.parseReport.textContent = "";
  }

  els.parsePreview.classList.remove("hidden");
  els.parsePreview.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function cancelPendingRows() {
  state.pendingRows = [];
  els.parsePreview.classList.add("hidden");
  els.parseReport.classList.add("hidden");
  els.parseList.replaceChildren();
}

function applyPendingRows() {
  const rows = state.pendingRows
    .map((row) => ({ award: row.award.trim(), winner: row.winner.trim() }))
    .filter((row) => row.award && row.winner);

  if (rows.length === 0) {
    showMessage("还不能应用", "请至少填好一条完整的「奖项 + 获奖人」。");
    return;
  }

  const incomplete = state.pendingRows.length - rows.length;
  state.awards = rows;
  saveState();
  renderAwards();
  cancelPendingRows();

  // 名单变了，之前生成的预览已失效
  invalidateCertificates();

  if (incomplete > 0) {
    showMessage(
      "已应用",
      `导入 ${rows.length} 条；${incomplete} 条因信息不全被跳过。缺失的那几条没有写入。`,
    );
  }
}

/** 名单或模板改动后，已生成的奖状不再可信，清掉预览避免误用旧图。 */
function invalidateCertificates() {
  if (state.certificates.length === 0) return;
  state.certificates = [];
  els.previewSection.classList.add("hidden");
  els.previewList.replaceChildren();
}

/* ==================== 历史会议记录 ==================== */

function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    state.history = Array.isArray(saved) ? saved.filter(isValidHistoryItem) : [];
  } catch {
    localStorage.removeItem(HISTORY_KEY);
    state.history = [];
  }
}

function isValidHistoryItem(item) {
  return (
    item && typeof item === "object" && Array.isArray(item.awards) && typeof item.savedAt === "string"
  );
}

function saveHistory() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history));
  } catch {
    // 配额满或隐私模式，静默失败但不影响主流程
  }
}

/** 生成成功后归档一条。同一天同一批奖项不重复记录。 */
function archiveCurrentMeeting() {
  const signature = JSON.stringify(
    state.awards.map((item) => `${item.award.trim()}|${item.winner.trim()}`),
  );
  const deduped = state.history.filter((item) => item.signature !== signature);
  deduped.unshift({
    signature,
    savedAt: new Date().toISOString(),
    date: els.certDate.value || "",
    meetingManager: els.meetingManager.value.trim(),
    president: els.president.value.trim(),
    awards: state.awards.map((item) => ({
      award: item.award.trim(),
      winner: item.winner.trim(),
    })),
  });
  state.history = deduped.slice(0, HISTORY_LIMIT);
  saveHistory();
  renderHistory();
}

function renderHistory() {
  if (state.history.length === 0) {
    els.historyPanel.classList.add("hidden");
    return;
  }

  els.historyPanel.classList.remove("hidden");
  els.historyList.replaceChildren();

  state.history.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "history-item";

    const info = document.createElement("div");
    info.className = "history-info";

    const title = document.createElement("strong");
    const count = item.awards.length;
    title.textContent = `${formatHistoryDate(item.savedAt)} · ${count} 个奖项${
      item.meetingManager ? ` · ${item.meetingManager}` : ""
    }`;

    const detail = document.createElement("span");
    detail.textContent = item.awards.map((row) => row.award).join("、");

    info.append(title, detail);

    const actions = document.createElement("div");
    actions.className = "history-actions";

    const loadBtn = document.createElement("button");
    loadBtn.className = "save-one-btn";
    loadBtn.type = "button";
    loadBtn.textContent = "载入";
    loadBtn.title = "载入这次会议的奖项和人名";
    loadBtn.addEventListener("click", () => loadHistoryItem(index));

    const removeBtn = document.createElement("button");
    removeBtn.className = "icon-btn small";
    removeBtn.type = "button";
    removeBtn.textContent = "×";
    removeBtn.title = "删除这条记录";
    removeBtn.setAttribute("aria-label", `删除 ${title.textContent}`);
    removeBtn.addEventListener("click", () => removeHistoryItem(index));

    actions.append(loadBtn, removeBtn);
    card.append(info, actions);
    els.historyList.append(card);
  });
}

function loadHistoryItem(index) {
  const item = state.history[index];
  if (!item) return;

  state.awards = item.awards.map((row) => ({ ...row }));
  if (item.date) els.certDate.value = item.date;
  if (item.meetingManager) els.meetingManager.value = item.meetingManager;
  if (item.president) els.president.value = item.president;

  saveState();
  renderAwards();
  invalidateCertificates();
  els.awardList.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function removeHistoryItem(index) {
  state.history.splice(index, 1);
  saveHistory();
  renderHistory();
}

function clearHistory() {
  if (state.history.length === 0) return;
  state.history = [];
  saveHistory();
  renderHistory();
}

function formatHistoryDate(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "未知时间";
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

init();
