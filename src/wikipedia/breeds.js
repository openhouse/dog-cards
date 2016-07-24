/*
'use strict';

require('dotenv').config();
const nano          = require('nano')(process.env.DB_HOST);
*/
const wiki = require('wikijs').default;
const wtfWikipedia = require('wtf_wikipedia');

const { log }     = console;

module.exports.main = function () {
  wtfWikipedia.from_api('List of dog breeds', 'en', function (markup) {
    //...
    let result = wtfWikipedia.parse(markup);
    log(result);
  });

  /*
  let breedsWiki = loadBreedsWiki();
  breedsWiki.then(function (result) {
    log(result);

    result.images().then(function (images) {
      log();

      log(images);
    });
    result.content().then(function (content) {
      log();

      log(content);
    });

  });

  */
  return true;
};
