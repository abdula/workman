var should = require('should'),
    cmnds = require('../lib/index');

/*global describe,before,it,after */

describe('Workman', function() {
    before(function() {
        cmnds.should.be.an.Object;
    });

    beforeEach(function() {
        cmnds.reset();
    });

    describe('Global container', function() {
        var methods = ['ns', 'delNs', 'containers', 'define', 'before', 'after', 'invoke', 'reset'];

        beforeEach(function() {
            cmnds.reset();
        });

        it('should has methods "' +  methods.join(', ') + '"', function() {
            methods.forEach(function(fn) {
                cmnds.should.have.property(fn).with.type('function');
            })
        });

        it('should manage containers', function() {
            var name = 'chnl',
                container = cmnds.ns(name);

            should(container).be.an.Object;
            cmnds.ns(name).should.be.equal(container);
            cmnds.namespaces().length.should.be.eql(1);
            cmnds.containers().length.should.be.eql(1);
            cmnds.hasNs(name).should.be.true;
            cmnds.delNs(name);
            cmnds.hasNs(name).should.be.false;
            cmnds.namespaces().length.should.be.eql(0);
        });

        it('should manage cmnds', function() {
            var fn = function(fileName, next) {
                next(null, 'file content');
            };
            var remove = cmnds.define('fs.readFile', fn);
            should.exist(remove);
            remove.should.be.type('function');

            cmnds.ns('fs').has('readFile').should.be.true;
            cmnds.has('fs.readFile').should.be.true;
            remove();
            cmnds.has('fs.readFile').should.be.false;
        });
    });


    it('should invoke defined command', function(done) {
        cmnds.ns('fs').define('readFile', function(file, next) {
            should.exist(file);
            file.should.be.eql('test.txt');
            next(null, 'file content');
        });

        cmnds.ns('fs').invoke('readFile', 'test.txt', function(err, content) {
            should.not.exist(err);
            should.exist(content);
            content.should.be.eql('file content');
            done();
        });
    });

    it('should perform "before, after" functions', function(done) {
        cmnds.define('fs.readFile', function(file, next) {
            console.log('call hook');
            should.exist(file);
            file.should.be.eql('test#2.txt');
            next(null, 'hello');
        });

        cmnds.before('fs.readFile', function(file, next) {
            console.log('call before #1');
            file.should.be.eql('test.txt');
            next(null, 'test#1.txt');
        });

        cmnds.before('fs.readFile', function(file, next) {
            console.log('call before #2');
            next(null, 'test#2.txt');
        });

        cmnds.after('fs.readFile', function(content, next) {
            console.log('call after #1');
            next(null, content + ' master');
        });

        cmnds.after('fs.readFile', function(content, next) {
            console.log('call after #2');
            next(null, content + ' yoda');
        });

        cmnds.wrap('fs.readFile', (function() {
            var cache;
            return function(file, fn, next) {
                console.log('call wrap');
                if (!cache) {
                    fn(file, function(err, content) {
                        content.should.be.eql('hello');
                        cache = content;
                        next(null, cache);
                    });
                } else {
                    next(null, 'from cache ' + cache);
                }
            }
        }()));

        cmnds.invoke('fs.readFile', 'test.txt', function(err, content) {
            should.not.exist(err);
            should.exist(content);
            content.should.be.eql('hello master yoda');

            cmnds.invoke('fs.readFile', 'test.txt', function(err, content) {
                should.not.exist(err);
                should.exist(content);
                content.should.be.eql('from cache hello master yoda');
                done();
            });
        });
    });

});
