'use strict';
// const app  = require('../../dist/app.js');
const wikiBreeds  = require('../../src/wikipedia/breeds.js');
const { assert }  = require('chai');
const {
  typeOf,
  isOk,
}  = assert;
const { log }     = console;

/*
Wikipedia Breeds should
[x] export a module
[x] load all the breeds from the wikipedia list of dog Breeds
- for each breed should
  [ ] extract height range
  [ ] extract weight range
  [ ] extract life span range

  [ ] save table row as a doc in CouchDB
  [ ] save the image from the table locally
  [ ] load the Breed's Wikipedia article
      [ ] save all images locally
      [ ] save intro as its own field
      [ ] save the wiki-text for full-text-search indexing
*/

describe('Wikipedia Breeds', function () {
  it('should export a module', function (done) {
    typeOf(wikiBreeds, 'object');
    done();
  });

  it('should load all the breeds from the wikipedia list of dog Breeds', function (done) {
    wikiBreeds.loadBreedsWiki().then(function (result) {
      typeOf(result, 'object');
      done();
    });
  });

  it('should run wikiBreeds.main', function (done) {
    isOk(wikiBreeds.main());
    done();
  });

});
