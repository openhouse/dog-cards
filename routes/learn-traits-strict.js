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
const strictTestsDB = nano.db.use(process.env.STRICT_TESTS_DATABASE);
strictTestsDB.update = dbUpdate;
var _ = require('lodash');
const MIN_RELEVANT = 11;
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

function addDocSummaries2Classifiers(docs, testApsects, classifiers) {
  // extend classifiers
  log('Training: adding');
  docs.forEach(function (doc) {
    // join aspects to make test string
    if (doc.dt && doc.dt.hasOwnProperty('summary')) {

      let testTokens = getTestTokens(doc, testApsects);
      if (testTokens.length > 0) {

        for (let trait in doc.dt.summary) {
          let shortTrait = 'SUMMARY_' + sluggify(trait);

          // create a classifier for each trait
          if (!classifiers.hasOwnProperty(shortTrait)) {
            classifiers[shortTrait] = new natural.BayesClassifier();
          }

          if (doc.dt.summary[trait] >= 4) {
            classifiers[shortTrait].addDocument(testTokens, shortTrait);
          } else {
            classifiers[shortTrait].addDocument(testTokens, 'NOT_' + shortTrait);
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
    traits: {},
  };
  docs.forEach(function (doc, index) {
    // the doc has all of the test aspects (filtered earlier)
    let testTokens = doc.testTokens;
    if (testTokens.length > 0) {
      count++;

      // only test docs that have dt info
      if (doc.hasOwnProperty('allTraits')) {
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

        for (let traitSlug in doc.allTraits) {
          matched.possible++;
          if (!matched.traits.hasOwnProperty(traitSlug)) {
            matched.traits[traitSlug] = {
              possible: 0,
              correct: 0,
            };
          }

          matched.traits[traitSlug].possible++;

          if (doc.allTraits[traitSlug] >= 4) {
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

      }
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

function getAspectList(doc) {
  let aspectList = [];
  doc.breedGroups = getBreedGroups(doc.wtf, doc.wiki, doc.table);
  if (doc.breedGroups.hasOwnProperty('groups')) {
    if (doc.breedGroups.groups.length > 0) {
      aspectList.push(sluggify('breedGroups'));
    }
  }

  if (doc.wtf) {
    if (doc.wtf.text) {
      for (let heading in doc.wtf.text) {
        aspectList.push(sluggify(heading));
      }
    }
  }

  return aspectList;
}

function getCmbIds(cmbAspects, aspects) {
  // get the number of unique docs that have a given combination of aspects
  let cmbIds = [];
  cmbAspects.forEach(function (cmbAspect) {
    cmbIds.push(aspects[cmbAspect].ids);
  });

  return _.intersection.apply(_, cmbIds);
}

function getAspects(doc, testAspects) {
  // build and return only the aspects needed for the test
  let docAspects = {};

  testAspects.forEach(function (testAspect) {
    // breed group
    if (testAspect === 'breedgroup') {
      let breedGroups = getBreedGroups(doc.wtf, doc.wiki, doc.table);
      if (breedGroups.hasOwnProperty('groups')) {
        let text = breedGroups.groups.join(' ');
        if (text.length > 0) {
          docAspects.breedgroup = text;
        }
      }
    } else {
      // full article text
      if (testAspect === 'all') {
        if (doc.wiki.content) {
          if (doc.wiki.content.length > 0) {
            docAspects.all = doc.wiki.content;
          }
        }
      } else {
        // wiki text sections
        if (doc.wtf) {
          if (doc.wtf.text) {
            for (let heading in doc.wtf.text) {
              let headingSlug = sluggify(heading);
              if (headingSlug === testAspect) {
                // join the sentences
                let sentences = [];
                doc.wtf.text[heading].forEach(function (block) {
                  sentences.push(block.text);
                });

                docAspects[testAspect] = sentences.join(' ');
              }
            }
          }
        }
      }
    }
  });

  return docAspects;
}

function getAllTraits(doc) {
  let allTraits = {};
  for (let trait in doc.dt.info) {
    let shortTrait = sluggify(trait);
    allTraits[shortTrait] = doc.dt.info[trait];
  }

  for (let trait in doc.dt.summary) {
    let shortTrait = `SUMMARY_${sluggify(trait)}`;
    allTraits[shortTrait] = doc.dt.summary[trait];
  }

  return allTraits;
}

function add2Classifiers(docs, testApsects) {
  let classifiers = {};

  log('Training: adding');
  docs.forEach(function (doc) {
    // join aspects to make test string
    if (doc.allTraits) {
      let testTokens = doc.testTokens;
      if (testTokens.length > 0) {
        for (let traitSlug in doc.allTraits) {

          // create a classifier for each trait
          if (!classifiers.hasOwnProperty(traitSlug)) {
            classifiers[traitSlug] = new natural.BayesClassifier();
          }

          // add to the classifier
          if (doc.allTraits[traitSlug] >= 4) {
            classifiers[traitSlug].addDocument(testTokens, traitSlug);
          } else {
            classifiers[traitSlug].addDocument(testTokens, 'NOT_' + traitSlug);
          }
        }
      }
    }
  });

  return classifiers;
}

function runTest(docs, test) {

  let classifiers = {};
  classifiers = add2Classifiers(docs, test.aspects);

  classifiers = trainClassifiers(classifiers);

  log('Get test results');
  let testResults = getTestResults(docs, test.aspects, classifiers);
  // return true;
  return testResults.matched;
}


/* GET users listing. */
router.get('/', function (req, res, next) {

  // make the page number
  let page = 1;
  let urlParts = url.parse(req.url, true);
  if (urlParts.query.page) {
    page = parseInt(urlParts.query.page);
  }

  if (page < 1) {
    page = 1;
  }

  // get all tests
  let done = true;
  strictTestsDB.list({ include_docs: true }, function (err, body) {
    let tests = [];
    let aspects = {};
    body.rows.forEach(function (row) {
      let { doc } = row;
      if (doc.hasOwnProperty('aspects')) {  // not a design doc
        if (!doc.hasOwnProperty('results')) {  // not already completed
          done = false;
          tests.push(doc);
        }
      }
    });

    tests.sort(function (a, b) {
      if (b.count === a.count) {
        return Math.random() - Math.random();
      }

      return b.count - a.count;
    });

    let test = tests.shift();

    // get test breeds
    dogcardsDB.list({ include_docs: true }, function (err, body) {
      let docs = [];
      body.rows.forEach(function (row) {
        let { doc } = row;
        if (test.breeds.includes(doc._id)) {
          doc.aspects = getAspects(doc, test.aspects);
          doc.allTraits = getAllTraits(doc);
          doc.testTokens = getTestTokens(doc, test.aspects);

          docs.push(doc);
        }
      });

      log('RUNNING TEST: ' + test.id);
      test.results = runTest(docs, test);

      strictTestsDB.update(test, test._id, function (err, body) {
        log('updated: ', test._id);
        if (err) {
          log(err);
        }

        res.render('learn-traits-strict', {
          docs: docs,
          stats: {
          },
          test: test,
          meta: {
            page: page,
            next: 'learn-traits-strict?page=' + (page + 1),
            done: done,
          },
        });

      });

    });

  });

});

module.exports = router;
