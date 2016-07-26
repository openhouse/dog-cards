require('dotenv').config();
const wikiBreedsTable = require('../views/helpers/wikiBreedsTable.js');
/// const getBreedWiki = require('../views/helpers/get-breed-wiki.js');
const Promise = require('bluebird');
const wiki = require('wikijs').default;
const wtf = (require('wtf_wikipedia'));
const nano = require('nano')(process.env.DB_HOST);
let couchDb = nano.db.use(process.env.DATABASE);
couchDb.update = function (obj, key, callback) {
  let db = this;
  db.get(key, function (error, existing) {
    if (!error) {
      obj._rev = existing._rev;
    }

    db.insert(obj, key, callback);
  });
};

const { log } = console;
let breeds = {};
let wikiResults = {};

/*
get the breed wiki via wikijs
*/
function getBreedWiki(pageName) {
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

function wtfHelper(pageName) {
  return new Promise(function (resolve, reject) {
    wtf.from_api(pageName, 'en', function (markup) {
      let wtfResult = wtf.parse(markup);
      // log('wtfResult');
      // log(wtfResult);
      log(pageName + ' wtf');

      resolve(wtfResult);
    });
  });
}

/*
get The List of Dog Breeds
then use wikijs and wtf_wikipedia to get more info
*/
// log('router');
wikiBreedsTable.then(function (wikiTable) {
  // log('wikiBreedsTable');
  var promises = {};
  var wtfPromises = {};
  /*
  for (k = 0; k < wikiTable.length; k++) {
    let breedName = wikiTable[k].Breed;
    db.get(breedName, function (error, existing) {
      // find the next to add
      if (!error) {
        obj._rev = existing._rev;
      }
    });
  }
  */

  // for (k = 0; k < wikiTable.length; k++) {
  // log(wikiTable.length);
  for (k = 0; k < 75; k++) {
    let breedName = wikiTable[k].Breed;

    breeds[breedName] = {};
    breeds[breedName].table = wikiTable[k];
    wtfPromises[breedName] = wtfHelper(breedName);
    promises[breedName] = getBreedWiki(breedName);
  }

  Promise.props(wtfPromises).then(function (all) {
    // log('all');
    for (let propertyName in all) {
      breeds[propertyName].wtf = all[propertyName];
    }

    Promise.props(promises).then(function (all) {
      // log('all');
      for (let propertyName in all) {
        breeds[propertyName].wiki = all[propertyName];
        couchDb.update(breeds[propertyName], propertyName, function (err, body) {
          if (err) {
            console.log(err);
          }
        });
      }

      log('ALL DONE');
    });

  });

});
