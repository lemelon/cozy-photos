// Generated by CoffeeScript 1.9.2
var Contact, async, fs;

Contact = require('../models/contact');

async = require('async');

fs = require('fs');

module.exports.list = function(req, res, next) {
  return Contact.all(function(err, contacts) {
    if (err) {
      return next(err);
    } else if (!contacts) {
      err = new Error("Contacts not found");
      err.status = 404;
      return next(err);
    } else {
      return res.send(contacts);
    }
  });
};
