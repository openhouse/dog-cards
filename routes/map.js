require('dotenv').config();
const Promise = require('bluebird');
const express = require('express');
const router = express.Router();

const nano = require('nano')(process.env.DB_HOST);
const couchDb = nano.db.use(process.env.DATABASE);
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

let { log } = console;

const getBreedGroups = require('./helpers/get-breed-groups.js');
const getBreedInfo = require('./helpers/get-breed-info.js');
const wikiProperties = {
  weight: ['weight', 'maleweight', 'femaleweight'],
  height: ['height', 'maleheight', 'femaleheight'],
  lifeSpan: ['life_span'],
};

// const getBreedHeight = require('./helpers/get-breed-height.js');

/* GET users listing. */
router.get('/', function (req, res, next) {
  couchDb.list({ include_docs: true }, function (err, body) {
    let breeds = [];

    body.rows.forEach(function (row) {
      let { doc } = row;
      if (doc.table) {

        let breed = {};
        breed.breed = doc.table.BreedName;
        breed.title = doc.table.Breed;
        breed.text = doc.wtf.text;
        breed.summary = doc.wiki.summary;
        breed.groups = getBreedGroups(doc.wtf, doc.wiki, doc.table);
        breed.weight = getBreedInfo(doc, 'weight', wikiProperties.weight);
        breed.height = getBreedInfo(doc, 'height', wikiProperties.height);
        breed.lifeSpan = getBreedInfo(doc, 'lifeSpan', wikiProperties.lifeSpan);

        // breed.height = getBreedHeight(doc.wtf, doc.wiki, doc.table);

        // log(breed);
        if (
          breed.height.result === false
          || breed.weight.result === false
          || breed.lifeSpan.result === false
        ) {
        }

        breeds.push(breed);

      }
    });

    /*
    if (a.height && b.height) {
      return a.height.debug.joined.length - b.height.debug.joined.length;
    }
    */
    /*
    if (a.lifeSpan && b.lifeSpan) {
      return a.lifeSpan.debug.joined.length - b.lifeSpan.debug.joined.length;
    }
    */
    /*
    breeds.sort(function (a, b) {
      let x = { a: a, b: b };
      let count = {};
      ['a', 'b'].forEach(function (y) {
        count[y] = 0;
        for (let prop in x[y]) {
          // log(x[y][prop]);
          if (x[y][prop]) {
            // log(x[y][prop].result);
            if (x[y][prop].result) {
              count[y]++;
            }
          }
        }
      });

      return count.b - count.a;
    });
    */
    res.render('map', {
      raw: body.rows,
      breeds: breeds,
    });

  });

});

module.exports = router;
