function tidy(str) {
  // ex non-sporting -> non sporting
  str = str.replace('-', ' ');

  // toy (miniature) -> toy
  str = str.replace(/ *\([^)]*\) */g, ' ').trim();

  // toys -> toy
  let words = str.split(' ');
  words.forEach(function (word, index, theArray) {
    word = word.trim();
    if (word.slice(-1) === 's') {
      word =  word.substring(0, word.length - 1);
    }

    // Non sporting -> Non Sporting
    word = word.charAt(0).toUpperCase() + word.slice(1);
    words[index] = word.trim();
  });

  let result = words.join(' ').trim();

  str = str.toLowerCase().replace(/\b[a-z]/g, function (letter) {
    return letter.toUpperCase();
  });

  result = result.replace('Miscellaneou', 'Misc.');
  result = result.replace('And', '&');

  result = result.replace('breed', '');
  result = result.replace('Breed', '');
  result = result.replace('Group', '');
  result = result.replace('List', '');

  result = result.replace('VII:', '');
  result = result.replace('VI,', '');

  result = result.replace('Dogs', '');
  result = result.replace('Dogg', '');
  result = result.replace('Dog', '');
  result = result.replace('dogg', '');
  result = result.replace('dog', '');
  result = result.replace('Breed', '');

  result = result.replace('AKC FSS', 'FSS');
  result = result.replace('Nonsporting', 'Non Sporting');

  result = result.replace(',', '');
  result = result.replace('}', '');
  if (result.length > 50) {
    result = '';
  }

  result = result.replace('}', '');


  // result = result.replace('Bird', 'Bird Dog');
  result = result.replace('Gun', 'Bird Dog');

  if (result.indexOf('Foundation') !== -1) {
    result = 'FSS';
  }

  return result;
}

module.exports = function scrubGroupName(str) {
  /*
  all lowercase
  strip spaces
  strip trailing "s"s
  strip the word dog
  */

  let result = tidy(str);

  let texts = [];
  if (result.length > 0) {
    texts = [result];
  }

  if (result.indexOf('&') !== -1) {
    texts = result.split('&').reverse();
  }

  if (result.indexOf('/') !== -1) {
    texts = result.split('/');
  }

  texts.forEach(function (text, i) {
    texts[i] =  tidy(text).trim();
  });

  return texts;
};
