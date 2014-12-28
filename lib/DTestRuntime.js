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

    var initTree = {};

    glob.DTestInit = function DTestInit(funcPath, funcArgs) {
        var me = glob,
            initString = (funcArgs.length ? (funcArgs.join(' ') + ' ') : ''),
            pathParts = funcPath.split('.'),
            i = 0,
            end = pathParts.length - 1,
            treeParent = initTree,
            funcName;

        // Traverse funcPath to update me
        for (; i < end; i++) {
            funcName = pathParts[i];
            me = me[funcName];
            if (!me) {
                return fail(funcName + ' is not defined on object path \"' + pathParts.slice(0, i).join('.') + '\" - for test: ' + initString);
            }
            // Add this name to the tree parent if needed then update
            treeParent = treeParent[funcName] = treeParent[funcName] || {};
        }
        funcName = pathParts[end];

        // Grab the constructor function
        var constructor = me[funcName];

        if (!constructor) {
            return fail(funcName + ' is not defined on object path \"' + pathParts.slice(0, -1).join('.') + '\" - for test: ' + initString);
        }

        // Construct the constructor prototype with Object.create then call it as the constructor with mapped args
        var obj = Object.create(constructor.prototype),
            initObjs = treeParent[funcName] = treeParent[funcName] || [];
        constructor.apply(obj, funcArgs.map(eval));
        initObjs.push({
            obj: obj, 
            init: initString.trim()
        });
    };

    glob.DTestAssert = function DTestAssert(funcPath, funcArgs, testType, comparison, me, initPath, remainingPath) {
        me = me || glob;

        var testString = (funcArgs.length ? (funcArgs.join(' ') + ' ') : '') + testType + (comparison ? (' ' + comparison) : ''),
            pathParts = remainingPath || funcPath.split('.'),
            i = 0,
            end = pathParts.length - 1,
            funcName,
            ppI, ppName, ppItem, ppObj;

        // Traverse funcPath to update me
        for (; i < end; i++) {
            funcName = pathParts[i];
            me = me[funcName];
            if (!me) {
                return fail(funcName + ' is not defined on object path \"' + pathParts.slice(0, i).join('.') + '\" - for test: ' + testString);
            }
            if (funcName === 'prototype' && i > 0) {
                // Navigate the previous path items
                for (ppI = 0; ppI < i; ppI++) {
                    ppName = pathParts[ppI];
                    // Traverse the tree
                    if (ppI === 0) {
                        ppItem = initTree[ppName];
                    } else {
                        ppItem = ppItem[ppName];
                    }
                    
                    if (!ppItem) {
                        warn('No @init directives defined for ' + pathParts[i - 1] + 
                            '\'s parameterized constructor. Object path \"' + pathParts.slice(0, i).join('.') + 
                            '\" - for test: ' + testString);
                        break;
                    }
                }

                if (ppItem) {
                    // Since the item exists, let's branch for each instance of the obj
                    for (ppI = 0; ppI < ppItem.length; ppI++) {
                        ppObj = ppItem[ppI];
                        glob.DTestAssert(funcPath, funcArgs, testType, comparison, ppObj.obj, 
                            pathParts.slice(0, i).join('.') + '<' + ppObj.init + '>', 
                            pathParts.slice(i + 1));
                    }
                    // Return since we are branching
                    return;
                }
            }
        }
        funcName = pathParts[end];

        // Grab function
        var func = me[funcName];

        if (!func) {
            return fail(funcName + ' is not defined on object path \"' + pathParts.slice(0, -1).join('.') + '\" - for test: ' + testString);
        }

        // Closure function to run test
        function invoke() {
            var ret = func.apply(me, funcArgs.map(eval));
            //log('ret:', ret);
            return ret;
        }

        // Update func path for message if init path available (in the case where this is a branch)
        if (initPath)
            funcPath = initPath + '.' + remainingPath.join('.');

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
