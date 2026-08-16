const fetch = require('node-fetch');

async function check() {
  const res = await fetch('http://localhost:5000/api/v1/admin/showtimes?limit=50');
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

check();
