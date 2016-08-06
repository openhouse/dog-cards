let hasNumber = require('./has-number.js');
let multiWords = require('./multi-words.js');
let getInfoGroupsFromWikiText = require('./get-info-groups-from-wiki-text.js');
let getNumbersFromString = require('./get-numbers-from-string.js');

let { log } = console;

module.exports = function getBreedInfo(doc, type, wikiProperties) {
  let { wtf, wiki, table } = doc;
  let debug = {
    wtf: {},
    wiki: {},
    intl: {},
  };
  let input = {};
  let result = false;

  // get the best from wtf and wiki
  debug.wiki = {};
  wikiProperties.forEach(function (x) {
    if (wtf.infobox[x]) {
      input[x] = wtf.infobox[x].text;
      debug.wtf[x] = input[x];
    }

    if (wiki.info) {
      if (!input[x]) {
        input[x] = wiki.info[x];
      }

      debug.wiki[x] = wiki.info[x];
    }

    if (doc.hasOwnProperty('intlInfoboxes')) {
      let tmpArr = [];
      doc.intlInfoboxes.forEach(function (intlInfobox) {
        if (intlInfobox.hasOwnProperty(x)) {
          if (intlInfobox[x].text.length > 0) {
            tmpArr.push(intlInfobox[x].text);
          }
        }
      });

      if (tmpArr.length > 0) {
        input[x] += ' ' + tmpArr.join(' ');
        input[x] = input[x].trim();
        debug.intl[x] = tmpArr.join(' ');
      }

    }

  });

  // join input properties into one string
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

    // lifeSpan
    if (type === 'lifeSpan') {
      let beforeWikiTags = joined.replace('{{ndash}}', '-');
      beforeWikiTags = beforeWikiTags.split('{')[0];
      let numbers = getNumbersFromString(beforeWikiTags);

      let group = [];
      if (numbers) {
        numbers.forEach(function (number) {
          if (group.length < 2) {
            group.push(parseFloat(number));
          }
        });
      }

      if (group.length > 0) {
        groups = [group];
      }
    } else {
      // {{convert|50|-|65|kg|abbr=on}} {{convert|40|-|55|kg|abbr=on}}
      groups = getInfoGroupsFromWikiText(joined);
    }

    debug.groups = groups;

    if (groups !== null) {
      let avgs = [];
      result = {
        min: 10000000000,
        max: -10000000000,
      };
      groups.forEach(function (group) {

        if (group.length === 1) {
          avgs.push(group[0]);
        } else {
          avgs.push((group[0] + group[1]) / 2);
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
      for (let i = 0; i < avgs.length; i++) {
        total += avgs[i];
      }

      result.avg = total / avgs.length;

    }
  }
  /*
  ([\d.]+)\s+(lbs?|oz|g|kg)
  */
  debug.joined = joined;
  delete debug.wtf;
  delete debug.wiki;
  delete debug.intl;

  return {
    result: result,
    input: input,
    debug: debug,
  };
};
