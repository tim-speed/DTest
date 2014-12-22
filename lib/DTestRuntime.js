// This is inlined at test time
(function() {
    var glob = ((typeof window !== 'undefined' && window) || global);
    if (glob.DTestAssert)
        return;

    var buffer = '',
        write = (process && process.stdout && function write(text) {
            process.stdout.write(text);
        }) || function write(text) {
            buffer += text;
        },
        flush = (process && process.stdout && function flush() {
        }) || function flush() {
            console.log(buffer);
            buffer = '';
        };

    function repeatString(string, times) {
        var out = '';
        for (var i = 0; i < times; i++)
            out += string;
        return out;
    }

    function expandString(obj, maxDepth, currentDepth) {
        if (!maxDepth)
            maxDepth = 2;
        if (!currentDepth)
            currentDepth = 0;
        if (currentDepth > maxDepth)
            return obj.toString();
        switch (typeof obj) {
            case 'undefined':
                return 'undefined';
            case 'string':
                return JSON.stringify(obj);
            case 'object':
                if (obj === null)
                    return 'null';
                var out = '{\n',
                    nextDepth = currentDepth + 1,
                    first = true;

                for (var prop in obj) {
                    if (first) {
                        first = false;
                    } else {
                        out += ',\n';
                    }
                    out += repeatString('\t', nextDepth);
                    out += '"' + prop + '": ';
                    out += expandString(obj[prop], maxDepth, nextDepth);
                }

                out += '\n' + repeatString('\t', currentDepth) + '}';

                return out;
            default: // Number, Function
                return obj.toString();
        }
    }

    function log() {
        var args = Array.prototype.slice.call(arguments),
            len = args.length,
            i = 1;
        write(expandString(args[0]));
        for (; i < len; i++) {
            write(' ');
            write(expandString(args[i]));
        }
        write('\n');
        flush();
    }

    if (!glob.console)
        glob.console = {};
    if (!glob.console.log)
        glob.console.log = log;

    function pass(message) {
        write('[PASS] ');
        write(message);
        write('\n');
        flush();
        return true;
    }

    function fail(message) {
        write('[FAIL] ');
        write(message);
        write('\n');
        flush();
        return false;
    }

    function err(message) {
        write('[ERROR] ');
        write(message);
        write('\n');
        flush();
        return false;
    }

    function warn(message) {
        write('[WARN] ');
        write(message);
        write('\n');
        flush();
        return false;
    }

    glob.DTestAssert = function DTestAssert(funcPath, funcArgs, testType, comparison) {
        var me = glob,
            testString = (funcArgs.length ? (funcArgs.join(' ') + ' ') : '') + testType + (comparison ? (' ' + comparison) : ''),
            funcName;

        // Traverse funcPath to update me
        var pathParts = funcPath.split('.'),
            i = 0,
            end = pathParts.length - 1;

        for (; i < end; i++) {
            funcName = pathParts[i];
            me = me[funcName];
            if (!me) {
                return fail(funcName + ' is not defined on object path \"' + pathParts.slice(0, i).join('.') + '\" - for test: ' + testString);
            }
        }
        funcName = pathParts[end];

        // Grab function
        var func = me[funcName];

        if (!func) {
            return fail(funcName + ' is not defined on object path \"' + pathParts.slice(0, -1).join('.') + '\" - for test: ' + testString);
        }

        // console.log(funcName, funcArgs, testType, comparison);

        // Closure function to run test
        function invoke() {
            var ret = func.apply(me, funcArgs.map(eval));
            //log('ret:', ret);
            return ret;
        }

        var stdMessage = funcPath + ' - test: ' + testString,
            errDetails = ' for ' + funcPath + ' - test: ' + testString;

        function passFail(bool) {
            return (bool && pass(stdMessage)) || fail(stdMessage);
        }

        if (testType === '!')
            return passFail(!invoke());
        if (testType === '!!')
            return passFail(!!invoke());

        if (typeof comparison === 'undefined') {
            warn('Undefined comparison for test type: ' + testType + ' consider using null instead, ' + errDetails);
        }

        if (testType === 'typeof') {
            return passFail(typeof invoke() === comparison);
        }

        var compVal = comparison && eval(comparison);

        switch (testType) {
            case '==':
                return passFail(invoke() == compVal);
            case '!=':
                return passFail(invoke() != compVal);
            case '===':
                return passFail(invoke() === compVal);
            case '!==':
                return passFail(invoke() !== compVal);
            case '>':
                return passFail(invoke() > compVal);
            case '<':
                return passFail(invoke() < compVal);
            case '<=':
                return passFail(invoke() <= compVal);
            case '>=':
                return passFail(invoke() >= compVal);
            default:
                return err('Unhandled testType: ' + testType + errDetails);
        }
    };
})();
