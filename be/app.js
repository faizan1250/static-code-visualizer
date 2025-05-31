const express = require('express');
const bodyParser = require('body-parser');
const router = require('./routes/analyze');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.json());
app.get('/', (req,res) =>{
    res.send("hi");
})
app.use('/analyze-code', router);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});