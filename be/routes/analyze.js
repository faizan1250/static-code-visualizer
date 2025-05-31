const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();
const parseCppCode = require('../services/cppParser');



router.post('/', (req, res) => {
 const filePath = path.join(__dirname, '../test', 'sample.cpp');
 console.log("reading from file", filePath);
 
  fs.readFile(filePath, 'utf8', (err, code) => {
    if (err) {
      console.error('File read error:', err);
      return res.status(500).json({ error: 'Failed to read code file' });
    }

    try {
      const analysis = parseCppCode(code);
      res.json(analysis);
    } catch (parseError) {
      console.error('Parsing error:', parseError);
      res.status(500).json({ error: 'Failed to parse code' });
    }
  });
});

module.exports = router;
