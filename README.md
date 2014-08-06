workman
============

## Installation
    npm install workman 
    
## Example
```javascript
var workman = require('workman'),
    fs = require('fs');

workman.define('fs.readFile', function(file, cb) {
    fs.readFile(file, 'utf8', cb);
});

workman.before('fs.readFile', function(file, cb) {
    fs.exists(file, function(exists) {
        if (!exists) {
            return cb(new Error('File does not exist'));
        }
        cb(null, file);
    });
});

workman.after('fs.readFile', function(content, cb) {
    console.log('After', content);
    cb(null, content);
});

workman.ns('fs').wrap('readFile', (function() {
    var cache = {};
    return function(file, fn, cb) {
        if (cache.hasOwnProperty(file)) {
            return cb(null, cache[file]);
        }
        fn(file, function(err, content) {
            if (err) return cb(err);
            cache[file] = content;
            return cb(null, content);
        });
    };
}()));

workman.ns('fs').do('readFile', __dirname + '/README.md', function(err, content) {
    console.log(content);
}); //or invoke
```