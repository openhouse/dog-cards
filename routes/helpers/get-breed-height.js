let hasNumber = require('./has-number.js');
let multiWords = require('./multi-words.js');
let getWeightGroupsFromWikiText = require('./get-weight-groups-from-wiki-text.js');

let { log } = console;

module.exports = function getBreedWeight(wtf, wiki, table) {
  let debug = {
    wtf: {},
    wiki: {},
  };
  let input = {};

  let result = false;

  // get the best from wtf and wiki
  if (wtf.infobox.weight) {
    input.weight = wtf.infobox.weight.text;
    debug.wtf.weight = input.weight;
  }

  if (wtf.infobox.maleweight) {
    input.maleweight = wtf.infobox.maleweight.text;
    debug.wtf.maleweight = input.maleweight;
  }

  if (wtf.infobox.femaleweight) {
    input.femaleweight = wtf.infobox.femaleweight.text;
    debug.wtf.femaleweight = input.femaleweight;
  }

  if (wiki.info) {
    if (!input.weight) {
      input.weight = wiki.info.weight;
    }

    if (!input.maleweight) {
      input.maleweight = wiki.info.maleweight;
    }

    if (!input.femaleweight) {
      input.femaleweight = wiki.info.femaleweight;
    }

    debug.wiki = {
      weight: wiki.info.weight,
      maleweight: wiki.info.maleweight,
      femaleweight: wiki.info.femaleweight,
    };
  }

  // join weights into one string
  let joined = '';
  for (let x in input) {
    if (input[x]) {
      joined += ' ' + input[x];
    }
  }

  joined = joined.trim();

  // should have input
  if (joined.trim().length === 0) {
    result = null;
  } else if (!hasNumber(joined)) {
    // should include numbers
    result = null;
  } else {
    // {{convert|50|-|65|kg|abbr=on}} {{convert|40|-|55|kg|abbr=on}}
    weightGroups = getWeightGroupsFromWikiText(joined);
    debug.weightGroups = weightGroups;

    if (weightGroups !== null) {
      let avgWeights = [];
      result = {
        min: 100000000,
        max: 0,
      };
      weightGroups.forEach(function (group) {

        if (group.length === 1) {
          avgWeights.push(group[0]);
        } else {
          avgWeights.push((group[0] + group[1]) / 2);
        }

        group.forEach(function (item) {
          if (item > result.max) {
            result.max = item;
          }

          if (item < result.min) {
            result.min = item;
          }
        });

      });

      let total = 0;
      for (let i = 0; i < avgWeights.length; i++) {
        total += avgWeights[i];
      }

      result.avg = total / avgWeights.length;

    }
  }
  /*
  ([\d.]+)\s+(lbs?|oz|g|kg)
  */
  debug.joined = joined;
  delete debug.wtf;
  delete debug.wiki;

  return {
    weight: result,
    // input: input,
    debug: debug,
  };
};
