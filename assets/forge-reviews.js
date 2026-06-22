(function () {
  if (customElements.get("forge-reviews")) return;

  const BODY_MIN_CHARS = 10;

  const I18N_DEFAULTS = {
    addReview: "Add a review",
    dialogTitle: "Tell us about your review",
    nameLabel: "Name",
    namePlaceholder: "Enter your name...",
    emailLabel: "Email",
    emailPlaceholder: "Enter your email...",
    feedbackLabel: "Feedback",
    feedbackPlaceholder: "Write your feedback...",
    minCharsHint: "Write at least {{ count }} more characters to share your experience.",
    photosHint: "(Accepts .gif, .jpg, .png and 5MB limit)",
    photosSelected: "{{ count }} photos selected",
    cancel: "Cancel",
    submit: "Submit",
    submitThanks: "Thanks - your review is pending approval.",
    genericError: "Something went wrong.",
    yourRatingLabel: "Your rating",
    starsAriaLabel: "{{ count }} stars",
    paginationNavLabel: "Reviews pagination",
    paginationPrevious: "Previous",
    paginationNext: "Next",
    paginationGotoPage: "Go to page {{ page }}",
    summaryHeading: "What customers are saying",
    summaryProsHeading: "Liked",
    summaryConsHeading: "To consider",
    summaryAiBadge: "AI generated summary",
    ratingLabels: {
      1: "Poor",
      2: "Fair",
      3: "Good",
      4: "Very good",
      5: "Excellent",
    },
    submitErrors: {
      email_invalid: "Please enter a valid email address.",
      body_too_short: "Your review is too short. Please write a bit more.",
      body_too_long: "Your review is too long. Please shorten it.",
      invalid_rating: "Please choose a star rating between 1 and 5.",
      invalid_input: "Please review the form fields and try again.",
      invalid_shop: "We couldn't process your review right now. Please try again in a moment.",
      invalid_product: "We couldn't match this product. Please refresh the page and try again.",
      too_many_photos: "You've added too many photos. Please remove some and try again.",
      photo_invalid_type: "One of your photos has an unsupported format. Use JPG, PNG, or GIF.",
      photo_too_large: "One of your photos is too large. Each photo must be under 5 MB.",
    },
  };

  function humanizeSubmitError(i18n, code) {
    const map = i18n?.submitErrors || {};
    if (code && map[code]) return map[code];
    return i18n?.genericError || "Something went wrong.";
  }

  function fmt(template, vars) {
    let out = String(template ?? "");
    if (!vars) return out;
    for (const [k, v] of Object.entries(vars)) {
      out = out.split(`{{ ${k} }}`).join(String(v)).split(`{{${k}}}`).join(String(v));
    }
    return out;
  }

  // SECURITY: keep escapeHtml in sync with server-side review text validation.
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/`/g, "&#96;")
      .replace(/=/g, "&#61;");
  }

  function starsHtml(rating, color) {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5 ? 1 : 0;
    let html = "";
    for (let i = 0; i < 5; i++) {
      const filled = i < full || (i === full && half);
      html += `<span style="color:${filled ? color : "#ddd"}">★</span>`;
    }
    return html;
  }

  function photosStripHtml(photos) {
    if (!Array.isArray(photos) || photos.length === 0) return "";
    const items = photos
      .map((p, idx) => {
        const thumb = p && (p.thumb_url || p.url);
        const full = p && (p.url || p.thumb_url);
        if (!thumb || !full) return "";
        return `<button
          type="button"
          class="forge-reviews__photo"
          data-action="open-photo"
          data-full="${escapeHtml(full)}"
          data-index="${idx}"
          aria-label="Open review photo ${idx + 1} of ${photos.length}"
        ><img src="${escapeHtml(thumb)}" alt="" loading="lazy" /></button>`;
      })
      .join("");
    return items ? `<div class="forge-reviews__photos">${items}</div>` : "";
  }

  function deriveTitleFromBody(body) {
    const trimmed = String(body ?? "").trim().replace(/\s+/g, " ");
    if (!trimmed) return "Customer review";
    const firstSentence = trimmed.split(/[.!?]\s/)[0];
    const candidate = firstSentence.length >= 3 ? firstSentence : trimmed;
    return candidate.slice(0, 80).trim() || "Customer review";
  }

  function emptyListPayload() {
    return {
      aggregate: { rating: 0, count: 0, distribution: {} },
      reviews: [],
      page: 1,
      per_page: 10,
      total: 0,
      submission_enabled: true,
    };
  }

  function normalizeListPayload(data) {
    if (!data || typeof data !== "object" || data.error) {
      return emptyListPayload();
    }
    const aggregate = data.aggregate || {};
    return {
      ...data,
      aggregate: {
        rating: Number(aggregate.rating) || 0,
        count: Number(aggregate.count) || 0,
        distribution: aggregate.distribution || {},
      },
      reviews: Array.isArray(data.reviews) ? data.reviews : [],
      total: Number(data.total) || 0,
      page: Number(data.page) || 1,
      per_page: Number(data.per_page) || 10,
    };
  }

  function formatRating(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return "0.0";
    return n.toFixed(1);
  }

  // Preview data shown when a block has data-sample="1" (preview mode in the
  // theme editor). Keeps the storefront from ever rendering fake reviews to
  // real shoppers.
  const EDITOR_PREVIEW_AGGREGATE = { rating: 4.7, count: 128 };
  const EDITOR_PREVIEW_REVIEWS = [
    {
      rating: 5,
      title: "Exactly what I was looking for",
      body: "Quality is fantastic, shipping was fast, and the packaging looked premium. Already ordered a second one for my sister.",
      author_name: "Emily R.",
      country: "US",
    },
    {
      rating: 5,
      title: "Worth every penny",
      body: "I was hesitant about the price but after using it for two weeks I have zero regrets. Highly recommend.",
      author_name: "Jonas K.",
      country: "DE",
    },
    {
      rating: 4,
      title: "Great, with one small nitpick",
      body: "Love the look and feel. The only thing I wish was different is the color of the strap, but overall I am very happy.",
      author_name: "Sofia M.",
      country: "ES",
    },
    {
      rating: 5,
      title: "Five stars from me",
      body: "Customer service was excellent when I had a question, and the product itself is even better than the photos.",
      author_name: "Marcus L.",
      country: "GB",
    },
  ];
  const EDITOR_PREVIEW_SUMMARY = {
    summary:
      "Customers love the build quality, packaging, and fast shipping. A few mention they would prefer more color options.",
    pros: ["Premium feel and finish", "Fast delivery", "Helpful customer service"],
    cons: ["Limited color choices", "Slightly above average price"],
  };

  // Last-resort default if the snippet failed to render anything. The real URL is baked into
  // `snippets/forge-reviews-api-base.liquid` at deploy time by `scripts/deploy-forge-extension.mjs`.
  const FORGE_REVIEWS_DEFAULT_API_BASE = "https://forge-prod-11402474925.us-central1.run.app";
  // Shopify wraps rendered app snippets with `<!-- BEGIN app snippet: ... -->URL<!-- END app snippet -->`.
  // `{% capture %}` keeps those comments and `| strip` only removes whitespace, so we strip them here.
  const HTML_COMMENT_PATTERN = /<!--[\s\S]*?-->/g;

  function cleanUrl(raw) {
    return String(raw ?? "")
      .replace(HTML_COMMENT_PATTERN, "")
      .trim()
      .replace(/\/$/, "");
  }

  function resolveApiBase(raw) {
    return cleanUrl(raw) || FORGE_REVIEWS_DEFAULT_API_BASE;
  }

  class ForgeReviews extends HTMLElement {
    connectedCallback() {
      this.apiBase = resolveApiBase(this.dataset.apiBase);
      this.shop = this.dataset.shop || "";
      this.product = this.dataset.product || "";
      this.productImage = this.dataset.productImage || "";
      this.productTitle = this.dataset.productTitle || "";
      this.locale = document.documentElement.lang || "en";
      this.mode = this.dataset.mode || "box";
      this.perPage = Number(this.dataset.perPage || 10);
      this.starsColor = this.dataset.starsColor || "#f5a623";
      this.alignment = ["left", "center", "right"].includes(this.dataset.alignment)
        ? this.dataset.alignment
        : "center";
      // Pagination is shown by default; merchants can disable it via the
      // section/block setting which sets data-show-pagination="0".
      this.showPagination = this.dataset.showPagination !== "0";
      this.showCount = this.dataset.showCount !== "0";
      this.formWidth = ["narrow", "medium", "wide"].includes(this.dataset.formWidth)
        ? this.dataset.formWidth
        : "wide";
      // AI summary block options (only consulted in mode="summary"). All
      // optional - sensible defaults preserve the previous behaviour for
      // older Liquid templates that don't emit these attributes.
      this.summaryHeading = this.dataset.summaryHeading; // string or undefined
      this.summaryHeadingSize = ["small", "medium", "large"].includes(this.dataset.summaryHeadingSize)
        ? this.dataset.summaryHeadingSize
        : "medium";
      this.summaryShowBadge = this.dataset.summaryShowBadge !== "0";
      this.summaryShowPros = this.dataset.summaryShowPros !== "0";
      this.summaryShowCons = this.dataset.summaryShowCons !== "0";
      this.summaryLayout = this.dataset.summaryLayout === "stacked" ? "stacked" : "side-by-side";
      this.summaryCardStyle = this.dataset.summaryCardStyle === "plain" ? "plain" : "card";
      this.summaryAccentColor = this.dataset.summaryAccentColor || this.starsColor || "#f5a623";
      this.sample = this.dataset.sample === "1";
      this.i18n = this.readI18n();
      // Optional rich-text snippet rendered next to the stars in mode="stars".
      // Sourced from a <template> child so Shopify's sanitised richtext HTML
      // survives the host element's innerHTML reset.
      this.starsInlineTextHtml = this.readStarsInlineText();
      this.init();
    }

    readStarsInlineText() {
      const tmpl = this.querySelector("template.forge-reviews__stars-inline-text");
      return tmpl ? tmpl.innerHTML.trim() : "";
    }

    readI18n() {
      const script = this.querySelector('script[type="application/json"].forge-reviews__i18n');
      let overrides = {};
      if (script) {
        try {
          overrides = JSON.parse(script.textContent || "{}") || {};
        } catch {
          overrides = {};
        }
      }
      return {
        ...I18N_DEFAULTS,
        ...overrides,
        ratingLabels: {
          ...I18N_DEFAULTS.ratingLabels,
          ...(overrides.ratingLabels || {}),
        },
        submitErrors: {
          ...I18N_DEFAULTS.submitErrors,
          ...(overrides.submitErrors || {}),
        },
      };
    }

    async init() {
      try {
        if (this.mode === "summary") {
          await this.renderSummary();
          return;
        }
        if (this.mode === "stars") {
          this.renderStars();
          return;
        }
        if (this.mode === "form") {
          this.renderInlineForm();
          return;
        }
        await this.renderBox();
      } catch (err) {
        console.error("[forge-reviews] init failed", this.mode, err);
        if (this.mode === "box") {
          await this.renderBoxWithData(emptyListPayload());
        }
      }
    }

    renderStars() {
      let rating = Number(this.dataset.rating || 0);
      let count = Number(this.dataset.count || 0);
      if (this.sample) {
        rating = EDITOR_PREVIEW_AGGREGATE.rating;
        count = EDITOR_PREVIEW_AGGREGATE.count;
      }
      const inlineText = this.starsInlineTextHtml
        ? `<span class="forge-reviews__stars-inline">${this.starsInlineTextHtml}</span>`
        : "";
      this.innerHTML = `<div class="forge-reviews__stars">${starsHtml(rating, this.starsColor)} <span class="forge-reviews__count">(${count})</span>${inlineText}</div>`;
    }

    async renderSummary() {
      if (this.sample) {
        this.renderSummaryFromData(EDITOR_PREVIEW_SUMMARY);
        return;
      }
      const url = `${this.apiBase}/api/reviews/summary?shop=${encodeURIComponent(this.shop)}&product=${encodeURIComponent(this.product)}&locale=${encodeURIComponent(this.locale)}`;
      const res = await fetch(url);
      if (res.status === 204) {
        this.innerHTML = "";
        return;
      }
      const data = await res.json();
      this.renderSummaryFromData(data);
    }

    renderSummaryFromData(data) {
      const i18n = this.i18n;
      const heading = this.summaryHeading !== undefined
        ? this.summaryHeading
        : i18n.summaryHeading;
      const hasHeading = heading && heading.trim().length > 0;

      const prosItems = this.summaryShowPros ? (data.pros || []) : [];
      const consItems = this.summaryShowCons ? (data.cons || []) : [];

      const prosBlock = prosItems.length
        ? `<div class="forge-reviews__summary-list forge-reviews__summary-list--pros">
            <h4 class="forge-reviews__summary-list-heading">${escapeHtml(i18n.summaryProsHeading)}</h4>
            <ul>${prosItems.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
          </div>`
        : "";

      const consBlock = consItems.length
        ? `<div class="forge-reviews__summary-list forge-reviews__summary-list--cons">
            <h4 class="forge-reviews__summary-list-heading">${escapeHtml(i18n.summaryConsHeading)}</h4>
            <ul>${consItems.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
          </div>`
        : "";

      const lists = prosBlock || consBlock
        ? `<div class="forge-reviews__summary-grid">${prosBlock}${consBlock}</div>`
        : "";

      const badge = this.summaryShowBadge
        ? `<div class="forge-reviews__summary-badge" aria-label="${escapeHtml(i18n.summaryAiBadge)}">
            <svg class="forge-reviews__summary-badge-icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
              <path fill="currentColor" d="M12 2.5l1.7 4.6 4.6 1.7-4.6 1.7-1.7 4.6-1.7-4.6L5.7 8.8l4.6-1.7L12 2.5zm6.5 11l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9.9-2.4zM5 14l.7 2 2 .7-2 .7L5 19.4 4.3 17.4l-2-.7 2-.7L5 14z"/>
            </svg>
            <span>${escapeHtml(i18n.summaryAiBadge)}</span>
          </div>`
        : "";

      const summaryText = data.summary
        ? `<p class="forge-reviews__summary-text">${escapeHtml(data.summary)}</p>`
        : "";

      this.style.setProperty("--forge-reviews-summary-accent", this.summaryAccentColor);

      const classes = [
        "forge-reviews__summary",
        `forge-reviews__summary--${this.summaryCardStyle}`,
        `forge-reviews__summary--${this.summaryLayout}`,
        `forge-reviews__summary--align-${this.alignment}`,
      ].join(" ");

      const headingTag = this.summaryHeadingSize === "large" ? "h2" : "h3";
      const headingMarkup = hasHeading
        ? `<${headingTag} class="forge-reviews__summary-heading forge-reviews__summary-heading--${this.summaryHeadingSize}">${escapeHtml(heading)}</${headingTag}>`
        : "";

      this.innerHTML = `
        <div class="${classes}">
          ${this.sample ? '<div class="forge-reviews__sample-badge">Sample data</div>' : ""}
          ${badge}
          ${headingMarkup}
          ${summaryText}
          ${lists}
        </div>`;
    }

    async renderBox() {
      this.currentPage = 1;
      const data = normalizeListPayload(await this.fetchPage(this.currentPage));
      await this.renderBoxWithData(data);
    }

    async renderBoxWithData(data) {
      const aggregateRating = Number(data.aggregate?.rating) || 0;
      const aggregateCount = Number(data.aggregate?.count) || 0;
      // submission_enabled defaults to true if the API omits it (older
      // deploys); merchants in sample/preview mode always see the button.
      const submissionEnabled = this.sample || data.submission_enabled !== false;

      const addButton = submissionEnabled
        ? `<button type="button" class="forge-reviews__add-btn" data-action="open-form">
            <span aria-hidden="true">+</span> ${escapeHtml(this.i18n.addReview)}
          </button>`
        : "";

      const dialogMarkup = submissionEnabled
        ? `<dialog class="forge-reviews__dialog" aria-labelledby="forge-reviews-dialog-title">
            <div class="forge-reviews__dialog-inner">
              ${this.formMarkup({ inDialog: true })}
            </div>
          </dialog>`
        : "";

      this.innerHTML = `
        <div class="forge-reviews__box forge-reviews__box--align-${this.alignment}">
          ${this.sample ? '<div class="forge-reviews__sample-badge">Sample data - preview only, not visible on storefront</div>' : ""}
          <div class="forge-reviews__box-header">
            <div class="forge-reviews__aggregate">
              ${starsHtml(aggregateRating, this.starsColor)}
              <span class="forge-reviews__aggregate-score">${formatRating(aggregateRating)}</span>
              ${this.showCount ? `<span class="forge-reviews__aggregate-count">(${aggregateCount})</span>` : ""}
            </div>
            ${addButton}
          </div>
          <div class="forge-reviews__list" data-role="list"></div>
          <nav class="forge-reviews__pagination" data-role="pagination" aria-label="${escapeHtml(this.i18n.paginationNavLabel)}" hidden></nav>
        </div>
        <dialog class="forge-reviews__photo-dialog" data-role="photo-dialog" aria-label="Review photo">
          <button type="button" class="forge-reviews__photo-close" data-action="close-photo" aria-label="Close">×</button>
          <button type="button" class="forge-reviews__photo-nav forge-reviews__photo-nav--prev" data-action="prev-photo" aria-label="Previous photo" hidden>‹</button>
          <button type="button" class="forge-reviews__photo-nav forge-reviews__photo-nav--next" data-action="next-photo" aria-label="Next photo" hidden>›</button>
          <img class="forge-reviews__photo-img" data-role="photo-img" alt="" />
        </dialog>
        ${dialogMarkup}`;

      this.renderListAndPagination(data);
      this.wirePhotoLightbox();

      if (submissionEnabled) {
        const openBtn = this.querySelector('[data-action="open-form"]');
        const dialog = this.querySelector(".forge-reviews__dialog");
        if (openBtn && dialog) {
          openBtn.addEventListener("click", () => {
            if (typeof dialog.showModal === "function") {
              dialog.showModal();
            } else {
              dialog.setAttribute("open", "");
            }
          });
          dialog.addEventListener("click", (event) => {
            if (event.target === dialog) dialog.close();
          });
        }

        const cancelBtn = this.querySelector('[data-action="cancel"]');
        if (cancelBtn && dialog) {
          cancelBtn.addEventListener("click", () => dialog.close());
        }

        this.wireForm(this.querySelector("form.forge-reviews__form"));
      }
    }

    wirePhotoLightbox() {
      const listEl = this.querySelector('[data-role="list"]');
      const dialog = this.querySelector('[data-role="photo-dialog"]');
      if (!listEl || !dialog) return;

      listEl.addEventListener("click", (event) => {
        const btn = event.target.closest('[data-action="open-photo"]');
        if (!btn || !listEl.contains(btn)) return;
        const strip = btn.closest(".forge-reviews__photos");
        if (!strip) return;
        const buttons = Array.from(strip.querySelectorAll('[data-action="open-photo"]'));
        this._photoUrls = buttons.map((b) => b.dataset.full).filter(Boolean);
        const idx = buttons.indexOf(btn);
        this.showPhotoAt(idx >= 0 ? idx : 0);
        if (typeof dialog.showModal === "function") {
          dialog.showModal();
        } else {
          dialog.setAttribute("open", "");
        }
      });

      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close();
      });

      const closeBtn = dialog.querySelector('[data-action="close-photo"]');
      if (closeBtn) closeBtn.addEventListener("click", () => dialog.close());

      const prevBtn = dialog.querySelector('[data-action="prev-photo"]');
      const nextBtn = dialog.querySelector('[data-action="next-photo"]');
      if (prevBtn) prevBtn.addEventListener("click", () => this.showPhotoAt((this._photoIndex ?? 0) - 1));
      if (nextBtn) nextBtn.addEventListener("click", () => this.showPhotoAt((this._photoIndex ?? 0) + 1));

      dialog.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft") this.showPhotoAt((this._photoIndex ?? 0) - 1);
        else if (event.key === "ArrowRight") this.showPhotoAt((this._photoIndex ?? 0) + 1);
      });
    }

    showPhotoAt(index) {
      const urls = this._photoUrls || [];
      if (!urls.length) return;
      const wrapped = ((index % urls.length) + urls.length) % urls.length;
      this._photoIndex = wrapped;
      const img = this.querySelector('[data-role="photo-img"]');
      if (img) img.src = urls[wrapped];
      const prevBtn = this.querySelector('[data-action="prev-photo"]');
      const nextBtn = this.querySelector('[data-action="next-photo"]');
      const showNav = urls.length > 1;
      if (prevBtn) prevBtn.hidden = !showNav;
      if (nextBtn) nextBtn.hidden = !showNav;
    }

    async fetchPage(page) {
      if (this.sample) {
        return {
          aggregate: EDITOR_PREVIEW_AGGREGATE,
          reviews: EDITOR_PREVIEW_REVIEWS,
          page: 1,
          per_page: EDITOR_PREVIEW_REVIEWS.length,
          total: EDITOR_PREVIEW_REVIEWS.length,
        };
      }

      if (!this.apiBase || !this.shop || !this.product) {
        console.warn("[forge-reviews] missing apiBase, shop, or product", {
          apiBase: this.apiBase,
          shop: this.shop,
          product: this.product,
        });
        return emptyListPayload();
      }

      const listUrl = `${this.apiBase.replace(/\/$/, "")}/api/reviews/list?shop=${encodeURIComponent(this.shop)}&product=${encodeURIComponent(this.product)}&locale=${encodeURIComponent(this.locale)}&per_page=${this.perPage}&page=${page}`;

      try {
        const res = await fetch(listUrl);
        let data;
        try {
          data = await res.json();
        } catch (parseErr) {
          console.warn("[forge-reviews] list response was not JSON", listUrl, parseErr);
          return emptyListPayload();
        }
        if (!res.ok) {
          console.warn("[forge-reviews] list API error", res.status, data);
          return emptyListPayload();
        }
        return normalizeListPayload(data);
      } catch (err) {
        console.warn("[forge-reviews] list fetch failed", listUrl, err);
        return emptyListPayload();
      }
    }

    renderListAndPagination(data) {
      const listEl = this.querySelector('[data-role="list"]');
      const pagerEl = this.querySelector('[data-role="pagination"]');
      if (!listEl || !pagerEl) return;

      const reviews = (data.reviews || [])
        .map(
          (r) => `<article class="forge-reviews__item">
            <div>${starsHtml(r.rating, this.starsColor)}</div>
            <h4>${escapeHtml(r.title)}</h4>
            <p>${escapeHtml(r.body)}</p>
            ${photosStripHtml(r.photos)}
            <small>${escapeHtml(r.author_name)}${r.country ? " • " + escapeHtml(r.country) : ""}</small>
          </article>`,
        )
        .join("");

      listEl.innerHTML = reviews || '<p class="forge-reviews__empty">Be the first to leave a review.</p>';

      const total = Number(data.total ?? (data.reviews || []).length);
      const perPage = Number(data.per_page ?? this.perPage) || this.perPage;
      const totalPages = Math.max(1, Math.ceil(total / perPage));
      const current = Math.max(1, Number(data.page ?? this.currentPage));
      this.currentPage = current;

      if (totalPages <= 1 || !this.showPagination) {
        pagerEl.hidden = true;
        pagerEl.innerHTML = "";
        return;
      }

      pagerEl.hidden = false;
      pagerEl.innerHTML = this.paginationMarkup(current, totalPages);

      pagerEl.querySelectorAll("[data-page]").forEach((btn) => {
        btn.addEventListener("click", (event) => {
          event.preventDefault();
          const next = Number(btn.getAttribute("data-page"));
          if (!Number.isFinite(next) || next === this.currentPage) return;
          this.goToPage(next);
        });
      });
    }

    paginationMarkup(current, totalPages) {
      const i18n = this.i18n;
      const pageBtn = (n, isCurrent) => {
        const ariaLabel = fmt(i18n.paginationGotoPage, { page: n });
        return `<button
          type="button"
          class="forge-reviews__pagination-page${isCurrent ? " is-current" : ""}"
          data-page="${n}"
          aria-label="${escapeHtml(ariaLabel)}"
          ${isCurrent ? 'aria-current="page"' : ""}
        >${n}</button>`;
      };

      // Compute a compact window of page numbers around the current page so
      // we never render hundreds of buttons. Always show first/last; collapse
      // gaps with an ellipsis.
      const window = 1;
      const pages = new Set([1, totalPages, current]);
      for (let i = current - window; i <= current + window; i++) {
        if (i >= 1 && i <= totalPages) pages.add(i);
      }
      const sorted = [...pages].sort((a, b) => a - b);

      const items = [];
      sorted.forEach((p, idx) => {
        if (idx > 0 && p - sorted[idx - 1] > 1) {
          items.push('<span class="forge-reviews__pagination-ellipsis" aria-hidden="true">…</span>');
        }
        items.push(pageBtn(p, p === current));
      });

      const prevDisabled = current <= 1;
      const nextDisabled = current >= totalPages;

      return `
        <button
          type="button"
          class="forge-reviews__pagination-arrow"
          data-page="${current - 1}"
          ${prevDisabled ? "disabled" : ""}
        >${escapeHtml(i18n.paginationPrevious)}</button>
        <div class="forge-reviews__pagination-pages">${items.join("")}</div>
        <button
          type="button"
          class="forge-reviews__pagination-arrow"
          data-page="${current + 1}"
          ${nextDisabled ? "disabled" : ""}
        >${escapeHtml(i18n.paginationNext)}</button>`;
    }

    async goToPage(page) {
      const pagerEl = this.querySelector('[data-role="pagination"]');
      const listEl = this.querySelector('[data-role="list"]');
      if (listEl) listEl.setAttribute("aria-busy", "true");
      try {
        const data = await this.fetchPage(page);
        this.renderListAndPagination(data);
        const box = this.querySelector(".forge-reviews__box");
        if (box) {
          box.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      } finally {
        if (listEl) listEl.removeAttribute("aria-busy");
        if (pagerEl) pagerEl.removeAttribute("aria-busy");
      }
    }

    renderInlineForm() {
      this.classList.add(`forge-reviews--form-width-${this.formWidth}`);
      this.innerHTML = this.formMarkup({ inDialog: false });
      this.wireForm(this.querySelector("form.forge-reviews__form"));
    }

    formMarkup({ inDialog }) {
      const i18n = this.i18n;
      const productImage = this.productImage
        ? `<img src="${escapeHtml(this.productImage)}" alt="${escapeHtml(this.productTitle || "Product")}" class="forge-reviews__form-product-image" />`
        : "";
      const ratingStars = [1, 2, 3, 4, 5]
        .map(
          (n) => `<button
            type="button"
            class="forge-reviews__rating-star"
            data-value="${n}"
            role="radio"
            aria-checked="${n === 5 ? "true" : "false"}"
            aria-label="${escapeHtml(fmt(i18n.starsAriaLabel, { count: n }))}"
            tabindex="${n === 5 ? "0" : "-1"}"
          >★</button>`,
        )
        .join("");
      const initialHint = fmt(i18n.minCharsHint, { count: BODY_MIN_CHARS });

      return `
        <form class="forge-reviews__form${inDialog ? " forge-reviews__form--dialog" : ""}" novalidate>
          ${this.sample ? '<div class="forge-reviews__sample-badge">Sample data - preview only</div>' : ""}
          ${inDialog ? `<h3 id="forge-reviews-dialog-title" class="forge-reviews__form-title">${escapeHtml(i18n.dialogTitle)}</h3>` : ""}

          <input type="hidden" name="hp_url" value="" tabindex="-1" autocomplete="off" />
          <input type="hidden" name="t_open" value="${Date.now()}" />
          <input type="hidden" name="form_token" value="" data-role="form-token" />
          <input type="hidden" name="rating" value="5" />
          <input type="hidden" name="title" value="" />

          <div class="forge-reviews__form-grid">
            <aside class="forge-reviews__form-product">
              ${productImage}
              <div
                class="forge-reviews__rating-picker"
                role="radiogroup"
                aria-label="${escapeHtml(i18n.yourRatingLabel)}"
                style="--forge-stars-color:${this.starsColor}"
              >
                ${ratingStars}
              </div>
              <div class="forge-reviews__rating-label" data-role="rating-label">${escapeHtml(i18n.ratingLabels[5])}</div>
            </aside>

            <div class="forge-reviews__form-fields">
              <label class="forge-reviews__field">
                <span class="forge-reviews__label">${escapeHtml(i18n.nameLabel)} <em aria-hidden="true">*</em></span>
                <input name="author_name" required placeholder="${escapeHtml(i18n.namePlaceholder)}" autocomplete="name" />
              </label>
              <label class="forge-reviews__field">
                <span class="forge-reviews__label">${escapeHtml(i18n.emailLabel)}</span>
                <input name="email" type="email" required placeholder="${escapeHtml(i18n.emailPlaceholder)}" autocomplete="email" />
              </label>
              <label class="forge-reviews__field forge-reviews__field--full">
                <span class="forge-reviews__label">${escapeHtml(i18n.feedbackLabel)} <em aria-hidden="true">*</em></span>
                <textarea name="body" required rows="5" placeholder="${escapeHtml(i18n.feedbackPlaceholder)}"></textarea>
              </label>

              <div class="forge-reviews__hint forge-reviews__field--full" data-role="hint">
                ${escapeHtml(initialHint)}
              </div>

              <label class="forge-reviews__dropzone forge-reviews__field--full">
                <input type="file" name="photos[]" accept="image/jpeg,image/png,image/gif" multiple />
                <div class="forge-reviews__dropzone-content">
                  <svg class="forge-reviews__dropzone-icon" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                    <path fill="currentColor" d="M12 5a7 7 0 0 0-6.91 5.86A4.5 4.5 0 0 0 6 19.5h11.5a4.5 4.5 0 0 0 .9-8.92A7 7 0 0 0 12 5Zm0 3.5 3.5 3.5h-2v3h-3v-3h-2L12 8.5Z" />
                  </svg>
                  <div class="forge-reviews__dropzone-text" data-role="dropzone-text">
                    ${escapeHtml(i18n.photosHint)}
                  </div>
                </div>
              </label>
            </div>
          </div>

          <p class="forge-reviews__message" role="status" hidden></p>

          <div class="forge-reviews__form-footer">
            ${inDialog ? `<button type="button" class="forge-reviews__btn forge-reviews__btn--ghost" data-action="cancel">${escapeHtml(i18n.cancel)}</button>` : ""}
            <button type="submit" class="forge-reviews__btn forge-reviews__btn--primary"${this.sample ? " disabled" : ""}>${escapeHtml(i18n.submit)}</button>
          </div>
        </form>`;
    }

    wireForm(form) {
      if (!form) return;
      const i18n = this.i18n;
      void this.ensureFormToken(form);

      const ratingInput = form.querySelector('input[name="rating"]');
      const ratingLabel = form.querySelector('[data-role="rating-label"]');
      const stars = Array.from(form.querySelectorAll(".forge-reviews__rating-star"));
      const setRating = (value) => {
        ratingInput.value = String(value);
        stars.forEach((s) => {
          const v = Number(s.dataset.value);
          const active = v <= value;
          s.classList.toggle("is-filled", active);
          s.setAttribute("aria-checked", v === value ? "true" : "false");
          s.tabIndex = v === value ? 0 : -1;
        });
        if (ratingLabel) ratingLabel.textContent = i18n.ratingLabels[value] || "";
      };
      setRating(5);
      stars.forEach((star) => {
        star.addEventListener("click", () => setRating(Number(star.dataset.value)));
        star.addEventListener("keydown", (event) => {
          if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            event.preventDefault();
            setRating(Math.min(5, Number(ratingInput.value) + 1));
            form.querySelector(`.forge-reviews__rating-star[data-value="${ratingInput.value}"]`)?.focus();
          } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            event.preventDefault();
            setRating(Math.max(1, Number(ratingInput.value) - 1));
            form.querySelector(`.forge-reviews__rating-star[data-value="${ratingInput.value}"]`)?.focus();
          }
        });
      });

      const body = form.querySelector('textarea[name="body"]');
      const hint = form.querySelector('[data-role="hint"]');
      const updateHint = () => {
        if (!hint) return;
        const len = body.value.trim().length;
        if (len >= BODY_MIN_CHARS) {
          hint.hidden = true;
        } else {
          hint.hidden = false;
          hint.textContent = fmt(i18n.minCharsHint, { count: BODY_MIN_CHARS - len });
        }
      };
      body?.addEventListener("input", updateHint);
      updateHint();

      const fileInput = form.querySelector('input[type="file"]');
      const dropzoneText = form.querySelector('[data-role="dropzone-text"]');
      fileInput?.addEventListener("change", () => {
        if (!dropzoneText) return;
        const count = fileInput.files?.length || 0;
        dropzoneText.textContent = count
          ? fmt(i18n.photosSelected, { count })
          : i18n.photosHint;
      });

      form.addEventListener("submit", (event) => this.onSubmit(event, form));
    }

    async ensureFormToken(form) {
      if (this.sample || !this.apiBase || !this.shop || !this.product) return;
      const tokenInput = form.querySelector('[data-role="form-token"]');
      if (!tokenInput) return;
      try {
        const url = `${this.apiBase}/api/reviews/form-token?shop=${encodeURIComponent(this.shop)}&product=${encodeURIComponent(this.product)}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        if (data?.token) tokenInput.value = data.token;
      } catch {
        // fall back to t_open timing check on server
      }
    }

    async onSubmit(event, form) {
      event.preventDefault();
      if (this.sample) return;
      const i18n = this.i18n;

      const fd = new FormData(form);
      const body = String(fd.get("body") ?? "").trim();
      if (body.length < BODY_MIN_CHARS) {
        this.showMessage(form, fmt(i18n.minCharsHint, { count: BODY_MIN_CHARS - body.length }), "error");
        return;
      }
      fd.set("title", deriveTitleFromBody(body));
      fd.set("shop", this.shop);
      fd.set("product", this.product);
      fd.set("locale", this.locale);
      await this.ensureFormToken(form);

      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const res = await fetch(`${this.apiBase}/api/reviews/submit`, { method: "POST", body: fd });
        const data = await res.json();
        const isPending = data.status === "pending";
        this.showMessage(
          form,
          isPending ? i18n.submitThanks : humanizeSubmitError(i18n, data.error),
          isPending ? "success" : "error",
        );
        if (isPending) {
          form.reset();
          const ratingInput = form.querySelector('input[name="rating"]');
          if (ratingInput) ratingInput.value = "5";
          form.querySelectorAll(".forge-reviews__rating-star").forEach((s) => {
            s.classList.toggle("is-filled", Number(s.dataset.value) <= 5);
          });
          const hint = form.querySelector('[data-role="hint"]');
          if (hint) hint.hidden = false;
        }
      } catch {
        this.showMessage(form, i18n.genericError, "error");
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    }

    showMessage(form, text, tone) {
      const msg = form.querySelector(".forge-reviews__message");
      if (!msg) return;
      msg.hidden = false;
      msg.textContent = text;
      msg.dataset.tone = tone;
    }
  }

  customElements.define("forge-reviews", ForgeReviews);
})();
