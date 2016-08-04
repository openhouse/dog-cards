/*
TODO: add dt.summary
"summary": {
  "Adaptability": 3,
  "All Around Friendliness": 3,
  "Health Grooming": 2,
  "Trainability": 3,
  "Exercise Needs": 4 <--- delete exercise needs (duplicate with detail)
}
*/

require('dotenv').config();
const Promise = require('bluebird');
const express = require('express');
const router = express.Router();
const wilson = require('wilson-interval');
const url = require('url');
const { log } = console;
const nano = require('nano')(process.env.DB_HOST);
const natural = require('natural');
const path = require('path');
const fs = require('fs');
const sluggify = require('./helpers/slugify.js');
const getBreedGroups = require('./helpers/get-breed-groups.js');
const decorateDocWithAspects = require('./helpers/decorate-doc-with-aspects.js');
const getTestTokens = require('./helpers/get-test-tokens.js');
const saveClassifierAsync = require('./helpers/save-classifier-async.js');

const dbUpdate = require('./helpers/db-update.js');
const dogcardsDB = nano.db.use(process.env.DATABASE);
dogcardsDB.update = dbUpdate;
const traitTestsDB = nano.db.use(process.env.TRAIT_TESTS_DATABASE);
traitTestsDB.update = dbUpdate;

function getTraits(body) {
  let tests = [];
  body.rows.forEach(function (row) {
    let { doc } = row;
    if (doc.hasOwnProperty('matched')) {
      tests.push(doc);
    }
  });

  // populate traits
  let traits = {};
  tests.forEach(function (test) {
    for (let testTrait in test.matched.traits) {
      if (!traits.hasOwnProperty(testTrait)) {
        traits[testTrait] = [];
      }

      let result = {
        confidence: wilson(
          test.matched.traits[testTrait].correct,
          test.matched.traits[testTrait].possible,
          0.95,
          509
        ).low,
        aspects: test.testApsects,
        reach: test.count,
        n: test.matched.traits[testTrait].possible,
        percent: test.matched.traits[testTrait].percent,

      };
      traits[testTrait].push(result);
    }
  });

  // sort by confidence then minimum aspects
  for (let trait in traits) {
    traits[trait].sort(function (a, b) {
      if (b.confidence === a.confidence) {
        if (b.aspects.length === a.aspects.length) {
          return b.reach - a.reach;
        }

        return a.aspects.length - b.aspects.length;
      }

      return b.confidence - a.confidence;
    });
  }

  return traits;
}

function getAvaliableRecipes(traits, avaliableAspects) {
  let availableRecipes = {};
  for (let trait in traits) {
    if (!availableRecipes.hasOwnProperty(trait)) {
      availableRecipes[trait] = [];
    }

    traits[trait].forEach(function (recipe) {
      let found = false;
      recipe.aspects.forEach(function (recipeAspect) {
        if (avaliableAspects.includes(recipeAspect)) {
          found = true;
        }
      });

      if (found) {
        availableRecipes[trait].push(recipe);
      }
    });
  }

  return availableRecipes;
}

function getChosenRecipes(availableRecipes, avaliableAspects) {
  let chosenRecipes = {};
  for (let aspect in availableRecipes) {
    let firstRecipe = null;
    availableRecipes[aspect].forEach(function (recipe) {
      if (firstRecipe === null) {
        recipe.aspectMatches = 0;
        recipe.aspects.forEach(function (recipeAspect) {
          if (avaliableAspects.includes(recipeAspect)) {
            recipe.aspectMatches++;
          }
        });

        firstRecipe = recipe;
      } else {
        if (recipe.confidence === firstRecipe.confidence) {
          if (recipe.confidence) {
            recipe.aspectMatches = 0;
            recipe.aspects.forEach(function (recipeAspect) {
              if (avaliableAspects.includes(recipeAspect)) {
                recipe.aspectMatches++;
              }
            });

            if (recipe.aspectMatches > firstRecipe.aspectMatches) {
              firstRecipe = recipe;
            }
          }
        }
      }
    });

    chosenRecipes[aspect] = firstRecipe;
  }

  return chosenRecipes;
}

