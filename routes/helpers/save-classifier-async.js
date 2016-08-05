const Promise = require('bluebird');
const { log } =  console;

module.exports = function saveClassifierAsync(classifier, filePath) {
  log('save file');
  return new Promise(function (resolve, reject) {
    classifier.save(filePath, function (err, classifier) {
      if (err) {
        log(err);
        reject(err);
      } else {
        resolve(classifier);
      }
    });
  });
};
