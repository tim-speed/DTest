var DTest = module.exports = require('./lib/DTest');

if (module.parent && module.parent.filename.slice(-5) != 'dtest')
    return DTest;

// Running in CLI mode
var fs = require('fs');

var help;
/* jshint ignore:start */
help = 'Usage: dtest [options] <files> | directory\n\
\n\
Options:\n\
-r            recursively test files in directory\n\
-h, --help    print this info\n\
\n';
/* jshint ignore:end */

var args = process.execArgv,
    recursive = false,
    files = [],
    i = 0;

if (!args.length) {
    args = process.argv.slice(2);
}

for (; i < args.length; i++) {
    var arg = args[i];

    if (arg[0] === '-') {
        switch (arg) {
            case '-h':
            case '--help':
                process.stdout.write(help);
                return;
            case '-r':
                recursive = true;
                break;
        }
    } else {
        // Treat as files
        if (arg[0] === '/') {
            // Add as is
            files.push(arg);
        } else {
            // Convert to absolute and add
            if (arg.substr(0, 2) === './') {
                files.push(__dirname + '/' + arg.substr(2));
            } else {
                files.push(__dirname + '/' + arg);
            }
        }
    }
}

if (!files.length) {
    process.stdout.write(help);
    return;
}

function log(text, path) {
    console.log('--- ' + text + ' ' + path + ' ---');
}

// Iterate through files, expand directories to their child files
function recursiveFilesProcess(files, level) {
    var i = 0, 
        len = files.length, 
        filePath, fileInfo;
    for (; i < len; i++) {
        filePath = files[i];
        fileInfo = fs.statSync(filePath);

        if (fileInfo.isFile()) {
            log('TESTING', filePath);
            DTest.testFuncs(filePath);
            console.log('');
        } else if (fileInfo.isDirectory()) {
            if (recursive || level === 0) {
                // Get files
                var children = fs.readdirSync(filePath).map(function(val) {
                    return filePath + '/' + val;
                });
                // Process
                recursiveFilesProcess(children, level + 1);
            } else {
                log('SKIPPING - Child directory without recursive option: ', filePath);
            }
        } else {
            log('SKIPPING - Unhandled object type: ', filePath);
        }
    }
}

recursiveFilesProcess(files, 0);