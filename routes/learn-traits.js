require('dotenv').config();
const express = require('express');
const router = express.Router();
const url = require('url');
const { log } = console;
const getBreedGroups = require('./helpers/get-breed-groups.js');
const natural = require('natural');
const Combinatorics = require('js-combinatorics');
const sluggify = require('./helpers/slugify.js');
const decorateDocWithAspects = require('./helpers/decorate-doc-with-aspects.js');
const getTestTokens = require('./helpers/get-test-tokens.js');
const nano = require('nano')(process.env.DB_HOST);
const dbUpdate = require('./helpers/db-update.js');
const dogcardsDB = nano.db.use(process.env.DATABASE);
dogcardsDB.update = dbUpdate;
const traitTestsDB = nano.db.use(process.env.TRAIT_TESTS_DATABASE);
traitTestsDB.update = dbUpdate;

/*
use machine learning to classify traits
*/

function addDocs2Classifiers(docs, testApsects) {
  let classifiers = {};

  log('Training: adding');
  docs.forEach(function (doc) {
    // join aspects to make test string
    if (doc.dt && doc.dt.hasOwnProperty('info')) {

      let testTokens = getTestTokens(doc, testApsects);
      if (testTokens.length > 0) {

        for (let trait in doc.dt.info) {
          let shortTrait = sluggify(trait);

          // create a classifier for each trait
          if (!classifiers.hasOwnProperty(shortTrait)) {
            classifiers[shortTrait] = new natural.BayesClassifier();
          }

          if (doc.dt.info.hasOwnProperty(trait)) {
            if (doc.dt.info[trait] >= 4) {
              classifiers[shortTrait].addDocument(testTokens, shortTrait);
            } else {
              classifiers[shortTrait].addDocument(testTokens, 'NOT_' + shortTrait);
            }
          }

        }
      }

    }
  });

  return classifiers;
}

function trainClassifiers(classifiers) {
  for (let classifier in classifiers) {
    log('Training: ' + classifier);
    classifiers[classifier].train();
  }

  log('Trained: All');
  return classifiers;
}

function getTestResults(docs, testApsects, classifiers) {
  // get test results by comparing actual to generated traits
  let count = 0;  // possible to generate for with these aspects
  let matched = {
    possible: 0, // traits available to match
    correct: 0, // traits correctly matched of available
    n: 0,       // number of docs eligible to have matches
    traits: {},
  };
  docs.forEach(function (doc, index) {
    // the doc must have at least one of the test aspects
    let testTokens = getTestTokens(doc, testApsects);
    if (testTokens.length > 0) {
      count++;

      // only test docs that have dt info
      if (doc.dt && doc.dt.hasOwnProperty('info')) {
        matched.n++;
        let gen = {};
        for (let classifier in classifiers) {
          let resultRows = classifiers[classifier].getClassifications(testTokens);
          let result = {};
          resultRows.forEach(function (resultRow) {
            result[resultRow.label] = resultRow.value;
          });

          if (result[classifier] > result['NOT_' + classifier]) {
            gen[classifier] = true;
          } else {
            gen[classifier] = false;
          }
        }

        doc.gen = gen;
        for (let traitName in doc.dt.info) {
          matched.possible++;
          let traitSlug = sluggify(traitName);
          if (!matched.traits.hasOwnProperty(traitSlug)) {
            matched.traits[traitSlug] = {
              possible: 0,
              correct: 0,
              n: 0,
            };
          }

          matched.traits[traitSlug].possible++;
          if (doc.dt.info[traitName] >= 4) {
            if (doc.gen[traitSlug] === true) {
              matched.correct++;
              matched.traits[traitSlug].correct++;
            }
          } else {
            if (doc.gen[traitSlug] === false) {
              matched.correct++;
              matched.traits[traitSlug].correct++;
            }
          }
        }

      } // end: only test docs that have dt info
    }
  });

  matched.percent = matched.correct / matched.possible;
  for (let trait in matched.traits) {
    matched.traits[trait].percent = matched.traits[trait].correct / matched.traits[trait].possible;
  }

  return {
    count: count,
    matched: matched,
  };
}

function runTest(docs, testApsects) {
  if (testApsects) {
    let id = testApsects.join('_');
    let classifiers = addDocs2Classifiers(docs, testApsects);
    classifiers = trainClassifiers(classifiers);
    log('Get test results');
    let testResults = getTestResults(docs, testApsects, classifiers);

    return {
      id: id,
      testApsects: testApsects,
      count: testResults.count,
      matched: testResults.matched,
    };
  }
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

  let classifier = new natural.BayesClassifier();
  dogcardsDB.list({ include_docs: true }, function (err, body) {
    let docs = [];
    body.rows.forEach(function (row) {
      let { doc } = row;
      if (doc.table) {
        doc = decorateDocWithAspects(doc);
        docs.push(doc);
      }
    });

    let allAspects = [
      'breedGroups',
      'Intro',
      'Temperament',
      'Appearance',
      'Description',

      // 'Characteristics', // 2
      // 'Personality', // 2
      /*----*/

      // 'Health and temperament',
      // 'As pets',
      // 'Behavior',
      // 'Breed description',
      // 'Character and behavior',
      /*========================*/
      'History',
      'Activities', // 25
      'Health',
      /*----*/

      // 'History and use',
      // 'History of the variety',

    ];

    let slugAspects = [];
    allAspects.forEach(function (aspectName) {
      slugAspects.push(sluggify(aspectName));
    });

    let cmb = Combinatorics.power(slugAspects).toArray();
    log(cmb.length);
    /*
    cmb = [[]];
    slugAspects.forEach(function (slugAspect) {
      cmb.push([slugAspect]);
    });
    */

    cmb.sort(function (a, b) {
      return a.length - b.length;
    });

    // manually add 'all' as an aspect to run the entire text
    cmb[0] = ['all'];
    cmb.unshift([]);
    let pages = cmb.length;

    // use database cache if available
    log(cmb[page]);
    let id = cmb[page].join('_');

    traitTestsDB.get(id, function (error, testResult) {
      if (error) {
        log('RUNNING TEST: ' + id);
        testResult = runTest(docs, cmb[page]);
        testResult.testPage = page;
        log('SAVING RESULTS');
        traitTestsDB.update(testResult, testResult.id, function (err, body) {
          log('updated: ', testResult.id);
          if (err) {
            log(err);
          }
        });

      } else {
        log('USING CACHED');
      }

      res.render('learn-traits', {
        docs: docs,
        stats: {
          // cmb: cmb,
          slugAspects: slugAspects,
        },
        testResult: testResult,
        meta: {
          page: page,
          pages: pages,
          next: 'learn-traits?page=' + (page + 1),
          done: (page === pages),
        },
      });

    });
    /*
    */
  });
});

module.exports = router;
