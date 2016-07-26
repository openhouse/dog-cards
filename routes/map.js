require('dotenv').config();
const Promise = require('bluebird');
const express = require('express');
const router = express.Router();

const nano = require('nano')(process.env.DB_HOST);
const couchDb = nano.db.use(process.env.DATABASE);
couchDb.update = function (obj, key, callback) {
  let db = this;
  db.get(key, function (error, existing) {
    if (!error) {
      obj._rev = existing._rev;
    }

    db.insert(obj, key, callback);
  });
};

let { log } = console;

const getBreedGroups = require('./helpers/get-breed-groups.js');

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
        // breed.text = doc.wtf.text;
        breed.summary = doc.wiki.summary;
        breed.groups = getBreedGroups(doc.wtf, doc.wiki, doc.table);
        // log(breed);

        breeds.push(breed);

      }
    });

    res.render('map', {
      raw: body.rows,
      breeds: breeds,
    });

  });

});

module.exports = router;
