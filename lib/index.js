var util = require('util'),
    EventEmitter = require('events').EventEmitter;

function wildcardToRegExp(pattern) {
    pattern = pattern.replace(/[\-\[\]\/\{\}\(\)\+\.\\\^\$\|]/g, "\\$&")
    return new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/, '.') + '$');
}

function containEqlStrict(obj, filter) {
    for (var key in filter) {
        if (obj[key] !== filter[key]) {
            return false;
        }
    }
    return true;
}

function HandlerNotFound(req) {
    this.name = "HandlerNotFound";
    this.message = 'No handlers was found for request "' + req + '"';
    this.errno = 404;
}
HandlerNotFound.prototype = new Error();
HandlerNotFound.prototype.constructor = HandlerNotFound;

/**
 * Channel
 *
 * @param name
 * @constructor
 */
function Channel(name) {
    this.name = name;
    this.stack = [];
    EventEmitter.call(this);
}

util.inherits(Channel, EventEmitter);


(function() {//Channel.prototype

    /**
     * return a list of handlers which have pattern match request
     *
     * @param req
     */
    this.findMatch = function(req) {
        var stack = this.stack,
            result = [],
            handler;
        for (var i = 0, l = stack.length; i < l; i++) {
            handler = stack[i];
            if (handler.regExp.test(req)) {
                result.push(handler);
            }
        }
        return result;
    };

    function compareByPriority(a, b) {
        if (a.priority === b.priority) return 0;
        if (a.priority > b.priority)   return -1;
        if (a.priority < b.priority)   return 1;
    }

    function stack(funcs) {
        var length = funcs.length;
        if (!length) {
            throw new Error('List of functions is not specified');
        }

        return function() {
            var results = [],
                idx = 0,
                args = Array.prototype.slice.call(arguments),
                done = args.pop();

            args.push(function(err, result) {
                if (err) return done(err);
                results.push(result);

                idx++;
                if (idx === length) {
                    return done(null, results);
                }
                return funcs[idx].apply(null, args);
            });
            funcs[idx].apply(null, args);
        };
    }


    /**
     * return a stack of handlers by request
     *
     * @param req
     */
    this.buildStack = function(req) {
        var list = this.findMatch(req);
        if (!list.length) {
            return function() {
                arguments[arguments.length - 1](new HandlerNotFound(req));
            };
        }
        list = list.sort(compareByPriority).map(function(item){
            return item.bindFn;
        });

        return stack(list);
    };

    this.beforeReq = function() {
        throw new Error('not implemented');
    };

    this.afterReq = function() {
        throw new Error('not implemented');
    };


    /**
     * perform request
     * example:
     *      channel('test').req('users.list', limit, offset, cb)
     *      channel('test').req('users.list', {limit: 10, offset: 0}, cb)
     */
    this.req = function() {
        var self  = this,
            args  = Array.prototype.slice.call(arguments),
            req   = args.shift(),
            cb    = args.pop(),
            stack = this.buildStack(req);

        this.emit('pre:req', req, args.length > 0? args: args[0]);

        args.push(function(err, results) {
            if (err) {
                return cb(err);
            }
            var lastRes = results[results.length - 1];
            self.emit('post:req', req, lastRes, results);
            return cb(null, lastRes, results);
        });
        stack.apply(null, args);
    };

    /**
     * remove all handlers
     *
     * @returns {*}
     */
    this.removeAllHandlers = function() {
        var stack = this.stack,
            handler;
        this.stack = [];
        for (var i = 0, l = stack.length; i < l; i++) {
            handler = stack[i];
            this.emit('removeHandler', handler.pattern, handler);
        }
        return this;
    };

    /**
     * remove request handler
     *
     * @param {string|function} arg
     * @returns {*}
     */
    this.removeHandler = function(arg) {
        var stack = this.stack,
            where = {};

        if (typeof arg === 'string') {
            where.pattern = arg;
        } else {
            if (typeof arg === 'function') {
                where.fn = arg;
            }
        }

        this.stack = stack.filter(function(handler) {
            if (containEqlStrict(handler, where)) {
                this.emit('removeHandler', handler.pattern, handler);
                return false;
            }
            return true;
        }, this);
    };

    /**
     * add request handler
     *
     * @param {string|RegExp} pattern
     * @param {function} fn
     * @param {object} [options]
     * @returns {*}
     */
    this.onReq = function(pattern, fn, options) {
        if (typeof fn !== 'function') {
            throw new Error('Invalid function specified');
        }
        options || (options = {});
        options.pattern = pattern;

        if (!pattern) {
            throw new Error('Pattern not specified');
        }

        if (pattern instanceof RegExp) {
            options.regExp = pattern;
        } else {
            if (typeof pattern !== 'string') {
                throw new Error('Pattern should have type String or RegExp');
            }
            options.regExp = wildcardToRegExp(pattern);
        }

        options.fn = fn;
        options.bindFn = options.context? fn.bind(options.context) : fn;
        options.context  = options.context || null;

        var length = this.stack.push(options);

        return (function() {
            this.removeHandler(this.stack[length - 1].fn);
        }).bind(this);
    };

    /**
     * check has handlers for the request or not
     *
     * @param {string} req
     * @returns {bool}
     */
    this.hasReqHandler = function(req) {
        return this.findMatch(req).length > 0;
    };

    /**
     * alias for onReq method
     *
     * @returns {*}
     */
    this.define = function() {
        return this.onReq.apply(this, arguments);
    };

}.call(Channel.prototype));

var globalChannel = new Channel('__global__'),
    channels = {},
    debugOn = process.NODE_ENV !== 'production';

(function() {
    /**
     * remove channel by name with all handlers of it
     *
     * @param {string} channel
     */
    this.remove = function(channel) {
        this.channel(channel).destroy();
    };


    ['onReq', 'offReq', 'findMatch', 'hasReqHandler',
     'removeHandler', 'req', 'beforeReq', 'afterReq'].forEach(function(fn) {
        this[fn] = function(pattern) {
            if (typeof pattern === 'string') {
                var pos = pattern.indexOf('.');
                if (pos !== -1) {
                    var channel = pattern.substr(0, pos);
                    pattern = pattern.substr(pos + 1, pattern.length - 1);
                    arguments[0] = pattern;

                    channel = this.channel(channel);
                    return channel[fn].apply(channel, arguments);
                }
            }
            return Channel.prototype[fn].apply(this, arguments);
        };
    }, this);

    /**
     * return list of channels
     *
     * @returns {Array}
     */
    this.channels = function() {
        var result = [];
        for (var key in channels) {
            result.push(channels[key]);
        }
        return result;
    };

    /**
     * has channel
     *
     * @param {string} channel
     * @returns {*}
     */
    this.has = function(channel) {
        return channels.hasOwnProperty(channel);
    };

    /**
     * return names of channels
     *
     * @returns {Array}
     */
    this.names = function() {
        return Object.keys(channels);
    };

    /**
     * return channel by name
     * if channel does not exist, create it
     *
     * @param {string} name
     */
    this.channel = function(name) {
        if (!name) {
            return globalChannel;
        }

        if (!channels[name]) {
            var chnl = new Channel();

            chnl.destroy = function() {
                chnl.removeAllHandlers();
                chnl.removeAllListeners();
                delete channels[name];
            };
            channels[name] = chnl;
        }
        return channels[name];
    };

    this.debug = function(bool) {
        debugOn = bool? true:false;
    };

}.call(globalChannel));

module.exports = globalChannel;

function debug(message) {
    console.log(message);
}


