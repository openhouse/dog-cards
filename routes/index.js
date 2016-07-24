const express = require('express');
const router = express.Router();
var rp = require('request-promise');
const wtfWikipedia = require('wtf_wikipedia');
var cheerio = require('cheerio');
var scraper = require('table-scraper');
var tabletojson = require('tabletojson');

const { log } = console;
/* GET home page. */
router.get('/', function (req, res, next) {
  var scraper = require('table-scraper');

  // scrape the wikipedia table of dog breeds
  scraper.get('https://en.wikipedia.org/wiki/List_of_dog_breeds')
    .then(function (tables) {
      let rows = tables[0];

      // Process html like you would with jQuery...
      res.render('index', {
        rows: rows,
      });
    });


  /*
  var options = {
      uri: 'https://en.wikipedia.org/wiki/List_of_dog_breeds',
      transform: function (body) {
          return cheerio.load(body);
        },
    };

  rp(options)
    .then(function ($) {
      let wikiHTML = $('.wikitable').html();
      let tables = tabletojson.convert(wikiHTML);
      log(tables);

      // Process html like you would with jQuery...
      res.send(tables);
    })
    .catch(function (err) {
      // Crawling failed or Cheerio choked...
    });
    */

  /*


  wtfWikipedia.from_api('List of dog breeds', 'en', function (markup) {
    // res.send(markup);
    let result = wtfWikipedia.parse(markup);
    log(result);
    res.render('index', {
      result: result,
      json: JSON.stringify(result),
    });

    // res.send(JSON.stringify(result));
    res.send('hi');
  });
  */
});

module.exports = router;
