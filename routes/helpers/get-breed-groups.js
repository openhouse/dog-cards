const sluggify = require('./slugify.js');
const hasNumber = require('./has-number.js');
const scrubGroupName = require('./scrub-group-name.js');

function compareGroups(a, b) {
  if (!a.isUKC && b.isUKC) {
    return 1;
  }

  if (a.isUKC && !b.isUKC) {
    return -1;
  }

  if (a.count < b.count) {
    return 1;
  }

  if (a.count > b.count) {
    return -1;
  }

  if (a.text === 'Pariah') {
    return 1;
  }

  if (b.text === 'Pariah') {
    return -1;
  }

  if (a.text.length > b.text.length) {
    return 1;
  } else {
    return -1;
  }

}

module.exports = function getGroups(wtf, wikiJS, table) {
  let groups = {};
  for (let key in wtf.infobox) {
    let value = wtf.infobox[key];
    if (key.endsWith('group')) {
      if (!hasNumber(value.text)) {
        // scrubGroupName returns an array of group names
        let texts = scrubGroupName(value.text);
        texts.forEach(function (text) {
          let slug = sluggify(text);
          if (!groups.hasOwnProperty(slug)) {
            groups[slug] = {
              text: text,
              count: 1,
              isUKC: false,
              slug: slug,
            };
          }

          if (key === 'ukcgroup') {
            groups[slug].isUKC = true;
          }

          groups[slug].count++;

        });
      }
    }
  }

  let toSort = new Array();
  for (let key in groups) {
    toSort.push(groups[key]);
  }

  let sorted = toSort.sort(compareGroups);
  let result = {};
  result.groups = [];
  sorted.forEach(function (item) {
    result.groups.push(item.text);
  });

  result.text = result.groups.join(', ');
  let extinct = false;
  for (let propertyName in table) {
    let cell = table[propertyName];
    if (typeof cell === 'string') {
      if (cell.toLowerCase().indexOf('extinct') !== -1) {
        return {
          groups: ['Extinct'],
          text: 'Extinct',
        };
      }
    }
  }

  return result;
};