function createClassifierAsync(trait, traitRecipe, breeds) {
  // there isn't one saved, so let's train this up
  log('CREATE:');
  log(traitRecipe.id);

  let classifier = new natural.BayesClassifier();
  log('Adding Docs');
  breeds.forEach(function (doc) {
    if (doc.hasOwnProperty('dt')) {
      let docTokens = getTestTokens(doc, traitRecipe.aspects);
      for (let dtTraitName in doc.dt.info) {
        let shortDtTrait = sluggify(dtTraitName);
        if (shortDtTrait === trait) {
          if (doc.dt.info[dtTraitName] >= 4) {
            classifier.addDocument(docTokens, trait);
          } else {
            classifier.addDocument(docTokens, 'NOT_' + trait);
          }
        }
      }
    }
  });

  log('Training');
  classifier.train();
  log('Trained');

  return saveClassifierAsync(classifier, traitRecipe.classifierPath);
}

function loadClassifierAsync(filePath) {
  // log('load file');
  return new Promise(function (resolve, reject) {
    natural.BayesClassifier.load(filePath, null, function (err, classifier) {
      if (err) {
        log(err);
        reject(err);
      } else {
        resolve(classifier);
      }
    });
  });
}

/* GET users listing. */
router.get('/', function (req, res, next) {
  let page = 1;
  let urlParts = url.parse(req.url, true);
  if (urlParts.query.page) {
    page = parseInt(urlParts.query.page);
  }

  if (page < 1) {
    page = 1;
  }

  // get all test results
  traitTestsDB.list({ include_docs: true }, function (err, body) {
    // get trait recipes from test results
    let traits = getTraits(body);

    dogcardsDB.list({ include_docs: true }, function (err, body) {
      let breeds = [];
      body.rows.forEach(function (row) {
        let { doc } = row;
        if (doc.hasOwnProperty('table')) {
          doc = decorateDocWithAspects(doc);
          breeds.push(doc);
        }
      });

      let pages = breeds.length;

      // get the page's breed
      let breed = breeds[page - 1];

      let avaliableAspects = [];
      for (let aspect in breed.aspects) {
        avaliableAspects.push(aspect);
      }

      if (avaliableAspects.length === 0) {

        // no avaliable aspects, nothing we can do
        res.render('gen-traits', {
          meta: {
            page: page,
            pages: pages,
            next: 'gen-traits?page=' + (page + 1),
            done: (page === pages),
          },
        });

      } else {

        // filter trait recipes by available breed aspects
        let availableRecipes = getAvaliableRecipes(traits, avaliableAspects);

        // choose a recipes per trait from available recipes
        let chosenRecipes = getChosenRecipes(availableRecipes, avaliableAspects);

        // train a classifier for each trait according to recipe
        let loadPromises = {};
        for (trait in chosenRecipes) {
          chosenRecipes[trait].id = `${trait}_${chosenRecipes[trait].aspects.join('_')}`;
          chosenRecipes[trait].classifierPath = path.resolve(
            `./classifiers/${chosenRecipes[trait].id}.json`
            );

          try {
            fs.accessSync(chosenRecipes[trait].classifierPath, fs.F_OK);

            // load classifier from file
            loadPromises[trait] = loadClassifierAsync(chosenRecipes[trait].classifierPath);
          } catch (e) {

            // create and train new classifier
            loadPromises[trait] = createClassifierAsync(trait, chosenRecipes[trait], breeds);
          }
        }

        Promise.props(loadPromises).then(function (loadedClassifiers) {
          log('loadedClassifiers');
          breed.genTraits = {};
          breed.genTraits.info = {};
          for (let trait in loadedClassifiers) {

            let classifier = loadedClassifiers[trait];
            let tokens = getTestTokens(breed, chosenRecipes[trait].aspects);
            let resultRows = classifier.getClassifications(tokens);
            let result = {};
            resultRows.forEach(function (resultRow) {
              result[resultRow.label] = resultRow.value;
            });

            if (result[trait] > result['NOT_' + trait]) {
              breed.genTraits.info[trait] = true;
            } else {
              breed.genTraits.info[trait] = false;
            }
          }

          delete breed.aspects;

          // save breed
          dogcardsDB.update(breed, breed._id, function (err, body) {
            if (err) {
              log(err);
            }
          });

          log(avaliableAspects);

          res.render('gen-traits', {
            debug: {
              breed: breed,
              traits: traits,
              chosenRecipes: chosenRecipes,
            },
            meta: {
              page: page,
              pages: pages,
              next: 'gen-traits?page=' + (page + 1),
              done: (page === pages),
            },
          });
        });

      }

    });
  });

});

module.exports = router;
