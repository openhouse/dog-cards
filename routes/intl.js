const express = require('express');
const router = express.Router();
const Promise = require('bluebird');
const wiki = require('wikijs').default;
const wtf = (require('wtf_wikipedia'));
const nano = require('nano')(process.env.DB_HOST);
const dbUpdate = require('./helpers/db-update.js');
const dogcardsDB = nano.db.use(process.env.DATABASE);
dogcardsDB.update = dbUpdate;
const url = require('url');
const { log } = console;

function wtfHelper(pageName, lang) {
  return new Promise(function (resolve, reject) {
    try {
      wtf.from_api(encodeURIComponent(pageName), lang, function (markup) {
        let wtfResult = wtf.parse(markup);
        resolve(wtfResult);
      });
    }
    catch (e) {
      // statements to handle any exceptions
      log(e);
      reject(e);
    }
  });
}

/* GET users listing. */
router.get('/', function (req, res, next) {
  let page = 0;
  let urlParts = url.parse(req.url, true);
  if (urlParts.query.page) {
    page = parseInt(urlParts.query.page);
  }

  if (page < 0) {
    page = 0;
  }

  dogcardsDB.list({ include_docs: true }, function (err, body) {
    let breeds = [];
    body.rows.forEach(function (row) {
      let { doc } = row;
      if (doc.wikidata) { // not design doc
        if (doc.wikidata.hasOwnProperty('sitelinks')) {
          breeds.push(doc);
        }
      }
    });

    let breed = breeds[page];
    let sitelinks = breed.wikidata.sitelinks;
    let wtfPromises = {};
    for (let siteCode in sitelinks) {
      let lang = siteCode.replace('wiki', '');
      let title = sitelinks[siteCode].title;
      wtfPromises[lang] = wtfHelper(title, lang);
    }

    Promise.props(wtfPromises).then(function (all) {
      let wikiResults = [];
      for (let propertyName in all) {
        wikiResults.push(all[propertyName]);
      }

      let infoboxes = [];
      wikiResults.forEach(function (wikiResult) {
        if (Object.keys(wikiResult.infobox).length > 0) {
          let infoBoxProps = [
            'weight',
            'maleweight',
            'femaleweight',
            'height',
            'maleheight',
            'femaleheight',
            'life_span',
          ];

          let found = false;
          infoBoxProps.forEach(function (infoBoxProps) {
            if (wikiResult.infobox.hasOwnProperty(infoBoxProps)) {
              found = true;
            }
          });

          if (found) {
            infoboxes.push(wikiResult.infobox);
          }
        }
      });

      breed.intlInfoboxes = infoboxes;
      dogcardsDB.update(breed, breed._id, function (err, body) {
        if (err) {
          console.log(err);
        }

        res.render('intl', {
          breed: breed,
          wikiResults: infoboxes,
          meta: {
            page: page,
            pages: breeds.length,
            done: (page >= breeds.length - 1),
            next: `intl?page=${page + 1}`,
          },
        });

      });

    });

  });

});

module.exports = router;
