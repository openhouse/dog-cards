const cheerio = require('cheerio');
const wiki = require('wikijs').default;
const { log } = console;
const Promise = require('bluebird');

let pageName = 'List of dog breeds';

let promise = wiki().page(pageName).then(function (page) {
  return page.html();
}).then(function (html) {
  let $ = cheerio.load(html);
  let table =  $('.wikitable');
  let headings = [];
  $('.wikitable tr.sortbottom th').each(function (i, elem) {
    let txt = $(this).text();
    headings[i] = txt.replace(/(\r\n|\n|\r)/gm, '');
  });

  let rows = [];
  $n = 0;
  $('.wikitable tr').each(function (i, elem) {
    let row = {};
    if ($n !== 0) { // skip the first row
      $(this).children().each(function (j, td) {
        let isImage = false;
        if ($(this).find('img').length > 0) {
          let imgObj = {};
          let image = $(this).find('img').first();
          imgObj.alt = image.prop('alt');
          imgObj.src = image.prop('src');
          imgObj.srcset = image.prop('srcset');
          imgObj.width = image.prop('data-file-width');
          imgObj.height = image.prop('data-file-height');

          // make url for original size
          let urlParts = imgObj.src.split('/');
          urlParts.pop();
          let treated = [];
          urlParts.forEach(function (element, index, array) {
            if (element !== 'thumb') {
              treated.push(element);
            }
          });

          imgObj.url = 'https:' + treated.join('/');
          imgObj.file = 'File:' + imgObj.alt;
          row[headings[j]] = imgObj;
        } else {
          if ((headings[j] === 'Breed') && $(this).text().trim() !== 'Breed') {
            row[headings[j]] = $(this).find('a').first().prop('title').trim();
            row['BreedName'] = $(this).text().trim();

          } else {
            row[headings[j]] = $(this).text().trim();
          }
        }
      });

      rows.push(row);
    }

    $n++;
  });

  log('done rows!');
  return rows;
});

module.exports = promise;
