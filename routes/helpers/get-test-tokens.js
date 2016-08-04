const natural = require('natural');

module.exports = function getTestTokens(doc, testApsects) {
  let testTokens = [];
  let testStringParts = [];
  if (doc.aspects) {
    testApsects.forEach(function (testAspect) {
      if (doc.aspects.hasOwnProperty(testAspect)) {
        testStringParts.push(doc.aspects[testAspect]);
      }
    });
  }

  let testString = testStringParts.join(' ').trim();
  if (testString.length > 0) {
    testTokens = natural.PorterStemmer.tokenizeAndStem(testString);
  }

  return testTokens;
};
