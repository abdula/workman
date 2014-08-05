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

    it('should manage request handlers', function() {
        var fn = function(fileName, next) {
            next(null, 'file content');
        };
        var remove = stack.onReq('fs.readFile', fn);
        should.exist(remove);
        remove.should.be.type('function');
        var match = stack.findMatch('fs.readFile');
        match.should.be.an.Array.and.have.lengthOf(1);
        match[0].fn.should.be.equal(fn);

        remove();
        stack.findMatch('fs.readFile').should.be.an.Array.and.have.lengthOf(0);
    });

    it('should execute request', function(done) {
        var email = 'johndoe@mail.com';

        stack.onReq('sendEmail', function(data, next) {
            data.should.have.property('email', email);
            console.log('Request call');
            next(null, 'done ' + data.email);
        });

        stack.req('sendEmail', {email: email}, function(err, result) {
            should.exist(result);
            should.not.exist(err);
            result.should.be.eql('done ' + email);
            done();
        });
    });
});
