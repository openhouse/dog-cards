const Promise = require('bluebird');
const wtf = (require('wtf_wikipedia'));
log();
let promise = function (pageName) {
  wtf.from_api(pageName, 'en', function (markup) {
    let wtfResult = wtf.parse(markup);
  });
});
module.exports = promise;
