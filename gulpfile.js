let gulp = require('gulp');
let mocha = require('gulp-mocha');

let runSequence = require('run-sequence');

let clear = require('clear');

const { log } = console;

gulp.task('default', function () {
  return runSequence('test');
});

gulp.task('test', function () {
  // start watcher then compile and run tests
  let watcher = gulp.watch(['tests/**/*.js', 'src/**/*', 'gulpfile.js'], ['runTests']);
  return runSequence('runTests');
});

gulp.task('runTests', function () {
  clear();
  delete global._babelPolyfill;
  return gulp.src('tests/**/*.js', { read: false })
    .pipe(mocha({
      reporter: 'spec',
    })).on('error', function (err) {
      // log(err);
    });
});
