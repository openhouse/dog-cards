let hasNumber = require('./has-number.js');
let multiWords = require('./multi-words.js');
const conversions = {
  lb: 1,
  kg: 2.20462262185,
  in: 1,
  cm: 0.3937007874,
};
const units = Object.keys(conversions);

module.exports = function (joined) {

  let elements = joined.match(/\{(.*?)\}/g);
  if (elements) {
    let groups = [];
    elements.forEach(function (element) {
      let group = [];
      let tw = [];
      let parts = element.split('|');

      parts.some(function (el) {
        if (hasNumber(el)) {
          tw.push(parseFloat(el));
        } else {

          // find the unit
          let unit = multiWords(el, units);
          if (unit !== null && tw.length > 0) {
            tw.forEach(function (w) {
              group.push(w * conversions[unit]);
            });

            // exit the loop
            return true;
          }
        }
      });

      if (group.length > 0) {
        groups.push(group);
      }
    });

    if (groups.length > 0) {
      return groups;
    }
  }

  return null;
};
