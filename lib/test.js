"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = require("./server");
const app = new server_1.Server();
app.get('*', (req, res) => {
    res.send('123');
});
app.on('close', () => {
});
app.on('error', (error) => {
});
app.listen(3000);
//# sourceMappingURL=test.js.map