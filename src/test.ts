import { Server } from './server';

const app = new Server();
app.get('*', (req, res) => {
    res.send('123')
});

app.on('close', () => {

})
app.on('error', (error) => {

})

app.listen(3000)
