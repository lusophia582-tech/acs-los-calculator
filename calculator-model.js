/* Locked September 2026 (48-h model). No fitting or coefficient rounding.
 * Source: final_model_coefficients_full_precision.csv
 * MD5: 48542b3f9a6ec4aa4618d8d8b28812be
 * UMD keeps the same prediction function available to the page and Node tests.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ACSModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 'September 2026 (48-h model)';
  const COEFFICIENTS = Object.freeze({
    intercept: -2.8497725944889343,
    pulseRate: 0.009547265724021441,
    killipII: -0.04316960032265231,
    killipIII: 0.36656075772319774,
    killipIV: 1.8724727429039094,
    ef: -0.014337959165643992,
    lnNTproBNP: 0.22497895370910648,
    lnDdimer: 0.27342587892791931,
    ccuYes: 1.0023343487215808
  });
  const THRESHOLDS = Object.freeze({ low: 0.10, high: 0.39 });
  const DEVELOPMENT_RANGES = Object.freeze({
    pulseRate: Object.freeze([40, 185]), ef: Object.freeze([10, 75]),
    ntProBNP: Object.freeze([2, 35000]), dDimer: Object.freeze([0.07, 40.1])
  });
  const FIELD_LABELS = Object.freeze({
    pulseRate: 'Pulse rate', ef: 'EF', ntProBNP: 'NT-proBNP', dDimer: 'D-dimer'
  });
  class CalculatorInputError extends Error {
    constructor(errors) {
      super(Object.values(errors).join(' '));
      this.name = 'CalculatorInputError';
      this.fieldErrors = errors;
    }
  }
  function validateInputs(input = {}) {
    const errors = {};
    for (const key of Object.keys(FIELD_LABELS)) {
      const value = input[key];
      if (value === '' || value === null || value === undefined) errors[key] = `${FIELD_LABELS[key]} is required.`;
      else if (typeof value !== 'number' || !Number.isFinite(value)) errors[key] = `${FIELD_LABELS[key]} must be a finite number.`;
    }
    for (const key of ['ntProBNP', 'dDimer']) {
      if (!errors[key] && input[key] <= 0) errors[key] = `${FIELD_LABELS[key]} must be greater than 0.`;
    }
    if (!['I', 'II', 'III', 'IV'].includes(input.killipClass)) errors.killipClass = 'Select Killip class I, II, III, or IV.';
    if (typeof input.ccuWithin48h !== 'boolean') errors.ccuWithin48h = 'Select No or Yes for CCU admission within the first 48 hours.';
    return errors;
  }
  function classifyRisk(probability) {
    if (typeof probability !== 'number' || !Number.isFinite(probability) || probability < 0 || probability > 1) {
      throw new RangeError('Probability must be a finite number from 0 to 1.');
    }
    if (probability < THRESHOLDS.low) return 'Low risk';
    if (probability < THRESHOLDS.high) return 'Intermediate risk';
    return 'High risk';
  }
  function predictProlongedLOS(input = {}) {
    const errors = validateInputs(input);
    if (Object.keys(errors).length) throw new CalculatorInputError(errors);
    const { pulseRate, killipClass, ef, ntProBNP, dDimer, ccuWithin48h } = input;
    const b = COEFFICIENTS;
    const lp = b.intercept + b.pulseRate * pulseRate
      + b.killipII * Number(killipClass === 'II')
      + b.killipIII * Number(killipClass === 'III')
      + b.killipIV * Number(killipClass === 'IV')
      + b.ef * ef + b.lnNTproBNP * Math.log(ntProBNP)
      + b.lnDdimer * Math.log(dDimer) + b.ccuYes * Number(ccuWithin48h);
    if (!Number.isFinite(lp)) throw new RangeError('These inputs exceed the numerical calculation range. Please check the values and units.');
    // Stable sigmoid, with no truncation of inputs, logits or predicted probabilities.
    const expLP = Math.exp(lp < 0 ? lp : -lp);
    const probability = lp < 0 ? expLP / (1 + expLP) : 1 / (1 + expLP);
    if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) {
      throw new RangeError('These inputs produce a probability too close to 0 or 1 to represent reliably. Please check the values and units.');
    }
    const extrapolatedFields = Object.keys(DEVELOPMENT_RANGES).filter(key => {
      const [min, max] = DEVELOPMENT_RANGES[key];
      return input[key] < min || input[key] > max;
    });
    return { linearPredictor: lp, probability, riskGroup: classifyRisk(probability), extrapolatedFields };
  }
  return Object.freeze({ VERSION, COEFFICIENTS, THRESHOLDS, DEVELOPMENT_RANGES,
    FIELD_LABELS, CalculatorInputError, validateInputs, classifyRisk, predictProlongedLOS });
});
