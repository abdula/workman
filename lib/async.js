var slice = Array.prototype.slice;

exports.waterfall = function(list) {
    var l = list.length;
    if (!l) {
        return function() {
            arguments[arguments.length - 1].apply(null, arguments);
        }
    }

    return function() {
        var idx = 0,
            args = slice.call(arguments),
            done = args.pop();

        var cb = function() {
            var inArgs = slice.call(arguments),
                err = inArgs.shift();
            if (err) {
                return done.apply(null, arguments);
            }
            idx++;
            if (idx < l) {
                inArgs.push(cb);
                return list[idx].apply(null, inArgs);
            }
            return done.apply(null, arguments);
        };

        args.push(cb);
        list[idx].apply(null, args);
    }
};

exports.wrap = (function() {
    function wrapFn(fn, wrap) {
        return function() {
            var args = slice.call(arguments);
            args.splice(args.length - 1, 0, fn);
            wrap.apply(null, args);
        }
    }

    return function(list) {
        if (!list.length) {
            throw new Error('The list of functions is empty');
        }
        var l = list.length,
            fn = list[0];

        for (var i = 1; i < l; i++) {
            fn = wrapFn(fn, list[i]);
        }
        return fn;
    }
}());
