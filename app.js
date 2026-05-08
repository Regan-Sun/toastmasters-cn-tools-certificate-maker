"use strict";

const TOP_LOGO_SRC = window.TM_GLOBE_LOGO_DATA_URL || "";
const DISTRICT_MARK_SRC = window.TM_DISTRICT_118_DATA_URL || "";
const STORAGE_KEY = "tm_certificate_maker_state_v1";
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
  dateLabel: "日    期",
  presidentLabel: "会长",
};

const DISTRICT_CERT = {
  width: 2200,
  height: 1528,
  title: {
    x: 1100,
    y: 285,
    size: 62,
    minSize: 44,
    maxWidth: 620,
    color: "#004165",
    weight: "800",
    family: '"Arial","Helvetica Neue","PingFang SC","Noto Sans SC",sans-serif',
  },
  award: {
    x: 1100,
    y: 480,
    size: 84,
    minSize: 48,
    maxWidth: 930,
    color: "#050505",
    weight: "900",
    family: '"Arial Black","Arial","Helvetica Neue","PingFang SC","Noto Sans SC",sans-serif',
  },
  presented: {
    x: 1100,
    y: 640,
    size: 42,
    minSize: 30,
    maxWidth: 520,
    color: "#050505",
    weight: "700",
    family: '"Arial","Helvetica Neue","PingFang SC","Noto Sans SC",sans-serif',
  },
  winner: {
    x: 1100,
    y: 760,
    size: 86,
    minSize: 46,
    maxWidth: 720,
    color: "#050505",
    weight: "800",
    family: '"Arial","Helvetica Neue","PingFang SC","Noto Sans SC",sans-serif',
  },
  description: {
    x: 1100,
    y: 936,
    size: 30,
    minSize: 22,
    maxWidth: 650,
    color: "#050505",
    weight: "500",
    family: '"Arial","Helvetica Neue","PingFang SC","Noto Sans SC",sans-serif',
  },
  signatures: {
    lineY: 1138,
    nameY: 1096,
    labelY: 1178,
    lineWidth: 520,
    lineWeight: 5,
    nameSize: 44,
    labelSize: 28,
    color: "#666666",
    textColor: "#4d4d4d",
    x: {
      manager: 520,
      date: 1100,
      president: 1680,
    },
  },
  mainRule: { x: 1100, y: 900, width: 1040, weight: 5 },
  topLogo: { x: 1828, y: 86, width: 240, height: 199 },
  districtMark: { x: 1585, y: 1265, width: 430, height: 191 },
};

const state = {
  awards: DEFAULT_AWARDS.map((award) => ({ award, winner: "" })),
  certificates: [],
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
  wechatTip: document.querySelector("#wechatTip"),
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
  renderAwards();
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
  els.dateLabel.value = readSavedText(savedTexts.dateLabel, DEFAULT_TEMPLATE_TEXTS.dateLabel);
  els.presidentLabel.value = readSavedText(savedTexts.presidentLabel, DEFAULT_TEMPLATE_TEXTS.presidentLabel);
}

function readSavedText(value, fallback) {
  return typeof value === "string" ? value : fallback;
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
        minSize: 28,
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
      minSize: 28,
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

function drawFittedText(text, spec, options = {}) {
  const value = String(text ?? "");
  let fontSize = spec.size;
  ctx.fillStyle = spec.color;
  ctx.strokeStyle = spec.color;
  ctx.lineJoin = "round";

  while (fontSize > spec.minSize) {
    ctx.font = `${spec.weight} ${fontSize}px ${spec.family}`;
    if (ctx.measureText(value).width <= spec.maxWidth) break;
    fontSize -= 2;
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

async function downloadAll() {
  if (isWechat()) return;
  els.downloadAllBtn.disabled = true;
  els.downloadAllBtn.textContent = "保存中...";

  for (let index = 0; index < state.certificates.length; index += 1) {
    if (!state.certificates[index].saved) {
      downloadOne(index);
      await delay(260);
    }
  }

  els.downloadAllBtn.disabled = false;
  els.downloadAllBtn.textContent = "保存全部到相册";
}

function downloadDataUrl(dataUrl, fileName) {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

init();
