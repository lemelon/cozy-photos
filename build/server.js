// Generated by CoffeeScript 1.9.1
var americano, start;

americano = require('americano');

process.on('uncaughtException', function(err) {
  console.log(err);
  console.log(err.stack);
  return setTimeout(function() {
    return process.exit(1);
  }, 1000);
});

module.exports.start = start = function(options, cb) {
  options.name = 'cozy-photos';
  if (options.root == null) {
    options.root = __dirname;
  }
  if (options.port == null) {
    options.port = 9119;
  }
  if (options.host == null) {
    options.host = '127.0.0.1';
  }
  return americano.start(options, function(err, app, server) {
    if (err) {
      return cb(err);
    }
    module.exports.app = app;
    return typeof cb === "function" ? cb(null, app, server) : void 0;
  });
};

if (!module.parent) {
  start({
    port: process.env.PORT,
    host: process.env.HOST
  });
}
