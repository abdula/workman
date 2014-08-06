var should = require('should'),
    util = require('../lib/util');

/*global describe,before,it,after */

describe('Util', function() {

    it('should extend', function() {
        var result = util.mix({key: true}, {key1: 2, key3 : 3});
        result.should.be.an.Object;
        result.should.be.containEql({
            key: true,
            key1: 2,
            key3: 3
        });
    });

});