module.exports = function multiWords(a, s) {
  for (let i = 0; i < s.length; i++) {
    if (a.indexOf(s[i]) != -1) {
      return s[i];
    }
  }

  return null;
};
