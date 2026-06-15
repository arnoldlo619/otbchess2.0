import http from 'http';

const BASE = 'http://localhost:3000';
const TOURNAMENT_ID = 'clean-test-' + Date.now();

const players = [];
let sseEventsReceived = 0;
let allConnected = 0;
let allRejected = 0;

for (let i = 0; i < 10; i++) {
  const req = http.get(`${BASE}/api/tournament/${TOURNAMENT_ID}/players/stream`, (res) => {
    if (res.statusCode === 429) {
      console.log(`[PLAYER ${i+1}] REJECTED (429)`);
      allRejected++;
      return;
    }
    console.log(`[PLAYER ${i+1}] ✓ SSE connected`);
    allConnected++;
    res.on('data', (chunk) => {
      const text = chunk.toString();
      if (text.includes('tournament_started')) {
        sseEventsReceived++;
        console.log(`[PLAYER ${i+1}] ✓ Received tournament_started`);
      }
    });
  });
  players.push(req);
}

setTimeout(() => {
  console.log(`\n[DIRECTOR] POST /start...`);
  const postData = JSON.stringify({
    round: 1,
    games: [{ id: 'g1', board: 1, whiteId: 'p1', blackId: 'p2', result: '*' }],
    players: [
      { id: 'p1', username: 'testplayer1', name: 'Test 1', elo: 1200, points: 0 },
      { id: 'p2', username: 'testplayer2', name: 'Test 2', elo: 1300, points: 0 },
    ],
  });
  const postReq = http.request(`${BASE}/api/tournament/${TOURNAMENT_ID}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
  }, (res) => {
    let body = '';
    res.on('data', (d) => body += d);
    res.on('end', () => console.log(`[DIRECTOR] Response: ${res.statusCode} ${body}`));
  });
  postReq.write(postData);
  postReq.end();
}, 2000);

setTimeout(() => {
  console.log(`\n[POLLING] GET /live-state...`);
  http.get(`${BASE}/api/tournament/${TOURNAMENT_ID}/live-state`, (res) => {
    let body = '';
    res.on('data', (d) => body += d);
    res.on('end', () => {
      const data = JSON.parse(body);
      console.log(`[POLLING] status=${data.status}, players=${data.players?.length}`);
    });
  });
}, 3000);

setTimeout(() => {
  console.log(`\n═══ RESULTS ═══`);
  console.log(`Connected: ${allConnected}/10, Rejected: ${allRejected}/10`);
  console.log(`SSE events received: ${sseEventsReceived}/${allConnected}`);
  const pass = allConnected === 10 && sseEventsReceived === 10;
  console.log(pass ? '✓ ALL TESTS PASSED' : '✗ FAILED');
  players.forEach(r => r.destroy());
  process.exit(pass ? 0 : 1);
}, 4000);
