let hasNumber = require('./has-number.js');
let multiWords = require('./multi-words.js');
const wUnits = ['lb', 'kg'];
const conversions = {
  lb: 1,
  kg: 2.20462,
};

module.exports = function (joined) {

  let elements = joined.match(/\{.*?\}/g);
  if (elements) {
    let weightGroups = [];
    elements.forEach(function (element) {
      let weights = [];
      let tw = [];
      let parts = element.split('|');

      parts.some(function (el) {
        if (hasNumber(el)) {
          tw.push(parseFloat(el));
        } else {

          // find the unit
          let unit = multiWords(el, wUnits);
          if (unit !== null && tw.length > 0) {
            tw.forEach(function (w) {
              weights.push(w * conversions[unit]);
            });
            // exit the loop
            return true;
          }
        }
      });

      if (weights.length > 0) {
        weightGroups.push(weights);
      }
    });

    if (weightGroups.length > 0) {
      return weightGroups;
    }
  }

  return null;
};
