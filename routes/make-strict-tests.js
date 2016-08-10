require('dotenv').config();
const Promise = require('bluebird');
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
strictTestsDB.updateAsync = function (obj, key, callback) {
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

var _ = require('lodash');
const MIN_RELEVANT = 10;
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

function getTestResults(docs, testApsects, classifiers, summariesOnly) {
  // get test results by comparing actual to generated traits
  let count = 0;  // possible to generate for with these aspects
  let matched = {
    possible: 0, // traits available to match
    correct: 0, // traits correctly matched of available
    n: 0,       // number of docs eligible to have matches
    traits: {},
    summaries: {},
  };
  docs.forEach(function (doc, index) {
    // the doc must have at least one of the test aspects
    let testTokens = getTestTokens(doc, testApsects);
    if (testTokens.length > 0) {
      count++;

      // only test docs that have dt info
      if (doc.dt && (doc.dt.hasOwnProperty('info') || doc.dt.hasOwnProperty('summary'))) {
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
        if (!summariesOnly) {
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
        }

        for (let traitName in doc.dt.summary) {
          matched.possible++;
          let traitSlug = 'SUMMARY_' + sluggify(traitName);
          if (!matched.summaries.hasOwnProperty(traitSlug)) {
            matched.summaries[traitSlug] = {
              possible: 0,
              correct: 0,
              n: 0,
            };
          }

          matched.summaries[traitSlug].possible++;
          if (doc.dt.summary[traitName] >= 4) {
            if (doc.gen[traitSlug] === true) {
              matched.correct++;
              matched.summaries[traitSlug].correct++;
            }
          } else {
            if (doc.gen[traitSlug] === false) {
              matched.correct++;
              matched.summaries[traitSlug].correct++;
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

  for (let trait in matched.summaries) {
    matched.summaries[trait].percent = matched.summaries[trait].correct / matched.summaries[trait].possible;
  }

  return {
    count: count,
    matched: matched,
  };
}

function runTest(docs, testApsects, summariesOnly) {
  if (testApsects) {
    let id = testApsects.join('_');
    let classifiers = {};
    if (!summariesOnly) {
      classifiers = addDocs2Classifiers(docs, testApsects);
    }

    classifiers = addDocSummaries2Classifiers(docs, testApsects, classifiers);

    classifiers = trainClassifiers(classifiers);
    log('Get test results');
    let testResults = getTestResults(docs, testApsects, classifiers, summariesOnly);

    return {
      id: id,
      testApsects: testApsects,
      count: testResults.count,
      matched: testResults.matched,
    };
  }
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

  // get all the dog cards
  dogcardsDB.list({ include_docs: true }, function (err, body) {
    let docs = [];
    let aspects = {};
    body.rows.forEach(function (row) {
      let { doc } = row;
      if (doc.table) {
        if (doc.hasOwnProperty('dt')) {
          if (doc.dt.hasOwnProperty('info')) {
            doc.aspectList = getAspectList(doc);
            if (doc.aspectList.length > 0) {
              docs.push(doc);
            }
          }
        }
        // doc = decorateDocWithAspects(doc);
      }
    });

    docs.forEach(function (doc) {
      doc.aspectList.forEach(function (aspect) {
        if (!aspects.hasOwnProperty(aspect)) {
          aspects[aspect] = {
            ids: [],
          };
        }

        aspects[aspect].ids.push(doc._id);
      });
    });

    let aspectsList = [];
    for (let aspect in aspects) {
      if (aspects[aspect].ids.length < MIN_RELEVANT) {
        delete aspects[aspect];
      } else {
        aspectsList.push(aspect);
      }
    }

    // set up 'all' aspect
    aspects.all = {
      ids: [],
    };

    docs.forEach(function (doc) {
      if (doc.wiki.content) {
        if (doc.wiki.content.length > 0) {
          aspects.all.ids.push(doc._id);
        }
      }
    });

    let cmb = Combinatorics.power(aspectsList).toArray();
    cmb[0] = ['all'];
    let cmbObjects = [];
    cmb.forEach(function (cmbAspects) {
      let cmbObject = {
        aspects: cmbAspects,
        breeds: getCmbIds(cmbAspects, aspects),
      };
      cmbObject.count = cmbObject.breeds.length;
      cmbObject.id = cmbObject.aspects.sort().join('_');

      if (cmbObject.count >= MIN_RELEVANT) {
        cmbObjects.push(cmbObject);
      }
    });
    /*
    cmbObjects.sort(function (a, b) {
      return b.count - a.count;
    });

    res.render('make-strict-tests', {
      docs: docs,
      aspects: aspects,
      cmb: cmb,
      cmbObjects: cmbObjects,
    });
    */
    delete docs;
    delete aspects;
    delete cmb;
    Promise.reduce(cmbObjects, function (total, cmbObject) {
      return strictTestsDB.updateAsync(cmbObject, cmbObject.id)
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
    let allAspects = [
      'breedGroups', //         5516 | 0  |
      'Intro', //               4571 | 0  | 215
      'Appearance', //          4799 | -1 | 155
      'Temperament', //         3375 | -1 | 179
      'Description', //         5265 | +1 | 39
      'History', //              431 | -3 | 173
      'Coat', // coat           3455 | +3 | 29
      'Health', //               676 | -5 | 140
      'Care', // care           3366 | 0  | 21
      'Activities', // *25      2944 | -2 | 25
      'Size', // size           2381 | +9 | 28
      'Exercise', // exercise   1328 | +1 | 10
      'Coat and color', //      1190 | +8 | 13 coatandcolor
      'Grooming', // grooming    930 | +3 | 24
      'Lifespan', // lifespan    649 | +2 | 13
      'Color', // color          490 | -5 | 11
      'Hunting', // hunting      308 | -3 | 10
      'Origins', // origin       193 | -1 | 10
      'Training', // training     92 | -7 | 10

      /*
      'breedGroups', //         5516 | 0  |
      'Description', //         5265 | +1 | 39
      'Care', // care           3366 | 0  | 21
      'Coat', // coat           3455 | +3 | 29
      'Activities', // *25      2944 | -2 | 25
      'Exercise', // exercise   1328 | +1 | 10
      'Size', // size           2381 | +9 | 28
      'Coat and color', //      1190 | +8 | 13 coatandcolor
      'Hunting', // hunting      308 | -3 | 10
      'Origins', // origin       193 | -1 | 10
      'Training', // training     92 | -7 | 10
      'Color', // color          490 | -5 | 11
      'Lifespan', // lifespan    649 | +2 | 13
      'Appearance', //          4799 | -1 | 155
      'Grooming', // grooming    930 | +3 | 24
      'Intro', //               4571 | 0  | 215
      'Temperament', //         3375 | -1 | 179
      'Health', //               676 | -5 | 140
      'History', //              431 | -3 | 173
      */

    // 'breedGroups', //         5516 | 0  |
    // 'Description', //         5265 | +1 | 39
    // 'Appearance', //          4799 | -1 | 155
    // 'Intro', //               4571 | 0  | 215
    // 'Coat', // coat           3455 | +3 | 29
    // 'Temperament', //         3375 | -1 | 179
    // 'Care', // care           3366 | 0  | 21
    // 'Activities', // *25      2944 | -2 | 25
    // 'Size', // size           2381 | +9 | 28
    // 'Exercise', // exercise   1328 | +1 | 10
    // 'Coat and color', //      1190 | +8 | 13 coatandcolor
    // 'Grooming', // grooming    930 | +3 | 24
    // 'Health', //               676 | -5 | 140
    // 'Lifespan', // lifespan    649 | +2 | 13
    // 'Color', // color          490 | -5 | 11
    // 'History', //              431 | -3 | 173
    // 'Hunting', // hunting      308 | -3 | 10
    // 'Origins', // origin       193 | -1 | 10
    // 'Training', // training     92 | -7 | 10

    /*
    1 'breedGroups', //         5689
    2 'Appearance', //          5013
    3 'Description', //         4717
    4 'Intro', //               4202
    5 'Temperament', //         3287
    6 'Activities', // *25      2621
    7 'Care', // care           1685
    8 'Coat', // coat           1362
    9 'Health', //              717
    10'Color', // color         641
    11'Exercise', // exercise   631
    12'Training', // training   556
    13'History', //             479
    14'Hunting', // hunting     360
    15'Grooming', // grooming   284
    16'Lifespan', // lifespan   271
    17'Origins', // origin      205
    18'Size', // size           143
    19'Coat and color', // coatandcolor 45
    */
    // ];

    // let slugAspects = [];
    // allAspects.forEach(function (aspectName) {
    //   slugAspects.push(sluggify(aspectName));
    // });

    // let cmb = Combinatorics.power(slugAspects).toArray();
    // log(cmb.length);
    /*
    cmb = [[]];
    slugAspects.forEach(function (slugAspect) {
      cmb.push([slugAspect]);
    });
    */
    /*
    // sort combinations starting with a smaller number of aspects
    cmb.sort(function (a, b) {
      return a.length - b.length;
    });
    */

    // manually add 'all'
    // No need to combine with other aspects, it's the whole text

    /*
    cmb[0] = ['all'];
    cmb.unshift([]);

    let pages = cmb.length;

    // use database cache if available
    log(cmb[page]);
    let id = cmb[page].join('_');
    */

    // look for the test in the db by matching the aspects in any order
    //
    //    traitTestsDB.list({ include_docs: true }, function (err, body) {
    //      let allTests = [];
    //      body.rows.forEach(function (row) {
    //        let { doc } = row;
    //        if (doc.matched) { // filter out design docs
    //          allTests.push(doc);
    //        }
    //      });
    //
    //      let testResult = null;
    //      let error = false;
    //      allTests.forEach(function (test) {
    //        let cmbObj = {};
    //        cmb[page].forEach(function (cmbAspect) {
    //          cmbObj[cmbAspect] = false;
    //        });
    //
    //        // log(test.testApsects);
    //        test.testApsects.forEach(function (testAspect) {
    //          if (cmbObj.hasOwnProperty(testAspect)) {
    //            cmbObj[testAspect] = true;
    //          }
    //        });
    //
    //        let found = true;
    //        for (let cmbAspect in cmbObj) {
    //          if (!cmbObj[cmbAspect]) {
    //            found = false;
    //          }
    //        }
    //
    //        if (found && (test.testApsects.length === cmb[page].length)) {
    //          log('matching test found');
    //          log(cmb[page]);
    //          log(test.testApsects);
    //          log('------------');
    //
    //          testResult = test;
    //        }
    //
    //      });
    //
    //      if (testResult === null) {
    //        error = 'test does not exist in db';
    //      }
    //
    //      // log(testResult);
    //      //});
    //
    //      // traitTestsDB.get(id, function (error, testResult) {
    //      /*
    //       ok, i messed up and didn't include the dt summaries at first
    //       so now i'm coming back and running over the data to patch in summaries
    //       that's what this summariesOnly mode is about.
    //       but going forward it should get both dt.info and dt.summary
    //     */
    //      if (error || !testResult.matched.hasOwnProperty('summaries')) {
    //        log('error:', error);
    //        let summariesOnly = false;
    //        let origTestResult = testResult;
    //        if (!error) {
    //          summariesOnly = true;
    //        }
    //
    //        log('RUNNING TEST: ' + id);
    //        testResult = runTest(docs, cmb[page], summariesOnly);
    //        testResult.testPage = page;
    //
    //        if (summariesOnly) {
    //          origTestResult.matched.summaries = testResult.matched.summaries;
    //          testResult = origTestResult;
    //        }
    //
    //        log('SAVING RESULTS');
    //        traitTestsDB.update(testResult, testResult.id, function (err, body) {
    //          log('updated: ', testResult.id);
    //          if (err) {
    //            log(err);
    //          }
    //        });
    //        /*
    //
    //        */
    //      } else {
    //        // previous test
    //        log('USING CACHED');
    //      }
    //
    //      res.render('learn-traits', {
    //        docs: docs,
    //        stats: {
    //          // cmb: cmb,
    //          slugAspects: slugAspects,
    //        },
    //        testResult: testResult,
    //        cmb: cmb,
    //
    //        meta: {
    //          page: page,
    //          pages: pages,
    //          next: 'learn-traits?page=' + (page + 1),
    //          done: (page === pages),
    //        },
    //      });
    //
    //    });
    //    /*
    //    */
  });
});

module.exports = router;
