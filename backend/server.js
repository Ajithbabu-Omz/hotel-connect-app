const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/', require('./routes/auth'));
app.use('/admin', require('./routes/admin'));
app.use('/', require('./routes/community'));
app.use('/', require('./routes/channels'));
app.use('/', require('./routes/notifications'));

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Community App Backend running on http://localhost:${PORT}`);
  console.log('Default admin: username=admin  password=admin123');
});
