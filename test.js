
var fs = require('fs'),
    DTest = require('./lib/DTest').create();

var testDir = __dirname + '/test',
    testFiles = fs.readdirSync(testDir),
    i = 0, len = testFiles.length, fileName;

for (; i < len; i++) {
    fileName = testFiles[i];
    console.log('--- TESTING ' + fileName + ' ---');
    DTest.testFuncs(testDir + '/' + fileName);
    console.log('');
}
