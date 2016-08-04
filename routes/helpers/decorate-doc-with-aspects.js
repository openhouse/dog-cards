const sluggify = require('./slugify.js');
const getBreedGroups = require('./get-breed-groups.js');

module.exports = function decorateDocWithAspects(doc) {
  doc.breedGroups = getBreedGroups(doc.wtf, doc.wiki, doc.table);

  doc.aspects = {};
  if (doc.breedGroups.groups) {
    let text = doc.breedGroups.groups.join(' ');
    if (text.length > 0) {
      doc.aspects[sluggify('breedGroups')] = text;
    }
  }

  if (doc.wiki.content) {
    if (doc.wiki.content.length > 0) {
      doc.aspects[sluggify('all')] = doc.wiki.content;
    }
  }

  let wikiAspects = [
    'Intro',
    'Temperament',
    'Appearance',
    'Health and temperament',
    'Description',
    'As pets',
    'Behavior',
    'Breed description',
    'Character and behavior',
    'Characteristics',
    'Personality',
    /*----*/
    'History',
    'History and use',
    'Activities',
    'Health',
    'History of the variety',
  ];

  if (doc.wtf) {
    if (doc.wtf.text) {
      for (let heading in doc.wtf.text) {
        let headingSlug = sluggify(heading);
        wikiAspects.forEach(function (aspectName) {
          let aspectSlug = sluggify(aspectName);
          if (headingSlug === aspectSlug) {
            // join the sentences
            let sentences = [];
            doc.wtf.text[heading].forEach(function (block) {
              sentences.push(block.text);
            });

            doc.aspects[aspectSlug] = sentences.join(' ');
          }
        });
      }
    }
  }

  return doc;
};
