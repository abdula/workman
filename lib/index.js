var EventEmitter = require('events').EventEmitter,
    util  = require('util'),
    slice = Array.prototype.slice,
    mix   = require('./util').mix,
    async = require('./async');


function HookNotFound(hook) {
    this.name = "HookNotFound";
    this.message = 'Hook "' + hook +  '" not found';
    this.hook = hook;
    this.errno = 404;
}
HookNotFound.prototype = new Error();
HookNotFound.prototype.constructor = HookNotFound;

/**
 * Container
 *
 * @param ns
 * @constructor
 */
function Container(ns) {
    this.namespace = ns;
    this._hooks  = {};
    this._before = {};
    this._after  = {};
    this._wrap   = {};
    this._build  = {};

    EventEmitter.call(this);
}

util.inherits(Container, EventEmitter);


(function() {//Container.prototype

    this.names = function() {
        return Object.keys(this._hooks);
    };

    ['before', 'after', 'wrap'].forEach(function(method) {
        this[method] = function(hook, fn, opts) {
            if (typeof fn !== 'function') {
                throw new Error('Invalid function specified');
            }

            opts = mix({}, opts || {});
            var propName = '_' + method,
                arr = this[propName][hook];
            if (!arr) {
                arr = [];
                this[propName][hook] = arr;
            }
            delete this._build[hook];

            opts.fn = fn;
            arr.push(opts);
            return function() {
                arr.splice(arr.indexOf(opts), 1);
            };
        };
    }, this);

    this.do = function() {
        this.invoke.apply(this, arguments);
    };


    /**
     * example:
     *      invoker.ns('users').invoke('list', limit, offset, cb)
     */
    this.invoke = function() { //invoke
        var self  = this,
            args  = slice.call(arguments),
            hook  = args.shift(),
            cb    = args.pop(),
            fn    = this._build[hook];

        if (!fn) {
            try {
                fn = this._make(hook);
                this._build[hook] = fn;
            } catch (e) {
                return cb(e);
            }
        }

        this.emit('pre:invoke', hook, args.length > 0? args: args[0]);

        args.push(function(err, result) {
            if (err) {
                return cb(err);
            }
            self.emit('post:invoke', result);
            return cb(null, result);
        });
        //console.log(fn.toString());
        fn.apply(null, args);
    };


    /**
     * define hook
     *
     * @param {string|RegExp} name
     * @param {function} fn
     * @param {object} [options]
     * @returns {*}
     */
    this.define = function(name, fn, options) {
        if (typeof fn !== 'function') {
            throw new Error('Invalid function specified');
        }
        options = mix({}, options || {});
        options.hook = name;
        options.fn = fn;

        this._hooks[name] = options;
        delete this._build[name];

        return (function() {
            delete this._hooks[name];
        }).bind(this);
    };

    /**
     * remove all hooks
     *
     * @returns {*}
     */
    this.removeAll = function() {
        this._build  = {};
        this._hooks  = {};
        this._before = {};
        this._after  = {};
        this._wrap   = {};
        return this;
    };

    /**
     * remove hook
     *
     * @param {string} name
     * @returns {Object}
     */
    this.remove = function(name) {
        var hook = this._hooks[name];
        delete this._before[hook];
        delete this._after[hook];
        delete this._wrap[hook];
        delete this._hooks[hook];
        delete this._build[hook];
        return hook;
    };

    /**
     * check hook is defined or not
     *
     * @param {string} hook
     * @returns {bool}
     */
    this.has = function(hook) {
        return this._hooks.hasOwnProperty(hook);
    };

    function returnPropertyFn(item) {
        return item.fn;
    }

    this._make = function(hook) {
        if (!this.has(hook)) {
            throw new HookNotFound(hook);
        }
        var before = this._before[hook] || [],
            after  = this._after[hook] || [],
            wrap   = this._wrap[hook] || [],
            hook   = this._hooks[hook].fn;


        if (before.length) {
            before = before.map(returnPropertyFn);
        }

        if (after.length) {
            after = after.map(returnPropertyFn);
        }

        if (wrap.length) {
            hook = async.wrap([hook].concat(wrap.map(returnPropertyFn)));
        }

        return async.waterfall([].concat(before, hook, after));
    };
}.call(Container.prototype));

var globalContainer = new Container('__global__'),
    containers = {},
    debugOn = process.NODE_ENV !== 'production';

(function() {

    function resetContainer(container) {
        container.removeAll();
        container.removeAllListeners();
    }

    /**
     * destroy container by name
     *
     * @param {string} ns
     */
    this.delNs = function(ns) {
        var container = this.ns(ns);
        resetContainer(container);
        delete containers[ns];
    };

    this.reset = function() {
        var list = this.namespaces();
        list.forEach(this.delNs, this);
        resetContainer(globalContainer);
    };

    ['do', 'invoke', 'define', 'before', 'after', 'wrap', 'has'].forEach(function(fn) {
        this[fn] = function(pattern) {
            if (typeof pattern === 'string') {
                var pos = pattern.indexOf('.');
                if (pos !== -1) {
                    var ns = pattern.substr(0, pos);
                    pattern = pattern.substr(pos + 1, pattern.length - 1);
                    arguments[0] = pattern;

                    ns = this.namespace(ns);
                    return ns[fn].apply(ns, arguments);
                }
            }
            return Container.prototype[fn].apply(this, arguments);
        };
    }, this);

    /**
     * return list of containers
     *
     * @returns {Array}
     */
    this.containers = function() {
        var result = [];
        for (var key in containers) {
            result.push(containers[key]);
        }
        return result;
    };

    /**
     * has channel
     *
     * @param {string} channel
     * @returns {*}
     */
    this.hasNs = function(ns) {
        return containers.hasOwnProperty(ns);
    };

    /**
     * return names of channels
     *
     * @returns {Array}
     */
    this.namespaces = function() {
        return Object.keys(containers);
    };

    this.namespace = function() {
        return this.ns.apply(this, arguments);
    };

    /**
     * return hooks registry by namespace
     * if registry does not exist, create it
     *
     * @param {string} name
     */
    this.ns = function(name) {
        if (!name) {
            return globalContainer;
        }

        if (!containers[name]) {
            containers[name] = new Container(name);
        }
        return containers[name];
    };

    this.debug = function(bool) {
        debugOn = bool? true:false;
    };

}.call(globalContainer));

module.exports = globalContainer;

function debug(message) {
    console.log(message);
}


