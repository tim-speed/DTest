var child_process = require('child_process');

var app = child_process.exec(__dirname + '/bin/dtest -r ./test');

app.stdout.pipe(process.stdout);
app.stderr.pipe(process.stderr);
