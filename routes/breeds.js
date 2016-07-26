const Promise = require('bluebird');
const express = require('express');
const router = express.Router();
const rp = require('request-promise');
const wtf = (require('wtf_wikipedia'));
const fromApi = Promise.promisify(wtf.from_api);
const cheerio = require('cheerio');
const scraper = require('table-scraper');
const tabletojson = require('tabletojson');
const wiki = require('wikijs').default;

const { log } = console;
/* GET home page. */
router.get(['/', '/*'], function (req, res, next) {
  log(req.path.split('/')[1]);
  let pageName = decodeURIComponent(req.path.split('/')[1]);

  let scraper = require('table-scraper');

  // scrape the wikipedia HTML TABLE of dog breeds
  // works but doesn't get images
  /*
  wtf.from_api('List of dog breeds', 'en', function (markup) {
    // res.send(markup);
    let result = wtf.parse(markup);

    scraper.get('https://en.wikipedia.org/wiki/List_of_dog_breeds')
      .then(function (tables) {
        let rows = tables[0];
        // Process html like you would with jQuery...
        res.render('index', {
          rows: rows,
          wtf: result,
          json: JSON.stringify(result, null, 2),
        });
      });
  });
  */

  /*
  let pageName = 'List of dog breeds';
  let pageName = 'Japanese Spitz';
  let pageName = 'Fila Brasileiro';
  let pageName = 'Affenpinscher';

  */

  function bestImage(wtf, wikiJS) {
    /*
    bestImage
    the infobox image
    */
    if (wtf.infobox.image) {
      let name = wtf.infobox.image.text;
      let images = wtf.images;
      for (let i = 0, len = images.length; i < len; i++) {
        if (name === images[i].file || 'File:'  + name === images[i].file) {
          return images[i];
        }
      }
    }

    return null;
  }

  function hasNumber(myString) {
    return (
      /\d/.test(
        myString));
  }

  function compareGroups(a, b) {
    if (!a.isUKC && b.isUKC) {
      return 1;
    }

    if (a.isUKC && !b.isUKC) {
      return -1;
    }

    if (a.count < b.count) {
      return 1;
    }

    if (a.count > b.count) {
      return -1;
    }

    if (a.text.length > b.text.length) {
      return 1;
    } else {
      return -1;
    }

  }

  function sluggify(str) {
    let result = str.toLowerCase().replace(/\s/g, '');
    if (result.slice(-1) === 's') {
      result =  result.substring(0, result.length - 1);
    }

    return result;
  }

  function getGroups(wtf, wikiJS) {
    let groups = {};
    for (let key in wtf.infobox) {
      let value = wtf.infobox[key];
      if (key.endsWith('group')) {
        if (!hasNumber(value.text)) {
          let slug = sluggify(value.text);

          if (!groups.hasOwnProperty(slug)) {
            groups[slug] = {
              text: value.text,
              count: 1,
              isUKC: false,
              slug: slug,
            };
          }

          if (key === 'ukcgroup') {
            groups[slug].isUKC = true;
          }

          groups[slug].count++;
        }
      }
    }

    let toSort = new Array();
    for (let key in groups) {
      toSort.push(groups[key]);
    }

    return toSort.sort(compareGroups);
    /*
    ukcgroup
    nzkcgroup
    kcukgroup
    akcgroup
    */

  }

  wtf.from_api(pageName, 'en', function (markup) {
    // res.send(markup);
    let wtfResult = wtf.parse(markup);
    wiki().page(pageName).then(function (page) {
      let wikiProms = [];
      let wikiResults = {};
      for (let propertyName in page) {
        if (typeof page[propertyName] === 'function') {
          let x = page[propertyName]().catch(function (e) {
          });

          wikiProms[propertyName] = x;
        } else {
          wikiResults[propertyName] = page[propertyName];
        }
      }

      Promise.props(wikiProms).then(function (all) {
        for (let propertyName in all) {
          wikiResults[propertyName] = all[propertyName];
        }

        res.render('breeds', {
          wikiJS: wikiResults,
          wikiJSON: JSON.stringify(wikiResults, null, 2),
          wtf: wtfResult,
          wtfJSON: JSON.stringify(wtfResult, null, 2),
          bestImage: bestImage(wtfResult, wikiResults),
          groups: getGroups(wtfResult, wikiResults),
        });
      });
    });

  });

});

module.exports = router;
