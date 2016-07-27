module.exports = function getNumbersFromString(a) {
  // a = "foo 12.34 bar 56 baz 78.90";
  // console.log(a);
  return a.match(/\d+\.?\d*/g);
};
