let gulp = require('gulp');
let mocha = require('gulp-mocha');
let runSequence = require('run-sequence');
let clear = require('clear');
var gls = require('gulp-live-server');

// let livereload = require('gulp-livereload');
var app;

const { log } = console;

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

gulp.task('serve', function () {
  var server = gls.new('bin/www');
  server.start();

  gulp.watch(['views/**/*', 'public/**/*'], function (args) {
    server.notify.apply(server, [args]);
  });

  gulp.watch(['bin/www', 'app.js', 'routes/**/*'], function (args) {
    server.start.apply(server).progress(function (progress) {
      log('started');
      log(progress);
      server.notify.apply(server, [args]);
    });

    setTimeout(function () {
      console.log('woo!');
      server.notify.apply(server, [args]);
    }, 2000);
  });

});


// gulp.task('default', ['express', 'watch'], function () {
// });
//
// gulp.task('express', function () {
//   app = require('./bin/www');
// });
//
// gulp.task('watch', function () {
//   livereload.listen();
//   gulp.watch('./**/*')
//   .on('change', function (file) {
//     gulp
//       .src(file.path)
//       .pipe(livereload());
//   });
// });
//
