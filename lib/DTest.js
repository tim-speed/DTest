var fs = require('fs'),
    esprima = require('esprima');

var Runtime = fs.readFileSync(__dirname + '/DTestRuntime.js');

function _trim(val) {
    return val.trim();
}

function _mapParamName(val) {
    return val.name;
}

function _filterEmpty(val) {
    return val.length > 0;
}

function _filterLineComments(val) {
    return val.type === 'Block';
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

function _quoteAndParentheseSensitiveStringSplit(text) {
    var ret = [], startIndex = 0, length = 0, quoteChar = null, inParentheses = false;
    for (var i = 0; i < text.length; i++) {
        var currentChar = text[i];
        if (quoteChar !== null) {
            if ((!inParentheses && currentChar === quoteChar) || (inParentheses && currentChar === ')')) {
                // Set quote char back to null so we start detecting for quotes again
                quoteChar = null;
                inParentheses = false;
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
            } else if (currentChar === '"' || currentChar === '\'' || currentChar === '(') {
                // Start processing within quoatations
                quoteChar = currentChar;
                inParentheses = (currentChar === '(');
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

var regexFindTestInDoc = /[\s\n]*\*\s*\@test\s*(.*)/,
    regexFindInitInDoc = /[\s\n]*\*\s*\@init\s*(.*)/;

module.exports.buildFuncs = function buildFuncs(code) {

    var initCalls = 0, assertCalls = 0;

    function _buildTest(funcPath, funcParams, docText) {

        var match = regexFindTestInDoc.exec(docText);
        if (!match)
            return null;

        var test = '\n(function ' + funcPath.replace(/\./g, '_') + '_test() {\n';
        
        // Iterate through test matches
        do {
            var testCode = match[1];
            if (!testCode)
                continue;

            // Test code may be in the following format space delimeted:
            // param1 param2 paramX... test(one of)[typeof ! !! == === != !== >= <= > <] comparison(expected for all but ! or !!)
            var testParams = _quoteAndParentheseSensitiveStringSplit(testCode).map(_trim).filter(_filterEmpty);
            // Evaluate in reverse to determine and pull out comparison
            // Expect testParams.length === funcParams.length
            // TODO: Check for errors in invalid matching of test to function
            var compParams = testParams.slice(funcParams.length),
                testType = compParams[0],
                comparison = compParams[1];
            // Reduce test params set
            testParams = testParams.slice(0, funcParams.length);
            // Build out test
            test += '\tDTestAssert(\'' + funcPath + '\', [' + testParams.map(JSON.stringify).join(', ') + '], \'' + testType + '\'' + 
                (comparison ? (', ' + JSON.stringify(comparison)) : '') + ');\n';
            // Keep track
            assertCalls++;
            // Update docText window
            docText = docText.substr(match.index + match[0].length);
        } while (match = regexFindTestInDoc.exec(docText));

        test += '})();';

        return test;
    }

    function _buildInit(funcPath, funcParams, docText) {

        var match = regexFindInitInDoc.exec(docText);
        if (!match)
            return null;

        var initStatement = '\n(function ' + funcPath.replace(/\./g, '_') + '_init() {\n';
        
        // Iterate through init matches
        do {
            var initCode = match[1];
            if (!initCode)
                continue;

            // Init code may be in the following format space delimeted:
            // param1 param2 paramX...
            var initParams = _quoteSensitiveStringSplit(initCode).map(_trim).filter(_filterEmpty);
            // Evaluate in reverse to determine and pull out comparison
            // Expect initParams.length === funcParams.length
            // Reduce test params set
            // TODO: Consider warning when they don't match
            initParams = initParams.slice(0, funcParams.length);
            // Build out test
            initStatement += '\tDTestInit(\'' + funcPath + '\', [' + initParams.map(JSON.stringify).join(', ') + ']);\n';
            // Keep track
            initCalls++;
            // Update docText window
            docText = docText.substr(match.index + match[0].length);
        } while (match = regexFindInitInDoc.exec(docText));

        initStatement += '})();';

        return initStatement;
    }

    var codeOut = code,
        parsedCode = esprima.parse(code, { 
            attachComment: true, // Attach comments into the parse tree
            range: false, // Index based range
            loc: true, // Line and column based
            tolerant: false // Tolerant of errors
        }),
        tests = [],
        inits = [];

    // fs.writeFileSync('./testout' + Math.random() + '.json', JSON.stringify(parsedCode, null, '\t'), 'utf8');

    function processFunctionExpressionOrDeclaration(functionNode, clusterPath, addressableName, leadingComments) {
        var id = functionNode.id,
            docText = leadingComments || functionNode.leadingComments || id.leadingComments, 
            funcPath, funcParams, test, init;

        // Filter to correct docText else continue
        if (!docText || !docText.length || !(docText = docText.filter(_filterLineComments).pop()))
            return false;
        docText = docText.value;
        // Build path
        funcPath = clusterPath + (addressableName || id.name);
        // Grab params
        funcParams = functionNode.params.map(_mapParamName);

        // Attempt to build the test
        if (test = _buildTest(funcPath, funcParams, docText)) {
            tests.push(test);
            return true;
        }
        if (init = _buildInit(funcPath, funcParams, docText)) {
            inits.push(init);
            return true;
        }

        return false;
    }

    function recursivelyTraverse(cluster, clusterPath, leadingComments) {
        var i = 0,
            len = cluster.length,
            node;

        for (; i < len; i++) {
            node = cluster[i];

            // console.log('In node type: ', node.type, node.id && node.id.name, node.value && node.value.type);

            switch (node.type) {
                case 'FunctionDeclaration':
                    // Global function / function within function
                    processFunctionExpressionOrDeclaration(node, clusterPath);
                    
                    break;
                case 'Property':
                    // Handle static object property functions
                    if (node.value.type === 'FunctionExpression') {
                        processFunctionExpressionOrDeclaration(node.value, 
                            clusterPath, 
                            node.key.name, 
                            node.leadingComments || node.key.leadingComments);
                    } else if (node.value.type === 'ObjectExpression') {
                        recursivelyTraverse(node.value.properties, clusterPath + node.key.name + '.');
                    }

                    break;
                case 'VariableDeclaration':
                    // Dig deeper
                    recursivelyTraverse(node.declarations, clusterPath, node.leadingComments);
                    
                    break;
                case 'VariableDeclarator':
                    // Dig deeper into static object declarations
                    switch (node.init.type) {
                        case 'ObjectExpression':
                            recursivelyTraverse(node.init.properties, clusterPath + node.id.name + '.');
                            break;
                        case 'FunctionExpression':
                            processFunctionExpressionOrDeclaration(node.init, 
                                clusterPath, 
                                node.id.name, 
                                node.leadingComments || node.id.leadingComments || leadingComments);
                            break;
                    }
                    break;
                case 'ExpressionStatement':
                    // Check to see if this is a function assignment
                    if (node.expression.type === 'AssignmentExpression' && node.expression.right.type === 'FunctionExpression') {
                        // Traverse left member loop to resolve object heirarchy
                        var chain = [],
                            expression = node.expression,
                            left = expression.left,
                            member = left,
                            property, execPath;

                        do {
                            if (property = member.property) {
                                // Add properties, member type 'MemberExpression'
                                chain.unshift(property.name);
                            } else {
                                // Handle last item, member type 'Identifier'
                                chain.unshift(member.name);
                            }
                        } while (member = member.object);

                        // Set cluster path as initializer if present
                        // First grab the last property name from the chain (holds function)
                        property = chain[chain.length - 1];
                        // Then reduce the chain set
                        chain = chain.slice(0, -1);
                        // Then build a path to access the function from
                        execPath = (clusterPath ? clusterPath + ';' : '') + chain.join('.');
                        processFunctionExpressionOrDeclaration(expression.right, 
                            execPath ? (execPath + '.') : '', 
                            property, 
                            node.leadingComments || expression.leadingComments || expression.left.leadingComments);
                    }

                    break;
            }
        }
    }

    recursivelyTraverse(parsedCode.body, '');

    // Store total tests
    if (!tests.length)
        codeOut += '\n\nprocess.doneCallback();';
    else {
        // Compile inits into the code output
        codeOut += '\n\n// INITS!';
        codeOut += inits.join('');

        // Compile tests into the code output
        codeOut += '\n\n// TESTS!';
        codeOut += tests.join('');
    }

    // Return the code
    // TODO: Potentially return object with details / errors + codeOut
    return codeOut;
};

module.exports.testFuncs = function testFuncs(filePath, cb) {
    // TODO: Add support for in browser alternative to fs.readFileSync
    var vm = require && require('vm'),
        code = fs.readFileSync(filePath, 'utf8'),
        codeOut = this.buildFuncs(code);

    // Add runtime to the head
    codeOut = Runtime + '\n' + codeOut;

    if (vm) {
        // Running in node
        var context = {
            process: {
                stdout: process.stdout,
                nextTick: process.nextTick,
                doneCallback: cb || function testFuncsDoneEmpty() {}
            },
            setTimeout: setTimeout,
            clearTimeout: clearTimeout
        };
        context.global = context;
        context.constructor = function Global() {
        };

        // console.log(codeOut);
        
        vm.runInNewContext(codeOut, context, filePath);
    } else {
        // Running in browser, limited to eval :(
        eval(codeOut);
    }
};