require('dotenv').config();
const express = require('express');
const router = express.Router({ mergeParams: true });
const wdk = require('wikidata-sdk');
const rp = require('request-promise');
const { log } = console;
const wtfWikipedia = require('wtf_wikipedia');
const wiki = require('wikijs').default;

const nano = require('nano')(process.env.DB_HOST);
const dogcardsDb = nano.db.use(process.env.DATABASE);
dogcardsDb.update = function (obj, key, callback) {
  let _this = this;
  let db = _this;
  db.get(key, function (error, existing) {
    if (!error) {
      obj._rev = existing._rev;
    }

    db.insert(obj, key, callback);
  });
};

const wprops = {
  P279: 'subclassOf',
  P31: 'instanceOf',
  P373: 'commonsCategory',
  P646: 'freebaseId',
  P18: 'image',
  P935: 'commonsGallery',
};

router.get('/', function (req, res, next) {
  // load this breed
  let page = 0;
  page = parseInt(req.params.page);
  if (!page) {
    page = 0;
  }

  // get breed
  dogcardsDb.list({
    skip: page,
    limit: 1,
    include_docs: true,
  }, function (err, body) {
    if (body.rows.length === 0) {
      res.render('wikidata', {
        meta: {
          done: true,
        },
      });

    } else {

      let breed = body.rows[0].doc;
      // get wikidata
      log(breed.table.Breed);

      let url = wdk.getWikidataIdsFromWikipediaTitles(breed.table.Breed);
      log(url);
      rp(url).then(function (htmlString) {
        let raw = JSON.parse(htmlString);
        for (let qid in raw.entities) {
          let entity = raw.entities[qid];
          if (entity.hasOwnProperty('missing')) {
            /*
            not Found
            TODO: follow redirects
            https://www.wikidata.org/w/api.php?action=wbgetentities&titles=Akbash%20Dog&sites=enwiki&format=json
            https://en.wikipedia.org/w/index.php?title=Akbash_Dog&redirect=no
            */

            res.render('wikidata', {
              meta: {
                next: page + 1,
                missing: true,
              },
            });

          } else {
            log(entity);
            // if (entity.descriptions.en.value === 'dog breed') {
            if (true) {
              // populate wdResults with simplified properties
              let simplifiedClaims = wdk.simplifyClaims(entity.claims);
              let wdResult = {};
              for (let claim in simplifiedClaims) {
                if (wprops.hasOwnProperty(claim)) {
                  wdResult[wprops[claim]] = simplifiedClaims[claim];
                } else {
                  wdResult[claim] = simplifiedClaims[claim];
                }
              }

              // tidy images
              let allImages = [];
              if (wdResult.image) {
                // https://tools.wmflabs.org/magnus-toolserver/commonsapi.php?image=Aidi.jpg
                let image = {
                  file: `File:${wdResult.image}`,
                };
                allImages.push(image);
              }

              let promises = [];
              if (wdResult.commonsGallery) {
                let category = {
                  name: `Category:${encodeURIComponent(wdResult.commonsGallery)}`,
                };
                log(category);
                category.api = `https://commons.wikimedia.org/w/api.php?action=query&list=categorymembers&cmtype=file&cmtitle=${category.name}&format=json`;
                let p = rp(category.api)
                  .then(function (jsonString) {
                    category.result = JSON.parse(jsonString);
                    category.result.query.categorymembers.forEach(function (file) {
                      if (file.title.match(/\.(jpg|jpeg|png|gif)$/)) {
                        // is an image file
                        allImages.push({ file: file.title });
                      }
                    });
                  })
                  .catch(function (err) {
                  });

                promises.push(p);
              }

              Promise.all(promises).then(function () {
                let proms = [];
                allImages.forEach(function (image, ittr) {
                  let url = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(image.file)}&prop=imageinfo&iiprop=url&format=json`;
                  let p = rp(url)
                    .then(function (jsonString) {
                      let info = JSON.parse(jsonString);
                      for (let pageId in info.query.pages) {
                        let cPage = info.query.pages[pageId];
                        image.url = cPage.imageinfo[0].url;
                        allImages[ittr] = image;
                        log(image.url);

                      }
                    })
                    .catch(function (err) {
                    });

                  proms.push(p);
                });

                Promise.all(proms).then(function () {
                  wdResult.allImages = allImages;

                  // add breed wikipedia pages in all languages
                  if (entity.labels) {
                    wdResult.languageWikis = entity.labels;
                  }

                  breed.wikidata = wdResult;
                  dogcardsDb.update(breed, breed.table.Breed, function (err, body) {
                    if (err) {
                      console.log(err);
                    }

                    res.render('wikidata', {
                      result: {
                        wdResult: wdResult,
                      },
                      meta: {
                        next: page + 1,
                      },
                    });

                  });

                });

              });

            }

          }

        }

      }).catch(function (err) {
        // Crawling failed...
      });
    }
  });

});

module.exports = router;
