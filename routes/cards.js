const express = require('express');
const router = express.Router({ mergeParams: true });
const url = require('url');
const { log } = console;

const nano = require('nano')(process.env.DB_HOST);
const heartDogsDb = nano.db.use(process.env.HEARTDOGS_DATABASE);
heartDogsDb.updateAsync = function (obj, key, callback) {
  let _this = this;
  let db = _this;
  return new Promise(function (resolve, reject) {
    db.get(key, function (error, existing) {
      if (!error) {
        obj._rev = existing._rev;
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

/* GET users listing. */
router.get('/', function (req, res, next) {
  let page = 0;
  page = parseInt(req.params.page);
  let urlParts = url.parse(req.url, true);
  if (!page) {
    page = 0;
  }

  heartDogsDb.list({
    skip: page,
    limit: 1,
    include_docs: true,
  }, function (err, body) {
    let breed = body.rows[0].doc;
    let images = [];

    if (breed.images.images) {
      images =  breed.images.images;
    }

    // pictures from prefs
    if (!breed.prefs.images) {
      breed.prefs.images = {};
    }

    // set FRONT via query
    let isDirty = false;
    if (urlParts.query.front) {
      let setFront = decodeURIComponent(urlParts.query.front).trim();
      images.forEach(function (image) {
        if (image.file === setFront) {
          breed.prefs.images.front = image.url;
          breed.prefs.fpos = 'center-center';
          isDirty = true;
        }
      });
    }

    // set BACK via query
    if (urlParts.query.back) {
      let setBack = decodeURIComponent(urlParts.query.back).trim();
      images.forEach(function (image) {
        if (image.file === setBack) {
          breed.prefs.images.back = image.url;
          breed.prefs.bpos = 'center-center';
          isDirty = true;
        }
      });
    }


    // set rotate via query
    if (urlParts.query.rotate) {
      if (!breed.prefs.rotate) {
        breed.prefs.rotate = true;
      } else {
        breed.prefs.rotate = false;
      }

      isDirty = true;
    }


    // set image positioning via query
    if (urlParts.query.fpos) {
      breed.prefs.fpos = urlParts.query.fpos;
      isDirty = true;
    } else {
      if (!breed.prefs.fpos) {
        breed.prefs.fpos = 'center-center';
      }
    }

    if (urlParts.query.bpos) {
      breed.prefs.bpos = urlParts.query.bpos;
      isDirty = true;
    } else {
      if (!breed.prefs.bpos) {
        breed.prefs.bpos = 'center-center';
      }
    }

    // save changed prefs
    log('isDirty', isDirty);
    if (isDirty) {
      log('about to update');
      heartDogsDb.updateAsync(breed, breed.id)
        .then(function (item) {
          log('success');
        }).catch(function (reason) {
          // rejection
          log('problem', reason);
        });
    }

    // fill in with defaults for blank front or back
    if (!breed.prefs.images.front) {
      if (images[0]) {
        breed.prefs.images.front = images[0].url;
      }

      if (!breed.prefs.images.back) {
        if (images[1]) {
          breed.prefs.images.back = images[1].url;
        }
      }
    }

    if (!breed.prefs.images.back) {
      if (images[1]) {
        breed.prefs.images.back = images[1].url;
      } else if (images[0]) {
        breed.prefs.images.back = images[0].url;
      }
    }

    res.render('cards', {
      raw: body,
      breed: [breed],
      meta: {
        page: page,
        next: (page + 1),
        prev: (page - 1),
      },
    });

  });
});

module.exports = router;
