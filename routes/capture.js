require('dotenv').config();
const express = require('express');
const router = express.Router();
const wikiBreedsTable = require('../views/helpers/wikiBreedsTable.js');

/// const getBreedWiki = require('../views/helpers/get-breed-wiki.js');
const Promise = require('bluebird');
const wiki = require('wikijs').default;
const wtf = (require('wtf_wikipedia'));
const nano = require('nano')(process.env.DB_HOST);
const url = require('url');

let couchDb = nano.db.use(process.env.DATABASE);
couchDb.update = function (obj, key, callback) {
  let _this = this;
  let db = _this;

  db.get(key, function (error, existing) {
    if (!error) {
      obj._rev = existing._rev;
    }

    db.insert(obj, key, callback);
  });
};

const { log } = console;

/*
get The List of Dog Breeds
then use wikijs and wtf_wikipedia to get more info
*/
router.get(['/', '/*'], function (req, res, next) {
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
        resolve(wtfResult);
      });
    });
  }

  let page = 0;
  var urlParts = url.parse(req.url, true);
  if (urlParts.query.page) {
    page = parseInt(urlParts.query.page);
  }

  log(page);

  wikiBreedsTable.then(function (wikiTable) {
    // remove the last row which cont the column names
    // wikiTable.pop();

    var promises = {};
    var wtfPromises = {};
    if (page < (wikiTable.length - 2)) {
      for (k = page; k < (page + 1); k++) {

        var breedName = wikiTable[k].Breed;

        // log(wikiTable[k]);
        log(breedName);
        breeds[breedName] = {};
        breeds[breedName].table = wikiTable[k];
        wtfPromises[breedName] = wtfHelper(breedName);
        promises[breedName] = getBreedWiki(breedName);
      }
    }

    Promise.props(wtfPromises).then(function (all) {
      // log('all');
      for (let propertyName in all) {
        breeds[propertyName].wtf = all[propertyName];
      }

      Promise.props(promises).then(function (all) {
        let dogname = '';

        // log('all');
        for (let propertyName in all) {
          dogname = propertyName;
          breeds[propertyName].wiki = all[propertyName];
          couchDb.update(breeds[propertyName], propertyName, function (err, body) {
            if (err) {
              console.log(err);
            }
          });
        }

        res.render('capture', {
          data: breeds[dogname],
          wikiTableJSON: JSON.stringify(breeds, null, 2),
          meta: {
            page: page,
            next: 'http://localhost:3000/capture?page=' + (page + 1),
          },
        });

      });

    });

  });
});

module.exports = router;
