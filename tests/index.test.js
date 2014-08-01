var should = require('should'),
    stack = require('../');

/*global describe,before,it,after */

describe('Request-Reply', function() {

    before(function() {
        stack.should.be.an.Object;
    });

    it('should have global channel', function() {
        ['remove', 'channel', 'onReq', 'offReq'].forEach(function(fn) {
            stack.should.have.property(fn).with.type('function');
        });

        stack.channel().should.be.equal(stack);
    });

    it('should manage channels', function() {
        var name = 'chnl',
            channel = stack.channel(name);

        ['onReq', 'offReq'].forEach(function(fn) {
            stack.should.have.property(fn).with.type('function');
        });
        stack.channel(name).should.be.equal(channel);
        stack.channels().length.should.be.eql(1);
        stack.names().should.be.eql([name]);
        stack.has(name).should.be.true;
        stack.remove(name);
        stack.has(name).should.be.false;
        stack.channels().length.should.be.eql(0);
    });

    it('should add request handlers', function() {
        stack.beforeReq();
        stack.afterReq();
        stack.onReq('read-file', function(elem, next) {
            next.done = true;
            async: true;
            next(null)
        }, {push: true, unshift: true});
    });

    it('should execute request', function() {

    });

});
