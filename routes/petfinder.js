require('dotenv').config();

let express = require('express');
let router = express.Router();
let petfinder = require('petfinder-promise')(
  process.env.PETFINDER_KEY,
  process.env.PETFINDER_SECRET);

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

const lunr = require('lunr');

let { log } = console;

/* GET users listing. */
router.get('/', function (req, res, next) {
  // lunr index Wiki Breeds
  let idx = lunr(function () {
    this.field('breed');
    this.field('title');
  });

  // lunr index Petfinder breeds
  let pidx = lunr(function () {
    this.field('id');
    this.field('name');

  });


  // Get a list of dog breeds
  petfinder.breed.list('dog').then(function (pBreeds) {
      // log(pBreeds);
      pBreeds.forEach(function (name) {
        pidx.add({
          id: name,
          name: name,
        });
      });

      pBreeds = pBreeds.map(function (x) {
        return { name: x };
      });

      couchDb.list({ include_docs: true }, function (err, body) {
        let wBreeds = [];
        let n = 0;
        body.rows.forEach(function (row) {
          let { doc } = row;
          if (doc.table) {
            let breed = {};
            breed.breed = doc.table.BreedName;
            breed.title = doc.table.Breed;
            breed.id = n;
            wBreeds.push(breed);
            idx.add(breed);
            n++;
          }
        });

        // annotate breeds with matches where Wiki contains Petfinder
        pBreeds.forEach(function (pBreed) {
          pBreed.matches = idx.search(pBreed.name);
          pBreed.matches.forEach(function (match, index) {
            xMatch = JSON.parse(JSON.stringify(match));
            xMatch.pBreed = pBreed.name;

            match.doc = wBreeds[match.ref];
            pBreed.matches[index] = match;

            if (!wBreeds[match.ref].matches) {
              wBreeds[match.ref].matches = [];
            }

            wBreeds[match.ref].matches.push(xMatch);
          });
        });
        /*

        */

        // annotate breeds with matches where Petfinder contains Wiki
        wBreeds.forEach(function (wBreed, index) {

          let matches = pidx.search(wBreed.breed);
          if (!wBreeds[index].matches) {
            wBreeds[index].matches = [];
          }

          matches.forEach(function (match) {
            log(match);
            match.pBreed = match.ref;
            wBreeds[index].matches.push(match);
          });

          wBreed.matches.sort(function (a, b) {
            return b.score - a.score;
          });

          if (wBreed.matches.length > 0) {
            wBreed.petfinder = {};
            wBreed.petfinder.breed = wBreed.matches[0].pBreed;
            wBreed.petfinder.score = wBreed.matches[0].score;
          }

          delete wBreed.matches;
        });

        res.render('petfinder', {
          pBreeds: pBreeds,
          wBreeds: wBreeds,
        });

      });

    }).catch(function (err) {
      log('Error: ' + err.message);
    });

});

module.exports = router;
