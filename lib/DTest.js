var fs = require('fs');

var Runtime = fs.readFileSync(__dirname + '/DTestRuntime.js');

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

module.exports.buildFuncs = function buildFuncs(code) {
    var regexFindTest = /\/\*\*([\w\W]+?\@test[\w\W]+?)\*\/\s*\n\s*function\s*(\w*)\s*\((.*?)\)/,
        regexFindTestInDoc = /[\s\n]*\*\s*\@test\s*(.*)/,
        codeOut = '',
        codeWindow = code,
        tests = [],
        match;

    while (match = regexFindTest.exec(codeWindow)) {
        var fullText = match[0],
            matchRange = match.index + fullText.length,
            docText = match[1].trim(),
            funcName = match[2],
            funcParams = match[3].split(',').map(_trim);

        //console.log('found match', match);

        // TODO: Add test is in obect / is in array

        // Append test before function
        // TODO: If in object add prefix
        codeOut += '\nfunction ' + funcName + '_test() {\n';
        // Add the function to the test array
        // TODO: This will also need object heirarchy
        tests.push(funcName);
        // Iterate through test matches
        while (match = regexFindTestInDoc.exec(docText)) {

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
                test = compParams[0],
                comparison = compParams[1];
            // Reduce test params set
            testParams = testParams.slice(0, funcParams.length);
            // Build out test
            codeOut += '\tDTestAssert(this, \'' + funcName + '\', [' + testParams.map(JSON.stringify).join(', ') + '], \'' + test + '\'' + 
                (comparison ? (', ' + JSON.stringify(comparison)) : '') + ');\n';
            // Update docText window
            docText = docText.substr(match.index + match[0].length);
        }
        codeOut += '}\n';
        // TODO: If in array add ,

        // Append function and update window
        codeOut += codeWindow.substr(0, matchRange);
        codeWindow = codeWindow.substr(matchRange);
    }

    // Add the rest of the code to the output
    codeOut += codeWindow;

    // Return the code
    // TODO: Potentially return object with details / errors + codeOut
    return { 
        code: codeOut,
        tests: tests 
    };
};

module.exports.testFuncs = function testFuncs(filePath) {
    // TODO: Add support for in browser alternative to fs.readFileSync
    var vm = require && require('vm'),
        code = fs.readFileSync(filePath, 'utf8'),
        codeObj = this.buildFuncs(code),
        codeOut = codeObj.code,
        tests = codeObj.tests;

    // Add runtime to the head
    codeOut = Runtime + '\n' + codeOut;

    // Compile tests into the code output
    codeOut += '\n\n// TESTS!';
    for (var i = 0; i < tests.length; i++) {
        codeOut += '\n';
        codeOut += tests[i] + '_test();';
    }

    if (vm) {
        // Running in node
        var context = {
            process: {
                stdout: process.stdout
            }
        };
        context.global = context;
        context.constructor = function Global() {};
        
        vm.runInNewContext(codeOut, context, filePath);
    } else {
        // Running in browser, limited to eval :(
        eval(codeOut);
    }
};