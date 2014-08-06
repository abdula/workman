exports.mix = function(target, obj) {
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            target[key] = obj[key];
        }
    }
    return target;
};
