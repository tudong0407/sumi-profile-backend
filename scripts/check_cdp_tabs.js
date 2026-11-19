import http from 'http';

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  const tabs = await getJson('http://127.0.0.1:9222/json');
  console.log('Open tabs in Edge:');
  tabs.forEach(t => {
    console.log(`- [${t.type}] ${t.title} (${t.url})`);
  });
}

main().catch(console.error);
