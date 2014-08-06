var should = require('should'),
    async = require('../lib/async');

/*global describe,before,it,after */

describe('Async', function() {

    describe('wrap', function() {
        it('should return hello john doe', function(done) {
            var fn = async.wrap([
                    function(msg, next) {
                        next(null, msg);
                    },
                    function(msg, fn, next) {
                        fn(msg, function(err, msg) {
                            next(null, msg + ' john');
                        })
                    },
                    function(msg, fn, next) {
                        fn(msg, function(err, msg) {
                            next(null, msg + ' doe');
                        });
                    }]
            );
            fn('hello', function(err, msg) {
                msg.should.be.eql('hello john doe');
                done();
            });
        });

        it('should return err', function(done) {
            var fn = async.wrap([
                    function(msg, next) {
                        next(new Error(msg));
                    },
                    function(msg, fn, next) {
                        fn(msg, function(err, msg) {
                            if (err) next(err);
                            else {
                                next(null, 'something wrong');
                            }
                        })
                    }]
            );
            fn('OK', function(err, msg) {
                should.exist(err);
                should.not.exist(msg);
                err.should.be.an.instanceOf(Error);
                err.message.should.be.eql('OK');
                done();
            });
        });
    });

    describe('waterfall', function() {

        it('should return "You are amazing"', function(done) {
            var fn = async.waterfall([
                function(next) {
                    next(null, 'You');
                },
                function(msg, next) {
                    next(null, msg + ' are');
                },
                function(msg, next) {
                    next(null, msg + ' amazing');
                }
            ]);
            fn(function(err, msg) {
                should.not.exist(err);
                should.exist(msg);
                msg.should.be.eql('You are amazing');
                done();
            });
        });
    });
});