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
    cwd = process.cwd(),
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
                files.push(cwd + '/' + arg.substr(2));
            } else {
                files.push(cwd + '/' + arg);
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
function recursiveFilesProcess(files, level, cb) {
    var i = -1, 
        len = files.length;

    function next() {
        if (++i >= len)
            return cb && cb();

        var filePath = files[i],
            fileInfo = fs.statSync(filePath);

        if (fileInfo.isFile()) {
            log('TESTING', filePath);
            // TODO: need to add code to test / wait for completion of async
            DTest.testFuncs(filePath, function recursiveFilesProcessTestFuncsCallback() {
                next();
            });
        } else if (fileInfo.isDirectory()) {
            if (recursive || level === 0) {
                // Get files
                var children = fs.readdirSync(filePath).map(function(val) {
                    return filePath + '/' + val;
                });
                // Process
                recursiveFilesProcess(children, level + 1, function recursiveFilesProcessDirCallback() {
                    next();
                });
            } else {
                log('SKIPPING - Child directory without recursive option: ', filePath);
                next();
            }
        } else {
            log('SKIPPING - Unhandled object type: ', filePath);
            next();
        }
    }

    // Handle the first file
    next();
}

recursiveFilesProcess(files, 0);