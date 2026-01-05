/* global window, document, localStorage */

const STORAGE_KEY = "wedding.shortlist.v1";

function byId(id) {
  return document.getElementById(id);
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

function formatDistricts(studio) {
  const districts = Array.isArray(studio.districts) ? studio.districts : [];
  return districts.length ? districts.join(" • ") : "TP.HCM";
}

function loadShortlist() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const ids = JSON.parse(raw);
    if (!Array.isArray(ids)) return new Set();
    return new Set(ids.filter((x) => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function saveShortlist(set) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
}

function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

const studios = Array.isArray(window.STUDIOS) ? window.STUDIOS : [];
const searchInput = byId("searchInput");
const districtSelect = byId("districtSelect");
const shortlistToggle = byId("shortlistToggle");
const shortlistCount = byId("shortlistCount");
const resultCount = byId("resultCount");
const studioGrid = byId("studioGrid");

const albumModal = byId("albumModal");
const albumTitle = byId("albumTitle");
const albumSubtitle = byId("albumSubtitle");
const albumImage = byId("albumImage");
const albumCaption = byId("albumCaption");
const albumThumbs = byId("albumThumbs");
const albumInfo = byId("albumInfo");
const albumShortlistBtn = byId("albumShortlistBtn");

let shortlist = loadShortlist();
let showShortlistOnly = false;
let activeStudioId = null;
let activeIndex = 0;

function setBodyScrollLocked(locked) {
  document.body.style.overflow = locked ? "hidden" : "";
}

function openModal(studioId, index = 0) {
  const studio = studios.find((s) => s.id === studioId);
  if (!studio) return;

  activeStudioId = studioId;
  activeIndex = Math.max(0, Math.min(index, (studio.images || []).length - 1));

  albumTitle.textContent = studio.name;
  albumSubtitle.textContent = `${formatDistricts(studio)} • Studio (không ngoại cảnh) • ${studio.images.length} ảnh`;
  albumShortlistBtn.setAttribute("aria-pressed", shortlist.has(studioId) ? "true" : "false");

  renderModal(studio);
  albumModal.setAttribute("aria-hidden", "false");
  setBodyScrollLocked(true);
}

function closeModal() {
  albumModal.setAttribute("aria-hidden", "true");
  setBodyScrollLocked(false);
  activeStudioId = null;
  activeIndex = 0;
  albumThumbs.innerHTML = "";
  albumImage.removeAttribute("src");
}

function setActiveImage(studio, index) {
  const images = Array.isArray(studio.images) ? studio.images : [];
  if (!images.length) return;

  activeIndex = (index + images.length) % images.length;
  const src = images[activeIndex];

  albumImage.src = src;
  albumImage.alt = `${studio.name} — ảnh studio ${activeIndex + 1}/${images.length}`;
  albumCaption.textContent = `Ảnh ${activeIndex + 1}/${images.length} • Nguồn: portfolio chính chủ`;

  albumThumbs.querySelectorAll(".thumb").forEach((btn) => {
    const idx = Number(btn.dataset.index);
    btn.setAttribute("aria-current", idx === activeIndex ? "true" : "false");
  });
}

function renderModal(studio) {
  const images = Array.isArray(studio.images) ? studio.images : [];
  setActiveImage(studio, activeIndex);

  albumThumbs.innerHTML = images
    .map((src, idx) => {
      const current = idx === activeIndex ? ' aria-current="true"' : "";
      return `
        <button class="thumb" type="button" data-index="${idx}"${current} aria-label="Mở ảnh ${idx + 1}">
          <img loading="lazy" decoding="async" src="${src}" alt="" />
        </button>
      `;
    })
    .join("");

  const contactLines = [
    studio.address ? `<p><strong>Địa chỉ:</strong> ${studio.address}</p>` : "",
    studio.phone && studio.phone.length ? `<p><strong>Hotline:</strong> ${studio.phone.join(" • ")}</p>` : "",
    studio.email ? `<p><strong>Email:</strong> ${studio.email}</p>` : "",
    studio.price ? `<p><strong>Giá:</strong> ${studio.price}</p>` : "",
  ]
    .filter(Boolean)
    .join("");

  const links = [
    isValidUrl(studio.website)
      ? `<p><a href="${studio.website}" target="_blank" rel="noopener">Mở website</a></p>`
      : "",
    isValidUrl(studio.portfolioUrl)
      ? `<p><a href="${studio.portfolioUrl}" target="_blank" rel="noopener">Mở portfolio/album (studio)</a></p>`
      : "",
    isValidUrl(studio.priceUrl)
      ? `<p><a href="${studio.priceUrl}" target="_blank" rel="noopener">Xem giá (nguồn)</a></p>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  albumInfo.innerHTML = `
    <h3>Tiêu chí</h3>
    <p><strong>Chỉ chụp studio</strong> (không ngoại cảnh) • <strong>TP.HCM</strong></p>
    <h3>Thông tin</h3>
    ${contactLines || "<p>Đang cập nhật thông tin liên hệ.</p>"}
    <h3>Ghi chú</h3>
    <p>${studio.note || "Ảnh demo lấy từ portfolio chính chủ."}</p>
    <h3>Liên kết</h3>
    ${links || "<p>Không có liên kết.</p>"}
  `;
}

function updateShortlistUI() {
  shortlistCount.textContent = String(shortlist.size);
  shortlistToggle.setAttribute("aria-pressed", showShortlistOnly ? "true" : "false");
}

function toggleShortlist(id) {
  if (shortlist.has(id)) shortlist.delete(id);
  else shortlist.add(id);
  saveShortlist(shortlist);
  updateShortlistUI();
  render();
}

function buildDistrictOptions() {
  const set = new Set();
  for (const s of studios) {
    (s.districts || []).forEach((d) => set.add(d));
  }
  const districts = Array.from(set).sort((a, b) => a.localeCompare(b, "vi"));
  districtSelect.innerHTML = `<option value="">Tất cả quận</option>${districts
    .map((d) => `<option value="${d}">${d}</option>`)
    .join("")}`;
}

function getFilteredStudios() {
  const q = normalizeText(searchInput.value);
  const district = districtSelect.value;

  return studios.filter((s) => {
    if (showShortlistOnly && !shortlist.has(s.id)) return false;
    if (district && !(s.districts || []).includes(district)) return false;
    if (!q) return true;
    const hay = normalizeText(
      [s.name, s.address, s.city, (s.districts || []).join(" "), s.price, s.note].filter(Boolean).join(" | ")
    );
    return hay.includes(q);
  });
}

function render() {
  const list = getFilteredStudios();
  resultCount.textContent = `${list.length}/${studios.length} studio`;

  studioGrid.innerHTML = list
    .map((s) => {
      const cover = (s.images || [])[0] || "";
      const picked = shortlist.has(s.id);
      return `
        <article class="card" role="listitem" data-id="${s.id}">
          <div class="media">
            <img class="media__img" loading="lazy" decoding="async" src="${cover}" alt="${s.name} — ảnh studio (portfolio)" />
            <div class="media__overlay" aria-hidden="true"></div>
            <div class="media__badges" aria-label="Tag">
              <span class="tag">Studio</span>
              <span class="tag">TP.HCM</span>
              <span class="tag">Không ngoại cảnh</span>
            </div>
            <button class="heart" type="button" data-action="shortlist" aria-pressed="${picked ? "true" : "false"}" aria-label="${
              picked ? "Bỏ chọn" : "Chọn studio này"
            }">
              <span class="heart__icon" aria-hidden="true">♥</span>
            </button>
          </div>
          <div class="body">
            <div class="titleRow">
              <h3>${s.name}</h3>
              <p class="metaLine">${formatDistricts(s)} • ${s.address}</p>
            </div>
            <div class="facts" aria-label="Thông tin nhanh">
              <div class="fact">
                <span class="fact__k">Giá</span>
                <span class="fact__v">${s.price || "Liên hệ"}</span>
              </div>
              <div class="fact">
                <span class="fact__k">Hotline</span>
                <span class="fact__v">${(s.phone && s.phone.length ? s.phone[0] : "—")}</span>
              </div>
            </div>
            <div class="actions">
              <button class="btn" type="button" data-action="album">Xem album (10)</button>
              <a class="btn btn--ghost" href="${s.portfolioUrl}" target="_blank" rel="noopener">Portfolio</a>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function handleGridClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  const card = target.closest("[data-id]");
  if (!card) return;
  const studioId = card.getAttribute("data-id");
  if (!studioId) return;

  const actionEl = target.closest("[data-action]");
  const action = actionEl ? actionEl.getAttribute("data-action") : null;

  if (action === "shortlist") {
    toggleShortlist(studioId);
    return;
  }

  if (action === "album") {
    openModal(studioId, 0);
  }
}

function handleModalClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;

  if (target.closest("[data-close]")) {
    closeModal();
    return;
  }

  const nav = target.closest("[data-nav]");
  if (nav && activeStudioId) {
    const delta = Number(nav.getAttribute("data-nav") || "0");
    const studio = studios.find((s) => s.id === activeStudioId);
    if (!studio) return;
    setActiveImage(studio, activeIndex + delta);
    return;
  }

  const thumb = target.closest(".thumb");
  if (thumb && activeStudioId) {
    const idx = Number(thumb.getAttribute("data-index"));
    const studio = studios.find((s) => s.id === activeStudioId);
    if (!studio || Number.isNaN(idx)) return;
    setActiveImage(studio, idx);
  }
}

function handleKeydown(event) {
  if (albumModal.getAttribute("aria-hidden") !== "false") return;

  if (event.key === "Escape") {
    event.preventDefault();
    closeModal();
    return;
  }

  if (!activeStudioId) return;
  const studio = studios.find((s) => s.id === activeStudioId);
  if (!studio) return;

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    setActiveImage(studio, activeIndex - 1);
  }
  if (event.key === "ArrowRight") {
    event.preventDefault();
    setActiveImage(studio, activeIndex + 1);
  }
}

function init() {
  buildDistrictOptions();
  updateShortlistUI();
  render();

  searchInput.addEventListener("input", () => render());
  districtSelect.addEventListener("change", () => render());
  shortlistToggle.addEventListener("click", () => {
    showShortlistOnly = !showShortlistOnly;
    updateShortlistUI();
    render();
  });

  studioGrid.addEventListener("click", handleGridClick);
  albumModal.addEventListener("click", handleModalClick);
  albumShortlistBtn.addEventListener("click", () => {
    if (!activeStudioId) return;
    toggleShortlist(activeStudioId);
    albumShortlistBtn.setAttribute("aria-pressed", shortlist.has(activeStudioId) ? "true" : "false");
  });
  document.addEventListener("keydown", handleKeydown);
}

init();

