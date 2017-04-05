/**
 * @license
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

const fs = require('fs');
const path = require('path');

const REPORT_TEMPLATE = fs.readFileSync(path.join(__dirname, './report-template.html'), 'utf8');
// TODO: Setup a gulp pipeline to concat and minify the renderer files?
const REPORT_JAVASCRIPT = fs.readFileSync(path.join(__dirname, './report-renderer.js'), 'utf8');
const REPORT_CSS = fs.readFileSync(path.join(__dirname, './report-styles.css'), 'utf8');
const REPORT_TEMPLATES = fs.readFileSync(path.join(__dirname, './templates.html'), 'utf8');

class ReportGeneratorV2 {
  /**
   * Computes the weighted-average of the score of the list of items.
   * @param {!Array<{score: number|undefined, weight: number|undefined}} items
   * @return {number}
   */
  static arithmeticMean(items) {
    const results = items.reduce((result, item) => {
      const score = Number(item.score) || 0;
      const weight = Number(item.weight) || 0;
      return {
        weight: result.weight + weight,
        sum: result.sum + score * weight,
      };
    }, {weight: 0, sum: 0});

    return (results.sum / results.weight) || 0;
  }

  /**
   * Replaces all the specified strings in source without serial replacements.
   * @param {string} source
   * @param {!Array<{search: string, replacement: string}>} replacements
   */
  static replaceStrings(source, replacements) {
    if (replacements.length === 0) {
      return source;
    }

    const firstReplacement = replacements[0];
    const nextReplacements = replacements.slice(1);
    return source
        .split(firstReplacement.search)
        .map(part => ReportGeneratorV2.replaceStrings(part, nextReplacements))
        .join(firstReplacement.replacement);
  }

  /**
   * Returns the report JSON object with computed scores.
   * @param {{categories: !Object<{audits: !Array}>}} config
   * @param {!Object<{score: ?number|boolean|undefined}>} resultsByAuditId
   * @return {{categories: !Array<{audits: !Array<{score: number, result: !Object}>}>}}
   */
  generateReportJson(config, resultsByAuditId) {
    const categories = Object.keys(config.categories).map(categoryId => {
      const category = config.categories[categoryId];

      const audits = category.audits.map(audit => {
        const result = resultsByAuditId[audit.id];
        // Cast to number to catch `null` and undefined when audits error
        let auditScore = Number(result.score) || 0;
        if (typeof result.score === 'boolean') {
          auditScore = result.score ? 100 : 0;
        }

        return Object.assign({}, audit, {result, score: auditScore});
      });

      const categoryScore = Math.round(ReportGeneratorV2.arithmeticMean(audits));
      return Object.assign({}, category, {audits, score: categoryScore});
    });
    const overallScore = ReportGeneratorV2.arithmeticMean(categories);
    return {score: overallScore, categories};
  }

  /**
   * Returns the report HTML as a string with the report JSON and renderer JS inlined.
   * @param {!Object} reportAsJson
   * @return {string}
   */
  generateReportHtml(reportAsJson) {
    const sanitizedJson = JSON.stringify(reportAsJson).replace(/</g, '\\u003c');
    const sanitizedJavascript = REPORT_JAVASCRIPT.replace(/<\//g, '\\u003c/');
    // Remove script in templates files just to be safe.
    const sanitizedTemplates = REPORT_TEMPLATES.replace(/<script>([\s\S]*?)<\/script>/g, '');

    return ReportGeneratorV2.replaceStrings(REPORT_TEMPLATE, [
      {search: '%%LIGHTHOUSE_JSON%%', replacement: sanitizedJson},
      {search: '%%LIGHTHOUSE_JAVASCRIPT%%', replacement: sanitizedJavascript},
      {search: '/*%%LIGHTHOUSE_CSS%%*/', replacement: REPORT_CSS},
      {search: '%%LIGHTHOUSE_TEMPLATES%%', replacement: sanitizedTemplates},
    ]);
  }
}

module.exports = ReportGeneratorV2;
