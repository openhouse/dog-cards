require('dotenv').config();

const express = require('express');
const router = express.Router();
const rp = require('request-promise');
const cheerio = require('cheerio');
const nano = require('nano')(process.env.DB_HOST);
const bluebird = require('bluebird');
const url = require('url');
const getNumbersFromString = require('./helpers/get-numbers-from-string.js');

let dogtimeDb = nano.db.use(process.env.DOGTIME_DATABASE);
dogtimeDb.update = function (obj, key, callback) {
  let db = this;
  db.get(key, function (error, existing) {
    if (!error) {
      obj._rev = existing._rev;
    }

    db.insert(obj, key, callback);
  });
};

const { log } = console;

function getDogtimeList() {
  let options = {
    uri: process.env.DOGTIME_URL,
    transform: function (body) {
      return cheerio.load(body);
    },
  };
  let breeds = [];
  return rp(options).then(function ($) {
    // get the breed name and url
    $('a.post-title').each(function (i, elem) {
      let breed = {};
      breed.name = $(this).text();
      breed.url = $(this).prop('href');
      if (breed.name && breed.url) {
        breeds.push(breed);
      }
    });

    breeds.forEach(function (breed) {
      dogtimeDb.update(breed, breed.name, function (err, body) {
        if (err) {
          log(err);
        }
      });
    });

    return breeds;
  }).catch(function (err) {
    // Crawling failed or Cheerio choked...
    return err;
  });
}

function getDogtimeInfo(breed) {
  let options = {
    uri: breed.url,
    transform: function (body) {
      return cheerio.load(body);
    },
  };
  breed.info = {};
  breed.summary = {};

  return rp(options).then(function ($) {
    // get the breed name and url

    $('.child-characteristic').each(function (i, elem) {
      let property = {};
      property.name = $(this).find('.characteristic').first().text();
      property.stars = $(this).find('.star-block').first().text();
      if (property.name) {
        breed.info[property.name] = parseInt(property.stars);
      }
    });

    $('.parent-characteristic').each(function (i, elem) {
      let property = {};
      property.name = $(this).find('.characteristic').first().text().trim();
      property.stars = getNumbersFromString($(this).find('.star').first().prop('class'))[0];
      if (property.name) {
        breed.summary[property.name] = parseInt(property.stars);
      }
    });

    dogtimeDb.update(breed, breed.name, function (err, body) {
      if (err) {
        log(err);
      }
    });

    return breed;
  }).catch(function (err) {
    // Crawling failed or Cheerio choked...
    return err;
  });
}

router.get('/', function (req, res, next) {
  log('start');
  dogtimeDb.list({ include_docs: true }, function (err, body) {
    let breeds = [];
    body.rows.forEach(function (row) {
      breeds.push(row.doc);
    });

    if (breeds.length === 0) {
      // get and cache dogtime breeds
      log('downloaded');
      breeds = getDogtimeList();
    } else {
      breeds = new Promise(function (resolve) {
        log('cached');
        resolve(breeds);
      });
    }

    breeds.then(function (breeds) {
      // get page query param
      let page = 0;
      let urlParts = url.parse(req.url, true);
      if (urlParts.query.page) {
        page = parseInt(urlParts.query.page);
      }

      log(page);
      let breed = breeds[page];
      log(breed.url);

      getDogtimeInfo(breed).then(function (info) {
        breeds[page] = breed;
        res.render('dogtime', {
          breeds: breeds,
          info: breed,
          meta: {
            page: page,
            pages: breeds.length,
            next: 'dogtime?page=' + (page + 1),
            done: page >= breeds.length - 2,
          },
        });
      });

    });
  });
});

module.exports = router;
