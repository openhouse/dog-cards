module.exports = function sluggify(str) {
  /*
  all lowercase
  strip spaces
  strip trailing "s"s
  strip the word dog
  */
  let result = str.toLowerCase().replace(/\s/g, '');

  result = result.replace('dog', '');

  if (result.slice(-1) === 's') {
    result =  result.substring(0, result.length - 1);
  }

  return result;
};
