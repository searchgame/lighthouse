/**
 * Copyright 2017 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

/**
 * @fileoverview The entry point for rendering the Lighthouse report based on the JSON output.
 *    This file is injected into the report HTML along with the JSON report.
 *
 * Dummy text for ensuring report robustness: </script> pre$`post %%LIGHTHOUSE_JSON%%
 */

/* eslint-env browser */
/* eslint indent: [2, 2, { "SwitchCase": 1, "outerIIFEBody": 0 }] */

(function() {
const RATINGS = {
  PASS: {label: 'pass', minScore: 75},
  AVERAGE: {label: 'average', minScore: 45},
  FAIL: {label: 'fail'}
};

/**
 * Convert a score to a rating label.
 * @param {!number} score
 * @param {!string} precision One of 'binary', 'number', 'grade'.
 * @return {!string}
 */
function calculateRating(score, precision) {
  if (precision === 'numeric') {
    let rating = RATINGS.FAIL.label;
    if (score >= RATINGS.PASS.minScore) {
      rating = RATINGS.PASS.label;
    } else if (score >= RATINGS.AVERAGE.minScore) {
      rating = RATINGS.AVERAGE.label;
    }
    return rating;
  } else if (precision === 'grade') {
    // Not implemented yet.
  }

  // Treat as binary by default.
  return score === 100 ? RATINGS.PASS.label : RATINGS.FAIL.label;
}

/**
 * Format number.
 * @param {!number} number
 * @return {!string}
 */
function formatNumber(number) {
  return number.toLocaleString(undefined, {maximumFractionDigits: 1});
}

class DOM {
  /**
   * @param {!Document} document
   */
  constructor(document) {
    this._document = document;
  }

  /**
   * Sets the text content of an element.
   * @param {Element} element
   * @param {!string} text
   * @return {Element}
   */
  static setText(element, text) {
    if (element) {
      element.textContent = text;
    }
    return element;
  }

  /**
   * Adds a class to an element.
   * @param {Element} element
   * @param {...!string} classes
   * @return {Element}
   */
  static addClass(element, ...classes) {
    if (element) {
      element.classList.add(...classes);
    }
    return element;
  }

  /**
   * @param {string} name
   * @param {string=} className
   * @param {!Object<string, string>=} attrs Attribute key/val pairs.
   * @return {!Element}
   */
  createElement(name, className = null, attrs = {}) {
    const element = this._document.createElement(name);
    if (className) {
      element.className = className;
    }
    for (const [key, val] of Object.entries(attrs)) {
      element.setAttribute(key, val);
    }
    return element;
  }

  /**
   * @param {!string} selector
   * @return {!DocumentFragment} A clone of the template content.
   * @throws {Error}
   */
  cloneTemplate(selector) {
    const template = this._document.querySelector(selector);
    if (!template) {
      throw new Error(`Template not found: template${selector}`);
    }
    return this._document.importNode(template.content, true);
  }
}

class ReportRenderer {
  /**
   * @param {!Document} document
   */
  constructor(document) {
    this._dom = new DOM(document);
  }

  /**
   * @param {!ReportJSON} report
   * @return {!Element}
   */
  renderReport(report) {
    try {
      return this._renderReport(report);
    } catch (e) {
      return this._renderException(e);
    }
  }

  /**
   * @param {!number} score
   * @param {!string} title
   * @param {!string} description
   * @param {!(AuditJSON|CategoryJSON)} auditOrCategory
   * @return {!Element}
   */
  _renderScore(score, title, description, auditOrCategory) {
    const isAudit = 'result' in auditOrCategory;
    const precision = isAudit ? 'binary' : 'category'; // TODO(ericbidelman): placeholder
    const rating = calculateRating(score, precision);

    // Grab the correct html template.
    const tmpl = isAudit ? this._dom.cloneTemplate('#tmpl-lighthouse-audit-score') :
                           this._dom.cloneTemplate('#tmpl-lighthouse-category-score');

    // Fill in the blanks.
    const value = tmpl.querySelector('.lighthouse-score__value');
    DOM.setText(value, formatNumber(score));
    DOM.addClass(value, `lighthouse-score__value--${rating}`,
                        `lighthouse-score__value--${precision}`);

    DOM.setText(tmpl.querySelector('.lighthouse-score__title'), title);
    DOM.setText(tmpl.querySelector('.lighthouse-score__description'), description);

    const header = tmpl.querySelector('.lighthouse-score__header');
    if (isAudit && header) {
      header.open = score < 100; // expand failed audits
      if (auditOrCategory.result.details) {
        header.appendChild(this._renderDetails(auditOrCategory.result.details));
      }
    }

    return tmpl;
  }

  /**
   * @param {!DetailsJSON} details
   * @return {!Element}
   */
  _renderDetails(details) {
    switch (details.type) {
      case 'text':
        return this._renderText(details);
      case 'block':
        return this._renderBlock(details);
      case 'list':
        return this._renderList(details);
      default:
        throw new Error(`Unknown type: ${details.type}`);
    }
  }

  /**
   * @param {!DetailsJSON} text
   * @return {!Element}
   */
  _renderText(text) {
    const element = this._dom.createElement('div', 'lighthouse-text');
    element.textContent = text.text;
    return element;
  }

  /**
   * @param {!DetailsJSON} block
   * @return {!Element}
   */
  _renderBlock(block) {
    const element = this._dom.createElement('div', 'lighthouse-block');
    for (const item of block.items) {
      element.appendChild(this._renderDetails(item));
    }
    return element;
  }

  /**
   * @param {!DetailsJSON} list
   * @return {!Element}
   */
  _renderList(list) {
    const element = this._dom.createElement('details', 'lighthouse-list');
    if (list.header) {
      const summary = this._dom.createElement('summary', 'lighthouse-list__header');
      summary.textContent = list.header.text;
      element.appendChild(summary);
    }

    const items = this._dom.createElement('div', 'lighthouse-list__items');
    for (const item of list.items) {
      items.appendChild(this._renderDetails(item));
    }
    element.appendChild(items);
    return element;
  }

  /**
   * @param {!Error} e
   * @return {!Element}
   */
  _renderException(e) {
    const element = this._dom.createElement('div', 'lighthouse-exception');
    element.textContent = String(e.stack);
    return element;
  }

  /**
   * @param {!ReportJSON} report
   * @return {!Element}
   */
  _renderReport(report) {
    const element = this._dom.createElement('div', 'lighthouse-report');
    for (const category of report.reportCategories) {
      element.appendChild(this._renderCategory(category));
    }
    return element;
  }

  /**
   * @param {!CategoryJSON} category
   * @return {!Element}
   */
  _renderCategory(category) {
    const element = this._dom.createElement('div', 'lighthouse-category');
    element.appendChild(
        this._renderScore(category.score, category.name, category.description, category));
    for (const audit of category.audits) {
      element.appendChild(this._renderAudit(audit));
    }
    return element;
  }

  /**
   * @param {!AuditJSON} audit
   * @return {!Element}
   */
  _renderAudit(audit) {
    const element = this._dom.createElement('div', 'lighthouse-audit');
    let title = audit.result.description;
    if (audit.result.displayValue) {
      title += `:  ${audit.result.displayValue}`;
    }
    if (audit.result.optimalValue) {
      title += ` (target: ${audit.result.optimalValue})`;
    }

    element.appendChild(
        this._renderScore(audit.score, title, audit.result.helpText, audit));

    return element;
  }
}

// Exports
self.ReportRenderer = ReportRenderer;
})(self);

/** @typedef {{type: string, text: string|undefined, header: DetailsJSON|undefined, items: Array<DetailsJSON>|undefined}} */
let DetailsJSON; // eslint-disable-line no-unused-vars

/** @typedef {{id: string, weight: number, score: number, result: {description: string, displayValue: string, helpText: string, score: number|boolean, details: DetailsJSON|undefined}}} */
let AuditJSON; // eslint-disable-line no-unused-vars

/** @typedef {{name: string, weight: number, score: number, description: string, audits: Array<AuditJSON>}} */
let CategoryJSON; // eslint-disable-line no-unused-vars

/** @typedef {{reportCategories: Array<CategoryJSON>}} */
let ReportJSON; // eslint-disable-line no-unused-vars
