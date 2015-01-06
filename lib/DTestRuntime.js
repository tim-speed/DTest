// This is inlined at test time
(function() {

    // 10 Seconds is the default amount of time to wait for a callback while testing
    var DEFAULT_ASYNC_TIMEOUT = 10 * 1000;

    var glob = ((typeof window !== 'undefined' && window) || global);
    if (glob.DTestAssert)
        return;

    function _trim(val) {
        return val.trim();
    }

    function _filterEmpty(val) {
        return val.length > 0;
    }

    function _quoteSensitiveStringSplit(text) {
        var ret = [], startIndex = 0, length = 0, quoteChar = null;
        for (var i = 0; i < text.length; i++) {
            var currentChar = text[i];
            if (quoteChar !== null) {
                if (currentChar === quoteChar) {
                    // Set quote char back to null so we start detecting for quotes again
                    quoteChar = null;
                }

                // Capture the char in the substring
                length++;
            } else {
                // White space is space ASCII 0x20 and anything less is a "control code"
                if (text.charCodeAt(i) <= 0x20) {
                    // If we had been counting length, pull out the string
                    if (length > 0)
                        ret.push(text.substr(startIndex, length));
                    // Start processing within quoatations
                    startIndex = i + 1;
                    length = 0;
                } else if (currentChar === '"' || currentChar === '\'') {
                    // Start processing within quoatations
                    quoteChar = currentChar;
                    if (!length) {
                        startIndex = i;
                    }
                    length++;
                } else
                    // Keep increasing the length so we can read this out at the next break
                    length++; 
            }
        }
        // if we were counting characters, but did not extract them because of unhandled termiantion, let's extract them as the last item
        if (length > 0)
            ret.push(text.substr(startIndex, length));
        return ret;
    }

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
            return (obj === null && 'null') || (obj === undefined && 'undefined') || obj.toString();
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

    function begin(message) {
        write('[BEGIN] ');
        write(message);
        write('\n');
        flush();
        return true;
    }

    function end(message) {
        write('[END] ');
        write(message);
        write('\n');
        flush();
        return true;
    }

    var initTree = {},
        testStack = [],
        remainingTests = 0,
        processTimoutId;

    function processInStack(testFunc) {
        // Add to stack
        testStack.push(testFunc);

        // Delay processing
        clearTimeout(processTimoutId);
        processTimoutId = setTimeout(function processInStackTimeout() {
            var nextFunc = testStack.shift();
            // Else process then check the stack if async
            testStackFunc(nextFunc);
        });
    }

    function testStackFunc(testFunc) {

        function checkAndRunNext() {
            // Decrement total test count and check, else look for another test
            if (!--remainingTests) {
                // Done the tests :)
                process.doneCallback();
                return;
            } else if (testStack.length) {
                // Clearing the call stack
                var nextFunc = testStack.shift();
                process.nextTick(function testStackFuncQueue() {
                    testStackFunc(nextFunc);
                });
                return;
            }
        }

        if (testFunc.name === 'syncTest') {
            // Run the test
            testFunc();
            checkAndRunNext();
        } else {
            // Run the test async
            testFunc(function testStackAsyncFuncCallback() {
                checkAndRunNext();
            });
        }
    }

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

        // console.log('DTestAssert', funcPath, funcArgs, testType, comparison, initPath, remainingPath);

        var testString = (funcArgs.length ? (funcArgs.join(' ')) : '') + (testType && testType !== 'undefined' ? (' ' + testType) : '') + (comparison ? (' ' + comparison) : ''),
            pathParts = remainingPath || funcPath.split('.'),
            i = 0,
            endIndex = pathParts.length - 1,
            funcName,
            ppI, ppName, ppItem, ppObj;

        // Traverse funcPath to update me
        for (; i < endIndex; i++) {
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
        funcName = pathParts[endIndex];

        // Grab function
        var func = me[funcName];

        if (!func) {
            return fail(funcName + ' is not defined on object path \"' + pathParts.slice(0, -1).join('.') + '\" - for test: ' + testString);
        }

        // Update func path for message if init path available (in the case where this is a branch)
        if (initPath)
            funcPath = initPath + '.' + remainingPath.join('.');

        // Variable used to store the test function
        var test;

        // Determine if the test is async or synchronous
        if (funcArgs.some(function testAsync(element) {
            return element[0] === '(';
        })) {
            // Async
            test = function asyncTest(testFinishedCallback) {
                // Iterate through function args and build out callback function tests
                var startTime = Date.now(),
                    i = 0,
                    len = funcArgs.length,
                    arg,
                    remainingCallbacks = 0;

                for (; i < len; i++) {
                    arg = funcArgs[i];
                    if (arg[0] === '(') {
                        // Parse function
                        var innards, tests,
                            parenthesesEnd = arg.lastIndexOf(')'),
                            timeoutDuration = DEFAULT_ASYNC_TIMEOUT;
                        if (!~parenthesesEnd)
                            return err('Invalid async test - no closing parentheses: \"' + arg + '\"' + ' for ' + funcPath) && testFinishedCallback();

                        var modifier = arg[parenthesesEnd + 1];

                        // Check for timeout portion
                        if (modifier === '<') {
                            timeoutDuration = parseInt(arg.substr([parenthesesEnd + 2]));
                            if (isNaN(timeoutDuration))
                                return err('Invalid async test - timeout portion is not a number: \"' + arg + '\"' + ' for ' + funcPath) && testFinishedCallback();
                        }

                        if (modifier === '!') {
                            // Supply a blank function but skip testing
                            funcArgs[i] = function asyncTestEmptyCallback() {};
                            // Add timeout checker to handle this being the only async param
                            setTimeout(function asyncTestCallbackTimeout() {
                                if (!remainingCallbacks) {
                                    // We are done all the callbacks so print out our closing message
                                    testFinishedCallback();
                                }
                            }, 0);
                            continue;
                        }

                        // Trim to innards of ()
                        innards = arg.substring(1, parenthesesEnd);

                        // Split on , and trim
                        tests = innards.split(',').map(_trim).filter(_filterEmpty);

                        // Split on " " and trim for tests
                        tests = tests.map(function asyncTestArgMap(val) {
                            return val.split(' ').map(_trim).filter(_filterEmpty);
                        });

                        funcArgs[i] = (function asyncCallbackGenerator(tests, testDescription) {

                            function asyncCallbackTestEnd() {
                                // Check if all the callbacks have been called
                                if (!--remainingCallbacks) {
                                    // We are done all the callbacks so print out our closing message
                                    end(funcPath + ' - ' + ((Date.now() - startTime) / 1000) + ' seconds');
                                    testFinishedCallback();
                                }
                            }

                            var timedOut = false,
                                timeoutId = setTimeout(function asyncTestCallbackTimeout() {
                                    err('Async callback timed out for ' + funcPath + ' ' + testDescription + ' - test: ' + testString);
                                    timedOut = true;
                                    asyncCallbackTestEnd();
                                }, timeoutDuration);

                            return function asyncTestCallback() {
                                // Do nothing if we have timed out
                                if (timedOut)
                                    return;
                                // Clear the timeout
                                clearTimeout(timeoutId);

                                function testValue(value, testType, comparison) {
                                    var stdMessage = 'arg[' + i + '] ' + testType + ' ' + comparison + ' of callback test: ' + testDescription + ' for ' + funcPath;

                                    function passFail(bool) {
                                        return (bool && pass(stdMessage)) || fail(stdMessage);
                                    }

                                    if (testType === '!')
                                        return passFail(!value);
                                    if (testType === '!!')
                                        return passFail(!!value);

                                    if (typeof comparison === 'undefined') {
                                        warn('Undefined comparison for test type: ' + testType + ' consider using null instead, for ' + stdMessage);
                                    }

                                    if (testType === 'typeof') {
                                        return passFail(typeof value === comparison);
                                    }

                                    var compVal = comparison && eval(comparison);

                                    switch (testType) {
                                        case '==':
                                            return passFail(value == compVal);
                                        case '!=':
                                            return passFail(value != compVal);
                                        case '===':
                                            return passFail(value === compVal);
                                        case '!==':
                                            return passFail(value !== compVal);
                                        case '>':
                                            return passFail(value > compVal);
                                        case '<':
                                            return passFail(value < compVal);
                                        case '<=':
                                            return passFail(value <= compVal);
                                        case '>=':
                                            return passFail(value >= compVal);
                                        default:
                                            return err('Unhandled testType: ' + testType + ' for ' + stdMessage);
                                    }
                                }

                                // Check each test
                                var args = Array.prototype.slice.call(arguments, 0),
                                    i = 0,
                                    len = args.length,
                                    test;

                                for (; i < len; i++) {
                                    if (test = tests[i]) {
                                        testValue(args[i], test[0], test[1]);
                                    } else {
                                        warn('Undefined test for argument ' + (i + 1) + ' of ' + funcPath + ' ' + testDescription + ' - test: ' + testString);
                                    }
                                }

                                // Check if all the callbacks have been called
                                asyncCallbackTestEnd();
                            };
                        })(tests, arg);
                        remainingCallbacks++;
                    } else {
                        // Parse arg
                        funcArgs[i] = eval(arg);
                    }
                }

                // Log then run func
                if (remainingCallbacks)
                    begin(funcPath + ' - test: ' + testString);
                else
                    warn('No active async callbacks for test: ' + testString + ' of ' + funcPath);
                var ret = func.apply(me, funcArgs);
                //log('ret:', ret);
                return ret;
            };
        } else {
            // Sync
            test = function syncTest() {
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
        }

        // Push test to the stack if there is stuff there, else start executing then check the stack after execution
        remainingTests++;
        processInStack(test);
    };
})();
