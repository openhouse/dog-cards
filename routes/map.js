require('dotenv').config();
const Promise = require('bluebird');
const express = require('express');
const router = express.Router();
const url = require('url');
const slug = require('slug');
const Hypher = require('hypher');
const english = require('hyphenation.en-us');
const h = new Hypher(english);
const natural = require('natural');

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

const heartDogsDb = nano.db.use(process.env.HEARTDOGS_DATABASE);
heartDogsDb.update = function (obj, key, callback) {
  let _this = this;
  let db = _this;
  db.get(key, function (error, existing) {
    if (!error) {
      obj._rev = existing._rev;
      obj.prefs = existing.prefs;
    }

    db.insert(obj, key, callback);
  });
};

heartDogsDb.updateAsync = function (obj, key, callback) {
  let _this = this;
  let db = _this;
  return new Promise(function (resolve, reject) {
    db.get(key, function (error, existing) {
      if (!error) {
        obj._rev = existing._rev;
        obj.prefs = existing.prefs;
      }

      db.insert(obj, key, function (err, body) {
        if (err) {
          reject(err);
        } else {
          resolve(body);
        }
      });
    });
  });
};

function ajaxGetAsync(url) {
  return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest;
      xhr.addEventListener('error', reject);
      xhr.addEventListener('load', resolve);
      xhr.open('GET', url);
      xhr.send(null);
    });
}

let { log } = console;

const getBreedGroups = require('./helpers/get-breed-groups.js');
const getBreedInfo = require('./helpers/get-breed-info.js');
const decorateBreedsWithPercentiles = require('./helpers/decorate-breeds-with-percentiles.js');
const wikiProperties = {
  weight: ['weight', 'maleweight', 'femaleweight'],
  height: ['height', 'maleheight', 'femaleheight'],
  lifeSpan: ['life_span'],
};

// const getBreedHeight = require('./helpers/get-breed-height.js');

/*
  TODO: use wikidata to find breed wikis in many languages to extract infobox data
  http://wdq.wmflabs.org/api?q=CLAIM[31:39367]
  https://www.wikidata.org/wiki/Q39367
*/

function getBreedImages(doc) {
  let used = [];
  let result = {};
  result.images = [];

  // add the table image
  if (doc.table.Image) {
    result.front = doc.table.Image.url;
    used.push(doc.table.Image.file);

    result.images.push({
      url: doc.table.Image.url,
      file: doc.table.Image.file,
    });

  }

  let images = [];
  if (doc.wtf.images) {
    images = doc.wtf.images;
  }

  // add the infobox image
  let infobox = doc.wtf.infobox;
  if (infobox) {
    if (infobox.image) {
      let imageFile = `File:${infobox.image.text}`;
      images.forEach(function (image) {
        if (!used.includes(image.file)) {
          if (imageFile === image.file) {
            if (result.front) {
              result.back = image.url;
            } else {
              result.front = image.url;
            }

            result.images.push({
              url: image.url,
              file: image.file,
            });

          }
        }
      });
    }
  }

  // add the rest of the images
  if (images) {
    images.forEach(function (image) {
      if (!used.includes(image.file)) {
        if (!result.front) {
          result.front = image.url;
        } else if (!result.back) {
          result.back = image.url;
        }

        result.images.push({
          url: image.url,
          file: image.file,
        });
      }
    });
  }

  if (doc.wikidata) {
    if (doc.wikidata.allImages) {
      // log(doc.wikidata.allImages);
      doc.wikidata.allImages.forEach(function (wImage) {
        let found = false;

        result.images.forEach(function (rImage, ittr) {
          if (wImage.file === rImage.file) {
            result.images[ittr] = wImage;
            found = true;
          }
        });

        if (!found) {
          result.images.push(wImage);

        }

      });

    }
  }

  /*
  'wiki'
    "images": [
        "https://upload.wikimedia.org/wikipedia/commons/e/e0/Caribou_from_Wagon_Trails.jpg",
        "https://upload.wikimedia.org/wikipedia/en/b/ba/Flag_of_Germany.svg",
        "https://upload.wikimedia.org/wikipedia/en/4/4a/Commons-logo.svg",
        "https://upload.wikimedia.org/wikipedia/commons/1/17/Affenpinscher.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/d/d8/Affenpinscher_circa_1915.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/d/da/Aussie-blacktri.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/b/b2/Borismindre.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/8/8d/Jjmarch10.jpeg"
      ],
  */
  return result;
}

/* GET users listing. */
router.get('/', function (req, res, next) {
  let page = 0;
  let urlParts = url.parse(req.url, true);
  if (urlParts.query.page) {
    page = parseInt(urlParts.query.page);
  }

  couchDb.list({ include_docs: true }, function (err, body) {
    let breeds = [];
    let docs = [];
    body.rows.forEach(function (row) {
      let { doc } = row;
      docs.push(doc);
    });

    // classifyTraits(docs);
    docs.forEach(function (doc) {
      if (doc.table) {

        let breed = {};
        breed.prefs = {}; // user preferences preserved by heartDogsDb.update
        breed.breed = doc.table.BreedName.replace('[10]', '');
        breed.title = doc.table.Breed;
        breed.id = slug(breed.title);
        breed.summary = doc.wiki.summary;
        breed.groups = getBreedGroups(doc.wtf, doc.wiki, doc.table);

        breed.weight = getBreedInfo(doc, 'weight', wikiProperties.weight);
        breed.height = getBreedInfo(doc, 'height', wikiProperties.height);
        breed.lifeSpan = getBreedInfo(doc, 'lifeSpan', wikiProperties.lifeSpan);

        breed.images = getBreedImages(doc);
        breed.text = doc.wtf.text;
        breed.genTraits = doc.genTraits;

        if (breed.text) {
          breed.hyphenated = {};
          for (let section in breed.text) {
            let sentences = [];
            breed.text[section].forEach(function (raw) {
              sentences.push({
                text: h.hyphenateText(raw.text),
              });
            });

            breed.hyphenated[section] = sentences;
          }
        }

        if (doc.dt) {
          breed.dt = {};
          breed.dt.info = {};
          breed.dt.summary = {};
          for (let x in doc.dt.info) {
            let short = x.replace(/ /g, '');
            breed.dt.info[short] = doc.dt.info[x];
          }

          for (let x in doc.dt.summary) {
            let short = x.replace(/ /g, '');
            breed.dt.summary[short] = doc.dt.summary[x];
          }
        }

        breeds.push(breed);
        /*
        if (
          breed.height.result === false
          || breed.weight.result === false
          || breed.lifeSpan.result === false
        ) {
        }
        */

      }
    });

    breeds = decorateBreedsWithPercentiles(breeds);

    // https://upload.wikimedia.org/wikipedia/en/f/fc/Bullenbeisser.jpg
    //   https://upload.wikimedia.org/wikipedia/commons/f/fc/Bullenbeisser.jpg
    // save to heartDogsDb
    Promise.reduce(breeds, function (total, breed) {
      return heartDogsDb.updateAsync(breed, breed.id)
        .then(function (item) {
          log('success', item.id);
          return total++;
        }).catch(function (reason) {
          // rejection
          log('problem', reason);
        });
    }, 0).then(function (total) {
      log('promises done!', total);
    });
    /*
*/

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
      breed: [breeds[page]],
      stats: {
        //  class: classifier.getClassifications(breeds[0].wiki.content),
      },
      meta: {
        pages: breeds.length,
        page: page,
        next: 'map?page=' + (page + 1),
        prev: 'map?page=' + (page - 1),
      },
    });

  });

});

module.exports = router;
