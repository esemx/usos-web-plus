// ==UserScript==
// @name         USOS Web Plus
// @namespace    http://tampermonkey.net/
// @version      0.0.1
// @description  USOS Web Plus - dark mode with additional features
// @author       smx*
// @match        *://*/*
// @icon         https://www.google.com/s2/favicons?domain=usos.edu.pl
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function() {
  'use strict';

  const host = location.hostname;
  if (!/^(?:[a-z0-9-]+\.)?(usosweb|web\.usos|cas\.usos)\.[a-z0-9.-]+$/i.test(host)) return;

  const COLORS = {
    LIGHT_TEXT: '#1F1F1F',
    BORDER_SEPARATOR: '#dbdbd7',
    BACKGROUND_PAGE: '#EDEDED',
    DIALOG_BG: '#1e1e1e',
    DIALOG_TEXT: '#e0e0e0',
    DIALOG_HEADER_BG: '#2a2a2a',
    DIALOG_BUTTON_BG: '#3a3a3a',
    DIALOG_BUTTON_HOVER: '#4a4a4a',
    DIALOG_LINK: '#4fc3f7',
    DIALOG_LINK_HOVER: '#81d4fa',
  };

  const SELECTORS = {
    SLOT_TITLES: '[slot="title"]',
    TABLE_HEADERS: 'thead th, th',
    TABLE_HEAD: 'thead',
    USOS_FRAME: 'usos-frame',
    USOS_DIALOG: 'usos-dialog',
    INFO_BOXES: 'info-box, notice-box',
  };

  const UPDATE_INTERVALS = {
    MUTATION_DELAY: 100,
    CACHE_CLEANUP: 5000,
  };

  const CACHE_CONFIG = {
    DURATION: 500,
    ENABLED: true,
    MAX_AGE: 1000,
  };

  const PERFORMANCE_CONFIG = { FRAME_BUDGET: 16.67 };

	/**
	 * Caches results of querySelectorAll to improve performance.
	 * Automatically invalidates cache if stale or elements removed from DOM.
	 */
  class DOMCache {
    static #cache = new Map();
    static #cacheTime = new Map();

		/**
		 * Returns elements matching the CSS selector, using cache if valid.
		 * @param {string} selector - CSS selector string.
		 * @returns {Element[]} Array of matching DOM elements.
		 */
    static query(selector) {
      if (!CACHE_CONFIG.ENABLED) return Array.from(document.querySelectorAll(selector));
			
      const now = Date.now();
      const cached = this.#cache.get(selector);
      const ts = this.#cacheTime.get(selector);
			
      if (cached?.length && (now - ts) < CACHE_CONFIG.DURATION) {
        if (cached.length <= 2 || (document.contains(cached[0]) && document.contains(cached[cached.length - 1]))) {
          return cached;
        }
      }
			
      const els = Array.from(document.querySelectorAll(selector));
			
      this.#cache.set(selector, els);
      this.#cacheTime.set(selector, now);
			
      return els;
    }

		/**
		 * Invalidates cached entries for a specific selector or all if none provided.
		 * @param {string} [selector] - Optional CSS selector to invalidate cache for.
		 *                              If omitted, clears entire cache.
		 * @returns {void}
		 */
    static invalidate(selector = null) {
      if (selector) {
        this.#cache.delete(selector);
        this.#cacheTime.delete(selector);
      } else {
        this.#cache.clear();
        this.#cacheTime.clear();
      }
    }

		/**
		 * Removes stale cache entries older than configured maximum age.
		 * @returns {void}
		 */
    static invalidateStale() {
      const now = Date.now();
			
      for (const [sel, ts] of this.#cacheTime.entries()) {
        if (now - ts > CACHE_CONFIG.MAX_AGE) this.invalidate(sel);
      }
    }
  }

  /**
   * Wrapper around Greasemonkey/Tampermonkey storage functions for script settings.
   */
  class StorageManager {
		/** @returns {boolean} Whether dark mode is enabled (default: true) */
    static get darkMode() {
			return GM_getValue('darkMode', true);
		}
		
		/** @param {boolean} v Set dark mode enabled/disabled */
    static set darkMode(v) {
			GM_setValue('darkMode', v);
		}
		
		/** @returns {string} Current stored script version */
    static get version() {
			return GM_getValue('version', '0.0.1');
		}
		
		/** @param {string} v Set stored script version */
    static set version(v) {
			GM_setValue('version', v);
		}
  }

  /**
   * Contains CSS styles for Shadow DOM elements such as dialogs and info boxes.
   */
  class ShadowDOMStyles {
		/**
     * Returns CSS styles for dialog components inside Shadow DOM.
     * @returns {string}
     */
    static get dialog() {
      return `
        * { background-color: ${COLORS.DIALOG_BG} !important; color: ${COLORS.DIALOG_TEXT} !important; box-shadow:none !important; text-shadow:none !important; }
        #header { background-color:${COLORS.DIALOG_HEADER_BG} !important; border-bottom:1px solid ${COLORS.BORDER_SEPARATOR} !important; color:#f0f0f0 !important; }
        button { background-color:${COLORS.DIALOG_BUTTON_BG} !important; color:${COLORS.DIALOG_TEXT} !important; border:1px solid #4a4a4a !important; transition:background-color .2s ease !important; }
        button:hover { background-color:${COLORS.DIALOG_BUTTON_HOVER} !important; }
        a { color:${COLORS.DIALOG_LINK} !important; transition:color .2s ease !important; }
        a:hover { color:${COLORS.DIALOG_LINK_HOVER} !important; }
        .usos-ui { background-color:${COLORS.DIALOG_BG} !important; }
        #backdrop { background-color:rgba(0,0,0,.7) !important; }
      `;
    }

    /**
     * Returns CSS styles for info boxes inside Shadow DOM.
     * @returns {string}
     */
    static get infoBox() {
      return `*{box-shadow:none !important;text-shadow:none !important;}`;
    }
  }

  /**
   * Applies CSS styles to various page elements and Shadow DOM components.
   */
  class StyleApplier {
    static #styleCache = new WeakMap();

    /**
     * Applies CSS styles to slot title elements.
     * @returns {void}
     */
    static applySlotTitles() {
      this.#batchApplyStyles(DOMCache.query(SELECTORS.SLOT_TITLES), {
				color: COLORS.LIGHT_TEXT,
				'font-weight': '600'
			});
    }	
		
    /**
     * Applies CSS styles to table headers and table heads.
     * @returns {void}
     */
    static applyTableHeaders() {
      this.#batchApplyStyles(DOMCache.query(SELECTORS.TABLE_HEADERS), {
				color: COLORS.LIGHT_TEXT,
				'font-weight': '600'
			});
			
      this.#batchApplyStyles(DOMCache.query(SELECTORS.TABLE_HEAD), {
				'border-bottom': `2px solid ${COLORS.BORDER_SEPARATOR}`
			});
    }

    /**
     * Applies styles to usos-frame header elements inside Shadow DOM.
     * Adds border and adjusts background based on presence of slot title.
     * @returns {void}
     */
    static applyFrameHeaders() {
      const frames = DOMCache.query(SELECTORS.USOS_FRAME);
			
      requestAnimationFrame(() => {
        frames.forEach(frame => {
          if (!frame.shadowRoot) return;
          const header = frame.shadowRoot.querySelector('#header');
					
          if (!header) return;
          if (!header.dataset.accentColor) header.dataset.accentColor = getComputedStyle(header).backgroundColor;
					
          const accent = header.dataset.accentColor;
          const title = frame.querySelector(SELECTORS.SLOT_TITLES);
					
          const hasTitle = title && title.textContent.trim().length > 0;
          if (hasTitle) {
            header.style.setProperty('background', 'transparent', 'important');
            header.style.setProperty('border-left', `4px solid ${accent}`, 'important');
          } else {
            header.style.setProperty('background', accent, 'important');
            header.style.setProperty('border-left', 'none', 'important');
          }
					
          header.style.setProperty('border-bottom', `1px solid ${COLORS.BORDER_SEPARATOR}`, 'important');
          header.style.removeProperty('filter');
        });
      });
    }

    /**
     * Applies dark mode styles to usos-dialog Shadow DOM elements, avoids duplicate style insertion.
     * @returns {void}
     */
    static applyDialogs() {
      const dialogs = DOMCache.query(SELECTORS.USOS_DIALOG);
			
      requestAnimationFrame(() => {
        dialogs.forEach(d => {
          if (!d.shadowRoot || this.#styleCache.has(d)) return;
					
          const st = document.createElement('style');
					st.textContent = ShadowDOMStyles.dialog;
					
          d.shadowRoot.appendChild(st);
					this.#styleCache.set(d, true);
        });
      });
    }

    /**
     * Applies minimal style fixes to info-box and notice-box Shadow DOM elements.
     * @returns {void}
     */
    static applyInfoBoxes() {
      const boxes = DOMCache.query(SELECTORS.INFO_BOXES);
			
      requestAnimationFrame(() => {
        boxes.forEach(b => {
          if (!b.shadowRoot || this.#styleCache.has(b)) return;
					
          const st = document.createElement('style');
					st.textContent = ShadowDOMStyles.infoBox;
					
          b.shadowRoot.appendChild(st);
					this.#styleCache.set(b, true);
        });
      });
    }

    /**
     * Applies styles to all configured selectors and Shadow DOM elements.
     * @returns {void}
     */
    static applyAll() {
      this.applySlotTitles();
      this.applyTableHeaders();
      this.applyFrameHeaders();
      this.applyDialogs();
      this.applyInfoBoxes();
    }
		
		/**
     * Helper to apply a batch of CSS properties with !important to multiple elements asynchronously.
     * @param {Element[]} elements - Array of DOM elements to style.
     * @param {Object.<string, string>} styles - CSS property-value pairs.
     * @returns {void}
     */
    static #batchApplyStyles(elements, styles) {
      requestAnimationFrame(() => {
        elements.forEach(el => Object.entries(styles).forEach(([p,v]) => el.style.setProperty(p, v, 'important')));
      });
    }
  }

  /**
   * Manages dark mode initialization, mutation observing, event handling, and cleanup.
   */
  class DarkModeManager {
    static #abortController = new AbortController();
    static #mutationTimeout = null;
    static #observer = null;

    /**
     * Initializes dark mode styles, observers, event delegation and cache cleanup.
     * @returns {void}
     */
    static initialize() {
      this.injectGlobalStyles();
      this.setupEventDelegation();
      this.setupInitialUpdate();
      this.setupMutationObserver();
      this.setupCacheCleanup();
      this.checkVersion();
    }

    /**
     * Injects global CSS styles for dark mode with necessary filters and fixes.
     * @returns {void}
     */
    static injectGlobalStyles() {
      GM_addStyle(`
        html { background-color:${COLORS.BACKGROUND_PAGE} !important; filter: invert(1) hue-rotate(180deg) !important; }
        img, video, iframe, [style*="background-image"] { filter: invert(1) hue-rotate(180deg) !important; }
        svg { filter: none !important; }
        ::-webkit-scrollbar { filter: invert(1) hue-rotate(180deg) !important; }
        ${SELECTORS.SLOT_TITLES} { color:${COLORS.LIGHT_TEXT} !important; font-weight:600 !important; }
        ${SELECTORS.TABLE_HEADERS} { color:${COLORS.LIGHT_TEXT} !important; font-weight:600 !important; }
        ${SELECTORS.TABLE_HEAD} { border-bottom:2px solid ${COLORS.BORDER_SEPARATOR} !important; }
        * { box-shadow:none !important; text-shadow:none !important; }
      `);
    }

    /**
     * Sets up event listeners for clicks and focus inside usos-dialog elements to re-apply styles.
     * Uses AbortController for cleanup.
     * @returns {void}
     */
    static setupEventDelegation() {
      const { signal } = this.#abortController;
			
      document.addEventListener('click', e => {
        if (e.target.closest(SELECTORS.USOS_DIALOG)) StyleApplier.applyDialogs();
      }, {
				passive: true,
				signal
			});
			
      document.addEventListener('focusin', e => {
        if (e.target.closest(SELECTORS.USOS_DIALOG)) StyleApplier.applyDialogs();
      }, {
				passive: true,
				signal
			});
    }

    /**
     * Triggers initial style application using requestAnimationFrame and timeout.
     * @returns {void}
     */
    static setupInitialUpdate() {
      requestAnimationFrame(() => StyleApplier.applyAll());
      setTimeout(() => {
				StyleApplier.applyAll();
				DOMCache.invalidate();
			}, 500);
    }

    /**
     * Sets up a MutationObserver on document.body to watch for DOM changes and reapply styles.
     * Uses a timeout debounce for performance.
     * @returns {void}
     */
    static setupMutationObserver() {
      this.#observer = new MutationObserver(() => {
        clearTimeout(this.#mutationTimeout);
				
        this.#mutationTimeout = setTimeout(() => {
					StyleApplier.applyAll();
					DOMCache.invalidate();
				}, UPDATE_INTERVALS.MUTATION_DELAY);
      });
			
      this.#observer.observe(document.body, {
				childList: true,
				subtree: true
			});
    }

    /**
     * Sets up interval to periodically invalidate stale cache entries.
     * @returns {void}
     */
    static setupCacheCleanup() {
      const { signal } = this.#abortController;
			
      const id = setInterval(() => DOMCache.invalidateStale(), UPDATE_INTERVALS.CACHE_CLEANUP);
      signal.addEventListener('abort', () => clearInterval(id));
    }

    /**
     * Checks if the current script version differs from stored version, and updates storage if so.
     * @returns {void}
     */
    static checkVersion() {
      const current = (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version) ? GM_info.script.version : '0.0.1';
      const saved = StorageManager.version;
			
      if (saved !== current) {
				StorageManager.version = current;
			}
    }

    /**
     * Toggles dark mode setting and reloads the page.
     * @returns {void}
     */
    static toggle() {
			StorageManager.darkMode = !StorageManager.darkMode;
			location.reload();
		}

    /**
     * Cleans up event listeners, observers and timeouts on unload.
     * @returns {void}
     */
    static cleanup() {
      this.#abortController.abort();
      if (this.#observer) this.#observer.disconnect();
			
      clearTimeout(this.#mutationTimeout);
      DOMCache.invalidate();
    }
  }

  /**
   * Main application initializer and menu command manager.
   */
  class Application {
		/**
     * Initializes the script if dark mode enabled.
     * Registers menu commands and unload handlers.
     * @returns {void}
     */
    static initialize() {
      if (!StorageManager.darkMode) {
				this.registerMenuCommands();
				return;
			}
			
      try {
        DarkModeManager.initialize();
        this.registerMenuCommands();
        this.setupUnloadHandler();
      } catch {}
    }

    /**
     * Registers Tampermonkey menu command to toggle dark mode.
     * @returns {void}
     */
    static registerMenuCommands() {
      GM_registerMenuCommand('Toggle dark mode', () => DarkModeManager.toggle());
    }

    /**
     * Sets up handler to cleanup dark mode on page unload.
     * @returns {void}
     */
    static setupUnloadHandler() {
      window.addEventListener('beforeunload', () => DarkModeManager.cleanup(), {
				once: true
			});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Application.initialize());
  } else {
    Application.initialize();
  }
})();