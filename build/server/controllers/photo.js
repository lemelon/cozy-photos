// Generated by CoffeeScript 1.9.2
var NotAllowed, NotFound, Photo, app, async, doPipe, downloader, fs, multiparty, os, path, photoHelpers, qs, ref1, sharing, thumbHelpers;

async = require('async');

fs = require('fs');

qs = require('qs');

multiparty = require('multiparty');

path = require('path');

os = require('os');

Photo = require('../models/photo');

thumbHelpers = require('../helpers/thumb');

photoHelpers = require('../helpers/photo');

sharing = require('./sharing');

downloader = require('../helpers/downloader');

ref1 = require('../helpers/errors'), NotFound = ref1.NotFound, NotAllowed = ref1.NotAllowed;

app = null;

module.exports.setApp = function(ref) {
  return app = ref;
};

module.exports.fetch = function(req, res, next, id) {
  if (id.indexOf('.jpg') > 0) {
    id = id.substring(0, id.length - 4);
  }
  return Photo.find(id, (function(_this) {
    return function(err, photo) {
      if (err) {
        return next(err);
      } else if (!photo) {
        return next(NotFound("Photo " + id));
      } else {
        req.photo = photo;
        return next();
      }
    };
  })(this));
};

module.exports.create = (function(_this) {
  return function(req, res, next) {
    var cid, cleanup, files, form, isAllowed, lastPercent;
    cid = null;
    lastPercent = 0;
    files = {};
    isAllowed = !req["public"];
    cleanup = function() {
      return async.each(req.files, function(file, cb) {
        return fs.unlink(file.path, function(err) {
          if (err) {
            console.log('Could not delete %s', file.path);
          }
          return cb(null);
        });
      }, function() {});
    };
    form = new multiparty.Form({
      uploadDir: path.join(os.tmpdir(), 'uploads'),
      defer: true,
      keepExtensions: true,
      maxFieldsSize: 10 * 1024 * 1024
    });
    form.parse(req);
    form.on('field', function(name, value) {
      var albumid;
      req.body[name] = value;
      if (name === 'cid') {
        return cid = value;
      } else if (name === 'albumid' && req["public"]) {
        albumid = value;
        return sharing.checkPermissionsPhoto({
          albumid: albumid
        }, 'w', req, function(err, ok) {
          return isAllowed = ok;
        });
      }
    });
    form.on('file', function(name, val) {
      val.name = val.originalFilename;
      val.type = val.headers['content-type'] || null;
      return files[name] = val;
    });
    form.on('progress', function(bytesReceived, bytesExpected) {
      var percent;
      if (cid == null) {
        return;
      }
      percent = bytesReceived / bytesExpected;
      if (!(percent - lastPercent > 0.05)) {
        return;
      }
      lastPercent = percent;
      return app.io.sockets.emit('uploadprogress', {
        cid: cid,
        p: percent
      });
    });
    form.on('error', function(err) {
      if (err.message !== "Request aborted") {
        return next(err);
      }
    });
    return form.on('close', function() {
      var raw;
      req.files = qs.parse(files);
      raw = req.files['raw'];
      if (!isAllowed) {
        cleanup();
        return next(NotAllowed());
      }
      return thumbHelpers.readMetadata(raw.path, function(err, metadata) {
        var orientation, photo, ref2, ref3;
        if (err != null) {
          console.log("[Create photo - Exif metadata extraction]");
          console.log("Are you sure imagemagick is installed ?");
          next(err);
        } else {
          req.body.orientation = 1;
          if ((metadata != null ? (ref2 = metadata.exif) != null ? ref2.orientation : void 0 : void 0) != null) {
            orientation = metadata.exif.orientation;
            req.body.orientation = photoHelpers.getOrientation(orientation);
          }
          if ((metadata != null ? (ref3 = metadata.exif) != null ? ref3.dateTime : void 0 : void 0) != null) {
            req.body.date = metadata.exif.dateTime;
          }
        }
        photo = new Photo(req.body);
        return Photo.create(photo, function(err, photo) {
          if (err) {
            return next(err);
          }
          return async.series([
            function(cb) {
              var data;
              raw = req.files['raw'];
              data = {
                name: 'raw',
                type: raw.type
              };
              return photo.attachBinary(raw.path, data, cb);
            }, function(cb) {
              var data, screen;
              screen = req.files['screen'];
              data = {
                name: 'screen',
                type: screen.type
              };
              return photo.attachBinary(screen.path, data, cb);
            }, function(cb) {
              var data, thumb;
              thumb = req.files['thumb'];
              data = {
                name: 'thumb',
                type: thumb.type
              };
              return photo.attachBinary(thumb.path, data, cb);
            }
          ], function(err) {
            cleanup();
            if (err) {
              return next(err);
            } else {
              return res.status(201).send(photo);
            }
          });
        });
      });
    });
  };
})(this);

