const Promise = require('bluebird');
const wiki = require('wikijs').default;
let wikiResults = {};

module.exports = function (pageName) {
  // log('hello');
  return wiki().page(pageName).then(function (page) {
    let wikiProms = [];
    wikiResults[pageName] = {};
    for (let propertyName in page) {
      if (typeof page[propertyName] === 'function') {
        let x = page[propertyName]().catch(function () {});

        wikiProms[propertyName] = x;
      } else {
        wikiResults[pageName][propertyName] = page[propertyName];
      }
    }

    return Promise.props(wikiProms);
  }).then(function (all) {
    for (let propertyName in all) {
      wikiResults[pageName][propertyName] = all[propertyName];
    }

    return wikiResults[pageName];
  });
};
