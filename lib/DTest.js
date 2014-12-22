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
                // If we had characters between the quotes
                if (length > 0)
                    ret.push(text.substr(startIndex - 1, length + 2));
                // Set quote char back to null so we start detecting for quotes again
                quoteChar = null;
                length = 0;
            } else
                // This is just another character within the quotation
                length++;
        } else {
            // White space is space ASCII 0x20 and anything less "control codes"
            if (text.charCodeAt(i) <= 0x20) {
                // If we had been counting length, pull out the string
                if (length > 0)
                    ret.push(text.substr(startIndex, length));
                // Start processing within quoatations
                startIndex = i + 1;
                length = 0;
            } else if (currentChar === '"' || currentChar === '\'') {
                // If we had been counting length, pull out the string
                if (length > 0)
                    ret.push(text.substr(startIndex, length));
                // Start processing within quoatations
                quoteChar = currentChar;
                startIndex = i + 1;
                length = 0;
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

var regexFindTest = /\/\*\*([\w\W]+?\@test[\w\W]+?)\*\/\s*\n\s*(?:['"]?(\w*)['"]?\s*\:\s*)?function\s*(\w*)\s*\((.*?)\)/,
    regexFindTestInDoc = /[\s\n]*\*\s*\@test\s*(.*)/;

function _buildTest(funcPath, funcParams, docText) {

    var match = regexFindTestInDoc.exec(docText);
    if (!match)
        return null;

    var test = '\n(function ' + funcPath.replace(/\./g, '_') + '_test() {\n';
    
    // Iterate through test matches
    do {

        //console.log('found test', match);

        var testCode = match[1];
        if (!testCode)
            continue;

        // Test code may be in the following format space delimeted:
        // param1 param2 paramX... test(one of)[typeof ! !! == === != !== >= <= > <] comparison(expected for all but ! or !!)
        var testParams = _quoteSensitiveStringSplit(testCode).map(_trim).filter(_filterEmpty);
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
        // Update docText window
        docText = docText.substr(match.index + match[0].length);
    } while (match = regexFindTestInDoc.exec(docText));

    test += '})();';

    return test;
}

module.exports.buildFuncs = function buildFuncs(code) {
    var codeOut = code,
        parsedCode = esprima.parse(code, { 
            attachComment: true, // Attach comments into the parse tree
            range: false, // Index based range
            loc: false, // Line and column based
            tolerant: false // Tolerant of errors
        }),
        tests = [];

    function recursivelyTraverse(cluster, clusterPath) {
        var i = 0,
            len = cluster.length,
            node, id, docText, funcPath, funcParams, test;

        for (; i < len; i++) {
            node = cluster[i];
            id = node.id;

            switch (node.type) {
                case 'FunctionDeclaration':
                
                    docText = node.leadingComments || id.leadingComments;
                    // Filter to correct docText else continue
                    if (!docText || !docText.length || !(docText = docText.filter(_filterLineComments).pop()))
                        continue;
                    docText = docText.value;
                    // Build path
                    funcPath = clusterPath + id.name;
                    // Grab params
                    funcParams = node.params.map(_mapParamName);

                    // Attempt to build the test
                    if (test = _buildTest(funcPath, funcParams, docText));
                        tests.push(test);
                    
                    break;
            }
        }
    }

    recursivelyTraverse(parsedCode.body, '');

    // Compile tests into the code output
    codeOut += '\n\n// TESTS!';
    codeOut += tests.join('');

    // Return the code
    // TODO: Potentially return object with details / errors + codeOut
    return codeOut;
};

module.exports.testFuncs = function testFuncs(filePath) {
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
                stdout: process.stdout
            }
        };
        context.global = context;
        context.constructor = function Global() {};

        // console.log(codeOut);
        
        vm.runInNewContext(codeOut, context, filePath);
    } else {
        // Running in browser, limited to eval :(
        eval(codeOut);
    }
};