doPipe = function(req, which, download, res, next) {
  return sharing.checkPermissionsPhoto(req.photo, 'r', req, function(err, isAllowed) {
    var binaryPath, disposition, onError, ref2, ref3, request;
    if (err || !isAllowed) {
      return next(NotAllowed());
    }
    if (download) {
      disposition = 'attachment; filename=' + req.photo.title;
      res.setHeader('Content-disposition', disposition);
    }
    onError = function(err) {
      if (err) {
        return next(err);
      }
    };
    if ((ref2 = req.photo._attachments) != null ? ref2[which] : void 0) {
      binaryPath = "/data/" + req.photo.id + "/attachments/" + which;
      return request = downloader.download(binaryPath, function(stream) {
        if (stream.statusCode === 200) {
          res.on('close', function() {
            return request.abort();
          });
          return stream.pipe(res);
        } else {
          return res.sendfile('./server/img/error.gif');
        }
      });
    } else if ((ref3 = req.photo.binary) != null ? ref3[which] : void 0) {
      binaryPath = "/data/" + req.photo.id + "/binaries/" + which;
      return request = downloader.download(binaryPath, function(stream) {
        if (stream.statusCode === 200) {
          res.on('close', function() {
            return request.abort();
          });
          return stream.pipe(res);
        } else {
          return res.sendfile('./server/img/error.gif');
        }
      });
    } else {
      return res.sendfile('./server/img/error.gif');
    }
  });
};

module.exports.screen = function(req, res, next) {
  var ref2, ref3, which;
  which = ((ref2 = req.photo._attachments) != null ? ref2.screen : void 0) ? 'screen' : ((ref3 = req.photo.binary) != null ? ref3.screen : void 0) ? 'screen' : 'raw';
  return doPipe(req, which, false, res, next);
};

module.exports.thumb = function(req, res, next) {
  return doPipe(req, 'thumb', false, res, next);
};

module.exports.raw = function(req, res, next) {
  var ref2, ref3, ref4, which;
  which = ((ref2 = req.photo._attachments) != null ? ref2.raw : void 0) ? 'raw' : ((ref3 = req.photo.binary) != null ? ref3.raw : void 0) ? 'raw' : ((ref4 = req.photo.binary) != null ? ref4.file : void 0) ? 'file' : 'file';
  return doPipe(req, which, true, res, next);
};

module.exports.update = function(req, res, next) {
  return req.photo.updateAttributes(req.body, function(err) {
    if (err) {
      return next(err);
    }
    return res.send(req.photo);
  });
};

module.exports["delete"] = function(req, res, next) {
  return req.photo.destroyWithBinary(function(err) {
    if (err) {
      return next(err);
    }
    return res.send({
      success: "Deletion succeded."
    });
  });
};

module.exports.updateThumb = function(req, res, next) {
  var files, form;
  files = {};
  form = new multiparty.Form({
    uploadDir: __dirname + '../../uploads',
    defer: true,
    keepExtensions: true,
    maxFieldsSize: 10 * 1024 * 1024
  });
  form.parse(req);
  form.on('file', function(name, val) {
    val.name = val.originalFilename;
    val.type = val.headers['content-type'] || null;
    return files[name] = val;
  });
  form.on('error', function(err) {
    return next(err);
  });
  return form.on('close', function() {
    var data, thumb;
    req.files = qs.parse(files);
    thumb = req.files['thumb'];
    data = {
      name: 'thumb',
      type: thumb.type
    };
    return req.photo.attachFile(thumb.path, data, function(err) {
      if (err) {
        return next(err);
      }
      return fs.unlink(thumb.path, function(err) {
        if (err) {
          return next(err);
        }
        return res.send({
          success: true
        });
      });
    });
  });
};
